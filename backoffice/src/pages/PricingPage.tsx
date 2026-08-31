import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, Client, ClientSegment, CreatePricingRuleInput, PricingRule, PricingRuleType, Product, User } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printPricingRules } from '../documents/templates';
import { sheetPricing } from '../excel/specs';

const SEGMENTS: ClientSegment[] = ['PARTICULIER', 'BOUTIQUE', 'DETAILLANT', 'SUPERMARCHE', 'ENTREPRISE', 'HOTEL_RESTAURANT'];

const emptyForm: CreatePricingRuleInput = {
  name: '',
  segment: null,
  clientId: null,
  zone: null,
  driverId: null,
  productId: null,
  minQuantity: 1,
  maxQuantity: null,
  stepQuantity: 10,
  type: 'ARTICLE_OFFERT',
  value: 1,
  priority: 0,
  isActive: true,
};

function qtyLabel(rule: PricingRule): string {
  const range = rule.maxQuantity == null ? `dès ${rule.minQuantity} unités` : `${rule.minQuantity} à ${rule.maxQuantity}`;
  if (rule.type === 'ARTICLE_OFFERT') return `${range} · lots de ${rule.stepQuantity ?? 10}`;
  return range;
}

function valueLabel(rule: PricingRule): string {
  const n = Number(rule.value);
  if (rule.type !== 'ARTICLE_OFFERT') return `${n.toLocaleString('fr-FR')} CDF`;
  return `${n} offert${n > 1 ? 's' : ''} pour ${rule.stepQuantity ?? 10} achetés`;
}

function scopeLabel(rule: PricingRule): string {
  const parts: string[] = [];
  if (rule.client) parts.push(rule.client.name);
  if (rule.zone) parts.push(`Zone ${rule.zone}`);
  if (rule.driver) parts.push(`${rule.driver.firstName} ${rule.driver.lastName}`);
  if (rule.segment) parts.push(rule.segment);
  return parts.join(' · ') || 'Général';
}

