import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api, Tour, Order, PaymentMethod } from '../api';
import EmmaLogo from '../components/EmmaBrand';
import DocButton from '../components/DocButton';
import { printOrder, printTourSheet } from '../documents/templates';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money (générique)' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CREDIT', label: 'Crédit' },
];

const FIELD_ROLES = ['LIVREUR', 'CHARGE_LIVRAISON'];

export default function MobilePage() {
  const { user, login, logout } = useAuth();
  const [email, setEmail] = useState('livreur@emmapure.cd');
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
  const [notifCount, setNotifCount] = useState(0);
  const [voiceHint, setVoiceHint] = useState('');

  const startVoice = (onText: (text: string) => void) => {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => {
      lang: string;
      interimResults: boolean;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      start: () => void;
    }) | undefined;
    if (!Ctor) {
      setVoiceHint('Saisie vocale non disponible sur ce navigateur.');
      return;
    }
    const rec = new Ctor();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? '';
      onText(text);
      setVoiceHint(`Entendu : ${text}`);
    };
    rec.onerror = () => setVoiceHint('Saisie vocale interrompue.');
    rec.start();
    setVoiceHint('Parlez…');
  };

  const loadTours = async () => {
    if (!user) return;
    try {
      const params = FIELD_ROLES.includes(user.role) ? { driverId: user.id } : undefined;
      setTours(await api.getTours(params));
    } catch {
      setError('Impossible de charger les tournées');
    }
  };

  useEffect(() => {
    if (user?.role === 'LIVREUR' || user?.role === 'CHARGE_LIVRAISON' || user?.role === 'ADMIN') {
      loadTours();
    }
    if (user) {
      api.getUnreadNotificationCount().then((r) => setNotifCount(r.count)).catch(() => setNotifCount(0));
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
      <div className="erp-mobile-app">
        <div className="erp-mobile-header">
          <div className="mobile-logo-wrap">
            <EmmaLogo size="sm" variant="light" />
          </div>
          <p className="erp-mobile-tagline">Application livreur</p>
        </div>
        <form className="erp-mobile-login" onSubmit={handleLogin}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" />
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn erp-mobile-submit">Se connecter</button>
          <Link to="/login" className="erp-mobile-link">Accès administration →</Link>
        </form>
      </div>
    );
  }

  if (!FIELD_ROLES.includes(user.role) && user.role !== 'ADMIN') {
    return (
      <div className="erp-mobile-app">
        <div className="erp-mobile-header">
          <h1>Accès réservé</h1>
          <p>Cette interface est réservée aux chargés de livraison</p>
        </div>
        <div className="erp-mobile-card">
          <Link to="/app">Retour au back-office</Link>
        </div>
      </div>
    );
  }

  if (selectedOrder && selectedTour) {
    const lines = selectedOrder.lines || [];
    return (
      <div className="erp-mobile-app">
        <div className="erp-mobile-header">
          <button type="button" onClick={() => setSelectedOrder(null)}>← Retour</button>
          <h2>{selectedOrder.client?.name}</h2>
          <DocButton label="BL / commande" onClick={() => printOrder(selectedOrder)} />
          <p className="erp-mobile-gps">{gps ? `GPS : ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'GPS indisponible'}</p>
        </div>
        {lines.map((line) => (
          <div key={line.productId} className="erp-mobile-card">
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
        <div className="erp-mobile-card">
          <label>Encaissement (CDF)</label>
          <input type="number" min={0} value={payment} onChange={(e) => setPayment(e.target.value)} />
          <button
            type="button"
            className="erp-btn erp-btn--sm erp-btn--ghost"
            onClick={() => startVoice((text) => {
              const n = text.replace(/[^\d]/g, '');
              if (n) setPayment(n);
            })}
          >
            Saisie vocale de l'encaissement
          </button>
          {voiceHint && <p className="erp-mobile-gps">{voiceHint}</p>}
          <label>Mode de paiement</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <button type="button" className="erp-btn erp-mobile-submit" onClick={submitDelivery} disabled={loading}>
          {loading ? 'Envoi...' : 'Confirmer livraison'}
        </button>
        {message && <p className="erp-mobile-msg">{message}</p>}
      </div>
    );
  }

  return (
    <div className="erp-mobile-app">
      <div className="erp-mobile-header">
        <h1>Mes tournées</h1>
        <p>{user.firstName} {user.lastName}</p>
        <div className="erp-mobile-header-actions">
          {notifCount > 0 && <span className="erp-mobile-notif-badge">{notifCount} alerte{notifCount > 1 ? 's' : ''}</span>}
          {user.role === 'ADMIN' && <Link to="/app" className="erp-mobile-header-link">Admin</Link>}
          <button type="button" className="btn btn-ghost" onClick={logout}>Déconnexion</button>
        </div>
      </div>
      {tours.length === 0 && (
        <div className="erp-mobile-card"><p>Aucune tournée assignée.</p></div>
      )}
      {tours.map((tour) => (
        <div key={tour.id} className="erp-mobile-card">
          <div className="erp-mobile-card-head">
            <strong>{tour.tourNumber}</strong>
            <span className="erp-pill erp-pill--blue">{tour.status}</span>
          </div>
          <p>{tour.zone} — {new Date(tour.date).toLocaleDateString('fr-FR')}</p>
          <DocButton label="Feuille de tournée" onClick={() => printTourSheet(tour)} />
          {tour.status === 'PLANIFIEE' && (
            <button type="button" className="erp-btn erp-btn--sm" onClick={() => handleStartTour(tour.id)}>
              Démarrer la tournée
            </button>
          )}
          {tour.status === 'EN_COURS' && (
            <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => handleCompleteTour(tour.id)}>
              Terminer la tournée
            </button>
          )}
          {(tour.orders || []).map((order) => (
            <button key={order.id} type="button" className="erp-mobile-order-btn" onClick={() => openOrder(tour, order)}>
              {order.client?.name} — {order.orderNumber}
            </button>
          ))}
        </div>
      ))}
      <nav className="erp-mobile-bottom-nav">
        <span className="active">Tournées</span>
        <button type="button" onClick={loadTours}>Actualiser</button>
      </nav>
    </div>
  );
}
