import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../providers/auth_provider.dart';

class ConsignesScreen extends StatefulWidget {
  const ConsignesScreen({super.key});

  @override
  State<ConsignesScreen> createState() => _ConsignesScreenState();
}

class _ConsignesScreenState extends State<ConsignesScreen> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  bool _fromCache = false;
  String? _error;
  String _filter = 'TOUS';
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<AuthProvider>().offline.get('/consignes/situation?filter=$_filter');
      setState(() {
        _rows = asRecordList(result.data);
        _fromCache = result.fromCache;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _rows;
    return _rows.where((row) {
      final client = row['client'] is Map ? Map<String, dynamic>.from(row['client'] as Map) : <String, dynamic>{};
      final hay = '${client['name']} ${client['code']}'.toLowerCase();
      return hay.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_fromCache)
          const Material(
            color: Color(0xFFFFF3E0),
            child: ListTile(
              dense: true,
              leading: Icon(Icons.offline_pin, color: Colors.orange),
              title: Text('Affichage du cache local'),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _filter,
                  decoration: const InputDecoration(labelText: 'Filtre', isDense: true),
                  items: const [
                    DropdownMenuItem(value: 'TOUS', child: Text('Tous')),
                    DropdownMenuItem(value: 'DEBITEUR', child: Text('Débiteurs vidange')),
                    DropdownMenuItem(value: 'CREDITEUR', child: Text('Créditeurs vidange')),
                  ],
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _filter = v);
                    _load();
                  },
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Rechercher un client…',
              isDense: true,
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null && _rows.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(padding: const EdgeInsets.all(16), child: Text(_error!, textAlign: TextAlign.center)),
                          ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: _filtered.isEmpty
                          ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Aucune situation'))])
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filtered.length,
                              itemBuilder: (context, i) {
                                final row = _filtered[i];
                                final client = row['client'] is Map
                                    ? Map<String, dynamic>.from(row['client'] as Map)
                                    : <String, dynamic>{};
                                final qty = (row['totalQuantity'] as num?)?.toInt() ?? 0;
                                final amount = (row['totalAmount'] as num?)?.toDouble() ?? 0;
                                final formats = row['formats'] is List ? row['formats'] as List : [];
                                return Card(
                                  child: ExpansionTile(
                                    title: Text(client['name']?.toString() ?? '—'),
                                    subtitle: Text(
                                      '${client['code'] ?? ''} · ${qty > 0 ? '$qty contenant(s) dus' : '$qty en avoir'} · ${amount.round()} CDF',
                                    ),
                                    children: formats.map<Widget>((raw) {
                                      final f = raw is Map ? Map<String, dynamic>.from(raw as Map) : <String, dynamic>{};
                                      return ListTile(
                                        dense: true,
                                        title: Text(f['productFormat']?.toString() ?? '—'),
                                        trailing: Text('${f['quantity'] ?? 0} · ${(f['amount'] as num?)?.round() ?? 0} CDF'),
                                      );
                                    }).toList(),
                                  ),
                                );
                              },
                            ),
                    ),
        ),
      ],
    );
  }
}
