import 'dart:io';

import 'package:flutter/foundation.dart';

class AppConfig {
  static const String _fromEnv = String.fromEnvironment('API_URL');

  /// Émulateur Android → 10.0.2.2 ; Windows / iOS / appareil → 127.0.0.1.
  /// Surcharge : `flutter run --dart-define=API_URL=http://IP:3000/api/v1`
  static String get apiBaseUrl {
    if (_fromEnv.isNotEmpty) return _fromEnv;
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:3000/api/v1';
    }
    return 'http://127.0.0.1:3000/api/v1';
  }
}
