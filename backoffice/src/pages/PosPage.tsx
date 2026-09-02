import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  api,
  CashClosing,
  ConsigneBalances,
  OutstandingOrder,
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
import ProductSaleCard, { ProductSaleGrid } from '../components/ProductSaleCard';
import ClientSituationPanel from '../components/ClientSituationPanel';
import { printPosSalesList, printPosTicket } from '../documents/templates';
import { exportSheet } from '../excel/specs';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  MPESA: 'M-Pesa',
  ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money',
  WAVE: 'Wave',
  CREDIT: 'Crédit',
};

const HOLD_KEY = 'emmapp-pos-hold';

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

type CartLine = { productId: string; quantity: number; emptiesReturned: number };
type PosMode = 'sale' | 'advance' | 'acompte';

export default function PosPage() {
  const { can } = usePermissions();
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('ESPECES');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [sales, setSales] = useState<PosSale[]>([]);
  const [summary, setSummary] = useState({ tickets: 0, cancelled: 0, revenue: 0, averageTicket: 0 });
  const [consigneBalance, setConsigneBalance] = useState<ConsigneBalances | null>(null);
  const [closing, setClosing] = useState<CashClosing | null>(null);
  const [countedAmount, setCountedAmount] = useState('');
  const [closingError, setClosingError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [held, setHeld] = useState(false);
  const [mode, setMode] = useState<PosMode>('sale');
  const [amountToCollect, setAmountToCollect] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [acompteOrderId, setAcompteOrderId] = useState('');
  const [acompteAmount, setAcompteAmount] = useState('');
  const [outstanding, setOutstanding] = useState<OutstandingOrder[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

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
    api.getCurrentCashClosing().then(setClosing).catch(() => setClosing(null));
    setHeld(Boolean(sessionStorage.getItem(HOLD_KEY)));
  }, []);

  useEffect(() => {
    if (!clientId) {
      setConsigneBalance(null);
      return;
    }
    api.getClientConsigneBalances(clientId)
      .then(setConsigneBalance)
      .catch(() => setConsigneBalance(null));
  }, [clientId, sales.length]);

  useEffect(() => {
    if (!clientId || mode !== 'acompte') {
      setOutstanding([]);
      setAcompteOrderId('');
      return;
    }
    api.getOutstandingOrders(clientId)
      .then((orders) => {
        setOutstanding(orders);
        setAcompteOrderId(orders[0]?.id ?? '');
        setAcompteAmount(orders[0] ? String(Math.round(orders[0].remaining)) : '');
      })
      .catch(() => {
        setOutstanding([]);
        setAcompteOrderId('');
      });
  }, [clientId, mode, sales.length]);

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

  const qtyOf = (productId: string) => cart.find((l) => l.productId === productId)?.quantity ?? 0;

  const addProduct = (productId: string, amount = 1) => {
    if (amount < 1) return;
    setCart((prev) => {
      const found = prev.find((l) => l.productId === productId);
      if (found) return prev.map((l) => l.productId === productId ? { ...l, quantity: l.quantity + amount } : l);
      return [...prev, { productId, quantity: amount, emptiesReturned: 0 }];
    });
  };

  /**
   * Contenants effectivement remis au client : la quantite facturee plus les
   * articles offerts, qui sortent eux aussi du stock et sont donc consignes.
   */
  const deliveredOf = (productId: string, quantity: number) => {
    const priced = quote?.lines.find((l) => l.productId === productId);
    return quantity + (priced?.bonusQuantity ?? 0);
  };

  const setQty = (productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity < 1) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => l.productId === productId ? { ...l, quantity } : l);
    });
  };

  /**
   * Le client peut rapporter plus de vides qu'il n'en emporte : le surplus
   * apure sa dette de consigne, on ne le plafonne donc pas.
   */
  const setEmpties = (productId: string, value: number) => {
    setCart((prev) => prev.map((l) => l.productId === productId
      ? { ...l, emptiesReturned: Math.max(0, Math.floor(value) || 0) }
      : l));
  };

  const clearCart = () => {
    setCart([]);
    setDraftQty({});
    setQuote(null);
    setCashReceived('');
    setReference('');
    setNotes('');
    setError('');
  };

  const holdSale = () => {
    if (!cart.length) return;
    sessionStorage.setItem(HOLD_KEY, JSON.stringify({ cart, clientId, method, notes }));
    setHeld(true);
    clearCart();
  };

  const restoreHeld = () => {
    const raw = sessionStorage.getItem(HOLD_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { cart: CartLine[]; clientId?: string; method?: PaymentMethod; notes?: string };
      setCart((saved.cart ?? []).map((l) => ({ ...l, emptiesReturned: l.emptiesReturned ?? 0 })));
      if (saved.clientId) setClientId(saved.clientId);
      if (saved.method) setMethod(saved.method);
      if (saved.notes) setNotes(saved.notes);
      sessionStorage.removeItem(HOLD_KEY);
      setHeld(false);
    } catch {
      sessionStorage.removeItem(HOLD_KEY);
      setHeld(false);
    }
  };

  const catalogTotal = cart.reduce((sum, line) => {
    const product = catalog?.products.find((p) => p.id === line.productId);
    return sum + Number(product?.unitPrice ?? 0) * line.quantity;
  }, 0);
  const total = quote?.total ?? catalogTotal;
  // L'avance deja versee par le client vient en deduction de l'espece a encaisser.
  const advanceApplied = quote?.advanceApplied ?? 0;
  const netToPay = quote?.netToPay ?? total;
  const collectAmount = amountToCollect !== '' ? Number(amountToCollect) : netToPay;
  const received = Number(cashReceived || 0);
  const change = method === 'ESPECES' && received > 0 ? Math.max(0, received - collectAmount) : 0;
  const selectedOrder = outstanding.find((o) => o.id === acompteOrderId);
  const walkInId = catalog?.walkInClient.id;
  const isWalkIn = Boolean(walkInId && clientId === walkInId);

  const switchMode = (next: PosMode) => {
    setMode(next);
    setError('');
    setSuccessMsg('');
  };

  const selectAcompteOrder = (orderId: string) => {
    setAcompteOrderId(orderId);
    const order = outstanding.find((o) => o.id === orderId);
    if (order) setAcompteAmount(String(Math.round(order.remaining)));
  };

  const openClosing = async () => {
    setClosingError('');
    try {
      setClosing(await api.openCashClosing());
    } catch (err) {
      setClosingError(err instanceof Error ? err.message : 'Ouverture impossible');
    }
  };

  const closeClosing = async () => {
    if (!closing) return;
    setClosingError('');
    try {
      const result = await api.closeCashClosing(closing.id, { countedAmount: Number(countedAmount || 0) });
      setClosing(null);
      setCountedAmount('');
      const variance = Number(result.variance);
      setClosingError(
        variance === 0
          ? `Caisse ${result.reference} cloturée sans écart.`
          : `Caisse ${result.reference} cloturée avec un écart de ${money(variance)}.`,
      );
    } catch (err) {
      setClosingError(err instanceof Error ? err.message : 'Clôture impossible');
    }
  };

  const checkout = async (e: FormEvent) => {
    e.preventDefault();
    if (!cart.length) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    const partial = collectAmount < netToPay - 0.001;
    const payload: PosCheckoutInput = {
      clientId: clientId || null,
      lines: cart,
      method,
      cashReceived: method === 'ESPECES' ? (received || collectAmount) : undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      amountPaid: partial ? collectAmount : undefined,
    };
    try {
      const sale = await api.checkoutPos(payload);
      setLastSale(sale);
      printPosTicket(sale);
      clearCart();
      setAmountToCollect('');
      setSuccessMsg(partial ? `Vente enregistrée — acompte de ${money(collectAmount)}` : 'Vente enregistrée');
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encaissement impossible');
    } finally {
      setSaving(false);
    }
  };

  const submitAdvance = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId || isWalkIn) return;
    const amount = Number(advanceAmount);
    if (amount <= 0) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.posAdvance({
        clientId,
        amount,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setAdvanceAmount('');
      setReference('');
      setNotes('');
      setSuccessMsg(`Avance de ${money(amount)} enregistrée`);
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avance impossible');
    } finally {
      setSaving(false);
    }
  };

  const submitAcompte = async (e: FormEvent) => {
    e.preventDefault();
    if (!acompteOrderId) return;
    const amount = Number(acompteAmount);
    if (amount <= 0) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.posAcompte({
        orderId: acompteOrderId,
        amount,
        method,
        cashReceived: method === 'ESPECES' ? (received || amount) : undefined,
        reference: reference.trim() || undefined,
      });
      setAcompteAmount('');
      setReference('');
      setSuccessMsg(`Acompte de ${money(amount)} sur ${selectedOrder?.orderNumber ?? 'la commande'}`);
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acompte impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Point de vente"
        subtitle="Caisse tablette : catalogue, panier et encaissement"
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
            {lastSale && <DocButton label="Réimprimer le dernier ticket" onClick={() => printPosTicket(lastSale)} />}
          </>
        }
      />
      <div className="erp-kpi-row">
        <div className="erp-kpi erp-kpi--blue"><div className="erp-kpi-label">Tickets du jour</div><div className="erp-kpi-value">{summary.tickets}</div></div>
        <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Encaissements</div><div className="erp-kpi-value">{money(summary.revenue)}</div></div>
        <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Ticket moyen</div><div className="erp-kpi-value">{money(summary.averageTicket)}</div></div>
      </div>

      <form className="pos-tablet" onSubmit={mode === 'sale' ? checkout : mode === 'advance' ? submitAdvance : submitAcompte}>
        {mode === 'sale' && (
        <section className="pos-tablet-catalog">
          <input
            className="pos-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit, un code ou un format"
            aria-label="Recherche produit"
          />
          <div className="pos-product-list">
            <ProductSaleGrid>
              {products.map((p) => {
                const inCart = qtyOf(p.id);
                const draft = draftQty[p.id] ?? 1;
                return (
                  <ProductSaleCard
                    key={p.id}
                    name={p.name}
                    code={p.code}
                    format={p.format}
                    imageUrl={p.imageUrl}
                    price={Number(p.unitPrice)}
                    quantity={draft}
                    min={1}
                    onQuantityChange={(q) => setDraftQty((prev) => ({ ...prev, [p.id]: q }))}
                    onAdd={() => addProduct(p.id, draft)}
                    disabled={!can('pos', 'create')}
                    selected={inCart > 0}
                    badge={inCart > 0 ? `${inCart} au panier` : undefined}
                    metaLabel="Retrait"
                    metaValue="Immédiat en caisse"
                    note={inCart > 0 ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--sm erp-btn--ghost"
                        onClick={() => setQty(p.id, 0)}
                      >
                        Retirer du panier
                      </button>
                    ) : undefined}
                  />
                );
              })}
            </ProductSaleGrid>
            {!products.length && <p className="erp-table-empty">Aucun produit.</p>}
          </div>
        </section>
        )}

        <aside className="pos-tablet-cart">
          <div className="pos-mode-tabs" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['sale', 'advance', 'acompte'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`erp-btn erp-btn--sm${mode === m ? '' : ' erp-btn--ghost'}`}
                onClick={() => switchMode(m)}
              >
                {m === 'sale' ? 'Vente' : m === 'advance' ? 'Avance' : 'Acompte'}
              </button>
            ))}
          </div>
          <div className="pos-cart-title">
            {mode === 'sale' ? 'Vente en cours' : mode === 'advance' ? 'Avance client' : 'Acompte commande'}
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {catalog?.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <ClientSituationPanel clientId={clientId} compact refreshKey={sales.length} />
          {mode === 'sale' && (
          <div className="pos-cart-lines">
            {cart.map((line) => {
              const priced = quote?.lines.find((l) => l.productId === line.productId);
              const product = catalog?.products.find((p) => p.id === line.productId);
              const name = priced?.name ?? product?.name ?? line.productId;
              const unit = priced?.unitPrice ?? Number(product?.unitPrice ?? 0);
              const lineTotal = priced?.lineTotal ?? unit * line.quantity;
              const reusable = priced?.isReusable ?? product?.isReusable ?? false;
              const offered = priced?.bonusQuantity ?? 0;
              const delivered = line.quantity + offered;
              return (
                <div key={line.productId} className="pos-cart-line">
                  <div>
                    <strong>{name}</strong>
                    <p>{money(unit)} / u. × {line.quantity}{priced?.ruleName ? ` · ${priced.ruleName}` : ''}</p>
                    {reusable && (
                      <label className="pos-cart-empties">
                        Vides rendus{offered > 0 ? ` (sur ${delivered} livrés)` : ''}
                        <input
                          type="number"
                          min={0}
                          value={line.emptiesReturned}
                          onChange={(e) => setEmpties(line.productId, Number(e.target.value))}
                        />
                        {priced && priced.consigneQuantity > 0 && (
                          <span className="erp-muted">
                            {priced.consigneQuantity} consigné(s) · {money(priced.consigneAmount)}
                          </span>
                        )}
                        {line.emptiesReturned > delivered && (
                          <span className="erp-muted">
                            +{line.emptiesReturned - delivered} en avoir
                          </span>
                        )}
                      </label>
                    )}
                  </div>
                  <strong>{money(lineTotal)}</strong>
                </div>
              );
            })}
            {!cart.length && (
              <p className="erp-table-empty">
                {held ? 'Une vente est en attente. Restaurez-la pour continuer.' : 'Ajoutez un produit au panier.'}
              </p>
            )}
          </div>
          )}
          {mode === 'sale' && quote && quote.consigneAmount > 0 && (
            <>
              <div className="pos-cart-subtotal">
                <span>Marchandise</span>
                <span>{money(quote.goodsAmount)}</span>
              </div>
              <div className="pos-cart-subtotal">
                <span>Consigne ({quote.consigneQuantity} contenant{quote.consigneQuantity > 1 ? 's' : ''})</span>
                <span>{money(quote.consigneAmount)}</span>
              </div>
            </>
          )}
          {mode === 'sale' && (
          <div className="pos-cart-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          )}
          {mode === 'sale' && advanceApplied > 0 && (
            <>
              <div className="pos-cart-total">
                <span>Avance du client</span>
                <strong>− {money(advanceApplied)}</strong>
              </div>
              <div className="pos-cart-total">
                <span>Net à encaisser</span>
                <strong>{money(netToPay)}</strong>
              </div>
            </>
          )}
          {mode === 'sale' && consigneBalance && consigneBalance.totalQuantity > 0 && (
            <p className="erp-muted" style={{ marginBottom: 8 }}>
              Vidange due par ce client : {consigneBalance.totalQuantity} contenant(s) · {money(consigneBalance.totalAmount)}
            </p>
          )}
          {mode === 'sale' && quote && quote.bonusQuantity > 0 && (
            <p className="erp-muted" style={{ marginBottom: 8 }}>
              Bonus : {quote.bonusQuantity} article{quote.bonusQuantity > 1 ? 's' : ''} offert{quote.bonusQuantity > 1 ? 's' : ''} ({money(quote.bonus)})
            </p>
          )}
          {mode === 'advance' && (
            <p className="erp-muted" style={{ marginBottom: 12 }}>
              {isWalkIn
                ? 'Sélectionnez un client identifié pour enregistrer une avance.'
                : 'Le montant reste au crédit du client et sera déduit des prochaines ventes.'}
            </p>
          )}
          {mode === 'acompte' && (
            <>
              {!outstanding.length ? (
                <p className="erp-muted" style={{ marginBottom: 12 }}>
                  Aucune commande impayée pour ce client.
                </p>
              ) : (
                <>
                  <div className="form-group">
                    <label>Commande</label>
                    <select value={acompteOrderId} onChange={(e) => selectAcompteOrder(e.target.value)}>
                      {outstanding.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} — reste {money(o.remaining)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Montant acompte (CDF)</label>
                    <input
                      type="number"
                      min={1}
                      max={selectedOrder?.remaining}
                      step={100}
                      value={acompteAmount}
                      onChange={(e) => setAcompteAmount(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
            </>
          )}
          {mode === 'advance' && (
            <div className="form-group">
              <label>Montant avance (CDF)</label>
              <input
                type="number"
                min={1}
                step={100}
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                required
                disabled={isWalkIn}
              />
            </div>
          )}
          <div className="form-group">
            <label>Mode de paiement</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(catalog?.methods ?? ['ESPECES']).map((m) => (
                <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>
              ))}
            </select>
          </div>
          {mode === 'sale' && cart.length > 0 && netToPay > 0 && (
            <div className="form-group">
              <label>Montant à encaisser</label>
              <input
                type="number"
                min={1}
                max={netToPay}
                step={100}
                value={amountToCollect}
                onChange={(e) => setAmountToCollect(e.target.value)}
                placeholder={String(netToPay)}
              />
              {collectAmount < netToPay - 0.001 && (
                <p className="erp-muted">Acompte partiel — reste {money(netToPay - collectAmount)}</p>
              )}
            </div>
          )}
          {(mode === 'sale' || mode === 'acompte') && method === 'ESPECES' && (
            <div className="form-group">
              <label>Montant reçu</label>
              <input
                type="number"
                min={0}
                step={100}
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder={
                  mode === 'sale'
                    ? (collectAmount ? String(collectAmount) : netToPay ? String(netToPay) : '')
                    : acompteAmount || undefined
                }
              />
              {received > 0 && (
                <p className="erp-muted">
                  Monnaie : {money(
                    mode === 'sale'
                      ? change
                      : Math.max(0, received - Number(acompteAmount || 0)),
                  )}
                </p>
              )}
            </div>
          )}
          {method !== 'ESPECES' && method !== 'CREDIT' && (
            <div className="form-group">
              <label>Référence</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° transaction" />
            </div>
          )}
          <div className="form-group">
            <label>Note</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          {successMsg && <p className="erp-muted" style={{ color: 'var(--erp-success, #15803d)' }}>{successMsg}</p>}
          {mode === 'sale' && held && !cart.length && (
            <button type="button" className="erp-btn" style={{ width: '100%', marginBottom: 8 }} onClick={restoreHeld}>
              Restaurer la vente en attente
            </button>
          )}
          <div className="pos-actions">
            {mode === 'sale' && (
              <>
                <button type="button" className="pos-btn pos-btn--cancel" onClick={clearCart} disabled={!cart.length}>Annuler</button>
                <button type="button" className="pos-btn pos-btn--hold" onClick={holdSale} disabled={!cart.length}>Attente</button>
              </>
            )}
            {can('pos', 'create') && (
              <button
                type="submit"
                className="pos-btn pos-btn--pay"
                disabled={
                  saving
                  || (mode === 'sale' && !cart.length)
                  || (mode === 'advance' && (isWalkIn || !advanceAmount))
                  || (mode === 'acompte' && (!acompteOrderId || !acompteAmount))
                }
                style={mode !== 'sale' ? { flex: 1 } : undefined}
              >
                {saving
                  ? 'Enregistrement...'
                  : mode === 'sale'
                    ? (collectAmount < netToPay - 0.001 ? `Acompte ${money(collectAmount)}` : 'Paiement')
                    : mode === 'advance'
                      ? 'Enregistrer l’avance'
                      : 'Enregistrer l’acompte'}
              </button>
            )}
          </div>
        </aside>
      </form>

      <ErpPanel title="Clôture de caisse">
        {closing ? (
          <div className="pos-closing">
            <p>
              Session <strong>{closing.reference}</strong> ouverte le{' '}
              {new Date(closing.openedAt).toLocaleString('fr-FR')}.
            </p>
            <div className="form-group">
              <label>Montant compté en caisse</label>
              <input
                type="number"
                min={0}
                step={100}
                value={countedAmount}
                onChange={(e) => setCountedAmount(e.target.value)}
              />
            </div>
            <button type="button" className="erp-btn" onClick={closeClosing}>
              Clôturer la caisse
            </button>
          </div>
        ) : (
          <div className="pos-closing">
            <p className="erp-muted">Aucune session de caisse ouverte.</p>
            <button type="button" className="erp-btn" onClick={openClosing}>
              Ouvrir une session
            </button>
          </div>
        )}
        {closingError && <p className="erp-muted">{closingError}</p>}
      </ErpPanel>

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
              <tr><td colSpan={7} className="erp-table-empty">Aucune vente aujourd’hui.</td></tr>
            )}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
