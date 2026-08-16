/** Logo EMMAS — goutte d'eau + typographie étiquette */
export default function EmmaLogo({ size = 'md', variant = 'light' }: { size?: 'sm' | 'md' | 'lg'; variant?: 'light' | 'dark' }) {
  const cls = [
    'emma-logo',
    size === 'lg' ? 'emma-logo--lg' : size === 'sm' ? 'emma-logo--sm' : '',
    variant === 'light' ? 'emma-logo--on-dark' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <svg className="emma-logo-icon" viewBox="0 0 64 80" aria-hidden="true">
        <defs>
          <linearGradient id="emmaDrop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4db8ff" />
            <stop offset="45%" stopColor="#00a3ff" />
            <stop offset="100%" stopColor="#2c3e50" />
          </linearGradient>
        </defs>
        <path
          fill="url(#emmaDrop)"
          d="M32 4C32 4 8 36 8 52a24 24 0 0 0 48 0C56 36 32 4 32 4zm0 68a12 12 0 1 1 0-24 12 12 0 0 1 0 24z"
        />
        <ellipse cx="26" cy="44" rx="6" ry="10" fill="rgba(255,255,255,0.35)" />
      </svg>
      <div className="emma-logo-text">
        <span className="emma-logo-name">EMMAS</span>
        <span className="emma-logo-sub">Eau potable</span>
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
          fill="rgba(255,255,255,0.08)"
          d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L0,320Z"
        />
        <path
          fill="rgba(255,255,255,0.12)"
          d="M0,256L48,245.3C96,235,192,213,288,208C384,203,480,213,576,224C672,235,768,245,864,234.7C960,224,1056,192,1152,186.7C1248,181,1344,203,1392,213.3L1440,224L1440,320L0,320Z"
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
            <span>www.emmas.cd</span>
          </div>
        </div>
      </div>
    </div>
  );
}
