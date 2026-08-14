import { useEffect, useState, FormEvent } from 'react';
import { api, ShiftAssignment, User } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function HrPage() {
  const { can } = usePermissions();
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    userId: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '07:00',
    endTime: '12:00',
    postLabel: 'Opérateur production',
    notes: '',
  });

  const load = () => api.getShiftAssignments(form.date).then(setShifts);

  useEffect(() => {
    load();
    api.getUsersByRole('LIVREUR').then(setUsers);
    api.getUsersByRole('CHARGE_LIVRAISON').then((u) => setUsers((prev) => [...prev, ...u]));
  }, [form.date]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.createShiftAssignment(form);
    await load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="RH & polyvalence"
        subtitle="Affectations horaires multi-postes et rapports journaliers d'activité"
      />
      {can('hr', 'create') && (
        <ErpPanel title="Planifier un shift" padded>
          <form onSubmit={handleSubmit} className="form-row">
            <div className="form-group">
              <label>Agent</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
                <option value="">— Choisir —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="form-group"><label>Début</label><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div className="form-group"><label>Fin</label><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            <div className="form-group"><label>Poste</label><input value={form.postLabel} onChange={(e) => setForm({ ...form, postLabel: e.target.value })} /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Planifier</button></div>
          </form>
        </ErpPanel>
      )}
      <ErpPanel title={`Shifts du ${new Date(form.date).toLocaleDateString('fr-FR')}`}>
        <table className="erp-table">
          <thead>
            <tr><th>Agent</th><th>Date</th><th>Horaire</th><th>Poste</th><th>Validé</th></tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td>{s.user ? `${s.user.firstName} ${s.user.lastName}` : '—'}</td>
                <td>{new Date(s.date).toLocaleDateString('fr-FR')}</td>
                <td>{s.startTime} – {s.endTime}</td>
                <td>{s.postLabel}</td>
                <td><StatusPill status={s.validated ? 'CONFORME' : 'EN_ATTENTE'} label={s.validated ? 'Oui' : 'Non'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
