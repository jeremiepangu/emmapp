const STEPS = [
  { n: '01', title: 'Captage', text: 'Ressource contrôlée, pompage et protection du point de prélèvement à Kinshasa.' },
  { n: '02', title: 'Clarification', text: 'Coagulation-floculation puis décantation pour retirer les matières en suspension.' },
  { n: '03', title: 'Filtration', text: 'Filtration sur masse filtrante pour une eau limpide, prête à la désinfection.' },
  { n: '04', title: 'Désinfection', text: 'Étape bactéricide et effet résiduel maîtrisé, conformément aux exigences de potabilité.' },
  { n: '05', title: 'Contrôle HACCP', text: 'Analyses physico-chimiques et microbiologiques. Un lot non conforme n\'est pas libéré.' },
  { n: '06', title: 'Conditionnement', text: 'Mise en bidons et bonbonnes, étiquetage, stockage et tournée vers les clients.' },
];

export default function WebsiteOriginPage() {
  return (
    <main>
      <section className="ws-page-hero">
        <p className="ws-kicker">Origine</p>
        <h1>De la ressource kinoise à votre table.</h1>
        <p className="ws-lead">
          Nous ne nous attribuons pas le mérite de la nature : nous lui devons tout.
          Notre rôle est de traiter, protéger et commercialiser une eau potable fiable,
          sans prélever plus que ce que la ressource et nos contrôles autorisent.
        </p>
      </section>
      <section className="ws-section">
        <h2>Un parcours de traitement en six étapes</h2>
        <ol className="ws-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span>{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="ws-band">
        <div>
          <h2>Bandalungwa, Kinshasa</h2>
          <p>
            Notre unité de production et notre dépôt de tournées sont établis à Bandalungwa.
            De là, les livreurs desservent les communes de la ville avec un suivi GPS et un bon de livraison.
          </p>
        </div>
      </section>
    </main>
  );
}
