import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/sync_provider.dart';
import '../providers/tour_provider.dart';
import 'tour_list_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      context.read<TourProvider>().loadTours(auth);
      context.read<SyncProvider>().refreshPendingCount();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('EMMAPP Mobile'),
        actions: [
          if (sync.pendingCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Chip(
                label: Text('${sync.pendingCount} en attente'),
                backgroundColor: Colors.orange.shade100,
              ),
            ),
          IconButton(
            icon: sync.isSyncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.sync),
            onPressed: sync.isSyncing ? null : () => sync.syncAll(auth),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: const [
          TourListScreen(),
          _ProfileTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setIndex(i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.local_shipping), label: 'Tournées'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Profil'),
        ],
      ),
    );
  }

  void setIndex(int i) => setState(() => _index = i);
}

class _ProfileTab extends StatelessWidget {
  const _ProfileTab();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncProvider>();
    final user = auth.user!;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: CircleAvatar(
              child: Text(user.firstName[0]),
            ),
            title: Text(user.fullName),
            subtitle: Text('${user.role} • ${user.email}'),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.cloud_sync),
                title: const Text('Synchronisation'),
                subtitle: Text(sync.status ?? 'Prêt'),
              ),
              if (sync.lastSyncAt != null)
                ListTile(
                  leading: const Icon(Icons.schedule),
                  title: const Text('Dernière sync'),
                  subtitle: Text(sync.lastSyncAt!),
                ),
              ListTile(
                leading: const Icon(Icons.pending_actions),
                title: const Text('Actions en attente'),
                trailing: Text('${sync.pendingCount}'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
