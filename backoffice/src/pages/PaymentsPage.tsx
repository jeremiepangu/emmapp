import { useEffect, useState } from 'react';
import { api, Payment } from '../api';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

const methodLabel: Record<string, string> = {
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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    api.getPayments().then(setPayments);
  }, []);

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Paiements"
        subtitle={`Encaissements et suivi des règlements · Total : ${total.toLocaleString('fr-FR')} CDF`}
      />
      <ErpPanel title={`Registre (${payments.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Montant</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
                <td>{p.client?.name ?? '—'}</td>
                <td><strong>{Number(p.amount).toLocaleString('fr-FR')} CDF</strong></td>
                <td><StatusPill status="VALIDEE" label={methodLabel[p.method] ?? p.method} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
