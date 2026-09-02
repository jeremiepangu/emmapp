const LOGO = '/logo-emmanuel-services.png';

/** Logo Emmanuel Services — emblème circulaire officiel */
export default function EmmaLogo({ size = 'md', variant = 'light' }: { size?: 'sm' | 'md' | 'lg'; variant?: 'light' | 'dark' }) {
  const cls = [
    'emma-logo',
    size === 'lg' ? 'emma-logo--lg' : size === 'sm' ? 'emma-logo--sm' : '',
    variant === 'light' ? 'emma-logo--on-dark' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <img className="emma-logo-icon emma-logo-img" src={LOGO} alt="Emmanuel Services" />
      <div className="emma-logo-text">
        <span className="emma-logo-name">Emmanuel Services</span>
        <span className="emma-logo-sub">SARLU · Eau potable</span>
      </div>
    </div>
  );
}

/** Badge format bidon (5L, 10L…) style étiquette */
export function EmmaFormatBadge({ format }: { format: string }) {
  const label = format.replace('BIDON_', 'Bidon ').replace('BONBONNE_', 'Bonbonne ').replace('_', ' ');
  return <span className="emma-format-badge">{label}</span>;
}

/** Bandeau décoratif vagues (fond de page) */
export function EmmaWaveBg() {
  return (
    <div className="emma-wave-bg" aria-hidden="true">
      <svg viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="rgba(64, 191, 255, 0.12)"
          d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1334,181,1392,154.7L1440,128L1440,320L0,320Z"
        />
        <path
          fill="rgba(64, 191, 255, 0.18)"
          d="M0,256L48,245.3C96,235,192,213,288,208C384,203,480,213,576,224C672,235,768,245,864,234.7C960,224,1056,192,1152,186.7C1248,181,1334,203,1392,213.3L1440,224L1440,320L0,320Z"
        />
      </svg>
    </div>
  );
}

/** Visuel étiquette bidon 5L (panneau login) */
export function EmmaLabelPanel() {
  return (
    <div className="emma-label-panel">
      <div className="emma-label-bottle">
        <div className="emma-label-cap" />
        <div className="emma-label-body">
          <EmmaLogo size="lg" />
          <div className="emma-label-volume">5 L</div>
          <p className="emma-label-claim">
            Consommer de l&apos;eau de bonne qualité est essentiel pour maintenir une bonne santé.
          </p>
          <div className="emma-label-strip">
            <span>Kinshasa · Bandalungwa</span>
            <span>EMMANUEL SERVICES SARLU</span>
          </div>
        </div>
      </div>
    </div>
  );
}
