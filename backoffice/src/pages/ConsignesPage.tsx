import { FormEvent, useEffect, useState } from 'react';
import { api, Client, ConsigneMovement, FountainAsset, PackagingUnit } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printConsigneMovement, printConsignesList, printFountainsList, printPackagingList } from '../documents/templates';

const FORMATS = ['BIDON_5L', 'BIDON_10L', 'BIDON_25L', 'BONBONNE_19L'];

export default function ConsignesPage() {
  const { can } = usePermissions();
  const [packaging, setPackaging] = useState<PackagingUnit[]>([]);
  const [fountains, setFountains] = useState<FountainAsset[]>([]);
  const [movements, setMovements] = useState<ConsigneMovement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [packForm, setPackForm] = useState({ barcode: '', productFormat: 'BONBONNE_19L', maxRotations: 40 });
  const [moveForm, setMoveForm] = useState({ clientId: '', productFormat: 'BONBONNE_19L', qtyIn: 0, qtyOut: 0 });
  const [fountainForm, setFountainForm] = useState({ serialNumber: '', model: '', contractType: 'LOCATION' });

  const load = () => {
    api.getPackagingUnits().then(setPackaging);
    api.getFountains().then(setFountains);
    api.getConsigneMovements().then(setMovements).catch(() => setMovements([]));
  };
  useEffect(() => { load(); api.getClients().then(setClients); }, []);

  const addPack = async (e: FormEvent) => { e.preventDefault(); await api.createPackagingUnit(packForm); await load(); };
  const addMove = async (e: FormEvent) => { e.preventDefault(); await api.createConsigneMovement(moveForm); await load(); };
  const addFountain = async (e: FormEvent) => { e.preventDefault(); await api.createFountain(fountainForm); await load(); };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Consignes"
        subtitle="Éco-traçabilité emballages, mouvements clients et fontaines"
        actions={
          <>
            <DocButton label="Mouvements" onClick={() => printConsignesList(movements)} />
            <DocButton label="Emballages" onClick={() => printPackagingList(packaging)} />
            <DocButton label="Fontaines" onClick={() => printFountainsList(fountains)} />
          </>
        }
      />
      {can('consignes', 'create') && (
        <ErpPanel title="Nouveau mouvement / emballage" padded>
          <form className="form-row" onSubmit={addMove}>
            <div className="form-group">
              <label>Client</label>
              <select value={moveForm.clientId} onChange={(e) => setMoveForm({ ...moveForm, clientId: e.target.value })} required>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Format</label>
              <select value={moveForm.productFormat} onChange={(e) => setMoveForm({ ...moveForm, productFormat: e.target.value })}>
                {FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Retours (in)</label><input type="number" min={0} value={moveForm.qtyIn} onChange={(e) => setMoveForm({ ...moveForm, qtyIn: Number(e.target.value) })} /></div>
            <div className="form-group"><label>Sorties (out)</label><input type="number" min={0} value={moveForm.qtyOut} onChange={(e) => setMoveForm({ ...moveForm, qtyOut: Number(e.target.value) })} /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Enregistrer</button></div>
          </form>
        </ErpPanel>
      )}
      <ErpPanel title={`Mouvements (${movements.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Date</th><th>Client</th><th>Format</th><th>In</th><th>Out</th><th>Solde</th><th></th></tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.createdAt).toLocaleString('fr-FR')}</td>
                <td>{m.client?.name ?? '—'}</td>
                <td>{m.productFormat}</td>
                <td>{m.qtyIn}</td>
                <td>{m.qtyOut}</td>
                <td>{m.balanceAfter}</td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printConsigneMovement(m)} />
                  {can('consignes', 'delete') && <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteConsigneMovement(m.id).then(load)}>Supprimer</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <div style={{ marginTop: 18 }}>
        <ErpPanel title={`Emballages consignés (${packaging.length})`}>
          {can('consignes', 'create') && (
            <form className="form-row" style={{ padding: 12 }} onSubmit={addPack}>
              <div className="form-group"><label>Code-barres</label><input value={packForm.barcode} onChange={(e) => setPackForm({ ...packForm, barcode: e.target.value })} required /></div>
              <div className="form-group"><label>Format</label><select value={packForm.productFormat} onChange={(e) => setPackForm({ ...packForm, productFormat: e.target.value })}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></div>
              <div className="form-group"><label>Max rotations</label><input type="number" value={packForm.maxRotations} onChange={(e) => setPackForm({ ...packForm, maxRotations: Number(e.target.value) })} /></div>
              <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn erp-btn--sm">Ajouter</button></div>
            </form>
          )}
          <table className="erp-table">
            <thead>
              <tr><th>Code</th><th>Format</th><th>Rotations</th><th>Max</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {packaging.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.barcode}</code></td>
                  <td>{p.productFormat}</td>
                  <td>{p.rotationCount}</td>
                  <td>{p.maxRotations}</td>
                  <td><StatusPill status={p.rotationCount >= p.maxRotations * 0.9 ? 'ALERTE' : p.status} label={p.status} /></td>
                  <td>{can('consignes', 'delete') && <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deletePackagingUnit(p.id).then(load)}>Retirer</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      </div>
      <div style={{ marginTop: 18 }}>
        <ErpPanel title={`Fontaines réfrigérantes (${fountains.length})`}>
          {can('consignes', 'create') && (
            <form className="form-row" style={{ padding: 12 }} onSubmit={addFountain}>
              <div className="form-group"><label>N° série</label><input value={fountainForm.serialNumber} onChange={(e) => setFountainForm({ ...fountainForm, serialNumber: e.target.value })} required /></div>
              <div className="form-group"><label>Modèle</label><input value={fountainForm.model} onChange={(e) => setFountainForm({ ...fountainForm, model: e.target.value })} /></div>
              <div className="form-group"><label>Contrat</label><input value={fountainForm.contractType} onChange={(e) => setFountainForm({ ...fountainForm, contractType: e.target.value })} /></div>
              <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn erp-btn--sm">Ajouter</button></div>
            </form>
          )}
          <table className="erp-table">
            <thead>
              <tr><th>N° série</th><th>Modèle</th><th>Contrat</th><th>Prochain service</th><th></th></tr>
            </thead>
            <tbody>
              {fountains.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.serialNumber}</strong></td>
                  <td>{f.model ?? '—'}</td>
                  <td>{f.contractType ?? '—'}</td>
                  <td>{f.nextService ? new Date(f.nextService).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>{can('consignes', 'delete') && <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteFountain(f.id).then(load)}>Retirer</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      </div>
    </div>
  );
}
