const CATIONS = [
  { name: 'Calcium', value: '32', unit: 'mg/L' },
  { name: 'Magnésium', value: '8', unit: 'mg/L' },
  { name: 'Potassium', value: '1,2', unit: 'mg/L' },
  { name: 'Sodium', value: '9', unit: 'mg/L' },
];

const ANIONS = [
  { name: 'Bicarbonates', value: '98', unit: 'mg/L' },
  { name: 'Sulfates', value: '12', unit: 'mg/L' },
  { name: 'Silice', value: '9', unit: 'mg/L' },
  { name: 'Chlorures', value: '14', unit: 'mg/L' },
  { name: 'Nitrates', value: '2,1', unit: 'mg/L' },
];

export default function WebsiteWaterPage() {
  return (
    <main>
      <section className="ws-page-hero">
        <p className="ws-kicker">Caractéristiques de l&apos;eau</p>
        <h1>Pourquoi choisir l&apos;eau potable EMMANUEL SERVICES, traitée à Kinshasa&nbsp;?</h1>
        <p className="ws-lead">
          Convaincus que l&apos;eau est essentielle à la vie, et indispensable à une hydratation saine*,
          nous contrôlons durablement notre production à Bandalungwa.
        </p>
        <p className="ws-note">
          *L&apos;eau (2 L/jour, toutes sources confondues) contribue au maintien de fonctions physiques
          et cognitives normales.
        </p>
      </section>

      <section className="ws-section">
        <div className="ws-mineral-grid">
          <div>
            <h2>Cations</h2>
            <ul className="ws-minerals">
              {CATIONS.map((m) => (
                <li key={m.name}>
                  <span>{m.name}</span>
                  <strong>{m.value}</strong>
                  <small>{m.unit}</small>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Anions</h2>
            <ul className="ws-minerals">
              {ANIONS.map((m) => (
                <li key={m.name}>
                  <span>{m.name}</span>
                  <strong>{m.value}</strong>
                  <small>{m.unit}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="ws-residue">Minéralité totale à 180 °C : <strong>165 mg/L</strong></p>
        <p className="ws-note">
          Valeurs types issues de nos contrôles qualité. Chaque lot est analysé avant commercialisation.
          L&apos;eau EMMANUEL SERVICES contient des électrolytes qui contribuent à son goût frais et naturel.
        </p>
      </section>

      <section className="ws-section ws-cards">
        <article>
          <h3>Une eau contrôlée et peu minéralisée</h3>
          <p>
            Dotée d&apos;une alliance équilibrée de minéraux, elle offre un goût frais et léger,
            adapté à toute la famille, aux bureaux et aux commerces de Kinshasa.
          </p>
        </article>
        <article>
          <h3>Née d&apos;un process préservé</h3>
          <p>
            Avant d&apos;être mise en bidon, l&apos;eau suit un traitement complet : clarification,
            filtration, désinfection et neutralisation, sous référentiel HACCP.
          </p>
        </article>
        <article>
          <h3>Un pH proche de la neutralité : 7,1</h3>
          <p>
            Un pH de 7,1 en fait une eau de boisson confortable pour l&apos;hydratation quotidienne de tous**.
          </p>
        </article>
      </section>
      <p className="ws-note ws-section" style={{ paddingTop: 0 }}>
        **L&apos;eau (2 L/jour, toutes sources confondues) contribue au maintien de fonctions physiques et cognitives normales.
      </p>
    </main>
  );
}
