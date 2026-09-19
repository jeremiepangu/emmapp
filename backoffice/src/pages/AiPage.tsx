import { useEffect, useState } from 'react';
import {
  api,
  Anomaly,
  CreditScore,
  DemandForecast,
  MaintenanceRisk,
  ModelRun,
  Recommendation,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printAnomalies, printForecasts } from '../documents/templates';
import { exportSheet } from '../excel/specs';

function Factors({ factors }: { factors: Array<{ label: string; weight: number; detail?: string }> }) {
  if (!factors?.length) return <span className="erp-muted">—</span>;
  return (
    <ul className="erp-factor-list">
      {factors.map((f) => (
        <li key={f.label}>
          <strong>{f.label}</strong>
          {' '}
          ({Math.round(f.weight * 100)} %)
          {f.detail ? ` — ${f.detail}` : ''}
        </li>
      ))}
    </ul>
  );
}

export default function AiPage() {
  const { can } = usePermissions();
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [risks, setRisks] = useState<MaintenanceRisk[]>([]);
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [score, setScore] = useState<CreditScore | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      api.getDemandForecast(),
      api.getAnomalies(),
      api.getMaintenanceRisks(),
      api.getModelRuns(),
      api.getClients().catch(() => []),
    ])
      .then(([f, a, r, m, c]) => {
        setForecasts(f);
        setAnomalies(a);
        setRisks(r);
        setRuns(m);
        setClients(c.map((x) => ({ id: x.id, name: x.name })));
        if (!clientId && c[0]) setClientId(c[0].id);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError('');
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du calcul');
    } finally {
      setBusy('');
    }
  };

  const loadClientIntel = async (id: string) => {
    setClientId(id);
    if (!id) return;
    try {
      const [s, r] = await Promise.all([api.getCreditScore(id), api.getRecommendations(id)]);
      setScore(s);
      setRecs(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scoring indisponible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="IA prédictive & analytics"
        subtitle="Prévision de demande, anomalies, maintenance et scoring — chaque résultat affiche ses facteurs (EF-IA-04)"
        excel={{
          filename: 'ia',
          sheets: [
            exportSheet('Previsions', [
              ['produit', 'Produit'], ['zone', 'Zone'], ['date', 'Horizon'],
              ['quantite', 'Quantite'], ['confiance', 'Confiance'], ['modele', 'Modele'],
            ], forecasts.map((row) => ({
              produit: row.product?.name ?? row.productId,
              zone: row.zone,
              date: row.horizonDate.slice(0, 10),
              quantite: row.forecastQty,
              confiance: row.confidence,
              modele: row.modelVersion,
            }))),
            exportSheet('Anomalies', [
              ['date', 'Date'], ['type', 'Type'], ['severite', 'Severite'],
              ['statut', 'Statut'], ['titre', 'Titre'], ['score', 'Score'],
            ], anomalies.map((row) => ({
              date: new Date(row.detectedAt).toLocaleString('fr-FR'),
              type: row.kind,
              severite: row.severity,
              statut: row.status,
              titre: row.title,
              score: row.score,
            }))),
            exportSheet('Maintenance', [
              ['equipement', 'Equipement'], ['ligne', 'Ligne'], ['risque', 'Score'],
              ['panne', 'Panne predite'],
            ], risks.map((row) => ({
              equipement: row.equipmentCode,
              ligne: row.lineCode,
              risque: row.riskScore,
              panne: row.predictedFailureAt ? new Date(row.predictedFailureAt).toLocaleString('fr-FR') : '',
            }))),
            exportSheet('Modeles', [
              ['nom', 'Modele'], ['version', 'Version'], ['echantillons', 'Echantillons'],
              ['mape', 'MAPE %'], ['date', 'Date'],
            ], runs.map((row) => ({
              nom: row.modelName,
              version: row.modelVersion,
              echantillons: row.samples,
              mape: row.mapePct ?? '',
              date: new Date(row.ranAt).toLocaleString('fr-FR'),
            }))),
            exportSheet('Scoring', [['indicateur', 'Indicateur'], ['valeur', 'Valeur']], score ? [
              { indicateur: 'Client', valeur: score.clientName },
              { indicateur: 'Score', valeur: score.score },
              { indicateur: 'Note', valeur: score.rating },
              { indicateur: 'Limite recommandee', valeur: score.recommendedLimit },
              { indicateur: 'Credit autorise', valeur: score.creditAllowed ? 'Oui' : 'Non' },
            ] : []),
            exportSheet('Recommandations', [['titre', 'Titre'], ['detail', 'Detail'], ['quantite', 'Quantite']], recs.map((row) => ({
              titre: row.title,
              detail: row.detail,
              quantite: row.suggestedQty ?? '',
            }))),
          ],
        }}
        actions={(
          <>
            <DocButton label="Prévisions" onClick={() => printForecasts(forecasts)} />
            <DocButton label="Anomalies" onClick={() => printAnomalies(anomalies)} />
            {can('ai', 'validate') && (
              <>
                <button type="button" className="erp-btn" disabled={!!busy} onClick={() => run('prévision', () => api.runDemandForecast())}>
                  {busy === 'prévision' ? 'Calcul…' : 'Actualiser les prévisions'}
                </button>
                <button type="button" className="erp-btn erp-btn--ghost" disabled={!!busy} onClick={() => run('anomalies', () => api.runAnomalyDetection())}>
                  {busy === 'anomalies' ? 'Analyse…' : 'Détecter les anomalies'}
                </button>
                <button type="button" className="erp-btn erp-btn--ghost" disabled={!!busy} onClick={() => run('maintenance', () => api.runMaintenanceRisk())}>
                  {busy === 'maintenance' ? 'Analyse…' : 'Score de panne'}
                </button>
              </>
            )}
          </>
        )}
      />
      {error && <p className="error-msg">{error}</p>}

      <ErpPanel title={`Prévision de demande à 7 jours (${forecasts.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Produit</th><th>Zone</th><th>Horizon</th><th>Volume</th><th>Confiance</th><th>Facteurs</th></tr>
          </thead>
          <tbody>
            {forecasts.map((f) => (
              <tr key={f.id}>
                <td>{f.product?.name ?? f.productId}</td>
                <td>{f.zone}</td>
                <td>{new Date(f.horizonDate).toLocaleDateString('fr-FR')}</td>
                <td><strong>{f.forecastQty}</strong></td>
                <td>{Math.round(f.confidence * 100)} %</td>
                <td><Factors factors={f.factors} /></td>
              </tr>
            ))}
            {!forecasts.length && <tr><td colSpan={6} className="erp-muted">Aucune prévision — lancez le calcul.</td></tr>}
          </tbody>
        </table>
      </ErpPanel>

      <ErpPanel title={`Anomalies détectées (${anomalies.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Type</th><th>Sévérité</th><th>Statut</th><th>Titre</th><th>Score</th><th>Facteurs</th><th></th></tr>
          </thead>
          <tbody>
            {anomalies.map((a) => (
              <tr key={a.id}>
                <td><StatusPill status={a.kind} /></td>
                <td><StatusPill status={a.severity} /></td>
                <td><StatusPill status={a.status} /></td>
                <td>
                  <strong>{a.title}</strong>
                  <div className="erp-muted">{a.description}</div>
                </td>
                <td>{Math.round(a.score * 100)} %</td>
                <td><Factors factors={a.factors} /></td>
                <td>
                  {can('ai', 'update') && a.status === 'OUVERTE' && (
                    <>
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.updateAnomalyStatus(a.id, 'RESOLUE').then(load)}>Résoudre</button>
                      {' '}
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.updateAnomalyStatus(a.id, 'IGNOREE').then(load)}>Ignorer</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!anomalies.length && <tr><td colSpan={7} className="erp-muted">Aucune anomalie ouverte.</td></tr>}
          </tbody>
        </table>
      </ErpPanel>

      <ErpPanel title="Risque de panne machine">
        <table className="erp-table">
          <thead>
            <tr><th>Équipement</th><th>Ligne</th><th>Score</th><th>Panne estimée</th><th>Facteurs</th></tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.id}>
                <td><code>{r.equipmentCode}</code></td>
                <td>{r.lineCode}</td>
                <td><strong>{Math.round(r.riskScore * 100)} %</strong></td>
                <td>{r.predictedFailureAt ? new Date(r.predictedFailureAt).toLocaleString('fr-FR') : '—'}</td>
                <td><Factors factors={r.factors} /></td>
              </tr>
            ))}
            {!risks.length && <tr><td colSpan={5} className="erp-muted">Aucun score calculé.</td></tr>}
          </tbody>
        </table>
      </ErpPanel>

      <div className="erp-split">
        <ErpPanel title="Scoring crédit & recommandations" padded>
          <div className="form-row">
            <div className="form-group">
              <label>Client</label>
              <select value={clientId} onChange={(e) => loadClientIntel(e.target.value)}>
                <option value="">Choisir…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          {score && (
            <div>
              <p>
                Score <strong>{score.score}</strong> · notation <StatusPill status={score.rating} label={score.rating} />
                {' '}· plafond recommandé {score.recommendedLimit.toLocaleString('fr-FR')} CDF
                {' '}· crédit {score.creditAllowed ? 'autorisé' : 'refusé'}
              </p>
              <Factors factors={score.factors} />
            </div>
          )}
          {recs.map((r) => (
            <div key={r.title} className="erp-rec-card">
              <strong>{r.title}</strong>
              <p>{r.detail}</p>
              {r.suggestedQty != null && <p>Volume suggéré : {r.suggestedQty}</p>}
              <Factors factors={r.factors} />
            </div>
          ))}
        </ErpPanel>
        <ErpPanel title="Journal des modèles">
          <table className="erp-table">
            <thead><tr><th>Modèle</th><th>Version</th><th>MAPE</th><th>Exécuté</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.modelName}</td>
                  <td><code>{r.modelVersion}</code></td>
                  <td>{r.mapePct != null ? `${r.mapePct.toFixed(1)} %` : '—'}</td>
                  <td>{new Date(r.ranAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {!runs.length && <tr><td colSpan={4} className="erp-muted">Aucun réentraînement journalisé.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
      </div>
    </div>
  );
}
