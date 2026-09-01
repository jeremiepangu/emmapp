import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../core/json_utils.dart';
import '../models/models.dart';
import '../services/connectivity_service.dart';
import '../services/database_service.dart';
import 'auth_provider.dart';

class TourProvider extends ChangeNotifier {
  List<Tour> _tours = [];
  bool _isLoading = false;
  String? _error;
  bool _fromCache = false;

  List<Tour> get tours => _tours;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get fromCache => _fromCache;

  Future<void> loadTours(AuthProvider auth, {bool forceOnline = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final field = ['LIVREUR', 'CHARGE_LIVRAISON'].contains(auth.user?.role);
      final path = field ? '/tours?driverId=${auth.user!.id}' : '/tours';
      final result = await auth.offline.get(path);
      final list = asRecordList(result.data);
      await DatabaseService.instance.cacheTours(list);
      _tours = list.map(Tour.fromJson).toList();
      _fromCache = result.fromCache;
    } catch (e) {
      _error = e.toString();
      final cached = await DatabaseService.instance.getCachedTours();
      if (cached.isNotEmpty) {
        _tours = cached.map(Tour.fromJson).toList();
        _fromCache = true;
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
  final Map<String, int> refused = {};
}

class DeliveryProvider {
  static Future<({bool queued, String? deliveryId})> submitDelivery({
    required AuthProvider auth,
    required Order order,
    required String tourId,
    required DeliveryFormData form,
    double? latitude,
    double? longitude,
    String? notes,
    String? signatureUrl,
  }) async {
    const uuid = Uuid();
    final localId = uuid.v4();

    final lines = order.lines.map((line) {
      return {
        'productId': line.productId,
        'qtyDelivered': form.delivered[line.productId] ?? line.quantity,
        'qtyReturned': form.returned[line.productId] ?? 0,
        'qtyDamaged': form.damaged[line.productId] ?? 0,
        'qtyRefused': form.refused[line.productId] ?? 0,
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
      'signatureUrl': signatureUrl,
      'localId': localId,
      'lines': lines,
    };

    final result = await auth.offline.mutate(
      method: 'POST',
      path: '/deliveries',
      body: payload,
      entityType: 'delivery',
      localId: localId,
    );
    String? deliveryId;
    if (result.data is Map) {
      final map = Map<String, dynamic>.from(result.data as Map);
      deliveryId = map['id'] as String?;
    }
    return (queued: result.queued, deliveryId: deliveryId);
  }

  static Future<bool> submitPayment({
    required AuthProvider auth,
    required String? deliveryId,
    required String? clientId,
    required double amount,
    required String method,
    String? orderId,
    bool asAdvance = false,
  }) async {
    if (amount <= 0) return false;
    const uuid = Uuid();
    final localId = uuid.v4();
    final payload = {
      if (deliveryId != null) 'deliveryId': deliveryId,
      if (clientId != null) 'clientId': clientId,
      if (orderId != null) 'orderId': orderId,
      'amount': amount,
      'method': method,
      if (asAdvance) 'asAdvance': true,
      'localId': localId,
    };
    final result = await auth.offline.mutate(
      method: 'POST',
      path: '/payments',
      body: payload,
      entityType: 'payment',
      localId: localId,
    );
    return result.queued;
  }
}

/// Conservé pour compatibilité avec d'anciens appels.
Future<bool> isDeviceOnline() => ConnectivityService.isOnline();

@Deprecated('Use ConnectivityService')
Future<ConnectivityResult> legacyConnectivity() async {
  final list = await Connectivity().checkConnectivity();
  return list.isEmpty ? ConnectivityResult.none : list.first;
}
