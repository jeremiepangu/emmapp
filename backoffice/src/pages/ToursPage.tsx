import { useEffect, useState, FormEvent } from 'react';
import { api, Tour, User, Vehicle, Order } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printTourSheet, printToursList } from '../documents/templates';

const emptyForm = {
  zone: '',
  date: new Date().toISOString().slice(0, 10),
  driverId: '',
  vehicleId: '',
  orderIds: [] as string[],
};

export default function ToursPage() {
  const { can } = usePermissions();
  const [tours, setTours] = useState<Tour[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tour | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = () => api.getTours().then(setTours);

  useEffect(() => {
    load();
    api.getUsersByRole('LIVREUR').then(setDrivers);
    api.getVehicles().then(setVehicles);
    api.getOrders().then((list) => setOrders(list.filter((o) => o.status === 'VALIDEE')));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (t: Tour) => {
    setEditing(t);
    setForm({
      zone: t.zone,
      date: t.date.slice(0, 10),
      driverId: t.driver?.id ?? '',
      vehicleId: t.vehicle?.id ?? '',
      orderIds: t.orders?.map((o) => o.id) ?? [],
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        zone: form.zone,
        date: form.date,
        driverId: form.driverId,
        vehicleId: form.vehicleId,
        orderIds: form.orderIds,
      };
      if (editing) await api.updateTour(editing.id, payload);
      else await api.createTour(payload);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch {
      setError(editing ? 'Impossible de modifier la tournée' : 'Impossible de créer la tournée');
    } finally {
      setSaving(false);
    }
  };

  const toggleOrder = (id: string) => {
    setForm((f) => ({
      ...f,
      orderIds: f.orderIds.includes(id) ? f.orderIds.filter((x) => x !== id) : [...f.orderIds, id],
    }));
  };

  const activeVehicles = vehicles.filter((v) => v.isActive !== false);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Tournées"
        subtitle="Planification et suivi des livraisons"
        actions={
          <>
            <DocButton label="Imprimer la liste" onClick={() => printToursList(tours)} />
            {can('tours', 'create') && (
              <button type="button" className="erp-btn" onClick={openCreate}>+ Nouvelle tournée</button>
            )}
          </>
        }
      />
      <ErpPanel title={`Tournées planifiées (${tours.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>N° Tournée</th>
              <th>Zone</th>
              <th>Date</th>
              <th>Livreur</th>
              <th>Véhicule</th>
              <th>Commandes</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.tourNumber}</strong></td>
                <td>{t.zone}</td>
                <td>{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                <td>{t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '—'}</td>
                <td>{t.vehicle?.plate ?? '—'}</td>
                <td>{t.orders?.length ?? 0}</td>
                <td><StatusPill status={t.status} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printTourSheet(t)} />
                  {can('tours', 'update') && t.status === 'PLANIFIEE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openEdit(t)}>Modifier</button>
                  )}
                  {can('tours', 'validate') && t.status === 'PLANIFIEE' && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.startTour(t.id).then(load)}>Démarrer</button>
                  )}
                  {can('tours', 'update') && t.status === 'EN_COURS' && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.completeTour(t.id).then(load)}>Clôturer</button>
                  )}
                  {can('tours', 'delete') && t.status !== 'TERMINEE' && t.status !== 'ANNULEE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.cancelTour(t.id).then(load)}>Annuler</button>
                  )}
                  {can('tours', 'delete') && t.status === 'PLANIFIEE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteTour(t.id).then(load)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      <Modal title={editing ? 'Modifier la tournée' : 'Nouvelle tournée'} open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-row">
            <div className="form-group">
              <label>Zone</label>
              <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Livreur</label>
            <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required>
              <option value="">— Choisir —</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Véhicule</label>
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
              <option value="">— Choisir —</option>
              {activeVehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.name}</option>)}
            </select>
          </div>
          {orders.length > 0 && (
            <div className="form-group">
              <label>Commandes à inclure</label>
              <div className="checkbox-list">
                {orders.map((o) => (
                  <label key={o.id} className="checkbox-item">
                    <input type="checkbox" checked={form.orderIds.includes(o.id)} onChange={() => toggleOrder(o.id)} />
                    {o.orderNumber} — {o.client?.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn" disabled={saving}>
            {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer la tournée'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
