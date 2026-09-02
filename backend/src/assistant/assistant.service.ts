import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssistantAuthor,
  AssistantChannel,
  DeliveryStatus,
  NotificationCategory,
  NotificationType,
  OrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';
import {
  ESCALATION_THRESHOLD,
  INTENT_HELP,
  IntentEntities,
  IntentName,
  detectIntent,
} from './intents';

/** Réponse renvoyée à l'appelant, conforme au contrat d'API du back-office. */
export interface AssistantAnswer {
  sessionId: string;
  answer: string;
  intent: string;
  confidence: number;
  escalated: boolean;
  suggestions?: string[];
}

/**
 * Interlocuteur résolu de la conversation. `clientId` n'est renseigné que pour
 * un client (portail ou WhatsApp) et sert de clé unique de cloisonnement.
 */
interface Interlocutor {
  kind: 'INTERNE' | 'CLIENT';
  userId?: string;
  portalAccountId?: string;
  role?: UserRole;
  clientId?: string;
  displayName: string;
}

interface IntentReply {
  text: string;
  suggestions: string[];
}

/** Profils autorisés à consulter les sessions des autres interlocuteurs. */
const ROLES_SUPERVISION: UserRole[] = [UserRole.ADMIN, UserRole.SUPERVISEUR];

/** Profils terrain : ne voient que leurs propres tournées et livraisons. */
const ROLES_TERRAIN: UserRole[] = [UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON];

/** Profils ayant accès aux encaissements dans la matrice d'habilitation. */
const ROLES_ENCAISSEMENT: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.CAISSIER,
  UserRole.COMPTABLE,
  UserRole.COMMERCIAL,
  UserRole.SUPERVISEUR,
];

/** Profils ayant accès aux stocks dans la matrice d'habilitation. */
const ROLES_STOCK: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.CHEF_PRODUCTION,
  UserRole.CHEF_EXPLOITATION,
  UserRole.CHARGE_EXPLOITATION,
  UserRole.MAGASINIER,
  UserRole.AGENT_CHARGEUR,
  UserRole.DATA_ANALYST,
];

/** Profils ayant accès au programme de fidélité. */
const ROLES_FIDELITE: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.COMMERCIAL,
  UserRole.DELEGUE_COMMERCIAL,
  UserRole.DATA_ANALYST,
];

/** Paliers du programme de fidélité, alignés sur le module EMMANUEL SERVICES SARLU. */
const LOYALTY_TIERS: Array<{ tier: string; threshold: number }> = [
  { tier: 'ARGENT', threshold: 100 },
  { tier: 'OR', threshold: 300 },
  { tier: 'PLATINE', threshold: 500 },
];

/** Champs exposables d'un utilisateur interne : jamais l'empreinte du mot de passe. */
const SESSION_USER_SELECT = { firstName: true, lastName: true, role: true } as const;

/** Champs exposables d'un compte portail : jamais l'empreinte du mot de passe. */
const SESSION_PORTAL_SELECT = { fullName: true, email: true } as const;

/** Fenêtre de reprise d'une conversation WhatsApp entamée, en heures. */
const WHATSAPP_SESSION_WINDOW_HOURS = 12;

