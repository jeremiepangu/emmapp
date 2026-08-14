import { useEffect, useState, FormEvent } from 'react';
import { api, Client, CreateClientInput, ClientSegment } from '../api';
import Modal from '../components/Modal';

const SEGMENTS: ClientSegment[] = ['PARTICULIER', 'DETAILLANT', 'ENTREPRISE', 'SUPERMARCHE'];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateClientInput>({
    code: '',
    name: '',
    segment: 'DETAILLANT',
    zone: '',
    phone: '',
    consigneLimit: 50,
  });

  const load = () => api.getClients().then(setClients);

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createClient(form);
      setShowForm(false);
      setForm({ code: '', name: '', segment: 'DETAILLANT', zone: '', phone: '', consigneLimit: 50 });
      await load();
    } catch {
      setError('Impossible de créer le client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header page-header-row">
        <div>
          <h2>Clients</h2>
          <p>Gestion des clients et consignes</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nouveau client
        </button>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Segment</th>
              <th>Zone</th>
              <th>Téléphone</th>
              <th>Consignes</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td><span className="badge badge-info">{c.segment}</span></td>
                <td>{c.zone ?? '-'}</td>
                <td>{c.phone ?? '-'}</td>
                <td>
                  {c.consigneBalance} / {c.consigneLimit}
                  {c.consigneBalance > c.consigneLimit * 0.8 && (
                    <span className="badge badge-warning" style={{ marginLeft: 8 }}>Proche plafond</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Nouveau client" open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label>Code</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Segment</label>
            <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as ClientSegment })}>
              {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Zone</label>
              <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Plafond consignes</label>
            <input type="number" value={form.consigneLimit} onChange={(e) => setForm({ ...form, consigneLimit: Number(e.target.value) })} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Créer le client'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
