import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  BusinessContract,
  BusinessContractKind,
  ContractDocument,
  ContractPartyKind,
  ContractTemplate,
  CreateContractInput,
  CreateContractTemplateInput,
  CreateSupplierInput,
  Supplier,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printContractSheet, printContractsList } from '../documents/templates';
import { printContractTemplatePaper } from '../documents/paperForms';
import { exportSheet } from '../excel/specs';

type Tab = 'ALL' | ContractPartyKind | 'SUPPLIERS' | 'ALERTS' | 'TEMPLATES' | 'ARCHIVES';

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

const emptyTemplate = (): CreateContractTemplateInput => ({
  code: '',
  name: '',
  partyKind: 'AGENT',
  kind: 'CDI',
  title: '',
  body: 'Entre {{companyName}} et {{partyName}}.\n\nLe present contrat {{reference}} prend effet le {{startDate}} jusqu\'au {{endDate}} pour un montant de {{amount}}.\n\n{{clauses}}',
  clauses: '',
  footer: 'Document genere pour signature — {{reference}}',
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
  const [summary, setSummary] = useState<{ total: number; status: Record<string, number>; parties: Record<string, number>; expiring30d: number; archived?: number } | null>(null);
  const [parties, setParties] = useState<Awaited<ReturnType<typeof api.getContractParties>> | null>(null);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [archives, setArchives] = useState<ContractDocument[]>([]);
  const [placeholders, setPlaceholders] = useState<Array<{ key: string; label: string }>>([]);
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
  const [wordFor, setWordFor] = useState<BusinessContract | null>(null);
  const [wordTemplateId, setWordTemplateId] = useState('');
  const [docsFor, setDocsFor] = useState<BusinessContract | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<CreateContractTemplateInput>(emptyTemplate());
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    const params =
      tab === 'ALERTS' ? { expiringDays: 30, q: query || undefined }
      : tab === 'ALL' || tab === 'SUPPLIERS' ? { q: query || undefined }
      : { partyKind: tab, q: query || undefined };
    const [rows, stats, directory, frn, tpls, arch] = await Promise.all([
      tab === 'SUPPLIERS' || tab === 'TEMPLATES' || tab === 'ARCHIVES' ? api.getContracts() : api.getContracts(params),
      api.getContractsSummary(),
      api.getContractParties(),
      api.getSuppliers(),
      api.getContractTemplates(),
      api.getContractArchives(),
    ]);
    setContracts(rows);
    setSummary(stats);
    setParties(directory);
    setSuppliers(frn);
    setTemplates(tpls);
    setArchives(arch);
    if (!placeholders.length) {
      api.getContractPlaceholders().then(setPlaceholders).catch(() => undefined);
    }
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
        subtitle="Modèles Word, signature, archives — agents, fournisseurs et grands clients"
        excel={{
          filename: 'contrats',
          sheets: [
            exportSheet('Contrats', [['reference', 'Reference'], ['title', 'Titre'], ['kind', 'Type'], ['status', 'Statut'], ['startDate', 'Debut'], ['amount', 'Montant']], contracts.map((row) => ({
              reference: row.reference, title: row.title, kind: row.kind, status: row.status, startDate: row.startDate?.slice(0, 10), amount: row.amount ?? '',
            }))),
            exportSheet('Fournisseurs', [['name', 'Nom'], ['phone', 'Telephone'], ['email', 'Email']], suppliers.map((row) => ({ name: row.name, phone: row.phone ?? '', email: row.email ?? '' }))),
          ],
        }}
        actions={(
          <>
            <DocButton label="Registre" onClick={() => printContractsList(contracts)} />
            {can('contracts', 'create') && tab !== 'SUPPLIERS' && tab !== 'TEMPLATES' && tab !== 'ARCHIVES' && (
              <button type="button" className="erp-btn" onClick={openCreate}>+ Nouveau contrat</button>
            )}
            {can('contracts', 'create') && tab === 'SUPPLIERS' && (
              <button type="button" className="erp-btn" onClick={() => { setEditingSupplier(null); setSupplierForm(emptySupplier()); setShowSupplier(true); }}>
                + Fournisseur
              </button>
            )}
            {tab === 'TEMPLATES' && (
              <>
                {can('contracts', 'delete') && (
                  <button type="button" className="erp-btn erp-btn--ghost" onClick={() => run('Restauration des modèles', () => api.restoreContractTemplates())}>
                    Restaurer les modèles agents
                  </button>
                )}
                {can('contracts', 'create') && (
                  <button type="button" className="erp-btn" onClick={() => { setEditingTemplate(null); setTemplateForm(emptyTemplate()); setShowTemplate(true); }}>
                    + Modèle
                  </button>
                )}
              </>
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
          <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Archives</div><div className="erp-kpi-value">{summary.archived ?? 0}</div></div>
        </div>
      )}

      <div className="erp-tabs">
        {([
          ['ALL', 'Tous'],
          ['AGENT', 'Agents'],
          ['SUPPLIER', 'Fournisseurs'],
          ['KEY_CLIENT', 'Grands clients'],
          ['ALERTS', 'Échéances'],
          ['TEMPLATES', 'Modèles'],
          ['ARCHIVES', 'Archives'],
          ['SUPPLIERS', 'Annuaire fournisseurs'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`erp-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {error && <p className="error-msg">{error}</p>}
      {busy && <p className="erp-muted">{busy}…</p>}

      {tab !== 'SUPPLIERS' && tab !== 'TEMPLATES' && tab !== 'ARCHIVES' && (
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
                    {can('contracts', 'create') && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => {
                        const role = c.employee?.user?.role;
                        const roleCode = role ? `MDL-AGENT-${role}-${c.kind}` : '';
                        const match = templates.find((t) => t.isActive && t.code === roleCode)
                          ?? templates.find((t) => t.isActive && t.partyKind === c.partyKind && t.kind === c.kind)
                          ?? templates.find((t) => t.isActive && t.partyKind === c.partyKind)
                          ?? templates.find((t) => t.isActive);
                        setWordFor(c);
                        setWordTemplateId(match?.id ?? '');
                      }}>Word</button>
                    )}
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setDocsFor(c)}>
                      Dossier{c.documents?.length ? ` (${c.documents.length})` : ''}
                    </button>
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

      {tab === 'TEMPLATES' && (
        <ErpPanel title={`Modèles (${templates.length})`}>
          <p className="erp-muted">Un modèle Word existe pour chaque métier (livreur, commercial, magasinier, caisse, etc.) et chaque type (CDI, CDD, stage, journalier, prestation). Imprimez un exemplaire vierge pour signature manuscrite, ou générez le Word prérempli depuis un contrat. Variables : {'{{reference}}'}, {'{{partyName}}'}, {'{{amount}}'}, {'{{jobTitle}}'}…</p>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Partie</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.code}</strong></td>
                  <td>{t.name}</td>
                  <td>{t.partyKind ? PARTY_LABEL[t.partyKind] : 'Tous'}</td>
                  <td>{t.kind ? KIND_LABEL[t.kind] : 'Tous'}</td>
                  <td><StatusPill status={t.isActive ? 'ACTIF' : 'ANNULEE'} label={t.isActive ? 'Actif' : 'Inactif'} /></td>
                  <td className="erp-row-actions">
                    <DocButton label="Vierge" onClick={() => printContractTemplatePaper(t)} />
                    {can('contracts', 'update') && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                        setEditingTemplate(t);
                        setTemplateForm({
                          code: t.code,
                          name: t.name,
                          partyKind: t.partyKind ?? undefined,
                          kind: t.kind ?? undefined,
                          title: t.title,
                          body: t.body,
                          clauses: t.clauses ?? '',
                          footer: t.footer ?? '',
                        });
                        setShowTemplate(true);
                      }}>Modifier</button>
                    )}
                    {can('contracts', 'update') && !t.isActive && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => run('Réactivation', () => api.updateContractTemplate(t.id, { isActive: true }))}>Réactiver</button>
                    )}
                    {can('contracts', 'delete') && t.isActive && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run('Retrait', () => api.deleteContractTemplate(t.id))}>Retirer</button>
                    )}
                  </td>
                </tr>
              ))}
              {!templates.length && <tr><td colSpan={6} className="erp-muted">Aucun modèle.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
      )}

      {tab === 'ARCHIVES' && (
        <ErpPanel title={`Documents archivés (${archives.length})`}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Contrat</th>
                <th>Fichier</th>
                <th>Type</th>
                <th>Archivé le</th>
                <th>Par</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archives.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.contract?.reference}</strong><div className="erp-muted">{d.contract?.title}</div></td>
                  <td>{d.filename}</td>
                  <td><StatusPill status={d.kind} /></td>
                  <td>{d.archivedAt ? isoDate(d.archivedAt) : '—'}</td>
                  <td>{d.archivedBy ? `${d.archivedBy.firstName} ${d.archivedBy.lastName}` : '—'}</td>
                  <td className="erp-row-actions">
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.downloadContractDocument(d.id, d.filename)}>Télécharger</button>
                  </td>
                </tr>
              ))}
              {!archives.length && <tr><td colSpan={6} className="erp-muted">Aucune archive. Générez un Word, faites-le signer, puis archivez-le.</td></tr>}
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

      <Modal title={wordFor ? `Word pour signature — ${wordFor.reference}` : 'Word'} open={!!wordFor} onClose={() => setWordFor(null)}>
        <form className="form-stack" onSubmit={async (e) => {
          e.preventDefault();
          if (!wordFor) return;
          setBusy('Génération Word');
          setError('');
          try {
            const doc = await api.generateContractWord(wordFor.id, wordTemplateId || undefined);
            await api.downloadContractDocument(doc.id, doc.filename);
            setWordFor(null);
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Génération impossible');
          } finally {
            setBusy('');
          }
        }}>
          <p className="erp-muted">Le fichier Word est enregistré dans le dossier du contrat, prêt à être imprimé et signé.</p>
          <div className="form-group">
            <label>Modèle</label>
            <select value={wordTemplateId} onChange={(e) => setWordTemplateId(e.target.value)}>
              <option value="">— Modèle le plus adapté —</option>
              {templates.filter((t) => t.isActive && (!t.partyKind || t.partyKind === wordFor?.partyKind)).map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">Générer et télécharger</button>
        </form>
      </Modal>

      <Modal title={docsFor ? `Dossier ${docsFor.reference}` : 'Dossier'} open={!!docsFor} onClose={() => setDocsFor(null)}>
        {docsFor && (
          <div className="form-stack">
            <table className="erp-table">
              <thead>
                <tr><th>Fichier</th><th>Type</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {(docsFor.documents ?? []).map((d) => (
                  <tr key={d.id}>
                    <td>{d.filename}<div className="erp-muted">{Math.round(d.byteSize / 1024)} Ko</div></td>
                    <td><StatusPill status={d.archivedAt ? 'SIGNED_ARCHIVE' : d.kind} /></td>
                    <td>{isoDate(d.archivedAt ?? d.generatedAt)}</td>
                    <td className="erp-row-actions">
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.downloadContractDocument(d.id, d.filename)}>Télécharger</button>
                      {can('contracts', 'update') && !d.archivedAt && (
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run('Archivage', () => api.archiveContractDocument(docsFor.id, d.id, 'Exemplaire signé')).then(async () => {
                          const fresh = await api.getContract(docsFor.id);
                          setDocsFor(fresh);
                        })}>Archiver</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!(docsFor.documents ?? []).length && <tr><td colSpan={4} className="erp-muted">Aucun document. Générez d’abord le Word.</td></tr>}
              </tbody>
            </table>
            {can('contracts', 'create') && (
              <button type="button" className="erp-btn erp-btn--ghost" onClick={() => setUploadFor(docsFor.id)}>Archiver un exemplaire signé (PDF ou Word)</button>
            )}
          </div>
        )}
      </Modal>

      <Modal title={editingTemplate ? `Modifier ${editingTemplate.code}` : 'Nouveau modèle'} open={showTemplate} onClose={() => setShowTemplate(false)}>
        <form className="form-stack" onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            const payload = {
              ...templateForm,
              partyKind: templateForm.partyKind || undefined,
              kind: templateForm.kind || undefined,
            };
            if (editingTemplate) await api.updateContractTemplate(editingTemplate.id, payload);
            else await api.createContractTemplate(payload);
            setShowTemplate(false);
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Enregistrement modèle impossible');
          }
        }}>
          <div className="form-group"><label>Code</label><input value={templateForm.code} onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })} required disabled={!!editingTemplate} /></div>
          <div className="form-group"><label>Nom</label><input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} required /></div>
          <div className="form-group">
            <label>Partie</label>
            <select value={templateForm.partyKind ?? ''} onChange={(e) => setTemplateForm({ ...templateForm, partyKind: (e.target.value || undefined) as ContractPartyKind | undefined, kind: e.target.value ? KINDS_BY_PARTY[e.target.value as ContractPartyKind][0] : undefined })}>
              <option value="">Tous</option>
              <option value="AGENT">Agent</option>
              <option value="SUPPLIER">Fournisseur</option>
              <option value="KEY_CLIENT">Grand client</option>
            </select>
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={templateForm.kind ?? ''} onChange={(e) => setTemplateForm({ ...templateForm, kind: (e.target.value || undefined) as BusinessContractKind | undefined })}>
              <option value="">Tous</option>
              {(templateForm.partyKind ? KINDS_BY_PARTY[templateForm.partyKind] : Object.keys(KIND_LABEL) as BusinessContractKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div className="form-group"><label>Titre du document</label><input value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} required /></div>
          <div className="form-group"><label>Corps (variables {'{{nom}}'})</label><textarea value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} rows={8} required /></div>
          <div className="form-group"><label>Clauses</label><textarea value={templateForm.clauses ?? ''} onChange={(e) => setTemplateForm({ ...templateForm, clauses: e.target.value })} rows={3} /></div>
          <div className="form-group"><label>Pied de page</label><input value={templateForm.footer ?? ''} onChange={(e) => setTemplateForm({ ...templateForm, footer: e.target.value })} /></div>
          {placeholders.length > 0 && (
            <p className="erp-muted">{placeholders.map((p) => `{{${p.key}}}`).join(' ')}</p>
          )}
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">{editingTemplate ? 'Mettre à jour' : 'Créer le modèle'}</button>
        </form>
      </Modal>

      <Modal title="Archiver l’exemplaire signé" open={!!uploadFor} onClose={() => setUploadFor(null)}>
        <form className="form-stack" onSubmit={(e) => e.preventDefault()}>
          <p className="erp-muted">Déposez le PDF ou le Word signé. Il sera conservé dans l’archive du contrat.</p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !uploadFor) return;
              setBusy('Archivage');
              setError('');
              try {
                const contentBase64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result ?? ''));
                  reader.onerror = () => reject(new Error('Lecture fichier impossible'));
                  reader.readAsDataURL(file);
                });
                await api.uploadSignedContract(uploadFor, {
                  filename: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  contentBase64,
                  notes: 'Exemplaire signé déposé',
                });
                const fresh = await api.getContract(uploadFor);
                setDocsFor(fresh);
                setUploadFor(null);
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Archivage impossible');
              } finally {
                setBusy('');
              }
            }}
          />
          {error && <p className="error-msg">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
