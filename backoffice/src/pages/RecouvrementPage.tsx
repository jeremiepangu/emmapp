import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AllocationPreview, api, PaymentMethod, RecouvrementFilter, RecouvrementRow } from '../api';
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
  const [payForm, setPayForm] = useState({ amount: 0, method: 'ESPECES' as PaymentMethod, reference: '', asAdvance: false });
  const [returnTarget, setReturnTarget] = useState<RecouvrementRow | null>(null);
  const [returnForm, setReturnForm] = useState({ productFormat: 'BONBONNE_19L', quantity: 1 });
  const [remindTarget, setRemindTarget] = useState<RecouvrementRow | null>(null);
  const [remindNotes, setRemindNotes] = useState('');
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
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

  const openPayment = (row: RecouvrementRow, asAdvance = false) => {
    setError('');
    setPayForm({
      amount: asAdvance ? 0 : Math.round(row.moneyDue),
      method: 'ESPECES',
      reference: '',
      asAdvance,
    });
    setPayTarget(row);
  };

  useEffect(() => {
    if (!payTarget || payForm.asAdvance || payForm.amount <= 0) {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api.previewAllocation({ amount: payForm.amount, clientId: payTarget.clientId })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [payTarget, payForm.amount, payForm.asAdvance]);

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
        asAdvance: payForm.asAdvance || undefined,
      });
      setPayTarget(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encaissement impossible');
    }
  };

  /**
   * Impute l'avance disponible sur les commandes dues du client, de la plus
   * ancienne a la plus recente, jusqu'a epuisement.
   */
  const applyAdvance = async (row: RecouvrementRow) => {
    setError('');
    try {
      await api.applyAdvanceForClient(row.clientId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Imputation impossible');
    }
  };

  const submitRemind = async (e: FormEvent) => {
    e.preventDefault();
    if (!remindTarget) return;
    setError('');
    try {
      await api.remindClient(remindTarget.clientId, remindNotes || undefined);
      setRemindTarget(null);
      setRemindNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Relance impossible');
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
                        Encaisser / acompte
                      </button>
                    )}
                    {can('payments', 'create') && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openPayment(r, true)}>
                        Avance
                      </button>
                    )}
                    {can('payments', 'create') && r.advance > 0 && r.moneyDue > 0 && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => applyAdvance(r)}>
                        Solder avec l’avance
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
                        onClick={() => { setRemindNotes(''); setRemindTarget(r); }}
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
        title={`${payForm.asAdvance ? 'Avance' : 'Encaissement'} — ${payTarget?.name ?? ''}`}
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
      >
        <form className="form-stack" onSubmit={submitPayment}>
          <p className="erp-muted">
            {payForm.asAdvance ? (
              <>
                Avance actuelle : {money(payTarget?.advance ?? 0)}. Le montant encaissé reste au
                crédit du client et soldera une commande plus tard.
              </>
            ) : (
              <>
                Reste à recouvrer : {money(payTarget?.moneyDue ?? 0)}. Un versement partiel constitue un
                <strong> acompte </strong>
                sur les commandes ; le surplus est porté en avance.
              </>
            )}
          </p>
          {preview && !payForm.asAdvance && (
            <div className="erp-panel" style={{ padding: 12, marginBottom: 8 }}>
              <p><strong>Prévision d’imputation</strong></p>
              {preview.lines.map((l) => (
                <div key={l.orderId}>{l.orderNumber} : {money(l.allocated)} / {money(l.due)}</div>
              ))}
              {preview.advance > 0 && <div>→ Avance résiduelle : {money(preview.advance)}</div>}
            </div>
          )}
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
          <button type="submit" className="erp-btn">
            {payForm.asAdvance ? 'Enregistrer l’avance' : 'Enregistrer l’encaissement'}
          </button>
        </form>
      </Modal>

      <Modal
        title={`Relance — ${remindTarget?.name ?? ''}`}
        open={Boolean(remindTarget)}
        onClose={() => setRemindTarget(null)}
      >
        <form className="form-stack" onSubmit={submitRemind}>
          <p className="erp-muted">
            Dette : {money(remindTarget?.moneyDue ?? 0)} · Vidanges dues : {remindTarget?.emptiesDue ?? 0}
          </p>
          <div className="form-group">
            <label>Notes (optionnel)</label>
            <textarea value={remindNotes} onChange={(e) => setRemindNotes(e.target.value)} rows={3} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">Envoyer la relance</button>
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
