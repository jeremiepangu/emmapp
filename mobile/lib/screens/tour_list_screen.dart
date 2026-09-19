import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/json_utils.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../providers/tour_provider.dart';
import 'client_form_screen.dart';
import 'delivery_screen.dart';

class TourListScreen extends StatefulWidget {
  const TourListScreen({super.key});

  @override
  State<TourListScreen> createState() => _TourListScreenState();
}

class _TourListScreenState extends State<TourListScreen> {
  List<Map<String, dynamic>> _vehicles = [];
  bool _startingField = false;

  @override
  void initState() {
    super.initState();
    _loadVehicles();
  }

  Future<void> _loadVehicles() async {
    try {
      final res = await context.read<AuthProvider>().offline.get('/vehicles');
      if (!mounted) return;
      setState(() => _vehicles = asRecordList(res.data));
    } catch (_) {}
  }

  Future<void> _startFieldTour() async {
    if (_vehicles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aucun véhicule disponible'), backgroundColor: Colors.red),
      );
      return;
    }
    final vehicleId = _vehicles.first['id'] as String?;
    if (vehicleId == null) return;
    setState(() => _startingField = true);
    try {
      await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/tours/field-start',
            body: {'vehicleId': vehicleId},
          );
      if (!mounted) return;
      await context.read<TourProvider>().loadTours(context.read<AuthProvider>(), forceOnline: true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tournée terrain démarrée'), backgroundColor: Colors.green),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _startingField = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tourProvider = context.watch<TourProvider>();

    if (tourProvider.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (tourProvider.error != null && tourProvider.tours.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(tourProvider.error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.read<TourProvider>().loadTours(
                    context.read<AuthProvider>(),
                    forceOnline: true,
                  ),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _startingField ? null : _startFieldTour,
              icon: _startingField
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.local_shipping_outlined),
              label: const Text('Démarrer une tournée terrain (sans commande)'),
            ),
          ),
        ),
        Expanded(
          child: tourProvider.tours.isEmpty
              ? const Center(child: Text('Aucune tournée assignée'))
              : RefreshIndicator(
                  onRefresh: () => context.read<TourProvider>().loadTours(
                        context.read<AuthProvider>(),
                        forceOnline: true,
                      ),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: tourProvider.tours.length,
                    itemBuilder: (context, index) {
                      final tour = tourProvider.tours[index];
                      return _TourCard(tour: tour);
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class _TourCard extends StatelessWidget {
  const _TourCard({required this.tour});

  final Tour tour;

  Color _statusColor(String status) {
    switch (status) {
      case 'EN_COURS':
        return Colors.green;
      case 'PLANIFIEE':
        return Colors.blue;
      case 'TERMINEE':
        return Colors.grey;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TourDetailScreen(tour: tour),
          ),
        ),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    tour.tourNumber,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  Chip(
                    label: Text(tour.status, style: const TextStyle(fontSize: 12)),
                    backgroundColor: _statusColor(tour.status).withOpacity(0.2),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.map, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(tour.zone),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.inventory_2, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text('${tour.orders.length} commande(s)'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TourDetailScreen extends StatefulWidget {
  const TourDetailScreen({super.key, required this.tour});

  final Tour tour;

  @override
  State<TourDetailScreen> createState() => _TourDetailScreenState();
}

class _TourDetailScreenState extends State<TourDetailScreen> {
  List<Product> _products = [];
  final Map<String, int> _unsoldQty = {};
  bool _loadingUnsold = false;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    try {
      final res = await context.read<AuthProvider>().offline.get('/products');
      if (!mounted) return;
      setState(() => _products = asRecordList(res.data).map(Product.fromJson).toList());
    } catch (_) {}
  }

  Future<void> _recordUnsold() async {
    final lines = _unsoldQty.entries.where((e) => e.value > 0).map((e) => {
          'productId': e.key,
          'quantity': e.value,
        }).toList();
    if (lines.isEmpty) return;
    setState(() => _loadingUnsold = true);
    try {
      await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/tours/${widget.tour.id}/unsold',
            body: {'lines': lines},
          );
      if (!mounted) return;
      setState(() => _unsoldQty.clear());
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invendus enregistrés'), backgroundColor: Colors.green),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _loadingUnsold = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tour = widget.tour;
    final canSell = tour.status == 'EN_COURS' || tour.status == 'PLANIFIEE';

    return Scaffold(
      appBar: AppBar(title: Text(tour.tourNumber)),
      floatingActionButton: canSell
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => OrderFormScreen(tourId: tour.id, tourNumber: tour.tourNumber),
                ),
              ).then((_) => context.read<TourProvider>().loadTours(context.read<AuthProvider>(), forceOnline: true)),
              icon: const Icon(Icons.add_shopping_cart),
              label: const Text('Vente terrain'),
            )
          : null,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (tour.orders.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'Aucune commande planifiée. Créez une vente terrain : elle sera rattachée à vous et à cette tournée.',
                  style: TextStyle(color: Colors.grey.shade700),
                ),
              ),
            ),
          ...tour.orders.map((order) => Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  title: Text(order.clientName),
                  subtitle: Text('${order.orderNumber} • ${order.lines.length} article(s)'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => DeliveryScreen(tour: tour, order: order),
                    ),
                  ),
                ),
              )),
          if (canSell && _products.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Déclarer des invendus', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ..._products.map((p) {
              final qty = _unsoldQty[p.id] ?? 0;
              return ListTile(
                title: Text(p.name),
                trailing: SizedBox(
                  width: 100,
                  child: TextField(
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(isDense: true, hintText: qty > 0 ? '$qty' : '0'),
                    onChanged: (v) => setState(() => _unsoldQty[p.id] = int.tryParse(v) ?? 0),
                  ),
                ),
              );
            }),
            ElevatedButton(
              onPressed: _loadingUnsold ? null : _recordUnsold,
              child: Text(_loadingUnsold ? 'Enregistrement…' : 'Enregistrer les invendus'),
            ),
          ],
        ],
      ),
    );
  }
}
