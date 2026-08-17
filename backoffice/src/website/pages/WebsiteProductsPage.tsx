import { Link } from 'react-router-dom';

const FORMATS = [
  { name: 'Bidon 5 L', use: 'Familles et bureaux — format quotidien, facile à porter.' },
  { name: 'Bidon 10 L', use: 'Foyers et commerces de proximité — bon équilibre volume / prix.' },
  { name: 'Bonbonne 20 L', use: 'Points de vente et entreprises — consigne réutilisable.' },
];

export default function WebsiteProductsPage() {
  return (
    <main>
      <section className="ws-page-hero">
        <p className="ws-kicker">Produits</p>
        <h1>Les formats qu&apos;il vous faut, à emporter ou livrés.</h1>
        <p className="ws-lead">
          À glisser dans un commerce, à table ou en tournée : vous trouverez le conditionnement
          EMMANUEL SERVICES pour vous hydrater tout au long de la journée.
        </p>
      </section>
      <section className="ws-section ws-cards">
        {FORMATS.map((f) => (
          <article key={f.name}>
            <h3>{f.name}</h3>
            <p>{f.use}</p>
          </article>
        ))}
      </section>
      <section className="ws-band">
        <div>
          <h2>Commandez en autonomie</h2>
          <p>Portail client, suivi de livraison, consignes et fidélité — ou contactez un commercial.</p>
          <Link to="/portail/connexion" className="ws-btn ws-btn--light">Accéder au portail</Link>
        </div>
      </section>
    </main>
  );
}
