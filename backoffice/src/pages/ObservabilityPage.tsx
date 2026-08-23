import { useEffect, useState } from 'react';
import { api, ObservabilityStatus } from '../api';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printObservabilityReport } from '../documents/templates';
import { exportSheet } from '../excel/specs';

export default function ObservabilityPage() {
  const [data, setData] = useState<ObservabilityStatus | null>(null);

  useEffect(() => {
    api.getObservability().then(setData);
  }, []);

  if (!data) return <p className="erp-loading">Chargement supervision...</p>;

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Observabilité"
        subtitle="Disponibilité services, sync offline et alertes qualité / production"
        excel={{
          filename: 'observabilite',
          sheets: [
            exportSheet('Indicateurs', [['indicateur', 'Indicateur'], ['valeur', 'Valeur']], [
              { indicateur: 'Sync en attente', valeur: data.pendingSync },
              { indicateur: 'Lots bloques', valeur: data.blockedLots },
              { indicateur: 'Controles qualite ouverts', valeur: data.openQualityChecks },
              { indicateur: 'Shifts a valider', valeur: data.pendingShiftValidations },
            ]),
            exportSheet('Services', [['service', 'Service'], ['statut', 'Statut']], data.services.map((row) => ({
              service: row.name,
              statut: row.status,
            }))),
          ],
        }}
        actions={<DocButton label="Synthèse" onClick={() => printObservabilityReport(data)} />}
      />
      <div className="erp-kpi-mini-row">
        <div className="erp-kpi-mini">
          <div className="erp-kpi-mini-icon erp-kpi-mini-icon--blue">☁</div>
          <div>
            <div className="erp-kpi-mini-label">Sync en attente</div>
            <div className="erp-kpi-mini-value">{data.pendingSync}</div>
          </div>
        </div>
        <div className="erp-kpi-mini">
          <div className="erp-kpi-mini-icon erp-kpi-mini-icon--red">⛔</div>
          <div>
            <div className="erp-kpi-mini-label">Lots bloqués</div>
            <div className="erp-kpi-mini-value">{data.blockedLots}</div>
          </div>
        </div>
        <div className="erp-kpi-mini">
          <div className="erp-kpi-mini-icon erp-kpi-mini-icon--orange">✓</div>
          <div>
            <div className="erp-kpi-mini-label">Contrôles qualité ouverts</div>
            <div className="erp-kpi-mini-value">{data.openQualityChecks}</div>
          </div>
        </div>
        <div className="erp-kpi-mini">
          <div className="erp-kpi-mini-icon erp-kpi-mini-icon--green">◉</div>
          <div>
            <div className="erp-kpi-mini-label">Shifts à valider</div>
            <div className="erp-kpi-mini-value">{data.pendingShiftValidations}</div>
          </div>
        </div>
      </div>
      <ErpPanel title="État des services">
        <table className="erp-table">
          <thead><tr><th>Service</th><th>Statut</th></tr></thead>
          <tbody>
            {data.services.map((s) => (
              <tr key={s.name}>
                <td><strong>{s.name}</strong></td>
                <td><StatusPill status={s.status === 'UP' ? 'UP' : 'DOWN'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
