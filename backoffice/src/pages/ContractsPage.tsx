import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  BusinessContract,
  BusinessContractKind,
  ContractPartyKind,
  CreateContractInput,
  CreateSupplierInput,
  Supplier,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printContractSheet, printContractsList } from '../documents/templates';

type Tab = 'ALL' | ContractPartyKind | 'SUPPLIERS' | 'ALERTS';

const PARTY_LABEL: Record<ContractPartyKind, string> = {
  AGENT: 'Agent',
  SUPPLIER: 'Fournisseur',
  KEY_CLIENT: 'Grand client',
};

const KIND_LABEL: Record<BusinessContractKind, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  STAGE: 'Stage',
  PRESTATION: 'Prestation',
  JOURNALIER: 'Journalier',
  FOURNITURE: 'Fourniture',
  PRESTATION_SERVICE: 'Prestation de service',
  CADRE: 'Contrat cadre',
  DISTRIBUTION: 'Distribution',
  EXCLUSIVITE: 'Exclusivité',
  CONSIGNATION: 'Consignation',
};

const KINDS_BY_PARTY: Record<ContractPartyKind, BusinessContractKind[]> = {
  AGENT: ['CDI', 'CDD', 'STAGE', 'PRESTATION', 'JOURNALIER'],
  SUPPLIER: ['FOURNITURE', 'PRESTATION_SERVICE', 'CADRE'],
  KEY_CLIENT: ['CADRE', 'DISTRIBUTION', 'EXCLUSIVITE', 'CONSIGNATION'],
};

const emptyContract = (): CreateContractInput => ({
  partyKind: 'AGENT',
  title: '',
  kind: 'CDI',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  noticeDays: 30,
  autoRenew: false,
  currency: 'CDF',
  amount: 0,
  paymentTerms: '',
  billingCycle: '',
  volumeCommitment: '',
  territory: 'Kinshasa',
  exclusivity: false,
  clauses: '',
  notes: '',
  employeeId: '',
  supplierId: '',
  clientId: '',
  signedByParty: '',
  signedByCompany: 'EMMANUEL SERVICES SARLU',
});

const emptySupplier = (): CreateSupplierInput => ({
  code: '',
  name: '',
  category: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
});

