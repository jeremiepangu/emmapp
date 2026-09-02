import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class PendingMutation {
  PendingMutation({
    required this.localId,
    required this.method,
    required this.path,
    required this.entityType,
    this.body,
    this.createdAt,
    this.retries = 0,
  });

  final String localId;
  final String method;
  final String path;
  final String entityType;
  final Map<String, dynamic>? body;
  final String? createdAt;
  final int retries;

  Map<String, dynamic> toSyncItem() => {
        'localId': localId,
        'entityType': entityType,
        'payload': body ?? {},
      };
}

class DatabaseService {
  DatabaseService._();
  static final DatabaseService instance = DatabaseService._();

  Database? _db;

  Future<void> init() async {
    final dbPath = await getDatabasesPath();
    _db = await openDatabase(
      join(dbPath, 'emmapp_offline.db'),
      version: 2,
      onCreate: (db, version) async {
        await _createV1(db);
        await _createV2(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) await _createV2(db);
      },
    );
  }

  Future<void> _createV1(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS pending_sync (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id TEXT UNIQUE NOT NULL,
        entity_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS cached_tours (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS cached_clients (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
  }

  Future<void> _createV2(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS cached_responses (
        path TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS pending_mutations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id TEXT UNIQUE NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        body TEXT,
        retries INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');
  }

  Database get db {
    if (_db == null) throw StateError('Database not initialized');
    return _db!;
  }

  Future<void> cacheResponse(String path, dynamic data) async {
    await db.insert(
      'cached_responses',
      {
        'path': path,
        'data': jsonEncode(data),
        'updated_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<dynamic> getCachedResponse(String path) async {
    final rows = await db.query(
      'cached_responses',
      where: 'path = ?',
      whereArgs: [path],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['data'] as String);
  }

  Future<void> setKv(String key, String value) async {
    await db.insert(
      'kv',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getKv(String key) async {
    final rows = await db.query('kv', where: 'key = ?', whereArgs: [key], limit: 1);
    if (rows.isEmpty) return null;
    return rows.first['value'] as String;
  }

  Future<void> queueMutation(PendingMutation mutation) async {
    await db.insert(
      'pending_mutations',
      {
        'local_id': mutation.localId,
        'method': mutation.method,
        'path': mutation.path,
        'entity_type': mutation.entityType,
        'body': mutation.body == null ? null : jsonEncode(mutation.body),
        'retries': mutation.retries,
        'created_at': mutation.createdAt ?? DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<PendingMutation>> getPendingMutations() async {
    final rows = await db.query('pending_mutations', orderBy: 'created_at ASC');
    final fromNew = rows
        .map(
          (r) => PendingMutation(
            localId: r['local_id'] as String,
            method: r['method'] as String,
            path: r['path'] as String,
            entityType: r['entity_type'] as String,
            body: r['body'] == null
                ? null
                : jsonDecode(r['body'] as String) as Map<String, dynamic>,
            createdAt: r['created_at'] as String?,
            retries: r['retries'] as int? ?? 0,
          ),
        )
        .toList();

    final legacy = await db.query('pending_sync', orderBy: 'created_at ASC');
    for (final r in legacy) {
      final entity = r['entity_type'] as String;
      fromNew.add(
        PendingMutation(
          localId: r['local_id'] as String,
          method: 'POST',
          path: entity == 'payment' ? '/payments' : '/deliveries',
          entityType: entity,
          body: jsonDecode(r['payload'] as String) as Map<String, dynamic>,
          createdAt: r['created_at'] as String?,
        ),
      );
    }
    return fromNew;
  }

  Future<void> removeMutation(String localId) async {
    await db.delete('pending_mutations', where: 'local_id = ?', whereArgs: [localId]);
    await db.delete('pending_sync', where: 'local_id = ?', whereArgs: [localId]);
  }

  Future<int> pendingCount() async {
    final a = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM pending_mutations'),
        ) ??
        0;
    final b = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM pending_sync'),
        ) ??
        0;
    return a + b;
  }

  Future<void> queueSyncItem({
    required String localId,
    required String entityType,
    required Map<String, dynamic> payload,
  }) async {
    await queueMutation(
      PendingMutation(
        localId: localId,
        method: 'POST',
        path: entityType == 'payment' ? '/payments' : '/deliveries',
        entityType: entityType,
        body: payload,
      ),
    );
  }

  Future<List<Map<String, dynamic>>> getPendingSyncItems() async {
    return (await getPendingMutations())
        .where((m) => m.entityType == 'delivery' || m.entityType == 'payment')
        .map((m) => {
              'local_id': m.localId,
              'entity_type': m.entityType,
              'payload': jsonEncode(m.body ?? {}),
            })
        .toList();
  }

  Future<void> removePendingSyncItem(String localId) => removeMutation(localId);

  Future<void> cacheTours(List<Map<String, dynamic>> tours) async {
    await cacheResponse('/tours', tours);
    final batch = db.batch();
    for (final tour in tours) {
      batch.insert(
        'cached_tours',
        {
          'id': tour['id'],
          'data': jsonEncode(tour),
          'updated_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> getCachedTours() async {
    final rows = await db.query('cached_tours');
    if (rows.isNotEmpty) {
      return rows
          .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
          .toList();
    }
    final cached = await getCachedResponse('/tours');
    if (cached is List) {
      return cached
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return [];
  }

  Future<void> cacheClients(List<Map<String, dynamic>> clients) async {
    await cacheResponse('/clients', clients);
    final batch = db.batch();
    for (final client in clients) {
      batch.insert(
        'cached_clients',
        {
          'id': client['id'],
          'data': jsonEncode(client),
          'updated_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }
}
