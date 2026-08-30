import { FormEvent, useEffect, useState } from 'react';
import { api, Product } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { EmmaFormatBadge } from '../components/EmmaBrand';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import ImageUploadField from '../components/ImageUploadField';
import ProductSaleCard, { ProductSaleGrid } from '../components/ProductSaleCard';
import { printProductSheet, printProductsCatalog } from '../documents/templates';
import { sheetProducts } from '../excel/specs';

const FORMATS = ['BIDON_5L', 'BIDON_10L', 'BIDON_25L', 'BONBONNE_19L'];

export default function ProductsPage() {
  const { can } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ code: '', name: '', format: 'BIDON_5L', unitPrice: 1500, isReusable: true, imageUrl: '' });
  const [preview, setPreview] = useState<Record<string, number>>({});

  const load = () => api.getProducts().then(setProducts);
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...form, imageUrl: form.imageUrl || null };
    if (editing) await api.updateProduct(editing.id, payload);
    else await api.createProduct(payload);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Produits"
        subtitle="Catalogue bidons et bonbonnes — formats étiquetés EMMANUEL SERVICES SARLU"
        excel={{ filename: 'produits', sheets: [sheetProducts(products, can('products', 'create'))], onImported: load }}
        actions={
          <>
            <DocButton label="Catalogue" onClick={() => printProductsCatalog(products)} />
            {can('products', 'create') && <button type="button" className="erp-btn" onClick={() => { setEditing(null); setForm({ code: '', name: '', format: 'BIDON_5L', unitPrice: 1500, isReusable: true, imageUrl: '' }); setShowForm(true); }}>+ Nouveau produit</button>}
          </>
        }
      />
      <div style={{ marginBottom: 24 }}>
        <ProductSaleGrid>
          {products.map((p) => (
            <ProductSaleCard
              key={p.id}
              name={p.name}
              code={p.code}
              format={p.format}
              imageUrl={p.imageUrl}
              price={Number(p.unitPrice)}
              quantity={preview[p.id] ?? 1}
              min={1}
              onQuantityChange={(q) => setPreview((prev) => ({ ...prev, [p.id]: q }))}
              badge={p.imageUrl ? undefined : 'Photo manquante'}
              metaLabel="Consigne"
              metaValue={p.isReusable ? 'Consigné · réutilisable' : 'Usage unique'}
              onAdd={can('products', 'update') ? () => {
                setEditing(p);
                setForm({
                  code: p.code,
                  name: p.name,
                  format: p.format,
                  unitPrice: Number(p.unitPrice),
                  isReusable: p.isReusable,
                  imageUrl: p.imageUrl ?? '',
                });
                setShowForm(true);
              } : undefined}
              addLabel={p.imageUrl ? 'Modifier la fiche' : 'Charger la photo'}
            />
          ))}
        </ProductSaleGrid>
        {!products.length && <p className="erp-table-empty">Aucun produit au catalogue.</p>}
      </div>
      <ErpPanel title="Tableau des produits">
        <table className="erp-table">
          <thead>
            <tr><th>Code</th><th>Nom</th><th>Format</th><th>Prix (CDF)</th><th>Réutilisable</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.code}</strong></td>
                <td>{p.name}</td>
                <td><EmmaFormatBadge format={p.format} /></td>
                <td>{Number(p.unitPrice).toLocaleString('fr-FR')}</td>
                <td>{p.isReusable ? 'Oui' : 'Non'}</td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printProductSheet(p)} />
                  {can('products', 'update') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                      setEditing(p);
                      setForm({ code: p.code, name: p.name, format: p.format, unitPrice: Number(p.unitPrice), isReusable: p.isReusable, imageUrl: p.imageUrl ?? '' });
                      setShowForm(true);
                    }}>Modifier</button>
                  )}
                  {can('products', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteProduct(p.id).then(load)}>Retirer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <Modal title={editing ? 'Modifier le produit' : 'Nouveau produit'} open={showForm} onClose={() => setShowForm(false)}>
        <form className="form-stack" onSubmit={submit}>
          <ImageUploadField
            label="Photo du produit"
            value={form.imageUrl}
            onChange={(dataUrl) => setForm({ ...form, imageUrl: dataUrl })}
            hint="Visuel sur fond clair. L’image est réduite avant enregistrement."
          />
          <div className="form-group"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} /></div>
          <div className="form-group"><label>Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group">
            <label>Format</label>
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              {FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Prix unitaire (CDF)</label><input type="number" min={0} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} /></div>
          <label className="form-group"><input type="checkbox" checked={form.isReusable} onChange={(e) => setForm({ ...form, isReusable: e.target.checked })} /> Réutilisable / consigné</label>
          <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  );
}
