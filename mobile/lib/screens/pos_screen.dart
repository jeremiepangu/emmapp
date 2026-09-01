import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../widgets/product_sale_card.dart';

class _CartLine {
  _CartLine({required this.productId, required this.quantity, this.emptiesReturned = 0});
  final String productId;
  int quantity;
  int emptiesReturned;
}

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  List<Product> _products = [];
  List<Client> _clients = [];
  String? _clientId;
  final List<_CartLine> _cart = [];
  final Map<String, int> _draftQty = {};
  Map<String, dynamic>? _quote;
  String _method = 'ESPECES';
  bool _loading = true;
  bool _quoting = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final offline = context.read<AuthProvider>().offline;
    try {
      final catalog = await offline.get('/pos/catalog');
      final productsRes = await offline.get('/products');
      final clients = await offline.get('/clients');
      List<Product> products = asRecordList(productsRes.data).map(Product.fromJson).toList();
      if (catalog.data is Map && (catalog.data as Map)['products'] is List) {
        products = asRecordList((catalog.data as Map)['products']).map(Product.fromJson).toList();
      }
      setState(() {
        _products = products;
        _clients = asRecordList(clients.data).map(Client.fromJson).toList();
        _loading = false;
      });
      await _refreshQuote();
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _refreshQuote() async {
    if (_cart.isEmpty) {
      setState(() => _quote = null);
      return;
    }
    setState(() => _quoting = true);
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/pos/quote',
            body: {
              'clientId': _clientId,
              'lines': _cart
                  .map((l) => {
                        'productId': l.productId,
                        'quantity': l.quantity,
                        'emptiesReturned': l.emptiesReturned,
                      })
                  .toList(),
            },
          );
      if (!mounted) return;
      setState(() {
        _quote = result.data is Map ? Map<String, dynamic>.from(result.data as Map) : null;
        _quoting = false;
      });
    } catch (_) {
      if (mounted) setState(() => _quoting = false);
    }
  }

  void _addToCart(String productId, int qty) {
    final existing = _cart.where((l) => l.productId == productId).toList();
    if (existing.isEmpty) {
      _cart.add(_CartLine(productId: productId, quantity: qty));
    } else {
      existing.first.quantity += qty;
    }
    setState(() {});
    _refreshQuote();
  }

  void _setEmpties(String productId, int value) {
    for (final line in _cart) {
      if (line.productId == productId) {
        line.emptiesReturned = value < 0 ? 0 : value;
        break;
      }
    }
    setState(() {});
    _refreshQuote();
  }

  double get _total => (_quote?['total'] as num?)?.toDouble() ?? 0;
  double get _advanceApplied => (_quote?['advanceApplied'] as num?)?.toDouble() ?? 0;
  double get _netToPay => (_quote?['netToPay'] as num?)?.toDouble() ?? _total;

  Map<String, dynamic>? _quotedLine(String productId) {
    final lines = _quote?['lines'];
    if (lines is! List) return null;
    for (final raw in lines) {
      if (raw is Map && raw['productId'] == productId) {
        return Map<String, dynamic>.from(raw);
      }
    }
    return null;
  }

  Future<void> _checkout() async {
    if (_cart.isEmpty) return;
    setState(() => _saving = true);
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/pos/checkout',
            body: {
              if (_clientId != null) 'clientId': _clientId,
              'lines': _cart
                  .map((l) => {
                        'productId': l.productId,
                        'quantity': l.quantity,
                        'emptiesReturned': l.emptiesReturned,
                      })
                  .toList(),
              'method': _method,
              if (_method == 'ESPECES') 'cashReceived': _netToPay,
            },
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued
              ? 'Vente en file hors ligne'
              : 'Vente enregistrée (${_netToPay.toStringAsFixed(0)} CDF encaissés)'),
          backgroundColor: Colors.green,
        ),
      );
      setState(() {
        _cart.clear();
        _draftQty.clear();
        _quote = null;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _products.isEmpty) {
      return Center(child: Text(_error!));
    }

    final selectedClient = _clients.where((c) => c.id == _clientId).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: DropdownButtonFormField<String>(
            value: _clientId ?? '',
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Client (comptoir si vide)', isDense: true),
            items: [
              const DropdownMenuItem(value: '', child: Text('Comptoir / passage')),
              ..._clients.map((c) {
                final advance = c.advanceBalance > 0 ? ' · avance ${c.advanceBalance.toStringAsFixed(0)}' : '';
                return DropdownMenuItem(
                  value: c.id,
                  child: Text('${c.name}$advance', overflow: TextOverflow.ellipsis),
                );
              }),
            ],
            onChanged: (v) {
              setState(() => _clientId = (v == null || v.isEmpty) ? null : v);
              _refreshQuote();
            },
          ),
        ),
        if (selectedClient.isNotEmpty && selectedClient.first.advanceBalance > 0)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              'Avance disponible : ${selectedClient.first.advanceBalance.toStringAsFixed(0)} CDF',
              style: TextStyle(color: Colors.blue.shade800, fontSize: 13),
            ),
          ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 240,
              mainAxisExtent: 330,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: _products.length,
            itemBuilder: (context, i) {
              final p = _products[i];
              final inCart = _cart.where((l) => l.productId == p.id).fold(0, (s, l) => s + l.quantity);
              final draft = _draftQty[p.id] ?? 1;
              return ProductSaleCard(
                name: p.name,
                code: p.code,
                format: p.format,
                imageUrl: p.imageUrl,
                price: p.unitPrice,
                quantity: draft,
                minQuantity: 1,
                selected: inCart > 0,
                badge: inCart > 0 ? '$inCart au panier' : null,
                metaLabel: 'Retrait',
                metaValue: 'Immédiat en caisse',
                onQuantityChanged: (q) => setState(() => _draftQty[p.id] = q),
                onAdd: () => _addToCart(p.id, draft),
              );
            },
          ),
        ),
        if (_cart.isNotEmpty)
          Expanded(
            flex: 0,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: _cart.map((line) {
                  final product = _products.firstWhere((p) => p.id == line.productId);
                  final quoted = _quotedLine(line.productId);
                  final bonus = quoted?['bonusQuantity'] as int? ?? 0;
                  final delivered = line.quantity + bonus;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(product.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          if (bonus > 0) Text('Bonus : $bonus offert(s)', style: TextStyle(color: Colors.green.shade700, fontSize: 12)),
                          if (product.isReusable)
                            TextField(
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Vidanges rendues (sur $delivered sortis)',
                                isDense: true,
                              ),
                              controller: TextEditingController(text: '${line.emptiesReturned}'),
                              onChanged: (v) => _setEmpties(line.productId, int.tryParse(v) ?? 0),
                            ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        Material(
          elevation: 8,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _cart.isEmpty
                            ? 'Panier vide'
                            : 'Panier : ${_cart.fold(0, (s, l) => s + l.quantity)} article(s)',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                    if (_cart.isNotEmpty)
                      TextButton(
                        onPressed: () {
                          setState(() {
                            _cart.clear();
                            _draftQty.clear();
                            _quote = null;
                          });
                        },
                        child: const Text('Vider'),
                      ),
                  ],
                ),
                if (_quote != null) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total'),
                      Text('${_total.toStringAsFixed(0)} CDF', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  if (_advanceApplied > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Avance déduite'),
                        Text('-${_advanceApplied.toStringAsFixed(0)} CDF', style: TextStyle(color: Colors.blue.shade800)),
                      ],
                    ),
                  if (_advanceApplied > 0)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Net à encaisser'),
                        Text('${_netToPay.toStringAsFixed(0)} CDF', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  if ((_quote?['bonusQuantity'] as int? ?? 0) > 0)
                    Text(
                      'Bonus : ${_quote!['bonusQuantity']} article(s) offert(s)',
                      style: TextStyle(color: Colors.green.shade700, fontSize: 12),
                    ),
                ],
                if (_quoting) const LinearProgressIndicator(minHeight: 2),
                DropdownButtonFormField<String>(
                  value: _method,
                  decoration: const InputDecoration(labelText: 'Paiement', isDense: true),
                  items: const [
                    DropdownMenuItem(value: 'ESPECES', child: Text('Espèces')),
                    DropdownMenuItem(value: 'MPESA', child: Text('M-Pesa')),
                    DropdownMenuItem(value: 'ORANGE_MONEY', child: Text('Orange Money')),
                    DropdownMenuItem(value: 'AIRTEL_MONEY', child: Text('Airtel Money')),
                    DropdownMenuItem(value: 'MOBILE_MONEY', child: Text('Mobile Money')),
                  ],
                  onChanged: (v) => setState(() => _method = v!),
                ),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: _saving || _cart.isEmpty || _quoting ? null : _checkout,
                  child: Text(_saving
                      ? 'Encaissement…'
                      : 'Encaisser ${_netToPay.toStringAsFixed(0)} CDF'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
