import { useCallback, useEffect, useState } from 'react';
import { api, ClientSituation, OrderPaymentStatus } from '../api';
import { usePermissions } from '../hooks/usePermissions';

const FORMAT_LABELS: Record<string, string> = {
  BIDON_5L: 'Bidon 5L',
  BIDON_10L: 'Bidon 10L',
  BIDON_25L: 'Bidon 25L',
  BONBONNE_19L: 'Bonbonne 19L',
};

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} CDF`;

export function formatLabel(format: string) {
  return FORMAT_LABELS[format] ?? format;
}

/** Libellé métier : avance (crédit libre), acompte (versement partiel ciblé), règlement. */
export function paymentNatureLabel(p: {
  isAdvance?: boolean;
  orderNumber?: string | null;
  orderPaymentStatus?: OrderPaymentStatus | null;
}) {
  if (p.isAdvance) return 'Avance';
  if (p.orderNumber && p.orderPaymentStatus === 'PARTIELLE') return 'Acompte';
  if (p.orderNumber) return 'Règlement commande';
  return 'Règlement';
}

type Props = {
  clientId?: string | null;
  /** Version resserrée, pour les bandeaux de caisse et de livraison. */
  compact?: boolean;
  /** Incrémenter cette valeur force le rechargement après un encaissement. */
  refreshKey?: number;
  onLoaded?: (situation: ClientSituation) => void;
};

/**
 * Situation consolidée d'un client : dettes, avances, vidanges et journal des mouvements.
 */
export default function ClientSituationPanel({ clientId, compact, refreshKey, onLoaded }: Props) {
  const { can } = usePermissions();
  const [situation, setSituation] = useState<ClientSituation | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    if (!clientId) {
      setSituation(null);
      return;
    }
    setLoading(true);
    api.getClientSituation(clientId)
      .then((data) => {
        setSituation(data);
        onLoaded?.(data);
      })
      .catch(() => setSituation(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, refreshKey]);

  useEffect(load, [load]);

  const applyAdvance = async () => {
    if (!clientId) return;
    setApplying(true);
    setActionError('');
    try {
      await api.applyAdvanceForClient(clientId);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Imputation impossible');
    } finally {
      setApplying(false);
    }
  };

  if (!clientId) return null;
  if (loading && !situation) {
    return <div className="client-situation erp-muted">Chargement de la situation…</div>;
  }
  if (!situation) return null;

  const { money: cash, empties } = situation;
  const overLimit = cash.limit > 0 && cash.due > cash.limit;
  const overEmpties = empties.limit > 0 && empties.due > empties.limit;

  return (
    <div className={`client-situation${compact ? ' is-compact' : ''}`}>
      <div className="client-situation-grid">
        <div className={`client-situation-item${overLimit ? ' is-alert' : ''}`}>
          <span>Dette en argent</span>
          <strong>{money(cash.due)}</strong>
          {cash.limit > 0 && <small>plafond {money(cash.limit)}</small>}
        </div>
        <div className={`client-situation-item${cash.advance > 0 ? ' is-credit' : ''}`}>
          <span>Avance disponible</span>
          <strong>{money(cash.advance)}</strong>
          {cash.advance > 0 && <small>crédit non affecté à une commande</small>}
        </div>
        <div className={`client-situation-item${overEmpties ? ' is-alert' : ''}`}>
          <span>Vidange due</span>
          <strong>{empties.due}</strong>
          {empties.limit > 0 && <small>plafond {empties.limit}</small>}
        </div>
        <div className={`client-situation-item${empties.credit > 0 ? ' is-credit' : ''}`}>
          <span>Avoir en contenants</span>
          <strong>{empties.credit}</strong>
          {empties.credit > 0 && <small>déduit des prochaines sorties</small>}
        </div>
      </div>

      {!compact && can('payments', 'create') && cash.advance > 0 && cash.due > 0 && (
        <div className="client-situation-actions">
          <button type="button" className="erp-btn erp-btn--sm" disabled={applying} onClick={applyAdvance}>
            {applying ? 'Imputation…' : 'Imputer l’avance sur les commandes dues'}
          </button>
          {actionError && <p className="error-msg">{actionError}</p>}
        </div>
      )}

      {empties.formats.length > 0 && (
        <p className="client-situation-formats">
          {empties.formats.map((f) => (
            <span key={f.productFormat}>
              {formatLabel(f.productFormat)} : {f.quantity > 0 ? `${f.quantity} dû(s)` : `${-f.quantity} en avoir`}
            </span>
          ))}
        </p>
      )}

      {!compact && situation.orders.length > 0 && (
        <>
          <h4 className="client-situation-subtitle">Commandes non soldées (acomptes possibles)</h4>
          <table className="erp-table client-situation-table">
            <thead>
              <tr>
                <th>Commande</th>
                <th>Total</th>
                <th>Payé / acompte</th>
                <th>Reste</th>
                <th>Statut</th>
                <th>Âge</th>
              </tr>
            </thead>
            <tbody>
              {situation.orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.orderNumber}</td>
                  <td>{money(o.totalAmount)}</td>
                  <td>{money(o.paidAmount)}</td>
                  <td><strong>{money(o.remaining)}</strong></td>
                  <td>{o.paymentStatus === 'PARTIELLE' ? 'Acompte' : o.paymentStatus}</td>
                  <td>{o.ageDays} j</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!compact && situation.payments.length > 0 && (
        <>
          <h4 className="client-situation-subtitle">Journal des encaissements</h4>
          <table className="erp-table client-situation-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Nature</th>
                <th>Commande</th>
                <th>Montant</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {situation.payments.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
                  <td>{paymentNatureLabel(p)}</td>
                  <td>{p.orderNumber ?? '—'}</td>
                  <td><strong>{money(p.amount)}</strong></td>
                  <td>{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
