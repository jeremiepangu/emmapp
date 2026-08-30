import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

const HERO_POINTS = [
  'Livraison suivie jusqu’au seuil',
  'Service week-end sur demande',
  'Lots analysés avant mise en vente',
  'Sans engagement, commande à la demande',
];

const SERVICES = [
  { title: 'Bidons & bonbonnes', text: 'Formats 5 L, 10 L et 20 L consignés, pour le foyer comme pour le point de vente.' },
  { title: 'Livraison domicile', text: 'Tournées à Kinshasa, chauffeur dédié, suivi jusqu’à la porte.' },
  { title: 'Entreprises & bureaux', text: 'Approvisionnement régulier, consignes de bonbonnes et facturation portail.' },
  { title: 'Hôtels & restaurants', text: 'Volumes adaptés, horaires de livraison convenus, relances simples.' },
  { title: 'Contrôle HACCP', text: 'Un lot non conforme n’entre pas dans le circuit commercial.' },
  { title: 'Consignes réutilisables', text: 'Circuit de bonbonnes suivi, moins de plastique à usage unique.' },
  { title: 'Portail client', text: 'Commandez, suivez et historisez vos livraisons depuis votre compte.' },
  { title: 'Tournées Kinshasa', text: 'Itinéraires optimisés dans les communes, de Bandalungwa à la Gombe.' },
  { title: 'Conseil format', text: 'On vous oriente vers le volume juste : quotidien, foyer ou entreprise.' },
];

const CHECKS = [
  'Équipe dédiée à la tournée',
  'Analyses de lot avant libération',
  'Satisfaction suivie après livraison',
  'Conditionnement maîtrisé',
  'Traçabilité des consignes',
  'Livraison dans les délais convenus',
];

const PRODUCTS = [
  { vol: '5 L', name: 'Bidon quotidien', use: 'Familles et bureaux — compact, facile à porter. 9 000 CDF · offre 10+1.' },
  { vol: '10 L', name: 'Bidon foyer', use: 'Foyers et commerces — meilleur équilibre volume / prix.' },
  { vol: '19 L', name: 'Bonbonne consigne', use: 'Entreprises et points de vente — 40 000 CDF · offre 10+1.' },
];

const STEPS = [
  { n: '01', title: 'Captage', text: 'Ressource contrôlée et protégée à Kinshasa.' },
  { n: '02', title: 'Clarification', text: 'Coagulation, floculation, décantation.' },
  { n: '03', title: 'Filtration', text: 'Eau limpide, prête à la désinfection.' },
  { n: '04', title: 'Désinfection', text: 'Effet bactéricide et résiduel maîtrisé.' },
  { n: '05', title: 'Contrôle HACCP', text: 'Un lot non conforme n’est pas libéré.' },
  { n: '06', title: 'Conditionnement', text: 'Bidons, bonbonnes, tournée client.' },
];

const MINERALS = [
  { name: 'Calcium', value: '32 mg/L' },
  { name: 'Magnésium', value: '8 mg/L' },
  { name: 'Bicarbonates', value: '98 mg/L' },
  { name: 'pH', value: '7,1' },
];

const BENEFITS = [
  'Transporter nutriments et oxygène',
  'Aider la digestion',
  'Stabiliser la pression artérielle',
  'Soutenir un rythme cardiaque régulier',
];

const STAND = [
  'Chaque lot est analysé avant commercialisation.',
  'Prix affichés, sans surprise à la livraison.',
  'Consignes suivies, circuit réutilisable.',
  'Commande quand vous en avez besoin.',
  'Chauffeurs identifiés, tournée tracée.',
  'Écoute client, du premier appel au seuil.',
];

const TESTIMONIALS = [
  {
    quote: 'La livraison est ponctuelle, le chauffeur est courtois, et l’eau a un goût vraiment frais. On recommande à tout le quartier.',
    name: 'Maman Nana',
    city: 'Bandalungwa',
  },
  {
    quote: 'Nous avons ouvert un compte pour le supermarché. Les tournées et les consignes de bonbonnes sont suivies sans friction.',
    name: 'Kin Marché',
    city: 'Gombe',
  },
  {
    quote: 'L’équipe a été professionnelle du premier appel jusqu’à la livraison. L’eau est claire, et le portail client est simple.',
    name: 'Hôtel Kasaï',
    city: 'Ngaliema',
  },
];

