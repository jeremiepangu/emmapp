import { FormEvent, useEffect, useState } from 'react';
import { api, Product, StockItem } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function StockPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [form, setForm] = useState({ productId: '', locationId: '', quantity: 0, lotNumber: '' });

  const load = () => api.getStock().then(setItems);
  useEffect(() => {
    load();
    api.getProducts().then(setProducts);
    api.getStockLocations().then(setLocations);
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

  return (
    <div className="erp-page">
      <ErpPageHeader title="Stocks" subtitle="Produits finis, ajustements et stock embarqué" />
      {can('stock', 'create') && (
        <ErpPanel title="Ajuster le stock" padded>
          <form className="form-row" onSubmit={adjust}>
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
