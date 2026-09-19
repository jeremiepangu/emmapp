import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../core/modules.dart';
import '../providers/auth_provider.dart';

class EntityDetailScreen extends StatelessWidget {
  const EntityDetailScreen({
    super.key,
    required this.module,
    required this.item,
    this.onChanged,
  });

  final AppModule module;
  final Map<String, dynamic> item;
  final VoidCallback? onChanged;

  String? get _id => item['id']?.toString();

  Future<void> _run(BuildContext context, String method, String path) async {
    try {
      final result = await context.read<AuthProvider>().offline.mutate(method: method, path: path);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.queued ? 'Enregistré hors ligne — sera synchronisé' : 'Opération réussie'),
          backgroundColor: Colors.green,
        ),
      );
      onChanged?.call();
      Navigator.pop(context);
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: Colors.red));
    }
  }

  List<Widget> _actions(BuildContext context) {
    final id = _id;
    if (id == null) return [];
    final auth = context.read<AuthProvider>();
    final buttons = <Widget>[];

    void add(String label, String method, String path, String action, {Color? color}) {
      if (!auth.canDo(module.resource, action)) return;
      buttons.add(
        Padding(
          padding: const EdgeInsets.only(right: 8, bottom: 8),
          child: FilledButton(
            style: color == null ? null : FilledButton.styleFrom(backgroundColor: color),
            onPressed: () => _run(context, method, path),
            child: Text(label),
          ),
        ),
      );
    }

    switch (module.id) {
      case 'orders':
        add('Valider', 'PATCH', '/orders/$id/validate', 'validate');
        add('Annuler', 'PATCH', '/orders/$id/cancel', 'update', color: Colors.red);
        break;
      case 'tours':
        add('Démarrer', 'PATCH', '/tours/$id/start', 'update');
        add('Terminer', 'PATCH', '/tours/$id/complete', 'validate');
        break;
      case 'production':
        add('Valider OF', 'PATCH', '/emmapure/production/$id/validate', 'validate');
        break;
      case 'quality':
        add('Conforme', 'PATCH', '/emmapure/quality/$id/validate', 'validate');
        break;
      case 'contracts':
        add('Valider', 'POST', '/contracts/$id/validate', 'validate');
        add('Suspendre', 'POST', '/contracts/$id/suspend', 'update');
        break;
    }
    return buttons;
  }

  @override
  Widget build(BuildContext context) {
    final entries = item.entries.where((e) => e.value is! List && e.value is! Map).toList();
    final nested = item.entries.where((e) => e.value is List || e.value is Map).toList();

    return Scaffold(
      appBar: AppBar(title: Text(displayTitle(item))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(children: _actions(context)),
          ...entries.map(
            (e) => ListTile(
              title: Text(e.key),
              subtitle: Text(prettyValue(e.value)),
            ),
          ),
          ...nested.map((e) {
            if (e.value is List) {
              final list = asRecordList(e.value);
              return ExpansionTile(
                title: Text('${e.key} (${list.length})'),
                children: list
                    .map((row) => ListTile(
                          title: Text(displayTitle(row)),
                          subtitle: Text(displaySubtitle(row)),
                        ))
                    .toList(),
              );
            }
            return ExpansionTile(
              title: Text(e.key),
              children: [
                ListTile(title: Text(prettyValue(e.value))),
              ],
            );
          }),
        ],
      ),
    );
  }
}
