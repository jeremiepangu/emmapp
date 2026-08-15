import { useEffect, useState } from 'react';
import { api, EsgDashboard, EsgIndicator, EsgReport } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel, RingGauge } from '../components/ErpUi';

export default function EsgPage() {
  const { can } = usePermissions();
  const [dash, setDash] = useState<EsgDashboard | null>(null);
  const [rows, setRows] = useState<EsgIndicator[]>([]);
  const [report, setReport] = useState<EsgReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.getEsgDashboard(), api.getEsgIndicators()])
      .then(([d, i]) => { setDash(d); setRows(i); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const compute = async () => {
    setBusy(true);
    try {
      await api.computeEsgIndicators();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calcul impossible');
    } finally {
      setBusy(false);
    }
  };

  const exportReport = async () => {
    if (!dash) return;
    const r = await api.getEsgReport(dash.periodStart.slice(0, 10), dash.periodEnd.slice(0, 10));
    setReport(r);
    const header = Object.keys(r.rows[0] ?? { tournée: '', zone: '', distance: '', co2: '' });
    const csv = [header.join(';'), ...r.rows.map((row) => header.map((h) => row[h] ?? '').join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-durabilite-${r.periodStart.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!dash && !error) return <p className="erp-loading">Chargement ESG…</p>;

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Durabilité / ESG"
        subtitle="Empreinte carbone des tournées, eau de production et réemploi des emballages"
        actions={(
          <>
            {can('esg', 'validate') && (
              <button type="button" className="erp-btn" disabled={busy} onClick={compute}>
                {busy ? 'Calcul…' : 'Recalculer'}
              </button>
            )}
            <button type="button" className="erp-btn erp-btn--ghost" onClick={exportReport}>Exporter le rapport</button>
          </>
        )}
      />
      {error && <p className="error-msg">{error}</p>}
      {dash && (
        <>
          <div className="erp-kpi-row">
            <div className="erp-kpi erp-kpi--green">
              <div className="erp-kpi-label">CO₂ (12 mois)</div>
              <div className="erp-kpi-value">{dash.totalCo2Kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg</div>
              <div className="erp-kpi-meta">{dash.co2PerDeliveryKg.toFixed(2)} kg / livraison</div>
            </div>
            <div className="erp-kpi erp-kpi--blue">
              <div className="erp-kpi-label">Distance</div>
              <div className="erp-kpi-value">{dash.totalDistanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} km</div>
            </div>
            <div className="erp-kpi erp-kpi--orange">
              <div className="erp-kpi-label">Eau prélevée</div>
              <div className="erp-kpi-value">{dash.waterM3.toFixed(1)} m³</div>
              <div className="erp-kpi-meta">{dash.energyKwh.toFixed(0)} kWh</div>
            </div>
            <div className="erp-kpi erp-kpi--red">
              <div className="erp-kpi-label">Réemploi emballages</div>
              <div className="erp-kpi-value">{Math.round(dash.reusePct)} %</div>
            </div>
          </div>
          <div className="erp-split">
            <ErpPanel title="Tendance mensuelle CO₂">
              <table className="erp-table">
                <thead><tr><th>Mois</th><th>CO₂ (kg)</th><th>Distance (km)</th></tr></thead>
                <tbody>
                  {dash.monthlyTrend.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td>{m.co2Kg.toFixed(1)}</td>
                      <td>{m.distanceKm.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ErpPanel>
            <ErpPanel title="Réemploi" padded>
              <RingGauge value={Math.round(dash.reusePct)} label="Taux de réemploi" color="#449d44" />
            </ErpPanel>
          </div>
          <ErpPanel title="Tournées les plus émettrices">
            <table className="erp-table">
              <thead><tr><th>Tournée</th><th>Zone</th><th>CO₂</th><th>Distance</th></tr></thead>
              <tbody>
                {dash.topTours.map((t) => (
                  <tr key={t.tourNumber}>
                    <td><code>{t.tourNumber}</code></td>
                    <td>{t.zone}</td>
                    <td>{t.co2Kg.toFixed(1)} kg</td>
                    <td>{t.distanceKm.toFixed(1)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}
      <ErpPanel title="Indicateurs détaillés">
        <table className="erp-table">
          <thead><tr><th>Périmètre</th><th>Période</th><th>Tournée</th><th>CO₂</th><th>Eau</th><th>Énergie</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.scope}</td>
                <td>{new Date(r.periodStart).toLocaleDateString('fr-FR')}</td>
                <td>{r.tour?.tourNumber ?? '—'}</td>
                <td>{r.co2Kg.toFixed(1)}</td>
                <td>{r.waterM3.toFixed(2)}</td>
                <td>{r.energyKwh.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      {report && <p className="erp-muted">Rapport généré le {new Date(report.generatedAt).toLocaleString('fr-FR')}.</p>}
    </div>
  );
}
