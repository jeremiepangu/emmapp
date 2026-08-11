import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api, Tour, Order } from '../api';

export default function MobilePage() {
  const { user, login, logout } = useAuth();
  const [email, setEmail] = useState('livreur@emmapp.cd');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [qtyDelivered, setQtyDelivered] = useState<Record<string, number>>({});
  const [qtyReturned, setQtyReturned] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user?.role === 'LIVREUR' || user?.role === 'ADMIN') {
      api.getTours().then(setTours).catch(() => setError('Impossible de charger les tournées'));
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Identifiants invalides');
    }
  };

  const openOrder = (tour: Tour, order: Order) => {
    setSelectedTour(tour);
    setSelectedOrder(order);
    setMessage('');
    const lines = (order as Order & { lines?: Array<{ productId: string; quantity: number; unitPrice: number }> }).lines;
    if (lines) {
      const delivered: Record<string, number> = {};
      lines.forEach((l) => { delivered[l.productId] = l.quantity; });
      setQtyDelivered(delivered);
      setQtyReturned({});
      setPayment(String(lines.reduce((s, l) => s + l.quantity * Number(l.unitPrice), 0)));
    }
  };

  const submitDelivery = async () => {
    if (!selectedTour || !selectedOrder) return;
    setMessage('Envoi...');
    try {
      const lines = ((selectedOrder as Order & { lines?: Array<{ productId: string; quantity: number; unitPrice: number }> }).lines || []).map((l) => ({
        productId: l.productId,
        qtyDelivered: qtyDelivered[l.productId] ?? l.quantity,
        qtyReturned: qtyReturned[l.productId] ?? 0,
        qtyDamaged: 0,
        qtyRefused: 0,
        unitPrice: Number(l.unitPrice),
      }));

      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_URL || '/api/v1';

      await fetch(`${base}/deliveries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          tourId: selectedTour.id,
          lines,
        }),
      });

      if (Number(payment) > 0) {
        await fetch(`${base}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clientId: (selectedOrder as Order & { clientId?: string }).clientId,
            amount: Number(payment),
            method: 'ESPECES',
          }),
        });
      }

      setMessage('Livraison enregistrée !');
      setSelectedOrder(null);
    } catch {
      setMessage('Erreur lors de l\'enregistrement');
    }
  };

  if (!user) {
    return (
      <div className="mobile-app">
        <div className="mobile-header">
          <h1>EMMAPP Mobile</h1>
          <p>Livraison terrain (web)</p>
        </div>
        <form className="mobile-login" onSubmit={handleLogin}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" />
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary">Se connecter</button>
        </form>
      </div>
    );
  }

  if (selectedOrder && selectedTour) {
    const lines = (selectedOrder as Order & { lines?: Array<{ productId: string; product?: { name: string; isReusable: boolean }; quantity: number }> }).lines || [];
    return (
      <div className="mobile-app">
        <div className="mobile-header">
          <button onClick={() => setSelectedOrder(null)}>← Retour</button>
          <h2>{selectedOrder.client?.name}</h2>
        </div>
        {lines.map((line) => (
          <div key={line.productId} className="mobile-card">
            <strong>{line.product?.name}</strong>
            <label>Livrés</label>
            <input type="number" value={qtyDelivered[line.productId] ?? line.quantity}
              onChange={(e) => setQtyDelivered({ ...qtyDelivered, [line.productId]: Number(e.target.value) })} />
            {line.product?.isReusable && (
              <>
                <label>Retours vides</label>
                <input type="number" value={qtyReturned[line.productId] ?? 0}
                  onChange={(e) => setQtyReturned({ ...qtyReturned, [line.productId]: Number(e.target.value) })} />
              </>
            )}
          </div>
        ))}
        <div className="mobile-card">
          <label>Encaissement (CDF)</label>
          <input type="number" value={payment} onChange={(e) => setPayment(e.target.value)} />
        </div>
        <button className="btn btn-primary mobile-submit" onClick={submitDelivery}>Confirmer livraison</button>
        {message && <p className="mobile-msg">{message}</p>}
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <div className="mobile-header">
        <h1>Mes tournées</h1>
        <p>{user.firstName} {user.lastName}</p>
        <button className="btn" onClick={logout}>Déconnexion</button>
      </div>
      {tours.map((tour) => (
        <div key={tour.id} className="mobile-card">
          <strong>{tour.tourNumber}</strong>
          <span className="badge badge-info">{tour.status}</span>
          <p>{tour.zone}</p>
          {(tour.orders || []).map((order) => (
            <button key={order.id} className="mobile-order-btn" onClick={() => openOrder(tour, order)}>
              {order.client?.name} — {order.orderNumber}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
