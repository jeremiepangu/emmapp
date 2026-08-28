import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/permissions.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/connectivity_service.dart';
import '../services/offline_client.dart';

class AuthProvider extends ChangeNotifier {
  User? _user;
  String? _token;
  bool _isLoading = true;
  final ApiService _api = ApiService();
  late final OfflineClient offline = OfflineClient(_api);

  User? get user => _user;
  String? get token => _token;
  bool get isAuthenticated => _token != null && _user != null;
  bool get isLoading => _isLoading;
  ApiService get api => _api;

  bool canDo(String resource, String action) =>
      can(_user?.role, resource, action, _user?.permissions);

  AuthProvider() {
    _loadSession();
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    final userJson = prefs.getString('user');
    if (_token != null && userJson != null) {
      _user = User.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      _api.token = _token;
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final online = await ConnectivityService.isOnline();
    if (!online) {
      throw ApiException('Connexion internet requise pour la première authentification.');
    }
    final result = await _api.login(email, password);
    if (result['mfaRequired'] == true) {
      throw ApiException('Code MFA requis — utilisez le back-office pour cette session.');
    }
    _token = result['accessToken'] as String?;
    if (_token == null || _token!.isEmpty) {
      throw ApiException('Réponse de connexion invalide');
    }
    Map<String, List<String>>? matrix;
    if (result['permissions'] is Map) {
      matrix = (result['permissions'] as Map).map((key, value) {
        final list = value is List ? value.map((e) => e.toString()).toList() : <String>[];
        return MapEntry(key.toString(), list);
      });
    }
    _user = User.fromJson(result['user'] as Map<String, dynamic>, matrix);
    _api.token = _token;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', _token!);
    await prefs.setString('user', jsonEncode(_user!.toJson()));
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    _api.token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
    notifyListeners();
  }
}
