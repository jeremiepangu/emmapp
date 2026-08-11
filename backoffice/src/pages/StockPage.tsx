import { useEffect, useState } from 'react';
import { api, StockItem } from '../api';

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);

  useEffect(() => {
    api.getStock().then(setItems);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Stocks</h2>
        <p>Produits finis et stock embarqué</p>
      </div>
      <div className="card">
        <table>
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
                <td>{item.product.name}</td>
                <td>{item.location.name}</td>
                <td>{item.lotNumber ?? '-'}</td>
                <td>
                  <strong>{item.quantity}</strong>
                  {item.quantity < 50 && (
                    <span className="badge badge-warning" style={{ marginLeft: 8 }}>Stock bas</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
