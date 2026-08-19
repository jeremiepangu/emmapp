import { FormEvent, useEffect, useState } from 'react';
import { api, LoyaltyClient } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printLoyaltyList, printLoyaltySheet } from '../documents/templates';

const tierLabel: Record<string, string> = { BRONZE: 'Bronze', ARGENT: 'Argent', OR: 'Or', PLATINE: 'Platine' };

export default function LoyaltyPage() {
  const { can } = usePermissions();
  const [clients, setClients] = useState<LoyaltyClient[]>([]);
  const [points, setPoints] = useState<Record<string, number>>({});
  const load = () => api.getLoyaltyClients().then(setClients);
  useEffect(() => { load(); }, []);

  const credit = async (e: FormEvent, clientId: string) => {
    e.preventDefault();
    await api.creditLoyalty(clientId, Number(points[clientId] || 0));
    setPoints({ ...points, [clientId]: 0 });
    await load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Fidélité"
        subtitle="Barème : Bonbonne 19L = 10 pts · Bidon 25L = 8 pts · Bidon 10L = 4 pts · Wallet prépayé"
        actions={<DocButton label="Imprimer le registre" onClick={() => printLoyaltyList(clients)} />}
      />
      <ErpPanel title={`Clients fidélité (${clients.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Client</th><th>Segment</th><th>Points</th><th>Statut</th><th>Wallet (CDF)</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.segment}</td>
                <td>
                  {can('loyalty', 'update') ? (
                    <input
                      type="number"
                      defaultValue={c.loyaltyPoints}
                      style={{ width: 80 }}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== c.loyaltyPoints) api.updateLoyalty(c.id, { loyaltyPoints: value }).then(load);
                      }}
                    />
                  ) : (
                    c.loyaltyPoints
                  )}
                </td>
                <td><StatusPill status="VALIDEE" label={tierLabel[c.loyaltyTier] ?? c.loyaltyTier} /></td>
                <td>
                  {can('loyalty', 'update') ? (
                    <input
                      type="number"
                      defaultValue={Number(c.walletBalance)}
                      style={{ width: 110 }}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== Number(c.walletBalance)) api.updateLoyalty(c.id, { walletBalance: value }).then(load);
                      }}
                    />
                  ) : (
                    Number(c.walletBalance).toLocaleString('fr-FR')
                  )}
                </td>
                <td>
                  <div className="erp-row-actions">
                    <DocButton onClick={() => printLoyaltySheet(c)} />
                    {can('loyalty', 'create') && (
                      <form className="erp-row-actions" onSubmit={(e) => credit(e, c.id)}>
                        <input type="number" style={{ width: 80 }} value={points[c.id] ?? 0} onChange={(e) => setPoints({ ...points, [c.id]: Number(e.target.value) })} />
                        <button type="submit" className="erp-btn erp-btn--sm">Créditer</button>
                      </form>
                    )}
                    {can('loyalty', 'delete') && c.loyaltyPoints > 0 && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.resetLoyalty(c.id).then(load)}>Réinitialiser</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
