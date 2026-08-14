import { useEffect, useState, FormEvent } from 'react';
import { api, Tour, User, Vehicle, Order } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';

export default function ToursPage() {
  const { can } = usePermissions();
  const [tours, setTours] = useState<Tour[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    zone: '',
    date: new Date().toISOString().slice(0, 10),
    driverId: '',
    vehicleId: '',
    orderIds: [] as string[],
  });

  const load = () => api.getTours().then(setTours);

  useEffect(() => {
    load();
    api.getUsersByRole('LIVREUR').then(setDrivers);
    api.getVehicles().then(setVehicles);
    api.getOrders().then((list) => setOrders(list.filter((o) => o.status === 'VALIDEE')));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createTour({
        zone: form.zone,
        date: form.date,
        driverId: form.driverId,
        vehicleId: form.vehicleId,
        orderIds: form.orderIds.length ? form.orderIds : undefined,
      });
      setShowForm(false);
      await load();
    } catch {
      setError('Impossible de créer la tournée');
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

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Tournées"
        subtitle="Planification et suivi des livraisons"
        actions={
          can('tours', 'create') ? (
            <button type="button" className="erp-btn" onClick={() => setShowForm(true)}>
              + Nouvelle tournée
            </button>
          ) : undefined
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
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      <Modal title="Nouvelle tournée" open={showForm} onClose={() => setShowForm(false)}>
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
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.name}</option>)}
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
            {saving ? 'Enregistrement...' : 'Créer la tournée'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
