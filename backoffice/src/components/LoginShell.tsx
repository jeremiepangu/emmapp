import { ReactNode } from 'react';

const LOGO = '/logo-emmanuel-services.png';

function WaterDrops() {
  const drops = [
    { x: 70, y: 40, s: 1.15, r: -18 },
    { x: 150, y: 280, s: 1.7, r: 8 },
    { x: 40, y: 560, s: 0.9, r: -6 },
    { x: 220, y: 620, s: 0.55, r: 14 },
    { x: 820, y: 70, s: 1.05, r: 16 },
    { x: 900, y: 260, s: 1.85, r: -10 },
    { x: 780, y: 480, s: 1.25, r: 22 },
    { x: 930, y: 640, s: 0.8, r: -4 },
    { x: 430, y: 700, s: 0.5, r: 10 },
    { x: 560, y: 30, s: 0.42, r: -20 },
  ];
  return (
    <svg className="es-login-drops" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="esDropFill" cx="34%" cy="26%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.82" />
          <stop offset="22%" stopColor="#d7eeff" stopOpacity="0.42" />
          <stop offset="62%" stopColor="#7eb8f4" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1a4fa0" stopOpacity="0.06" />
        </radialGradient>
        <linearGradient id="esDropEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {drops.map((d, i) => (
        <g key={i} transform={`translate(${d.x} ${d.y}) rotate(${d.r}) scale(${d.s})`}>
          <path
            fill="url(#esDropFill)"
            stroke="url(#esDropEdge)"
            strokeWidth="1.2"
            d="M32 2C32 2 4 48 4 74a28 28 0 0 0 56 0C60 48 32 2 32 2z"
          />
          <ellipse cx="22" cy="48" rx="8" ry="16" fill="#fff" opacity="0.38" />
          <ellipse cx="26" cy="28" rx="4" ry="7" fill="#fff" opacity="0.55" />
        </g>
      ))}
    </svg>
  );
}

export default function LoginShell({ children, extras }: { children: ReactNode; extras?: ReactNode }) {
  return (
    <div className="es-login">
      <div className="es-login-vignette" aria-hidden />
      <div className="es-login-halftone" aria-hidden />
      <WaterDrops />
      <main className="es-login-center">
        <div className="es-login-emblem">
          <img src={LOGO} alt="Emmanuel Services" />
        </div>
        <div className="es-login-card">{children}</div>
        {extras}
      </main>
    </div>
  );
}
