import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  api,
  ActivityObjective,
  CreateActivityObjectiveInput,
  JobFunction,
  User,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printActivityObjectiveSheet, printActivityObjectivesList } from '../documents/templates';

const PERIODS = [
  { id: 'MENSUEL', label: 'Mensuel' },
  { id: 'TRIMESTRIEL', label: 'Trimestriel' },
  { id: 'ANNUEL', label: 'Annuel' },
];

const UNITS = [
  { id: 'DECLARATION', label: 'Declarations validees' },
  { id: 'UNITE', label: 'Articles vendus / livres' },
  { id: 'LIVRAISON', label: 'Livraisons' },
  { id: 'CA', label: 'Chiffre d affaires (CDF)' },
];

const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

function emptyForm(year: number, month: number): CreateActivityObjectiveInput {
  return {
    userId: '',
    activityId: '',
    title: '',
    periodType: 'MENSUEL',
    year,
    month,
    quarter: Math.ceil(month / 3),
    targetValue: 10,
    unit: 'DECLARATION',
    notes: '',
  };
}

function periodLabel(row: ActivityObjective): string {
  if (row.periodType === 'ANNUEL') return String(row.year);
  if (row.periodType === 'TRIMESTRIEL') return `T${row.quarter ?? '?'} ${row.year}`;
  return `${MONTHS[(row.month ?? 1) - 1] ?? row.month} ${row.year}`;
}

function unitLabel(unit: string): string {
  return UNITS.find((u) => u.id === unit)?.label ?? unit;
}

