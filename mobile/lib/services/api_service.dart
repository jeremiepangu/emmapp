import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config/app_config.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, [this.statusCode]);

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

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _headers,
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException('Identifiants invalides', response.statusCode);
  }

  Future<List<dynamic>> getTours({String? driverId}) async {
    final uri = Uri.parse('$baseUrl/tours').replace(
      queryParameters: driverId != null ? {'driverId': driverId} : null,
    );
    final response = await http.get(uri, headers: _headers);
    _checkResponse(response);
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> createDelivery(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/deliveries'),
      headers: _headers,
      body: jsonEncode(data),
    );
    _checkResponse(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createPayment(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/payments'),
      headers: _headers,
      body: jsonEncode(data),
    );
    _checkResponse(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> syncPush(String deviceId, List<Map<String, dynamic>> items) async {
    final response = await http.post(
      Uri.parse('$baseUrl/sync/push'),
      headers: _headers,
      body: jsonEncode({'deviceId': deviceId, 'items': items}),
    );
    _checkResponse(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> syncPull({String? since}) async {
    final uri = Uri.parse('$baseUrl/sync/pull').replace(
      queryParameters: since != null ? {'since': since} : null,
    );
    final response = await http.get(uri, headers: _headers);
    _checkResponse(response);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  void _checkResponse(http.Response response) {
    if (response.statusCode >= 400) {
      throw ApiException('Erreur API (${response.statusCode})', response.statusCode);
    }
  }
}
