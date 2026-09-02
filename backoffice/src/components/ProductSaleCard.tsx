import { ReactNode } from 'react';

type BottleTone = { body: string; cap: string; shade: string };

const TONES: Record<string, BottleTone> = {
  BIDON_5L: { body: '#dbeafe', cap: '#2563eb', shade: '#bfdbfe' },
  BIDON_10L: { body: '#d9f2fb', cap: '#0ea5e9', shade: '#bae6fd' },
  BIDON_25L: { body: '#dcfce7', cap: '#16a34a', shade: '#bbf7d0' },
  BONBONNE_19L: { body: '#d6eefb', cap: '#1d4ed8', shade: '#b6dff5' },
};

function toneOf(format?: string): BottleTone {
  return TONES[format ?? ''] ?? TONES.BONBONNE_19L;
}

/** Illustration générée : les produits n'ont pas de photo en base. */
function BottleArt({ format }: { format?: string }) {
  const tone = toneOf(format);
  return (
    <svg viewBox="0 0 120 170" role="presentation" focusable="false">
      <rect x="49" y="4" width="22" height="16" rx="4" fill={tone.cap} />
      <rect x="53" y="18" width="14" height="12" fill={tone.shade} />
      <path
        d="M40 30h40c9 0 16 7 16 16v104c0 9-7 16-16 16H40c-9 0-16-7-16-16V46c0-9 7-16 16-16z"
        fill={tone.body}
      />
      <path d="M24 70h72v10H24zM24 108h72v10H24z" fill={tone.shade} />
      <path d="M34 44h10v100H34z" fill="#fff" opacity="0.55" />
      <circle cx="60" cy="94" r="20" fill={tone.cap} opacity="0.9" />
      <path
        d="M60 84c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z"
        fill="#fff"
      />
    </svg>
  );
}

export type ProductSaleCardProps = {
  name: string;
  format?: string;
  code?: string;
  /** Photo du produit ; une illustration est générée quand elle est absente. */
  imageUrl?: string | null;
  /** Prix unitaire déjà calculé (bonus appliqués le cas échéant). */
  price: number;
  currency?: string;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAdd?: () => void;
  addLabel?: string;
  metaLabel?: string;
  metaValue?: string;
  note?: ReactNode;
  badge?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  selected?: boolean;
};

export default function ProductSaleCard({
  name,
  format,
  code,
  imageUrl,
  price,
  currency = 'CDF',
  quantity,
  onQuantityChange,
  onAdd,
  addLabel = 'Ajouter au panier',
  metaLabel = 'Livraison',
  metaValue,
  note,
  badge,
  min = 0,
  max = 999,
  disabled = false,
  selected = false,
}: ProductSaleCardProps) {
  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  return (
    <article className={`psc-card${selected ? ' is-selected' : ''}`}>
      {badge && <span className="psc-badge">{badge}</span>}
      <div className="psc-visual">
        {imageUrl
          ? <img src={imageUrl} alt={name} />
          : <BottleArt format={format} />}
      </div>

      <div className="psc-bar">
        <div className="psc-qty">
          <span className="psc-qty-label">Quantité</span>
          <input
            type="number"
            value={quantity}
            min={min}
            max={max}
            aria-label={`Quantité pour ${name}`}
            onChange={(e) => onQuantityChange(clamp(Number(e.target.value) || 0))}
            disabled={disabled}
          />
          <span className="psc-stepper">
            <button
              type="button"
              aria-label="Augmenter la quantité"
              onClick={() => onQuantityChange(clamp(quantity + 1))}
              disabled={disabled || quantity >= max}
            >
              ▲
            </button>
            <button
              type="button"
              aria-label="Diminuer la quantité"
              onClick={() => onQuantityChange(clamp(quantity - 1))}
              disabled={disabled || quantity <= min}
            >
              ▼
            </button>
          </span>
        </div>
        <div className="psc-price">
          {Number(price).toLocaleString('fr-FR')} <small>{currency}</small>
        </div>
      </div>

      <h4 className="psc-name">{name}</h4>
      {(code || format) && (
        <p className="psc-ref">{[code, format].filter(Boolean).join(' · ')}</p>
      )}

      {metaValue && (
        <div className="psc-meta">
          <span className="psc-meta-label">{metaLabel}</span>
          <span className="psc-meta-value">{metaValue}</span>
        </div>
      )}

      {note && <div className="psc-note">{note}</div>}

      {onAdd && (
        <button type="button" className="psc-add" onClick={onAdd} disabled={disabled}>
          {addLabel}
        </button>
      )}
    </article>
  );
}

export function ProductSaleGrid({ children }: { children: ReactNode }) {
  return <div className="psc-grid">{children}</div>;
}
