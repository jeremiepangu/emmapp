import { useEffect, useState, FormEvent } from 'react';

import { api, ProductionOrder } from '../api';

import { usePermissions } from '../hooks/usePermissions';

import { ErpPageHeader, ErpPanel } from '../components/ErpUi';

import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printProductionList, printProductionOrder } from '../documents/templates';
import { sheetProduction } from '../excel/specs';



export default function ProductionPage() {

  const { can } = usePermissions();

  const [orders, setOrders] = useState<ProductionOrder[]>([]);

  const [form, setForm] = useState({ productFormat: 'BONBONNE_19L', lineCode: 'L1', plannedQty: 100 });

  const [saving, setSaving] = useState(false);



  const load = () => api.getProductionOrders().then(setOrders);



  useEffect(() => { load(); }, []);



  const handleSubmit = async (e: FormEvent) => {

    e.preventDefault();

    setSaving(true);

    await api.createProductionOrder(form);

    setSaving(false);

    await load();

  };



  return (

    <div className="erp-page">

      <ErpPageHeader

        title="Production"
        excel={{ filename: 'fabrication', sheets: [sheetProduction(orders, can('production', 'create'))], onImported: load }}

        subtitle="Ordres de fabrication et traçabilité lots (format LOT-AAAAMMJJ-LIGNE-FORMAT)"

        actions={
          <>
            <DocButton label="Imprimer le registre" onClick={() => printProductionList(orders)} />
            {can('production', 'create') && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('production-form')?.scrollIntoView({ behavior: 'smooth' })}>
                + Nouvel ordre
              </button>
            )}
          </>
        }

      />

      {can('production', 'create') && (

        <ErpPanel title="Nouvel ordre de fabrication" padded>

          <form id="production-form" onSubmit={handleSubmit} className="form-row">

            <div className="form-group">

              <label>Format</label>

              <select value={form.productFormat} onChange={(e) => setForm({ ...form, productFormat: e.target.value })}>

                <option value="BIDON_5L">Bidon 5L</option>

                <option value="BIDON_10L">Bidon 10L</option>

                <option value="BIDON_25L">Bidon 25L</option>

                <option value="BONBONNE_19L">Bonbonne 19L</option>

              </select>

            </div>

            <div className="form-group">

              <label>Ligne</label>

              <input value={form.lineCode} onChange={(e) => setForm({ ...form, lineCode: e.target.value })} required />

            </div>

            <div className="form-group">

              <label>Quantité planifiée</label>

              <input type="number" min={1} value={form.plannedQty} onChange={(e) => setForm({ ...form, plannedQty: Number(e.target.value) })} required />

            </div>

            <div className="form-group" style={{ alignSelf: 'end' }}>

              <button type="submit" className="erp-btn" disabled={saving}>Créer OF</button>

            </div>

          </form>

        </ErpPanel>

      )}

      <ErpPanel title={`Ordres de fabrication (${orders.length})`}>

        <table className="erp-table">

          <thead>

            <tr>

              <th>OF</th>

              <th>Lot</th>

              <th>Format</th>

              <th>Planifié</th>

              <th>Produit</th>

              <th>Statut lot</th>

              <th>Actions</th>

            </tr>

          </thead>

          <tbody>

            {orders.map((o) => (

              <tr key={o.id}>

                <td><strong>{o.orderNumber}</strong></td>

                <td><code>{o.lotNumber}</code></td>

                <td>{o.productFormat}</td>

                <td>{o.plannedQty}</td>

                <td>
                  {can('production', 'update') && o.lotStatus !== 'LIBERE' ? (
                    <input
                      type="number"
                      defaultValue={o.producedQty}
                      style={{ width: 80 }}
                      onBlur={(e) => {
                        const qty = Number(e.target.value);
                        if (qty !== o.producedQty) api.updateProductionOrder(o.id, { producedQty: qty }).then(load);
                      }}
                    />
                  ) : (
                    o.producedQty
                  )}
                </td>

                <td><StatusPill status={o.lotStatus} /></td>

                <td className="erp-row-actions">

                  <DocButton onClick={() => printProductionOrder(o)} />

                  {can('production', 'validate') && o.lotStatus !== 'LIBERE' && (

                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.validateProductionOrder(o.id).then(load)}>

                      Libérer lot

                    </button>

                  )}

                  {can('production', 'delete') && (

                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteProductionOrder(o.id).then(load)}>

                      Supprimer

                    </button>

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


