import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

function useCount(target: number, decimals = 0) {
  const [value, setValue] = useState('0');
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      const eased = 1 - (1 - p) ** 3;
      const n = target * eased;
      setValue(decimals ? n.toFixed(decimals).replace('.', ',') : String(Math.round(n)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, decimals]);
  return value;
}

const CATIONS = [
  { name: 'Calcium', value: 32, label: '32', unit: 'mg/L', max: 100 },
  { name: 'Magnésium', value: 8, label: '8', unit: 'mg/L', max: 100 },
  { name: 'Potassium', value: 1.2, label: '1,2', unit: 'mg/L', max: 100 },
  { name: 'Sodium', value: 9, label: '9', unit: 'mg/L', max: 100 },
];

const ANIONS = [
  { name: 'Bicarbonates', value: 98, label: '98', unit: 'mg/L', max: 120 },
  { name: 'Sulfates', value: 12, label: '12', unit: 'mg/L', max: 120 },
  { name: 'Silice', value: 9, label: '9', unit: 'mg/L', max: 120 },
  { name: 'Chlorures', value: 14, label: '14', unit: 'mg/L', max: 120 },
  { name: 'Nitrates', value: 2.1, label: '2,1', unit: 'mg/L', max: 120 },
];

const STEPS = [
  { n: '01', title: 'Captage', text: 'Ressource contrôlée et protégée à Kinshasa.' },
  { n: '02', title: 'Clarification', text: 'Coagulation, floculation, décantation.' },
  { n: '03', title: 'Filtration', text: 'Eau limpide, prête à la désinfection.' },
  { n: '04', title: 'Désinfection', text: 'Effet bactéricide et résiduel maîtrisé.' },
  { n: '05', title: 'Contrôle HACCP', text: 'Un lot non conforme n\'est pas libéré.' },
  { n: '06', title: 'Conditionnement', text: 'Bidons, bonbonnes, tournée client.' },
];

const FORMATS = [
  { vol: '5 L', name: 'Bidon quotidien', use: 'Familles et bureaux — compact, facile à porter.' },
  { vol: '10 L', name: 'Bidon foyer', use: 'Foyers et commerces — meilleur équilibre volume / prix.' },
  { vol: '20 L', name: 'Bonbonne consigne', use: 'Entreprises et points de vente — circuit réutilisable.' },
];

