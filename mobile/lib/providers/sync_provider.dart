import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/modules.dart';
import '../core/permissions.dart';
import '../services/api_service.dart';
import '../services/connectivity_service.dart';
import '../services/database_service.dart';
import 'auth_provider.dart';

class SyncProvider extends ChangeNotifier {
  bool _isSyncing = false;
  int _pendingCount = 0;
  String? _lastSyncAt;
  String? _status;
  bool _online = true;

  bool get isSyncing => _isSyncing;
  int get pendingCount => _pendingCount;
  String? get lastSyncAt => _lastSyncAt;
  String? get status => _status;
  bool get online => _online;

  SyncProvider() {
    ConnectivityService.isOnline().then((v) {
      _online = v;
      notifyListeners();
    });
    ConnectivityService.onChange.listen((v) {
      final wasOffline = !_online;
      _online = v;
      notifyListeners();
      if (wasOffline && v) {
        _status = 'Réseau revenu — synchronisation…';
        notifyListeners();
      }
    });
  }

  Future<void> refreshPendingCount() async {
    _pendingCount = await DatabaseService.instance.pendingCount();
    notifyListeners();
  }

  Future<void> syncAll(AuthProvider auth) async {
    _online = await ConnectivityService.isOnline();
    if (!_online) {
      _status = 'Hors ligne — les actions restent en file locale';
      await refreshPendingCount();
      return;
    }

    _isSyncing = true;
    _status = 'Synchronisation en cours…';
    notifyListeners();

    try {
      await _replayMutations(auth);
      await _pushLegacySync(auth);
      await _pullCatalog(auth);
      await _prefetchModules(auth);
      _lastSyncAt = DateTime.now().toIso8601String();
      await DatabaseService.instance.setKv('last_sync_at', _lastSyncAt!);
      _status = 'Synchronisation réussie';
    } catch (e) {
      _status = 'Erreur: $e';
    }

    await refreshPendingCount();
    _isSyncing = false;
    notifyListeners();
  }

  Future<void> _replayMutations(AuthProvider auth) async {
    final pending = await DatabaseService.instance.getPendingMutations();
    for (final item in pending) {
      if (item.entityType == 'delivery' || item.entityType == 'payment') {
        continue;
      }
      try {
        await auth.api.send(item.method, item.path, item.body);
        await DatabaseService.instance.removeMutation(item.localId);
      } on ApiException catch (e) {
        if (e.isClientError && e.statusCode != 409) {
          await DatabaseService.instance.removeMutation(item.localId);
        }
      } catch (_) {
        // reste en file
      }
    }
  }

  Future<void> _pushLegacySync(AuthProvider auth) async {
    final pending = (await DatabaseService.instance.getPendingMutations())
        .where((m) => m.entityType == 'delivery' || m.entityType == 'payment')
        .toList();
    if (pending.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    final deviceId = prefs.getString('device_id') ?? 'device-${auth.user?.id}';
    await prefs.setString('device_id', deviceId);

    try {
      final result = await auth.api.syncPush(
        deviceId,
        pending.map((p) => p.toSyncItem()).toList(),
      );
      final results = result['results'] as List<dynamic>? ?? [];
      for (final r in results) {
        if (r is Map && r['status'] == 'SYNCED') {
          await DatabaseService.instance.removeMutation(r['localId'] as String);
        }
      }
    } catch (_) {
      for (final item in pending) {
        try {
          await auth.api.send(item.method, item.path, item.body);
          await DatabaseService.instance.removeMutation(item.localId);
        } catch (_) {}
      }
    }
  }

  Future<void> _pullCatalog(AuthProvider auth) async {
    final since = await DatabaseService.instance.getKv('last_sync_at');
    try {
      final pull = await auth.api.syncPull(since: since);
      if (pull['clients'] is List) {
        await DatabaseService.instance.cacheClients(
          (pull['clients'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList(),
        );
      }
      if (pull['tours'] is List) {
        await DatabaseService.instance.cacheTours(
          (pull['tours'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList(),
        );
      }
      if (pull['products'] != null) {
        await DatabaseService.instance.cacheResponse('/products', pull['products']);
      }
      if (pull['orders'] != null) {
        await DatabaseService.instance.cacheResponse('/orders', pull['orders']);
      }
      if (pull['pulledAt'] is String) {
        _lastSyncAt = pull['pulledAt'] as String;
      }
    } catch (_) {
      // prefetch below remains the fallback
    }
  }

  Future<void> _prefetchModules(AuthProvider auth) async {
    final role = auth.user?.role;
    final paths = <String>{};
    for (final module in appModules) {
      if (!can(role, module.resource, 'read', auth.user?.permissions)) continue;
      paths.addAll(module.prefetchPaths);
    }
    if (fieldRoles.contains(role) && auth.user != null) {
      paths.add('/tours?driverId=${auth.user!.id}');
    }
    for (final path in paths) {
      try {
        final data = await auth.api.getJson(path);
        await DatabaseService.instance.cacheResponse(path, data);
      } catch (_) {}
    }
  }
}
