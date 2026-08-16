import { useEffect, useState, FormEvent } from 'react';
import { api, User } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ROLE_LABELS } from '../permissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';

const ROLES = Object.keys(ROLE_LABELS);

export default function UsersPage() {
  const { can } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: 'password123',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'COMMERCIAL',
  });

  const load = () => api.getUsers().then(setUsers);

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createUser(form);
      setShowForm(false);
      setForm({ email: '', password: 'password123', firstName: '', lastName: '', phone: '', role: 'COMMERCIAL' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    await api.updateUser(u.id, { isActive: !u.isActive });
    await load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Utilisateurs"
        subtitle="Gestion des comptes et rôles CRUDVN"
        actions={
          can('users', 'create') ? (
            <button type="button" className="erp-btn" onClick={() => setShowForm(true)}>+ Nouvel utilisateur</button>
          ) : undefined
        }
      />
      <ErpPanel title={`Comptes (${users.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Nom</th><th>Email</th><th>Profil</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.firstName} {u.lastName}</strong></td>
                <td>{u.email}</td>
                <td><StatusPill status="PLANIFIEE" label={ROLE_LABELS[u.role] ?? u.role} /></td>
                <td>{u.phone ?? '—'}</td>
                <td><StatusPill status={u.isActive ? 'CONFORME' : 'ANNULEE'} label={u.isActive ? 'Actif' : 'Inactif'} /></td>
                <td>
                  {can('users', 'update') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                  )}
                  {can('users', 'delete') && u.isActive && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteUser(u.id).then(load)}>
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      <Modal title="Nouvel utilisateur" open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-row">
            <div className="form-group"><label>Prénom</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div className="form-group"><label>Nom</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
          </div>
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="form-group"><label>Mot de passe</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="form-group">
            <label>Profil</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <button type="submit" className="erp-btn" disabled={saving}>{saving ? 'Création...' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  );
}
