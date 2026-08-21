import type {
  Client,
  Product,
  Order,
  Payment,
  Delivery,
  Tour,
  StockItem,
  ProductionOrder,
  QualityCheck,
  LoyaltyClient,
  ConsigneMovement,
  EmployeeProfile,
  LeaveRequest,
  ShiftAssignment,
  Payslip,
  PayrollPeriod,
  User,
  QuoteRequest,
  PortalInvoice,
  DashboardOverview,
  DemandForecast,
  Anomaly,
  NotificationItem,
  IotSensor,
  EsgDashboard,
  EsgIndicator,
  OptimizedRoute,
  SecurityAlert,
  SecuritySummary,
  AuditEntry,
  PortalAccount,
  ObservabilityStatus,
  PackagingUnit,
  FountainAsset,
  PortalLoyalty,
  PortalConsigne,
  DeliveryTracking,
  PricingRule,
  ActivityOverview,
  ActivityReportDetail,
  HrDashboard,
  PerformanceObjective,
  PerformanceReview,
  BusinessContract,
  Vehicle,
  PackagingSku,
  PackagingMovement,
  AuthorizationCatalog,
  JobFunction,
  ActivityDeclaration,
  TrainingCourse,
  TrainingEnrollment,
  HrDocument,
  AssistantSession,
} from '../api';
import { formatDate, formatMoney, printDocument, printList, type DocSpec } from './printDocument';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function printClientSheet(c: Client): void {
  const address = [
    [c.avenue, c.avenueNumber].filter(Boolean).join(' '),
    c.quartier,
    c.commune,
    c.district,
    c.province || 'KINSHASA',
  ].filter(Boolean).join(', ') || c.address || c.zone || '—';
  printDocument({
    kind: 'Fiche client',
    reference: c.code,
    logoUrl: c.logoUrl,
    fields: [
      { label: 'Nom / raison sociale', value: c.name },
      { label: 'Code', value: c.code },
      { label: 'Segment', value: c.segment },
      { label: 'Profession / secteur', value: c.profession ?? '—' },
      { label: 'Téléphone', value: c.phone ?? '—' },
      { label: 'Avenue et numéro', value: [c.avenue, c.avenueNumber].filter(Boolean).join(' ') || '—' },
      { label: 'Quartier', value: c.quartier ?? '—' },
      { label: 'Commune', value: c.commune ?? c.zone ?? '—' },
      { label: 'District', value: c.district ?? '—' },
      { label: 'Province', value: c.province || 'KINSHASA' },
      { label: 'Adresse', value: address },
      { label: 'Pièce d’identité', value: c.idDocumentType ? `${c.idDocumentType}${c.idDocumentNumber ? ` n° ${c.idDocumentNumber}` : ''}` : '—' },
      { label: 'Géolocalisation', value: c.latitude != null && c.longitude != null ? `${c.latitude}, ${c.longitude}` : '—' },
      { label: 'Consignes', value: `${c.consigneBalance} / ${c.consigneLimit}` },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le client'],
  });
}

export function printClientsList(clients: Client[]): void {
  printList(
    'Registre clients',
    ['Code', 'Nom', 'Segment', 'Commune', 'Téléphone', 'Pièce', 'Consignes'],
    clients.map((c) => [
      c.code,
      c.name,
      c.segment,
      c.commune ?? c.zone ?? '—',
      c.phone ?? '—',
      c.idDocumentNumber ?? c.idDocumentType ?? '—',
      `${c.consigneBalance}/${c.consigneLimit}`,
    ]),
  );
}

export function printProductSheet(p: Product): void {
  printDocument({
    kind: 'Fiche produit',
    reference: p.code,
    fields: [
      { label: 'Nom', value: p.name },
      { label: 'Code', value: p.code },
      { label: 'Format', value: p.format },
      { label: 'Prix unitaire', value: formatMoney(p.unitPrice) },
      { label: 'Réutilisable', value: p.isReusable ? 'Oui (consigné)' : 'Non' },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printProductsCatalog(products: Product[]): void {
  printList(
    'Catalogue produits',
    ['Code', 'Nom', 'Format', 'Prix', 'Réutilisable'],
    products.map((p) => [p.code, p.name, p.format, formatMoney(p.unitPrice), p.isReusable ? 'Oui' : 'Non']),
  );
}

export function printPricingRules(rules: PricingRule[]): void {
  printList(
    'Regles tarifaires',
    ['Nom', 'Portee', 'Produit', 'Qte min', 'Qte max', 'Type', 'Valeur'],
    rules.map((r) => [
      r.name,
      [r.client?.name, r.zone ? `Zone ${r.zone}` : '', r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : '', r.segment ?? '']
        .filter(Boolean)
        .join(' / ') || 'General',
      r.product?.name ?? 'Tous',
      String(r.minQuantity),
      r.maxQuantity == null ? 'Illimite' : String(r.maxQuantity),
      r.type === 'PERCENT' ? 'Remise %' : 'Prix fixe',
      r.type === 'PERCENT' ? `${Number(r.value)} %` : formatMoney(r.value),
    ]),
  );
}

export function printOrder(o: Order): void {
  const lines = o.lines ?? [];
  printDocument({
    kind: 'Bon de commande',
    reference: o.orderNumber,
    fields: [
      { label: 'Client', value: o.client?.name ?? '—' },
      { label: 'Statut', value: o.status },
      { label: 'N° commande', value: o.orderNumber },
    ],
    tables: [{
      title: 'Lignes',
      headers: ['Produit', 'Qté', 'Prix unitaire', 'Remise', 'Montant'],
      rows: lines.length
        ? lines.map((l) => {
            const qty = l.quantity;
            const unit = Number(l.unitPrice);
            return [
              l.product?.name ?? l.productId,
              String(qty),
              formatMoney(unit),
              Number(l.discount ?? 0) > 0 ? formatMoney(l.discount) : '—',
              formatMoney(qty * unit),
            ];
          })
        : [['—', '—', '—', '—', formatMoney(o.totalAmount)]],
    }],
    totals: [{ label: 'Total TTC', value: formatMoney(o.totalAmount) }],
    notes: 'Document généré depuis EMMAPP. Les consignes d\'emballages réutilisables restent dues jusqu\'au retour.',
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le client'],
  });
}

export function printOrdersList(orders: Order[]): void {
  printList(
    'Registre des commandes',
    ['N°', 'Client', 'Montant', 'Statut'],
    orders.map((o) => [o.orderNumber, o.client?.name ?? '—', formatMoney(o.totalAmount), o.status]),
  );
}

export function printPaymentReceipt(p: Payment): void {
  printDocument({
    kind: 'Reçu de paiement',
    reference: `REC-${p.id.slice(0, 8).toUpperCase()}`,
    date: p.createdAt,
    fields: [
      { label: 'Client', value: p.client?.name ?? '—' },
      { label: 'Mode', value: p.method },
      { label: 'Date', value: formatDate(p.createdAt) },
    ],
    totals: [{ label: 'Montant encaissé', value: formatMoney(p.amount) }],
    notes: 'Reçu valable comme justificatif d\'encaissement EMMANUEL SERVICES SARLU.',
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le payeur'],
  });
}

export function printPaymentsList(payments: Payment[]): void {
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  printDocument({
    kind: 'Registre des paiements',
    tables: [{
      headers: ['Date', 'Client', 'Mode', 'Montant'],
      rows: payments.map((p) => [formatDate(p.createdAt), p.client?.name ?? '—', p.method, formatMoney(p.amount)]),
    }],
    totals: [{ label: 'Total encaissé', value: formatMoney(total) }],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printDeliveryNote(d: Delivery): void {
  printDocument({
    kind: 'Bon de livraison',
    reference: d.deliveryNumber,
    date: d.deliveredAt,
    fields: [
      { label: 'Client', value: d.client?.name ?? '—' },
      { label: 'Statut', value: d.status },
      { label: 'Livré le', value: d.deliveredAt ? formatDate(d.deliveredAt) : 'En attente' },
    ],
    notes: 'À signer par le destinataire à réception. Toute réclamation doit être formulée au moment de la livraison.',
    signatures: ['Pour EMMANUEL SERVICES SARLU / livreur', 'Pour le client'],
  });
}

export function printDeliveriesList(deliveries: Delivery[]): void {
  printList(
    'Registre des livraisons',
    ['N°', 'Client', 'Statut', 'Date'],
    deliveries.map((d) => [d.deliveryNumber, d.client?.name ?? '—', d.status, d.deliveredAt ? formatDate(d.deliveredAt) : '—']),
  );
}

export function printTourSheet(t: Tour): void {
  printDocument({
    kind: 'Ordre de mission / feuille de tournée',
    reference: t.tourNumber,
    date: t.date,
    fields: [
      { label: 'Zone', value: t.zone },
      { label: 'Statut', value: t.status },
      { label: 'Chauffeur', value: t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '—' },
      { label: 'Véhicule', value: t.vehicle ? `${t.vehicle.plate} — ${t.vehicle.name}` : '—' },
    ],
    tables: t.orders?.length ? [{
      title: 'Arrêts / commandes',
      headers: ['N° commande', 'Client', 'Montant', 'Statut'],
      rows: t.orders.map((o) => [o.orderNumber, o.client?.name ?? '—', formatMoney(o.totalAmount), o.status]),
    }] : undefined,
    notes: 'À présenter en cas de contrôle. Le chauffeur confirme le chargement et les retours de consignes en fin de tournée.',
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le chauffeur'],
  });
}

export function printToursList(tours: Tour[]): void {
  printList(
    'Registre des tournées',
    ['N°', 'Zone', 'Date', 'Chauffeur', 'Statut'],
    tours.map((t) => [t.tourNumber, t.zone, formatDate(t.date), t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '—', t.status]),
  );
}

export function printInventory(items: StockItem[]): void {
  printDocument({
    kind: 'État d\'inventaire',
    tables: [{
      headers: ['Produit', 'Emplacement', 'Lot', 'Quantité'],
      rows: items.map((i) => [i.product.name, i.location.name, i.lotNumber ?? '—', String(i.quantity)]),
    }],
    notes: 'Inventaire généré depuis EMMAPP. Les lots bloqués ou en quarantaine restent exclus des expéditions.',
    signatures: ['Pour EMMANUEL SERVICES SARLU / magasin'],
  });
}

export function printProductionOrder(p: ProductionOrder): void {
  printDocument({
    kind: 'Ordre de fabrication',
    reference: p.orderNumber,
    fields: [
      { label: 'Lot', value: p.lotNumber },
      { label: 'Format', value: p.productFormat },
      { label: 'Ligne', value: p.lineCode },
      { label: 'Planifié', value: String(p.plannedQty) },
      { label: 'Produit', value: String(p.producedQty) },
      { label: 'Statut lot', value: p.lotStatus },
      { label: 'Statut OF', value: p.status },
    ],
    signatures: ['Chef de ligne', 'Qualité'],
  });
}

export function printProductionList(orders: ProductionOrder[]): void {
  printList(
    'Registre de production',
    ['N° OF', 'Lot', 'Format', 'Ligne', 'Planifié', 'Produit', 'Statut'],
    orders.map((p) => [p.orderNumber, p.lotNumber, p.productFormat, p.lineCode, String(p.plannedQty), String(p.producedQty), p.status]),
  );
}

export function printQualityReport(q: QualityCheck): void {
  printDocument({
    kind: 'Rapport de contrôle qualité',
    reference: q.lotNumber,
    fields: [
      { label: 'Lot', value: q.lotNumber },
      { label: 'pH', value: q.ph != null ? String(q.ph) : '—' },
      { label: 'TDS', value: q.tds != null ? String(q.tds) : '—' },
      { label: 'Microbiologie', value: q.microbiologyOk == null ? '—' : q.microbiologyOk ? 'Conforme' : 'Non conforme' },
      { label: 'Statut', value: q.status },
    ],
    notes: 'Contrôle interne EMMANUEL SERVICES SARLU. Un lot non conforme ne peut pas être libéré.',
    signatures: ['Laboratoire', 'Responsable qualité'],
  });
}

export function printQualityList(checks: QualityCheck[]): void {
  printList(
    'Registre des contrôles qualité',
    ['Lot', 'pH', 'TDS', 'Microbiologie', 'Statut'],
    checks.map((q) => [q.lotNumber, q.ph != null ? String(q.ph) : '—', q.tds != null ? String(q.tds) : '—', q.microbiologyOk == null ? '—' : q.microbiologyOk ? 'OK' : 'KO', q.status]),
  );
}

export function printLoyaltySheet(c: LoyaltyClient): void {
  printDocument({
    kind: 'Relevé de fidélité',
    reference: c.code,
    fields: [
      { label: 'Client', value: c.name },
      { label: 'Segment', value: c.segment },
      { label: 'Niveau', value: c.loyaltyTier },
      { label: 'Points', value: String(c.loyaltyPoints) },
      { label: 'Portefeuille', value: formatMoney(c.walletBalance) },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le client'],
  });
}

export function printLoyaltyList(clients: LoyaltyClient[]): void {
  printList(
    'Registre fidélité',
    ['Code', 'Client', 'Niveau', 'Points', 'Portefeuille'],
    clients.map((c) => [c.code, c.name, c.loyaltyTier, String(c.loyaltyPoints), formatMoney(c.walletBalance)]),
  );
}

export function printConsigneMovement(m: ConsigneMovement): void {
  printDocument({
    kind: 'Mouvement de consignes',
    reference: m.client?.code ?? m.id.slice(0, 8),
    date: m.createdAt,
    fields: [
      { label: 'Client', value: m.client ? `${m.client.name} (${m.client.code})` : '—' },
      { label: 'Format', value: m.productFormat },
      { label: 'Entrées', value: String(m.qtyIn) },
      { label: 'Sorties', value: String(m.qtyOut) },
      { label: 'Solde après', value: String(m.balanceAfter) },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le client'],
  });
}

export function printConsignesList(movements: ConsigneMovement[]): void {
  printList(
    'Registre des consignes',
    ['Date', 'Client', 'Format', 'In', 'Out', 'Solde'],
    movements.map((m) => [formatDate(m.createdAt), m.client?.name ?? '—', m.productFormat, String(m.qtyIn), String(m.qtyOut), String(m.balanceAfter)]),
  );
}

export function printEmployeeSheet(e: EmployeeProfile): void {
  const address = [e.avenue, e.avenueNumber, e.quartier, e.commune, e.district, e.province || 'KINSHASA'].filter(Boolean).join(', ');
  printDocument({
    kind: 'Fiche agent',
    reference: e.matricule,
    logoUrl: e.photoUrl ?? undefined,
    fields: [
      { label: 'Agent', value: e.user ? `${e.user.firstName} ${e.user.lastName}` : '—' },
      { label: 'Matricule', value: e.matricule },
      { label: 'Sexe', value: e.gender ?? '—' },
      { label: 'Naissance', value: e.birthDate ? formatDate(e.birthDate) : '—' },
      { label: 'État civil', value: e.maritalStatus ?? '—' },
      { label: 'Adresse', value: address || e.address || '—' },
      { label: 'Urgence', value: [e.emergencyName, e.emergencyPhone].filter(Boolean).join(' · ') || '—' },
      { label: 'Poste', value: e.jobTitle },
      { label: 'Fonction', value: e.jobFunction?.name ?? '—' },
      { label: 'Service', value: e.department },
      { label: 'Responsable', value: e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '—' },
      { label: 'Contrat', value: e.contractType },
      { label: 'Embauche', value: formatDate(e.hireDate) },
      { label: 'Salaire de base', value: formatMoney(e.baseSalary) },
      { label: 'CNSS', value: e.cnssNumber ?? '—' },
      { label: 'Statut', value: e.status },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU / RH', 'Pour l\'agent'],
  });
}

export function printWorkCertificate(e: EmployeeProfile): void {
  const name = e.user ? `${e.user.firstName} ${e.user.lastName}` : 'l\'intéressé(e)';
  printDocument({
    kind: 'Attestation de travail',
    reference: e.matricule,
    notes: `Nous soussignés, EMMANUEL SERVICES SARLU, attestons que ${name}, matricule ${e.matricule}, occupe le poste de ${e.jobTitle} au sein du service ${e.department} depuis le ${formatDate(e.hireDate)}, sous contrat ${e.contractType}. La présente attestation est délivrée pour servir et valoir ce que de droit.`,
    signatures: ['Pour EMMANUEL SERVICES SARLU / RH'],
  });
}

export function printEmploymentCertificate(e: EmployeeProfile): void {
  const name = e.user ? `${e.user.firstName} ${e.user.lastName}` : 'l\'intéressé(e)';
  printDocument({
    kind: 'Certificat d\'emploi',
    reference: e.matricule,
    fields: [
      { label: 'Employé', value: name },
      { label: 'Matricule', value: e.matricule },
      { label: 'Fonction', value: e.jobTitle },
      { label: 'Service', value: e.department },
      { label: 'Statut', value: e.status },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU / RH'],
  });
}

export function printLeaveCertificate(l: LeaveRequest): void {
  printDocument({
    kind: 'Attestation de congé',
    reference: `CONGE-${l.id.slice(0, 8).toUpperCase()}`,
    fields: [
      { label: 'Agent', value: l.user ? `${l.user.firstName} ${l.user.lastName}` : '—' },
      { label: 'Type', value: l.type },
      { label: 'Début', value: formatDate(l.startDate) },
      { label: 'Fin', value: formatDate(l.endDate) },
      { label: 'Durée', value: `${l.days} jour(s)` },
      { label: 'Statut', value: l.status },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU / RH'],
  });
}

export function printEvaluationSheet(r: PerformanceReview, objectives: PerformanceObjective[]): void {
  printDocument({
    kind: 'Fiche d\'évaluation',
    reference: `${r.user?.lastName ?? 'EVA'}-${r.period}`,
    fields: [
      { label: 'Agent', value: r.user ? `${r.user.firstName} ${r.user.lastName}` : '—' },
      { label: 'Période', value: r.period },
      { label: 'Score final', value: r.finalScore != null ? String(r.finalScore) : '—' },
      { label: 'Statut', value: r.status },
    ],
    tables: [{
      headers: ['Objectif', 'Poids %'],
      rows: objectives.map((o) => [o.title, String(o.weight)]),
    }],
    notes: [r.selfComment ? `Auto-évaluation : ${r.selfComment}` : '', r.managerComment ? `Manager : ${r.managerComment}` : ''].filter(Boolean).join('\n'),
    signatures: ['Employé', 'Responsable / RH'],
  });
}

export function printHrDashboard(d: HrDashboard): void {
  printDocument({
    kind: 'Tableau de bord RH',
    reference: String(d.year),
    fields: [
      { label: 'Effectif actif', value: String(d.effectifs.total) },
      { label: 'Archivés', value: String(d.effectifs.archived) },
      { label: 'Absents du jour', value: String(d.conges.absentToday) },
      { label: 'Congés consommés', value: `${d.conges.consumed} j` },
      { label: 'Soldes restants', value: `${d.conges.remaining} j` },
      { label: 'Taux activités', value: `${d.activites.rate} %` },
      { label: 'Performance moyenne', value: String(d.performance.average) },
      { label: 'Formations suivies', value: String(d.formations.followed) },
    ],
    tables: [{
      title: 'Effectifs par service',
      headers: ['Service', 'Effectif'],
      rows: Object.entries(d.effectifs.byDepartment).map(([k, v]) => [k, String(v)]),
    }],
    signatures: ['Pour EMMANUEL SERVICES SARLU / RH'],
  });
}

export function printEmployeesList(employees: EmployeeProfile[]): void {
  printList(
    'Registre du personnel',
    ['Matricule', 'Agent', 'Poste', 'Département', 'Contrat', 'Statut'],
    employees.map((e) => [e.matricule, e.user ? `${e.user.firstName} ${e.user.lastName}` : '—', e.jobTitle, e.department, e.contractType, e.status]),
  );
}

export function printLeaveRequest(l: LeaveRequest): void {
  printDocument({
    kind: 'Demande de congé',
    reference: `CONGE-${l.id.slice(0, 8).toUpperCase()}`,
    fields: [
      { label: 'Agent', value: l.user ? `${l.user.firstName} ${l.user.lastName}` : '—' },
      { label: 'Type', value: l.type },
      { label: 'Début', value: formatDate(l.startDate) },
      { label: 'Fin', value: formatDate(l.endDate) },
      { label: 'Jours', value: String(l.days) },
      { label: 'Motif', value: l.reason ?? '—' },
      { label: 'Statut', value: l.status },
    ],
    signatures: ['Pour l\'agent', 'Pour EMMANUEL SERVICES SARLU / RH'],
  });
}

export function printLeavesList(leaves: LeaveRequest[]): void {
  printList(
    'Registre des congés',
    ['Agent', 'Type', 'Début', 'Fin', 'Jours', 'Statut'],
    leaves.map((l) => [l.user ? `${l.user.firstName} ${l.user.lastName}` : '—', l.type, formatDate(l.startDate), formatDate(l.endDate), String(l.days), l.status]),
  );
}

export function printShiftSheet(s: ShiftAssignment): void {
  printDocument({
    kind: 'Fiche de shift',
    date: s.date,
    fields: [
      { label: 'Agent', value: s.user ? `${s.user.firstName} ${s.user.lastName}` : '—' },
      { label: 'Date', value: formatDate(s.date) },
      { label: 'Horaire', value: `${s.startTime} – ${s.endTime}` },
      { label: 'Poste', value: s.postLabel },
      { label: 'Validé', value: s.validated ? 'Oui' : 'Non' },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour l\'agent'],
  });
}

export function printShiftsList(shifts: ShiftAssignment[], date: string): void {
  printList(
    `Planning des shifts — ${date}`,
    ['Agent', 'Horaire', 'Poste', 'Validé'],
    shifts.map((s) => [s.user ? `${s.user.firstName} ${s.user.lastName}` : '—', `${s.startTime} – ${s.endTime}`, s.postLabel, s.validated ? 'Oui' : 'Non']),
  );
}

export function printPayslip(s: Payslip, period?: PayrollPeriod): void {
  const month = period ? `${MONTHS[period.month - 1]} ${period.year}` : '';
  printDocument({
    kind: 'Bulletin de paie',
    reference: `${s.employee?.matricule ?? s.id.slice(0, 8)} ${month}`.trim(),
    subtitle: month || undefined,
    fields: [
      { label: 'Agent', value: s.user ? `${s.user.firstName} ${s.user.lastName}` : '—' },
      { label: 'Matricule', value: s.employee?.matricule ?? '—' },
      { label: 'Poste', value: s.employee?.jobTitle ?? '—' },
      { label: 'Jours travaillés', value: String(s.workedDays) },
      { label: 'Heures supp.', value: String(s.overtimeHours) },
      { label: 'Statut', value: s.status },
    ],
    tables: [{
      title: 'Détail de rémunération',
      headers: ['Rubrique', 'Montant'],
      rows: [
        ['Salaire de base', formatMoney(s.baseSalary)],
        ['Primes', formatMoney(s.bonuses)],
        ['Heures supplémentaires', String(s.overtimeHours)],
        ['Brut', formatMoney(s.grossPay)],
        ['CNSS salarié (5 %)', formatMoney(s.cnssEmployee)],
        ['IPRF', formatMoney(s.iprf)],
        ['Autres retenues', formatMoney(s.deductions)],
        ['Net à payer', formatMoney(s.netPay)],
      ],
    }],
    totals: [{ label: 'Net à payer', value: formatMoney(s.netPay) }],
    notes: 'Bulletin généré par EMMAPP. CNSS salarié 5 %. IPRF selon barème interne. Document confidentiel.',
    signatures: ['Pour EMMANUEL SERVICES SARLU / Paie', 'Pour l\'agent'],
  });
}

export function printPayrollRegister(payslips: Payslip[], period: PayrollPeriod): void {
  const total = payslips.reduce((s, p) => s + Number(p.netPay), 0);
  printDocument({
    kind: 'Registre de paie',
    reference: `${MONTHS[period.month - 1]} ${period.year}`,
    subtitle: `Jours ouvrés : ${period.expectedDays} · Statut : ${period.status}`,
    tables: [{
      headers: ['Agent', 'Matricule', 'Jours', 'Brut', 'CNSS', 'IPRF', 'Net'],
      rows: payslips.map((s) => [
        s.user ? `${s.user.firstName} ${s.user.lastName}` : '—',
        s.employee?.matricule ?? '—',
        String(s.workedDays),
        formatMoney(s.grossPay),
        formatMoney(s.cnssEmployee),
        formatMoney(s.iprf),
        formatMoney(s.netPay),
      ]),
    }],
    totals: [{ label: 'Masse nette', value: formatMoney(total) }],
    signatures: ['Pour EMMANUEL SERVICES SARLU / Direction', 'Pour EMMANUEL SERVICES SARLU / Paie'],
  });
}

export function printUserSheet(u: User): void {
  printDocument({
    kind: 'Fiche utilisateur',
    reference: u.email,
    fields: [
      { label: 'Nom', value: `${u.firstName} ${u.lastName}` },
      { label: 'E-mail', value: u.email },
      { label: 'Rôle', value: u.role },
      { label: 'Actif', value: u.isActive === false ? 'Non' : 'Oui' },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU / Administration'],
  });
}

export function printUsersList(users: User[]): void {
  printList(
    'Registre des utilisateurs',
    ['Nom', 'E-mail', 'Rôle', 'Actif'],
    users.map((u) => [`${u.firstName} ${u.lastName}`, u.email, u.role, u.isActive === false ? 'Non' : 'Oui']),
  );
}

export function printQuote(q: QuoteRequest): void {
  printDocument({
    kind: 'Devis',
    reference: q.reference,
    date: q.createdAt,
    fields: [
      { label: 'Société', value: q.companyName },
      { label: 'Contact', value: q.contactEmail },
      { label: 'Téléphone', value: q.contactPhone ?? '—' },
      { label: 'Segment', value: q.segment },
      { label: 'Zone', value: q.zone ?? '—' },
      { label: 'Statut', value: q.status },
    ],
    tables: [{
      title: 'Lignes',
      headers: ['Produit', 'Quantité'],
      rows: q.lines.map((l) => [l.productName, String(l.quantity)]),
    }],
    totals: q.quotedAmount != null ? [{ label: 'Montant proposé', value: formatMoney(q.quotedAmount) }] : undefined,
    notes: q.message || 'Devis valable 15 jours. Les consignes d\'emballages réutilisables s\'ajoutent selon le contrat client.',
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le prospect'],
  });
}

export function printQuotesList(quotes: QuoteRequest[]): void {
  printList(
    'Registre des devis',
    ['Réf.', 'Société', 'Segment', 'Statut', 'Montant'],
    quotes.map((q) => [q.reference, q.companyName, q.segment, q.status, q.quotedAmount != null ? formatMoney(q.quotedAmount) : '—']),
  );
}

export function printPortalInvoice(inv: PortalInvoice): void {
  printDocument({
    kind: 'Facture',
    reference: inv.orderNumber,
    date: inv.date,
    fields: [
      { label: 'Commande', value: inv.orderNumber },
      { label: 'Statut', value: inv.status },
      { label: 'Date', value: formatDate(inv.date) },
    ],
    totals: [
      { label: 'Total', value: formatMoney(inv.totalAmount) },
      { label: 'Payé', value: formatMoney(inv.paidAmount) },
      { label: 'Solde', value: formatMoney(inv.balance) },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le client'],
  });
}

export function printDashboardReport(d: DashboardOverview): void {
  printDocument({
    kind: 'Synthèse opérationnelle',
    fields: [
      { label: 'Clients', value: String(d.clientsCount) },
      { label: 'Commandes du jour', value: String(d.ordersToday) },
      { label: 'Livraisons du jour', value: String(d.deliveriesToday) },
      { label: 'CA du jour', value: formatMoney(d.revenueToday) },
      { label: 'Tournées actives', value: String(d.activeTours) },
      { label: 'Stock total', value: String(d.totalStock) },
    ],
    tables: [{
      title: 'Stock par produit',
      headers: ['Produit', 'Quantité'],
      rows: Object.entries(d.stockByProduct ?? {}).map(([k, v]) => [k, String(v)]),
    }],
    signatures: ['Pour EMMANUEL SERVICES SARLU / Direction'],
  });
}

export function printForecasts(items: DemandForecast[]): void {
  printList(
    'Rapport de prévisions',
    ['Produit', 'Zone', 'Horizon', 'Qté prévue', 'Confiance'],
    items.map((f) => [f.product?.name ?? f.productId, f.zone, formatDate(f.horizonDate), String(f.forecastQty), `${Math.round(f.confidence * 100)} %`]),
  );
}

export function printAnomalies(items: Anomaly[]): void {
  printList(
    'Rapport d\'alertes',
    ['Type', 'Sévérité', 'Titre', 'Statut', 'Détectée'],
    items.map((a) => [a.kind, a.severity, a.title, a.status, formatDate(a.detectedAt)]),
  );
}

export function printNotifications(items: NotificationItem[]): void {
  printList(
    'Journal des notifications',
    ['Date', 'Type', 'Titre', 'Lu'],
    items.map((n) => [formatDate(n.createdAt), n.type, n.title, n.read ? 'Oui' : 'Non']),
  );
}

export function printGenericReport(kind: string, spec: Partial<DocSpec>): void {
  printDocument({ kind, signatures: ['Pour EMMANUEL SERVICES SARLU'], ...spec });
}

export function printEsgReport(dash: EsgDashboard, rows: EsgIndicator[]): void {
  printDocument({
    kind: 'Rapport de durabilité ESG',
    subtitle: `${formatDate(dash.periodStart)} — ${formatDate(dash.periodEnd)}`,
    fields: [
      { label: 'CO₂ total', value: `${dash.totalCo2Kg.toFixed(1)} kg` },
      { label: 'Distance', value: `${dash.totalDistanceKm.toFixed(1)} km` },
      { label: 'CO₂ / livraison', value: `${dash.co2PerDeliveryKg.toFixed(2)} kg` },
      { label: 'Eau prélevée', value: `${dash.waterM3.toFixed(1)} m³` },
      { label: 'Énergie', value: `${dash.energyKwh.toFixed(0)} kWh` },
      { label: 'Réemploi', value: `${Math.round(dash.reusePct)} %` },
    ],
    tables: [
      {
        title: 'Tournées les plus émettrices',
        headers: ['Tournée', 'Zone', 'CO₂ (kg)', 'Distance (km)'],
        rows: dash.topTours.map((t) => [t.tourNumber, t.zone, t.co2Kg.toFixed(1), t.distanceKm.toFixed(1)]),
      },
      {
        title: 'Indicateurs détaillés',
        headers: ['Périmètre', 'Tournée', 'CO₂', 'Eau', 'Énergie', 'Réemploi'],
        rows: rows.map((r) => [r.scope, r.tour?.tourNumber ?? '—', r.co2Kg.toFixed(1), r.waterM3.toFixed(2), r.energyKwh.toFixed(1), `${Math.round(r.reusePct)} %`]),
      },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU / QHSE'],
  });
}

export function printIotReport(sensors: IotSensor[]): void {
  printList(
    'Rapport capteurs IoT',
    ['Code', 'Libellé', 'Famille', 'Dernière valeur', 'Statut'],
    sensors.map((s) => [s.code, s.label, s.kind, s.lastValue != null ? `${s.lastValue} ${s.unit}` : '—', s.status]),
  );
}

export function printIotSensorSheet(s: IotSensor): void {
  printDocument({
    kind: 'Fiche capteur',
    reference: s.code,
    fields: [
      { label: 'Libellé', value: s.label },
      { label: 'Famille', value: s.kind },
      { label: 'Métrique', value: s.metric },
      { label: 'Unité', value: s.unit },
      { label: 'Dernière valeur', value: s.lastValue != null ? `${s.lastValue} ${s.unit}` : '—' },
      { label: 'Statut', value: s.status },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printRouteSheet(route: OptimizedRoute): void {
  printDocument({
    kind: 'Itinéraire de tournée',
    reference: route.tour?.tourNumber ?? route.tourId,
    fields: [
      { label: 'Zone', value: route.tour?.zone ?? '—' },
      { label: 'Algorithme', value: route.algorithm },
      { label: 'Distance', value: `${route.totalDistanceKm.toFixed(1)} km` },
      { label: 'Durée estimée', value: `${route.estimatedDurationMin} min` },
      { label: 'Ajusté', value: route.manuallyAdjusted ? 'Oui' : 'Non' },
    ],
    tables: [{
      title: 'Arrêts',
      headers: ['#', 'Client', 'Priorité', 'Latitude', 'Longitude'],
      rows: route.stops.map((s) => [String(s.order), s.clientName, String(s.priority), s.latitude.toFixed(4), s.longitude.toFixed(4)]),
    }],
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le chauffeur'],
  });
}

export function printSecurityReport(summary: SecuritySummary | null, alerts: SecurityAlert[], audit: AuditEntry[]): void {
  printDocument({
    kind: 'Rapport de sécurité',
    fields: summary ? [
      { label: 'Alertes ouvertes', value: String(summary.openAlerts) },
      { label: 'Alertes critiques', value: String(summary.criticalAlerts) },
      { label: 'Échecs login 24h', value: String(summary.failedLoginsLast24h) },
      { label: 'Couverture MFA', value: `${summary.mfaCoveragePct} %` },
      { label: 'Événements audit 24h', value: String(summary.auditEventsLast24h) },
    ] : undefined,
    tables: [
      {
        title: 'Alertes',
        headers: ['Type', 'Sévérité', 'Statut', 'Message', 'Date'],
        rows: alerts.map((a) => [a.kind, a.severity, a.status, a.message, formatDate(a.createdAt)]),
      },
      {
        title: 'Journal d\'audit',
        headers: ['Action', 'Entité', 'Utilisateur', 'IP', 'Date'],
        rows: audit.slice(0, 40).map((e) => [e.action, e.entityType, e.user ? `${e.user.firstName} ${e.user.lastName}` : '—', e.ipAddress ?? '—', formatDate(e.createdAt)]),
      },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU / Sécurité'],
  });
}

export function printPortalAccountsList(accounts: PortalAccount[]): void {
  printList(
    'Registre des comptes portail',
    ['Nom', 'Email', 'Client', 'Actif', 'Dernière connexion'],
    accounts.map((a) => [a.fullName, a.email, a.client?.name ?? a.clientId, a.isActive ? 'Oui' : 'Non', a.lastLoginAt ? formatDate(a.lastLoginAt) : '—']),
  );
}

export function printPortalAccountSheet(a: PortalAccount): void {
  printDocument({
    kind: 'Fiche compte portail',
    reference: a.email,
    fields: [
      { label: 'Nom', value: a.fullName },
      { label: 'Email', value: a.email },
      { label: 'Client', value: a.client?.name ?? a.clientId },
      { label: 'Statut', value: a.isActive ? 'Actif' : 'Inactif' },
      { label: 'Dernière connexion', value: a.lastLoginAt ? formatDate(a.lastLoginAt) : '—' },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printObservabilityReport(data: ObservabilityStatus): void {
  printDocument({
    kind: 'Synthèse d\'observabilité',
    fields: [
      { label: 'Sync en attente', value: String(data.pendingSync) },
      { label: 'Lots bloqués', value: String(data.blockedLots) },
      { label: 'Contrôles qualité ouverts', value: String(data.openQualityChecks) },
      { label: 'Shifts à valider', value: String(data.pendingShiftValidations) },
    ],
    tables: [{
      title: 'Services',
      headers: ['Service', 'Statut'],
      rows: data.services.map((s) => [s.name, s.status]),
    }],
    signatures: ['Pour EMMANUEL SERVICES SARLU / Exploitation'],
  });
}

export function printPackagingList(units: PackagingUnit[]): void {
  printList(
    'Registre des emballages consignés',
    ['Code-barres', 'Format', 'Rotations', 'Max', 'Statut'],
    units.map((p) => [p.barcode, p.productFormat, String(p.rotationCount), String(p.maxRotations), p.status]),
  );
}

export function printFountainsList(fountains: FountainAsset[]): void {
  printList(
    'Registre des fontaines',
    ['N° série', 'Modèle', 'Contrat', 'Prochain service'],
    fountains.map((f) => [f.serialNumber, f.model ?? '—', f.contractType ?? '—', f.nextService ? formatDate(f.nextService) : '—']),
  );
}

export function printPortalLoyalty(loyalty: PortalLoyalty): void {
  printDocument({
    kind: 'Relevé de fidélité',
    fields: [
      { label: 'Niveau', value: loyalty.tier },
      { label: 'Points', value: String(loyalty.points) },
      { label: 'Portefeuille', value: formatMoney(loyalty.walletBalance) },
    ],
    tables: [{
      title: 'Historique',
      headers: ['Libellé', 'Points', 'Date'],
      rows: loyalty.history.map((h) => [h.label, String(h.points), formatDate(h.at)]),
    }],
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le client'],
  });
}

export function printPortalConsignes(rows: PortalConsigne[]): void {
  printList(
    'Solde de consignes',
    ['Type', 'Quantité', 'Produit', 'Date'],
    rows.map((r) => [r.type, String(r.quantity), r.productName ?? '—', formatDate(r.createdAt)]),
  );
}

export function printDeliveryTracking(t: DeliveryTracking): void {
  printDocument({
    kind: 'Suivi de livraison',
    reference: t.deliveryNumber,
    fields: [
      { label: 'Statut', value: t.status },
      { label: 'Livreur', value: t.driverName ?? '—' },
      { label: 'Véhicule', value: t.vehiclePlate ?? '—' },
      { label: 'ETA', value: t.etaMinutes != null ? `${t.etaMinutes} min` : '—' },
      { label: 'Arrêts restants', value: t.stopsRemaining != null ? String(t.stopsRemaining) : '—' },
    ],
    tables: [{
      title: 'Chronologie',
      headers: ['Étape', 'Statut', 'Heure'],
      rows: t.timeline.map((x) => [x.label, x.done ? 'Fait' : 'En attente', x.at ? formatDate(x.at) : '—']),
    }],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printActivitySheet(d: ActivityReportDetail): void {
  const name = `${d.user.firstName} ${d.user.lastName}`;
  printDocument({
    kind: 'Rapport d’activité',
    reference: `${d.user.lastName}-${d.date}`,
    subtitle: name,
    fields: [
      { label: 'Agent', value: name },
      { label: 'Profil', value: d.user.role },
      { label: 'Date', value: d.date },
      { label: 'Livraisons', value: `${d.metrics.deliveries} (${d.metrics.delivered} livrées, ${d.metrics.refused} refusées)` },
      { label: 'Quantité livrée', value: String(d.metrics.qtyDelivered) },
      { label: 'Tournées', value: String(d.metrics.tours) },
      { label: 'Shifts', value: String(d.metrics.shifts) },
      { label: 'Encaissements', value: formatMoney(d.metrics.paymentsAmount) },
      { label: 'Statut', value: d.report?.validated ? 'Validé' : d.report ? 'Soumis' : 'Non soumis' },
    ],
    tables: [
      {
        title: 'Livraisons',
        headers: ['N°', 'Client', 'Statut', 'Qté'],
        rows: d.deliveries.map((x) => [x.deliveryNumber, x.clientName ?? '—', x.status, String(x.qtyDelivered)]),
      },
      {
        title: 'Tournées',
        headers: ['N°', 'Zone', 'Statut'],
        rows: d.tours.map((x) => [x.tourNumber, x.zone, x.status]),
      },
    ],
    notes: `Résumé : ${d.summary || '—'}\nIncidents : ${d.incidents || 'Aucun'}`,
    signatures: ['Agent', 'Manager'],
  });
}

export function printActivityOverview(o: ActivityOverview): void {
  printList(
    'Synthèse d’activité',
    ['Agent', 'Profil', 'Livraisons', 'Tournées', 'Shifts', 'Encaissements', 'Rapport'],
    o.rows.map((r) => [
      `${r.user.firstName} ${r.user.lastName}`,
      r.user.role,
      String(r.deliveries),
      String(r.tours),
      String(r.shifts),
      formatMoney(r.paymentsAmount),
      r.validated ? 'Validé' : r.submitted ? 'Soumis' : 'Absent',
    ]),
    {
      reference: `ACTIVITE-${o.date}`,
      subtitle: o.date,
      fields: [
        { label: 'Agents', value: String(o.totals.agents) },
        { label: 'Rapports soumis', value: String(o.totals.submitted) },
        { label: 'Validés', value: String(o.totals.validated) },
        { label: 'Livraisons', value: String(o.totals.deliveries) },
        { label: 'Encaissements', value: formatMoney(o.totals.paymentsAmount) },
      ],
    },
  );
}

function contractPartyName(c: BusinessContract): string {
  if (c.partyKind === 'AGENT') {
    const u = c.employee?.user;
    return u ? `${u.firstName} ${u.lastName}` : c.employee?.matricule ?? 'Agent';
  }
  if (c.partyKind === 'SUPPLIER') return c.supplier?.name ?? 'Fournisseur';
  return c.client?.name ?? 'Grand client';
}

const PARTY_KIND_LABEL: Record<BusinessContract['partyKind'], string> = {
  AGENT: 'Agent',
  SUPPLIER: 'Fournisseur',
  KEY_CLIENT: 'Grand client',
};

export function printContractSheet(c: BusinessContract): void {
  printDocument({
    kind: 'Contrat',
    reference: c.reference,
    subtitle: c.title,
    fields: [
      { label: 'Référence', value: c.reference },
      { label: 'Partie', value: `${PARTY_KIND_LABEL[c.partyKind]} — ${contractPartyName(c)}` },
      { label: 'Type', value: c.kind },
      { label: 'Statut', value: c.status },
      { label: 'Début', value: formatDate(c.startDate) },
      { label: 'Fin', value: c.endDate ? formatDate(c.endDate) : 'Durée indéterminée' },
      { label: 'Préavis', value: `${c.noticeDays} jours` },
      { label: 'Reconduction', value: c.autoRenew ? 'Tacite' : 'Non' },
      { label: 'Montant', value: c.amount != null ? `${formatMoney(c.amount)} (${c.currency})` : '—' },
      { label: 'Paiement', value: c.paymentTerms ?? '—' },
      { label: 'Facturation', value: c.billingCycle ?? '—' },
      { label: 'Volume', value: c.volumeCommitment ?? '—' },
      { label: 'Territoire', value: c.territory ?? '—' },
      { label: 'Exclusivité', value: c.exclusivity ? 'Oui' : 'Non' },
      { label: 'Signataire partie', value: c.signedByParty ?? '—' },
      { label: 'Signataire société', value: c.signedByCompany ?? 'EMMANUEL SERVICES SARLU' },
    ],
    tables: c.amendments?.length
      ? [{
          title: 'Avenants',
          headers: ['Référence', 'Motif', 'Montant', 'Date'],
          rows: c.amendments.map((a) => [a.reference, a.reason, a.amount != null ? formatMoney(a.amount) : '—', formatDate(a.startDate)]),
        }]
      : undefined,
    notes: [c.clauses, c.notes, c.terminateReason ? `Résiliation : ${c.terminateReason}` : '']
      .filter(Boolean)
      .join('\n\n') || undefined,
    signatures: ['Pour EMMANUEL SERVICES SARLU', `Pour ${contractPartyName(c)}`],
  });
}

export function printContractsList(rows: BusinessContract[]): void {
  printList('Registre des contrats', ['Référence', 'Partie', 'Intitulé', 'Type', 'Fin', 'Statut', 'Montant'], rows.map((c) => [
    c.reference,
    `${PARTY_KIND_LABEL[c.partyKind]} · ${contractPartyName(c)}`,
    c.title,
    c.kind,
    c.endDate ? formatDate(c.endDate) : 'Indéterminée',
    c.status,
    c.amount != null ? formatMoney(c.amount) : '—',
  ]));
}

export function printVehicleSheet(v: Vehicle): void {
  printDocument({
    kind: 'Fiche véhicule',
    reference: v.plate,
    fields: [
      { label: 'Plaque', value: v.plate },
      { label: 'Nom', value: v.name },
      { label: 'Capacité', value: String(v.capacity) },
      { label: 'Carburant', value: v.fuelType ?? '—' },
      { label: 'Facteur CO2 (kg/km)', value: String(v.co2FactorKgPerKm ?? '—') },
      { label: 'Statut', value: v.isActive === false ? 'Inactif' : 'Actif' },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printVehiclesList(vehicles: Vehicle[]): void {
  printList(
    'Parc véhicules',
    ['Plaque', 'Nom', 'Capacité', 'Carburant', 'CO2 kg/km', 'Statut'],
    vehicles.map((v) => [
      v.plate,
      v.name,
      String(v.capacity),
      v.fuelType ?? '—',
      String(v.co2FactorKgPerKm ?? '—'),
      v.isActive === false ? 'Inactif' : 'Actif',
    ]),
  );
}

export function printPackagingSkuSheet(s: PackagingSku): void {
  printDocument({
    kind: 'Fiche article emballage',
    reference: s.code,
    fields: [
      { label: 'Nom', value: s.name },
      { label: 'Type', value: s.kind },
      { label: 'Format', value: s.format },
      { label: 'Stock', value: String(s.stock?.quantity ?? 0) },
      { label: 'Seuil', value: String(s.minStock) },
      { label: 'Statut', value: s.isActive ? 'Actif' : 'Inactif' },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printPackagingSkus(skus: PackagingSku[]): void {
  printList(
    'Stockage primaire - articles',
    ['Code', 'Nom', 'Type', 'Format', 'Stock', 'Seuil', 'Statut'],
    skus.map((s) => [
      s.code,
      s.name,
      s.kind,
      s.format,
      String(s.stock?.quantity ?? 0),
      String(s.minStock),
      s.isActive ? 'Actif' : 'Inactif',
    ]),
  );
}

export function printPackagingMovementSheet(m: PackagingMovement): void {
  printDocument({
    kind: 'Mouvement emballage',
    reference: m.reference ?? m.id.slice(0, 8),
    fields: [
      { label: 'Date', value: formatDate(m.createdAt) },
      { label: 'Type', value: m.type },
      { label: 'Article', value: m.sku?.name ?? m.skuId },
      { label: 'Quantité', value: String(m.quantity) },
      { label: 'Fournisseur', value: m.supplier ?? '—' },
      { label: 'Notes', value: m.notes ?? '—' },
    ],
    signatures: ['Pour EMMANUEL SERVICES SARLU'],
  });
}

export function printPackagingMovements(rows: PackagingMovement[]): void {
  printList(
    'Mouvements stockage primaire',
    ['Date', 'Type', 'Article', 'Quantité', 'Fournisseur', 'Référence'],
    rows.map((m) => [
      formatDate(m.createdAt),
      m.type,
      m.sku?.name ?? m.skuId,
      String(m.quantity),
      m.supplier ?? '—',
      m.reference ?? m.notes ?? '—',
    ]),
  );
}

export function printAuthorizationMatrix(
  catalog: AuthorizationCatalog,
  roleLabel: string,
  grants: Record<string, string[]>,
): void {
  printList(
    `Matrice habilitations ${roleLabel}`,
    ['Module', ...catalog.actions.map((a) => a.short || a.label)],
    catalog.resources.map((r) => [
      `${r.section} / ${r.label}`,
      ...catalog.actions.map((a) => ((grants[r.id] ?? []).includes(a.id) ? 'Oui' : 'Non')),
    ]),
  );
}

export function printUserAuthorizationSheet(
  catalog: AuthorizationCatalog,
  userLabel: string,
  effective: Record<string, string[]>,
): void {
  printList(
    `Habilitations ${userLabel}`,
    ['Module', ...catalog.actions.map((a) => a.short || a.label)],
    catalog.resources.map((r) => [
      `${r.section} / ${r.label}`,
      ...catalog.actions.map((a) => ((effective[r.id] ?? []).includes(a.id) ? 'Oui' : 'Non')),
    ]),
  );
}

export function printOptimizedRoutesList(routes: OptimizedRoute[]): void {
  printList(
    'Itinéraires optimisés',
    ['Tournée', 'Zone', 'Distance km', 'Durée min', 'Arrêts', 'Ajusté'],
    routes.map((r) => [
      r.tour?.tourNumber ?? r.tourId,
      r.tour?.zone ?? '—',
      r.totalDistanceKm.toFixed(1),
      String(r.estimatedDurationMin),
      String(r.stops?.length ?? 0),
      r.manuallyAdjusted ? 'Oui' : 'Non',
    ]),
  );
}

export function printPayrollPeriodsList(periods: PayrollPeriod[]): void {
  printList(
    'Périodes de paie',
    ['Année', 'Mois', 'Jours ouvrés', 'Bulletins', 'Statut'],
    periods.map((p) => [
      String(p.year),
      MONTHS[p.month - 1] ?? String(p.month),
      String(p.expectedDays),
      String(p._count?.payslips ?? 0),
      p.status,
    ]),
  );
}

export function printHrFunctionsList(rows: JobFunction[]): void {
  printList(
    'Référentiel des fonctions',
    ['Fonction', 'Service', 'Activités'],
    rows.map((f) => [f.name, f.department ?? '—', (f.activities ?? []).map((a) => a.name).join(', ') || '—']),
  );
}

export function printHrDeclarationsList(rows: ActivityDeclaration[]): void {
  printList(
    'Déclarations d’activité',
    ['Agent', 'Activité', 'Date', 'Statut'],
    rows.map((d) => [
      d.user ? `${d.user.firstName} ${d.user.lastName}` : '—',
      d.activity?.name ?? '—',
      formatDate(d.date),
      d.status,
    ]),
  );
}

export function printHrObjectivesList(rows: PerformanceObjective[]): void {
  printList(
    'Objectifs de performance',
    ['Agent', 'Objectif', 'Poids %', 'Année'],
    rows.map((o) => [
      o.user ? `${o.user.firstName} ${o.user.lastName}` : '—',
      o.title,
      String(o.weight),
      String(o.year),
    ]),
  );
}

export function printHrCoursesList(rows: TrainingCourse[]): void {
  printList(
    'Catalogue de formations',
    ['Intitulé', 'Type', 'Organisme', 'Lieu'],
    rows.map((c) => [c.title, c.kind, c.provider ?? '—', c.location ?? '—']),
  );
}

export function printHrEnrollmentsList(rows: TrainingEnrollment[]): void {
  printList(
    'Inscriptions formations',
    ['Agent', 'Formation', 'Statut'],
    rows.map((e) => [
      e.user ? `${e.user.firstName} ${e.user.lastName}` : '—',
      e.course?.title ?? '—',
      e.status,
    ]),
  );
}

export function printHrDocumentsList(rows: HrDocument[]): void {
  printList(
    'Archives RH',
    ['Date', 'Agent', 'Type', 'Titre'],
    rows.map((d) => [
      formatDate(d.createdAt),
      d.employee?.user ? `${d.employee.user.firstName} ${d.employee.user.lastName}` : d.employee?.matricule ?? '—',
      d.type,
      d.title,
    ]),
  );
}

export function printAssistantSessionsList(rows: AssistantSession[]): void {
  printList(
    'Sessions assistant',
    ['Canal', 'Début', 'Escaladée'],
    rows.map((s) => [s.channel, formatDate(s.startedAt), s.escalated ? 'Oui' : 'Non']),
  );
}
