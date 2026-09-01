import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../providers/tour_provider.dart';

class DeliveryScreen extends StatefulWidget {
  const DeliveryScreen({super.key, required this.tour, required this.order});

  final Tour tour;
  final Order order;

  @override
  State<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends State<DeliveryScreen> {
  final _formData = DeliveryFormData();
  final _paymentController = TextEditingController();
  String _paymentMethod = 'ESPECES';
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    for (final line in widget.order.lines) {
      _formData.delivered[line.productId] = line.quantity;
      _formData.returned[line.productId] = 0;
      _formData.damaged[line.productId] = 0;
      _formData.refused[line.productId] = 0;
    }
    final total = widget.order.totalAmount > 0
        ? widget.order.totalAmount - widget.order.paidAmount
        : widget.order.lines.fold<double>(
            0,
            (sum, l) => sum + l.unitPrice * l.quantity,
          );
    _paymentController.text = total.toStringAsFixed(0);
  }

  @override
  void dispose() {
    _paymentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);

    try {
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition();
      } catch (_) {}

      final deliveryResult = await DeliveryProvider.submitDelivery(
        auth: context.read<AuthProvider>(),
        order: widget.order,
        tourId: widget.tour.id,
        form: _formData,
        latitude: position?.latitude,
        longitude: position?.longitude,
      );

      final amount = double.tryParse(_paymentController.text) ?? 0;
      var queuedPayment = false;
      if (amount > 0) {
        queuedPayment = await DeliveryProvider.submitPayment(
          auth: context.read<AuthProvider>(),
          deliveryId: deliveryResult.deliveryId,
          orderId: widget.order.id,
          clientId: widget.order.clientId,
          amount: amount,
          method: _paymentMethod,
        );
      }

      if (mounted) {
        final queued = deliveryResult.queued || queuedPayment;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(queued
                ? 'Enregistré hors ligne — sera synchronisé dès le réseau'
                : 'Livraison enregistrée'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Livraison - ${widget.order.clientName}')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              color: Colors.blue.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.order.clientName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    Text(widget.order.orderNumber),
                    if (widget.order.paymentStatus != 'SOLDEE')
                      Text(
                        'Reste à payer : ${(widget.order.totalAmount - widget.order.paidAmount).toStringAsFixed(0)} CDF',
                        style: TextStyle(color: Colors.orange.shade900),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Articles livrés', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            ...widget.order.lines.map((line) => _LineEditor(
                  line: line,
                  formData: _formData,
                  onChanged: () => setState(() {}),
                )),
            const SizedBox(height: 24),
            const Text('Encaissement', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            TextField(
              controller: _paymentController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Montant (CDF)',
                prefixIcon: Icon(Icons.payments),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _paymentMethod,
              decoration: const InputDecoration(labelText: 'Mode de paiement'),
              items: const [
                DropdownMenuItem(value: 'ESPECES', child: Text('Espèces')),
                DropdownMenuItem(value: 'MPESA', child: Text('M-Pesa')),
                DropdownMenuItem(value: 'ORANGE_MONEY', child: Text('Orange Money')),
                DropdownMenuItem(value: 'AIRTEL_MONEY', child: Text('Airtel Money')),
                DropdownMenuItem(value: 'MOBILE_MONEY', child: Text('Mobile Money')),
                DropdownMenuItem(value: 'CHEQUE', child: Text('Chèque')),
                DropdownMenuItem(value: 'CREDIT', child: Text('Crédit')),
              ],
              onChanged: (v) => setState(() => _paymentMethod = v!),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Confirmer la livraison', style: TextStyle(fontSize: 18)),
            ),
          ],
        ),
      ),
    );
  }
}

class _LineEditor extends StatelessWidget {
  const _LineEditor({
    required this.line,
    required this.formData,
    required this.onChanged,
  });

  final OrderLine line;
  final DeliveryFormData formData;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(line.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
            if (line.isReusable)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Consigne: vidanges à rendre (bonus inclus)',
                  style: TextStyle(color: Colors.orange.shade800, fontSize: 12),
                ),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _qtyField('Livrés', formData.delivered, line.productId, line.quantity)),
                const SizedBox(width: 8),
                Expanded(child: _qtyField('Refusés', formData.refused, line.productId, 0)),
                const SizedBox(width: 8),
                if (line.isReusable)
                  Expanded(child: _qtyField('Vidanges', formData.returned, line.productId, 0)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _qtyField(String label, Map<String, int> map, String productId, int initial) {
    final controller = TextEditingController(text: (map[productId] ?? initial).toString());
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(labelText: label, isDense: true),
      onChanged: (v) {
        map[productId] = int.tryParse(v) ?? 0;
        onChanged();
      },
    );
  }
}
