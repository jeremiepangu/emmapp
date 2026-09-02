import { useEffect, useState } from 'react';
import { api, Delivery, DeliveryTourReconciliation, Tour } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import Modal from '../components/Modal';
import ClientSituationPanel from '../components/ClientSituationPanel';
import { printDeliveriesList, printDeliveryNote } from '../documents/templates';
import { sheetDeliveries } from '../excel/specs';

export default function DeliveriesPage() {
  const { can } = usePermissions();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [situationClient, setSituationClient] = useState<{ id: string; name: string } | null>(null);
  const [reconcileTourId, setReconcileTourId] = useState('');
  const [reconciliation, setReconciliation] = useState<DeliveryTourReconciliation | null>(null);
  const [proofDelivery, setProofDelivery] = useState<Delivery | null>(null);
  const load = () => api.getDeliveries().then(setDeliveries);
  useEffect(() => {
    load();
    api.getTours().then(setTours).catch(() => setTours([]));
  }, []);

  const openReconciliation = async (tourId: string) => {
    setReconcileTourId(tourId);
    try {
      setReconciliation(await api.getDeliveryTourReconciliation(tourId));
    } catch {
      setReconciliation(null);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Livraisons"
        subtitle="Preuves de livraison, validation et historique"
        excel={{ filename: 'livraisons', sheets: [sheetDeliveries(deliveries)] }}
        actions={<DocButton label="Imprimer la liste" onClick={() => printDeliveriesList(deliveries)} />}
      />

      <ErpPanel title="Rapprochement par tournée" padded>
        <div className="form-row">
          <div className="form-group">
            <label>Tournée</label>
            <select value={reconcileTourId} onChange={(e) => openReconciliation(e.target.value)}>
              <option value="">— Choisir —</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>{t.tourNumber} — {t.zone} ({new Date(t.date).toLocaleDateString('fr-FR')})</option>
              ))}
            </select>
          </div>
        </div>
        {reconciliation && (
          <div className="form-stack">
            <p>
              <strong>{reconciliation.deliveries}</strong> livraison(s) · chargé :{' '}
              {reconciliation.loadSheets.length > 0 ? `${reconciliation.loadSheets.length} bordereau(x)` : 'aucun bordereau'}
            </p>
            <table className="erp-table erp-table--compact">
              <thead>
                <tr><th>Livrés</th><th>Retournés</th><th>Refusés</th><th>Endommagés</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{reconciliation.totals.delivered}</td>
                  <td>{reconciliation.totals.returned}</td>
                  <td>{reconciliation.totals.refused}</td>
                  <td>{reconciliation.totals.damaged}</td>
                </tr>
              </tbody>
            </table>
            {reconciliation.loadSheets.length === 0 && (
              <p className="erp-muted">Sans bordereau de chargement, le rapprochement détaillé se fait sur la page Écarts.</p>
            )}
          </div>
        )}
      </ErpPanel>

      <ErpPanel title={`Historique (${deliveries.length})`}>
        {deliveries.length === 0 ? (
          <p className="erp-table-empty">Aucune livraison enregistrée pour le moment.</p>
        ) : (
          <table className="erp-table">
            <thead>
              <tr><th>N° Livraison</th><th>Client</th><th>Statut</th><th>Date</th><th>Preuves</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.deliveryNumber}</strong></td>
                  <td>{d.client?.name ?? '—'}</td>
                  <td><StatusPill status={d.status} label={d.status} /></td>
                  <td>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('fr-FR') : '—'}</td>
                  <td>
                    {d.photoUrl || d.signatureUrl ? (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setProofDelivery(d)}>
                        Voir
                      </button>
                    ) : '—'}
                  </td>
                  <td className="erp-row-actions">
                    <DocButton label="BL" onClick={() => printDeliveryNote(d)} />
                    {d.client?.id && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setSituationClient({ id: d.client!.id!, name: d.client!.name })}>
                        Situation
                      </button>
                    )}
                    {can('deliveries', 'validate') && d.status === 'EN_ATTENTE' && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.updateDelivery(d.id, { status: 'LIVREE' }).then(load)}>Valider</button>
                    )}
                    {can('deliveries', 'update') && d.status === 'EN_ATTENTE' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.updateDelivery(d.id, { status: 'REFUSEE' }).then(load)}>Refuser</button>
                    )}
                    {can('deliveries', 'delete') && d.status !== 'LIVREE' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteDelivery(d.id).then(load)}>Supprimer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ErpPanel>

      <Modal
        title={`Situation — ${situationClient?.name ?? ''}`}
        open={Boolean(situationClient)}
        onClose={() => setSituationClient(null)}
        wide
      >
        <ClientSituationPanel clientId={situationClient?.id} />
      </Modal>

      <Modal
        title={`Preuves — ${proofDelivery?.deliveryNumber ?? ''}`}
        open={Boolean(proofDelivery)}
        onClose={() => setProofDelivery(null)}
        wide
      >
        {proofDelivery && (
          <div className="form-stack">
            {proofDelivery.photoUrl && (
              <div>
                <label>Photo</label>
                <img src={proofDelivery.photoUrl} alt="Preuve livraison" style={{ maxWidth: '100%', borderRadius: 8 }} />
              </div>
            )}
            {proofDelivery.signatureUrl && (
              <div>
                <label>Signature</label>
                <img src={proofDelivery.signatureUrl} alt="Signature client" style={{ maxWidth: '100%', borderRadius: 8, background: '#fff' }} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
