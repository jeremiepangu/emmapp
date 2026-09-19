import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/json_utils.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  Map<String, dynamic>? _status;
  bool _loading = true;
  bool _punching = false;
  String? _error;

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
      final data = await context.read<AuthProvider>().api.getJson('/hr/attendance/me');
      setState(() {
        _status = data is Map ? Map<String, dynamic>.from(data) : null;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _punch(String type) async {
    setState(() => _punching = true);
    try {
      await context.read<AuthProvider>().api.send('POST', '/hr/attendance/punch', {'type': type});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_punchLabel(type))),
        );
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red.shade700),
        );
      }
    } finally {
      if (mounted) setState(() => _punching = false);
    }
  }

  String _punchLabel(String type) {
    switch (type) {
      case 'ENTREE':
        return 'Entrée enregistrée';
      case 'SORTIE':
        return 'Sortie enregistrée';
      case 'PAUSE_DEBUT':
        return 'Pause démarrée';
      case 'PAUSE_FIN':
        return 'Reprise enregistrée';
      default:
        return 'Pointage enregistré';
    }
  }

  String _fmtMin(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return '${h}h${m.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _load, child: const Text('Réessayer')),
            ],
          ),
        ),
      );
    }

    final day = _status?['day'] is Map ? Map<String, dynamic>.from(_status!['day'] as Map) : null;
    final punches = asRecordList(_status?['punches']);
    final onLeave = _status?['onLeave'] == true;
    final canIn = _status?['canPunchIn'] == true;
    final canOut = _status?['canPunchOut'] == true;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Aujourd\'hui',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  if (onLeave)
                    const Text('Vous êtes en congé.')
                  else if (day != null)
                    Text(
                      'Prestation : ${_fmtMin(asInt(day['workedMinutes']))} · '
                      'Prévu : ${_fmtMin(asInt(day['plannedMinutes']))} · '
                      'HS : ${_fmtMin(asInt(day['overtimeMinutes']))}',
                    )
                  else
                    const Text('Aucun pointage enregistré.'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (!onLeave) ...[
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _punching || !canIn ? null : () => _punch('ENTREE'),
                    icon: const Icon(Icons.login),
                    label: const Text('Entrée'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _punching || !canOut ? null : () => _punch('SORTIE'),
                    icon: const Icon(Icons.logout),
                    label: const Text('Sortie'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _punching ? null : () => _punch('PAUSE_DEBUT'),
                    child: const Text('Pause'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _punching ? null : () => _punch('PAUSE_FIN'),
                    child: const Text('Reprise'),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 24),
          Text('Historique du jour', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (punches.isEmpty)
            const Text('Aucun pointage.')
          else
            ...punches.map((p) {
              final at = DateTime.tryParse(p['punchedAt']?.toString() ?? '');
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.access_time),
                title: Text(p['type']?.toString() ?? ''),
                trailing: Text(
                  at != null
                      ? '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}'
                      : '',
                ),
              );
            }),
        ],
      ),
    );
  }
}

int asInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.round();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
