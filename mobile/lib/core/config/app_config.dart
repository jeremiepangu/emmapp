class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://emmapp-api.onrender.com/api/v1',
  );
}
