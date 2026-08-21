import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  api,
  CreatePackagingMovementInput,
  CreatePackagingSkuInput,
  PackagingKind,
  PackagingMovement,
  PackagingMovementType,
  PackagingPackFormat,
  PackagingSku,
  PackagingSummary,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printPackagingMovementSheet, printPackagingMovements, printPackagingSkuSheet, printPackagingSkus } from '../documents/templates';

const KIND_TABS: { id: PackagingKind | 'TOUS'; label: string }[] = [
  { id: 'TOUS', label: 'Tous' },
  { id: 'EMBALLAGE', label: 'Bidons & bonbonnes' },
  { id: 'ETIQUETTE', label: 'Étiquettes' },
  { id: 'BOUCHON', label: 'Bouchons' },
];

const FORMAT_LABEL: Record<string, string> = {
  BIDON_5L: 'Bidon 5 L',
  BIDON_10L: 'Bidon 10 L',
  BIDON_25L: 'Bidon 25 L',
  BONBONNE_5G: 'Bonbonne 5 gallons',
};

const KIND_LABEL: Record<PackagingKind, string> = {
  EMBALLAGE: 'Emballage',
  ETIQUETTE: 'Étiquette',
  BOUCHON: 'Bouchon',
};

const MOVE_TYPES: { value: PackagingMovementType; label: string }[] = [
  { value: 'ACHAT', label: 'Achat' },
  { value: 'UTILISATION', label: 'Utilisation' },
  { value: 'VENTE', label: 'Vente' },
  { value: 'DECLASSEMENT', label: 'Déclassement' },
];

const emptyForm: CreatePackagingMovementInput = {
  skuId: '',
  type: 'ACHAT',
  quantity: 1,
  supplier: '',
  reference: '',
  notes: '',
};

const emptySku: CreatePackagingSkuInput = {
  code: '',
  name: '',
  kind: 'EMBALLAGE',
  format: 'BIDON_5L',
  minStock: 50,
};

