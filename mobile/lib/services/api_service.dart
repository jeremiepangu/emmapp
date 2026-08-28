import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/app_config.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.statusCode]);

  final String message;
  final int? statusCode;

  bool get isClientError =>
      statusCode != null && statusCode! >= 400 && statusCode! < 500 && statusCode != 408;

  @override
  String toString() => message;
}

class ApiService {
  ApiService({this.token});

  String? token;
  final String baseUrl = AppConfig.apiBaseUrl;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Uri _uri(String path, [Map<String, String>? query]) {
    final normalized = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$normalized').replace(queryParameters: query);
  }

  dynamic _decode(http.Response response) {
    if (response.statusCode == 204 || response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }

  void _check(http.Response response) {
    if (response.statusCode < 400) return;
    String message = 'Erreur API (${response.statusCode})';
    try {
      final parsed = jsonDecode(response.body);
      if (parsed is Map && parsed['message'] != null) {
        final m = parsed['message'];
        message = m is List ? m.join(', ') : m.toString();
      }
    } catch (_) {}
    if (response.statusCode == 401) {
      throw ApiException('Session expirée — reconnectez-vous.', 401);
    }
    if (response.statusCode == 403) {
      throw ApiException("Votre profil n'a pas accès à cette ressource.", 403);
    }
    throw ApiException(message, response.statusCode);
  }

  Future<dynamic> getJson(String path, {Map<String, String>? query}) async {
    final response = await http.get(_uri(path, query), headers: _headers);
    _check(response);
    return _decode(response);
  }

  Future<dynamic> send(String method, String path, [Map<String, dynamic>? body]) async {
    final uri = _uri(path);
    final encoded = body == null ? null : jsonEncode(body);
    late http.Response response;
    switch (method.toUpperCase()) {
      case 'POST':
        response = await http.post(uri, headers: _headers, body: encoded);
        break;
      case 'PATCH':
        response = await http.patch(uri, headers: _headers, body: encoded);
        break;
      case 'PUT':
        response = await http.put(uri, headers: _headers, body: encoded);
        break;
      case 'DELETE':
        response = await http.delete(uri, headers: _headers, body: encoded);
        break;
      default:
        throw ApiException('Méthode HTTP non supportée: $method');
    }
    _check(response);
    return _decode(response);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      _uri('/auth/login'),
      headers: _headers,
      body: jsonEncode({'email': email, 'password': password}),
    );
    _check(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> getTours({String? driverId}) async {
    final data = await getJson(
      '/tours',
      query: driverId != null ? {'driverId': driverId} : null,
    );
    return data is List ? data : [];
  }

  Future<Map<String, dynamic>> createDelivery(Map<String, dynamic> data) async {
    return Map<String, dynamic>.from(await send('POST', '/deliveries', data) as Map);
  }

  Future<Map<String, dynamic>> createPayment(Map<String, dynamic> data) async {
    return Map<String, dynamic>.from(await send('POST', '/payments', data) as Map);
  }

  Future<Map<String, dynamic>> syncPush(String deviceId, List<Map<String, dynamic>> items) async {
    return Map<String, dynamic>.from(
      await send('POST', '/sync/push', {'deviceId': deviceId, 'items': items}) as Map,
    );
  }

  Future<Map<String, dynamic>> syncPull({String? since}) async {
    final data = await getJson('/sync/pull', query: since != null ? {'since': since} : null);
    return Map<String, dynamic>.from(data as Map);
  }
}
