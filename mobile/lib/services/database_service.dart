import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseService {
  DatabaseService._();
  static final DatabaseService instance = DatabaseService._();
  Database? _db;

  Future<void> init() async {
    final dbPath = await getDatabasesPath();
    _db = await openDatabase(
      join(dbPath, 'emmapp_offline.db'),
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pending_sync (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            local_id TEXT UNIQUE NOT NULL,
            entity_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE cached_tours (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE cached_clients (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        ''');
      },
    );
  }

  Database get db {
    if (_db == null) throw StateError('Database not initialized');
    return _db!;
  }

  Future<void> queueSyncItem({
    required String localId,
    required String entityType,
    required Map<String, dynamic> payload,
  }) async {
    await db.insert(
      'pending_sync',
      {
        'local_id': localId,
        'entity_type': entityType,
        'payload': jsonEncode(payload),
        'created_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> getPendingSyncItems() async {
    return db.query('pending_sync', orderBy: 'created_at ASC');
  }

  Future<void> removePendingSyncItem(String localId) async {
    await db.delete('pending_sync', where: 'local_id = ?', whereArgs: [localId]);
  }

  Future<void> cacheTours(List<Map<String, dynamic>> tours) async {
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
    return rows.map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>).toList();
  }

  Future<void> cacheClients(List<Map<String, dynamic>> clients) async {
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