function mailTo(fields: Record<string, string>, subject: string) {
  const body = encodeURIComponent(
    Object.entries(fields)
      .map(([k, v]) => `${k} : ${v}`)
      .join('\n'),
  );
  window.location.href = `mailto:contact@emmas.cd?subject=${encodeURIComponent(subject)}&body=${body}`;
}

export default function WebsiteHomePage() {
  const [booked, setBooked] = useState(false);
  const [sent, setSent] = useState(false);

  const onBook = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    mailTo(
      {
        Nom: String(data.get('name') ?? ''),
        Email: String(data.get('email') ?? ''),
        Téléphone: String(data.get('phone') ?? ''),
        Adresse: String(data.get('address') ?? ''),
        Date: String(data.get('date') ?? ''),
        Heure: String(data.get('time') ?? ''),
        Message: String(data.get('comments') ?? ''),
      },
      'Rendez-vous livraison Emmanuel Services',
    );
    setBooked(true);
  };

  const onEnquire = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    mailTo(
      {
        Nom: String(data.get('name') ?? ''),
        Email: String(data.get('email') ?? ''),
        Téléphone: String(data.get('phone') ?? ''),
        Message: String(data.get('message') ?? ''),
      },
      'Demande Emmanuel Services',
    );
    setSent(true);
  };

  return (
    <main>
      <section className="hl-hero" id="accueil">
        <div className="hl-hero-bg" aria-hidden />
        <div className="hl-wrap hl-hero-grid">
          <div className="hl-hero-copy">
            <h1>
              <span>Meilleure &amp; rapide</span>
              Livraison d’eau potable
            </h1>
            <ul>
              {HERO_POINTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <a href="#services" className="hl-btn hl-btn--sky">Voir les services</a>
          </div>
          <div className="hl-hero-visual">
            <img
              src="/emma-pure-banner.jpg?v=3"
              alt="EMMA PURE : bidon 5 L à 9 000 CDF et bonbonne 19 L à 40 000 CDF, offre 10+1. Nouvelle tarification dès le 1er novembre 2026."
            />
          </div>
          <form className="hl-book" onSubmit={onBook}>
            <h2>
              <span>Prendre</span>
              un rendez-vous
            </h2>
            <input name="name" placeholder="Nom :" required />
            <input name="email" type="email" placeholder="E-mail :" required />
            <input name="phone" type="tel" placeholder="Téléphone :" required />
            <input name="address" placeholder="Adresse :" />
            <div className="hl-book-row">
              <input name="date" type="date" aria-label="Date" />
              <input name="time" type="time" aria-label="Heure" />
            </div>
            <textarea name="comments" rows={3} placeholder="Commentaires" />
            <button type="submit" className="hl-btn hl-btn--red hl-btn--block">
              {booked ? 'Ouverture de votre messagerie…' : 'Prendre rendez-vous'}
            </button>
          </form>
        </div>
      </section>

      <section className="hl-strip">
        <div className="hl-wrap hl-strip-grid">
          <article>
            <span aria-hidden>☎</span>
            <div>
              <h3>Livraison urgente</h3>
              <p>Nous tournons 6 jours sur 7. Une rupture d’eau n’attend pas. <a href="tel:+243813170215">Appelez-nous maintenant.</a></p>
            </div>
          </article>
          <article>
            <span aria-hidden>⚙</span>
            <div>
              <h3>Approvisionnement régulier</h3>
              <p>Foyer, bureau ou commerce : on planifie vos consignes. <Link to="/portail/inscription">Commandez pour livrer.</Link></p>
            </div>
          </article>
        </div>
      </section>

      <section className="hl-section" id="apropos">
        <div className="hl-wrap hl-about">
          <div className="hl-about-visual">
            <img src="/emma-hero.png" alt="Eau Emmanuel Services" />
            <aside>
              <strong>HACCP</strong>
              <span>Lots contrôlés, lot après lot</span>
            </aside>
          </div>
          <div>
            <h2>L’eau que les foyers de Kinshasa nous confient, depuis Bandalungwa.</h2>
            <h4>Zone desservie : Kinshasa et communes alentours</h4>
            <p>EMMANUEL SERVICES SARLU traite, conditionne et livre une eau de boisson claire. Entreprise familiale, nous restons sur la conformité et la régularité des tournées.</p>
            <ul className="hl-checks">
              {CHECKS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="hl-section hl-section--tint" id="services">
        <div className="hl-wrap">
          <div className="hl-heading">
            <h2>Les services que nous proposons</h2>
            <p>Des bonbonnes consignées à la tournée entreprise, tout passe par le même contrôle de lot et le même suivi jusqu’au seuil.</p>
          </div>
          <div className="hl-services">
            {SERVICES.map((s) => (
              <article key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <Link to="/portail/inscription">En savoir plus</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hl-section" id="origine">
        <div className="hl-wrap hl-split">
          <div>
            <h2>Choisir le bon fournisseur d’eau</h2>
            <h4>Techniciens formés : chaque tournée est préparée, chaque lot est libéré seulement s’il est conforme.</h4>
            <p>Nous restons après la première livraison : consignes, relances, volumes, tout se suit dans le portail.</p>
            <ul className="hl-dots">
              <li>Bidons 5 L et 10 L</li>
              <li>Bonbonnes 19 L consignées</li>
              <li>Livraison domicile</li>
              <li>Comptes entreprises</li>
              <li>Suivi GPS des tournées</li>
              <li>Contrôle HACCP</li>
            </ul>
          </div>
          <div className="hl-experience">
            <strong>Qualité</strong>
            <span>d’abord, à chaque lot</span>
          </div>
        </div>
      </section>

      <section className="hl-section hl-section--tint" id="produits">
        <div className="hl-wrap">
          <div className="hl-heading">
            <h2>Le format qu’il vous faut</h2>
            <p>Nouvelle tarification à partir du 1er novembre 2026. Offre 10+1 sur le bidon 5 L et la bonbonne 19 L.</p>
          </div>
          <div className="hl-products">
            {PRODUCTS.map((p) => (
              <article key={p.vol}>
                <em>{p.vol}</em>
                <h3>{p.name}</h3>
                <p>{p.use}</p>
                <Link to="/portail/inscription" className="hl-btn hl-btn--red">Commander</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hl-section">
        <div className="hl-wrap">
          <div className="hl-heading">
            <h2>Pourquoi nous nous distinguons</h2>
            <p>Pas de contrat forcé. Une eau contrôlée, un chauffeur identifié, un portail pour commander quand vous en avez besoin.</p>
          </div>
          <ul className="hl-stand">
            {STAND.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="hl-section hl-section--navy" id="qualite">
        <div className="hl-wrap hl-split">
          <div>
            <h2>Une signature minérale claire, lot après lot</h2>
            <p>Profil type issu de nos analyses à Bandalungwa. Goût frais, minéralité légère, pH proche de la neutralité.</p>
            <ul className="hl-minerals">
              {MINERALS.map((m) => (
                <li key={m.name}><span>{m.name}</span><strong>{m.value}</strong></li>
              ))}
            </ul>
            <p className="hl-residue">Minéralité totale à 180 °C · <strong>165 mg/L</strong> · Libéré</p>
          </div>
          <div>
            <h2>Essentielle pour une bonne santé</h2>
            <ul className="hl-checks hl-checks--light">
              {BENEFITS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="hl-section">
        <div className="hl-wrap">
          <div className="hl-heading">
            <h2>Ce que disent nos clients</h2>
            <p>Des foyers de Bandalungwa aux comptes entreprises de Gombe.</p>
          </div>
          <div className="hl-quotes">
            {TESTIMONIALS.map((t) => (
              <blockquote key={t.name}>
                <p>{t.quote}</p>
                <footer>— {t.name}, {t.city}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="hl-section hl-section--tint" id="contact">
        <div className="hl-wrap hl-contact">
          <div>
            <h2>Nous sommes là pour votre demande</h2>
            <p>Famille ou bureau : dites-nous le volume et la commune, on organise la tournée.</p>
            <p className="hl-contact-line">
              <a href="tel:+243813170215">+243 813 170 215</a>
              <a href="mailto:contact@emmas.cd">contact@emmas.cd</a>
            </p>
            <Link to="/portail/inscription" className="hl-btn hl-btn--navy">Créer un compte client</Link>
          </div>
          <form className="hl-form" onSubmit={onEnquire}>
            <h3>Envoyer un message</h3>
            <input name="name" placeholder="Nom complet" required />
            <input name="email" type="email" placeholder="E-mail" required />
            <input name="phone" type="tel" placeholder="Téléphone" />
            <textarea name="message" rows={4} placeholder="Votre message…" required />
            <button type="submit" className="hl-btn hl-btn--red">{sent ? 'Ouverture de votre messagerie…' : 'Envoyer'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
