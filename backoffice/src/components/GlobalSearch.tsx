import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, GlobalSearchResults } from '../api';
import { Icon } from './ErpIcons';

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      api.globalSearch(q.trim()).then(setResults).catch(() => setResults(null));
    }, 220);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const hasHits = results && (results.clients.length + results.orders.length + results.lots.length + results.deliveries.length) > 0;

  return (
    <div className="erp-global-search" ref={boxRef}>
      <label className="sr-only" htmlFor="global-search">Recherche globale</label>
      <span className="erp-global-search-icon" aria-hidden>
        <Icon name="search" size={18} />
      </span>
      <input
        id="global-search"
        type="search"
        placeholder="Rechercher un client, une commande ou un lot"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label="Recherche globale client, commande ou lot"
      />
      {open && q.trim().length >= 2 && (
        <div className="erp-search-panel" role="listbox">
          {!hasHits && <p className="erp-muted">Aucun résultat.</p>}
          {results?.clients.map((c) => (
            <Link key={c.id} to="/clients" className="erp-search-hit" onClick={() => setOpen(false)}>
              Client · {c.code} {c.name}
            </Link>
          ))}
          {results?.orders.map((o) => (
            <Link key={o.id} to="/orders" className="erp-search-hit" onClick={() => setOpen(false)}>
              Commande · {o.orderNumber} {o.clientName ?? ''}
            </Link>
          ))}
          {results?.lots.map((l) => (
            <Link key={l.id} to="/production" className="erp-search-hit" onClick={() => setOpen(false)}>
              Lot · {l.lotNumber} {l.productFormat}
            </Link>
          ))}
          {results?.deliveries.map((d) => (
            <Link key={d.id} to="/deliveries" className="erp-search-hit" onClick={() => setOpen(false)}>
              Livraison · {d.deliveryNumber} {d.clientName ?? ''}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
