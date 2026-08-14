import { useEffect, useState } from 'react';
import { api, StockItem } from '../api';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);

  useEffect(() => {
    api.getStock().then(setItems);
  }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Stocks"
        subtitle="Produits finis et stock embarqué"
      />
      <ErpPanel title={`Inventaire (${items.length} lignes)`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Emplacement</th>
              <th>Lot</th>
              <th>Quantité</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.product.name}</strong></td>
                <td>{item.location.name}</td>
                <td>{item.lotNumber ?? '—'}</td>
                <td>
                  <strong>{item.quantity}</strong>
                  {item.quantity < 50 && (
                    <StatusPill status="ALERTE" label="Stock bas" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
