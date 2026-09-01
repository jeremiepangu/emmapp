import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/modules.dart';
import '../core/permissions.dart';
import '../providers/auth_provider.dart';
import '../providers/sync_provider.dart';
import '../providers/tour_provider.dart';
import '../widgets/offline_banner.dart';
import 'assistant_screen.dart';
import 'catalog_list_screen.dart';
import 'dashboard_screen.dart';
import 'consignes_screen.dart';
import 'pos_screen.dart';
import 'recouvrement_screen.dart';
import 'tour_list_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  AppModule? _current;
  int _navIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      context.read<TourProvider>().loadTours(auth);
      final sync = context.read<SyncProvider>();
      sync.refreshPendingCount();
      sync.syncAll(auth);
    });
  }

  List<AppModule> _visible(AuthProvider auth) =>
      modulesFor(auth.user?.role ?? '', auth.user?.permissions);

  List<AppModule> _tabs(AuthProvider auth) {
    final all = _visible(auth);
    AppModule? find(bool Function(AppModule) test) {
      for (final m in all) {
        if (test(m)) return m;
      }
      return null;
    }

    final dashboard = find((m) => m.id == 'dashboard') ?? all.first;
    final tours = find((m) => m.kind == ModuleKind.tours);
    final pos = find((m) => m.kind == ModuleKind.pos);
    final orders = find((m) => m.id == 'orders');
    final notif = find((m) => m.kind == ModuleKind.notifications);
    return [
      dashboard,
      if (tours != null) tours,
      if (pos != null) pos else if (orders != null) orders,
      if (notif != null) notif,
    ];
  }

  Widget _body(AppModule module) {
    switch (module.kind) {
      case ModuleKind.dashboard:
        return const DashboardScreen();
      case ModuleKind.tours:
        return const TourListScreen();
      case ModuleKind.pos:
        return const PosScreen();
      case ModuleKind.assistant:
        return const AssistantScreen();
      case ModuleKind.notifications:
        return const NotificationsScreen();
      case ModuleKind.sync:
        return const SyncScreen();
      case ModuleKind.catalog:
        if (module.id == 'recouvrement') {
          return const RecouvrementScreen();
        }
        if (module.id == 'consignes') {
          return const ConsignesScreen();
        }
        return CatalogListScreen(key: ValueKey(module.id), module: module);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncProvider>();
    final modules = _visible(auth);
    final tabs = _tabs(auth);
    final current = _current ?? tabs[_navIndex.clamp(0, tabs.length - 1)];
    final grouped = <String, List<AppModule>>{};
    for (final m in modules) {
      grouped.putIfAbsent(m.section, () => []).add(m);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(current.label),
        actions: [
          if (sync.pendingCount > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Chip(
                  label: Text('${sync.pendingCount}', style: const TextStyle(fontSize: 12)),
                  backgroundColor: Colors.orange.shade100,
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ),
          IconButton(
            tooltip: 'Synchroniser',
            onPressed: sync.isSyncing ? null : () => sync.syncAll(auth),
            icon: sync.isSyncing
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.sync),
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: ListView(
            children: [
              DrawerHeader(
                decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('EMMANUEL SERVICES', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                    const SizedBox(height: 8),
                    Text(auth.user?.fullName ?? '', style: const TextStyle(color: Colors.white)),
                    Text(roleLabel(auth.user?.role ?? ''), style: const TextStyle(color: Colors.white70)),
                  ],
                ),
              ),
              ...grouped.entries.expand((e) {
                return [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text(e.key, style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.bold, fontSize: 12)),
                  ),
                  ...e.value.map(
                    (m) => ListTile(
                      leading: Icon(m.icon),
                      title: Text(m.label),
                      selected: current.id == m.id,
                      onTap: () {
                        setState(() {
                          _current = m;
                          final idx = tabs.indexWhere((t) => t.id == m.id);
                          _navIndex = idx >= 0 ? idx : _navIndex;
                        });
                        Navigator.pop(context);
                      },
                    ),
                  ),
                ];
              }),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(child: _body(current)),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _navIndex.clamp(0, tabs.length - 1),
        onDestinationSelected: (i) {
          setState(() {
            _navIndex = i;
            _current = tabs[i];
          });
        },
        destinations: tabs
            .map((t) => NavigationDestination(icon: Icon(t.icon), label: t.label.split(' ').first))
            .toList(),
      ),
    );
  }
}
