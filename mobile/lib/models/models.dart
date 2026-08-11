class User {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
  });

  String get fullName => '$firstName $lastName';

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        role: json['role'] as String,
      );
}

class Client {
  final String id;
  final String code;
  final String name;
  final String? address;
  final String? zone;
  final String? phone;
  final double? latitude;
  final double? longitude;
  final int consigneBalance;
  final int consigneLimit;

  Client({
    required this.id,
    required this.code,
    required this.name,
    this.address,
    this.zone,
    this.phone,
    this.latitude,
    this.longitude,
    this.consigneBalance = 0,
    this.consigneLimit = 50,
  });

  factory Client.fromJson(Map<String, dynamic> json) => Client(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        address: json['address'] as String?,
        zone: json['zone'] as String?,
        phone: json['phone'] as String?,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
        consigneBalance: json['consigneBalance'] as int? ?? 0,
        consigneLimit: json['consigneLimit'] as int? ?? 50,
      );
}

class Product {
  final String id;
  final String code;
  final String name;
  final String format;
  final double unitPrice;
  final double consigneAmount;
  final bool isReusable;

  Product({
    required this.id,
    required this.code,
    required this.name,
    required this.format,
    required this.unitPrice,
    this.consigneAmount = 0,
    this.isReusable = false,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        format: json['format'] as String,
        unitPrice: double.parse(json['unitPrice'].toString()),
        consigneAmount: double.parse((json['consigneAmount'] ?? 0).toString()),
        isReusable: json['isReusable'] as bool? ?? false,
      );
}

class OrderLine {
  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final bool isReusable;

  OrderLine({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    this.isReusable = false,
  });

  factory OrderLine.fromJson(Map<String, dynamic> json) => OrderLine(
        productId: json['productId'] as String,
        productName: json['product']?['name'] as String? ?? '',
        quantity: json['quantity'] as int,
        unitPrice: double.parse(json['unitPrice'].toString()),
        isReusable: json['product']?['isReusable'] as bool? ?? false,
      );
}

class Order {
  final String id;
  final String orderNumber;
  final String clientId;
  final String clientName;
  final String status;
  final List<OrderLine> lines;

  Order({
    required this.id,
    required this.orderNumber,
    required this.clientId,
    required this.clientName,
    required this.status,
    required this.lines,
  });

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: json['id'] as String,
        orderNumber: json['orderNumber'] as String,
        clientId: json['clientId'] as String,
        clientName: json['client']?['name'] as String? ?? '',
        status: json['status'] as String,
        lines: (json['lines'] as List? ?? [])
            .map((e) => OrderLine.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class Tour {
  final String id;
  final String tourNumber;
  final String zone;
  final String status;
  final List<Order> orders;

  Tour({
    required this.id,
    required this.tourNumber,
    required this.zone,
    required this.status,
    required this.orders,
  });

  factory Tour.fromJson(Map<String, dynamic> json) => Tour(
        id: json['id'] as String,
        tourNumber: json['tourNumber'] as String,
        zone: json['zone'] as String,
        status: json['status'] as String,
        orders: (json['orders'] as List? ?? [])
            .map((e) => Order.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
