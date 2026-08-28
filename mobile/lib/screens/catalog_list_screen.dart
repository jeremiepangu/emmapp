import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../core/modules.dart';
import '../providers/auth_provider.dart';
import 'client_form_screen.dart';
import 'entity_detail_screen.dart';

class CatalogListScreen extends StatefulWidget {
  const CatalogListScreen({super.key, required this.module});

  final AppModule module;

  @override
  State<CatalogListScreen> createState() => _CatalogListScreenState();
}

class _CatalogListScreenState extends State<CatalogListScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _fromCache = false;
  String? _error;
  String _query = '';

  String get _path => widget.module.listPath ?? '/';

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
      final result = await context.read<AuthProvider>().offline.get(_path);
      setState(() {
        _items = asRecordList(result.data);
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

  void _openCreate() {
    final id = widget.module.id;
    Widget? page;
    if (id == 'clients') page = const ClientFormScreen();
    if (id == 'orders') page = const OrderFormScreen();
    if (id == 'payments') page = const PaymentFormScreen();
    if (id == 'stock') page = const StockAdjustScreen();
    if (page == null) return;
    Navigator.push(context, MaterialPageRoute(builder: (_) => page!)).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final canCreate = widget.module.createLabel != null &&
        auth.canDo(widget.module.resource, 'create');
    final filtered = _query.trim().isEmpty
        ? _items
        : _items.where((e) {
            final hay = '${displayTitle(e)} ${displaySubtitle(e)} ${e.values.join(' ')}'.toLowerCase();
            return hay.contains(_query.toLowerCase());
          }).toList();

    return Scaffold(
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: _openCreate,
              icon: const Icon(Icons.add),
              label: Text(widget.module.createLabel!),
            )
          : null,
      body: Column(
        children: [
          if (_fromCache)
            const Material(
              color: Color(0xFFFFF3E0),
              child: ListTile(
                dense: true,
                leading: Icon(Icons.offline_pin, color: Colors.orange),
                title: Text('Affichage du cache local'),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Rechercher…',
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null && _items.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Text(_error!, textAlign: TextAlign.center),
                            ),
                            ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: filtered.isEmpty
                            ? ListView(
                                children: const [
                                  SizedBox(height: 80),
                                  Center(child: Text('Aucune donnée')),
                                ],
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(12),
                                itemCount: filtered.length,
                                itemBuilder: (context, i) {
                                  final item = filtered[i];
                                  return Card(
                                    child: ListTile(
                                      leading: CircleAvatar(child: Icon(widget.module.icon, size: 18)),
                                      title: Text(displayTitle(item)),
                                      subtitle: Text(displaySubtitle(item)),
                                      trailing: const Icon(Icons.chevron_right),
                                      onTap: () => Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => EntityDetailScreen(
                                            module: widget.module,
                                            item: item,
                                            onChanged: _load,
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}
