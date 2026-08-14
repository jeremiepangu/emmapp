import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api, Tour, Order, PaymentMethod } from '../api';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CREDIT', label: 'Crédit' },
];

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
  const [qtyDamaged, setQtyDamaged] = useState<Record<string, number>>({});
  const [qtyRefused, setQtyRefused] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ESPECES');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTours = async () => {
    if (!user) return;
    try {
      const params = user.role === 'LIVREUR' ? { driverId: user.id } : undefined;
      setTours(await api.getTours(params));
    } catch {
      setError('Impossible de charger les tournées');
    }
  };

  useEffect(() => {
    if (user?.role === 'LIVREUR' || user?.role === 'ADMIN') {
      loadTours();
    }
  }, [user]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGps(null),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [selectedOrder]);

  const handleLogin = async (e: FormEvent) => {
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
    const lines = order.lines || [];
    const delivered: Record<string, number> = {};
    lines.forEach((l) => { delivered[l.productId] = l.quantity; });
    setQtyDelivered(delivered);
    setQtyReturned({});
    setQtyDamaged({});
    setQtyRefused({});
    const total = lines.reduce((s, l) => s + l.quantity * Number(l.unitPrice), 0);
    setPayment(String(total));
    setPaymentMethod('ESPECES');
  };

  const submitDelivery = async () => {
    if (!selectedTour || !selectedOrder) return;
    setLoading(true);
    setMessage('Envoi...');
    try {
      const lines = (selectedOrder.lines || []).map((l) => ({
        productId: l.productId,
        qtyDelivered: qtyDelivered[l.productId] ?? l.quantity,
        qtyReturned: qtyReturned[l.productId] ?? 0,
        qtyDamaged: qtyDamaged[l.productId] ?? 0,
        qtyRefused: qtyRefused[l.productId] ?? 0,
        unitPrice: Number(l.unitPrice),
      }));

      const delivery = await api.createDelivery({
        orderId: selectedOrder.id,
        tourId: selectedTour.id,
        latitude: gps?.lat,
        longitude: gps?.lng,
        lines,
      });

      if (Number(payment) > 0) {
        await api.createPayment({
          clientId: selectedOrder.clientId,
          deliveryId: delivery.id,
          amount: Number(payment),
          method: paymentMethod,
        });
      }

      setMessage('Livraison enregistrée !');
      setSelectedOrder(null);
      await loadTours();
    } catch {
      setMessage('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTour = async (tourId: string) => {
    await api.startTour(tourId);
    await loadTours();
  };

  const handleCompleteTour = async (tourId: string) => {
    await api.completeTour(tourId);
    await loadTours();
  };

  if (!user) {
    return (
      <div className="mobile-app">
        <div className="mobile-header">
          <h1>EMMAPP Web</h1>
          <p>Application livreur — navigateur</p>
        </div>
        <form className="mobile-login" onSubmit={handleLogin}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" />
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary">Se connecter</button>
          <Link to="/login" className="mobile-link">Accès administration →</Link>
        </form>
      </div>
    );
  }

  if (user.role !== 'LIVREUR' && user.role !== 'ADMIN') {
    return (
      <div className="mobile-app">
        <div className="mobile-header">
          <h1>Accès réservé</h1>
          <p>Cette interface est réservée aux livreurs</p>
        </div>
        <div className="mobile-card">
          <Link to="/">Retour au back-office</Link>
        </div>
      </div>
    );
  }

  if (selectedOrder && selectedTour) {
    const lines = selectedOrder.lines || [];
    return (
      <div className="mobile-app">
        <div className="mobile-header">
          <button type="button" onClick={() => setSelectedOrder(null)}>← Retour</button>
          <h2>{selectedOrder.client?.name}</h2>
          <p className="mobile-gps">{gps ? `GPS : ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'GPS indisponible'}</p>
        </div>
        {lines.map((line) => (
          <div key={line.productId} className="mobile-card">
            <strong>{line.product?.name}</strong>
            <label>Commandé : {line.quantity}</label>
            <label>Livrés</label>
            <input type="number" min={0} value={qtyDelivered[line.productId] ?? line.quantity}
              onChange={(e) => setQtyDelivered({ ...qtyDelivered, [line.productId]: Number(e.target.value) })} />
            {line.product?.isReusable && (
              <>
                <label>Retours vides</label>
                <input type="number" min={0} value={qtyReturned[line.productId] ?? 0}
                  onChange={(e) => setQtyReturned({ ...qtyReturned, [line.productId]: Number(e.target.value) })} />
              </>
            )}
            <label>Endommagés</label>
            <input type="number" min={0} value={qtyDamaged[line.productId] ?? 0}
              onChange={(e) => setQtyDamaged({ ...qtyDamaged, [line.productId]: Number(e.target.value) })} />
            <label>Refusés</label>
            <input type="number" min={0} value={qtyRefused[line.productId] ?? 0}
              onChange={(e) => setQtyRefused({ ...qtyRefused, [line.productId]: Number(e.target.value) })} />
          </div>
        ))}
        <div className="mobile-card">
          <label>Encaissement (CDF)</label>
          <input type="number" min={0} value={payment} onChange={(e) => setPayment(e.target.value)} />
          <label>Mode de paiement</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary mobile-submit" onClick={submitDelivery} disabled={loading}>
          {loading ? 'Envoi...' : 'Confirmer livraison'}
        </button>
        {message && <p className="mobile-msg">{message}</p>}
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <div className="mobile-header">
        <h1>Mes tournées</h1>
        <p>{user.firstName} {user.lastName}</p>
        <div className="mobile-header-actions">
          {user.role === 'ADMIN' && <Link to="/" className="mobile-header-link">Admin</Link>}
          <button type="button" className="btn btn-ghost" onClick={logout}>Déconnexion</button>
        </div>
      </div>
      {tours.length === 0 && (
        <div className="mobile-card"><p>Aucune tournée assignée.</p></div>
      )}
      {tours.map((tour) => (
        <div key={tour.id} className="mobile-card">
          <div className="mobile-card-head">
            <strong>{tour.tourNumber}</strong>
            <span className="badge badge-info">{tour.status}</span>
          </div>
          <p>{tour.zone} — {new Date(tour.date).toLocaleDateString('fr-FR')}</p>
          {tour.status === 'PLANIFIEE' && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => handleStartTour(tour.id)}>
              Démarrer la tournée
            </button>
          )}
          {tour.status === 'EN_COURS' && (
            <button type="button" className="btn btn-sm" onClick={() => handleCompleteTour(tour.id)}>
              Terminer la tournée
            </button>
          )}
          {(tour.orders || []).map((order) => (
            <button key={order.id} type="button" className="mobile-order-btn" onClick={() => openOrder(tour, order)}>
              {order.client?.name} — {order.orderNumber}
            </button>
          ))}
        </div>
      ))}
      <nav className="mobile-bottom-nav">
        <span className="active">Tournées</span>
        <button type="button" onClick={loadTours}>Actualiser</button>
      </nav>
    </div>
  );
}
