import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../widgets/product_sale_card.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  List<Product> _products = [];
  List<Client> _clients = [];
  String? _clientId;
  final Map<String, int> _cart = {};
  final Map<String, int> _draftQty = {};
  String _method = 'ESPECES';
  bool _loading = true;
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
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  double get _total {
    var sum = 0.0;
    for (final e in _cart.entries) {
      for (final p in _products) {
        if (p.id == e.key) {
          sum += p.unitPrice * e.value;
          break;
        }
      }
    }
    return sum;
  }

  Future<void> _checkout() async {
    final lines = _cart.entries
        .where((e) => e.value > 0)
        .map((e) => {'productId': e.key, 'quantity': e.value})
        .toList();
    if (lines.isEmpty) return;
    setState(() => _saving = true);
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/pos/checkout',
            body: {
              if (_clientId != null) 'clientId': _clientId,
              'lines': lines,
              'method': _method,
            },
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Vente en file hors ligne' : 'Vente enregistrée (${_total.toStringAsFixed(0)} CDF)'),
          backgroundColor: Colors.green,
        ),
      );
      setState(() {
        _cart.clear();
        _draftQty.clear();
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

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _clientId ?? '',
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Client (comptoir si vide)', isDense: true),
                  items: [
                    const DropdownMenuItem(value: '', child: Text('Comptoir / passage')),
                    ..._clients.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name, overflow: TextOverflow.ellipsis))),
                  ],
                  onChanged: (v) => setState(() => _clientId = (v == null || v.isEmpty) ? null : v),
                ),
              ),
            ],
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
              final inCart = _cart[p.id] ?? 0;
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
                onAdd: () => setState(() => _cart[p.id] = inCart + draft),
              );
            },
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
                            : 'Panier : ${_cart.values.fold(0, (a, b) => a + b)} article(s)',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                    if (_cart.isNotEmpty)
                      TextButton(
                        onPressed: () => setState(() {
                          _cart.clear();
                          _draftQty.clear();
                        }),
                        child: const Text('Vider'),
                      ),
                  ],
                ),
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
                  onPressed: _saving || _cart.isEmpty ? null : _checkout,
                  child: Text(_saving ? 'Encaissement…' : 'Encaisser ${_total.toStringAsFixed(0)} CDF'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
