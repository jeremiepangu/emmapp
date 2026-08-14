export default function EmmaFooter() {
  return (
    <footer className="emma-footer">
      <p className="emma-tagline">
        Consommer de l&apos;eau de bonne qualité est essentiel pour maintenir une bonne santé.
      </p>
      <div className="emma-footer-grid">
        <div>
          <strong>EMMAS</strong> — Kinshasa, Bandalungwa, RDC
        </div>
        <div>
          <a href="tel:+243813170215">+243 813 170 215</a>
          {' · '}
          <a href="mailto:contact@emmas.cd">contact@emmas.cd</a>
          {' · '}
          <a href="https://www.emmas.cd" target="_blank" rel="noreferrer">www.emmas.cd</a>
        </div>
        <div className="emma-legal">
          RCCM KNG/RCCM/24-B-02180 · IMPOT A2425053J · ID NAT 01-F4300-N64238H
        </div>
      </div>
    </footer>
  );
}
