import { Link } from 'react-router-dom';

export default function WebsiteHomePage() {
  return (
    <main>
      <section className="ws-hero">
        <div className="ws-hero-copy">
          <p className="ws-kicker">Traitement et commercialisation · Kinshasa</p>
          <h1>Une eau potable contrôlée, pour hydrater Kinshasa chaque jour.</h1>
          <p className="ws-lead">
            EMMANUEL SERVICES SARLU produit, conditionne et livre une eau de boisson saine,
            au goût frais et léger, issue d&apos;un traitement maîtrisé à Bandalungwa.
          </p>
          <div className="ws-hero-cta">
            <Link to="/eau" className="ws-btn ws-btn--light">Découvrir notre eau</Link>
            <Link to="/portail/connexion" className="ws-btn">Commander</Link>
          </div>
        </div>
        <div className="ws-hero-visual" aria-hidden>
          <img src="/logo-emmanuel-services.png" alt="" />
        </div>
      </section>

      <section className="ws-section">
        <p className="ws-kicker">Pourquoi nous choisir</p>
        <h2>Convaincus que l&apos;eau de qualité est essentielle à la vie.</h2>
        <p className="ws-intro">
          Nous préservons la ressource, contrôlons chaque lot et livrons jusqu&apos;au seuil
          des familles, commerces et institutions de Kinshasa.
        </p>
        <div className="ws-cards">
          <article>
            <h3>Peu minéralisée</h3>
            <p>Une alliance équilibrée de minéraux, pour un goût frais adapté à l&apos;hydratation quotidienne de tous.</p>
          </article>
          <article>
            <h3>Contrôlée HACCP</h3>
            <p>Chaque production est suivie : potabilité, pH, microbiologie et étiquetage avant libération du lot.</p>
          </article>
          <article>
            <h3>Livrée chez vous</h3>
            <p>Tournées Kinshasa, consignes de bonbonnes et portail client pour commander en autonomie.</p>
          </article>
        </div>
      </section>

      <section className="ws-band">
        <div>
          <p className="ws-kicker ws-kicker--light">Composition</p>
          <h2>Des minéraux naturellement présents, un goût net.</h2>
          <p>
            Notre eau contient des électrolytes qui participent à sa fraîcheur.
            Consultez le détail des cations, anions, du résidu sec et du pH.
          </p>
          <Link to="/eau" className="ws-btn ws-btn--light">Caractéristiques de l&apos;eau</Link>
        </div>
        <ul className="ws-mini-minerals">
          <li><strong>32</strong> Calcium</li>
          <li><strong>8</strong> Magnésium</li>
          <li><strong>7,1</strong> pH</li>
          <li><strong>165</strong> Résidu sec</li>
        </ul>
      </section>

      <section className="ws-section ws-split">
        <div>
          <p className="ws-kicker">Origine</p>
          <h2>Née d&apos;un traitement exigeant, au cœur de Kinshasa.</h2>
          <p>
            Avant d&apos;être mise en bidon et d&apos;arriver jusqu&apos;à vous, l&apos;eau emprunte un parcours
            de captage, filtration, désinfection et contrôle qualité dans notre unité de Bandalungwa.
          </p>
          <Link to="/origine" className="ws-text-link">Voir le parcours de l&apos;eau →</Link>
        </div>
        <div>
          <p className="ws-kicker">Engagement</p>
          <h2>Une hydratation plus responsable.</h2>
          <p>
            Consignes réutilisables, tournées optimisées, suivi ESG : nous limitons l&apos;impact
            tout en rendant l&apos;eau potable accessible dans les communes de Kinshasa.
          </p>
          <Link to="/engagement" className="ws-text-link">Notre engagement →</Link>
        </div>
      </section>
    </main>
  );
}
