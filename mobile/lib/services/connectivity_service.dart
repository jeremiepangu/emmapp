import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  static bool _onlineFrom(List<ConnectivityResult> results) {
    if (results.isEmpty) return false;
    return results.any((r) => r != ConnectivityResult.none);
  }

  static Future<bool> isOnline() async {
    final results = await Connectivity().checkConnectivity();
    return _onlineFrom(results);
  }

  static Stream<bool> get onChange =>
      Connectivity().onConnectivityChanged.map(_onlineFrom);
}
