import { useEffect, useState, FormEvent } from 'react';
import { api, Order, Client, Product, CreateOrderInput, PricePreview, User, PaymentMethod } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import ClientSituationPanel from '../components/ClientSituationPanel';
import DocButton from '../components/DocButton';
import ProductSaleCard, { ProductSaleGrid } from '../components/ProductSaleCard';
import { printOrder, printOrdersList } from '../documents/templates';
import { sheetOrders } from '../excel/specs';

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
    emptiesReturned: 0,
    driverId: '',
    notes: '',
  });
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'ESPECES' as PaymentMethod, reference: '' });
  const [payError, setPayError] = useState('');
  const selectedProduct = products.find((p) => p.id === form.productId);

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
    if (!form.productId) {
      setError('Sélectionnez un produit');
      return;
    }
    setSaving(true);
    setError('');
    const payload: CreateOrderInput = {
      clientId: form.clientId,
      driverId: form.driverId || undefined,
      notes: form.notes || undefined,
      lines: [{
        productId: form.productId,
        quantity: form.quantity,
        ...(selectedProduct?.isReusable ? { emptiesReturned: form.emptiesReturned } : {}),
      }],
    };
    try {
      await api.createOrder(payload);
      setShowForm(false);
      setForm({ clientId: '', productId: '', quantity: 1, emptiesReturned: 0, driverId: '', notes: '' });
      await load();
    } catch {
      setError('Impossible de créer la commande');
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (order: Order) => {
    const remaining = Math.max(0, Number(order.totalAmount) - Number(order.paidAmount ?? 0));
    setPayForm({ amount: remaining, method: 'ESPECES', reference: '' });
    setPayError('');
    setPayOrder(order);
  };

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!payOrder?.clientId) return;
    setPayError('');
    try {
      await api.createPayment({
        clientId: payOrder.clientId,
        orderId: payOrder.id,
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
      });
      setPayOrder(null);
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Encaissement impossible');
    }
  };

  const applyAdvanceOnOrder = async (order: Order) => {
    try {
      await api.applyAdvance(order.id);
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Imputation impossible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Commandes"
        subtitle="Création et suivi des commandes clients"
        excel={{ filename: 'commandes', sheets: [sheetOrders(orders)] }}
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
              <th>Payé</th>
              <th>Reste</th>
              <th>Paiement</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const total = Number(o.totalAmount);
              const paid = Number(o.paidAmount ?? 0);
              const remaining = Math.max(0, total - paid);
              return (
              <tr key={o.id}>
                <td><strong>{o.orderNumber}</strong></td>
                <td>{o.client?.name ?? '—'}</td>
                <td>{total.toLocaleString('fr-FR')} CDF</td>
                <td>{paid.toLocaleString('fr-FR')} CDF</td>
                <td>{remaining > 0 ? `${remaining.toLocaleString('fr-FR')} CDF` : '—'}</td>
                <td><StatusPill status={o.paymentStatus ?? 'IMPAYEE'} /></td>
                <td><StatusPill status={o.status} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printOrder(o)} />
                  {can('payments', 'create') && remaining > 0 && o.status !== 'ANNULEE' && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => openPayment(o)}>
                      Acompte
                    </button>
                  )}
                  {can('payments', 'create') && remaining > 0 && o.clientId && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => applyAdvanceOnOrder(o)}>
                      Solder avance
                    </button>
                  )}
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
            );})}
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
          <ClientSituationPanel clientId={form.clientId} compact />
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
            <ProductSaleGrid>
              {products.map((p) => {
                const isSelected = form.productId === p.id;
                return (
                  <ProductSaleCard
                    key={p.id}
                    name={p.name}
                    code={p.code}
                    format={p.format}
                    imageUrl={p.imageUrl}
                    price={Number(p.unitPrice)}
                    quantity={isSelected ? form.quantity : 1}
                    min={1}
                    onQuantityChange={(q) => setForm({ ...form, productId: p.id, quantity: q })}
                    onAdd={() => setForm({ ...form, productId: p.id, quantity: isSelected ? form.quantity : 1 })}
                    addLabel={isSelected ? 'Sélectionné' : 'Choisir ce produit'}
                    selected={isSelected}
                    metaLabel="Livraison"
                    metaValue="Planifiée à la tournée suivante"
                  />
                );
              })}
            </ProductSaleGrid>
          </div>
          {preview && (
            <p className="erp-muted">
              Prix catalogue {preview.catalogPrice.toLocaleString('fr-FR')} CDF
              {' · '}
              Prix applique {preview.unitPrice.toLocaleString('fr-FR')} CDF
              {preview.bonusQuantity ? ` · Bonus ${preview.bonusQuantity} article${preview.bonusQuantity > 1 ? 's' : ''} offert${preview.bonusQuantity > 1 ? 's' : ''}` : ''}
              {preview.deliveredQuantity
                ? ` · ${preview.deliveredQuantity} articles livrés`
                : ''}
              {' · '}
              Ligne {preview.lineTotal.toLocaleString('fr-FR')} CDF
              {preview.ruleName ? ` (${preview.ruleName})` : ''}
            </p>
          )}
          {selectedProduct?.isReusable && (
            <div className="form-group">
              <label>Vidanges rendues</label>
              <input
                type="number"
                min={0}
                value={form.emptiesReturned}
                onChange={(e) => setForm({ ...form, emptiesReturned: Math.max(0, Number(e.target.value) || 0) })}
              />
              <p className="erp-muted">
                Un retour en surplus crée un avoir en contenants. Livraison prévue :{' '}
                {(form.quantity + (preview?.bonusQuantity ?? 0))} contenant(s).
              </p>
            </div>
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

      <Modal
        title={`Acompte — ${payOrder?.orderNumber ?? ''}`}
        open={Boolean(payOrder)}
        onClose={() => setPayOrder(null)}
      >
        <ClientSituationPanel clientId={payOrder?.clientId} compact />
        <form className="form-stack" onSubmit={submitPayment}>
          <p className="erp-muted">
            Versement partiel ou total sur cette commande. Le statut passera en « partielle » ou « soldée ».
          </p>
          <div className="form-group">
            <label>Montant (CDF)</label>
            <input
              type="number"
              min={0}
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
              required
            />
          </div>
          <div className="form-group">
            <label>Mode</label>
            <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PaymentMethod })}>
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
            </select>
          </div>
          {payError && <p className="error-msg">{payError}</p>}
          <button type="submit" className="erp-btn">Enregistrer l’acompte</button>
        </form>
      </Modal>
    </div>
  );
}

