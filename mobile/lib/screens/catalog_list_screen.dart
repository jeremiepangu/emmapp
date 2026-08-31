import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../core/modules.dart';
import '../providers/auth_provider.dart';
import '../widgets/agent_card.dart';
import '../widgets/photo_picker.dart';
import '../widgets/product_sale_card.dart';
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
  final Map<String, int> _preview = {};

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

  /// Enregistre la photo d'un produit ou d'un agent en data URL.
  Future<void> _updatePhoto({
    required String path,
    required String field,
    required String title,
    required bool hasPhoto,
  }) async {
    final dataUrl = await pickPhotoDataUrl(context, title: title, canRemove: hasPhoto);
    if (dataUrl == null || !mounted) return;
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'PATCH',
            path: path,
            body: {field: dataUrl.isEmpty ? null : dataUrl},
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Photo en file hors ligne' : 'Photo enregistrée'),
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e'), backgroundColor: Colors.red),
      );
    }
  }

  Widget _productGrid(List<Map<String, dynamic>> items, bool canUpdate) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 240,
        mainAxisExtent: 320,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final item = items[i];
        final id = item['id']?.toString() ?? '';
        final imageUrl = item['imageUrl'] as String?;
        return ProductSaleCard(
          name: item['name']?.toString() ?? '',
          code: item['code']?.toString(),
          format: item['format']?.toString(),
          imageUrl: imageUrl,
          price: double.tryParse(item['unitPrice']?.toString() ?? '') ?? 0,
          quantity: _preview[id] ?? 1,
          minQuantity: 1,
          badge: (imageUrl == null || imageUrl.isEmpty) ? 'Photo manquante' : null,
          metaLabel: 'Consigne',
          metaValue: item['isReusable'] == true ? 'Consigné · réutilisable' : 'Usage unique',
          onQuantityChanged: (q) => setState(() => _preview[id] = q),
          onPhoto: canUpdate
              ? () => _updatePhoto(
                    path: '/products/$id',
                    field: 'imageUrl',
                    title: 'Photo du produit',
                    hasPhoto: imageUrl != null && imageUrl.isNotEmpty,
                  )
              : null,
          onAdd: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => EntityDetailScreen(
                module: widget.module,
                item: item,
                onChanged: _load,
              ),
            ),
          ),
          addLabel: 'Voir la fiche',
        );
      },
    );
  }

  Widget _agentList(List<Map<String, dynamic>> items, bool canUpdate) {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final item = items[i];
        final id = item['id']?.toString() ?? '';
        final user = item['user'] is Map ? Map<String, dynamic>.from(item['user'] as Map) : null;
        final photoUrl = item['photoUrl'] as String?;
        final fullName = [user?['firstName'], user?['lastName']]
            .where((e) => e != null && e.toString().isNotEmpty)
            .join(' ');
        return AgentCard(
          fullName: fullName.isEmpty ? 'Agent' : fullName,
          photoUrl: photoUrl,
          matricule: item['matricule']?.toString(),
          jobTitle: item['jobTitle']?.toString(),
          department: item['department']?.toString(),
          contractType: item['contractType']?.toString(),
          hireDate: item['hireDate']?.toString(),
          status: item['status']?.toString(),
          phone: user?['phone']?.toString(),
          email: user?['email']?.toString(),
          onPhoto: canUpdate
              ? () => _updatePhoto(
                    path: '/hr/employees/$id',
                    field: 'photoUrl',
                    title: 'Photo de l’agent',
                    hasPhoto: photoUrl != null && photoUrl.isNotEmpty,
                  )
              : null,
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
        );
      },
    );
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
                            : widget.module.id == 'products'
                            ? _productGrid(filtered, auth.canDo('products', 'update'))
                            : widget.module.id == 'hr'
                            ? _agentList(filtered, auth.canDo('hr', 'update'))
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
