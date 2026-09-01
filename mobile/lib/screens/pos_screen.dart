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
  String _mode = 'sale';
  final _cashReceivedCtrl = TextEditingController();
  final _countedCtrl = TextEditingController();
  final _amountToCollectCtrl = TextEditingController();
  final _advanceAmountCtrl = TextEditingController();
  final _acompteAmountCtrl = TextEditingController();
  List<Map<String, dynamic>> _outstanding = [];
  String? _acompteOrderId;
  Map<String, dynamic>? _closing;
  bool _loadingClosing = false;
  bool _loading = true;
  bool _quoting = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _cashReceivedCtrl.dispose();
    _countedCtrl.dispose();
    _amountToCollectCtrl.dispose();
    _advanceAmountCtrl.dispose();
    _acompteAmountCtrl.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
    _loadClosing();
  }

  Future<void> _loadClosing() async {
    setState(() => _loadingClosing = true);
    try {
      final result = await context.read<AuthProvider>().offline.get('/ecarts/cash-closings/current');
      if (!mounted) return;
      setState(() {
        _closing = result.data is Map ? Map<String, dynamic>.from(result.data as Map) : null;
        _loadingClosing = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _closing = null;
        _loadingClosing = false;
      });
    }
  }

  Future<void> _openClosing() async {
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/ecarts/cash-closings/open',
            body: {},
            entityType: 'cash_closing',
          );
      if (!mounted) return;
      setState(() => _closing = result.data is Map ? Map<String, dynamic>.from(result.data as Map) : null);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Session de caisse ouverte')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _closeClosing() async {
    if (_closing == null) return;
    final counted = double.tryParse(_countedCtrl.text) ?? 0;
    try {
      await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/ecarts/cash-closings/${_closing!['id']}/close',
            body: {'countedAmount': counted},
            entityType: 'cash_closing',
          );
      if (!mounted) return;
      setState(() => _closing = null);
      _countedCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Caisse clôturée'), backgroundColor: Colors.green));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
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
  double get _collectAmount {
    final custom = double.tryParse(_amountToCollectCtrl.text);
    if (custom != null && custom > 0) return custom;
    return _netToPay;
  }

  Map<String, dynamic>? _selectedOutstanding() {
    if (_acompteOrderId == null) return null;
    for (final o in _outstanding) {
      if (o['id'] == _acompteOrderId) return o;
    }
    return null;
  }

  Future<void> _loadOutstanding() async {
    if (_clientId == null || _mode != 'acompte') {
      setState(() {
        _outstanding = [];
        _acompteOrderId = null;
      });
      return;
    }
    try {
      final result = await context.read<AuthProvider>().offline.get(
            '/payments/outstanding?clientId=$_clientId',
          );
      final list = asRecordList(result.data);
      if (!mounted) return;
      setState(() {
        _outstanding = list;
        _acompteOrderId = list.isNotEmpty ? list.first['id'] as String? : null;
        if (list.isNotEmpty) {
          _acompteAmountCtrl.text = ((list.first['remaining'] as num?) ?? 0).toStringAsFixed(0);
        }
      });
    } catch (_) {
      if (mounted) setState(() {
        _outstanding = [];
        _acompteOrderId = null;
      });
    }
  }

  void _setMode(String mode) {
    setState(() => _mode = mode);
    _loadOutstanding();
  }

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
    final partial = _collectAmount < _netToPay - 0.001;
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
              if (_method == 'ESPECES')
                'cashReceived': double.tryParse(_cashReceivedCtrl.text) ?? _collectAmount,
              if (partial) 'amountPaid': _collectAmount,
            },
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued
              ? 'Vente en file hors ligne'
              : partial
                  ? 'Acompte de ${_collectAmount.toStringAsFixed(0)} CDF enregistré'
                  : 'Vente enregistrée (${_collectAmount.toStringAsFixed(0)} CDF)'),
          backgroundColor: Colors.green,
        ),
      );
      setState(() {
        _cart.clear();
        _draftQty.clear();
        _quote = null;
        _amountToCollectCtrl.clear();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _submitAdvance() async {
    if (_clientId == null) return;
    final amount = double.tryParse(_advanceAmountCtrl.text) ?? 0;
    if (amount <= 0) return;
    setState(() => _saving = true);
    try {
      await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/pos/advance',
            body: {
              'clientId': _clientId,
              'amount': amount,
              'method': _method,
            },
          );
      if (!mounted) return;
      _advanceAmountCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Avance de ${amount.toStringAsFixed(0)} CDF enregistrée'), backgroundColor: Colors.green),
      );
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _submitAcompte() async {
    if (_acompteOrderId == null) return;
    final amount = double.tryParse(_acompteAmountCtrl.text) ?? 0;
    if (amount <= 0) return;
    setState(() => _saving = true);
    try {
      await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/pos/acompte',
            body: {
              'orderId': _acompteOrderId,
              'amount': amount,
              'method': _method,
              if (_method == 'ESPECES')
                'cashReceived': double.tryParse(_cashReceivedCtrl.text) ?? amount,
            },
          );
      if (!mounted) return;
      _acompteAmountCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Acompte de ${amount.toStringAsFixed(0)} CDF enregistré'), backgroundColor: Colors.green),
      );
      await _loadOutstanding();
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
        Material(
          color: _closing != null ? Colors.green.shade50 : Colors.orange.shade50,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: _loadingClosing
                ? const LinearProgressIndicator(minHeight: 2)
                : _closing == null
                    ? Row(
                        children: [
                          const Expanded(child: Text('Aucune session de caisse ouverte')),
                          TextButton(onPressed: _openClosing, child: const Text('Ouvrir')),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Session ${_closing!['reference'] ?? ''} ouverte', style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _countedCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Montant compté (CDF)', isDense: true),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(onPressed: _closeClosing, child: const Text('Clôturer la caisse')),
                          ),
                        ],
                      ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'sale', label: Text('Vente')),
              ButtonSegment(value: 'advance', label: Text('Avance')),
              ButtonSegment(value: 'acompte', label: Text('Acompte')),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => _setMode(s.first),
          ),
        ),
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
              _loadOutstanding();
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
          child: _mode == 'sale'
              ? GridView.builder(
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
          )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(12),
                  child: _mode == 'advance'
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              _clientId == null
                                  ? 'Sélectionnez un client pour enregistrer une avance.'
                                  : 'Le montant reste au crédit du client.',
                              style: TextStyle(color: Colors.grey.shade700),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _advanceAmountCtrl,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(labelText: 'Montant avance (CDF)'),
                            ),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (_outstanding.isEmpty)
                              Text(
                                _clientId == null
                                    ? 'Sélectionnez un client.'
                                    : 'Aucune commande impayée.',
                                style: TextStyle(color: Colors.grey.shade700),
                              )
                            else ...[
                              DropdownButtonFormField<String>(
                                value: _acompteOrderId,
                                decoration: const InputDecoration(labelText: 'Commande'),
                                items: _outstanding.map((o) {
                                  final remaining = (o['remaining'] as num?)?.toDouble() ?? 0;
                                  return DropdownMenuItem(
                                    value: o['id'] as String,
                                    child: Text('${o['orderNumber']} — reste ${remaining.toStringAsFixed(0)}'),
                                  );
                                }).toList(),
                                onChanged: (v) {
                                  setState(() {
                                    _acompteOrderId = v;
                                    final order = _selectedOutstanding();
                                    if (order != null) {
                                      _acompteAmountCtrl.text =
                                          ((order['remaining'] as num?) ?? 0).toStringAsFixed(0);
                                    }
                                  });
                                },
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _acompteAmountCtrl,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(labelText: 'Montant acompte (CDF)'),
                              ),
                            ],
                          ],
                        ),
                ),
        ),
        if (_mode == 'sale' && _cart.isNotEmpty)
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
                        _mode == 'sale'
                            ? (_cart.isEmpty
                                ? 'Panier vide'
                                : 'Panier : ${_cart.fold(0, (s, l) => s + l.quantity)} article(s)')
                            : _mode == 'advance'
                                ? 'Avance client'
                                : 'Acompte commande',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                    if (_mode == 'sale' && _cart.isNotEmpty)
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
                    DropdownMenuItem(value: 'CHEQUE', child: Text('Chèque')),
                    DropdownMenuItem(value: 'VIREMENT', child: Text('Virement')),
                    DropdownMenuItem(value: 'CREDIT', child: Text('Crédit')),
                  ],
                  onChanged: (v) => setState(() => _method = v!),
                ),
                if (_method == 'ESPECES' && (_mode == 'sale' ? _cart.isNotEmpty : _mode == 'acompte')) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _cashReceivedCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Espèces reçues (CDF)',
                      isDense: true,
                      helperText: _cashReceivedCtrl.text.isNotEmpty
                          ? 'Monnaie : ${((_mode == 'sale' ? (double.tryParse(_cashReceivedCtrl.text) ?? 0) - _collectAmount : (double.tryParse(_cashReceivedCtrl.text) ?? 0) - (double.tryParse(_acompteAmountCtrl.text) ?? 0))).toStringAsFixed(0)} CDF'
                          : null,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ],
                if (_mode == 'sale' && _cart.isNotEmpty && _netToPay > 0) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _amountToCollectCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Montant à encaisser (CDF)',
                      isDense: true,
                      hintText: _netToPay.toStringAsFixed(0),
                      helperText: _collectAmount < _netToPay - 0.001
                          ? 'Acompte partiel — reste ${(_netToPay - _collectAmount).toStringAsFixed(0)} CDF'
                          : null,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ],
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: _saving || _quoting
                      ? null
                      : _mode == 'sale'
                          ? (_cart.isEmpty ? null : _checkout)
                          : _mode == 'advance'
                              ? (_clientId == null ? null : _submitAdvance)
                              : (_acompteOrderId == null ? null : _submitAcompte),
                  child: Text(_saving
                      ? 'Enregistrement…'
                      : _mode == 'sale'
                          ? (_collectAmount < _netToPay - 0.001
                              ? 'Acompte ${_collectAmount.toStringAsFixed(0)} CDF'
                              : 'Encaisser ${_collectAmount.toStringAsFixed(0)} CDF')
                          : _mode == 'advance'
                              ? 'Enregistrer l’avance'
                              : 'Enregistrer l’acompte'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
