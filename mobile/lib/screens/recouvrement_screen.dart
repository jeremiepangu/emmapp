import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../providers/auth_provider.dart';

const _formats = ['BIDON_5L', 'BIDON_10L', 'BIDON_25L', 'BONBONNE_19L'];

class RecouvrementScreen extends StatefulWidget {
  const RecouvrementScreen({super.key});

  @override
  State<RecouvrementScreen> createState() => _RecouvrementScreenState();
}

class _RecouvrementScreenState extends State<RecouvrementScreen> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  bool _fromCache = false;
  String? _error;
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
      final result = await context.read<AuthProvider>().offline.get('/recouvrement');
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

  String _money(num? value) => '${(value ?? 0).round()} CDF';

  List<Map<String, dynamic>> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _rows;
    return _rows.where((row) {
      final hay = '${row['name']} ${row['code']} ${row['phone']}'.toLowerCase();
      return hay.contains(q);
    }).toList();
  }

  Future<void> _showActions(Map<String, dynamic> row) async {
    final clientId = row['clientId'] as String?;
    if (clientId == null) return;
    final moneyDue = (row['moneyDue'] as num?)?.toDouble() ?? 0;
    final advance = (row['advance'] as num?)?.toDouble() ?? 0;
    final emptiesDue = (row['emptiesDue'] as num?)?.toInt() ?? 0;

    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(row['name']?.toString() ?? 'Client'),
              subtitle: Text(
                'Dette: ${_money(moneyDue)} · Avance: ${_money(advance)} · Vidanges dues: $emptiesDue',
              ),
            ),
            if (moneyDue > 0)
              ListTile(
                leading: const Icon(Icons.payments),
                title: const Text('Encaisser / acompte'),
                onTap: () {
                  Navigator.pop(ctx);
                  _paymentDialog(row, asAdvance: false, defaultAmount: moneyDue);
                },
              ),
            ListTile(
              leading: const Icon(Icons.savings_outlined),
              title: const Text('Enregistrer une avance'),
              onTap: () {
                Navigator.pop(ctx);
                _paymentDialog(row, asAdvance: true);
              },
            ),
            if (advance > 0 && moneyDue > 0)
              ListTile(
                leading: const Icon(Icons.account_balance_wallet_outlined),
                title: const Text('Imputer l\'avance sur les commandes'),
                onTap: () {
                  Navigator.pop(ctx);
                  _applyAdvance(clientId);
                },
              ),
            if (emptiesDue > 0)
              ListTile(
                leading: const Icon(Icons.recycling),
                title: const Text('Retour vidanges'),
                onTap: () {
                  Navigator.pop(ctx);
                  _returnDialog(clientId);
                },
              ),
            ListTile(
              leading: const Icon(Icons.notifications_active_outlined),
              title: const Text('Relance client'),
              onTap: () {
                Navigator.pop(ctx);
                _remind(clientId);
              },
            ),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('Situation détaillée'),
              onTap: () {
                Navigator.pop(ctx);
                _showSituation(clientId, row['name']?.toString() ?? 'Client');
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _paymentDialog(
    Map<String, dynamic> row, {
    required bool asAdvance,
    double defaultAmount = 0,
  }) async {
    final clientId = row['clientId'] as String;
    final amountCtrl = TextEditingController(text: defaultAmount > 0 ? defaultAmount.toStringAsFixed(0) : '');
    var method = 'ESPECES';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(asAdvance ? 'Avance client' : 'Encaissement'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Montant (CDF)'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: method,
              decoration: const InputDecoration(labelText: 'Mode'),
              items: const [
                DropdownMenuItem(value: 'ESPECES', child: Text('Espèces')),
                DropdownMenuItem(value: 'MPESA', child: Text('M-Pesa')),
                DropdownMenuItem(value: 'ORANGE_MONEY', child: Text('Orange Money')),
                DropdownMenuItem(value: 'MOBILE_MONEY', child: Text('Mobile Money')),
              ],
              onChanged: (v) => method = v ?? 'ESPECES',
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Enregistrer')),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final amount = double.tryParse(amountCtrl.text) ?? 0;
    if (amount <= 0) return;

    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/payments',
            body: {
              'clientId': clientId,
              'amount': amount,
              'method': method,
              if (asAdvance) 'asAdvance': true,
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
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _applyAdvance(String clientId) async {
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/payments/apply-advance',
            body: {'clientId': clientId},
            entityType: 'payment',
          );
      if (!mounted) return;
      final applied = result.data is Map ? (result.data as Map)['totalApplied'] : null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(applied != null ? 'Avance imputée : ${_money(applied as num)}' : 'Avance imputée'),
          backgroundColor: Colors.green,
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _returnDialog(String clientId) async {
    var format = _formats.last;
    final qtyCtrl = TextEditingController(text: '1');

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Retour vidanges'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              value: format,
              decoration: const InputDecoration(labelText: 'Format'),
              items: _formats.map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
              onChanged: (v) => format = v ?? format,
            ),
            TextField(
              controller: qtyCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Quantité'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Enregistrer')),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final quantity = int.tryParse(qtyCtrl.text) ?? 0;
    if (quantity <= 0) return;

    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/consignes/returns',
            body: {'clientId': clientId, 'productFormat': format, 'quantity': quantity},
            entityType: 'consigne',
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Retour en file hors ligne' : 'Retour enregistré'),
          backgroundColor: Colors.green,
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _remind(String clientId) async {
    try {
      await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/recouvrement/clients/$clientId/relance',
            body: {},
            entityType: 'notification',
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Relance enregistrée'), backgroundColor: Colors.green),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _showSituation(String clientId, String name) async {
    try {
      final result = await context.read<AuthProvider>().offline.get('/recouvrement/clients/$clientId');
      if (!mounted) return;
      final data = result.data is Map ? Map<String, dynamic>.from(result.data as Map) : <String, dynamic>{};
      final money = data['money'] is Map ? Map<String, dynamic>.from(data['money'] as Map) : <String, dynamic>{};
      final orders = data['orders'] is List ? data['orders'] as List : [];
      final payments = data['payments'] is List ? data['payments'] as List : [];

      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Situation — $name'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Dette : ${_money(money['due'] as num?)}'),
                Text('Avance : ${_money(money['advance'] as num?)}'),
                if (orders.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Commandes non soldées', style: TextStyle(fontWeight: FontWeight.bold)),
                  ...orders.map((raw) {
                    final o = raw is Map ? Map<String, dynamic>.from(raw as Map) : <String, dynamic>{};
                    return Text(
                      '${o['orderNumber']} : ${_money(o['paidAmount'] as num?)} payé / ${_money(o['remaining'] as num?)} reste',
                      style: const TextStyle(fontSize: 13),
                    );
                  }),
                ],
                if (payments.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Derniers encaissements', style: TextStyle(fontWeight: FontWeight.bold)),
                  ...payments.take(8).map((raw) {
                    final p = raw is Map ? Map<String, dynamic>.from(raw as Map) : <String, dynamic>{};
                    final nature = p['isAdvance'] == true
                        ? 'Avance'
                        : (p['orderPaymentStatus'] == 'PARTIELLE' ? 'Acompte' : 'Règlement');
                    return Text(
                      '${nature} · ${_money(p['amount'] as num?)} · ${p['method']}',
                      style: const TextStyle(fontSize: 13),
                    );
                  }),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Fermer')),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;

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
                      child: rows.isEmpty
                          ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Aucun client à recouvrer'))])
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: rows.length,
                              itemBuilder: (context, i) {
                                final row = rows[i];
                                final moneyDue = (row['moneyDue'] as num?)?.toDouble() ?? 0;
                                final advance = (row['advance'] as num?)?.toDouble() ?? 0;
                                final emptiesDue = (row['emptiesDue'] as num?)?.toInt() ?? 0;
                                return Card(
                                  child: ListTile(
                                    title: Text(row['name']?.toString() ?? '—'),
                                    subtitle: Text(
                                      '${row['code'] ?? ''}\n'
                                      'Dette: ${_money(moneyDue)}'
                                      '${advance > 0 ? ' · Avance: ${_money(advance)}' : ''}'
                                      '${emptiesDue > 0 ? ' · Vidanges: $emptiesDue' : ''}',
                                    ),
                                    isThreeLine: true,
                                    trailing: const Icon(Icons.chevron_right),
                                    onTap: () => _showActions(row),
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
