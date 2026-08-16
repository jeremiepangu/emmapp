import { FormEvent, useEffect, useState } from 'react';
import { api, Client, CreateQuoteRequestInput, Product, QuoteRequest, QuoteRequestStatus } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printQuote, printQuotesList } from '../documents/templates';

export default function MarketplacePage() {
  const { can } = usePermissions();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<CreateQuoteRequestInput>({
    companyName: '',
    contactEmail: '',
    segment: 'DETAILLANT',
    lines: [{ productId: '', quantity: 10 }],
  });
  const [quotedAmount, setQuotedAmount] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.getQuoteRequests(), api.getProducts(), api.getClients().catch(() => [])])
      .then(([q, p, c]) => { setQuotes(q); setProducts(p); setClients(c); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api.createQuoteRequest({
      ...form,
      lines: form.lines.filter((l) => l.productId && l.quantity > 0),
    });
    setForm({ companyName: '', contactEmail: '', segment: 'DETAILLANT', lines: [{ productId: '', quantity: 10 }] });
    load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Marketplace B2B"
        subtitle="Demandes de cotation des grossistes et détaillants, conversion en commande interne"
        actions={<DocButton label="Imprimer les devis" onClick={() => printQuotesList(quotes)} />}
      />
      {error && <p className="error-msg">{error}</p>}

      {can('marketplace', 'create') && (
        <ErpPanel title="Nouvelle demande" padded>
          <form onSubmit={submit} className="form-row">
            <div className="form-group"><label>Société</label><input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required /></div>
            <div className="form-group">
              <label>Segment</label>
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as CreateQuoteRequestInput['segment'] })}>
                <option value="DETAILLANT">Détaillant</option>
                <option value="BOUTIQUE">Boutique</option>
                <option value="SUPERMARCHE">Supermarché</option>
                <option value="ENTREPRISE">Entreprise</option>
                <option value="HOTEL_RESTAURANT">Hôtel / restaurant</option>
              </select>
            </div>
            <div className="form-group">
              <label>Client existant</label>
              <select value={form.clientId ?? ''} onChange={(e) => setForm({ ...form, clientId: e.target.value || undefined })}>
                <option value="">Aucun</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Produit</label>
              <select value={form.lines[0]?.productId} onChange={(e) => setForm({ ...form, lines: [{ ...form.lines[0], productId: e.target.value }] })}>
                <option value="">Choisir…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Quantité</label><input type="number" min={1} value={form.lines[0]?.quantity} onChange={(e) => setForm({ ...form, lines: [{ ...form.lines[0], quantity: Number(e.target.value) }] })} /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Enregistrer</button></div>
          </form>
        </ErpPanel>
      )}

      <ErpPanel title={`Demandes (${quotes.length})`}>
        <table className="erp-table">
          <thead><tr><th>Réf.</th><th>Société</th><th>Segment</th><th>Lignes</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td><code>{q.reference}</code></td>
                <td>{q.companyName}<div className="erp-muted">{q.contactEmail}</div></td>
                <td>{q.segment}</td>
                <td>{q.lines.map((l) => `${l.productName} × ${l.quantity}`).join(', ')}</td>
                <td>{q.quotedAmount != null ? Number(q.quotedAmount).toLocaleString('fr-FR') : '—'}</td>
                <td><StatusPill status={q.status} /></td>
                <td className="erp-row-actions">
                  <DocButton label="Devis" onClick={() => printQuote(q)} />
                  {can('marketplace', 'update') && q.status === 'NOUVELLE' && (
                    <>
                      <input
                        style={{ width: 100 }}
                        placeholder="CDF"
                        value={quotedAmount[q.id] ?? ''}
                        onChange={(e) => setQuotedAmount({ ...quotedAmount, [q.id]: e.target.value })}
                      />
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.updateQuoteRequest(q.id, { status: 'ACCEPTEE' as QuoteRequestStatus, quotedAmount: Number(quotedAmount[q.id] || 0) }).then(load)}>Accepter</button>
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.updateQuoteRequest(q.id, { status: 'REFUSEE' }).then(load)}>Refuser</button>
                    </>
                  )}
                  {can('marketplace', 'validate') && q.status === 'ACCEPTEE' && (
                    <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.convertQuoteRequest(q.id).then(load)}>Convertir en commande</button>
                  )}
                </td>
              </tr>
            ))}
            {!quotes.length && <tr><td colSpan={7} className="erp-muted">Aucune demande.</td></tr>}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
