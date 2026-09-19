import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import 'photo_picker.dart';

const Map<String, Color> _formatTints = {
  'BIDON_5L': Color(0xFFDBEAFE),
  'BIDON_10L': Color(0xFFD9F2FB),
  'BIDON_25L': Color(0xFFDCFCE7),
  'BONBONNE_19L': Color(0xFFD6EEFB),
};

/// Carte produit commune aux ecrans de vente, alignee sur le back-office.
class ProductSaleCard extends StatelessWidget {
  const ProductSaleCard({
    super.key,
    required this.name,
    required this.price,
    required this.quantity,
    required this.onQuantityChanged,
    this.code,
    this.format,
    this.imageUrl,
    this.onAdd,
    this.addLabel = 'Ajouter',
    this.metaLabel = 'Livraison',
    this.metaValue,
    this.badge,
    this.selected = false,
    this.minQuantity = 0,
    this.onPhoto,
  });

  final String name;
  final double price;
  final int quantity;
  final ValueChanged<int> onQuantityChanged;
  final String? code;
  final String? format;
  final String? imageUrl;
  final VoidCallback? onAdd;
  final String addLabel;
  final String metaLabel;
  final String? metaValue;
  final String? badge;
  final bool selected;
  final int minQuantity;
  final VoidCallback? onPhoto;

  @override
  Widget build(BuildContext context) {
    final image = photoProvider(imageUrl);

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: selected ? AppTheme.primary : Colors.grey.shade300,
          width: selected ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              children: [
                Container(
                  height: 108,
                  decoration: BoxDecoration(
                    color: _formatTints[format] ?? const Color(0xFFEFF6FB),
                    borderRadius: BorderRadius.circular(10),
                    image: image == null
                        ? null
                        : DecorationImage(image: image, fit: BoxFit.contain),
                  ),
                  child: image != null
                      ? null
                      : Icon(
                          Icons.water_drop_outlined,
                          size: 46,
                          color: AppTheme.primary.withOpacity(0.55),
                        ),
                ),
                if (badge != null)
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        badge!,
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                if (onPhoto != null)
                  Positioned(
                    bottom: 6,
                    right: 6,
                    child: Material(
                      color: Colors.white,
                      shape: const CircleBorder(),
                      elevation: 2,
                      child: IconButton(
                        tooltip: 'Photo du produit',
                        iconSize: 18,
                        constraints: const BoxConstraints.tightFor(width: 34, height: 34),
                        padding: EdgeInsets.zero,
                        onPressed: onPhoto,
                        icon: const Icon(Icons.photo_camera_outlined),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      color: Colors.grey.shade100,
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      child: Row(
                        children: [
                          IconButton(
                            iconSize: 18,
                            visualDensity: VisualDensity.compact,
                            onPressed: quantity <= minQuantity
                                ? null
                                : () => onQuantityChanged(quantity - 1),
                            icon: const Icon(Icons.remove),
                          ),
                          Expanded(
                            child: Text(
                              '$quantity',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                          IconButton(
                            iconSize: 18,
                            visualDensity: VisualDensity.compact,
                            onPressed: () => onQuantityChanged(quantity + 1),
                            icon: const Icon(Icons.add),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      price.toStringAsFixed(0),
                      style: const TextStyle(
                        color: AppTheme.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            if (code != null || format != null)
              Text(
                [code, format].where((e) => e != null && e.isNotEmpty).join(' · '),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
            if (metaValue != null) ...[
              const SizedBox(height: 6),
              Text(
                metaLabel.toUpperCase(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade600,
                ),
              ),
              Text(
                metaValue!,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12),
              ),
            ],
            if (onAdd != null) ...[
              const SizedBox(height: 10),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 40),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                ),
                onPressed: onAdd,
                child: Text(addLabel, style: const TextStyle(fontSize: 12)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
