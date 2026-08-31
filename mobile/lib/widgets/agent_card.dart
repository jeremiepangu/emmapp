import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import 'photo_picker.dart';

/// Badge agent affiche dans le module RH, aligne sur le back-office.
class AgentCard extends StatelessWidget {
  const AgentCard({
    super.key,
    required this.fullName,
    this.photoUrl,
    this.matricule,
    this.jobTitle,
    this.department,
    this.contractType,
    this.hireDate,
    this.status,
    this.phone,
    this.email,
    this.onPhoto,
    this.onTap,
    this.company = 'EMMANUEL SERVICES SARLU',
  });

  final String fullName;
  final String? photoUrl;
  final String? matricule;
  final String? jobTitle;
  final String? department;
  final String? contractType;
  final String? hireDate;
  final String? status;
  final String? phone;
  final String? email;
  final VoidCallback? onPhoto;
  final VoidCallback? onTap;
  final String company;

  String get _initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'AG';
    final letters = parts.take(2).map((p) => p[0].toUpperCase()).join();
    return letters.isEmpty ? 'AG' : letters;
  }

  String get _hireLabel {
    if (hireDate == null || hireDate!.isEmpty) return '—';
    final parsed = DateTime.tryParse(hireDate!);
    if (parsed == null) return '—';
    return '${parsed.day.toString().padLeft(2, '0')}/'
        '${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    final image = photoProvider(photoUrl);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              color: AppTheme.primary,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      company,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const Text(
                    'BADGE AGENT',
                    style: TextStyle(color: Colors.white70, fontSize: 10),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Stack(
                    children: [
                      CircleAvatar(
                        radius: 32,
                        backgroundColor: const Color(0xFFE8EEF4),
                        backgroundImage: image,
                        child: image == null
                            ? Text(
                                _initials,
                                style: const TextStyle(
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 18,
                                ),
                              )
                            : null,
                      ),
                      if (onPhoto != null)
                        Positioned(
                          bottom: -4,
                          right: -4,
                          child: Material(
                            color: Colors.white,
                            shape: const CircleBorder(),
                            elevation: 2,
                            child: IconButton(
                              tooltip: 'Photo de l’agent',
                              iconSize: 16,
                              constraints: const BoxConstraints.tightFor(width: 30, height: 30),
                              padding: EdgeInsets.zero,
                              onPressed: onPhoto,
                              icon: const Icon(Icons.photo_camera_outlined),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        Text(
                          jobTitle?.isNotEmpty == true ? jobTitle! : 'Poste à définir',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                        ),
                        if (matricule?.isNotEmpty == true) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              matricule!,
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Wrap(
                spacing: 18,
                runSpacing: 8,
                children: [
                  _fact('Service', department),
                  _fact('Contrat', contractType),
                  _fact('Embauche', _hireLabel),
                  _fact('Statut', status ?? 'ACTIF'),
                  if (phone?.isNotEmpty == true) _fact('Téléphone', phone),
                  if (email?.isNotEmpty == true) _fact('E-mail', email),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fact(String label, String? value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(fontSize: 10, letterSpacing: 0.6, color: Colors.grey.shade600),
          ),
          Text(
            value?.isNotEmpty == true ? value! : '—',
            style: const TextStyle(fontSize: 13),
          ),
        ],
      );
}
