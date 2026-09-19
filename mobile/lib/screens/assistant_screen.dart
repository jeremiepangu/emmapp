import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../core/permissions.dart';
import '../providers/auth_provider.dart';
import '../providers/sync_provider.dart';

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _controller = TextEditingController();
  final _messages = <_Msg>[];
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final q = _controller.text.trim();
    if (q.isEmpty) return;
    setState(() {
      _messages.add(_Msg(q, true));
      _sending = true;
      _controller.clear();
    });
    try {
      final result = await context.read<AuthProvider>().offline.mutate(
            method: 'POST',
            path: '/assistant/query',
            body: {'question': q, 'channel': 'BACKOFFICE'},
          );
      final data = result.data;
      String answer;
      if (result.queued) {
        answer = 'Question mise en file — l’assistant répondra après synchronisation.';
      } else if (data is Map && data['answer'] != null) {
        answer = data['answer'].toString();
      } else {
        answer = prettyValue(data);
      }
      setState(() => _messages.add(_Msg(answer, false)));
    } catch (e) {
      setState(() => _messages.add(_Msg(e.toString(), false)));
    } finally {
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? const Center(child: Text('Posez une question opérationnelle.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _messages.length,
                  itemBuilder: (context, i) {
                    final m = _messages[i];
                    return Align(
                      alignment: m.mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        constraints: const BoxConstraints(maxWidth: 320),
                        decoration: BoxDecoration(
                          color: m.mine ? Theme.of(context).colorScheme.primary : Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          m.text,
                          style: TextStyle(color: m.mine ? Colors.white : Colors.black87),
                        ),
                      ),
                    );
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  decoration: const InputDecoration(hintText: 'Votre question…'),
                  onSubmitted: (_) => _send(),
                ),
              ),
              IconButton(
                onPressed: _sending ? null : _send,
                icon: _sending
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.send),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Msg {
  _Msg(this.text, this.mine);
  final String text;
  final bool mine;
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await context.read<AuthProvider>().offline.get('/notifications');
      setState(() {
        _items = asRecordList(result.data);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _markAll() async {
    await context.read<AuthProvider>().offline.mutate(method: 'PATCH', path: '/notifications/read-all');
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Column(
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(onPressed: _markAll, child: const Text('Tout marquer lu')),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: _items.isEmpty
                ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Aucune notification'))])
                : ListView.builder(
                    itemCount: _items.length,
                    itemBuilder: (context, i) {
                      final n = _items[i];
                      return ListTile(
                        leading: Icon(
                          n['readAt'] == null ? Icons.notifications_active : Icons.notifications_none,
                          color: n['readAt'] == null ? Theme.of(context).colorScheme.primary : Colors.grey,
                        ),
                        title: Text(displayTitle(n, keys: const ['title', 'message', 'label'])),
                        subtitle: Text(prettyValue(n['createdAt'] ?? n['category'] ?? '')),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

class SyncScreen extends StatelessWidget {
  const SyncScreen({super.key});

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
            leading: CircleAvatar(child: Text(user.firstName.isEmpty ? '?' : user.firstName[0])),
            title: Text(user.fullName),
            subtitle: Text('${roleLabel(user.role)} · ${user.email}'),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: Icon(sync.online ? Icons.cloud_done : Icons.cloud_off),
                title: Text(sync.online ? 'En ligne' : 'Hors ligne'),
                subtitle: Text(sync.status ?? 'Prêt à synchroniser'),
              ),
              ListTile(
                leading: const Icon(Icons.pending_actions),
                title: const Text('Actions en attente'),
                trailing: Text('${sync.pendingCount}'),
              ),
              if (sync.lastSyncAt != null)
                ListTile(
                  leading: const Icon(Icons.schedule),
                  title: const Text('Dernière synchro'),
                  subtitle: Text(sync.lastSyncAt!),
                ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton.icon(
                  onPressed: sync.isSyncing ? null : () => sync.syncAll(auth),
                  icon: sync.isSyncing
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.sync),
                  label: const Text('Synchroniser maintenant'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: () => auth.logout(),
          icon: const Icon(Icons.logout),
          label: const Text('Déconnexion'),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700),
        ),
      ],
    );
  }
}