@Injectable()
export class AssistantService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ==========================================================================
  // Points d'entrée publics
  // ==========================================================================

  /**
   * Traite une question et journalise l'échange (EF-BOT-01, EF-BOT-04).
   * Méthode réutilisable par le module portail client, qui fournit
   * `portalAccountId` au lieu de `userId`.
   */
  async answer(params: {
    question: string;
    sessionId?: string;
    channel: AssistantChannel;
    userId?: string;
    portalAccountId?: string;
    role?: string;
  }): Promise<AssistantAnswer> {
    const who = await this.resolveInterlocutor(params);
    return this.run({
      question: params.question,
      sessionId: params.sessionId,
      channel: params.channel,
      who,
    });
  }

  /** Contrat d'appel du module portail (signature stable). */
  ask(params: {
    question: string;
    sessionId?: string;
    channel: AssistantChannel;
    userId?: string;
    portalAccountId?: string;
    clientId?: string;
    userRole?: UserRole;
  }): Promise<AssistantAnswer> {
    return this.answer({
      question: params.question,
      sessionId: params.sessionId,
      channel: params.channel,
      userId: params.userId,
      portalAccountId: params.portalAccountId,
      role: params.userRole,
    });
  }

  /**
   * Message entrant du canal WhatsApp (EF-BOT-02) : le contact est identifié
   * par son numéro de téléphone, puis traité comme un client.
   */
  async answerWhatsapp(params: {
    from: string;
    message: string;
  }): Promise<{ reply: string; escalated: boolean }> {
    const who = await this.resolveWhatsappContact(params.from);
    const openSession = who.portalAccountId
      ? await this.findOpenWhatsappSession(who.portalAccountId)
      : null;

    const result = await this.run({
      question: params.message,
      sessionId: openSession?.id,
      channel: AssistantChannel.WHATSAPP,
      who,
    });
    return { reply: result.answer, escalated: result.escalated };
  }

  /**
   * Sessions visibles par l'appelant : les siennes, ou toutes pour les profils
   * de supervision (habilitation « assistant » en modification).
   */
  listSessions(user: { id: string; role: string }) {
    const seesAll = this.hasSupervision(user.role);
    return this.prisma.assistantSession.findMany({
      where: seesAll ? {} : { userId: user.id },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        user: { select: SESSION_USER_SELECT },
        portalAccount: { select: SESSION_PORTAL_SELECT },
      },
    });
  }

  /** Transcription complète d'une session, dans l'ordre chronologique. */
  async getSession(id: string, user: { id: string; role: string }) {
    const session = await this.prisma.assistantSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: SESSION_USER_SELECT },
        portalAccount: { select: SESSION_PORTAL_SELECT },
      },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (!this.hasSupervision(user.role) && session.userId !== user.id) {
      throw new ForbiddenException("Cette conversation appartient à un autre interlocuteur.");
    }
    return session;
  }

  /** Escalade manuelle vers un conseiller humain (EF-BOT-03). */
  async escalateSession(id: string, user: { id: string; role: string }) {
    const session = await this.prisma.assistantSession.findUnique({
      where: { id },
      include: { portalAccount: { select: { fullName: true } } },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (!this.hasSupervision(user.role) && session.userId !== user.id) {
      throw new ForbiddenException("Cette conversation appartient à un autre interlocuteur.");
    }

    const lastQuestion = await this.prisma.assistantMessage.findFirst({
      where: { sessionId: id, author: AssistantAuthor.UTILISATEUR },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    });

    if (!session.escalated) {
      await this.prisma.assistantSession.update({
        where: { id },
        data: { escalated: true, escalatedAt: new Date() },
      });
      await this.notifyEscalation({
        channel: session.channel,
        isClient: session.portalAccountId !== null,
        who: session.portalAccount?.fullName ?? 'un utilisateur interne',
        question: lastQuestion?.content ?? 'Demande transférée sans question associée.',
      });
    }

    await this.logMessage({
      sessionId: id,
      author: AssistantAuthor.ASSISTANT,
      content:
        'Votre demande a été transférée à un conseiller EMMANUEL SERVICES SARLU, qui reprend la conversation avec son historique complet.',
      intent: 'escalade_manuelle',
      confidence: 1,
    });

    return this.prisma.assistantSession.findUniqueOrThrow({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: SESSION_USER_SELECT },
        portalAccount: { select: SESSION_PORTAL_SELECT },
      },
    });
  }

  // ==========================================================================
  // Orchestration d'un échange
  // ==========================================================================

  private async run(params: {
    question: string;
    sessionId?: string;
    channel: AssistantChannel;
    who: Interlocutor;
  }): Promise<AssistantAnswer> {
    const question = params.question?.trim();
    if (!question) {
      throw new BadRequestException('La question est vide.');
    }

    const match = detectIntent(question);
    const session = await this.resolveSession(params.sessionId, params.channel, params.who);

    await this.logMessage({
      sessionId: session.id,
      author: AssistantAuthor.UTILISATEUR,
      content: question,
    });

    // EF-BOT-03 : sous le seuil de confiance, la demande sort du périmètre de
    // connaissance et part vers un conseiller humain avec son contexte.
    const outOfScope =
      match.intent === 'inconnu' || match.confidence < ESCALATION_THRESHOLD;

    let reply: IntentReply;
    if (outOfScope) {
      reply = {
        text: `Je ne suis pas certain de comprendre votre demande (confiance ${Math.round(
          match.confidence * 100,
        )} %). Je la transmets à un conseiller EMMANUEL SERVICES SARLU avec l'historique de notre échange ; il vous répondra dans les meilleurs délais.`,
        suggestions: this.suggestionsFor('aide', params.who),
      };
      await this.markEscalated(session.id, session.escalated);
      await this.notifyEscalation({
        channel: params.channel,
        isClient: params.who.kind === 'CLIENT',
        who: params.who.displayName,
        question,
      });
    } else {
      reply = await this.resolveIntent(match.intent, match.entities, params.who);
    }

    await this.logMessage({
      sessionId: session.id,
      author: AssistantAuthor.ASSISTANT,
      content: reply.text,
      intent: match.intent,
      confidence: match.confidence,
    });
    await this.prisma.assistantSession.update({
      where: { id: session.id },
      data: { lastMessageAt: new Date() },
    });

    return {
      sessionId: session.id,
      answer: reply.text,
      intent: match.intent,
      confidence: match.confidence,
      escalated: outOfScope,
      suggestions: reply.suggestions,
    };
  }

  private async resolveIntent(
    intent: IntentName,
    entities: IntentEntities,
    who: Interlocutor,
  ): Promise<IntentReply> {
    switch (intent) {
      case 'salutation':
        return this.replySalutation(who);
      case 'statut_commande':
        return this.replyStatutCommande(who, entities);
      case 'suivi_livraison':
        return this.replySuiviLivraison(who, entities);
      case 'solde_consigne':
        return this.replySoldeConsigne(who);
      case 'stock_produit':
        return this.replyStockProduit(who, entities);
      case 'tournee_du_jour':
        return this.replyTourneeDuJour(who);
      case 'encaissement_jour':
        return this.replyEncaissementJour(who);
      case 'prix_produit':
        return this.replyPrixProduit(who, entities);
      case 'fidelite':
        return this.replyFidelite(who);
      default:
        return this.replyAide(who);
    }
  }

  // ==========================================================================
  // Réponses par intention — chaque chiffre provient de la base
  // ==========================================================================

  private async replySalutation(who: Interlocutor): Promise<IntentReply> {
    if (who.kind === 'CLIENT') {
      if (!who.clientId) {
        return {
          text: `Mbote ! Je suis l'assistant EMMANUEL SERVICES SARLU. Je ne reconnais pas encore ce numéro : contactez votre commercial pour le rattacher à votre compte, puis je pourrai consulter vos commandes et vos consignes. En attendant, je peux vous communiquer nos tarifs.`,
          suggestions: this.suggestionsFor('salutation', who),
        };
      }
      const openOrders = await this.prisma.order.count({
        where: {
          clientId: who.clientId,
          status: { notIn: [OrderStatus.LIVREE, OrderStatus.ANNULEE] },
        },
      });
      return {
        text: `Mbote ${who.displayName} ! Je suis l'assistant EMMANUEL SERVICES SARLU. Vous avez actuellement ${openOrders} commande(s) en cours. Que puis-je vérifier pour vous ?`,
        suggestions: this.suggestionsFor('salutation', who),
      };
    }

    const utcToday = this.utcToday();
    const [tours, pendingDeliveries] = await Promise.all([
      this.prisma.tour.count({
        where: {
          date: utcToday,
          ...(this.isTerrain(who) ? { driverId: who.userId } : {}),
        },
      }),
      this.prisma.delivery.count({
        where: {
          status: DeliveryStatus.EN_ATTENTE,
          ...(this.isTerrain(who) ? { driverId: who.userId } : {}),
        },
      }),
    ]);
    const perimeter = this.isTerrain(who) ? 'Sur votre périmètre' : "Sur l'ensemble de l'activité";
    return {
      text: `Mbote ${who.displayName} ! Assistant EMMANUEL SERVICES SARLU, profil ${who.role ?? 'interne'}. ${perimeter} : ${tours} tournée(s) datée(s) du jour et ${pendingDeliveries} livraison(s) en attente. Que souhaitez-vous consulter ?`,
      suggestions: this.suggestionsFor('salutation', who),
    };
  }

  private async replyStatutCommande(
    who: Interlocutor,
    entities: IntentEntities,
  ): Promise<IntentReply> {
    if (who.kind === 'CLIENT' && !who.clientId) {
      return this.unknownContact(who, 'vos commandes');
    }

    const where: Prisma.OrderWhereInput = {};
    if (who.kind === 'CLIENT') {
      where.clientId = who.clientId;
    } else if (this.isTerrain(who)) {
      // Cloisonnement terrain : uniquement les commandes de ses tournées.
      where.tour = { driverId: who.userId };
    }
    if (entities.orderNumber) {
      where.orderNumber = { contains: entities.orderNumber, mode: 'insensitive' };
    }

    const order = await this.prisma.order.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { name: true } },
        tour: { select: { tourNumber: true, zone: true, status: true, date: true } },
        deliveries: {
          select: { deliveryNumber: true, status: true, deliveredAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      const reference = entities.orderNumber ? ` ${entities.orderNumber}` : '';
      return {
        text: `Je ne trouve aucune commande${reference} sur votre périmètre. Vérifiez la référence (format CMD-AAAAMMJJ-0000) ou indiquez-moi le nom du client.`,
        suggestions: this.suggestionsFor('statut_commande', who),
      };
    }

    const owner = who.kind === 'CLIENT' ? 'Votre commande' : `La commande du client ${order.client.name},`;
    const parts = [
      `${owner} ${order.orderNumber} du ${this.day(order.createdAt)} est au statut ${order.status}, pour un montant de ${this.money(order.totalAmount)}.`,
    ];
    parts.push(
      order.tour
        ? `Livraison prévue sur la tournée ${order.tour.tourNumber} (zone ${order.tour.zone}, statut ${order.tour.status}, date ${this.day(order.tour.date)}).`
        : `Aucune tournée ne lui est encore affectée.`,
    );
    const delivery = order.deliveries[0];
    if (delivery) {
      parts.push(
        `Bon de livraison ${delivery.deliveryNumber} : ${delivery.status}${
          delivery.deliveredAt ? ` le ${this.day(delivery.deliveredAt)}` : ''
        }.`,
      );
    }
    return { text: parts.join(' '), suggestions: this.suggestionsFor('statut_commande', who) };
  }

  private async replySuiviLivraison(
    who: Interlocutor,
    entities: IntentEntities,
  ): Promise<IntentReply> {
    const scope = this.clientScopeGuard(who, 'vos livraisons');
    if (scope) return scope;

    const where: Prisma.DeliveryWhereInput = {};
    if (who.kind === 'CLIENT') {
      where.clientId = who.clientId;
    } else if (this.isTerrain(who)) {
      where.driverId = who.userId;
    }
    if (entities.deliveryNumber) {
      where.deliveryNumber = { contains: entities.deliveryNumber, mode: 'insensitive' };
    }
    if (entities.orderNumber) {
      where.order = { orderNumber: { contains: entities.orderNumber, mode: 'insensitive' } };
    }

    const [delivery, pending] = await Promise.all([
      this.prisma.delivery.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { name: true } },
          order: { select: { orderNumber: true } },
          tour: { select: { tourNumber: true, zone: true, status: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.delivery.count({ where: { ...where, status: DeliveryStatus.EN_ATTENTE } }),
    ]);

    if (!delivery) {
      return {
        text: `Aucune livraison n'est enregistrée sur votre périmètre pour le moment. Dès qu'une commande est chargée, je pourrai vous en donner le suivi.`,
        suggestions: this.suggestionsFor('suivi_livraison', who),
      };
    }

    const owner = who.kind === 'CLIENT' ? 'Votre dernière livraison' : 'La dernière livraison';
    const target = who.kind === 'CLIENT' ? '' : ` du client ${delivery.client.name}`;
    const parts = [
      `${owner}${target} est le bon ${delivery.deliveryNumber} (commande ${delivery.order.orderNumber}), statut ${delivery.status}${
        delivery.deliveredAt ? `, livrée le ${this.day(delivery.deliveredAt)}` : ''
      }.`,
      `Tournée ${delivery.tour.tourNumber} — zone ${delivery.tour.zone}, statut ${delivery.tour.status}, livreur ${delivery.driver.firstName} ${delivery.driver.lastName}.`,
    ];
    if (pending > 0) {
      parts.push(`${pending} livraison(s) restent en attente sur ce périmètre.`);
    }
    return { text: parts.join(' '), suggestions: this.suggestionsFor('suivi_livraison', who) };
  }

  private async replySoldeConsigne(who: Interlocutor): Promise<IntentReply> {
    if (who.kind === 'CLIENT') {
      const scope = this.clientScopeGuard(who, 'votre solde de consigne');
      if (scope) return scope;

      const [client, movement] = await Promise.all([
        this.prisma.client.findUnique({
          where: { id: who.clientId },
          select: { name: true, consigneBalance: true, consigneLimit: true },
        }),
        this.prisma.consigneMovement.findFirst({
          where: { clientId: who.clientId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, qtyIn: true, qtyOut: true, productFormat: true },
        }),
      ]);
      if (!client) {
        return {
          text: `Je ne retrouve pas votre fiche client. Un conseiller peut vérifier votre dossier depuis le back-office.`,
          suggestions: this.suggestionsFor('solde_consigne', who),
        };
      }
      const parts = [
        `Votre solde de consigne est de ${client.consigneBalance} emballage(s) pour une limite autorisée de ${client.consigneLimit}.`,
      ];
      if (movement) {
        parts.push(
          `Dernier mouvement le ${this.day(movement.createdAt)} : ${movement.qtyOut} sortie(s) et ${movement.qtyIn} retour(s) au format ${movement.productFormat}.`,
        );
      }
      if (client.consigneBalance >= client.consigneLimit) {
        parts.push(`La limite est atteinte : merci de restituer des emballages avant la prochaine livraison.`);
      }
      return { text: parts.join(' '), suggestions: this.suggestionsFor('solde_consigne', who) };
    }

    const clients = await this.prisma.client.findMany({
      where: { isActive: true, consigneBalance: { gt: 0 } },
      select: { name: true, consigneBalance: true, consigneLimit: true },
      orderBy: { consigneBalance: 'desc' },
    });
    const total = clients.reduce((sum, client) => sum + client.consigneBalance, 0);
    const overLimit = clients.filter((client) => client.consigneBalance >= client.consigneLimit);
    const top = clients
      .slice(0, 3)
      .map((client) => `${client.name} (${client.consigneBalance})`)
      .join(', ');
    return {
      text: `${total} emballage(s) sont en circulation chez ${clients.length} client(s), dont ${overLimit.length} au-delà de leur limite.${
        top ? ` Encours les plus élevés : ${top}.` : ''
      }`,
      suggestions: this.suggestionsFor('solde_consigne', who),
    };
  }

  private async replyStockProduit(
    who: Interlocutor,
    entities: IntentEntities,
  ): Promise<IntentReply> {
    if (who.kind === 'CLIENT') {
      return this.internalOnly('les niveaux de stock internes', who, 'stock_produit');
    }
    if (!this.roleAllows(who, ROLES_STOCK)) {
      return this.roleRefusal('les stocks', who, 'stock_produit');
    }

    const items = await this.prisma.stockItem.findMany({
      where: entities.productFormat ? { product: { format: entities.productFormat } } : {},
      select: {
        quantity: true,
        product: { select: { name: true } },
        location: { select: { name: true } },
      },
    });
    if (items.length === 0) {
      return {
        text: `Aucune ligne de stock n'est enregistrée${
          entities.productFormat ? ` pour le format ${entities.productFormat}` : ''
        }.`,
        suggestions: this.suggestionsFor('stock_produit', who),
      };
    }

    const byProduct = new Map<string, number>();
    for (const item of items) {
      byProduct.set(item.product.name, (byProduct.get(item.product.name) ?? 0) + item.quantity);
    }
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    const detail = [...byProduct.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([name, quantity]) => `${name} : ${quantity}`)
      .join(', ');
    return {
      text: `Stock total disponible${
        entities.productFormat ? ` au format ${entities.productFormat}` : ''
      } : ${total} unité(s) sur ${items.length} emplacement(s). Détail : ${detail}.`,
      suggestions: this.suggestionsFor('stock_produit', who),
    };
  }

  private async replyTourneeDuJour(who: Interlocutor): Promise<IntentReply> {
    if (who.kind === 'CLIENT') {
      return this.internalOnly('le planning interne des tournées', who, 'tournee_du_jour');
    }

    const terrain = this.isTerrain(who);
    const tours = await this.prisma.tour.findMany({
      where: {
        date: this.utcToday(),
        ...(terrain ? { driverId: who.userId } : {}),
      },
      orderBy: { tourNumber: 'asc' },
      include: {
        vehicle: { select: { plate: true, name: true } },
        driver: { select: { firstName: true, lastName: true } },
        _count: { select: { orders: true, deliveries: true } },
      },
    });

    if (tours.length === 0) {
      return {
        text: terrain
          ? `Aucune tournée ne vous est affectée pour aujourd'hui. Rapprochez-vous du chargé d'exploitation si vous attendez une affectation.`
          : `Aucune tournée n'est planifiée à la date du jour.`,
        suggestions: this.suggestionsFor('tournee_du_jour', who),
      };
    }

    if (terrain) {
      const detail = tours
        .map(
          (tour) =>
            `${tour.tourNumber} — zone ${tour.zone}, statut ${tour.status}, ${tour._count.orders} commande(s) à livrer, ${tour._count.deliveries} livraison(s) saisie(s), véhicule ${tour.vehicle.plate} (${tour.vehicle.name})`,
        )
        .join(' ; ');
      return {
        text: `Votre programme du jour : ${detail}.`,
        suggestions: this.suggestionsFor('tournee_du_jour', who),
      };
    }

    const detail = tours
      .slice(0, 4)
      .map(
        (tour) =>
          `${tour.tourNumber} (zone ${tour.zone}, ${tour.status}, ${tour._count.orders} commande(s), livreur ${tour.driver.firstName} ${tour.driver.lastName}, véhicule ${tour.vehicle.plate})`,
      )
      .join(', ');
    return {
      text: `${tours.length} tournée(s) sont datées du jour : ${detail}.`,
      suggestions: this.suggestionsFor('tournee_du_jour', who),
    };
  }

  private async replyEncaissementJour(who: Interlocutor): Promise<IntentReply> {
    if (who.kind === 'CLIENT') {
      return this.internalOnly('les encaissements internes', who, 'encaissement_jour');
    }
    if (!this.roleAllows(who, ROLES_ENCAISSEMENT)) {
      return this.roleRefusal('les encaissements', who, 'encaissement_jour');
    }

    const payments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: this.startOfToday() } },
      select: { amount: true, method: true },
    });
    if (payments.length === 0) {
      return {
        text: `Aucun encaissement n'a encore été enregistré aujourd'hui.`,
        suggestions: this.suggestionsFor('encaissement_jour', who),
      };
    }

    const total = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const byMethod = new Map<string, number>();
    for (const payment of payments) {
      byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + Number(payment.amount));
    }
    const detail = [...byMethod.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([method, amount]) => `${method} : ${this.money(amount)}`)
      .join(', ');
    return {
      text: `Encaissements du jour : ${this.money(total)} sur ${payments.length} règlement(s). Répartition par moyen de paiement — ${detail}.`,
      suggestions: this.suggestionsFor('encaissement_jour', who),
    };
  }

  private async replyPrixProduit(
    who: Interlocutor,
    entities: IntentEntities,
  ): Promise<IntentReply> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, ...(entities.productFormat ? { format: entities.productFormat } : {}) },
      orderBy: { unitPrice: 'asc' },
      select: {
        code: true,
        name: true,
        unitPrice: true,
        consigneAmount: true,
        isReusable: true,
      },
    });
    if (products.length === 0) {
      return {
        text: `Aucun produit actif ne correspond${
          entities.productFormat ? ` au format ${entities.productFormat}` : ''
        } dans le catalogue.`,
        suggestions: this.suggestionsFor('prix_produit', who),
      };
    }

    const detail = products
      .slice(0, 4)
      .map((product) => {
        const consigne = Number(product.consigneAmount);
        return `${product.name} (${product.code}) : ${this.money(product.unitPrice)}${
          product.isReusable && consigne > 0 ? `, consigne ${this.money(consigne)}` : ''
        }`;
      })
      .join(' ; ');
    return {
      text: `Tarifs en vigueur — ${detail}.`,
      suggestions: this.suggestionsFor('prix_produit', who),
    };
  }

  private async replyFidelite(who: Interlocutor): Promise<IntentReply> {
    if (who.kind === 'CLIENT') {
      const scope = this.clientScopeGuard(who, 'vos points de fidélité');
      if (scope) return scope;

      const client = await this.prisma.client.findUnique({
        where: { id: who.clientId },
        select: { loyaltyPoints: true, loyaltyTier: true, walletBalance: true },
      });
      if (!client) {
        return {
          text: `Je ne retrouve pas votre fiche client pour consulter vos points de fidélité.`,
          suggestions: this.suggestionsFor('fidelite', who),
        };
      }
      const next = LOYALTY_TIERS.find((tier) => client.loyaltyPoints < tier.threshold);
      const parts = [
        `Vous cumulez ${client.loyaltyPoints} point(s) de fidélité, niveau ${client.loyaltyTier}, portefeuille de ${this.money(client.walletBalance)}.`,
      ];
      parts.push(
        next
          ? `Encore ${next.threshold - client.loyaltyPoints} point(s) pour atteindre le niveau ${next.tier}.`
          : `Vous êtes au niveau maximum du programme.`,
      );
      return { text: parts.join(' '), suggestions: this.suggestionsFor('fidelite', who) };
    }

    if (!this.roleAllows(who, ROLES_FIDELITE)) {
      return this.roleRefusal('le programme de fidélité', who, 'fidelite');
    }

    const [tiers, top] = await Promise.all([
      this.prisma.client.groupBy({
        by: ['loyaltyTier'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      this.prisma.client.findMany({
        where: { isActive: true, loyaltyPoints: { gt: 0 } },
        orderBy: { loyaltyPoints: 'desc' },
        take: 3,
        select: { name: true, loyaltyPoints: true, loyaltyTier: true },
      }),
    ]);
    const repartition = tiers
      .map((entry) => `${entry.loyaltyTier} : ${entry._count._all}`)
      .join(', ');
    const podium = top
      .map((client) => `${client.name} (${client.loyaltyPoints} pts, ${client.loyaltyTier})`)
      .join(', ');
    return {
      text: `Répartition des clients actifs par palier — ${repartition}.${
        podium ? ` Meilleurs cumuls : ${podium}.` : ''
      }`,
      suggestions: this.suggestionsFor('fidelite', who),
    };
  }

  private async replyAide(who: Interlocutor): Promise<IntentReply> {
    const client = who.kind === 'CLIENT';
    const topics = Object.values(INTENT_HELP)
      .filter((entry) => entry.audience === 'TOUS' || entry.audience === (client ? 'CLIENT' : 'INTERNE'))
      .map((entry) => entry.label);
    const channels = client
      ? 'Vous me retrouvez sur le portail client et sur WhatsApp'
      : 'Vous me retrouvez dans le back-office, et les clients me joignent sur le portail et WhatsApp';
    return {
      text: `Je réponds en français comme en lingala sur : ${topics.join(', ')}. ${channels}. Si je ne sais pas répondre, je transfère la conversation à un conseiller avec son contexte.`,
      suggestions: this.suggestionsFor('aide', who),
    };
  }

  // ==========================================================================
  // Cloisonnement des données et refus
  // ==========================================================================

  /** Un contact non rattaché à une fiche client ne reçoit aucune donnée nominative. */
  private unknownContact(who: Interlocutor, subject: string): IntentReply {
    return {
      text: `Je ne peux pas consulter ${subject} car ce numéro n'est pas encore rattaché à un compte client EMMANUEL SERVICES SARLU. Communiquez-le à votre commercial : je pourrai ensuite répondre directement.`,
      suggestions: this.suggestionsFor('aide', who),
    };
  }

  /** Refus courtois d'un intent interne demandé par un client. */
  private internalOnly(subject: string, who: Interlocutor, intent: IntentName): IntentReply {
    return {
      text: `Je ne peux pas communiquer ${subject} : ces informations sont réservées aux équipes EMMANUEL SERVICES SARLU. En revanche, je reste à votre disposition pour vos commandes, vos livraisons, vos consignes et vos points de fidélité.`,
      suggestions: this.suggestionsFor(intent, who),
    };
  }

  /** Refus lié au profil de l'utilisateur interne. */
  private roleRefusal(subject: string, who: Interlocutor, intent: IntentName): IntentReply {
    return {
      text: `Votre profil ${who.role ?? 'interne'} n'est pas habilité à consulter ${subject}. Adressez la demande au profil compétent ou demandez une extension d'habilitation à l'administrateur.`,
      suggestions: this.suggestionsFor(intent, who),
    };
  }

  private isTerrain(who: Interlocutor): boolean {
    return who.role !== undefined && ROLES_TERRAIN.includes(who.role);
  }

  private roleAllows(who: Interlocutor, allowed: UserRole[]): boolean {
    return who.role !== undefined && allowed.includes(who.role);
  }

  private hasSupervision(role: string): boolean {
    return ROLES_SUPERVISION.includes(role as UserRole);
  }

  // ==========================================================================
  // Sessions, journal et notifications
  // ==========================================================================

  private async resolveInterlocutor(params: {
    userId?: string;
    portalAccountId?: string;
    role?: string;
  }): Promise<Interlocutor> {
    if (params.portalAccountId) {
      const account = await this.prisma.portalAccount.findUnique({
        where: { id: params.portalAccountId },
        select: { id: true, fullName: true, clientId: true, client: { select: { name: true } } },
      });
      if (!account) throw new NotFoundException('Compte portail introuvable');
      return {
        kind: 'CLIENT',
        portalAccountId: account.id,
        clientId: account.clientId,
        displayName: `${account.fullName} (${account.client.name})`,
      };
    }

    if (params.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      if (!user) throw new NotFoundException('Utilisateur introuvable');
      return {
        kind: 'INTERNE',
        userId: user.id,
        role: user.role,
        displayName: `${user.firstName} ${user.lastName}`,
      };
    }

    throw new BadRequestException("L'interlocuteur de la conversation n'est pas identifié.");
  }

  /** Identification d'un contact WhatsApp par son numéro (EF-BOT-02). */
  private async resolveWhatsappContact(from: string): Promise<Interlocutor> {
    const digits = from.replace(/\D/g, '');
    const suffix = digits.slice(-9);
    let client: { id: string; name: string } | null = null;

    if (suffix.length >= 6) {
      client = await this.prisma.client.findFirst({
        where: { isActive: true, phone: { contains: suffix } },
        select: { id: true, name: true },
      });
      if (!client) {
        // Second passage tolérant aux séparateurs présents dans les fiches.
        const candidates = await this.prisma.client.findMany({
          where: { isActive: true, phone: { not: null } },
          select: { id: true, name: true, phone: true },
        });
        const found = candidates.find(
          (candidate) => (candidate.phone ?? '').replace(/\D/g, '').endsWith(suffix),
        );
        client = found ? { id: found.id, name: found.name } : null;
      }
    }

    if (!client) {
      return { kind: 'CLIENT', displayName: `contact WhatsApp ${from}` };
    }

    const account = await this.prisma.portalAccount.findFirst({
      where: { clientId: client.id, isActive: true },
      select: { id: true, fullName: true },
    });
    return {
      kind: 'CLIENT',
      clientId: client.id,
      portalAccountId: account?.id,
      displayName: account?.fullName ?? client.name,
    };
  }

  /**
   * Conversation WhatsApp en cours. La session n'est reprise que lorsque le
   * contact est rattaché à un compte portail, seule clé que le modèle de
   * données permet d'associer à une session.
   */
  private findOpenWhatsappSession(portalAccountId: string) {
    const since = new Date(Date.now() - WHATSAPP_SESSION_WINDOW_HOURS * 3600 * 1000);
    return this.prisma.assistantSession.findFirst({
      where: {
        channel: AssistantChannel.WHATSAPP,
        portalAccountId,
        escalated: false,
        lastMessageAt: { gte: since },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  private async resolveSession(
    sessionId: string | undefined,
    channel: AssistantChannel,
    who: Interlocutor,
  ) {
    if (sessionId) {
      const existing = await this.prisma.assistantSession.findUnique({ where: { id: sessionId } });
      if (existing && this.ownsSession(existing, who)) return existing;
    }
    return this.prisma.assistantSession.create({
      data: {
        channel,
        userId: who.userId,
        portalAccountId: who.portalAccountId,
      },
    });
  }

  private ownsSession(
    session: { userId: string | null; portalAccountId: string | null; channel: AssistantChannel },
    who: Interlocutor,
  ): boolean {
    if (who.userId) return session.userId === who.userId;
    if (who.portalAccountId) return session.portalAccountId === who.portalAccountId;
    // Contact WhatsApp non rattaché : session anonyme résolue par le service.
    return (
      session.channel === AssistantChannel.WHATSAPP &&
      session.userId === null &&
      session.portalAccountId === null
    );
  }

  /** EF-BOT-04 : journalisation de chaque message de la conversation. */
  private logMessage(data: {
    sessionId: string;
    author: AssistantAuthor;
    content: string;
    intent?: string;
    confidence?: number;
  }) {
    return this.prisma.assistantMessage.create({ data });
  }

  private async markEscalated(sessionId: string, alreadyEscalated: boolean) {
    if (alreadyEscalated) return;
    await this.prisma.assistantSession.update({
      where: { id: sessionId },
      data: { escalated: true, escalatedAt: new Date() },
    });
  }

  /** EF-BOT-03 : transfert vers un humain avec le contexte de la conversation. */
  private async notifyEscalation(params: {
    channel: AssistantChannel;
    isClient: boolean;
    who: string;
    question: string;
  }) {
    const roles = params.isClient
      ? [UserRole.SUPERVISEUR, UserRole.ADMIN, UserRole.COMMERCIAL]
      : [UserRole.SUPERVISEUR, UserRole.ADMIN];
    await this.notifications.notifyRoles(roles, {
      title: 'Assistant : demande transférée à un conseiller',
      message: `${params.who} (canal ${params.channel}) attend une réponse humaine. Question posée : « ${params.question} ». Reprenez la conversation dans l'assistant.`,
      type: NotificationType.WARNING,
      category: params.isClient ? NotificationCategory.PORTAIL : NotificationCategory.SYSTEME,
      link: '/assistant',
    });
  }

  // ==========================================================================
  // Rebonds et utilitaires de mise en forme
  // ==========================================================================

  private clientScopeGuard(who: Interlocutor, topic: string): IntentReply | null {
    if (who.kind === 'CLIENT' && !who.clientId) {
      return {
        text: `Je ne peux pas consulter ${topic} sans compte client identifié.`,
        suggestions: this.suggestionsFor('aide', who),
      };
    }
    return null;
  }

  /** Trois questions de rebond adaptées à l'intention et au profil. */
  private suggestionsFor(intent: IntentName, who: Interlocutor): string[] {
    const client = who.kind === 'CLIENT';
    const terrain = this.isTerrain(who);

    switch (intent) {
      case 'statut_commande':
        return client
          ? ['Quand arrive ma livraison ?', 'Quel est mon solde de consigne ?', 'Quels sont vos tarifs ?']
          : terrain
            ? ['Quelle est ma tournée du jour ?', 'Où en sont mes livraisons ?', 'Quel est le prix du bidon 10L ?']
            : ['Quelles sont les tournées du jour ?', 'Quel est le stock disponible ?', 'Où en sont les livraisons ?'];
      case 'suivi_livraison':
        return client
          ? ['Où en est ma commande ?', 'Quel est mon solde de consigne ?', 'Combien de points de fidélité ai-je ?']
          : terrain
            ? ['Quelle est ma tournée du jour ?', 'Où en est la commande CMD-… ?', 'Quels sont les tarifs en vigueur ?']
            : ['Quelles sont les tournées du jour ?', 'Combien a-t-on encaissé aujourd’hui ?', 'Où en est la commande CMD-… ?'];
      case 'solde_consigne':
        return client
          ? ['Où en est ma commande ?', 'Quand arrive ma livraison ?', 'Quels sont vos tarifs ?']
          : ['Quel est le stock de bidons 10L ?', 'Quelles sont les tournées du jour ?', 'Où en sont les livraisons ?'];
      case 'stock_produit':
        return ['Quelles sont les tournées du jour ?', 'Quel est le prix du bidon 25L ?', 'Quel est l’encours de consigne ?'];
      case 'tournee_du_jour':
        return terrain
          ? ['Où en sont mes livraisons ?', 'Où en est la commande CMD-… ?', 'Quels sont les tarifs en vigueur ?']
          : ['Où en sont les livraisons du jour ?', 'Quel est le stock disponible ?', 'Combien a-t-on encaissé aujourd’hui ?'];
      case 'encaissement_jour':
        return ['Où en sont les livraisons du jour ?', 'Quelles sont les tournées du jour ?', 'Quel est l’encours de consigne ?'];
      case 'prix_produit':
        return client
          ? ['Où en est ma commande ?', 'Quel est mon solde de consigne ?', 'Combien de points de fidélité ai-je ?']
          : ['Quel est le stock disponible ?', 'Où en est la commande CMD-… ?', 'Quelles sont les tournées du jour ?'];
      case 'fidelite':
        return client
          ? ['Quels sont vos tarifs ?', 'Où en est ma commande ?', 'Quel est mon solde de consigne ?']
          : ['Quel est l’encours de consigne ?', 'Où en sont les livraisons du jour ?', 'Quels sont les tarifs en vigueur ?'];
      case 'salutation':
      case 'aide':
      default:
        return client
          ? ['Où en est ma commande ?', 'Quel est mon solde de consigne ?', 'Combien de points de fidélité ai-je ?']
          : terrain
            ? ['Quelle est ma tournée du jour ?', 'Où en sont mes livraisons ?', 'Où en est la commande CMD-… ?']
            : ['Quelles sont les tournées du jour ?', 'Quel est le stock disponible ?', 'Où en est la commande CMD-… ?'];
    }
  }

  /** Montant en francs congolais, format français. */
  private money(value: Prisma.Decimal | number | null | undefined): string {
    return `${Number(value ?? 0).toLocaleString('fr-FR')} CDF`;
  }

  private day(value: Date | null | undefined): string {
    return value ? value.toLocaleDateString('fr-FR') : 'date inconnue';
  }

  /** Début de la journée locale, pour les colonnes horodatées. */
  private startOfToday(): Date {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /** Date du jour à minuit UTC, forme utilisée par les colonnes de type date. */
  private utcToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
