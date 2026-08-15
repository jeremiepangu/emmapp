import { FormEvent, useEffect, useState } from 'react';
import { api, ApiKeyInfo, WebhookDelivery, WebhookSubscription } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

const EVENTS = [
  'commande.creee',
  'commande.validee',
  'livraison.effectuee',
  'paiement.enregistre',
  'lot.libere',
  'cotation.recue',
];

export default function IntegrationsPage() {
  const { can } = usePermissions();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [hooks, setHooks] = useState<WebhookSubscription[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [createdKey, setCreatedKey] = useState<string>('');
  const [keyForm, setKeyForm] = useState({ label: '', partner: '', scopes: 'catalogue' });
  const [hookForm, setHookForm] = useState({ label: '', url: '', events: 'commande.creee' });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.getApiKeys(), api.getWebhooks()])
      .then(([k, h]) => { setKeys(k); setHooks(h); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const createKey = async (e: FormEvent) => {
    e.preventDefault();
    const result = await api.createApiKey({
      label: keyForm.label,
      partner: keyForm.partner,
      scopes: keyForm.scopes.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setCreatedKey(result.key);
    setKeyForm({ label: '', partner: '', scopes: 'catalogue' });
    load();
  };

  const createHook = async (e: FormEvent) => {
    e.preventDefault();
    await api.createWebhook({
      label: hookForm.label,
      url: hookForm.url,
      events: hookForm.events.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setHookForm({ label: '', url: '', events: 'commande.creee' });
    load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="API publique & webhooks"
        subtitle="Clés partenaires, événements métier et intégration des opérateurs de monnaie électronique"
      />
      {error && <p className="error-msg">{error}</p>}
      {createdKey && (
        <p className="erp-success">
          Clé générée — copiez-la maintenant, elle ne sera plus affichée : <code>{createdKey}</code>
        </p>
      )}

      {can('integrations', 'create') && (
        <div className="erp-split">
          <ErpPanel title="Nouvelle clé API" padded>
            <form onSubmit={createKey} className="form-row">
              <div className="form-group"><label>Libellé</label><input value={keyForm.label} onChange={(e) => setKeyForm({ ...keyForm, label: e.target.value })} required /></div>
              <div className="form-group"><label>Partenaire</label><input value={keyForm.partner} onChange={(e) => setKeyForm({ ...keyForm, partner: e.target.value })} required /></div>
              <div className="form-group"><label>Périmètres</label><input value={keyForm.scopes} onChange={(e) => setKeyForm({ ...keyForm, scopes: e.target.value })} /></div>
              <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Créer</button></div>
            </form>
          </ErpPanel>
          <ErpPanel title="Nouvel abonnement webhook" padded>
            <form onSubmit={createHook} className="form-row">
              <div className="form-group"><label>Libellé</label><input value={hookForm.label} onChange={(e) => setHookForm({ ...hookForm, label: e.target.value })} required /></div>
              <div className="form-group"><label>URL</label><input value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} required /></div>
              <div className="form-group"><label>Événements</label><input value={hookForm.events} onChange={(e) => setHookForm({ ...hookForm, events: e.target.value })} /></div>
              <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Abonner</button></div>
            </form>
            <p className="erp-muted">Événements : {EVENTS.join(', ')}</p>
          </ErpPanel>
        </div>
      )}

      <ErpPanel title="Clés">
        <table className="erp-table">
          <thead><tr><th>Libellé</th><th>Partenaire</th><th>Préfixe</th><th>Périmètres</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.label}</td>
                <td>{k.partner}</td>
                <td><code>{k.keyPrefix}</code></td>
                <td>{k.scopes.join(', ')}</td>
                <td><StatusPill status={k.isActive ? 'ACTIF' : 'ANNULEE'} /></td>
                <td>
                  {can('integrations', 'delete') && k.isActive && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.revokeApiKey(k.id).then(load)}>Révoquer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      <ErpPanel title="Webhooks">
        <table className="erp-table">
          <thead><tr><th>Libellé</th><th>URL</th><th>Événements</th><th>Livraisons</th><th></th></tr></thead>
          <tbody>
            {hooks.map((h) => (
              <tr key={h.id}>
                <td>{h.label}</td>
                <td><code>{h.url}</code></td>
                <td>{h.events.join(', ')}</td>
                <td>{h.deliveriesCount ?? 0}</td>
                <td>
                  {can('integrations', 'create') && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.testWebhook(h.id).then((d) => setDeliveries([d, ...deliveries]))}>Tester</button>
                  )}
                  <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.getWebhookDeliveries(h.id).then(setDeliveries)}>Journal</button>
                  {can('integrations', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteWebhook(h.id).then(load)}>Retirer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      {!!deliveries.length && (
        <ErpPanel title="Livraisons webhook">
          <table className="erp-table">
            <thead><tr><th>Événement</th><th>HTTP</th><th>Tentatives</th><th>Erreur</th><th>Quand</th></tr></thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.event}</td>
                  <td>{d.statusCode ?? '—'}</td>
                  <td>{d.attempts}</td>
                  <td>{d.error ?? '—'}</td>
                  <td>{new Date(d.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      )}
    </div>
  );
}
