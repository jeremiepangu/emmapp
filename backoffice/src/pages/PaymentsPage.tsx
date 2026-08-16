import { FormEvent, useEffect, useState } from 'react';
import { api, Client, Payment, PaymentMethod } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';

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
  const [form, setForm] = useState({ clientId: '', amount: 0, method: 'ESPECES' as PaymentMethod, reference: '' });

  const load = () => api.getPayments().then(setPayments);
  useEffect(() => { load(); api.getClients().then(setClients); }, []);

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api.createPayment({ clientId: form.clientId || undefined, amount: Number(form.amount), method: form.method, reference: form.reference || undefined });
    setShowForm(false);
    await load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Paiements"
        subtitle={`Encaissements et suivi des règlements · Total : ${total.toLocaleString('fr-FR')} CDF`}
        actions={can('payments', 'create') ? <button type="button" className="erp-btn" onClick={() => setShowForm(true)}>+ Encaissement</button> : undefined}
      />
      <ErpPanel title={`Registre (${payments.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Date</th><th>Client</th><th>Montant</th><th>Mode</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
                <td>{p.client?.name ?? '—'}</td>
                <td><strong>{Number(p.amount).toLocaleString('fr-FR')} CDF</strong></td>
                <td><StatusPill status="VALIDEE" label={methodLabel[p.method] ?? p.method} /></td>
                <td className="erp-row-actions">
                  {can('payments', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deletePayment(p.id).then(load)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <Modal title="Nouvel encaissement" open={showForm} onClose={() => setShowForm(false)}>
        <form className="form-stack" onSubmit={submit}>
          <div className="form-group">
            <label>Client</label>
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Montant (CDF)</label><input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required /></div>
          <div className="form-group">
            <label>Mode</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
              {METHODS.map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Référence</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          <button type="submit" className="erp-btn">Enregistrer</button>
        </form>
      </Modal>
    </div>
  );
}
