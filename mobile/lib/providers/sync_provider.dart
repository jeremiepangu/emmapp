import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/database_service.dart';
import 'auth_provider.dart';

class SyncProvider extends ChangeNotifier {
  bool _isSyncing = false;
  int _pendingCount = 0;
  String? _lastSyncAt;
  String? _status;

  bool get isSyncing => _isSyncing;
  int get pendingCount => _pendingCount;
  String? get lastSyncAt => _lastSyncAt;
  String? get status => _status;

  Future<void> refreshPendingCount() async {
    final items = await DatabaseService.instance.getPendingSyncItems();
    _pendingCount = items.length;
    notifyListeners();
  }

  Future<void> syncAll(AuthProvider auth) async {
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity == ConnectivityResult.none) {
      _status = 'Hors ligne - synchronisation impossible';
      notifyListeners();
      return;
    }

    _isSyncing = true;
    _status = 'Synchronisation en cours...';
    notifyListeners();

    try {
      final pending = await DatabaseService.instance.getPendingSyncItems();
      if (pending.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        final deviceId = prefs.getString('device_id') ?? 'device-${auth.user?.id}';
        await prefs.setString('device_id', deviceId);

        final items = pending.map((p) => {
              'localId': p['local_id'],
              'entityType': p['entity_type'],
              'payload': jsonDecode(p['payload'] as String),
            }).toList();

        final result = await auth.api.syncPush(deviceId, items.cast<Map<String, dynamic>>());
        final results = result['results'] as List<dynamic>;

        for (final r in results) {
          if (r['status'] == 'SYNCED') {
            await DatabaseService.instance.removePendingSyncItem(r['localId'] as String);
          }
        }
      }

      final since = _lastSyncAt;
      final pullResult = await auth.api.syncPull(since: since);
      if (pullResult['clients'] != null) {
        await DatabaseService.instance.cacheClients(
          (pullResult['clients'] as List).cast<Map<String, dynamic>>(),
        );
      }
      if (pullResult['tours'] != null) {
        await DatabaseService.instance.cacheTours(
          (pullResult['tours'] as List).cast<Map<String, dynamic>>(),
        );
      }

      _lastSyncAt = pullResult['pulledAt'] as String?;
      _status = 'Synchronisation réussie';
    } catch (e) {
      _status = 'Erreur: $e';
    }

    await refreshPendingCount();
    _isSyncing = false;
    notifyListeners();
  }
}
