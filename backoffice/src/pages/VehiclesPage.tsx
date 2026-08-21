import { FormEvent, useEffect, useState } from 'react';
import { api, Vehicle } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printVehicleSheet, printVehiclesList } from '../documents/templates';

const emptyForm = { plate: '', name: '', capacity: 100, fuelType: 'DIESEL', co2FactorKgPerKm: 0.31 };

export default function VehiclesPage() {
  const { can } = usePermissions();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => api.getVehicles().then(setVehicles);
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        plate: form.plate,
        name: form.name,
        capacity: Number(form.capacity),
        fuelType: form.fuelType,
        co2FactorKgPerKm: Number(form.co2FactorKgPerKm),
      };
      if (editing) await api.updateVehicle(editing.id, payload);
      else await api.createVehicle(payload);
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Véhicules"
        subtitle="Parc de livraison — plaques, capacité et facteur CO₂"
        actions={
          <>
            <DocButton label="Imprimer le parc" onClick={() => printVehiclesList(vehicles)} />
            {can('vehicles', 'create') && (
              <button type="button" className="erp-btn" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>
                + Nouveau véhicule
              </button>
            )}
          </>
        }
      />
      <ErpPanel title={`Parc (${vehicles.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Plaque</th>
              <th>Nom</th>
              <th>Capacité</th>
              <th>Carburant</th>
              <th>CO₂ kg/km</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.plate}</strong></td>
                <td>{v.name}</td>
                <td>{v.capacity}</td>
                <td>{v.fuelType ?? '—'}</td>
                <td>{v.co2FactorKgPerKm ?? '—'}</td>
                <td><StatusPill status={v.isActive === false ? 'ANNULEE' : 'CONFORME'} label={v.isActive === false ? 'Inactif' : 'Actif'} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printVehicleSheet(v)} />
                  {can('vehicles', 'update') && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => {
                        setEditing(v);
                        setForm({
                          plate: v.plate,
                          name: v.name,
                          capacity: v.capacity,
                          fuelType: v.fuelType ?? 'DIESEL',
                          co2FactorKgPerKm: v.co2FactorKgPerKm ?? 0.31,
                        });
                        setShowForm(true);
                      }}
                    >
                      Modifier
                    </button>
                  )}
                  {can('vehicles', 'update') && v.isActive === false && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.updateVehicle(v.id, { isActive: true }).then(load)}>
                      Réactiver
                    </button>
                  )}
                  {can('vehicles', 'delete') && v.isActive !== false && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteVehicle(v.id).then(load)}>
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!vehicles.length && <tr><td colSpan={7} className="erp-muted">Aucun véhicule.</td></tr>}
          </tbody>
        </table>
      </ErpPanel>
      <Modal title={editing ? 'Modifier le véhicule' : 'Nouveau véhicule'} open={showForm} onClose={() => setShowForm(false)}>
        <form className="form-stack" onSubmit={submit}>
          <div className="form-group"><label>Plaque</label><input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} required disabled={!!editing} /></div>
          <div className="form-group"><label>Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group"><label>Capacité (unités)</label><input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
          <div className="form-group">
            <label>Carburant</label>
            <select value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
              <option value="DIESEL">Diesel</option>
              <option value="ESSENCE">Essence</option>
              <option value="HYBRIDE">Hybride</option>
              <option value="ELECTRIQUE">Électrique</option>
            </select>
          </div>
          <div className="form-group"><label>Facteur CO₂ (kg/km)</label><input type="number" step="0.01" min={0} value={form.co2FactorKgPerKm} onChange={(e) => setForm({ ...form, co2FactorKgPerKm: Number(e.target.value) })} /></div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  );
}
