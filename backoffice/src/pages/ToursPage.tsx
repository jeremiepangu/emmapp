import { useEffect, useState, FormEvent } from 'react';
import { api, Tour, User, Vehicle, Order, LoadSheet } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printTourSheet, printToursList } from '../documents/templates';
import { sheetTours } from '../excel/specs';

const emptyForm = {
  zone: '',
  date: new Date().toISOString().slice(0, 10),
  driverId: '',
  vehicleId: '',
  orderIds: [] as string[],
};

type LoadItem = { productId: string; quantity: number; name: string };

/** Agrège les quantités commandées (bonus inclus) par produit pour le bordereau. */
function aggregateLoadItems(tour: Tour): LoadItem[] {
  const map = new Map<string, LoadItem>();
  for (const order of tour.orders ?? []) {
    for (const line of order.lines ?? []) {
      const productId = line.productId;
      const bonus = Number(line.bonusQuantity ?? line.bonus ?? 0);
      const qty = line.quantity + bonus;
      const name = line.product?.name ?? productId;
      const prev = map.get(productId);
      if (prev) prev.quantity += qty;
      else map.set(productId, { productId, quantity: qty, name });
    }
  }
  return Array.from(map.values());
}

function parseSheetItems(items: LoadSheet['items']): LoadItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      const productId = String(row.productId ?? row.product_id ?? '');
      const quantity = Number(row.quantity ?? row.qty ?? 0);
      const name = String(row.name ?? productId);
      if (!productId || !Number.isFinite(quantity)) return null;
      return { productId, quantity, name };
    })
    .filter((x): x is LoadItem => x !== null);
}