export default function ObjectivesPage() {
  const { can } = usePermissions();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<ActivityObjective[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ActivityObjective | null>(null);
  const [form, setForm] = useState<CreateActivityObjectiveInput>(emptyForm(now.getFullYear(), now.getMonth() + 1));
  const [error, setError] = useState('');

  const activities = useMemo(
    () => functions.flatMap((fn) => (fn.activities ?? []).map((a) => ({ ...a, functionName: fn.name }))),
    [functions],
  );

  const load = () => api.getActivityObjectives({ year, month }).then(setRows);
  useEffect(() => {
    load().catch(() => setRows([]));
  }, [year, month]);

  useEffect(() => {
    api.getActivityObjectivesCatalog().then((c) => {
      setUsers(c.users);
      setFunctions(c.functions);
    }).catch(() => {
      setUsers([]);
      setFunctions([]);
    });
  }, []);

  const reached = rows.filter((r) => r.status === 'ATTEINT').length;
  const late = rows.filter((r) => r.status === 'EN_RETARD').length;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.progressPct, 0) / rows.length) : 0;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(year, month));
    setError('');
    setShowForm(true);
  };

  const openEdit = (row: ActivityObjective) => {
    setEditing(row);
    setForm({
      userId: row.userId,
      activityId: row.activityId,
      title: row.title,
      periodType: row.periodType,
      year: row.year,
      month: row.month ?? month,
      quarter: row.quarter ?? Math.ceil(month / 3),
      targetValue: Number(row.targetValue),
      unit: row.unit,
      notes: row.notes ?? '',
    });
    setError('');
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload: CreateActivityObjectiveInput = {
      ...form,
      title: form.title.trim(),
      month: form.periodType === 'MENSUEL' ? form.month : null,
      quarter: form.periodType === 'TRIMESTRIEL' ? form.quarter : null,
      notes: form.notes?.trim() || undefined,
    };
    try {
      if (editing) await api.updateActivityObjective(editing.id, payload);
      else await api.createActivityObjective(payload);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d enregistrer l objectif');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Objectifs de performance"
        subtitle="Cibles chiffrees par agent et par activite de fonction, avec suivi du realise"
        actions={
          <>
            <DocButton label="Imprimer les objectifs" onClick={() => printActivityObjectivesList(rows)} />
            {can('objectives', 'create') && (
              <button type="button" className="erp-btn" onClick={openCreate}>+ Nouvel objectif</button>
            )}
          </>
        }
      />
      <div className="erp-kpi-row">
        <div className="erp-kpi"><div className="erp-kpi-label">Objectifs</div><div className="erp-kpi-value">{rows.length}</div></div>
        <div className="erp-kpi"><div className="erp-kpi-label">Atteints</div><div className="erp-kpi-value">{reached}</div></div>
        <div className="erp-kpi"><div className="erp-kpi-label">En retard</div><div className="erp-kpi-value">{late}</div></div>
        <div className="erp-kpi"><div className="erp-kpi-label">Avancement moyen</div><div className="erp-kpi-value">{avg} %</div></div>
      </div>
      <ErpPanel title="Periode">
        <div className="form-row">
          <div className="form-group">
            <label>Annee</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Mois</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
            </select>
          </div>
        </div>
      </ErpPanel>
      <ErpPanel title={`Objectifs (${rows.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Activite</th>
              <th>Objectif</th>
              <th>Periode</th>
              <th>Cible</th>
              <th>Realise</th>
              <th>Avancement</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.user ? `${r.user.firstName} ${r.user.lastName}` : r.userId}</td>
                <td>
                  <strong>{r.activity?.name ?? '—'}</strong>
                  {r.activity?.jobFunction?.name ? <div className="erp-muted">{r.activity.jobFunction.name}</div> : null}
                </td>
                <td>{r.title}</td>
                <td>{periodLabel(r)}</td>
                <td>{r.targetValue} {unitLabel(r.unit)}</td>
                <td>{r.actualValue}</td>
                <td>
                  <div className="erp-muted">{r.progressPct} %</div>
                  <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8, width: 120 }}>
                    <div style={{
                      background: r.status === 'ATTEINT' ? '#15803d' : r.status === 'EN_RETARD' ? '#b45309' : '#2563eb',
                      borderRadius: 4,
                      height: 8,
                      width: `${Math.min(100, r.progressPct)}%`,
                    }} />
                  </div>
                </td>
                <td><StatusPill status={r.status} /></td>
                <td className="erp-row-actions">
                  <DocButton label="Fiche" onClick={() => printActivityObjectiveSheet(r)} />
                  {can('objectives', 'update') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openEdit(r)}>Modifier</button>
                  )}
                  {can('objectives', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteActivityObjective(r.id).then(load)}>Cloturer</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={9} className="erp-table-empty">Aucun objectif pour cette periode.</td></tr>
            )}
          </tbody>
        </table>
      </ErpPanel>
      <Modal title={editing ? 'Modifier l objectif' : 'Nouvel objectif de performance'} open={showForm} onClose={() => setShowForm(false)}>
        <form className="form-stack" onSubmit={submit}>
          <div className="form-group">
            <label>Agent</label>
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Choisir un agent</option>
              {users.filter((u) => u.isActive !== false).map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Activite de fonction</label>
            <select value={form.activityId} onChange={(e) => setForm({ ...form, activityId: e.target.value })} required>
              <option value="">Choisir une activite</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>{a.functionName} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Intitule</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ex. Declarations de livraison" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Periodicite</label>
              <select value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
                {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Annee</label>
              <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} required />
            </div>
          </div>
          {form.periodType === 'MENSUEL' && (
            <div className="form-group">
              <label>Mois</label>
              <select value={form.month ?? month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
              </select>
            </div>
          )}
          {form.periodType === 'TRIMESTRIEL' && (
            <div className="form-group">
              <label>Trimestre</label>
              <select value={form.quarter ?? 1} onChange={(e) => setForm({ ...form, quarter: Number(e.target.value) })}>
                <option value={1}>T1</option>
                <option value={2}>T2</option>
                <option value={3}>T3</option>
                <option value={4}>T4</option>
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Unite de mesure</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Cible</label>
              <input type="number" min={0} step={0.01} value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Commentaire</label>
            <textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <p className="erp-muted">Le realise est calcule automatiquement : declarations validees, articles des tournees, livraisons ou chiffre d affaires selon l unite.</p>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">{editing ? 'Mettre a jour' : 'Creer'}</button>
        </form>
      </Modal>
    </div>
  );
}
