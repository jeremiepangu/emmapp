import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  api,
  CreateFinanceAccountInput,
  CreateFinanceMovementInput,
  FinanceAccount,
  FinanceAccountKind,
  FinanceBudget,
  FinanceCategory,
  FinanceCategoryKind,
  FinanceInventory,
  FinanceInventoryLine,
  FinanceMovement,
  FinanceMovementKind,
  FinanceSummary,
  PaymentMethod,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printGenericReport } from '../documents/templates';
import {
  exportSheet,
  sheetFinanceAccounts,
  sheetFinanceBudgets,
  sheetFinanceCategories,
  sheetFinanceInventory,
  sheetFinanceMovements,
} from '../excel/specs';

type Tab = 'synthese' | 'comptes' | 'journal' | 'depenses' | 'inventaire' | 'budget';

const KIND_LABEL: Record<FinanceMovementKind, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
  TRANSFERT: 'Transfert',
  DEPENSE: 'Dépense',
  ENCAISSEMENT: 'Encaissement',
};

const ACCOUNT_KIND_LABEL: Record<FinanceAccountKind, string> = {
  CAISSE: 'Caisse / espèces',
  BANQUE: 'Compte bancaire',
};

const CATEGORY_KIND_LABEL: Record<FinanceCategoryKind, string> = {
  RECETTE: 'Recette',
  CHARGE: 'Charge',
  TRANSFERT: 'Transfert',
};

