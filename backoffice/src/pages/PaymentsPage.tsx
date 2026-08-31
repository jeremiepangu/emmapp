import { FormEvent, useEffect, useState } from 'react';
import { AllocationPreview, api, Client, OutstandingOrder, Payment, PaymentMethod } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import ClientSituationPanel from '../components/ClientSituationPanel';
import { printPaymentReceipt, printPaymentsList } from '../documents/templates';
import { sheetPayments } from '../excel/specs';

const methodLabel: Record<string, string> = {
  ESPECES: 'Espèces', CHEQUE: 'Chèque', VIREMENT: 'Virement', MOBILE_MONEY: 'Mobile Money',
  MPESA: 'M-Pesa', ORANGE_MONEY: 'Orange Money', AIRTEL_MONEY: 'Airtel Money', WAVE: 'Wave', CREDIT: 'Crédit',
};
const METHODS = Object.keys(methodLabel) as PaymentMethod[];

export default function PaymentsPage() {
  const { can } = usePermissions();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState({ clientId: '', orderId: '', amount: 0, method: 'ESPECES' as PaymentMethod, reference: '', asAdvance: false });
  const [outstanding, setOutstanding] = useState<OutstandingOrder[]>([]);
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const [error, setError] = useState('');

  const load = () => Promise.all([
    api.getPayments().then(setPayments),
    api.getOutstandingOrders().then(setOutstanding).catch(() => setOutstanding([])),
  ]);
  useEffect(() => { load(); api.getClients().then(setClients); }, []);

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalRemaining = outstanding.reduce((s, o) => s + o.remaining, 0);

  /** Commandes non soldees du client choisi, cible possible du versement. */
  const eligibleOrders = form.clientId
    ? outstanding.filter((o) => o.client?.id === form.clientId)
    : outstanding;
  const selectedOrder = outstanding.find((o) => o.id === form.orderId) ?? null;

  const openForOrder = (order: OutstandingOrder) => {
    setEditing(null);
    setForm({
      clientId: order.client?.id ?? '',
      orderId: order.id,
      amount: order.remaining,
      method: 'ESPECES',
      reference: '',
      asAdvance: false,
    });
    setError('');
    setShowForm(true);
  };

  /** Encaissement anticipe : le montant attend au credit du client. */
  const openAdvance = () => {
    setEditing(null);
    setForm({ clientId: '', orderId: '', amount: 0, method: 'ESPECES', reference: '', asAdvance: true });
    setError('');
    setShowForm(true);
  };

  const applyAdvance = async (order: OutstandingOrder) => {
    try {
      await api.applyAdvance(order.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Imputation impossible');
    }
  };

  // Le trop-percu est autorise : on montre a l'avance ce qui solde des
  // commandes et ce qui restera en avance au credit du client.
  useEffect(() => {
    if (editing || !showForm || form.asAdvance || form.amount <= 0 || (!form.clientId && !form.orderId)) {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api.previewAllocation({
        amount: Number(form.amount),
        orderId: form.orderId || undefined,
        clientId: form.clientId || undefined,
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form.amount, form.orderId, form.clientId, form.asAdvance, showForm, editing]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { amount: Number(form.amount), method: form.method, reference: form.reference || undefined };
    try {
      if (editing) await api.updatePayment(editing.id, payload);
      else await api.createPayment({
        clientId: form.clientId || undefined,
        orderId: form.asAdvance ? undefined : form.orderId || undefined,
        asAdvance: form.asAdvance || undefined,
        ...payload,
      });
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        excel={{ filename: 'paiements', sheets: [sheetPayments(payments, clients, can('payments', 'create'))], onImported: load }}
        title="Paiements"
        subtitle={`Encaissements et suivi des règlements · Total : ${total.toLocaleString('fr-FR')} CDF`}
        actions={
          <>
            <DocButton label="Imprimer le registre" onClick={() => printPaymentsList(payments)} />
            {can('payments', 'create') && <button type="button" className="erp-btn erp-btn--ghost" onClick={openAdvance}>+ Avance</button>}
            {can('payments', 'create') && <button type="button" className="erp-btn" onClick={() => { setEditing(null); setForm({ clientId: '', orderId: '', amount: 0, method: 'ESPECES', reference: '', asAdvance: false }); setError(''); setShowForm(true); }}>+ Encaissement</button>}
          </>
        }
      />
      <ErpPanel
        title={`Commandes non soldées (${outstanding.length}) — reste à payer ${totalRemaining.toLocaleString('fr-FR')} CDF`}
      >
        <table className="erp-table">
          <thead>
            <tr><th>Commande</th><th>Date</th><th>Client</th><th>Total</th><th>Déjà payé</th><th>Reste à payer</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            {outstanding.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.orderNumber}</strong></td>
                <td>{new Date(o.createdAt).toLocaleDateString('fr-FR')}</td>
                <td>{o.client?.name ?? '—'}</td>
                <td>{o.totalAmount.toLocaleString('fr-FR')} CDF</td>
                <td>{o.paidAmount.toLocaleString('fr-FR')} CDF</td>
                <td><strong>{o.remaining.toLocaleString('fr-FR')} CDF</strong></td>
                <td>
                  <StatusPill
                    status={o.paymentStatus === 'IMPAYEE' ? 'ALERTE' : 'EN_COURS'}
                    label={o.paymentStatus === 'IMPAYEE' ? 'Impayée' : 'Partielle'}
                  />
                </td>
                <td className="erp-row-actions">
                  {can('payments', 'create') && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => openForOrder(o)}>
                      Versement
                    </button>
                  )}
                  {can('payments', 'create') && Number(o.client?.advanceBalance ?? 0) > 0 && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => applyAdvance(o)}>
                      Solder avec l’avance ({Number(o.client?.advanceBalance).toLocaleString('fr-FR')} CDF)
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!outstanding.length && <p className="erp-table-empty">Toutes les commandes sont soldées.</p>}
      </ErpPanel>

      <div style={{ marginTop: 18 }} />

      <ErpPanel title={`Registre (${payments.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Date</th><th>Client</th><th>Commande</th><th>Montant</th><th>Mode</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
                <td>{p.client?.name ?? '—'}</td>
                <td>
                  {p.isAdvance
                    ? <StatusPill status="EN_COURS" label="Avance" />
                    : p.order?.orderNumber ?? '—'}
                </td>
                <td><strong>{Number(p.amount).toLocaleString('fr-FR')} CDF</strong></td>
                <td><StatusPill status="VALIDEE" label={methodLabel[p.method] ?? p.method} /></td>
                <td className="erp-row-actions">
                  <DocButton label="Reçu" onClick={() => printPaymentReceipt(p)} />
                  {can('payments', 'update') && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => {
                        setEditing(p);
                        setForm({
                          clientId: p.clientId ?? '',
                          orderId: p.orderId ?? '',
                          amount: Number(p.amount),
                          method: p.method as PaymentMethod,
                          reference: p.reference ?? '',
                          asAdvance: false,
                        });
                        setShowForm(true);
                      }}
                    >
                      Modifier
                    </button>
                  )}
                  {can('payments', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deletePayment(p.id).then(load)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <Modal title={editing ? 'Modifier l’encaissement' : 'Nouvel encaissement'} open={showForm} onClose={() => setShowForm(false)}>
        <ClientSituationPanel clientId={form.clientId} compact refreshKey={payments.length} />
        <form className="form-stack" onSubmit={submit}>
          {!editing && (
            <div className="form-group">
              <label>Nature</label>
              <select
                value={form.asAdvance ? 'AVANCE' : 'REGLEMENT'}
                onChange={(e) => setForm({ ...form, asAdvance: e.target.value === 'AVANCE', orderId: '' })}
              >
                <option value="REGLEMENT">Règlement — imputé sur les commandes dues</option>
                <option value="AVANCE">Avance — gardée au crédit du client</option>
              </select>
              {form.asAdvance && (
                <p className="erp-muted">
                  Le montant reste disponible et servira à solder une commande, maintenant depuis
                  la liste des commandes non soldées ou automatiquement à la prochaine commande.
                </p>
              )}
            </div>
          )}
          <div className="form-group">
            <label>Client</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value, orderId: '' })}
              required={form.asAdvance}
            >
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!editing && !form.asAdvance && (
            <div className="form-group">
              <label>Commande réglée</label>
              <select
                value={form.orderId}
                onChange={(e) => {
                  const order = outstanding.find((o) => o.id === e.target.value);
                  setForm({
                    ...form,
                    orderId: e.target.value,
                    clientId: order?.client?.id ?? form.clientId,
                    amount: order ? order.remaining : form.amount,
                  });
                }}
              >
                <option value="">Aucune (encaissement libre)</option>
                {eligibleOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — reste {o.remaining.toLocaleString('fr-FR')} CDF
                  </option>
                ))}
              </select>
              {selectedOrder && (
                <p className="erp-muted">
                  Total {selectedOrder.totalAmount.toLocaleString('fr-FR')} CDF, déjà payé{' '}
                  {selectedOrder.paidAmount.toLocaleString('fr-FR')} CDF.
                </p>
              )}
            </div>
          )}
          <div className="form-group">
            <label>Montant (CDF)</label>
            <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
            <p className="erp-muted">
              Un versement partiel comme un versement en surplus sont acceptés.
            </p>
          </div>
          {preview && (preview.lines.length > 0 || preview.advance > 0) && (
            <div className="allocation-preview">
              <strong>Répartition prévue</strong>
              <ul>
                {preview.lines.map((l) => (
                  <li key={l.orderId}>
                    {l.orderNumber} : {l.allocated.toLocaleString('fr-FR')} CDF
                    {l.allocated >= l.due ? ' (soldée)' : ` sur ${l.due.toLocaleString('fr-FR')} CDF`}
                  </li>
                ))}
                {preview.advance > 0 && (
                  <li className="is-advance">
                    Avance sur compte : {preview.advance.toLocaleString('fr-FR')} CDF
                  </li>
                )}
              </ul>
            </div>
          )}
          <div className="form-group">
            <label>Mode</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
              {METHODS.map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Référence</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Enregistrer'}</button>
        </form>
      </Modal>
    </div>
  );
}
