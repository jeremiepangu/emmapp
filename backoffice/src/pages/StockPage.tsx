import { FormEvent, useEffect, useState } from 'react';
import { api, Product, StockItem, StockLocation, StockLocationType, Vehicle } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printInventory } from '../documents/templates';

const LOCATION_TYPES: { id: StockLocationType; label: string }[] = [
  { id: 'PRODUITS_FINIS', label: 'Produits finis' },
  { id: 'MATIERES_PREMIERES', label: 'Matières premières' },
  { id: 'PRODUCTION', label: 'Production' },
  { id: 'BIDONS_A_TRIER', label: 'Bidons à trier' },
  { id: 'BIDONS_LAVAGE', label: 'Bidons lavage' },
  { id: 'BIDONS_LIBERES', label: 'Bidons libérés' },
  { id: 'VEHICULE', label: 'Véhicule' },
  { id: 'QUARANTAINE', label: 'Quarantaine' },
  { id: 'RETRAITEMENT', label: 'Retraitement' },
  { id: 'REPARATION', label: 'Réparation' },
  { id: 'REBUT', label: 'Rebut' },
];

const emptyLoc = { code: '', name: '', type: 'PRODUITS_FINIS' as StockLocationType, vehicleId: '' };

export default function StockPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState({ productId: '', locationId: '', quantity: 0, lotNumber: '' });
  const [locForm, setLocForm] = useState(emptyLoc);
  const [editingLoc, setEditingLoc] = useState<StockLocation | null>(null);
  const [locError, setLocError] = useState('');

  const load = () => api.getStock().then(setItems);
  const loadLocations = () => api.getStockLocations().then(setLocations);
  useEffect(() => {
    load();
    api.getProducts().then(setProducts);
    loadLocations();
    api.getVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  const adjust = async (e: FormEvent) => {
    e.preventDefault();
    await api.adjustStock({
      productId: form.productId,
      locationId: form.locationId,
      quantity: Number(form.quantity),
      lotNumber: form.lotNumber || undefined,
    });
    await load();
  };

  const saveLocation = async (e: FormEvent) => {
    e.preventDefault();
    setLocError('');
    try {
      const payload = {
        code: locForm.code,
        name: locForm.name,
        type: locForm.type,
        vehicleId: locForm.type === 'VEHICULE' ? locForm.vehicleId || undefined : undefined,
      };
      if (editingLoc) await api.updateStockLocation(editingLoc.id, payload);
      else await api.createStockLocation(payload);
      setLocForm(emptyLoc);
      setEditingLoc(null);
      await loadLocations();
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Emplacement impossible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Stocks"
        subtitle="Produits finis, emplacements, ajustements et stock embarqué"
        actions={
          <>
            <DocButton label="État d'inventaire" onClick={() => printInventory(items)} />
            {can('stock', 'create') && (
              <>
                <button type="button" className="erp-btn" onClick={() => document.getElementById('stock-adjust')?.scrollIntoView({ behavior: 'smooth' })}>
                  + Ajuster
                </button>
                <button type="button" className="erp-btn erp-btn--ghost" onClick={() => document.getElementById('stock-location')?.scrollIntoView({ behavior: 'smooth' })}>
                  + Emplacement
                </button>
              </>
            )}
          </>
        }
      />
      {can('stock', 'create') && (
        <ErpPanel title="Ajuster le stock" padded>
          <form id="stock-adjust" className="form-row" onSubmit={adjust}>
            <div className="form-group">
              <label>Produit</label>
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
                <option value="">—</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Emplacement</label>
              <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} required>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Quantité (+/-)</label><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required /></div>
            <div className="form-group"><label>Lot</label><input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Ajuster</button></div>
          </form>
        </ErpPanel>
      )}
      <ErpPanel title={`Emplacements (${locations.length})`} padded>
        {can('stock', 'create') && (
          <form id="stock-location" className="form-row" onSubmit={saveLocation}>
            <div className="form-group"><label>Code</label><input value={locForm.code} onChange={(e) => setLocForm({ ...locForm, code: e.target.value })} required disabled={!!editingLoc} /></div>
            <div className="form-group"><label>Nom</label><input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} required /></div>
            <div className="form-group">
              <label>Type</label>
              <select value={locForm.type} onChange={(e) => setLocForm({ ...locForm, type: e.target.value as StockLocationType })}>
                {LOCATION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            {locForm.type === 'VEHICULE' && (
              <div className="form-group">
                <label>Véhicule</label>
                <select value={locForm.vehicleId} onChange={(e) => setLocForm({ ...locForm, vehicleId: e.target.value })}>
                  <option value="">—</option>
                  {vehicles.filter((v) => v.isActive !== false).map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button type="submit" className="erp-btn erp-btn--sm">{editingLoc ? 'Mettre à jour' : 'Ajouter'}</button>
              {editingLoc && (
                <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => { setEditingLoc(null); setLocForm(emptyLoc); }}>Annuler</button>
              )}
            </div>
          </form>
        )}
        {locError && <p className="error-msg">{locError}</p>}
        <table className="erp-table">
          <thead>
            <tr><th>Code</th><th>Nom</th><th>Type</th><th>Véhicule</th><th></th></tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td><code>{l.code}</code></td>
                <td>{l.name}</td>
                <td>{LOCATION_TYPES.find((t) => t.id === l.type)?.label ?? l.type}</td>
                <td>{l.vehicle ? `${l.vehicle.plate} — ${l.vehicle.name}` : '—'}</td>
                <td className="erp-row-actions">
                  {can('stock', 'update') && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => {
                        setEditingLoc(l);
                        setLocForm({
                          code: l.code,
                          name: l.name,
                          type: l.type,
                          vehicleId: l.vehicleId ?? '',
                        });
                      }}
                    >
                      Modifier
                    </button>
                  )}
                  {can('stock', 'delete') && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => api.deleteStockLocation(l.id).then(loadLocations).catch((err) => setLocError(err.message))}
                    >
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <ErpPanel title={`Inventaire (${items.length} lignes)`}>
        <table className="erp-table">
          <thead>
            <tr><th>Produit</th><th>Emplacement</th><th>Lot</th><th>Quantité</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.product.name}</strong></td>
                <td>{item.location.name}</td>
                <td>{item.lotNumber ?? '—'}</td>
                <td>
                  {can('stock', 'update') ? (
                    <input
                      type="number"
                      defaultValue={item.quantity}
                      style={{ width: 80 }}
                      onBlur={(e) => {
                        const qty = Number(e.target.value);
                        if (qty !== item.quantity) api.updateStockQuantity(item.id, qty).then(load);
                      }}
                    />
                  ) : (
                    <strong>{item.quantity}</strong>
                  )}
                  {item.quantity < 50 && <StatusPill status="ALERTE" label="Stock bas" />}
                </td>
                <td>
                  {can('stock', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteStockItem(item.id).then(load)}>Supprimer</button>
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
