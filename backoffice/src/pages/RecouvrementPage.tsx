import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, PaymentMethod, RecouvrementFilter, RecouvrementRow } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import ClientSituationPanel from '../components/ClientSituationPanel';
import { printRecouvrement } from '../documents/templates';
import { exportSheet } from '../excel/specs';

const FORMATS = ['BIDON_5L', 'BIDON_10L', 'BIDON_25L', 'BONBONNE_19L'];

const FILTERS: Array<{ value: RecouvrementFilter; label: string }> = [
  { value: 'TOUS', label: 'Toutes les situations' },
  { value: 'ARGENT', label: 'Dette en argent' },
  { value: 'VIDANGE', label: 'Dette en vidange' },
  { value: 'CREDITEUR', label: 'Clients créditeurs' },
];

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} CDF`;

export default function RecouvrementPage() {
  const { can } = usePermissions();
  const [rows, setRows] = useState<RecouvrementRow[]>([]);
  const [filter, setFilter] = useState<RecouvrementFilter>('TOUS');
  const [minAgeDays, setMinAgeDays] = useState(0);
  const [search, setSearch] = useState('');
  const [situationClient, setSituationClient] = useState<RecouvrementRow | null>(null);
  const [payTarget, setPayTarget] = useState<RecouvrementRow | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'ESPECES' as PaymentMethod, reference: '' });
  const [returnTarget, setReturnTarget] = useState<RecouvrementRow | null>(null);
  const [returnForm, setReturnForm] = useState({ productFormat: 'BONBONNE_19L', quantity: 1 });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getRecouvrement({ filter, minAgeDays: minAgeDays || undefined, search: search || undefined })
      .then(setRows)
      .catch(() => setRows([]));
  }, [filter, minAgeDays, search]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totalMoney = rows.reduce((sum, r) => sum + r.moneyDue, 0);
  const totalEmpties = rows.reduce((sum, r) => sum + r.emptiesDue, 0);
  const totalAdvance = rows.reduce((sum, r) => sum + r.advance, 0);

  const openPayment = (row: RecouvrementRow) => {
    setError('');
    setPayForm({ amount: Math.round(row.moneyDue), method: 'ESPECES', reference: '' });
    setPayTarget(row);
  };

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    setError('');
    try {
      await api.createPayment({
        clientId: payTarget.clientId,
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
      });
      setPayTarget(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encaissement impossible');
    }
  };

  const submitReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    setError('');
    try {
      await api.recordConsigneReturn({
        clientId: returnTarget.clientId,
        productFormat: returnForm.productFormat,
        quantity: Number(returnForm.quantity),
      });
      setReturnTarget(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retour impossible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Recouvrement"
        subtitle={`${rows.length} client(s) — ${money(totalMoney)} à encaisser · ${totalEmpties} contenant(s) à récupérer · ${money(totalAdvance)} d'avances`}
        excel={{
          filename: 'recouvrement',
          sheets: [
            exportSheet(
              'Recouvrement',
              [
                ['code', 'Code'],
                ['name', 'Client'],
                ['moneyDue', 'Dette argent'],
                ['advance', 'Avance'],
                ['emptiesDue', 'Vidange due'],
                ['emptiesCredit', 'Avoir contenants'],
                ['oldestDebtDays', 'Ancienneté (j)'],
              ],
              rows.map((r) => ({
                code: r.code,
                name: r.name,
                moneyDue: r.moneyDue,
                advance: r.advance,
                emptiesDue: r.emptiesDue,
                emptiesCredit: r.emptiesCredit,
                oldestDebtDays: r.oldestDebtDays ?? '',
              })),
            ),
          ],
        }}
        actions={<DocButton label="Imprimer l’état" onClick={() => printRecouvrement(rows)} />}
      />

      <ErpPanel title="Filtres" padded>
        <div className="recouvrement-filters">
          <div className="form-group">
            <label>Situation</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as RecouvrementFilter)}>
              {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Ancienneté minimale (jours)</label>
            <input type="number" min={0} value={minAgeDays} onChange={(e) => setMinAgeDays(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Recherche</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou code client" />
          </div>
        </div>
      </ErpPanel>

      <ErpPanel title={`Situations (${rows.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Dette argent</th>
              <th>Avance</th>
              <th>Vidange due</th>
              <th>Avoir contenants</th>
              <th>Ancienneté</th>
              <th>Dernier versement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.clientId}>
                <td>
                  <strong>{r.name}</strong><br />
                  <code>{r.code}</code>{r.phone ? ` · ${r.phone}` : ''}
                </td>
                <td>
                  <strong>{money(r.moneyDue)}</strong>
                  {r.creditLimit > 0 && r.moneyDue > r.creditLimit && (
                    <StatusPill status="ALERTE" label="Plafond dépassé" />
                  )}
                  {r.unpaidOrders > 0 && (
                    <div className="erp-muted">{r.unpaidOrders} commande(s)</div>
                  )}
                </td>
                <td>{r.advance > 0 ? money(r.advance) : '—'}</td>
                <td>
                  {r.emptiesDue || '—'}
                  {r.consigneLimit > 0 && r.emptiesDue > r.consigneLimit && (
                    <StatusPill status="ALERTE" label="Plafond dépassé" />
                  )}
                </td>
                <td>{r.emptiesCredit || '—'}</td>
                <td>{r.oldestDebtDays != null ? `${r.oldestDebtDays} j` : '—'}</td>
                <td>{r.lastPaymentAt ? new Date(r.lastPaymentAt).toLocaleDateString('fr-FR') : '—'}</td>
                <td>
                  <div className="recouvrement-actions">
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setSituationClient(r)}>
                      Situation
                    </button>
                    {can('payments', 'create') && r.moneyDue > 0 && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => openPayment(r)}>
                        Encaisser
                      </button>
                    )}
                    {can('consignes', 'create') && r.emptiesDue > 0 && (
                      <button
                        type="button"
                        className="erp-btn erp-btn--sm"
                        onClick={() => {
                          setError('');
                          setReturnForm({
                            productFormat: r.formats.find((f) => f.quantity > 0)?.productFormat ?? 'BONBONNE_19L',
                            quantity: r.emptiesDue,
                          });
                          setReturnTarget(r);
                        }}
                      >
                        Retour vides
                      </button>
                    )}
                    {can('recouvrement', 'create') && (
                      <button
                        type="button"
                        className="erp-btn erp-btn--sm erp-btn--ghost"
                        onClick={() => api.remindClient(r.clientId).then(() => undefined).catch(() => undefined)}
                      >
                        Relancer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="erp-table-empty">Aucune situation à recouvrer.</p>}
      </ErpPanel>

      <Modal
        title={`Situation — ${situationClient?.name ?? ''}`}
        open={Boolean(situationClient)}
        onClose={() => setSituationClient(null)}
        wide
      >
        <ClientSituationPanel clientId={situationClient?.clientId} />
      </Modal>

      <Modal
        title={`Encaissement — ${payTarget?.name ?? ''}`}
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
      >
        <form className="form-stack" onSubmit={submitPayment}>
          <p className="erp-muted">
            Reste à recouvrer : {money(payTarget?.moneyDue ?? 0)}. Un versement partiel ou en
            surplus est accepté ; le surplus est porté en avance sur compte.
          </p>
          <div className="form-group">
            <label>Montant (CDF)</label>
            <input type="number" min={0} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} required />
          </div>
          <div className="form-group">
            <label>Mode</label>
            <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PaymentMethod })}>
              {(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE'] as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Référence</label>
            <input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">Enregistrer l’encaissement</button>
        </form>
      </Modal>

      <Modal
        title={`Retour de vides — ${returnTarget?.name ?? ''}`}
        open={Boolean(returnTarget)}
        onClose={() => setReturnTarget(null)}
      >
        <form className="form-stack" onSubmit={submitReturn}>
          <p className="erp-muted">
            Contenants dus : {returnTarget?.emptiesDue ?? 0}. Un retour partiel ou en surplus est
            accepté ; le surplus devient un avoir en contenants.
          </p>
          <div className="form-group">
            <label>Format</label>
            <select value={returnForm.productFormat} onChange={(e) => setReturnForm({ ...returnForm, productFormat: e.target.value })}>
              {FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Quantité rendue</label>
            <input type="number" min={1} value={returnForm.quantity} onChange={(e) => setReturnForm({ ...returnForm, quantity: Number(e.target.value) })} required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">Enregistrer le retour</button>
        </form>
      </Modal>
    </div>
  );
}
