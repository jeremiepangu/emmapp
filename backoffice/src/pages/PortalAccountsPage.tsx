import { FormEvent, useEffect, useState } from 'react';
import { api, Client, CreatePortalAccountInput, PortalAccount } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printPortalAccountsList, printPortalAccountSheet } from '../documents/templates';
import { sheetPortalAccounts } from '../excel/specs';

export default function PortalAccountsPage() {
  const { can } = usePermissions();
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<CreatePortalAccountInput>({ email: '', password: 'password123', fullName: '', clientId: '' });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.getPortalAccounts(), api.getClients()])
      .then(([a, c]) => { setAccounts(a); setClients(c); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api.createPortalAccount(form);
    setForm({ email: '', password: 'password123', fullName: '', clientId: form.clientId });
    load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Comptes portail client"
        subtitle="Accès self-service distinct des comptes internes — commande, suivi, consigne et fidélité"
        excel={{ filename: 'comptes-portail', sheets: [sheetPortalAccounts(accounts, can('portal', 'create'))], onImported: load }}
        actions={
          <>
            <DocButton label="Imprimer la liste" onClick={() => printPortalAccountsList(accounts)} />
            {can('portal', 'create') && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('portal-form')?.scrollIntoView({ behavior: 'smooth' })}>
                + Nouvel accès
              </button>
            )}
          </>
        }
      />
      {error && <p className="error-msg">{error}</p>}
      {can('portal', 'create') && (
        <ErpPanel title="Créer un accès" padded>
          <form id="portal-form" onSubmit={submit} className="form-row">
            <div className="form-group"><label>Nom</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="form-group">
              <label>Client</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                <option value="">Choisir…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Mot de passe</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Créer</button></div>
          </form>
        </ErpPanel>
      )}
      <ErpPanel title={`Comptes (${accounts.length})`}>
        <table className="erp-table">
          <thead><tr><th>Nom</th><th>Email</th><th>Client</th><th>Dernière connexion</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.fullName}</td>
                <td>{a.email}</td>
                <td>{a.client?.name ?? a.clientId}</td>
                <td>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('fr-FR') : '—'}</td>
                <td><StatusPill status={a.isActive ? 'ACTIF' : 'ANNULEE'} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printPortalAccountSheet(a)} />
                  {can('portal', 'update') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.updatePortalAccount(a.id, { isActive: !a.isActive }).then(load)}>
                      {a.isActive ? 'Désactiver' : 'Réactiver'}
                    </button>
                  )}
                  {can('portal', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deletePortalAccount(a.id).then(load)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
