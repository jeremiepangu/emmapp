import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../core/modules.dart';
import '../providers/auth_provider.dart';
import '../providers/sync_provider.dart';

class CreateFormScreen extends StatefulWidget {
  const CreateFormScreen({super.key, required this.module});

  final AppModule module;

  @override
  State<CreateFormScreen> createState() => _CreateFormScreenState();
}

class _CreateFormScreenState extends State<CreateFormScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;
  final Map<String, TextEditingController> _fields = {};
  String? _segment = 'BOUTIQUE';
  String? _method = 'ESPECES';
  String? _clientId;
  String? _productId;
  String? _locationId;
  List<Map<String, dynamic>> _clients = [];
  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _locations = [];

  @override
  void initState() {
    super.initState();
    for (final key in ['code', 'name', 'phone', 'zone', 'address', 'notes', 'amount', 'quantity', 'productFormat', 'lineCode', 'plannedQty', 'plate', 'capacity']) {
      _fields[key] = TextEditingController();
    }
    _loadLookups();
  }

  Future<void> _loadLookups() async {
    final offline = context.read<AuthProvider>().offline;
    try {
      final clients = await offline.get('/clients');
      final products = await offline.get('/products');
      final locations = await offline.get('/stock/locations');
      setState(() {
        _clients = asRecordList(clients.data);
        _products = asRecordList(products.data);
        _locations = asRecordList(locations.data);
        if (_clients.isNotEmpty) _clientId = _clients.first['id'] as String?;
        if (_products.isNotEmpty) _productId = _products.first['id'] as String?;
        if (_locations.isNotEmpty) _locationId = _locations.first['id'] as String?;
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    for (final c in _fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final spec = _spec();
      final result = await context.read<AuthProvider>().offline.mutate(
            method: spec.method,
            path: spec.path,
            body: spec.body,
            entityType: spec.entityType,
          );
      if (!mounted) return;
      context.read<SyncProvider>().refreshPendingCount();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Enregistré hors ligne — sera synchronisé' : 'Enregistré'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  _Spec _spec() {
    switch (widget.module.id) {
      case 'clients':
        return _Spec('POST', '/clients', {
          'code': _fields['code']!.text.trim(),
          'name': _fields['name']!.text.trim(),
          'segment': _segment,
          'phone': _emptyToNull(_fields['phone']!.text),
          'zone': _emptyToNull(_fields['zone']!.text),
          'address': _emptyToNull(_fields['address']!.text),
        });
      case 'orders':
        return _Spec('POST', '/orders', {
          'clientId': _clientId,
          'notes': _emptyToNull(_fields['notes']!.text),
          'lines': [
            {
              'productId': _productId,
              'quantity': int.tryParse(_fields['quantity']!.text) ?? 1,
            }
          ],
        });
      case 'payments':
        return _Spec(
          'POST',
          '/payments',
          {
            'clientId': _clientId,
            'amount': double.tryParse(_fields['amount']!.text) ?? 0,
            'method': _method,
          },
          'payment',
        );
      case 'stock':
        return _Spec('POST', '/stock/adjust', {
          'productId': _productId,
          'locationId': _locationId,
          'quantity': int.tryParse(_fields['quantity']!.text) ?? 0,
        });
      case 'production':
        return _Spec('POST', '/emmapure/production', {
          'productFormat': _fields['productFormat']!.text.trim().isEmpty ? 'BIDON_5L' : _fields['productFormat']!.text.trim(),
          'lineCode': _fields['lineCode']!.text.trim().isEmpty ? 'L1' : _fields['lineCode']!.text.trim(),
          'plannedQty': int.tryParse(_fields['plannedQty']!.text) ?? 1,
        });
      case 'vehicles':
        return _Spec('POST', '/vehicles', {
          'plate': _fields['plate']!.text.trim(),
          'name': _fields['name']!.text.trim(),
          'capacity': int.tryParse(_fields['capacity']!.text) ?? 0,
        });
      default:
        return _Spec('POST', widget.module.listPath ?? '/', {'notes': _fields['notes']!.text});
    }
  }

  String? _emptyToNull(String v) => v.trim().isEmpty ? null : v.trim();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.module.createLabel ?? 'Créer')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ..._fieldsForModule(),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Enregistrer (online / offline)'),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _fieldsForModule() {
    switch (widget.module.id) {
      case 'clients':
        return [
          _text('code', 'Code', required: true),
          _text('name', 'Nom', required: true),
          DropdownButtonFormField<String>(
            value: _segment,
            decoration: const InputDecoration(labelText: 'Segment'),
            items: const [
              'PARTICULIER',
              'BOUTIQUE',
              'DETAILLANT',
              'SUPERMARCHE',
              'ENTREPRISE',
              'HOTEL_RESTAURANT',
            ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
            onChanged: (v) => setState(() => _segment = v),
          ),
          _text('phone', 'Téléphone'),
          _text('zone', 'Zone'),
          _text('address', 'Adresse'),
        ];
      case 'orders':
        return [
          _dropdown('Client', _clientId, _clients, (v) => setState(() => _clientId = v)),
          _dropdown('Produit', _productId, _products, (v) => setState(() => _productId = v)),
          _text('quantity', 'Quantité', number: true, required: true),
          _text('notes', 'Notes'),
        ];
      case 'payments':
        return [
          _dropdown('Client', _clientId, _clients, (v) => setState(() => _clientId = v)),
          _text('amount', 'Montant CDF', number: true, required: true),
          DropdownButtonFormField<String>(
            value: _method,
            decoration: const InputDecoration(labelText: 'Mode'),
            items: const ['ESPECES', 'MPESA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT', 'CREDIT']
                .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                .toList(),
            onChanged: (v) => setState(() => _method = v),
          ),
        ];
      case 'stock':
        return [
          _dropdown('Produit', _productId, _products, (v) => setState(() => _productId = v)),
          _dropdown('Emplacement', _locationId, _locations, (v) => setState(() => _locationId = v)),
          _text('quantity', 'Quantité (+/-)', number: true, required: true),
        ];
      case 'production':
        return [
          _text('productFormat', 'Format (ex. BIDON_5L)'),
          _text('lineCode', 'Ligne'),
          _text('plannedQty', 'Quantité planifiée', number: true, required: true),
        ];
      case 'vehicles':
        return [
          _text('plate', 'Immatriculation', required: true),
          _text('name', 'Nom', required: true),
          _text('capacity', 'Capacité', number: true),
        ];
      default:
        return [_text('notes', 'Notes')];
    }
  }

  Widget _text(String key, String label, {bool required = false, bool number = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: _fields[key],
        keyboardType: number ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(labelText: label),
        validator: required ? (v) => v == null || v.trim().isEmpty ? 'Requis' : null : null,
      ),
    );
  }

  Widget _dropdown(String label, String? value, List<Map<String, dynamic>> items, ValueChanged<String?> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        value: value,
        decoration: InputDecoration(labelText: label),
        items: items
            .map((e) => DropdownMenuItem(value: e['id'] as String?, child: Text(displayTitle(e))))
            .toList(),
        onChanged: onChanged,
        validator: (v) => v == null ? 'Requis' : null,
      ),
    );
  }
}

class _Spec {
  _Spec(this.method, this.path, this.body, [this.entityType = 'http']);
  final String method;
  final String path;
  final Map<String, dynamic> body;
  final String entityType;
}
