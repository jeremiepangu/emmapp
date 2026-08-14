import { useEffect, useState, FormEvent } from 'react';
import { api, Order, Client, Product, CreateOrderInput } from '../api';
import Modal from '../components/Modal';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    clientId: '',
    productId: '',
    quantity: 1,
    notes: '',
  });

  const load = () => api.getOrders().then(setOrders);

  useEffect(() => {
    load();
    api.getClients().then(setClients);
    api.getProducts().then(setProducts);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload: CreateOrderInput = {
      clientId: form.clientId,
      notes: form.notes || undefined,
      lines: [{ productId: form.productId, quantity: form.quantity }],
    };
    try {
      await api.createOrder(payload);
      setShowForm(false);
      setForm({ clientId: '', productId: '', quantity: 1, notes: '' });
      await load();
    } catch {
      setError('Impossible de créer la commande');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header page-header-row">
        <div>
          <h2>Commandes</h2>
          <p>Prise de commande et validation</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nouvelle commande
        </button>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>N° Commande</th>
              <th>Client</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>{o.client?.name ?? '-'}</td>
                <td>{Number(o.totalAmount).toLocaleString('fr-FR')} CDF</td>
                <td>
                  <span className="badge badge-success">{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          <div className="form-group">
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Créer la commande'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
