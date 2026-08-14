import { useEffect, useState } from 'react';
import { api, Payment } from '../api';

const methodLabel: Record<string, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  CREDIT: 'Crédit',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    api.getPayments().then(setPayments);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Paiements</h2>
        <p>Encaissements et suivi des règlements</p>
      </div>
      <div className="card table-card">
        <table>
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
                <td>{p.client?.name ?? '-'}</td>
                <td>{Number(p.amount).toLocaleString('fr-FR')} CDF</td>
                <td><span className="badge badge-success">{methodLabel[p.method] ?? p.method}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
