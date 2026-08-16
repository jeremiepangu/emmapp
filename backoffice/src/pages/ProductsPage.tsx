import { FormEvent, useEffect, useState } from 'react';
import { api, Product } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { EmmaFormatBadge } from '../components/EmmaBrand';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import Modal from '../components/Modal';

const FORMATS = ['BIDON_5L', 'BIDON_10L', 'BIDON_25L', 'BONBONNE_19L'];

export default function ProductsPage() {
  const { can } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ code: '', name: '', format: 'BIDON_5L', unitPrice: 1500, isReusable: true });

  const load = () => api.getProducts().then(setProducts);
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) await api.updateProduct(editing.id, form);
    else await api.createProduct(form);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Produits"
        subtitle="Catalogue bidons et bonbonnes — formats étiquetés EMMAS"
        actions={can('products', 'create') ? <button type="button" className="erp-btn" onClick={() => { setEditing(null); setShowForm(true); }}>+ Nouveau produit</button> : undefined}
      />
      <div className="emma-product-grid" style={{ marginBottom: 24 }}>
        {products.map((p) => (
          <article key={p.id} className="emma-product-card">
            <div className="emma-product-cap" />
            <EmmaFormatBadge format={p.format} />
            <h3>{p.name}</h3>
            <p className="emma-product-code">{p.code}</p>
            <p className="emma-product-price">{Number(p.unitPrice).toLocaleString('fr-FR')} CDF</p>
            <span className={`emma-product-tag ${p.isReusable ? 'reusable' : ''}`}>{p.isReusable ? 'Consigné · réutilisable' : 'Usage unique'}</span>
          </article>
        ))}
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
                  {can('products', 'update') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                      setEditing(p);
                      setForm({ code: p.code, name: p.name, format: p.format, unitPrice: Number(p.unitPrice), isReusable: p.isReusable });
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
