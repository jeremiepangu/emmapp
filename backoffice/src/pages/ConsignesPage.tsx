import { useEffect, useState } from 'react';
import { api, PackagingUnit, FountainAsset } from '../api';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function ConsignesPage() {
  const [packaging, setPackaging] = useState<PackagingUnit[]>([]);
  const [fountains, setFountains] = useState<FountainAsset[]>([]);

  useEffect(() => {
    api.getPackagingUnits().then(setPackaging);
    api.getFountains().then(setFountains);
  }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Consignes"
        subtitle="Éco-traçabilité emballages, rotations restantes et fontaines réfrigérantes"
      />
      <ErpPanel title={`Emballages consignés (${packaging.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Code</th><th>Format</th><th>Rotations</th><th>Max</th><th>Restantes</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {packaging.map((p) => (
              <tr key={p.id}>
                <td><code>{p.barcode}</code></td>
                <td>{p.productFormat}</td>
                <td>{p.rotationCount}</td>
                <td>{p.maxRotations}</td>
                <td>{p.maxRotations - p.rotationCount}</td>
                <td>
                  <StatusPill
                    status={p.rotationCount >= p.maxRotations * 0.9 ? 'ALERTE' : p.status}
                    label={p.rotationCount >= p.maxRotations * 0.9 ? 'Renouvellement' : p.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <div style={{ marginTop: 18 }}>
        <ErpPanel title={`Fontaines réfrigérantes (${fountains.length})`}>
          <table className="erp-table">
            <thead>
              <tr><th>N° série</th><th>Modèle</th><th>Contrat</th><th>Prochain service</th></tr>
            </thead>
            <tbody>
              {fountains.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.serialNumber}</strong></td>
                  <td>{f.model ?? '—'}</td>
                  <td>{f.contractType ?? '—'}</td>
                  <td>{f.nextService ? new Date(f.nextService).toLocaleDateString('fr-FR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      </div>
    </div>
  );
}
