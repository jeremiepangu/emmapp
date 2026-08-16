import { useEffect, useState, FormEvent } from 'react';
import { api, Order, Client, Product, CreateOrderInput, PricePreview, User } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printOrder, printOrdersList } from '../documents/templates';

export default function OrdersPage() {
  const { can } = usePermissions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    clientId: '',
    productId: '',
    quantity: 1,
    driverId: '',
    notes: '',
  });
  const [preview, setPreview] = useState<PricePreview | null>(null);

  const load = () => api.getOrders().then(setOrders);

  useEffect(() => {
    load();
    api.getClients().then(setClients);
    api.getProducts().then(setProducts);
    Promise.all([
      api.getUsersByRole('LIVREUR').catch(() => [] as User[]),
      api.getUsersByRole('CHARGE_LIVRAISON').catch(() => [] as User[]),
    ]).then(([a, b]) => setDrivers([...a, ...b]));
  }, []);

  useEffect(() => {
    if (!form.clientId || !form.productId || form.quantity < 1) {
      setPreview(null);
      return;
    }
    api.previewPrice(form.clientId, form.productId, form.quantity, form.driverId || undefined)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [form.clientId, form.productId, form.quantity, form.driverId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload: CreateOrderInput = {
      clientId: form.clientId,
      driverId: form.driverId || undefined,
      notes: form.notes || undefined,
      lines: [{ productId: form.productId, quantity: form.quantity }],
    };
    try {
      await api.createOrder(payload);
      setShowForm(false);
      setForm({ clientId: '', productId: '', quantity: 1, driverId: '', notes: '' });
      await load();
    } catch {
      setError('Impossible de créer la commande');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Commandes"
        subtitle="Création et suivi des commandes clients"
        actions={
          <>
            <DocButton label="Imprimer la liste" onClick={() => printOrdersList(orders)} />
            {can('orders', 'create') && (
              <button type="button" className="erp-btn" onClick={() => setShowForm(true)}>
                + Nouvelle commande
              </button>
            )}
          </>
        }
      />
      <ErpPanel title={`Historique (${orders.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>N° Commande</th>
              <th>Client</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.orderNumber}</strong></td>
                <td>{o.client?.name ?? '—'}</td>
                <td>{Number(o.totalAmount).toLocaleString('fr-FR')} CDF</td>
                <td><StatusPill status={o.status} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printOrder(o)} />
                  {can('orders', 'validate') && o.status === 'BROUILLON' && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateOrder(o.id).then(load)}>Valider</button>
                  )}
                  {can('orders', 'update') && o.status !== 'LIVREE' && o.status !== 'ANNULEE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.cancelOrder(o.id).then(load)}>Annuler</button>
                  )}
                  {can('orders', 'delete') && o.status !== 'LIVREE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteOrder(o.id).then(load)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      <Modal title="Nouvelle commande" open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label>Client</label>
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
              <option value="">— Choisir —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Livreur (tarif préférentiel)</label>
            <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">— Aucun —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Produit</label>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">— Choisir —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {Number(p.unitPrice).toLocaleString('fr-FR')} CDF</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Quantité</label>
            <input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required />
          </div>
          {preview && (
            <p className="erp-muted">
              Prix catalogue {preview.catalogPrice.toLocaleString('fr-FR')} CDF
              {' · '}
              Prix applique {preview.unitPrice.toLocaleString('fr-FR')} CDF
              {preview.discountPct > 0 ? ` · Remise ${preview.discountPct} %` : ''}
              {' · '}
              Ligne {preview.lineTotal.toLocaleString('fr-FR')} CDF
              {preview.ruleName ? ` (${preview.ruleName})` : ''}
            </p>
          )}
          <div className="form-group">
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Créer la commande'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

