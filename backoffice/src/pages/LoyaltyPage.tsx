import { useEffect, useState } from 'react';
import { api, LoyaltyClient } from '../api';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

const tierLabel: Record<string, string> = {
  BRONZE: 'Bronze',
  ARGENT: 'Argent',
  OR: 'Or',
  PLATINE: 'Platine',
};

export default function LoyaltyPage() {
  const [clients, setClients] = useState<LoyaltyClient[]>([]);

  useEffect(() => {
    api.getLoyaltyClients().then(setClients);
  }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Fidélité"
        subtitle="Barème : Bonbonne 19L = 10 pts · Bidon 25L = 8 pts · Bidon 10L = 4 pts · Wallet prépayé"
      />
      <ErpPanel title={`Clients fidélité (${clients.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Client</th><th>Segment</th><th>Points</th><th>Statut</th><th>Wallet (CDF)</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.segment}</td>
                <td>{c.loyaltyPoints}</td>
                <td><StatusPill status="VALIDEE" label={tierLabel[c.loyaltyTier] ?? c.loyaltyTier} /></td>
                <td>{Number(c.walletBalance).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
