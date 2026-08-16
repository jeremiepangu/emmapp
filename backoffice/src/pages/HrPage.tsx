import { FormEvent, useEffect, useState } from 'react';
import { api, EmployeeProfile, LeaveRequest, ShiftAssignment, User } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ROLE_LABELS } from '../permissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';

const CONTRACTS = ['CDI', 'CDD', 'STAGE', 'PRESTATION', 'JOURNALIER'];
const DEPARTMENTS = ['Direction', 'Production', 'Exploitation', 'Qualité', 'Commercial', 'Finance', 'RH', 'IT'];
const LEAVE_TYPES = [
  { id: 'CONGE_PAYE', label: 'Congé payé' },
  { id: 'MALADIE', label: 'Maladie' },
  { id: 'SANS_SOLDE', label: 'Sans solde' },
  { id: 'AUTORISATION', label: 'Autorisation' },
  { id: 'MATERNITE', label: 'Maternité' },
];

type Tab = 'dossiers' | 'conges' | 'shifts';

export default function HrPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>('dossiers');
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [showEmployee, setShowEmployee] = useState(false);
  const [editing, setEditing] = useState<EmployeeProfile | null>(null);
  const [empForm, setEmpForm] = useState({
    userId: '', jobTitle: '', department: 'Exploitation', contractType: 'CDI',
    hireDate: new Date().toISOString().slice(0, 10), baseSalary: 450000, matricule: '',
  });
  const [leaveForm, setLeaveForm] = useState({
    userId: '', type: 'CONGE_PAYE', startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10), reason: '',
  });
  const [shiftForm, setShiftForm] = useState({
    userId: '', date: new Date().toISOString().slice(0, 10), startTime: '07:00', endTime: '15:00', postLabel: 'Opérateur production',
  });

  const load = () => {
    api.getEmployees().then(setEmployees).catch(() => setEmployees([]));
    api.getLeaves().then(setLeaves).catch(() => setLeaves([]));
    api.getShiftAssignments(shiftDate).then(setShifts).catch(() => setShifts([]));
  };

  useEffect(() => { api.getUsers().then((all) => setUsers(all.filter((u) => u.isActive !== false))); }, []);
  useEffect(() => { load(); }, [shiftDate]);

  const saveEmployee = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      await api.updateEmployee(editing.id, {
        jobTitle: empForm.jobTitle,
        department: empForm.department,
        contractType: empForm.contractType,
        hireDate: empForm.hireDate,
        baseSalary: Number(empForm.baseSalary),
      });
    } else {
      await api.createEmployee({ ...empForm, baseSalary: Number(empForm.baseSalary) });
    }
    setShowEmployee(false);
    setEditing(null);
    await load();
  };

  const money = (n: string | number) => Number(n).toLocaleString('fr-CD');

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Administration RH"
        subtitle="Dossiers agents, contrats, congés et planning des shifts"
        actions={can('hr', 'create') && tab === 'dossiers' ? (
          <button type="button" className="erp-btn" onClick={() => { setEditing(null); setShowEmployee(true); }}>+ Nouveau dossier</button>
        ) : undefined}
      />
      <div className="erp-tabs">
        {([
          ['dossiers', 'Dossiers agents'],
          ['conges', 'Congés'],
          ['shifts', 'Shifts'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`erp-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'dossiers' && (
        <ErpPanel title={`Agents (${employees.length})`}>
          <table className="erp-table">
            <thead>
              <tr><th>Matricule</th><th>Agent</th><th>Poste</th><th>Département</th><th>Contrat</th><th>Salaire</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.matricule}</strong></td>
                  <td>{e.user ? `${e.user.firstName} ${e.user.lastName}` : '—'}</td>
                  <td>{e.jobTitle}</td>
                  <td>{e.department}</td>
                  <td>{e.contractType}</td>
                  <td>{money(e.baseSalary)} CDF</td>
                  <td><StatusPill status={e.status === 'ACTIF' ? 'CONFORME' : 'ANNULEE'} label={e.status} /></td>
                  <td className="erp-row-actions">
                    {can('hr', 'update') && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                        setEditing(e);
                        setEmpForm({
                          userId: e.user?.id ?? '',
                          jobTitle: e.jobTitle,
                          department: e.department,
                          contractType: e.contractType,
                          hireDate: e.hireDate.slice(0, 10),
                          baseSalary: Number(e.baseSalary),
                          matricule: e.matricule,
                        });
                        setShowEmployee(true);
                      }}>Modifier</button>
                    )}
                    {can('hr', 'delete') && e.status === 'ACTIF' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteEmployee(e.id).then(load)}>Sortie</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      )}

      {tab === 'conges' && (
        <>
          {can('hr', 'create') && (
            <ErpPanel title="Nouvelle demande" padded>
              <form className="form-row" onSubmit={async (e) => {
                e.preventDefault();
                await api.createLeave(leaveForm);
                await load();
              }}>
                <div className="form-group">
                  <label>Agent</label>
                  <select value={leaveForm.userId} onChange={(ev) => setLeaveForm({ ...leaveForm, userId: ev.target.value })} required>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={leaveForm.type} onChange={(ev) => setLeaveForm({ ...leaveForm, type: ev.target.value })}>
                    {LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Début</label><input type="date" value={leaveForm.startDate} onChange={(ev) => setLeaveForm({ ...leaveForm, startDate: ev.target.value })} /></div>
                <div className="form-group"><label>Fin</label><input type="date" value={leaveForm.endDate} onChange={(ev) => setLeaveForm({ ...leaveForm, endDate: ev.target.value })} /></div>
                <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Créer</button></div>
              </form>
            </ErpPanel>
          )}
          <ErpPanel title={`Demandes (${leaves.length})`}>
            <table className="erp-table">
              <thead>
                <tr><th>Agent</th><th>Type</th><th>Période</th><th>Jours</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : '—'}</td>
                    <td>{LEAVE_TYPES.find((t) => t.id === l.type)?.label ?? l.type}</td>
                    <td>{new Date(l.startDate).toLocaleDateString('fr-FR')} → {new Date(l.endDate).toLocaleDateString('fr-FR')}</td>
                    <td>{l.days}</td>
                    <td><StatusPill status={l.status} label={l.status} /></td>
                    <td className="erp-row-actions">
                      {can('hr', 'validate') && l.status === 'SOUMISE' && (
                        <>
                          <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateLeave(l.id).then(load)}>Valider</button>
                          <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.rejectLeave(l.id).then(load)}>Rejeter</button>
                        </>
                      )}
                      {can('hr', 'delete') && l.status !== 'ANNULEE' && (
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.cancelLeave(l.id).then(load)}>Annuler</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'shifts' && (
        <>
          {can('hr', 'create') && (
            <ErpPanel title="Planifier un shift" padded>
              <form className="form-row" onSubmit={async (e) => {
                e.preventDefault();
                await api.createShiftAssignment(shiftForm);
                setShiftDate(shiftForm.date);
                await load();
              }}>
                <div className="form-group">
                  <label>Agent</label>
                  <select value={shiftForm.userId} onChange={(ev) => setShiftForm({ ...shiftForm, userId: ev.target.value })} required>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Date</label><input type="date" value={shiftForm.date} onChange={(ev) => setShiftForm({ ...shiftForm, date: ev.target.value })} /></div>
                <div className="form-group"><label>Début</label><input type="time" value={shiftForm.startTime} onChange={(ev) => setShiftForm({ ...shiftForm, startTime: ev.target.value })} /></div>
                <div className="form-group"><label>Fin</label><input type="time" value={shiftForm.endTime} onChange={(ev) => setShiftForm({ ...shiftForm, endTime: ev.target.value })} /></div>
                <div className="form-group"><label>Poste</label><input value={shiftForm.postLabel} onChange={(ev) => setShiftForm({ ...shiftForm, postLabel: ev.target.value })} /></div>
                <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Planifier</button></div>
              </form>
            </ErpPanel>
          )}
          <ErpPanel title={`Shifts du ${new Date(shiftDate).toLocaleDateString('fr-FR')}`} actions={
            <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
          }>
            <table className="erp-table">
              <thead>
                <tr><th>Agent</th><th>Horaire</th><th>Poste</th><th>Validé</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>{s.user ? `${s.user.firstName} ${s.user.lastName}` : '—'}</td>
                    <td>{s.startTime} – {s.endTime}</td>
                    <td>{s.postLabel}</td>
                    <td><StatusPill status={s.validated ? 'CONFORME' : 'EN_ATTENTE'} label={s.validated ? 'Oui' : 'Non'} /></td>
                    <td className="erp-row-actions">
                      {can('hr', 'validate') && !s.validated && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateShiftAssignment(s.id).then(load)}>Valider</button>
                      )}
                      {can('hr', 'delete') && (
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteShiftAssignment(s.id).then(load)}>Supprimer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      <Modal title={editing ? 'Modifier le dossier' : 'Nouveau dossier RH'} open={showEmployee} onClose={() => setShowEmployee(false)}>
        <form className="form-stack" onSubmit={saveEmployee}>
          {!editing && (
            <div className="form-group">
              <label>Agent</label>
              <select value={empForm.userId} onChange={(e) => setEmpForm({ ...empForm, userId: e.target.value })} required>
                <option value="">— Choisir —</option>
                {users.filter((u) => !employees.some((em) => em.user?.id === u.id && em.status === 'ACTIF')).map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group"><label>Poste</label><input value={empForm.jobTitle} onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Département</label>
              <select value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Contrat</label>
              <select value={empForm.contractType} onChange={(e) => setEmpForm({ ...empForm, contractType: e.target.value })}>
                {CONTRACTS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Embauche</label><input type="date" value={empForm.hireDate} onChange={(e) => setEmpForm({ ...empForm, hireDate: e.target.value })} /></div>
            <div className="form-group"><label>Salaire de base (CDF)</label><input type="number" min={0} value={empForm.baseSalary} onChange={(e) => setEmpForm({ ...empForm, baseSalary: Number(e.target.value) })} /></div>
          </div>
          <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  );
}
