import { useEffect, useState } from 'react';
import { api, Product } from '../api';
import { EmmaFormatBadge } from '../components/EmmaBrand';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.getProducts().then(setProducts);
  }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Produits"
        subtitle="Catalogue bidons et bonbonnes — formats étiquetés EMMAS"
      />
      <div className="emma-product-grid" style={{ marginBottom: 24 }}>
        {products.map((p) => (
          <article key={p.id} className="emma-product-card">
            <div className="emma-product-cap" />
            <EmmaFormatBadge format={p.format} />
            <h3>{p.name}</h3>
            <p className="emma-product-code">{p.code}</p>
            <p className="emma-product-price">{Number(p.unitPrice).toLocaleString('fr-FR')} CDF</p>
            <span className={`emma-product-tag ${p.isReusable ? 'reusable' : ''}`}>
              {p.isReusable ? 'Consigné · réutilisable' : 'Usage unique'}
            </span>
          </article>
        ))}
      </div>
      <ErpPanel title="Tableau des produits">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Format</th>
              <th>Prix (CDF)</th>
              <th>Réutilisable</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.code}</strong></td>
                <td>{p.name}</td>
                <td><EmmaFormatBadge format={p.format} /></td>
                <td>{Number(p.unitPrice).toLocaleString('fr-FR')}</td>
                <td>{p.isReusable ? '✓ Oui' : 'Non'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
