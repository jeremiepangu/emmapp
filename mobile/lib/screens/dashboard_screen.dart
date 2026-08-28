import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../core/permissions.dart';
import '../providers/auth_provider.dart';
import '../providers/sync_provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic> _data = {};
  bool _loading = true;
  bool _fromCache = false;
  String? _error;

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
      final result = await context.read<AuthProvider>().offline.get('/dashboard/overview');
      setState(() {
        _data = result.data is Map ? Map<String, dynamic>.from(result.data as Map) : {};
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user!;

    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _data.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
            ],
          ),
        ),
      );
    }

    final kpis = <_Kpi>[
      _Kpi('Commandes', _pick(_data, ['ordersToday', 'orders', 'commandes']), Icons.receipt_long),
      _Kpi('Livraisons', _pick(_data, ['deliveriesToday', 'deliveries', 'livraisons']), Icons.local_shipping),
      _Kpi('Encaissements', _pick(_data, ['paymentsToday', 'cashToday', 'encaissements']), Icons.payments),
      _Kpi('Stock', _pick(_data, ['stockTotal', 'stock', 'totalStock']), Icons.warehouse),
    ];

    return RefreshIndicator(
      onRefresh: () async {
        await context.read<SyncProvider>().syncAll(auth);
        await _load();
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Bonjour ${user.firstName}', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          Text('${roleLabel(user.role)} · ${user.email}', style: TextStyle(color: Colors.grey.shade700)),
          if (_fromCache)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Données en cache (hors ligne)', style: TextStyle(color: Colors.orange, fontSize: 12)),
            ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: kpis
                .map(
                  (k) => Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(k.icon, color: Theme.of(context).colorScheme.primary),
                          const Spacer(),
                          Text(k.value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                          Text(k.label, style: const TextStyle(color: Colors.grey)),
                        ],
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 24),
          const Text('Indicateurs', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          ..._data.entries.take(20).map((e) {
            if (e.value is Map || e.value is List) return const SizedBox.shrink();
            return ListTile(
              dense: true,
              title: Text(e.key),
              trailing: Text(prettyValue(e.value), style: const TextStyle(fontWeight: FontWeight.w600)),
            );
          }),
        ],
      ),
    );
  }

  String _pick(Map<String, dynamic> data, List<String> keys) {
    for (final key in keys) {
      if (data[key] != null) return prettyValue(data[key]);
      if (data['kpis'] is Map && (data['kpis'] as Map)[key] != null) {
        return prettyValue((data['kpis'] as Map)[key]);
      }
    }
    return '—';
  }
}

class _Kpi {
  const _Kpi(this.label, this.value, this.icon);
  final String label;
  final String value;
  final IconData icon;
}