export default function ToursPage() {
  const { can } = usePermissions();
  const [tours, setTours] = useState<Tour[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tour | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [loadSheetTour, setLoadSheetTour] = useState<Tour | null>(null);
  const [loadItems, setLoadItems] = useState<LoadItem[]>([]);
  const [loadSaving, setLoadSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = () => api.getTours().then(setTours);

  useEffect(() => {
    load();
    api.getUsersByRole('LIVREUR').then(setDrivers);
    api.getVehicles().then(setVehicles);
    api.getOrders().then((list) => setOrders(list.filter((o) => o.status === 'VALIDEE')));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (t: Tour) => {
    setEditing(t);
    setForm({
      zone: t.zone,
      date: t.date.slice(0, 10),
      driverId: t.driver?.id ?? '',
      vehicleId: t.vehicle?.id ?? '',
      orderIds: t.orders?.map((o) => o.id) ?? [],
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        zone: form.zone,
        date: form.date,
        driverId: form.driverId,
        vehicleId: form.vehicleId,
        orderIds: form.orderIds,
      };
      if (editing) await api.updateTour(editing.id, payload);
      else await api.createTour(payload);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch {
      setError(editing ? 'Impossible de modifier la tournée' : 'Impossible de créer la tournée');
    } finally {
      setSaving(false);
    }
  };

  const toggleOrder = (id: string) => {
    setForm((f) => ({
      ...f,
      orderIds: f.orderIds.includes(id) ? f.orderIds.filter((x) => x !== id) : [...f.orderIds, id],
    }));
  };

  const activeVehicles = vehicles.filter((v) => v.isActive !== false);

  const openLoadSheet = (t: Tour) => {
    setLoadSheetTour(t);
    setLoadItems(aggregateLoadItems(t));
    setLoadError('');
  };

  const refreshLoadSheetTour = async () => {
    const list = await api.getTours();
    setTours(list);
    if (loadSheetTour) {
      const updated = list.find((t) => t.id === loadSheetTour.id);
      if (updated) setLoadSheetTour(updated);
    }
  };

  const handleCreateLoadSheet = async () => {
    if (!loadSheetTour || loadItems.length === 0) return;
    setLoadSaving(true);
    setLoadError('');
    try {
      await api.createLoadSheet(
        loadSheetTour.id,
        loadItems.map(({ productId, quantity }) => ({ productId, quantity })),
      );
      await refreshLoadSheetTour();
    } catch {
      setLoadError('Impossible de créer le bordereau de chargement');
    } finally {
      setLoadSaving(false);
    }
  };

  const handleValidateLoadSheet = async (sheetId: string, role: 'store' | 'driver') => {
    if (!loadSheetTour) return;
    setLoadSaving(true);
    setLoadError('');
    try {
      await api.validateLoadSheet(loadSheetTour.id, sheetId, role);
      await refreshLoadSheetTour();
    } catch {
      setLoadError('Validation impossible');
    } finally {
      setLoadSaving(false);
    }
  };

  const latestSheet = loadSheetTour?.loadSheets?.[loadSheetTour.loadSheets.length - 1];

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Tournées"
        subtitle="Planification et suivi des livraisons"
        excel={{ filename: 'tournees', sheets: [sheetTours(tours)] }}
        actions={
          <>
            <DocButton label="Imprimer la liste" onClick={() => printToursList(tours)} />
            {can('tours', 'create') && (
              <button type="button" className="erp-btn" onClick={openCreate}>+ Nouvelle tournée</button>
            )}
          </>
        }
      />
      <ErpPanel title={`Tournées planifiées (${tours.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>N° Tournée</th>
              <th>Zone</th>
              <th>Date</th>
              <th>Livreur</th>
              <th>Véhicule</th>
              <th>Commandes</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.tourNumber}</strong></td>
                <td>{t.zone}</td>
                <td>{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                <td>{t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '—'}</td>
                <td>{t.vehicle?.plate ?? '—'}</td>
                <td>{t.orders?.length ?? 0}</td>
                <td><StatusPill status={t.status} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printTourSheet(t)} />
                  {t.status !== 'TERMINEE' && t.status !== 'ANNULEE' && (can('tours', 'create') || can('tours', 'validate')) && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openLoadSheet(t)}>
                      Bordereau{t.loadSheets?.length ? ` (${t.loadSheets.length})` : ''}
                    </button>
                  )}
                  {can('tours', 'update') && t.status === 'PLANIFIEE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openEdit(t)}>Modifier</button>
                  )}
                  {can('tours', 'validate') && t.status === 'PLANIFIEE' && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.startTour(t.id).then(load)}>Démarrer</button>
                  )}
                  {can('tours', 'update') && t.status === 'EN_COURS' && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.completeTour(t.id).then(load)}>Clôturer</button>
                  )}
                  {can('tours', 'delete') && t.status !== 'TERMINEE' && t.status !== 'ANNULEE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.cancelTour(t.id).then(load)}>Annuler</button>
                  )}
                  {can('tours', 'delete') && t.status === 'PLANIFIEE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteTour(t.id).then(load)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      <Modal title={editing ? 'Modifier la tournée' : 'Nouvelle tournée'} open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-row">
            <div className="form-group">
              <label>Zone</label>
              <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Livreur</label>
            <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required>
              <option value="">— Choisir —</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Véhicule</label>
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
              <option value="">— Choisir —</option>
              {activeVehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.name}</option>)}
            </select>
          </div>
          {orders.length > 0 && (
            <div className="form-group">
              <label>Commandes à inclure</label>
              <div className="checkbox-list">
                {orders.map((o) => (
                  <label key={o.id} className="checkbox-item">
                    <input type="checkbox" checked={form.orderIds.includes(o.id)} onChange={() => toggleOrder(o.id)} />
                    {o.orderNumber} — {o.client?.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn" disabled={saving}>
            {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer la tournée'}
          </button>
        </form>
      </Modal>

      <Modal
        title={loadSheetTour ? `Bordereau — ${loadSheetTour.tourNumber}` : 'Bordereau de chargement'}
        open={loadSheetTour !== null}
        onClose={() => setLoadSheetTour(null)}
      >
        {loadSheetTour && (
          <div className="form-stack">
            {loadSheetTour.loadSheets && loadSheetTour.loadSheets.length > 0 && (
              <div className="form-group">
                <label>Bordereaux existants</label>
                {loadSheetTour.loadSheets.map((sheet) => (
                  <div key={sheet.id} className="erp-panel" style={{ marginBottom: 8, padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <StatusPill status={sheet.validatedByStore ? 'VALIDEE' : 'PLANIFIEE'} label={sheet.validatedByStore ? 'Magasin OK' : 'Magasin en attente'} />
                      <StatusPill status={sheet.validatedByDriver ? 'VALIDEE' : 'PLANIFIEE'} label={sheet.validatedByDriver ? 'Chauffeur OK' : 'Chauffeur en attente'} />
                      <span className="erp-muted">{new Date(sheet.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                    <table className="erp-table erp-table--compact">
                      <thead><tr><th>Produit</th><th>Qté chargée</th></tr></thead>
                      <tbody>
                        {parseSheetItems(sheet.items).map((item) => (
                          <tr key={`${sheet.id}-${item.productId}`}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="erp-row-actions" style={{ marginTop: 8 }}>
                      {can('tours', 'create') && !sheet.validatedByStore && (
                        <button type="button" className="erp-btn erp-btn--sm" disabled={loadSaving} onClick={() => handleValidateLoadSheet(sheet.id, 'store')}>
                          Valider magasin
                        </button>
                      )}
                      {can('tours', 'validate') && !sheet.validatedByDriver && (
                        <button type="button" className="erp-btn erp-btn--sm" disabled={loadSaving} onClick={() => handleValidateLoadSheet(sheet.id, 'driver')}>
                          Valider chauffeur
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {can('tours', 'create') && loadSheetTour.status === 'PLANIFIEE' && (
              <>
                <p className="erp-muted">
                  Quantités prévues à charger (éditables avant création). Le rapprochement à l&apos;écarts utilise ce bordereau.
                </p>
                {loadItems.length === 0 ? (
                  <p>Aucune ligne commandée sur cette tournée.</p>
                ) : (
                  <table className="erp-table">
                    <thead><tr><th>Produit</th><th>Qté à charger</th></tr></thead>
                    <tbody>
                      {loadItems.map((item, idx) => (
                        <tr key={item.productId}>
                          <td>{item.name}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = Math.max(0, Number(e.target.value) || 0);
                                setLoadItems((rows) => rows.map((r, i) => (i === idx ? { ...r, quantity: qty } : r)));
                              }}
                              style={{ width: 80 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <button type="button" className="erp-btn" disabled={loadSaving || loadItems.length === 0} onClick={handleCreateLoadSheet}>
                  {loadSaving ? 'Enregistrement…' : latestSheet ? 'Nouveau bordereau' : 'Créer le bordereau'}
                </button>
              </>
            )}

            {loadError && <p className="error-msg">{loadError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
