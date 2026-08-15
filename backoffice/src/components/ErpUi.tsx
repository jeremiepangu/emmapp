import { ReactNode } from 'react';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  BROUILLON: { label: 'Brouillon', className: 'erp-pill erp-pill--gray' },
  VALIDEE: { label: 'Validée', className: 'erp-pill erp-pill--green' },
  EN_PREPARATION: { label: 'En préparation', className: 'erp-pill erp-pill--orange' },
  CHARGEE: { label: 'Chargée', className: 'erp-pill erp-pill--blue' },
  EN_LIVRAISON: { label: 'En livraison', className: 'erp-pill erp-pill--blue' },
  LIVREE: { label: 'Livrée', className: 'erp-pill erp-pill--green' },
  ANNULEE: { label: 'Annulée', className: 'erp-pill erp-pill--red' },
  PLANIFIEE: { label: 'Planifiée', className: 'erp-pill erp-pill--blue' },
  EN_COURS: { label: 'En cours', className: 'erp-pill erp-pill--orange' },
  TERMINEE: { label: 'Terminée', className: 'erp-pill erp-pill--green' },
  EN_ATTENTE: { label: 'En attente', className: 'erp-pill erp-pill--orange' },
  CONFORME: { label: 'Conforme', className: 'erp-pill erp-pill--green' },
  NON_CONFORME: { label: 'Non conforme', className: 'erp-pill erp-pill--red' },
  EN_CHARGEMENT: { label: 'En chargement', className: 'erp-pill erp-pill--orange' },
  UP: { label: 'En ligne', className: 'erp-pill erp-pill--green' },
  DOWN: { label: 'Hors ligne', className: 'erp-pill erp-pill--red' },
  LIBERE: { label: 'Libéré', className: 'erp-pill erp-pill--green' },
  BLOQUE: { label: 'Bloqué', className: 'erp-pill erp-pill--red' },
  QUARANTAINE: { label: 'Quarantaine', className: 'erp-pill erp-pill--orange' },
  ALERTE: { label: 'Alerte', className: 'erp-pill erp-pill--orange' },
  OUVERTE: { label: 'Ouverte', className: 'erp-pill erp-pill--red' },
  RESOLUE: { label: 'Résolue', className: 'erp-pill erp-pill--green' },
  IGNOREE: { label: 'Ignorée', className: 'erp-pill erp-pill--gray' },
  FAIBLE: { label: 'Faible', className: 'erp-pill erp-pill--green' },
  MOYENNE: { label: 'Moyenne', className: 'erp-pill erp-pill--orange' },
  ELEVEE: { label: 'Élevée', className: 'erp-pill erp-pill--orange' },
  CRITIQUE: { label: 'Critique', className: 'erp-pill erp-pill--red' },
  ACTIF: { label: 'Actif', className: 'erp-pill erp-pill--green' },
  HORS_LIGNE: { label: 'Hors ligne', className: 'erp-pill erp-pill--red' },
  MAINTENANCE: { label: 'Maintenance', className: 'erp-pill erp-pill--orange' },
  ANALYSEE: { label: 'Analysée', className: 'erp-pill erp-pill--blue' },
  CLOTUREE: { label: 'Clôturée', className: 'erp-pill erp-pill--green' },
  NOUVELLE: { label: 'Nouvelle', className: 'erp-pill erp-pill--blue' },
  EN_NEGOCIATION: { label: 'En négociation', className: 'erp-pill erp-pill--orange' },
  ACCEPTEE: { label: 'Acceptée', className: 'erp-pill erp-pill--green' },
  REFUSEE: { label: 'Refusée', className: 'erp-pill erp-pill--red' },
  STOCK: { label: 'Stock', className: 'erp-pill erp-pill--orange' },
  CONSIGNE: { label: 'Consigne', className: 'erp-pill erp-pill--blue' },
  ENCAISSEMENT: { label: 'Encaissement', className: 'erp-pill erp-pill--green' },
  PRODUCTION: { label: 'Production', className: 'erp-pill erp-pill--blue' },
  CAPTEUR: { label: 'Capteur', className: 'erp-pill erp-pill--orange' },
};

export default function StatusPill({ status, label }: { status: string; label?: string }) {
  const cfg = STATUS_MAP[status] ?? { label: label ?? status, className: 'erp-pill erp-pill--gray' };
  return <span className={cfg.className}>{label ?? cfg.label}</span>;
}

export function ErpPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="erp-page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="erp-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="erp-page-title-right">{actions}</div>}
    </div>
  );
}

export function ErpPanel({
  title,
  children,
  actions,
  padded,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="erp-panel">
      <div className="erp-panel-head">
        <h3>{title}</h3>
        {actions && <div className="erp-panel-actions">{actions}</div>}
      </div>
      <div className={`erp-panel-body${padded ? ' erp-panel-body--padded' : ''}`}>{children}</div>
    </div>
  );
}

export function RingGauge({ value, label, color = '#5cb85c' }: { value: number; label: string; color?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="erp-ring-gauge">
      <div
        className="erp-ring"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, #e9ecef ${pct * 3.6}deg)` }}
      >
        <div className="erp-ring-inner" style={{ color }}>{pct}%</div>
      </div>
      <p>{label}</p>
    </div>
  );
}
