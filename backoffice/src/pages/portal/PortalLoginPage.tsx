import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortal } from '../../PortalContext';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('client@boutique-kintambo.cd');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState(
    new URLSearchParams(window.location.search).has('expired')
      ? 'Session expirée — veuillez vous reconnecter.'
      : '',
  );
  const [loading, setLoading] = useState(false);
  const { login } = usePortal();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/portail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="erp-login-page">
      <div className="erp-login-left">
        <div className="erp-login-brand">EMMAS</div>
        <p className="erp-login-tag">Portail client — commande, suivi, consigne</p>
        <ul className="erp-login-features">
          <li>Commander en autonomie</li>
          <li>Suivre la livraison</li>
          <li>Consulter consignes et fidélité</li>
          <li>Régler par monnaie électronique</li>
        </ul>
      </div>
      <div className="erp-login-right">
        <div className="erp-login-box">
          <h2>Espace client</h2>
          <p className="erp-login-box-desc">Connexion au portail self-service EMMAPURE</p>
          <form onSubmit={submit}>
            <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="form-group"><label>Mot de passe</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="erp-btn" disabled={loading}>{loading ? 'Connexion…' : 'Entrer'}</button>
          </form>
          <p className="erp-muted" style={{ marginTop: 16 }}>
            Compte démo : client@boutique-kintambo.cd / password123
            {' · '}
            <Link to="/login">Espace interne</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