const METHOD_LABEL: Record<string, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  MPESA: 'M-Pesa',
  ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money',
  WAVE: 'Wave',
  CREDIT: 'Crédit',
};

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function money(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} CDF`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function person(u?: { firstName: string; lastName: string } | null) {
  return u ? `${u.firstName} ${u.lastName}` : '—';
}

function emptyMovement(kind: FinanceMovementKind, accountId = ''): CreateFinanceMovementInput {
  return {
    kind,
    accountId,
    destAccountId: '',
    categoryId: '',
    amount: 0,
    method: kind === 'DEPENSE' || kind === 'SORTIE' ? 'ESPECES' : 'ESPECES',
    date: today(),
    label: '',
    reference: '',
    notes: '',
  };
}

export default function FinancePage() {
  const { can } = usePermissions();
  const canWrite = can('finance', 'create');
  const canUpdate = can('finance', 'update');
  const canValidate = can('finance', 'validate');
  const canDelete = can('finance', 'delete');

  const [tab, setTab] = useState<Tab>('synthese');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [inventories, setInventories] = useState<FinanceInventory[]>([]);
  const [snapshot, setSnapshot] = useState<FinanceInventoryLine[]>([]);
  const [counted, setCounted] = useState<Record<string, number>>({});

  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const now = new Date();
  const [budgetYear, setBudgetYear] = useState(now.getFullYear());
  const [budgetMonth, setBudgetMonth] = useState(now.getMonth() + 1);

  const [showAccount, setShowAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [accountForm, setAccountForm] = useState<CreateFinanceAccountInput>({
    code: '', name: '', kind: 'CAISSE', currency: 'CDF', openingBalance: 0, bankName: '', iban: '',
  });

  const [showCategory, setShowCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ code: '', name: '', kind: 'CHARGE' as FinanceCategoryKind });

  const [showMovement, setShowMovement] = useState(false);
  const [movementForm, setMovementForm] = useState<CreateFinanceMovementInput>(emptyMovement('ENTREE'));

  const [showBudget, setShowBudget] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    annual: false,
    categoryId: '',
    plannedAmount: 0,
    notes: '',
  });

  const [invNotes, setInvNotes] = useState('');

  const cashAccounts = accounts.filter((a) => a.kind === 'CAISSE');
  const bankAccounts = accounts.filter((a) => a.kind === 'BANQUE');
  const chargeCategories = categories.filter((c) => c.kind === 'CHARGE');
  const expenses = useMemo(() => movements.filter((m) => m.kind === 'DEPENSE'), [movements]);

  const loadCore = async () => {
    const [s, a, c] = await Promise.all([
      api.getFinanceSummary(),
      api.getFinanceAccounts(),
      api.getFinanceCategories(),
    ]);
    setSummary(s);
    setAccounts(a);
    setCategories(c);
  };

  const loadMovements = async () => {
    const rows = await api.getFinanceMovements({
      kind: kindFilter || undefined,
      status: statusFilter || undefined,
      accountId: accountFilter || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    setMovements(rows);
  };

  const loadBudgets = async () => {
    setBudgets(await api.getFinanceBudgets(budgetYear, budgetMonth));
  };

  const loadInventory = async () => {
    const [snap, rows] = await Promise.all([
      api.getFinanceInventorySnapshot(),
      api.getFinanceInventories(),
    ]);
    setSnapshot(snap.lines);
    setInventories(rows);
    setCounted(Object.fromEntries(snap.lines.map((l) => [`${l.productId}:${l.locationId}`, l.theoreticalQty])));
  };

  const refresh = async () => {
    setError('');
    try {
      await Promise.all([loadCore(), loadMovements(), loadBudgets(), loadInventory()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger la comptabilité.');
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => { loadMovements().catch(() => undefined); }, [kindFilter, statusFilter, accountFilter, from, to]);
  useEffect(() => { loadBudgets().catch(() => undefined); }, [budgetYear, budgetMonth]);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const submitAccount = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const payload = {
        ...accountForm,
        openingBalance: Number(accountForm.openingBalance ?? 0),
        bankName: accountForm.bankName || undefined,
        iban: accountForm.iban || undefined,
      };
      if (editingAccount) await api.updateFinanceAccount(editingAccount.id, payload);
      else await api.createFinanceAccount(payload);
      setShowAccount(false);
      setEditingAccount(null);
    });
  };

  const submitCategory = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.createFinanceCategory(categoryForm);
      setShowCategory(false);
      setCategoryForm({ code: '', name: '', kind: 'CHARGE' });
    });
  };

  const submitMovement = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.createFinanceMovement({
        ...movementForm,
        amount: Number(movementForm.amount),
        destAccountId: movementForm.kind === 'TRANSFERT' ? movementForm.destAccountId : undefined,
        categoryId: movementForm.categoryId || undefined,
        reference: movementForm.reference || undefined,
        notes: movementForm.notes || undefined,
      });
      setShowMovement(false);
    });
  };

  const submitBudget = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.createFinanceBudget({
        year: Number(budgetForm.year),
        month: budgetForm.annual ? null : Number(budgetForm.month),
        categoryId: budgetForm.categoryId,
        plannedAmount: Number(budgetForm.plannedAmount),
        notes: budgetForm.notes || undefined,
      });
      setShowBudget(false);
    });
  };

  const submitInventory = () => {
    if (!snapshot.length) return;
    run(async () => {
      await api.createFinanceInventory({
        date: today(),
        notes: invNotes || undefined,
        lines: snapshot.map((line) => ({
          productId: line.productId,
          locationId: line.locationId,
          theoreticalQty: line.theoreticalQty,
          countedQty: counted[`${line.productId}:${line.locationId}`] ?? line.theoreticalQty,
          unitValue: Number(line.unitValue),
        })),
      });
      setInvNotes('');
    });
  };

  const openMovement = (kind: FinanceMovementKind) => {
    const preferred = kind === 'DEPENSE' || kind === 'SORTIE' || kind === 'ENTREE' || kind === 'ENCAISSEMENT'
      ? (accounts.find((a) => a.kind === 'CAISSE' && a.isActive)?.id ?? accounts[0]?.id ?? '')
      : (accounts[0]?.id ?? '');
    const categoryId = kind === 'DEPENSE'
      ? (chargeCategories[0]?.id ?? '')
      : (categories.find((c) => c.code === 'REC-VTE')?.id ?? categories.find((c) => c.kind === 'RECETTE')?.id ?? '');
    setMovementForm({ ...emptyMovement(kind, preferred), categoryId });
    setShowMovement(true);
  };

  const printSummary = () => {
    if (!summary) return;
    printGenericReport('Synthèse trésorerie', {
      subtitle: 'Soldes caisse, banque, budget et inventaire',
      fields: [
        { label: 'Caisse / espèces', value: money(summary.cashBalance) },
        { label: 'Comptes bancaires', value: money(summary.bankBalance) },
        { label: 'Trésorerie totale', value: money(summary.totalTreasury) },
        { label: 'Entrées du mois', value: money(summary.monthIn) },
        { label: 'Sorties du mois', value: money(summary.monthOut) },
        { label: 'Dépenses du mois', value: money(summary.monthExpenses) },
        { label: 'Résultat du mois', value: money(summary.netMonth) },
        { label: 'Valeur inventaire', value: money(summary.inventoryValue) },
      ],
      tables: [
        {
          title: 'Comptes',
          headers: ['Code', 'Libellé', 'Type', 'Solde'],
          rows: accounts.map((a) => [a.code, a.name, ACCOUNT_KIND_LABEL[a.kind], money(a.balance)]),
        },
      ],
    });
  };

  const printJournal = () => {
    printGenericReport('Journal de trésorerie', {
      subtitle: `${movements.length} mouvements`,
      tables: [{
        headers: ['N°', 'Date', 'Type', 'Libellé', 'Compte', 'Montant', 'Statut'],
        rows: movements.map((m) => [
          m.number,
          new Date(m.date).toLocaleDateString('fr-FR'),
          KIND_LABEL[m.kind],
          m.label,
          m.account ? `${m.account.code} ${m.account.name}` : '—',
          money(m.amount),
          m.status,
        ]),
      }],
    });
  };

  const printBudget = () => {
    printGenericReport('Suivi budgétaire', {
      subtitle: `${MONTHS[budgetMonth - 1]} ${budgetYear}`,
      tables: [{
        headers: ['Rubrique', 'Prévu', 'Réel', 'Écart', 'Avancement'],
        rows: budgets.map((b) => [
          b.category?.name ?? '—',
          money(b.plannedAmount),
          money(b.actualAmount),
          money(b.remaining),
          `${b.progressPct ?? 0} %`,
        ]),
      }],
    });
  };

  const printInventory = () => {
    printGenericReport('Inventaire valorisé', {
      subtitle: `${snapshot.length} références`,
      tables: [{
        headers: ['Produit', 'Emplacement', 'Théorique', 'Compté', 'Valeur'],
        rows: snapshot.map((l) => [
          `${l.productCode} ${l.productName}`,
          `${l.locationCode} ${l.locationName}`,
          String(l.theoreticalQty),
          String(counted[`${l.productId}:${l.locationId}`] ?? l.theoreticalQty),
          money(l.theoreticalValue),
        ]),
      }],
    });
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'synthese', label: 'Synthèse' },
    { id: 'comptes', label: 'Comptes' },
    { id: 'journal', label: 'Journal' },
    { id: 'depenses', label: 'Dépenses' },
    { id: 'inventaire', label: 'Inventaire' },
    { id: 'budget', label: 'Budget' },
  ];

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Comptabilité"
        subtitle="Caisse, banque, dépenses, inventaire valorisé et suivi budgétaire"
        excel={{
          filename: 'comptabilite',
          sheets: [
            exportSheet('Synthese', [['indicateur', 'Indicateur'], ['valeur', 'Valeur']], summary ? [
              { indicateur: 'Caisse', valeur: summary.cashBalance },
              { indicateur: 'Banque', valeur: summary.bankBalance },
              { indicateur: 'Tresorerie', valeur: summary.totalTreasury },
              { indicateur: 'Entrees mois', valeur: summary.monthIn },
              { indicateur: 'Sorties mois', valeur: summary.monthOut },
              { indicateur: 'Depenses mois', valeur: summary.monthExpenses },
            ] : []),
            sheetFinanceAccounts(accounts, canWrite),
            sheetFinanceCategories(categories, canWrite),
            sheetFinanceMovements(movements, accounts, categories, canWrite),
            sheetFinanceBudgets(budgets, categories, canWrite),
            sheetFinanceInventory(snapshot.map((line) => ({ ...line, countedQty: counted[`${line.productId}:${line.locationId}`] ?? line.theoreticalQty }))),
          ],
          onImported: refresh,
        }}
        actions={
          <>
            <DocButton label="Imprimer" onClick={() => {
              if (tab === 'journal' || tab === 'depenses') printJournal();
              else if (tab === 'budget') printBudget();
              else if (tab === 'inventaire') printInventory();
              else printSummary();
            }} />
            {canWrite && tab === 'journal' && (
              <button type="button" className="erp-btn" onClick={() => openMovement('ENTREE')}>+ Mouvement</button>
            )}
            {canWrite && tab === 'depenses' && (
              <button type="button" className="erp-btn" onClick={() => openMovement('DEPENSE')}>+ Dépense</button>
            )}
            {canWrite && tab === 'comptes' && (
              <button type="button" className="erp-btn" onClick={() => {
                setEditingAccount(null);
                setAccountForm({ code: '', name: '', kind: 'CAISSE', currency: 'CDF', openingBalance: 0, bankName: '', iban: '' });
                setShowAccount(true);
              }}>+ Compte</button>
            )}
            {canWrite && tab === 'budget' && (
              <button type="button" className="erp-btn" onClick={() => {
                setBudgetForm({
                  year: budgetYear,
                  month: budgetMonth,
                  annual: false,
                  categoryId: categories[0]?.id ?? '',
                  plannedAmount: 0,
                  notes: '',
                });
                setShowBudget(true);
              }}>+ Enveloppe</button>
            )}
          </>
        }
      />

      {error && <p className="error-msg">{error}</p>}

      <div className="erp-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`erp-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'synthese' && summary && (
        <>
          <div className="erp-kpi-row">
            <div className="erp-kpi erp-kpi--green">
              <div className="erp-kpi-label">Caisse / espèces</div>
              <div className="erp-kpi-value">{money(summary.cashBalance)}</div>
              <div className="erp-kpi-meta">{cashAccounts.length} compte{cashAccounts.length > 1 ? 's' : ''}</div>
            </div>
            <div className="erp-kpi erp-kpi--blue">
              <div className="erp-kpi-label">Comptes bancaires</div>
              <div className="erp-kpi-value">{money(summary.bankBalance)}</div>
              <div className="erp-kpi-meta">{bankAccounts.length} compte{bankAccounts.length > 1 ? 's' : ''}</div>
            </div>
            <div className="erp-kpi">
              <div className="erp-kpi-label">Trésorerie totale</div>
              <div className="erp-kpi-value">{money(summary.totalTreasury)}</div>
              <div className="erp-kpi-meta">Caisse + banque</div>
            </div>
            <div className="erp-kpi erp-kpi--orange">
              <div className="erp-kpi-label">Résultat du mois</div>
              <div className="erp-kpi-value">{money(summary.netMonth)}</div>
              <div className="erp-kpi-meta">Entrées {money(summary.monthIn)} · sorties {money(summary.monthOut)}</div>
            </div>
          </div>
          <div className="erp-kpi-mini-row">
            <div className="erp-kpi-mini">
              <div className="erp-kpi-mini-icon erp-kpi-mini-icon--green">+</div>
              <div>
                <div className="erp-kpi-mini-label">Encaissements espèces / mobile</div>
                <div className="erp-kpi-mini-value">{money(summary.monthCash)}</div>
              </div>
            </div>
            <div className="erp-kpi-mini">
              <div className="erp-kpi-mini-icon erp-kpi-mini-icon--blue">B</div>
              <div>
                <div className="erp-kpi-mini-label">Encaissements banque</div>
                <div className="erp-kpi-mini-value">{money(summary.monthBank)}</div>
              </div>
            </div>
            <div className="erp-kpi-mini">
              <div className="erp-kpi-mini-icon erp-kpi-mini-icon--orange">−</div>
              <div>
                <div className="erp-kpi-mini-label">Dépenses du mois</div>
                <div className="erp-kpi-mini-value">{money(summary.monthExpenses)}</div>
              </div>
            </div>
            <div className="erp-kpi-mini">
              <div className="erp-kpi-mini-icon erp-kpi-mini-icon--red">▣</div>
              <div>
                <div className="erp-kpi-mini-label">Valeur inventaire</div>
                <div className="erp-kpi-mini-value">{money(summary.inventoryValue)}</div>
                <div className="erp-kpi-meta">{summary.inventorySku} références</div>
              </div>
            </div>
          </div>
          <ErpPanel title="Soldes par compte">
            <table className="erp-table">
              <thead>
                <tr><th>Code</th><th>Libellé</th><th>Type</th><th>Solde</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.code}</td>
                    <td>{a.name}{a.bankName ? ` · ${a.bankName}` : ''}</td>
                    <td>{ACCOUNT_KIND_LABEL[a.kind]}</td>
                    <td><strong>{money(a.balance)}</strong></td>
                    <td><StatusPill status={a.isActive ? 'VALIDEE' : 'ANNULEE'} label={a.isActive ? 'Actif' : 'Inactif'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
          <ErpPanel title={`Budget ${MONTHS[now.getMonth()]} ${now.getFullYear()}`}>
            <table className="erp-table">
              <thead>
                <tr><th>Rubrique</th><th>Prévu</th><th>Réel</th><th>Écart</th><th>Avancement</th></tr>
              </thead>
              <tbody>
                {(summary.budgets ?? []).map((b) => (
                  <tr key={b.id}>
                    <td>{b.category?.name ?? '—'}</td>
                    <td>{money(b.plannedAmount)}</td>
                    <td>{money(b.actualAmount)}</td>
                    <td>{money(b.remaining)}</td>
                    <td>{b.progressPct ?? 0} %</td>
                  </tr>
                ))}
                {!(summary.budgets ?? []).length && (
                  <tr><td colSpan={5}>Aucune enveloppe budgétaire pour ce mois.</td></tr>
                )}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'comptes' && (
        <>
          <ErpPanel title={`Comptes de trésorerie (${accounts.length})`}>
            <table className="erp-table">
              <thead>
                <tr><th>Code</th><th>Libellé</th><th>Type</th><th>Ouverture</th><th>Solde</th><th>Banque / IBAN</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.code}</td>
                    <td>{a.name}</td>
                    <td><StatusPill status={a.kind === 'CAISSE' ? 'VALIDEE' : 'EN_COURS'} label={ACCOUNT_KIND_LABEL[a.kind]} /></td>
                    <td>{money(a.openingBalance)}</td>
                    <td><strong>{money(a.balance)}</strong></td>
                    <td>{[a.bankName, a.iban].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="erp-row-actions">
                      {canUpdate && (
                        <button
                          type="button"
                          className="erp-btn erp-btn--sm erp-btn--ghost"
                          onClick={() => {
                            setEditingAccount(a);
                            setAccountForm({
                              code: a.code,
                              name: a.name,
                              kind: a.kind,
                              currency: a.currency,
                              openingBalance: Number(a.openingBalance),
                              bankName: a.bankName ?? '',
                              iban: a.iban ?? '',
                            });
                            setShowAccount(true);
                          }}
                        >
                          Modifier
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          className="erp-btn erp-btn--sm erp-btn--ghost"
                          onClick={() => run(() => api.updateFinanceAccount(a.id, { isActive: !a.isActive }))}
                        >
                          {a.isActive ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
          <ErpPanel
            title={`Rubriques (${categories.length})`}
            actions={canWrite ? <button type="button" className="erp-btn erp-btn--sm" onClick={() => setShowCategory(true)}>+ Rubrique</button> : undefined}
          >
            <table className="erp-table">
              <thead>
                <tr><th>Code</th><th>Libellé</th><th>Nature</th></tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{c.name}</td>
                    <td>{CATEGORY_KIND_LABEL[c.kind]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'journal' && (
        <ErpPanel title={`Journal des fonds (${movements.length})`}>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group">
              <label>Type</label>
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
                <option value="">Tous</option>
                {Object.entries(KIND_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Statut</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous</option>
                <option value="BROUILLON">Brouillon</option>
                <option value="VALIDE">Validé</option>
                <option value="ANNULE">Annulé</option>
              </select>
            </div>
            <div className="form-group">
              <label>Compte</label>
              <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="">Tous</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Du</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="form-group"><label>Au</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <MovementTable
            rows={movements}
            canValidate={canValidate}
            onValidate={(id) => run(() => api.validateFinanceMovement(id))}
            onCancel={(id) => run(() => api.cancelFinanceMovement(id))}
          />
        </ErpPanel>
      )}

      {tab === 'depenses' && (
        <ErpPanel title={`Dépenses (${expenses.length})`}>
          <MovementTable
            rows={expenses}
            canValidate={canValidate}
            onValidate={(id) => run(() => api.validateFinanceMovement(id))}
            onCancel={(id) => run(() => api.cancelFinanceMovement(id))}
          />
        </ErpPanel>
      )}

      {tab === 'inventaire' && (
        <>
          <ErpPanel
            title={`Stock valorisé (${snapshot.length})`}
            actions={canWrite && snapshot.length ? (
              <button type="button" className="erp-btn" onClick={submitInventory}>Enregistrer le comptage</button>
            ) : undefined}
          >
            {canWrite && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Note d’inventaire</label>
                <input value={invNotes} onChange={(e) => setInvNotes(e.target.value)} placeholder="Contrôle de fin de période" />
              </div>
            )}
            <table className="erp-table">
              <thead>
                <tr><th>Produit</th><th>Emplacement</th><th>Théorique</th><th>Compté</th><th>Écart</th><th>Valeur</th></tr>
              </thead>
              <tbody>
                {snapshot.map((line) => {
                  const key = `${line.productId}:${line.locationId}`;
                  const qty = counted[key] ?? line.theoreticalQty;
                  return (
                    <tr key={key}>
                      <td>{line.productCode} · {line.productName}</td>
                      <td>{line.locationCode} · {line.locationName}</td>
                      <td>{line.theoreticalQty}</td>
                      <td>
                        {canWrite ? (
                          <input
                            type="number"
                            min={0}
                            value={qty}
                            onChange={(e) => setCounted({ ...counted, [key]: Number(e.target.value) })}
                            style={{ width: 88 }}
                          />
                        ) : qty}
                      </td>
                      <td>{qty - line.theoreticalQty}</td>
                      <td>{money(line.theoreticalValue)}</td>
                    </tr>
                  );
                })}
                {!snapshot.length && <tr><td colSpan={6}>Aucun stock à inventorier.</td></tr>}
              </tbody>
            </table>
          </ErpPanel>
          <ErpPanel title={`Sessions d’inventaire (${inventories.length})`}>
            <table className="erp-table">
              <thead>
                <tr><th>N°</th><th>Date</th><th>Lignes</th><th>Statut</th><th>Par</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {inventories.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.number}</td>
                    <td>{new Date(inv.date).toLocaleDateString('fr-FR')}</td>
                    <td>{inv._count?.lines ?? inv.lines?.length ?? 0}</td>
                    <td><StatusPill status={inv.status === 'VALIDE' ? 'VALIDEE' : inv.status === 'ANNULE' ? 'ANNULEE' : 'BROUILLON'} label={inv.status} /></td>
                    <td>{person(inv.createdBy)}</td>
                    <td className="erp-row-actions">
                      {canValidate && inv.status === 'BROUILLON' && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => run(() => api.validateFinanceInventory(inv.id))}>
                          Valider le stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!inventories.length && <tr><td colSpan={6}>Aucun inventaire enregistré.</td></tr>}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'budget' && (
        <ErpPanel title="Enveloppes budgétaires">
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group">
              <label>Année</label>
              <input type="number" value={budgetYear} onChange={(e) => setBudgetYear(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Mois</label>
              <select value={budgetMonth} onChange={(e) => setBudgetMonth(Number(e.target.value))}>
                {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
              </select>
            </div>
          </div>
          <table className="erp-table">
            <thead>
              <tr><th>Période</th><th>Rubrique</th><th>Prévu</th><th>Réel</th><th>Écart</th><th>Avancement</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id}>
                  <td>{b.month ? `${MONTHS[b.month - 1]} ${b.year}` : `Annuel ${b.year}`}</td>
                  <td>{b.category?.name ?? '—'}</td>
                  <td>{money(b.plannedAmount)}</td>
                  <td>{money(b.actualAmount)}</td>
                  <td>{money(b.remaining)}</td>
                  <td>{b.progressPct ?? 0} %</td>
                  <td className="erp-row-actions">
                    {canDelete && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => run(() => api.deleteFinanceBudget(b.id))}>
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!budgets.length && <tr><td colSpan={7}>Aucune enveloppe pour cette période.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
      )}

      <Modal title={editingAccount ? 'Modifier le compte' : 'Nouveau compte'} open={showAccount} onClose={() => setShowAccount(false)}>
        <form className="form-stack" onSubmit={submitAccount}>
          <div className="form-group"><label>Code</label><input value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} required /></div>
          <div className="form-group"><label>Libellé</label><input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required /></div>
          <div className="form-group">
            <label>Type</label>
            <select value={accountForm.kind} onChange={(e) => setAccountForm({ ...accountForm, kind: e.target.value as FinanceAccountKind })}>
              <option value="CAISSE">Caisse / espèces</option>
              <option value="BANQUE">Compte bancaire</option>
            </select>
          </div>
          <div className="form-group"><label>Solde d’ouverture (CDF)</label><input type="number" min={0} value={accountForm.openingBalance} onChange={(e) => setAccountForm({ ...accountForm, openingBalance: Number(e.target.value) })} /></div>
          {accountForm.kind === 'BANQUE' && (
            <>
              <div className="form-group"><label>Banque</label><input value={accountForm.bankName} onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })} /></div>
              <div className="form-group"><label>IBAN / n° de compte</label><input value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} /></div>
            </>
          )}
          <button type="submit" className="erp-btn">{editingAccount ? 'Mettre à jour' : 'Enregistrer'}</button>
        </form>
      </Modal>

      <Modal title="Nouvelle rubrique" open={showCategory} onClose={() => setShowCategory(false)}>
        <form className="form-stack" onSubmit={submitCategory}>
          <div className="form-group"><label>Code</label><input value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} required /></div>
          <div className="form-group"><label>Libellé</label><input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></div>
          <div className="form-group">
            <label>Nature</label>
            <select value={categoryForm.kind} onChange={(e) => setCategoryForm({ ...categoryForm, kind: e.target.value as FinanceCategoryKind })}>
              <option value="RECETTE">Recette</option>
              <option value="CHARGE">Charge</option>
              <option value="TRANSFERT">Transfert</option>
            </select>
          </div>
          <button type="submit" className="erp-btn">Enregistrer</button>
        </form>
      </Modal>

      <Modal title={movementForm.kind === 'DEPENSE' ? 'Nouvelle dépense' : 'Mouvement de fonds'} open={showMovement} onClose={() => setShowMovement(false)}>
        <form className="form-stack" onSubmit={submitMovement}>
          <div className="form-group">
            <label>Type</label>
            <select
              value={movementForm.kind}
              onChange={(e) => setMovementForm({ ...movementForm, kind: e.target.value as FinanceMovementKind })}
            >
              {Object.entries(KIND_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>{movementForm.kind === 'TRANSFERT' ? 'Compte source' : 'Compte'}</label>
            <select value={movementForm.accountId} onChange={(e) => setMovementForm({ ...movementForm, accountId: e.target.value })} required>
              <option value="">—</option>
              {accounts.filter((a) => a.isActive).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
          </div>
          {movementForm.kind === 'TRANSFERT' && (
            <div className="form-group">
              <label>Compte destination</label>
              <select value={movementForm.destAccountId} onChange={(e) => setMovementForm({ ...movementForm, destAccountId: e.target.value })} required>
                <option value="">—</option>
                {accounts.filter((a) => a.isActive && a.id !== movementForm.accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Rubrique</label>
            <select value={movementForm.categoryId} onChange={(e) => setMovementForm({ ...movementForm, categoryId: e.target.value })}>
              <option value="">—</option>
              {categories
                .filter((c) => {
                  if (movementForm.kind === 'DEPENSE' || movementForm.kind === 'SORTIE') return c.kind === 'CHARGE';
                  if (movementForm.kind === 'TRANSFERT') return c.kind === 'TRANSFERT';
                  return c.kind === 'RECETTE';
                })
                .map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Libellé</label><input value={movementForm.label} onChange={(e) => setMovementForm({ ...movementForm, label: e.target.value })} required /></div>
          <div className="form-group"><label>Montant (CDF)</label><input type="number" min={0.01} step="0.01" value={movementForm.amount} onChange={(e) => setMovementForm({ ...movementForm, amount: Number(e.target.value) })} required /></div>
          <div className="form-group">
            <label>Mode</label>
            <select value={movementForm.method} onChange={(e) => setMovementForm({ ...movementForm, method: e.target.value as PaymentMethod })}>
              {Object.entries(METHOD_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Date</label><input type="date" value={movementForm.date} onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })} required /></div>
          <div className="form-group"><label>Référence</label><input value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} /></div>
          <button type="submit" className="erp-btn">Enregistrer</button>
        </form>
      </Modal>

      <Modal title="Nouvelle enveloppe budgétaire" open={showBudget} onClose={() => setShowBudget(false)}>
        <form className="form-stack" onSubmit={submitBudget}>
          <div className="form-group"><label>Année</label><input type="number" value={budgetForm.year} onChange={(e) => setBudgetForm({ ...budgetForm, year: Number(e.target.value) })} required /></div>
          <label className="form-check">
            <input type="checkbox" checked={budgetForm.annual} onChange={(e) => setBudgetForm({ ...budgetForm, annual: e.target.checked })} />
            Enveloppe annuelle
          </label>
          {!budgetForm.annual && (
            <div className="form-group">
              <label>Mois</label>
              <select value={budgetForm.month} onChange={(e) => setBudgetForm({ ...budgetForm, month: Number(e.target.value) })}>
                {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Rubrique</label>
            <select value={budgetForm.categoryId} onChange={(e) => setBudgetForm({ ...budgetForm, categoryId: e.target.value })} required>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Montant prévu (CDF)</label><input type="number" min={0} value={budgetForm.plannedAmount} onChange={(e) => setBudgetForm({ ...budgetForm, plannedAmount: Number(e.target.value) })} required /></div>
          <div className="form-group"><label>Note</label><input value={budgetForm.notes} onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })} /></div>
          <button type="submit" className="erp-btn">Enregistrer</button>
        </form>
      </Modal>
    </div>
  );
}

function MovementTable({
  rows,
  canValidate,
  onValidate,
  onCancel,
}: {
  rows: FinanceMovement[];
  canValidate: boolean;
  onValidate: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <table className="erp-table">
      <thead>
        <tr><th>N°</th><th>Date</th><th>Type</th><th>Libellé</th><th>Compte</th><th>Montant</th><th>Mode</th><th>Statut</th><th>Actions</th></tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td>{m.number}</td>
            <td>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
            <td>{KIND_LABEL[m.kind]}</td>
            <td>
              {m.label}
              {m.category ? <div className="erp-kpi-meta">{m.category.name}</div> : null}
            </td>
            <td>
              {m.account ? `${m.account.code} ${m.account.name}` : '—'}
              {m.destAccount ? ` vers ${m.destAccount.code}` : ''}
            </td>
            <td><strong>{money(m.amount)}</strong></td>
            <td>{METHOD_LABEL[m.method] ?? m.method}</td>
            <td>
              <StatusPill
                status={m.status === 'VALIDE' ? 'VALIDEE' : m.status === 'ANNULE' ? 'ANNULEE' : 'BROUILLON'}
                label={m.status === 'VALIDE' ? 'Validé' : m.status === 'ANNULE' ? 'Annulé' : 'Brouillon'}
              />
            </td>
            <td className="erp-row-actions">
              {canValidate && m.status === 'BROUILLON' && (
                <button type="button" className="erp-btn erp-btn--sm" onClick={() => onValidate(m.id)}>Valider</button>
              )}
              {canValidate && m.status !== 'ANNULE' && (
                <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => onCancel(m.id)}>Annuler</button>
              )}
            </td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={9}>Aucun mouvement.</td></tr>}
      </tbody>
    </table>
  );
}
