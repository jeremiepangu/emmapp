import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  CreateSensorInput,
  FountainTelemetry,
  IotSensor,
  SensorKind,
  SensorReading,
  VehicleTelemetry,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printIotReport, printIotSensorSheet } from '../documents/templates';
import { sheetSensors } from '../excel/specs';

const EMPTY: CreateSensorInput = {
  code: '',
  label: '',
  kind: 'QUALITE_LIGNE',
  metric: 'ph',
  unit: '',
};

export default function IotPage() {
  const { can } = usePermissions();
  const [sensors, setSensors] = useState<IotSensor[]>([]);
  const [vehicles, setVehicles] = useState<VehicleTelemetry[]>([]);
  const [fountains, setFountains] = useState<FountainTelemetry[]>([]);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [form, setForm] = useState<CreateSensorInput>(EMPTY);
  const [editing, setEditing] = useState<IotSensor | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.getSensors(), api.getVehicleTelemetry(), api.getConnectedFountains()])
      .then(([s, v, f]) => { setSensors(s); setVehicles(v); setFountains(f); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const openReadings = async (id: string) => {
    setSelected(id);
    setReadings(await api.getSensorReadings(id));
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) await api.updateSensor(editing.id, form);
    else await api.createSensor(form);
    setForm(EMPTY);
    setEditing(null);
    load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Capteurs & télémétrie"
        subtitle="Qualité en ligne, véhicules et fontaines connectées — alerte automatique hors plage"
        excel={{ filename: 'capteurs', sheets: [sheetSensors(sensors, can('iot', 'create'))], onImported: load }}
        actions={
          <>
            <DocButton label="Rapport capteurs" onClick={() => printIotReport(sensors)} />
            {can('iot', 'create') && (
              <button
                type="button"
                className="erp-btn"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY);
                  document.getElementById('iot-form')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                + Nouveau capteur
              </button>
            )}
          </>
        }
      />
      {error && <p className="error-msg">{error}</p>}

      {(can('iot', 'create') || editing) && (
        <ErpPanel title={editing ? 'Modifier le capteur' : 'Enregistrer un capteur'} padded>
          <form id="iot-form" onSubmit={create} className="form-row">
            <div className="form-group"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div className="form-group"><label>Libellé</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></div>
            <div className="form-group">
              <label>Famille</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SensorKind })}>
                <option value="QUALITE_LIGNE">Qualité ligne</option>
                <option value="VEHICULE">Véhicule</option>
                <option value="FONTAINE">Fontaine</option>
              </select>
            </div>
            <div className="form-group"><label>Métrique</label><input value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} required /></div>
            <div className="form-group"><label>Unité</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Créer'}</button>
              {editing && (
                <button type="button" className="erp-btn erp-btn--ghost" onClick={() => { setEditing(null); setForm(EMPTY); }}>Annuler</button>
              )}
            </div>
          </form>
        </ErpPanel>
      )}

      <ErpPanel title={`Capteurs (${sensors.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Code</th><th>Libellé</th><th>Famille</th><th>Dernière valeur</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            {sensors.map((s) => (
              <tr key={s.id}>
                <td><code>{s.code}</code></td>
                <td>{s.label}</td>
                <td>{s.kind}</td>
                <td>
                  {s.lastValue != null ? `${s.lastValue} ${s.unit}` : '—'}
                  {s.outOfRange ? ' · hors plage' : ''}
                </td>
                <td><StatusPill status={s.status} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printIotSensorSheet(s)} />
                  <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openReadings(s.id)}>Relevés</button>
                  {can('iot', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteSensor(s.id).then(load)}>Retirer</button>
                  )}
                  {can('iot', 'update') && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => {
                        setEditing(s);
                        setForm({
                          code: s.code,
                          label: s.label,
                          kind: s.kind,
                          metric: s.metric,
                          unit: s.unit,
                          minValue: s.minValue,
                          maxValue: s.maxValue,
                        });
                      }}
                    >
                      Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      {selected && (
        <ErpPanel title="Relevés" padded>
          {can('iot', 'update') && (
            <form className="form-row" onSubmit={(e) => { e.preventDefault(); api.createSensorReading(selected, Number(manualValue)).then(() => openReadings(selected)).then(load); }}>
              <div className="form-group"><label>Saisie manuelle (repli)</label><input type="number" step="any" value={manualValue} onChange={(e) => setManualValue(e.target.value)} required /></div>
              <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn erp-btn--sm">Enregistrer</button></div>
            </form>
          )}
          <table className="erp-table">
            <thead><tr><th>Horodatage</th><th>Valeur</th><th></th></tr></thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.recordedAt).toLocaleString('fr-FR')}</td>
                  <td>{r.value}</td>
                  <td>{r.outOfRange ? <StatusPill status="ALERTE" /> : 'OK'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      )}

      <div className="erp-split">
        <ErpPanel title="Télémétrie véhicules">
          <table className="erp-table">
            <thead><tr><th>Véhicule</th><th>Position</th><th>Vitesse</th><th>Carburant</th><th>Statut</th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.vehicleId}>
                  <td>{v.name} · {v.plate}</td>
                  <td>{v.latitude != null ? `${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)}` : '—'}</td>
                  <td>{v.speedKmh != null ? `${v.speedKmh} km/h` : '—'}</td>
                  <td>{v.fuelLevelPct != null ? `${v.fuelLevelPct} %` : '—'}</td>
                  <td><StatusPill status={v.status} /></td>
                </tr>
              ))}
              {!vehicles.length && <tr><td colSpan={5} className="erp-muted">Aucun véhicule équipé.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
        <ErpPanel title="Fontaines connectées">
          <table className="erp-table">
            <thead><tr><th>Série</th><th>Client</th><th>Niveau</th><th></th></tr></thead>
            <tbody>
              {fountains.map((f) => (
                <tr key={f.id}>
                  <td><code>{f.serialNumber}</code></td>
                  <td>{f.clientName ?? '—'}</td>
                  <td>{f.fillLevelPct != null ? `${f.fillLevelPct} %` : '—'}</td>
                  <td>{f.needsRefill ? <StatusPill status="ALERTE" label="Réappro" /> : 'OK'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      </div>
    </div>
  );
}
