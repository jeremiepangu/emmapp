List<Map<String, dynamic>> asRecordList(dynamic data) {
  if (data == null) return [];
  if (data is List) {
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  if (data is Map) {
    final map = Map<String, dynamic>.from(data);
    for (final key in const [
      'items',
      'data',
      'results',
      'rows',
      'clients',
      'orders',
      'tours',
      'products',
      'users',
      'notifications',
      'movements',
      'accounts',
      'sales',
    ]) {
      if (map[key] is List) return asRecordList(map[key]);
    }
    return [map];
  }
  return [];
}

String displayTitle(Map<String, dynamic> json, {List<String>? keys}) {
  final candidates = keys ??
      const [
        'name',
        'title',
        'label',
        'orderNumber',
        'tourNumber',
        'reference',
        'number',
        'code',
        'plate',
        'email',
        'fullName',
        'question',
        'filename',
      ];
  for (final key in candidates) {
    final value = json[key];
    if (value != null && value.toString().trim().isNotEmpty) {
      return value.toString();
    }
  }
  final first = json['firstName'];
  final last = json['lastName'];
  if (first != null || last != null) {
    return '${first ?? ''} ${last ?? ''}'.trim();
  }
  final nested = json['client'] ?? json['product'] ?? json['user'];
  if (nested is Map && nested['name'] != null) return nested['name'].toString();
  return json['id']?.toString() ?? 'Fiche';
}

String displaySubtitle(Map<String, dynamic> json) {
  for (final key in const [
    'status',
    'zone',
    'role',
    'segment',
    'phone',
    'email',
    'kind',
    'method',
    'orderNumber',
    'code',
  ]) {
    final value = json[key];
    if (value != null && value.toString().trim().isNotEmpty) {
      return value.toString();
    }
  }
  return '';
}

String prettyValue(dynamic value) {
  if (value == null) return '—';
  if (value is bool) return value ? 'Oui' : 'Non';
  if (value is num) {
    if (value == value.roundToDouble()) return value.toInt().toString();
    return value.toString();
  }
  if (value is List) return '${value.length} élément(s)';
  if (value is Map) return displayTitle(Map<String, dynamic>.from(value));
  return value.toString();
}