function isoDate(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function money(value: string | number | null | undefined, currency = 'CDF') {
  return `${Number(value ?? 0).toLocaleString('fr-CD')} ${currency}`;
}

function partyName(c: BusinessContract) {
  if (c.partyKind === 'AGENT') {
    const u = c.employee?.user;
    return u ? `${u.firstName} ${u.lastName}` : c.employee?.matricule ?? '—';
  }
  if (c.partyKind === 'SUPPLIER') return c.supplier?.name ?? '—';
  return c.client?.name ?? '—';
}

export default function ContractsPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>('ALL');
  const [contracts, setContracts] = useState<BusinessContract[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<{ total: number; status: Record<string, number>; parties: Record<string, number>; expiring30d: number } | null>(null);
  const [parties, setParties] = useState<Awaited<ReturnType<typeof api.getContractParties>> | null>(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BusinessContract | null>(null);
  const [form, setForm] = useState<CreateContractInput>(emptyContract());
  const [showSupplier, setShowSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<CreateSupplierInput>(emptySupplier());
  const [terminateId, setTerminateId] = useState<string | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [amendId, setAmendId] = useState<string | null>(null);
  const [amend, setAmend] = useState({ reason: '', amount: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    const params =
      tab === 'ALERTS' ? { expiringDays: 30, q: query || undefined }
      : tab === 'ALL' || tab === 'SUPPLIERS' ? { q: query || undefined }
      : { partyKind: tab, q: query || undefined };
    const [rows, stats, directory, frn] = await Promise.all([
      tab === 'SUPPLIERS' ? api.getContracts() : api.getContracts(params),
      api.getContractsSummary(),
      api.getContractParties(),
      api.getSuppliers(),
    ]);
    setContracts(rows);
    setSummary(stats);
    setParties(directory);
    setSuppliers(frn);
  };

  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible')); }, [tab]);

  const kinds = KINDS_BY_PARTY[form.partyKind];

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setBusy('');
    }
  };

  const openCreate = () => {
    const partyKind: ContractPartyKind = tab === 'SUPPLIER' || tab === 'KEY_CLIENT' || tab === 'AGENT' ? tab : 'AGENT';
    setEditing(null);
    setForm({ ...emptyContract(), partyKind, kind: KINDS_BY_PARTY[partyKind][0] });
    setShowForm(true);
  };

  const openEdit = (c: BusinessContract) => {
    setEditing(c);
    setForm({
      partyKind: c.partyKind,
      title: c.title,
      kind: c.kind,
      startDate: isoDate(c.startDate),
      endDate: isoDate(c.endDate),
      noticeDays: c.noticeDays,
      autoRenew: c.autoRenew,
      currency: c.currency,
      amount: Number(c.amount ?? 0),
      paymentTerms: c.paymentTerms ?? '',
      billingCycle: c.billingCycle ?? '',
      volumeCommitment: c.volumeCommitment ?? '',
      territory: c.territory ?? '',
      exclusivity: c.exclusivity,
      clauses: c.clauses ?? '',
      notes: c.notes ?? '',
      employeeId: c.employeeId ?? '',
      supplierId: c.supplierId ?? '',
      clientId: c.clientId ?? '',
      signedByParty: c.signedByParty ?? '',
      signedByCompany: c.signedByCompany ?? 'EMMANUEL SERVICES SARLU',
    });
    setShowForm(true);
  };

  const submitContract = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload: CreateContractInput = {
      ...form,
      endDate: form.endDate || undefined,
      amount: form.amount ? Number(form.amount) : undefined,
      employeeId: form.partyKind === 'AGENT' ? form.employeeId || undefined : undefined,
      supplierId: form.partyKind === 'SUPPLIER' ? form.supplierId || undefined : undefined,
      clientId: form.partyKind === 'KEY_CLIENT' ? form.clientId || undefined : undefined,
    };
    try {
      if (editing) await api.updateContract(editing.id, payload);
      else await api.createContract(payload);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    }
  };

  const submitSupplier = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingSupplier) await api.updateSupplier(editingSupplier.id, supplierForm);
      else await api.createSupplier(supplierForm);
      setShowSupplier(false);
      setEditingSupplier(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement fournisseur impossible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Contrats"
        subtitle="Agents, fournisseurs et grands clients — cycle de vie, avenants et échéances"
        actions={(
          <>
            <DocButton label="Registre" onClick={() => printContractsList(contracts)} />
            {can('contracts', 'create') && tab !== 'SUPPLIERS' && (
              <button type="button" className="erp-btn" onClick={openCreate}>+ Nouveau contrat</button>
            )}
            {can('contracts', 'create') && tab === 'SUPPLIERS' && (
              <button type="button" className="erp-btn" onClick={() => { setEditingSupplier(null); setSupplierForm(emptySupplier()); setShowSupplier(true); }}>
                + Fournisseur
              </button>
            )}
          </>
        )}
      />

      {summary && (
        <div className="erp-kpi-row">
          <div className="erp-kpi"><div className="erp-kpi-label">Total</div><div className="erp-kpi-value">{summary.total}</div></div>
          <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Actifs</div><div className="erp-kpi-value">{summary.status.ACTIF ?? 0}</div></div>
          <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Échéance 30 j</div><div className="erp-kpi-value">{summary.expiring30d}</div></div>
          <div className="erp-kpi"><div className="erp-kpi-label">Agents</div><div className="erp-kpi-value">{summary.parties.AGENT ?? 0}</div></div>
          <div className="erp-kpi erp-kpi--blue"><div className="erp-kpi-label">Fournisseurs</div><div className="erp-kpi-value">{summary.parties.SUPPLIER ?? 0}</div></div>
          <div className="erp-kpi"><div className="erp-kpi-label">Grands clients</div><div className="erp-kpi-value">{summary.parties.KEY_CLIENT ?? 0}</div></div>
        </div>
      )}

      <div className="erp-tabs">
        {([
          ['ALL', 'Tous'],
          ['AGENT', 'Agents'],
          ['SUPPLIER', 'Fournisseurs'],
          ['KEY_CLIENT', 'Grands clients'],
          ['ALERTS', 'Échéances'],
          ['SUPPLIERS', 'Annuaire fournisseurs'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`erp-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {error && <p className="error-msg">{error}</p>}
      {busy && <p className="erp-muted">{busy}…</p>}

      {tab !== 'SUPPLIERS' && (
        <ErpPanel
          title={tab === 'ALERTS' ? 'Contrats à échéance (30 jours)' : `Contrats (${contracts.length})`}
          actions={(
            <form className="form-row" onSubmit={(e) => { e.preventDefault(); load(); }}>
              <input placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button type="submit" className="erp-btn erp-btn--ghost erp-btn--sm">Filtrer</button>
            </form>
          )}
        >
          <table className="erp-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Partie</th>
                <th>Intitulé</th>
                <th>Type</th>
                <th>Période</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.reference}</strong></td>
                  <td>
                    <div>{partyName(c)}</div>
                    <div className="erp-muted">{PARTY_LABEL[c.partyKind]}</div>
                  </td>
                  <td>{c.title}</td>
                  <td>{KIND_LABEL[c.kind]}{c.exclusivity ? ' · exclusif' : ''}{c.renewalCount ? ` · x${c.renewalCount}` : ''}</td>
                  <td>{isoDate(c.startDate)} → {isoDate(c.endDate) || 'indéterminée'}</td>
                  <td>{c.amount != null ? money(c.amount, c.currency) : '—'}</td>
                  <td><StatusPill status={c.status} /></td>
                  <td className="erp-row-actions">
                    <DocButton label="Contrat" onClick={() => printContractSheet(c)} />
                    {can('contracts', 'update') && c.status !== 'RESILIE' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openEdit(c)}>Modifier</button>
                    )}
                    {can('contracts', 'validate') && (c.status === 'BROUILLON' || c.status === 'RENOUVELE') && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => run('Validation', () => api.validateContract(c.id))}>Valider</button>
                    )}
                    {can('contracts', 'validate') && c.status === 'ACTIF' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run('Suspension', () => api.suspendContract(c.id))}>Suspendre</button>
                    )}
                    {can('contracts', 'validate') && c.status === 'SUSPENDU' && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => run('Reprise', () => api.resumeContract(c.id))}>Reprendre</button>
                    )}
                    {can('contracts', 'validate') && ['ACTIF', 'EXPIRE', 'SUSPENDU'].includes(c.status) && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run('Renouvellement', () => api.renewContract(c.id))}>Renouveler</button>
                    )}
                    {can('contracts', 'update') && ['ACTIF', 'SUSPENDU'].includes(c.status) && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => { setAmendId(c.id); setAmend({ reason: '', amount: String(c.amount ?? ''), notes: '' }); }}>Avenant</button>
                    )}
                    {can('contracts', 'validate') && !['BROUILLON', 'RESILIE'].includes(c.status) && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => { setTerminateId(c.id); setTerminateReason(''); }}>Résilier</button>
                    )}
                    {can('contracts', 'delete') && c.status === 'BROUILLON' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run('Suppression', () => api.deleteContract(c.id))}>Supprimer</button>
                    )}
                  </td>
                </tr>
              ))}
              {!contracts.length && <tr><td colSpan={8} className="erp-muted">Aucun contrat.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
      )}

      {tab === 'SUPPLIERS' && (
        <ErpPanel title={`Fournisseurs (${suppliers.length})`}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Contact</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.code}</strong></td>
                  <td>{s.name}</td>
                  <td>{s.category ?? '—'}</td>
                  <td>{s.contactName ?? '—'}</td>
                  <td>{s.phone ?? '—'}</td>
                  <td><StatusPill status={s.isActive ? 'ACTIF' : 'ANNULEE'} label={s.isActive ? 'Actif' : 'Inactif'} /></td>
                  <td className="erp-row-actions">
                    {can('contracts', 'update') && (
                      <button
                        type="button"
                        className="erp-btn erp-btn--sm erp-btn--ghost"
                        onClick={() => {
                          setEditingSupplier(s);
                          setSupplierForm({
                            code: s.code,
                            name: s.name,
                            category: s.category ?? '',
                            contactName: s.contactName ?? '',
                            phone: s.phone ?? '',
                            email: s.email ?? '',
                            address: s.address ?? '',
                            nif: s.nif ?? '',
                            rccm: s.rccm ?? '',
                            notes: s.notes ?? '',
                          });
                          setShowSupplier(true);
                        }}
                      >
                        Modifier
                      </button>
                    )}
                    {can('contracts', 'update') && !s.isActive && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => run('Réactivation', () => api.updateSupplier(s.id, { isActive: true }))}>Réactiver</button>
                    )}
                    {can('contracts', 'delete') && s.isActive && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run('Retrait', () => api.deleteSupplier(s.id))}>Retirer</button>
                    )}
                  </td>
                </tr>
              ))}
              {!suppliers.length && <tr><td colSpan={7} className="erp-muted">Aucun fournisseur.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
      )}

      <Modal title={editing ? `Modifier ${editing.reference}` : 'Nouveau contrat'} open={showForm} onClose={() => setShowForm(false)}>
        <form className="form-stack" onSubmit={submitContract}>
          <div className="form-group">
            <label>Partie</label>
            <select
              value={form.partyKind}
              disabled={!!editing}
              onChange={(e) => {
                const partyKind = e.target.value as ContractPartyKind;
                setForm({ ...form, partyKind, kind: KINDS_BY_PARTY[partyKind][0], employeeId: '', supplierId: '', clientId: '' });
              }}
            >
              <option value="AGENT">Agent</option>
              <option value="SUPPLIER">Fournisseur</option>
              <option value="KEY_CLIENT">Grand client</option>
            </select>
          </div>
          {form.partyKind === 'AGENT' && (
            <div className="form-group">
              <label>Agent</label>
              <select value={form.employeeId ?? ''} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
                <option value="">— Choisir —</option>
                {parties?.employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.matricule} · {e.user ? `${e.user.firstName} ${e.user.lastName}` : e.jobTitle}</option>
                ))}
              </select>
            </div>
          )}
          {form.partyKind === 'SUPPLIER' && (
            <div className="form-group">
              <label>Fournisseur</label>
              <select value={form.supplierId ?? ''} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                <option value="">— Choisir —</option>
                {parties?.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.partyKind === 'KEY_CLIENT' && (
            <div className="form-group">
              <label>Grand client</label>
              <select value={form.clientId ?? ''} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                <option value="">— Choisir —</option>
                {parties?.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name} ({c.segment})</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group"><label>Intitulé</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as BusinessContractKind })}>
              {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Début</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div className="form-group"><label>Fin</label><input type="date" value={form.endDate ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          <div className="form-group"><label>Montant</label><input type="number" min={0} value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
          <div className="form-group">
            <label>Devise</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="CDF">CDF</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="form-group"><label>Conditions de paiement</label><input value={form.paymentTerms ?? ''} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></div>
          <div className="form-group"><label>Cycle de facturation</label><input value={form.billingCycle ?? ''} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} /></div>
          <div className="form-group"><label>Engagement volume</label><input value={form.volumeCommitment ?? ''} onChange={(e) => setForm({ ...form, volumeCommitment: e.target.value })} /></div>
          <div className="form-group"><label>Territoire</label><input value={form.territory ?? ''} onChange={(e) => setForm({ ...form, territory: e.target.value })} /></div>
          <div className="form-group"><label>Préavis (jours)</label><input type="number" min={0} value={form.noticeDays ?? 30} onChange={(e) => setForm({ ...form, noticeDays: Number(e.target.value) })} /></div>
          <label className="erp-check"><input type="checkbox" checked={!!form.autoRenew} onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })} /> reconduction tacite</label>
          <label className="erp-check"><input type="checkbox" checked={!!form.exclusivity} onChange={(e) => setForm({ ...form, exclusivity: e.target.checked })} /> exclusivité</label>
          <div className="form-group"><label>Signataire partie</label><input value={form.signedByParty ?? ''} onChange={(e) => setForm({ ...form, signedByParty: e.target.value })} /></div>
          <div className="form-group"><label>Clauses</label><textarea value={form.clauses ?? ''} onChange={(e) => setForm({ ...form, clauses: e.target.value })} rows={4} /></div>
          <div className="form-group"><label>Notes</label><textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Créer le brouillon'}</button>
        </form>
      </Modal>

      <Modal title={editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} open={showSupplier} onClose={() => setShowSupplier(false)}>
        <form className="form-stack" onSubmit={submitSupplier}>
          <div className="form-group"><label>Code</label><input value={supplierForm.code} onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })} required disabled={!!editingSupplier} /></div>
          <div className="form-group"><label>Nom</label><input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required /></div>
          <div className="form-group"><label>Catégorie</label><input value={supplierForm.category ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })} /></div>
          <div className="form-group"><label>Contact</label><input value={supplierForm.contactName ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })} /></div>
          <div className="form-group"><label>Téléphone</label><input value={supplierForm.phone ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div>
          <div className="form-group"><label>E-mail</label><input type="email" value={supplierForm.email ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div>
          <div className="form-group"><label>Adresse</label><input value={supplierForm.address ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></div>
          <div className="form-group"><label>NIF</label><input value={supplierForm.nif ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, nif: e.target.value })} /></div>
          <div className="form-group"><label>RCCM</label><input value={supplierForm.rccm ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, rccm: e.target.value })} /></div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">{editingSupplier ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>

      <Modal title="Résilier le contrat" open={!!terminateId} onClose={() => setTerminateId(null)}>
        <form className="form-stack" onSubmit={(e) => { e.preventDefault(); if (terminateId) run('Résiliation', () => api.terminateContract(terminateId, terminateReason)).then(() => setTerminateId(null)); }}>
          <div className="form-group"><label>Motif</label><textarea value={terminateReason} onChange={(e) => setTerminateReason(e.target.value)} required rows={3} /></div>
          <button type="submit" className="erp-btn" disabled={!terminateReason.trim()}>Confirmer la résiliation</button>
        </form>
      </Modal>

      <Modal title="Avenant" open={!!amendId} onClose={() => setAmendId(null)}>
        <form className="form-stack" onSubmit={(e) => {
          e.preventDefault();
          if (!amendId) return;
          run('Avenant', () => api.addContractAmendment(amendId, {
            reason: amend.reason,
            amount: amend.amount ? Number(amend.amount) : undefined,
            notes: amend.notes || undefined,
          })).then(() => setAmendId(null));
        }}>
          <div className="form-group"><label>Motif</label><input value={amend.reason} onChange={(e) => setAmend({ ...amend, reason: e.target.value })} required /></div>
          <div className="form-group"><label>Nouveau montant</label><input type="number" min={0} value={amend.amount} onChange={(e) => setAmend({ ...amend, amount: e.target.value })} /></div>
          <div className="form-group"><label>Notes</label><textarea value={amend.notes} onChange={(e) => setAmend({ ...amend, notes: e.target.value })} rows={2} /></div>
          <button type="submit" className="erp-btn">Enregistrer l’avenant</button>
        </form>
      </Modal>
    </div>
  );
}