export default function PricingPage() {
  const { can } = usePermissions();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [form, setForm] = useState<CreatePricingRuleInput>(emptyForm);
  const [error, setError] = useState('');

  const zones = useMemo(
    () => [...new Set(clients.map((c) => c.zone).filter((z): z is string => !!z && z.trim().length > 0))].sort(),
    [clients],
  );

  const load = () => api.getPricingRules().then(setRules);
  useEffect(() => {
    load();
    api.getProducts().then(setProducts);
    api.getClients().then(setClients).catch(() => setClients([]));
    Promise.all([
      api.getUsersByRole('LIVREUR').catch(() => [] as User[]),
      api.getUsersByRole('CHARGE_LIVRAISON').catch(() => [] as User[]),
    ]).then(([a, b]) => setDrivers([...a, ...b]));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (rule: PricingRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      segment: rule.segment ?? null,
      clientId: rule.clientId ?? null,
      zone: rule.zone ?? null,
      driverId: rule.driverId ?? null,
      productId: rule.productId ?? null,
      minQuantity: rule.minQuantity,
      maxQuantity: rule.maxQuantity ?? null,
      stepQuantity: rule.stepQuantity ?? 10,
      type: rule.type,
      value: Number(rule.value),
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setError('');
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload: CreatePricingRuleInput = {
      ...form,
      segment: form.segment || null,
      clientId: form.clientId || null,
      zone: form.zone?.trim() || null,
      driverId: form.driverId || null,
      productId: form.productId || null,
      maxQuantity: form.maxQuantity || null,
    };
    try {
      if (editing) await api.updatePricingRule(editing.id, payload);
      else await api.createPricingRule(payload);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'enregistrer la règle');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Tarifs et bonus"
        subtitle="Prix préférentiel et bonus par catégorie, client, zone, livreur. Le bonus offre un article par tranche de 10 achetés : le client paie 10 et reçoit 11."
        excel={{ filename: 'tarifs', sheets: [sheetPricing(rules, can('pricing', 'create'))], onImported: load }}
        actions={
          <>
            <DocButton label="Imprimer les règles" onClick={() => printPricingRules(rules)} />
            {can('pricing', 'create') && (
              <button type="button" className="erp-btn" onClick={openCreate}>+ Nouvelle règle</button>
            )}
          </>
        }
      />
      <ErpPanel title={`Règles (${rules.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Portée</th>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Type</th>
              <th>Valeur</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.name}</strong></td>
                <td>{scopeLabel(r)}</td>
                <td>{r.product?.name ?? 'Tous les produits'}</td>
                <td>{qtyLabel(r)}</td>
                <td>{r.type === 'ARTICLE_OFFERT' ? 'Article offert' : 'Prix fixe'}</td>
                <td>{valueLabel(r)}</td>
                <td>{r.priority}</td>
                <td><StatusPill status={r.isActive ? 'ACTIF' : 'IGNOREE'} /></td>
                <td className="erp-row-actions">
                  {can('pricing', 'update') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openEdit(r)}>Modifier</button>
                  )}
                  {can('pricing', 'delete') && r.isActive && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deletePricingRule(r.id).then(load)}>Désactiver</button>
                  )}
                </td>
              </tr>
            ))}
            {!rules.length && (
              <tr><td colSpan={9} className="erp-table-empty">Aucune règle. Le prix catalogue s'applique.</td></tr>
            )}
          </tbody>
        </table>
      </ErpPanel>
      <Modal title={editing ? 'Modifier la règle' : 'Nouvelle règle tarifaire'} open={showForm} onClose={() => setShowForm(false)}>
        <form className="form-stack" onSubmit={submit}>
          <div className="form-group">
            <label>Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <p className="erp-muted">Portée du tarif préférentiel : laissez vide pour « tous ». Vous pouvez combiner client, zone et livreur.</p>
          <div className="form-group">
            <label>Catégorie client</label>
            <select value={form.segment ?? ''} onChange={(e) => setForm({ ...form, segment: (e.target.value || null) as ClientSegment | null })}>
              <option value="">Toutes les catégories</option>
              {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Client spécifique</label>
            <select value={form.clientId ?? ''} onChange={(e) => setForm({ ...form, clientId: e.target.value || null })}>
              <option value="">Tous les clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Zone</label>
            <input
              list="pricing-zones"
              value={form.zone ?? ''}
              onChange={(e) => setForm({ ...form, zone: e.target.value || null })}
              placeholder="Toutes les zones"
            />
            <datalist id="pricing-zones">
              {zones.map((z) => <option key={z} value={z} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label>Livreur spécifique</label>
            <select value={form.driverId ?? ''} onChange={(e) => setForm({ ...form, driverId: e.target.value || null })}>
              <option value="">Tous les livreurs</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Produit</label>
            <select value={form.productId ?? ''} onChange={(e) => setForm({ ...form, productId: e.target.value || null })}>
              <option value="">Tous les produits</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Quantité minimale</label>
              <input type="number" min={1} value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: Number(e.target.value) })} required />
            </div>
            <div className="form-group">
              <label>Quantité maximale</label>
              <input
                type="number"
                min={form.minQuantity}
                value={form.maxQuantity ?? ''}
                onChange={(e) => setForm({ ...form, maxQuantity: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="Illimité"
              />
            </div>
          </div>
          {form.type === 'ARTICLE_OFFERT' && (
            <div className="form-group">
              <label>Taille du lot (articles achetés)</label>
              <input type="number" min={1} value={form.stepQuantity ?? 10} onChange={(e) => setForm({ ...form, stepQuantity: Number(e.target.value) })} required />
              <p className="erp-muted">Exemple : lot de 10. Pour 23 articles achetés, 2 articles sont offerts et 25 sont livrés.</p>
            </div>
          )}
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PricingRuleType, value: e.target.value === 'ARTICLE_OFFERT' ? 1 : 0 })}>
              <option value="ARTICLE_OFFERT">Bonus en articles offerts</option>
              <option value="FIXED">Fixation de prix unitaire (CDF)</option>
            </select>
          </div>
          <div className="form-group">
            <label>{form.type === 'ARTICLE_OFFERT' ? 'Articles offerts par lot' : 'Prix unitaire (CDF)'}</label>
            <input type="number" min={form.type === 'ARTICLE_OFFERT' ? 1 : 0} max={form.type === 'ARTICLE_OFFERT' ? (form.stepQuantity ?? 10) : undefined} step={1} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} required />
          </div>
          <div className="form-group">
            <label>Priorité (la plus élevée gagne en cas de chevauchement)</label>
            <input type="number" value={form.priority ?? 0} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
          </div>
          <label className="form-group">
            <input type="checkbox" checked={form.isActive !== false} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  );
}
