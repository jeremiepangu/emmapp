import { useEffect, useState } from 'react';
import {
  api,
  CashClosing,
  Discrepancy,
  DiscrepancyKind,
  DiscrepancyStatus,
  Tour,
  TourReconciliation,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import { exportSheet } from '../excel/specs';

const KIND_LABEL: Record<DiscrepancyKind, string> = {
  CAISSE: 'Caisse',
  TOURNEE: 'Tournée',
  VIDANGE: 'Vidange',
};

const STATUS_LABEL: Record<DiscrepancyStatus, string> = {
  OUVERT: 'Ouvert',
  JUSTIFIE: 'Justifié',
  REGULARISE: 'Régularisé',
};

function money(value: string | number): string {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} CDF`;
}

export default function EcartsPage() {
  const { can } = usePermissions();
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [kind, setKind] = useState<DiscrepancyKind | ''>('');
  const [status, setStatus] = useState<DiscrepancyStatus | ''>('');
  const [selectedTour, setSelectedTour] = useState('');
  const [reconciliation, setReconciliation] = useState<TourReconciliation | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api.getDiscrepancies({ kind: kind || undefined, status: status || undefined })
      .then(setDiscrepancies)
      .catch(() => setDiscrepancies([]));
    api.getCashClosings().then(setClosings).catch(() => setClosings([]));
  };

  useEffect(() => { load(); }, [kind, status]);
  useEffect(() => { api.getTours().then(setTours).catch(() => setTours([])); }, []);

  useEffect(() => {
    if (!selectedTour) {
      setReconciliation(null);
      return;
    }
    api.getTourReconciliation(selectedTour)
      .then(setReconciliation)
      .catch(() => setReconciliation(null));
  }, [selectedTour]);

  const resolve = async (id: string, next: DiscrepancyStatus) => {
    setError('');
    const notes = window.prompt('Justification ou commentaire (facultatif)') ?? undefined;
    try {
      await api.resolveDiscrepancy(id, { status: next, notes });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  };

  const reconcile = async () => {
    if (!selectedTour) return;
    setError('');
    try {
      setReconciliation(await api.reconcileTour(selectedTour));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapprochement impossible');
    }
  };

  const openCount = discrepancies.filter((d) => d.status === 'OUVERT').length;

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Écarts et clôtures"
        subtitle="Écarts de caisse, de tournée et de vidange, avec justification et régularisation"
        excel={{
          filename: 'ecarts',
          sheets: [
            exportSheet(
              'Écarts',
              [
                ['kind', 'Type'],
                ['reference', 'Référence'],
                ['label', 'Libellé'],
                ['expected', 'Attendu'],
                ['actual', 'Constaté'],
                ['variance', 'Écart'],
                ['status', 'Statut'],
                ['date', 'Date'],
              ],
              discrepancies.map((d) => ({
                kind: KIND_LABEL[d.kind],
                reference: d.reference,
                label: d.label,
                expected: Number(d.expected),
                actual: Number(d.actual),
                variance: Number(d.variance),
                status: STATUS_LABEL[d.status],
                date: new Date(d.createdAt).toLocaleString('fr-FR'),
              })),
            ),
          ],
        }}
      />

      {error && <p className="error-msg">{error}</p>}

      <ErpPanel title={`Écarts (${discrepancies.length}) — ${openCount} ouvert(s)`}>
        <div className="form-row" style={{ padding: 12 }}>
          <div className="form-group">
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as DiscrepancyKind | '')}>
              <option value="">Tous</option>
              {(Object.keys(KIND_LABEL) as DiscrepancyKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as DiscrepancyStatus | '')}>
              <option value="">Tous</option>
              {(Object.keys(STATUS_LABEL) as DiscrepancyStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Libellé</th>
              <th>Attendu</th>
              <th>Constaté</th>
              <th>Écart</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {discrepancies.map((d) => (
              <tr key={d.id}>
                <td>{new Date(d.createdAt).toLocaleString('fr-FR')}</td>
                <td>{KIND_LABEL[d.kind]}</td>
                <td>
                  {d.label}
                  {d.notes && <><br /><span className="erp-muted">{d.notes}</span></>}
                </td>
                <td>{Number(d.expected).toLocaleString('fr-FR')}</td>
                <td>{Number(d.actual).toLocaleString('fr-FR')}</td>
                <td><strong>{Number(d.variance).toLocaleString('fr-FR')}</strong></td>
                <td>
                  <StatusPill
                    status={d.status === 'OUVERT' ? 'ALERTE' : 'OK'}
                    label={STATUS_LABEL[d.status]}
                  />
                </td>
                <td className="erp-row-actions">
                  {can('ecarts', 'update') && d.status !== 'REGULARISE' && (
                    <>
                      {d.status === 'OUVERT' && (
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => resolve(d.id, 'JUSTIFIE')}>
                          Justifier
                        </button>
                      )}
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => resolve(d.id, 'REGULARISE')}>
                        Régulariser
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!discrepancies.length && <p className="erp-table-empty">Aucun écart pour ce filtre.</p>}
      </ErpPanel>

      <div style={{ marginTop: 18 }}>
        <ErpPanel title="Rapprochement de tournée">
          <div className="form-row" style={{ padding: 12 }}>
            <div className="form-group">
              <label>Tournée</label>
              <select value={selectedTour} onChange={(e) => setSelectedTour(e.target.value)}>
                <option value="">—</option>
                {tours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tourNumber} — {t.zone}
                  </option>
                ))}
              </select>
            </div>
            {can('ecarts', 'create') && (
              <div className="form-group" style={{ alignSelf: 'end' }}>
                <button type="button" className="erp-btn" onClick={reconcile} disabled={!selectedTour}>
                  Enregistrer les écarts
                </button>
              </div>
            )}
          </div>
          {reconciliation && (
            <>
              {!reconciliation.hasLoadSheet && (
                <p className="erp-muted" style={{ padding: '0 12px' }}>
                  Aucune feuille de chargement : les quantités chargées sont considérées nulles.
                </p>
              )}
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Chargé</th>
                    <th>Livré</th>
                    <th>Refusé</th>
                    <th>Endommagé</th>
                    <th>Justifié</th>
                    <th>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>{l.productName}</td>
                      <td>{l.loaded}</td>
                      <td>{l.delivered}</td>
                      <td>{l.refused}</td>
                      <td>{l.damaged}</td>
                      <td>{l.accounted}</td>
                      <td><strong>{l.variance}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="erp-muted" style={{ padding: 12 }}>
                Total chargé {reconciliation.totals.loaded} · justifié {reconciliation.totals.accounted} ·
                écart {reconciliation.totals.variance}
              </p>
            </>
          )}
        </ErpPanel>
      </div>

      <div style={{ marginTop: 18 }}>
        <ErpPanel title={`Clôtures de caisse (${closings.length})`}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Caissier</th>
                <th>Ouverture</th>
                <th>Clôture</th>
                <th>Théorique</th>
                <th>Compté</th>
                <th>Écart</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {closings.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.reference}</strong></td>
                  <td>{c.cashier ? `${c.cashier.firstName} ${c.cashier.lastName}` : '—'}</td>
                  <td>{new Date(c.openedAt).toLocaleString('fr-FR')}</td>
                  <td>{c.closedAt ? new Date(c.closedAt).toLocaleString('fr-FR') : '—'}</td>
                  <td>{money(c.expectedAmount)}</td>
                  <td>{money(c.countedAmount)}</td>
                  <td><strong>{money(c.variance)}</strong></td>
                  <td><StatusPill status={c.status} label={c.status} /></td>
                  <td className="erp-row-actions">
                    {can('ecarts', 'validate') && c.status === 'CLOTUREE' && (
                      <button
                        type="button"
                        className="erp-btn erp-btn--sm"
                        onClick={() => api.validateCashClosing(c.id).then(load)}
                      >
                        Valider
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!closings.length && <p className="erp-table-empty">Aucune session de caisse.</p>}
        </ErpPanel>
      </div>
    </div>
  );
}
