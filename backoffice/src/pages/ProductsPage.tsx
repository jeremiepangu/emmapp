import { useEffect, useState } from 'react';
import { api, Product } from '../api';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.getProducts().then(setProducts);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Produits</h2>
        <p>Catalogue : sachets, bouteilles, bidons 5L et bonbonnes 19L</p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Format</th>
              <th>Prix unitaire (CDF)</th>
              <th>Réutilisable</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td><span className="badge badge-info">{p.format}</span></td>
                <td>{Number(p.unitPrice).toLocaleString()}</td>
                <td>{p.isReusable ? '✓ Oui' : 'Non'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
