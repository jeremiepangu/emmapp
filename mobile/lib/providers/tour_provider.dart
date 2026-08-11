import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/models.dart';
import '../services/database_service.dart';
import 'auth_provider.dart';

class TourProvider extends ChangeNotifier {
  List<Tour> _tours = [];
  bool _isLoading = false;
  String? _error;

  List<Tour> get tours => _tours;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadTours(AuthProvider auth, {bool forceOnline = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final connectivity = await Connectivity().checkConnectivity();
      final isOnline = connectivity != ConnectivityResult.none;

      if (isOnline || forceOnline) {
        final data = await auth.api.getTours(driverId: auth.user?.id);
        await DatabaseService.instance.cacheTours(
          data.cast<Map<String, dynamic>>(),
        );
        _tours = data.map((e) => Tour.fromJson(e as Map<String, dynamic>)).toList();
      } else {
        final cached = await DatabaseService.instance.getCachedTours();
        _tours = cached.map(Tour.fromJson).toList();
      }
    } catch (e) {
      _error = e.toString();
      final cached = await DatabaseService.instance.getCachedTours();
      if (cached.isNotEmpty) {
        _tours = cached.map(Tour.fromJson).toList();
      }
    }

    _isLoading = false;
    notifyListeners();
  }
}

class DeliveryFormData {
  final Map<String, int> delivered = {};
  final Map<String, int> returned = {};
  final Map<String, int> damaged = {};
}

class DeliveryProvider {
  static Future<void> submitDelivery({
    required AuthProvider auth,
    required Order order,
    required String tourId,
    required DeliveryFormData form,
    double? latitude,
    double? longitude,
    String? notes,
  }) async {
    const uuid = Uuid();
    final localId = uuid.v4();

    final lines = order.lines.map((line) {
      return {
        'productId': line.productId,
        'qtyDelivered': form.delivered[line.productId] ?? line.quantity,
        'qtyReturned': form.returned[line.productId] ?? 0,
        'qtyDamaged': form.damaged[line.productId] ?? 0,
        'qtyRefused': 0,
        'unitPrice': line.unitPrice,
      };
    }).toList();

    final payload = {
      'orderId': order.id,
      'tourId': tourId,
      'deliveredAt': DateTime.now().toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
      'notes': notes,
      'localId': localId,
      'lines': lines,
    };

    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity == ConnectivityResult.none) {
      await DatabaseService.instance.queueSyncItem(
        localId: localId,
        entityType: 'delivery',
        payload: payload,
      );
      return;
    }

    try {
      await auth.api.createDelivery(payload);
    } catch (_) {
      await DatabaseService.instance.queueSyncItem(
        localId: localId,
        entityType: 'delivery',
        payload: payload,
      );
    }
  }

  static Future<void> submitPayment({
    required AuthProvider auth,
    required String? deliveryId,
    required String? clientId,
    required double amount,
    required String method,
  }) async {
    const uuid = Uuid();
    final localId = uuid.v4();

    final payload = {
      'deliveryId': deliveryId,
      'clientId': clientId,
      'amount': amount,
      'method': method,
      'localId': localId,
    };

    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity == ConnectivityResult.none) {
      await DatabaseService.instance.queueSyncItem(
        localId: localId,
        entityType: 'payment',
        payload: payload,
      );
      return;
    }

    try {
      await auth.api.createPayment(payload);
    } catch (_) {
      await DatabaseService.instance.queueSyncItem(
        localId: localId,
        entityType: 'payment',
        payload: payload,
      );
    }
  }
}
