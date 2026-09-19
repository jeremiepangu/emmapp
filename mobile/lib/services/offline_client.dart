import 'package:uuid/uuid.dart';

import 'api_service.dart';
import 'connectivity_service.dart';
import 'database_service.dart';

class OfflineResult {
  OfflineResult({required this.data, required this.fromCache, required this.queued});

  final dynamic data;
  final bool fromCache;
  final bool queued;
}

class OfflineClient {
  OfflineClient(this.api);

  final ApiService api;
  static const _uuid = Uuid();

  Future<OfflineResult> get(String path, {bool forceRefresh = false}) async {
    final online = await ConnectivityService.isOnline();
    if (online) {
      try {
        final data = await api.getJson(path);
        await DatabaseService.instance.cacheResponse(path, data);
        return OfflineResult(data: data, fromCache: false, queued: false);
      } catch (e) {
        final cached = await DatabaseService.instance.getCachedResponse(path);
        if (cached != null) {
          return OfflineResult(data: cached, fromCache: true, queued: false);
        }
        rethrow;
      }
    }
    final cached = await DatabaseService.instance.getCachedResponse(path);
    if (cached != null) {
      return OfflineResult(data: cached, fromCache: true, queued: false);
    }
    throw ApiException('Hors ligne — aucune donnée en cache pour $path');
  }

  Future<OfflineResult> mutate({
    required String method,
    required String path,
    Map<String, dynamic>? body,
    String entityType = 'http',
    String? localId,
  }) async {
    final id = localId ?? _uuid.v4();
    final payload = body == null ? null : Map<String, dynamic>.from(body);
    if (payload != null && (entityType == 'delivery' || entityType == 'payment')) {
      payload['localId'] = id;
    }

    final online = await ConnectivityService.isOnline();
    if (online) {
      try {
        final data = await api.send(method, path, payload);
        return OfflineResult(data: data, fromCache: false, queued: false);
      } on ApiException catch (e) {
        if (e.isClientError) rethrow;
        await _queue(id, method, path, payload, entityType);
        return OfflineResult(
          data: {'_offline': true, 'queued': true, 'localId': id},
          fromCache: false,
          queued: true,
        );
      } catch (_) {
        await _queue(id, method, path, payload, entityType);
        return OfflineResult(
          data: {'_offline': true, 'queued': true, 'localId': id},
          fromCache: false,
          queued: true,
        );
      }
    }

    await _queue(id, method, path, payload, entityType);
    return OfflineResult(
      data: {'_offline': true, 'queued': true, 'localId': id},
      fromCache: false,
      queued: true,
    );
  }

  Future<void> _queue(
    String id,
    String method,
    String path,
    Map<String, dynamic>? body,
    String entityType,
  ) {
    return DatabaseService.instance.queueMutation(
      PendingMutation(
        localId: id,
        method: method,
        path: path,
        entityType: entityType,
        body: body,
      ),
    );
  }
}