export default function PackagingPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<PackagingKind | 'TOUS'>('TOUS');
  const [skus, setSkus] = useState<PackagingSku[]>([]);
  const [summary, setSummary] = useState<PackagingSummary | null>(null);
  const [movements, setMovements] = useState<PackagingMovement[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [skuForm, setSkuForm] = useState(emptySku);
  const [editingSku, setEditingSku] = useState<PackagingSku | null>(null);
  const [showSku, setShowSku] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const kindFilter = tab === 'TOUS' ? undefined : tab;

  const load = () => {
    api.getPackagingSkus(kindFilter).then(setSkus).catch(() => setSkus([]));
    api.getPackagingSummary().then(setSummary).catch(() => setSummary(null));
    api.getPackagingMovements({ kind: kindFilter }).then(setMovements).catch(() => setMovements([]));
  };

  useEffect(() => { load(); }, [tab]);

  const filteredSkus = useMemo(
    () => (kindFilter ? skus.filter((s) => s.kind === kindFilter) : skus),
    [skus, kindFilter],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createPackagingMovement({
        skuId: form.skuId,
        type: form.type,
        quantity: Number(form.quantity),
        supplier: form.type === 'ACHAT' ? form.supplier || undefined : undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      });
      setForm({ ...emptyForm, type: form.type, skuId: form.skuId });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mouvement impossible');
    } finally {
      setSaving(false);
    }
  };

  const inbound = form.type === 'ACHAT';
  const activeSkus = filteredSkus.filter((s) => s.isActive);

  const saveSku = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingSku) await api.updatePackagingSku(editingSku.id, skuForm);
      else await api.createPackagingSku(skuForm);
      setShowSku(false);
      setEditingSku(null);
      setSkuForm(emptySku);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Article impossible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Emballages"
        subtitle="Stock des bidons 5 / 10 / 25 L, bonbonnes 5 gallons, étiquettes et bouchons — achat, utilisation, vente, déclassement"
        actions={
          <>
            <DocButton label="Articles" onClick={() => printPackagingSkus(skus)} />
            <DocButton label="Mouvements" onClick={() => printPackagingMovements(movements)} />
            {can('packaging', 'create') && (
              <button
                type="button"
                className="erp-btn"
                onClick={() => { setEditingSku(null); setSkuForm(emptySku); setShowSku(true); }}
              >
                + Nouvel article
              </button>
            )}
          </>
        }
      />

      <div className="erp-kpi-mini-row">
        {(['EMBALLAGE', 'ETIQUETTE', 'BOUCHON'] as PackagingKind[]).map((kind) => {
          const row = summary?.[kind];
          return (
            <div key={kind} className="erp-kpi-mini">
              <div className={`erp-kpi-mini-icon ${kind === 'EMBALLAGE' ? 'erp-kpi-mini-icon--blue' : kind === 'ETIQUETTE' ? 'erp-kpi-mini-icon--green' : 'erp-kpi-mini-icon--orange'}`}>
                {kind === 'EMBALLAGE' ? '⬡' : kind === 'ETIQUETTE' ? '▤' : '●'}
              </div>
              <div>
                <div className="erp-kpi-mini-label">{KIND_LABEL[kind]}</div>
                <div className="erp-kpi-mini-value">{row?.quantity ?? 0}</div>
                <div className="erp-kpi-meta">{row?.lowStock ?? 0} en stock bas</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="erp-tabs">
        {KIND_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`erp-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {can('packaging', 'create') && (
        <ErpPanel title="Enregistrer un mouvement" padded>
          <form className="form-row" onSubmit={submit}>
            <div className="form-group">
              <label>Article</label>
              <select value={form.skuId} onChange={(e) => setForm({ ...form, skuId: e.target.value })} required>
                <option value="">— Choisir —</option>
                {activeSkus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {KIND_LABEL[s.kind]} · {FORMAT_LABEL[s.format]} ({s.stock?.quantity ?? 0} en stock)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Cycle de vie</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PackagingMovementType })}
              >
                {MOVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantité</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                required
              />
            </div>
            {inbound && (
              <div className="form-group">
                <label>Fournisseur</label>
                <input
                  value={form.supplier ?? ''}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="Ex. Plastiques Kin"
                />
              </div>
            )}
            <div className="form-group">
              <label>Référence</label>
              <input
                value={form.reference ?? ''}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="BL, OF, motif…"
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button type="submit" className="erp-btn" disabled={saving}>
                {saving ? 'Enregistrement…' : inbound ? 'Entrer en stock' : 'Sortir du stock'}
              </button>
            </div>
          </form>
          {error && <p className="error-msg">{error}</p>}
        </ErpPanel>
      )}

      <ErpPanel title={`Stock (${filteredSkus.length} articles)`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Format</th>
              <th>Code</th>
              <th>En stock</th>
              <th>Seuil</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredSkus.map((sku) => {
              const qty = sku.stock?.quantity ?? 0;
              const low = qty < sku.minStock;
              return (
                <tr key={sku.id}>
                  <td>{KIND_LABEL[sku.kind]}</td>
                  <td><strong>{FORMAT_LABEL[sku.format]}</strong></td>
                  <td>{sku.code}</td>
                  <td><strong>{qty}</strong></td>
                  <td>{sku.minStock}</td>
                  <td>{low ? <StatusPill status="ALERTE" label="Stock bas" /> : sku.isActive ? <StatusPill status="ACTIF" label="OK" /> : <StatusPill status="ANNULEE" label="Inactif" />}</td>
                  <td className="erp-row-actions">
                    <DocButton onClick={() => printPackagingSkuSheet(sku)} />
                    {can('packaging', 'update') && (
                      <button
                        type="button"
                        className="erp-btn erp-btn--sm erp-btn--ghost"
                        onClick={() => {
                          setEditingSku(sku);
                          setSkuForm({
                            code: sku.code,
                            name: sku.name,
                            kind: sku.kind,
                            format: sku.format,
                            minStock: sku.minStock,
                          });
                          setShowSku(true);
                        }}
                      >
                        Modifier
                      </button>
                    )}
                    {can('packaging', 'update') && !sku.isActive && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.updatePackagingSku(sku.id, { isActive: true }).then(load)}>
                        Réactiver
                      </button>
                    )}
                    {can('packaging', 'delete') && sku.isActive && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deletePackagingSku(sku.id).then(load)}>
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ErpPanel>

      <ErpPanel title={`Journal (${movements.length})`}>
        {movements.length === 0 ? (
          <p className="erp-table-empty">Aucun mouvement enregistré.</p>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Article</th>
                <th>Qté</th>
                <th>Fournisseur / réf.</th>
                <th>Par</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.createdAt).toLocaleString('fr-FR')}</td>
                  <td><StatusPill status={m.type} /></td>
                  <td>{KIND_LABEL[m.sku.kind]} · {FORMAT_LABEL[m.sku.format]}</td>
                  <td>
                    {m.type === 'ACHAT' ? '+' : '−'}
                    {m.quantity}
                  </td>
                  <td>{[m.supplier, m.reference].filter(Boolean).join(' · ') || m.notes || '—'}</td>
                  <td>{m.createdBy ? `${m.createdBy.firstName} ${m.createdBy.lastName}` : '—'}</td>
                  <td className="erp-row-actions">
                    <DocButton onClick={() => printPackagingMovementSheet(m)} />
                    {can('packaging', 'delete') && (
                      <button
                        type="button"
                        className="erp-btn erp-btn--sm erp-btn--ghost"
                        onClick={() => api.deletePackagingMovement(m.id).then(load).catch((err) => setError(err.message))}
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ErpPanel>

      <Modal title={editingSku ? 'Modifier l’article' : 'Nouvel article d’emballage'} open={showSku} onClose={() => setShowSku(false)}>
        <form className="form-stack" onSubmit={saveSku}>
          <div className="form-group"><label>Code</label><input value={skuForm.code} onChange={(e) => setSkuForm({ ...skuForm, code: e.target.value })} required disabled={!!editingSku} /></div>
          <div className="form-group"><label>Nom</label><input value={skuForm.name} onChange={(e) => setSkuForm({ ...skuForm, name: e.target.value })} required /></div>
          <div className="form-group">
            <label>Type</label>
            <select value={skuForm.kind} onChange={(e) => setSkuForm({ ...skuForm, kind: e.target.value as PackagingKind })}>
              {(Object.keys(KIND_LABEL) as PackagingKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Format</label>
            <select value={skuForm.format} onChange={(e) => setSkuForm({ ...skuForm, format: e.target.value as PackagingPackFormat })}>
              {Object.entries(FORMAT_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Seuil d’alerte</label><input type="number" min={0} value={skuForm.minStock ?? 50} onChange={(e) => setSkuForm({ ...skuForm, minStock: Number(e.target.value) })} /></div>
          <button type="submit" className="erp-btn">{editingSku ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  );
}
