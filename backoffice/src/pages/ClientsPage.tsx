import { FormEvent, useEffect, useState } from 'react';
import { api, Client, ClientSegment, CreateClientInput } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import SavedViewsBar from '../components/SavedViewsBar';

const SEGMENTS: ClientSegment[] = ['PARTICULIER', 'BOUTIQUE', 'DETAILLANT', 'SUPERMARCHE', 'ENTREPRISE', 'HOTEL_RESTAURANT'];

const empty: CreateClientInput = { code: '', name: '', segment: 'DETAILLANT', zone: '', phone: '', consigneLimit: 50 };

export default function ClientsPage() {
  const { can } = usePermissions();
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateClientInput>(empty);

  const load = () => api.getClients().then(setClients);
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setShowForm(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ code: c.code, name: c.name, segment: c.segment as ClientSegment, zone: c.zone ?? '', phone: c.phone ?? '', consigneLimit: c.consigneLimit });
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) await api.updateClient(editing.id, form);
      else await api.createClient(form);
      setShowForm(false);
      await load();
    } catch {
      setError('Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Clients"
        subtitle="Gestion des clients et consignes"
        actions={can('clients', 'create') ? <button type="button" className="erp-btn" onClick={openCreate}>+ Nouveau client</button> : undefined}
      />
      <SavedViewsBar resource="clients" onApply={() => undefined} />
      <ErpPanel title={`Liste des clients (${clients.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Code</th><th>Nom</th><th>Segment</th><th>Zone</th><th>Téléphone</th><th>Consignes</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>{c.name}</td>
                <td><StatusPill status={c.segment} label={c.segment} /></td>
                <td>{c.zone ?? '—'}</td>
                <td>{c.phone ?? '—'}</td>
                <td>
                  {c.consigneBalance} / {c.consigneLimit}
                  {c.consigneBalance > c.consigneLimit * 0.8 && <StatusPill status="ALERTE" label="Proche plafond" />}
                </td>
                <td className="erp-row-actions">
                  {can('clients', 'update') && <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openEdit(c)}>Modifier</button>}
                  {can('clients', 'delete') && <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteClient(c.id).then(load)}>Désactiver</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <Modal title={editing ? 'Modifier le client' : 'Nouveau client'} open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} /></div>
          <div className="form-group"><label>Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group">
            <label>Segment</label>
            <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as ClientSegment })}>
              {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Zone</label><input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></div>
            <div className="form-group"><label>Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Plafond consignes</label><input type="number" value={form.consigneLimit} onChange={(e) => setForm({ ...form, consigneLimit: Number(e.target.value) })} /></div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn" disabled={saving}>{saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer le client'}</button>
        </form>
      </Modal>
    </div>
  );
}
