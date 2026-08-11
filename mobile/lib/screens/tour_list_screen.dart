import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../providers/tour_provider.dart';
import 'delivery_screen.dart';

class TourListScreen extends StatelessWidget {
  const TourListScreen({super.key});

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

    if (tourProvider.tours.isEmpty) {
      return const Center(child: Text('Aucune tournée assignée'));
    }

    return RefreshIndicator(
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

class TourDetailScreen extends StatelessWidget {
  const TourDetailScreen({super.key, required this.tour});

  final Tour tour;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tour.tourNumber)),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: tour.orders.length,
        itemBuilder: (context, index) {
          final order = tour.orders[index];
          return Card(
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
          );
        },
      ),
    );
  }
}
