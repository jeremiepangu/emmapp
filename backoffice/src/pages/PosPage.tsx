import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  api,
  PaymentMethod,
  PosCatalog,
  PosCheckoutInput,
  PosQuote,
  PosSale,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printPosSalesList, printPosTicket } from '../documents/templates';
import { exportSheet } from '../excel/specs';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  ESPECES: 'Especes',
  CHEQUE: 'Cheque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  MPESA: 'M-Pesa',
  ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money',
  WAVE: 'Wave',
  CREDIT: 'Credit',
};

function money(value: string | number | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} CDF`;
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

type CartLine = { productId: string; quantity: number };

export default function PosPage() {
  const { can } = usePermissions();
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('ESPECES');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [sales, setSales] = useState<PosSale[]>([]);
  const [summary, setSummary] = useState({ tickets: 0, cancelled: 0, revenue: 0, averageTicket: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState<PosSale | null>(null);

  const loadSales = () => {
    const { from, to } = todayBounds();
    return api.getPosSales(from, to).then((res) => {
      setSales(res.sales);
      setSummary(res.summary);
    });
  };

  useEffect(() => {
    api.getPosCatalog().then((c) => {
      setCatalog(c);
      setClientId(c.walkInClient.id);
    }).catch(() => setError('Impossible de charger le catalogue caisse'));
    loadSales().catch(() => setSales([]));
  }, []);

  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api.quotePos({ clientId: clientId || null, lines: cart })
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cart, clientId]);

  const products = useMemo(() => {
    const list = catalog?.products ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => `${p.name} ${p.code} ${p.format}`.toLowerCase().includes(q));
  }, [catalog, search]);

  const addProduct = (productId: string) => {
    setCart((prev) => {
      const found = prev.find((l) => l.productId === productId);
      if (found) return prev.map((l) => l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const setQty = (productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity < 1) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => l.productId === productId ? { ...l, quantity } : l);
    });
  };

  const clearCart = () => {
    setCart([]);
    setQuote(null);
    setCashReceived('');
    setReference('');
    setNotes('');
    setError('');
  };

  const total = quote?.total ?? 0;
  const received = Number(cashReceived || 0);
  const change = method === 'ESPECES' && received > 0 ? Math.max(0, received - total) : 0;

  const checkout = async (e: FormEvent) => {
    e.preventDefault();
    if (!cart.length) return;
    setSaving(true);
    setError('');
    const payload: PosCheckoutInput = {
      clientId: clientId || null,
      lines: cart,
      method,
      cashReceived: method === 'ESPECES' ? (received || total) : undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      const sale = await api.checkoutPos(payload);
      setLastSale(sale);
      printPosTicket(sale);
      clearCart();
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encaissement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Point de vente"
        subtitle="Caisse comptoir : panier, tarif, encaissement et ticket"
        excel={{
          filename: 'caisse',
          sheets: [exportSheet('Tickets', [['saleNumber', 'Ticket'], ['client', 'Client'], ['method', 'Mode'], ['total', 'Montant'], ['status', 'Statut'], ['date', 'Date']], sales.map((row) => ({
            saleNumber: row.saleNumber,
            client: row.client?.name ?? '',
            method: row.method,
            total: Number(row.totalAmount),
            status: row.status,
            date: new Date(row.createdAt).toLocaleString('fr-FR'),
          })))],
        }}
        actions={
          <>
            <DocButton label="Journal du jour" onClick={() => printPosSalesList(sales)} />
            {lastSale && <DocButton label="Reimprimer le dernier ticket" onClick={() => printPosTicket(lastSale)} />}
          </>
        }
      />
      <div className="erp-kpi-row">
        <div className="erp-kpi erp-kpi--blue"><div className="erp-kpi-label">Tickets du jour</div><div className="erp-kpi-value">{summary.tickets}</div></div>
        <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Encaissements</div><div className="erp-kpi-value">{money(summary.revenue)}</div></div>
        <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Ticket moyen</div><div className="erp-kpi-value">{money(summary.averageTicket)}</div></div>
      </div>
      <div className="pos-layout">
        <ErpPanel title="Catalogue">
          <div className="form-group">
            <label>Recherche</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, code ou format" />
          </div>
          <div className="pos-grid">
            {products.map((p) => (
              <button key={p.id} type="button" className="pos-card" onClick={() => addProduct(p.id)} disabled={!can('pos', 'create')}>
                <strong>{p.name}</strong>
                <p className="erp-muted">{p.code} · {p.format}</p>
                <div className="pos-card-price">{money(p.unitPrice)}</div>
              </button>
            ))}
            {!products.length && <p className="erp-table-empty">Aucun produit.</p>}
          </div>
        </ErpPanel>
        <ErpPanel title="Panier">
          <form className="form-stack" onSubmit={checkout}>
            <div className="form-group">
              <label>Client</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {catalog?.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Qte</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => {
                  const priced = quote?.lines.find((l) => l.productId === line.productId);
                  const product = catalog?.products.find((p) => p.id === line.productId);
                  const name = priced?.name ?? product?.name ?? line.productId;
                  const unit = priced?.unitPrice ?? Number(product?.unitPrice ?? 0);
                  const lineTotal = priced?.lineTotal ?? unit * line.quantity;
                  return (
                    <tr key={line.productId}>
                      <td>
                        <strong>{name}</strong>
                        <div className="erp-muted">{money(unit)} / u.{priced?.ruleName ? ` · ${priced.ruleName}` : ''}</div>
                      </td>
                      <td>
                        <div className="pos-qty">
                          <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setQty(line.productId, line.quantity - 1)}>-</button>
                          <span>{line.quantity}</span>
                          <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setQty(line.productId, line.quantity + 1)}>+</button>
                        </div>
                      </td>
                      <td>{money(lineTotal)}</td>
                    </tr>
                  );
                })}
                {!cart.length && (
                  <tr><td colSpan={3} className="erp-table-empty">Touchez un produit pour l ajouter.</td></tr>
                )}
              </tbody>
            </table>
            {quote && (
              <p className="erp-muted">
                Sous-total {money(quote.subtotal)}
                {quote.discount > 0 ? ` · remise ${money(quote.discount)} (lots de 10)` : ''}
                {' · '}<strong>{money(quote.total)}</strong>
              </p>
            )}
            <div className="form-group">
              <label>Mode de paiement</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(catalog?.methods ?? ['ESPECES']).map((m) => (
                  <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>
                ))}
              </select>
            </div>
            {method === 'ESPECES' && (
              <div className="form-group">
                <label>Montant recu</label>
                <input type="number" min={0} step={100} value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder={total ? String(total) : ''} />
                {received > 0 && <p className="erp-muted">Monnaie : {money(change)}</p>}
              </div>
            )}
            {method !== 'ESPECES' && method !== 'CREDIT' && (
              <div className="form-group">
                <label>Reference</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N transaction" />
              </div>
            )}
            <div className="form-group">
              <label>Note</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="form-row">
              <button type="button" className="erp-btn erp-btn--ghost" onClick={clearCart} disabled={!cart.length}>Vider</button>
              {can('pos', 'create') && (
                <button type="submit" className="erp-btn" disabled={!cart.length || saving}>
                  {saving ? 'Encaissement...' : `Encaisser ${money(total)}`}
                </button>
              )}
            </div>
          </form>
        </ErpPanel>
      </div>
      <ErpPanel title={`Ventes du jour (${sales.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Heure</th>
              <th>Client</th>
              <th>Mode</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.saleNumber}</strong></td>
                <td>{new Date(s.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{s.client?.name ?? '—'}</td>
                <td>{METHOD_LABEL[s.method] ?? s.method}</td>
                <td>{money(s.totalAmount)}</td>
                <td><StatusPill status={s.status} /></td>
                <td className="erp-row-actions">
                  <DocButton label="Ticket" onClick={() => printPosTicket(s)} />
                  {can('pos', 'validate') && s.status === 'PAYEE' && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => api.cancelPosSale(s.id).then(loadSales)}
                    >
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!sales.length && (
              <tr><td colSpan={7} className="erp-table-empty">Aucune vente aujourd hui.</td></tr>
            )}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
