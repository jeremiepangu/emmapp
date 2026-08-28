import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/sync_provider.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncProvider>();
    if (sync.online && sync.pendingCount == 0) return const SizedBox.shrink();
    final offline = !sync.online;
    return Material(
      color: offline ? const Color(0xFF5D4037) : const Color(0xFFE65100),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Icon(offline ? Icons.cloud_off : Icons.cloud_upload, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  offline
                      ? 'Mode hors ligne — lecture du cache, écritures en file'
                      : '${sync.pendingCount} action(s) en attente de synchro',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
              if (!offline && sync.pendingCount > 0)
                TextButton(
                  onPressed: sync.isSyncing
                      ? null
                      : () => sync.syncAll(context.read<AuthProvider>()),
                  child: const Text('SYNC', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
