class User {
  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.permissions,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final Map<String, List<String>>? permissions;

  String get fullName => '$firstName $lastName';

  factory User.fromJson(Map<String, dynamic> json, [Map<String, List<String>>? permissions]) {
    Map<String, List<String>>? parsed = permissions;
    if (parsed == null && json['permissions'] is Map) {
      parsed = _parseMatrix(json['permissions'] as Map);
    }
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      role: json['role'] as String,
      permissions: parsed,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'role': role,
        if (permissions != null) 'permissions': permissions,
      };

  static Map<String, List<String>> _parseMatrix(Map raw) {
    return raw.map((key, value) {
      final list = value is List ? value.map((e) => e.toString()).toList() : <String>[];
      return MapEntry(key.toString(), list);
    });
  }
}

class Client {
  Client({
    required this.id,
    required this.code,
    required this.name,
    this.address,
    this.zone,
    this.phone,
    this.segment,
    this.latitude,
    this.longitude,
    this.consigneBalance = 0,
    this.consigneLimit = 50,
    this.advanceBalance = 0,
    this.creditBalance = 0,
  });

  final String id;
  final String code;
  final String name;
  final String? address;
  final String? zone;
  final String? phone;
  final String? segment;
  final double? latitude;
  final double? longitude;
  final int consigneBalance;
  final int consigneLimit;
  final double advanceBalance;
  final double creditBalance;

  factory Client.fromJson(Map<String, dynamic> json) => Client(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        name: json['name'] as String? ?? '',
        address: json['address'] as String?,
        zone: json['zone'] as String?,
        phone: json['phone'] as String?,
        segment: json['segment'] as String?,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
        consigneBalance: json['consigneBalance'] as int? ?? 0,
        consigneLimit: json['consigneLimit'] as int? ?? 50,
        advanceBalance: double.tryParse((json['advanceBalance'] ?? 0).toString()) ?? 0,
        creditBalance: double.tryParse((json['creditBalance'] ?? 0).toString()) ?? 0,
      );
}

class Product {
  Product({
    required this.id,
    required this.code,
    required this.name,
    required this.format,
    required this.unitPrice,
    this.consigneAmount = 0,
    this.isReusable = false,
    this.imageUrl,
  });

  final String id;
  final String code;
  final String name;
  final String format;
  final double unitPrice;
  final double consigneAmount;
  final bool isReusable;
  final String? imageUrl;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        code: json['code'] as String? ?? '',
        name: json['name'] as String? ?? '',
        format: json['format'] as String? ?? '',
        unitPrice: double.tryParse(json['unitPrice']?.toString() ?? '') ?? 0,
        consigneAmount: double.tryParse((json['consigneAmount'] ?? 0).toString()) ?? 0,
        isReusable: json['isReusable'] as bool? ?? false,
        imageUrl: json['imageUrl'] as String?,
      );
}

class OrderLine {
  OrderLine({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    this.bonusQuantity = 0,
    this.isReusable = false,
  });

  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final int bonusQuantity;
  final bool isReusable;

  factory OrderLine.fromJson(Map<String, dynamic> json) => OrderLine(
        productId: json['productId'] as String? ?? json['product']?['id'] as String? ?? '',
        productName: json['product']?['name'] as String? ?? json['productName'] as String? ?? '',
        quantity: json['quantity'] as int? ?? 0,
        unitPrice: double.tryParse(json['unitPrice']?.toString() ?? '') ?? 0,
        bonusQuantity: json['bonusQuantity'] as int? ?? 0,
        isReusable: json['product']?['isReusable'] as bool? ?? false,
      );
}

class Order {
  Order({
    required this.id,
    required this.orderNumber,
    required this.clientId,
    required this.clientName,
    required this.status,
    required this.lines,
    this.totalAmount = 0,
    this.paidAmount = 0,
    this.paymentStatus = 'IMPAYEE',
  });

  final String id;
  final String orderNumber;
  final String clientId;
  final String clientName;
  final String status;
  final List<OrderLine> lines;
  final double totalAmount;
  final double paidAmount;
  final String paymentStatus;

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: json['id'] as String,
        orderNumber: json['orderNumber'] as String? ?? '',
        clientId: json['clientId'] as String? ?? json['client']?['id'] as String? ?? '',
        clientName: json['client']?['name'] as String? ?? json['clientName'] as String? ?? '',
        status: json['status'] as String? ?? '',
        totalAmount: double.tryParse((json['totalAmount'] ?? 0).toString()) ?? 0,
        paidAmount: double.tryParse((json['paidAmount'] ?? 0).toString()) ?? 0,
        paymentStatus: json['paymentStatus'] as String? ?? 'IMPAYEE',
        lines: (json['lines'] as List? ?? [])
            .whereType<Map>()
            .map((e) => OrderLine.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class Tour {
  Tour({
    required this.id,
    required this.tourNumber,
    required this.zone,
    required this.status,
    required this.orders,
  });

  final String id;
  final String tourNumber;
  final String zone;
  final String status;
  final List<Order> orders;

  factory Tour.fromJson(Map<String, dynamic> json) => Tour(
        id: json['id'] as String,
        tourNumber: json['tourNumber'] as String? ?? '',
        zone: json['zone'] as String? ?? '',
        status: json['status'] as String? ?? '',
        orders: (json['orders'] as List? ?? [])
            .whereType<Map>()
            .map((e) => Order.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}
