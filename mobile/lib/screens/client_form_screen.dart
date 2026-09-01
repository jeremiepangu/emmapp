import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';

class ClientFormScreen extends StatefulWidget {
  const ClientFormScreen({super.key});

  @override
  State<ClientFormScreen> createState() => _ClientFormScreenState();
}

class _ClientFormScreenState extends State<ClientFormScreen> {
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _zone = TextEditingController();
  final _address = TextEditingController();
  String _segment = 'PARTICULIER';
  bool _saving = false;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _phone.dispose();
    _zone.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_code.text.trim().isEmpty || _name.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/clients',
            body: {
              'code': _code.text.trim(),
              'name': _name.text.trim(),
              'segment': _segment,
              if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
              if (_zone.text.trim().isNotEmpty) 'zone': _zone.text.trim(),
              if (_address.text.trim().isNotEmpty) 'address': _address.text.trim(),
            },
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Client enregistré hors ligne' : 'Client créé'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Nouveau client')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _code, decoration: const InputDecoration(labelText: 'Code')),
          const SizedBox(height: 12),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nom')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _segment,
            decoration: const InputDecoration(labelText: 'Segment'),
            items: const [
              DropdownMenuItem(value: 'PARTICULIER', child: Text('Particulier')),
              DropdownMenuItem(value: 'BOUTIQUE', child: Text('Boutique')),
              DropdownMenuItem(value: 'DETAILLANT', child: Text('Détaillant')),
              DropdownMenuItem(value: 'SUPERMARCHE', child: Text('Supermarché')),
              DropdownMenuItem(value: 'ENTREPRISE', child: Text('Entreprise')),
              DropdownMenuItem(value: 'HOTEL_RESTAURANT', child: Text('Hôtel / restaurant')),
            ],
            onChanged: (v) => setState(() => _segment = v!),
          ),
          const SizedBox(height: 12),
          TextField(controller: _phone, decoration: const InputDecoration(labelText: 'Téléphone'), keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          TextField(controller: _zone, decoration: const InputDecoration(labelText: 'Zone')),
          const SizedBox(height: 12),
          TextField(controller: _address, decoration: const InputDecoration(labelText: 'Adresse')),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Enregistrement…' : 'Enregistrer'),
          ),
        ],
      ),
    );
  }
}

class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key});

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  List<Client> _clients = [];
  List<Product> _products = [];
  String? _clientId;
  final Map<String, int> _qty = {};
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final offline = context.read<AuthProvider>().offline;
    try {
      final clients = await offline.get('/clients');
      final products = await offline.get('/products');
      setState(() {
        _clients = asRecordList(clients.data).map(Client.fromJson).toList();
        _products = asRecordList(products.data).map(Product.fromJson).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final lines = _qty.entries
        .where((e) => e.value > 0)
        .map((e) => {'productId': e.key, 'quantity': e.value})
        .toList();
    if (_clientId == null || lines.isEmpty) return;
    setState(() => _saving = true);
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/orders',
            body: {'clientId': _clientId, 'lines': lines},
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Commande en file hors ligne' : 'Commande créée'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle commande')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                DropdownButtonFormField<String>(
                  value: _clientId,
                  decoration: const InputDecoration(labelText: 'Client'),
                  items: _clients
                      .map((c) => DropdownMenuItem(value: c.id, child: Text('${c.code} · ${c.name}')))
                      .toList(),
                  onChanged: (v) => setState(() => _clientId = v),
                ),
                const SizedBox(height: 16),
                const Text('Articles', style: TextStyle(fontWeight: FontWeight.bold)),
                ..._products.map(
                  (p) => ListTile(
                    title: Text(p.name),
                    subtitle: Text('${p.unitPrice.toStringAsFixed(0)} CDF'),
                    trailing: SizedBox(
                      width: 72,
                      child: TextField(
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(isDense: true, hintText: 'Qté'),
                        onChanged: (v) => _qty[p.id] = int.tryParse(v) ?? 0,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'Enregistrement…' : 'Créer la commande'),
                ),
              ],
            ),
    );
  }
}

class PaymentFormScreen extends StatefulWidget {
  const PaymentFormScreen({super.key});

  @override
  State<PaymentFormScreen> createState() => _PaymentFormScreenState();
}

class _PaymentFormScreenState extends State<PaymentFormScreen> {
  List<Client> _clients = [];
  String? _clientId;
  final _amount = TextEditingController();
  String _method = 'ESPECES';
  bool _asAdvance = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    context.read<AuthProvider>().offline.get('/clients').then((r) {
      if (!mounted) return;
      setState(() => _clients = asRecordList(r.data).map(Client.fromJson).toList());
    });
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final amount = double.tryParse(_amount.text) ?? 0;
    if (amount <= 0) return;
    setState(() => _saving = true);
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/payments',
            body: {
              if (_clientId != null) 'clientId': _clientId,
              'amount': amount,
              'method': _method,
              if (_asAdvance) 'asAdvance': true,
            },
            entityType: 'payment',
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Paiement en file hors ligne' : 'Paiement enregistré'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Encaissement')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            value: _clientId ?? '',
            decoration: const InputDecoration(labelText: 'Client (optionnel)'),
            items: [
              const DropdownMenuItem(value: '', child: Text('—')),
              ..._clients.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))),
            ],
            onChanged: (v) => setState(() => _clientId = (v == null || v.isEmpty) ? null : v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Montant (CDF)'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _method,
            decoration: const InputDecoration(labelText: 'Mode'),
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
          SwitchListTile(
            title: const Text('Paiement en avance'),
            subtitle: const Text('Créditer le compte client sans imputer une commande'),
            value: _asAdvance,
            onChanged: (v) => setState(() => _asAdvance = v),
          ),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _saving ? null : _save, child: const Text('Enregistrer')),
        ],
      ),
    );
  }
}

class StockAdjustScreen extends StatefulWidget {
  const StockAdjustScreen({super.key});

  @override
  State<StockAdjustScreen> createState() => _StockAdjustScreenState();
}

class _StockAdjustScreenState extends State<StockAdjustScreen> {
  List<Product> _products = [];
  List<Map<String, dynamic>> _locations = [];
  String? _productId;
  String? _locationId;
  final _qty = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final offline = context.read<AuthProvider>().offline;
    final products = await offline.get('/products');
    final locations = await offline.get('/stock/locations');
    if (!mounted) return;
    setState(() {
      _products = asRecordList(products.data).map(Product.fromJson).toList();
      _locations = asRecordList(locations.data);
    });
  }

  @override
  void dispose() {
    _qty.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final q = int.tryParse(_qty.text) ?? 0;
    if (_productId == null || _locationId == null || q == 0) return;
    setState(() => _saving = true);
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/stock/adjust',
            body: {'productId': _productId, 'locationId': _locationId, 'quantity': q},
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Ajustement en file hors ligne' : 'Stock ajusté'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Ajuster le stock')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            value: _productId,
            decoration: const InputDecoration(labelText: 'Produit'),
            items: _products.map((p) => DropdownMenuItem(value: p.id, child: Text(p.name))).toList(),
            onChanged: (v) => setState(() => _productId = v),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _locationId,
            decoration: const InputDecoration(labelText: 'Emplacement'),
            items: _locations
                .map((l) => DropdownMenuItem(value: l['id'] as String?, child: Text(displayTitle(l))))
                .toList(),
            onChanged: (v) => setState(() => _locationId = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _qty,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Quantité (+ entrée / − sortie)'),
          ),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _saving ? null : _save, child: const Text('Valider')),
        ],
      ),
    );
  }
}