export default function WebsiteHomePage() {
  const ph = useCount(7.1, 1);
  const tds = useCount(165);
  const steps = useCount(6);

  return (
    <main>
      <section className="ws-hero" id="accueil">
        <div className="ws-hero-grid" aria-hidden />
        <div className="ws-hero-copy">
          <p className="ws-kicker"><span className="ws-live" /> Eau potable · Kinshasa</p>
          <h1>L&apos;eau saine, livrée et contrôlée chaque jour.</h1>
          <p className="ws-lead">
            EMMANUEL SERVICES SARLU traite, conditionne et distribue une eau de boisson claire,
            au goût frais, depuis Bandalungwa jusqu&apos;à votre porte.
          </p>
          <div className="ws-hero-cta">
            <a href="#eau" className="ws-btn ws-btn--light">Voir notre eau</a>
            <Link to="/portail/inscription" className="ws-btn">Commander</Link>
          </div>
          <dl className="ws-hud">
            <div><dt>pH</dt><dd>{ph}</dd></div>
            <div><dt>Résidu sec</dt><dd>{tds}<small> mg/L</small></dd></div>
            <div><dt>Étapes</dt><dd>{steps}</dd></div>
            <div><dt>Statut</dt><dd className="ws-ok">OK</dd></div>
          </dl>
        </div>
        <div className="ws-hero-visual" aria-hidden>
          <div className="ws-core">
            <span className="ws-core-ring" />
            <span className="ws-core-ring ws-core-ring--2" />
            <span className="ws-core-ring ws-core-ring--3" />
            <img src="/logo-emmanuel-services.png" alt="" />
          </div>
        </div>
      </section>

      <section className="ws-section" id="systeme">
        <p className="ws-kicker">Pourquoi nous</p>
        <h2>Qualité, traçabilité et livraison, sans friction.</h2>
        <p className="ws-intro">Chaque lot est analysé. Chaque tournée est suivie. Chaque client commande en quelques clics.</p>
        <div className="ws-cards">
          <article>
            <span className="ws-chip">LAB</span>
            <h3>Contrôle HACCP</h3>
            <p>pH, microbiologie, minéraux : un lot non conforme n&apos;entre pas dans le circuit commercial.</p>
          </article>
          <article>
            <span className="ws-chip">IOT</span>
            <h3>Usine connectée</h3>
            <p>Capteurs et alertes pour une production qui réagit en temps réel.</p>
          </article>
          <article>
            <span className="ws-chip">GPS</span>
            <h3>Livraison Kinshasa</h3>
            <p>Tournées, consignes de bonbonnes et suivi jusqu&apos;au seuil du client.</p>
          </article>
        </div>
      </section>

      <section className="ws-section ws-lab" id="eau">
        <p className="ws-kicker">Notre eau</p>
        <h2>Une signature minérale claire, lot après lot.</h2>
        <p className="ws-intro">Profil type issu de nos analyses à Bandalungwa. Goût frais, minéralité légère, pH proche de la neutralité.</p>
        <div className="ws-ph">
          <div className="ws-ph-ring" style={{ ['--p' as string]: '71%' }}>
            <strong>7,1</strong>
            <span>pH</span>
          </div>
          <p>Neutre, confortable pour l&apos;hydratation quotidienne de toute la famille.</p>
        </div>
        <div className="ws-mineral-grid">
          <div className="ws-lab-panel">
            <h3>Cations</h3>
            <ul className="ws-minerals">
              {CATIONS.map((m) => (
                <li key={m.name}>
                  <div className="ws-mineral-row">
                    <span>{m.name}</span>
                    <strong>{m.label}</strong>
                    <small>{m.unit}</small>
                  </div>
                  <span className="ws-bar" style={{ ['--p' as string]: `${Math.round((m.value / m.max) * 100)}%` }} />
                </li>
              ))}
            </ul>
          </div>
          <div className="ws-lab-panel">
            <h3>Anions</h3>
            <ul className="ws-minerals">
              {ANIONS.map((m) => (
                <li key={m.name}>
                  <div className="ws-mineral-row">
                    <span>{m.name}</span>
                    <strong>{m.label}</strong>
                    <small>{m.unit}</small>
                  </div>
                  <span className="ws-bar" style={{ ['--p' as string]: `${Math.round((m.value / m.max) * 100)}%` }} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="ws-residue">Minéralité totale à 180 °C · <strong>165 mg/L</strong> · <span className="ws-ok">LIBÉRÉ</span></p>
      </section>

      <section className="ws-section" id="origine">
        <p className="ws-kicker">Origine</p>
        <h2>Six étapes. De la ressource à votre table.</h2>
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

      <section className="ws-section" id="produits">
        <p className="ws-kicker">Produits</p>
        <h2>Le format qu&apos;il vous faut, livré ou à emporter.</h2>
        <div className="ws-cards">
          {FORMATS.map((f) => (
            <article key={f.vol} className="ws-product">
              <div className="ws-vol">{f.vol}</div>
              <h3>{f.name}</h3>
              <p>{f.use}</p>
            </article>
          ))}
        </div>
        <div className="ws-band ws-band--in">
          <div>
            <h2>Commandez en autonomie.</h2>
            <p>Créez un compte, choisissez vos formats, suivez la tournée et les consignes.</p>
            <div className="ws-hero-cta">
              <Link to="/portail/inscription" className="ws-btn ws-btn--light">Créer un compte</Link>
              <Link to="/portail/connexion" className="ws-btn">J&apos;ai déjà un compte</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ws-section" id="engagement">
        <p className="ws-kicker">Engagement</p>
        <h2>Préserver la ressource, sans relâcher la qualité.</h2>
        <div className="ws-cards">
          <article>
            <span className="ws-chip">LOOP</span>
            <h3>Consignes réutilisables</h3>
            <p>Les bonbonnes reviennent, sont contrôlées et remises en circuit.</p>
          </article>
          <article>
            <span className="ws-chip">ROUTE</span>
            <h3>Tournées sobres</h3>
            <p>Itinéraires optimisés, moins de kilomètres à vide.</p>
          </article>
          <article>
            <span className="ws-chip">GATE</span>
            <h3>Zéro compromis</h3>
            <p>Un lot non conforme n&apos;est jamais commercialisé.</p>
          </article>
        </div>
      </section>

      <section className="ws-section" id="contact">
        <p className="ws-kicker">Contact</p>
        <h2>Une ligne directe vers Bandalungwa.</h2>
        <div className="ws-cards">
          <article>
            <span className="ws-chip">TEL</span>
            <h3>Téléphone</h3>
            <p><a href="tel:+243813170215">+243 813 170 215</a></p>
          </article>
          <article>
            <span className="ws-chip">MAIL</span>
            <h3>E-mail</h3>
            <p><a href="mailto:contact@emmas.cd">contact@emmas.cd</a></p>
          </article>
          <article>
            <span className="ws-chip">ID</span>
            <h3>Identifiants</h3>
            <p>RCCM KNG/RCCM/24-B-02180<br />IMPOT A2425053J<br />ID NAT 01-F4300-N64238H</p>
          </article>
        </div>
        <div className="ws-hero-cta" style={{ marginTop: 28 }}>
          <Link to="/portail/inscription" className="ws-btn">Créer un compte et commander</Link>
        </div>
      </section>
    </main>
  );
}
