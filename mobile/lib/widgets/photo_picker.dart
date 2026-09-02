import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Les photos sont stockees en data URL dans une colonne texte cote API :
/// on limite donc la definition et la qualite des le choix de l'image.
const int _maxPhotoSize = 600;
const int _photoQuality = 82;

Future<String?> _capture(ImageSource source, int maxSize) async {
  final picked = await ImagePicker().pickImage(
    source: source,
    maxWidth: maxSize.toDouble(),
    maxHeight: maxSize.toDouble(),
    imageQuality: _photoQuality,
  );
  if (picked == null) return null;
  final bytes = await picked.readAsBytes();
  return 'data:image/jpeg;base64,${base64Encode(bytes)}';
}

/// Propose l'appareil photo ou la galerie et renvoie une data URL.
/// Renvoie une chaine vide quand l'utilisateur retire la photo existante.
Future<String?> pickPhotoDataUrl(
  BuildContext context, {
  String title = 'Photo',
  bool canRemove = false,
  int maxSize = _maxPhotoSize,
}) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Prendre une photo'),
            onTap: () => Navigator.pop(sheetContext, 'camera'),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Choisir dans la galerie'),
            onTap: () => Navigator.pop(sheetContext, 'gallery'),
          ),
          if (canRemove)
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Retirer la photo'),
              onTap: () => Navigator.pop(sheetContext, 'remove'),
            ),
        ],
      ),
    ),
  );

  if (choice == null) return null;
  if (choice == 'remove') return '';
  final source = choice == 'camera' ? ImageSource.camera : ImageSource.gallery;
  try {
    return await _capture(source, maxSize);
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Appareil photo indisponible')),
      );
    }
    return null;
  }
}

/// Decode une data URL en image affichable ; renvoie null si absente ou invalide.
ImageProvider? photoProvider(String? value) {
  if (value == null || value.isEmpty) return null;
  final marker = value.indexOf('base64,');
  if (marker == -1) return NetworkImage(value);
  try {
    return MemoryImage(base64Decode(value.substring(marker + 7)));
  } catch (_) {
    return null;
  }
}
