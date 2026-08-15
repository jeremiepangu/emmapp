import { ProductFormat } from '@prisma/client';

/**
 * Moteur de compréhension de l'assistant conversationnel (EF-BOT-01).
 *
 * Le moteur est volontairement déterministe : aucune dépendance externe, aucun
 * appel réseau. Le score d'un intent combine la proportion de groupes de
 * mots-clés reconnus et la similarité de Jaccard avec des exemples de
 * référence. Les synonymes couvrent le français et le lingala, conformément à
 * l'extension multilingue prévue au § 10.1 du cahier des charges v3.0.
 */

export type IntentName =
  | 'salutation'
  | 'statut_commande'
  | 'suivi_livraison'
  | 'solde_consigne'
  | 'stock_produit'
  | 'tournee_du_jour'
  | 'encaissement_jour'
  | 'prix_produit'
  | 'fidelite'
  | 'aide'
  | 'inconnu';

export type EntityName = 'orderNumber' | 'deliveryNumber' | 'tourNumber' | 'productFormat';

export interface IntentDefinition {
  name: IntentName;
  /** Un groupe est satisfait dès qu'un seul de ses synonymes apparaît. */
  keywords: string[][];
  /** Formulations de référence servant à la similarité de Jaccard. */
  samples: string[];
  /** Entités sans lesquelles la réponse est impossible (aucune à ce jour). */
  requiredEntities?: EntityName[];
}

export interface IntentEntities {
  /** Référence de commande au format en vigueur, ex. « CMD-20260815-0004 ». */
  orderNumber?: string;
  /** Référence de bon de livraison, ex. « LIV-20260815-0001 ». */
  deliveryNumber?: string;
  /** Référence de tournée, ex. « TR-20260815-001 ». */
  tourNumber?: string;
  productFormat?: ProductFormat;
}

export interface IntentMatch {
  intent: IntentName;
  /** Confiance normalisée entre 0 et 1. */
  confidence: number;
  entities: IntentEntities;
  /** Question normalisée, conservée pour le journal d'audit (EF-BOT-04). */
  normalized: string;
}

/**
 * Sous ce seuil, la demande sort du périmètre de connaissance de l'assistant
 * et doit être transférée à un conseiller humain (EF-BOT-03).
 */
export const ESCALATION_THRESHOLD = 0.45;

/** Pondérations du score : mots-clés, exemples, spécificité de l'intent. */
const KEYWORD_WEIGHT = 0.55;
const SAMPLE_WEIGHT = 0.35;
const SPECIFICITY_WEIGHT = 0.1;
const SPECIFICITY_REFERENCE_GROUPS = 3;

/** Mots trop fréquents pour porter du sens dans la comparaison d'exemples. */
const STOPWORDS = new Set([
  'a', 'ai', 'au', 'aux', 'avec', 'ce', 'ces', 'cette', 'd', 'dans', 'de', 'des', 'du', 'elle',
  'en', 'est', 'et', 'etre', 'eu', 'il', 'ils', 'je', 'l', 'la', 'le', 'les', 'leur', 'lui', 'm',
  'ma', 'me', 'mes', 'moi', 'mon', 'n', 'ne', 'nos', 'notre', 'nous', 'on', 'ou', 'par', 'pas',
  'plus', 'pour', 'qu', 'que', 'quel', 'quelle', 'qui', 's', 'sa', 'se', 'ses', 'si', 'son',
  'sont', 'sur', 't', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vos', 'votre', 'vous', 'y',
  'na', 'ya', 'ezali', 'nga',
]);

/**
 * Normalisation : minuscules, suppression des accents et de la ponctuation,
 * réduction des espaces multiples.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter((token) => token.length > 0);
}

/** Radicalisation minimale : neutralise le pluriel des noms communs. */
function stem(token: string): string {
  return token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token;
}

function meaningfulSet(normalized: string): Set<string> {
  return new Set(
    tokenize(normalized)
      .filter((token) => token.length > 1 && !STOPWORDS.has(token))
      .map(stem),
  );
}

/**
 * Un synonyme composé est cherché dans la phrase entière ; un synonyme simple
 * est comparé aux jetons, avec tolérance au pluriel et aux dérivés.
 */
function hasSynonym(tokens: string[], normalized: string, synonym: string): boolean {
  if (synonym.includes(' ')) {
    return normalized.includes(synonym);
  }
  return tokens.some(
    (token) => token === synonym || (synonym.length >= 4 && token.startsWith(synonym)),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const value of left) {
    if (right.has(value)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

export const INTENTS: IntentDefinition[] = [
  {
    name: 'salutation',
    keywords: [
      ['bonjour', 'bonsoir', 'salut', 'coucou', 'hello', 'hey', 'mbote', 'boni', 'losako', 'sango nini'],
    ],
    samples: [
      'bonjour',
      'salut',
      'bonsoir emmapure',
      'mbote',
      'mbote sango nini',
      'bonjour je voudrais un renseignement',
    ],
  },
  {
    name: 'statut_commande',
    keywords: [
      ['commande', 'komanda', 'cmd', 'achat', 'bon de commande'],
      ['ou', 'statut', 'etat', 'avancement', 'avance', 'suivi', 'point', 'validee', 'preparation', 'prete', 'wapi'],
    ],
    samples: [
      'ou en est ma commande',
      'statut de ma commande',
      'ma commande est elle validee',
      'komanda na nga ezali wapi',
      'quel est l etat de la commande',
      'suivi de commande',
    ],
  },
  {
    name: 'suivi_livraison',
    keywords: [
      ['livraison', 'livre', 'livreur', 'livrer', 'mbala', 'bordereau', 'camion'],
      ['quand', 'ou', 'arrive', 'recevoir', 'suivi', 'statut', 'heure', 'position', 'passe', 'etat', 'tango nini', 'wapi'],
    ],
    samples: [
      'quand arrive ma livraison',
      'ou est le livreur',
      'suivi de ma livraison',
      'mbala na nga ekoya tango nini',
      'la livraison est elle passee',
      'livraison du jour',
    ],
  },
  {
    name: 'solde_consigne',
    keywords: [
      ['consigne', 'emballage', 'bidon', 'bonbonne', 'caution'],
      ['solde', 'ndambo', 'dois', 'reste', 'combien', 'balance', 'retour', 'rendre', 'restitue'],
    ],
    samples: [
      'quel est mon solde de consigne',
      'combien de bidons je dois',
      'ndambo ya bidon',
      'solde de consigne',
      'combien d emballages restent chez moi',
    ],
  },
  {
    name: 'stock_produit',
    keywords: [
      ['stock', 'inventaire', 'disponible', 'dispo', 'quantite', 'entrepot', 'magasin'],
      ['produit', 'bidon', 'bonbonne', 'eau', 'article', 'format', 'palette', '5l', '10l', '19l', '25l'],
    ],
    samples: [
      'combien de bidons en stock',
      'quel est le stock disponible',
      'stock des bonbonnes 19l',
      'stock de bidon 10l',
      'niveau de stock entrepot',
    ],
  },
  {
    name: 'tournee_du_jour',
    keywords: [
      ['tournee', 'itineraire', 'trajet', 'mobembo', 'route'],
      ['jour', 'aujourd hui', 'lelo', 'journee', 'planning', 'programme', 'matin', 'prevue', 'affectee'],
    ],
    samples: [
      'quelle est ma tournee du jour',
      'ma tournee',
      'tournees d aujourd hui',
      'mobembo ya lelo',
      'planning des tournees du jour',
      'combien de tournees aujourd hui',
    ],
  },
  {
    name: 'encaissement_jour',
    keywords: [
      ['encaissement', 'encaisse', 'recette', 'caisse', 'paiement', 'reglement', 'mbongo', 'versement'],
      ['jour', 'aujourd hui', 'lelo', 'journee', 'total', 'combien', 'somme', 'montant', 'matin'],
    ],
    samples: [
      'combien a t on encaisse aujourd hui',
      'total des encaissements du jour',
      'recette de la journee',
      'mbongo ya lelo',
      'encaissements aujourd hui',
    ],
  },
  {
    name: 'prix_produit',
    keywords: [
      ['prix', 'tarif', 'motuya', 'coute', 'cout', 'combien', 'vendu', 'tarification'],
      ['produit', 'bidon', 'bonbonne', 'eau', 'article', 'format', 'catalogue', '5l', '10l', '19l', '25l'],
    ],
    samples: [
      'quel est le prix du bidon 10l',
      'combien coute une bonbonne 19l',
      'motuya ya bidon',
      'tarif des produits',
      'prix du 5l',
    ],
  },
  {
    name: 'fidelite',
    keywords: [
      ['fidelite', 'point', 'points', 'recompense', 'wallet', 'portefeuille', 'cadeau', 'bonus', 'palier'],
      ['combien', 'mon', 'mes', 'solde', 'niveau', 'cumule', 'gagne', 'statut', 'programme'],
    ],
    samples: [
      'combien de points de fidelite ai je',
      'mes points de fidelite',
      'quel est mon niveau de fidelite',
      'points fidelite',
      'programme de fidelite et recompenses',
    ],
  },
  {
    name: 'aide',
    keywords: [
      ['aide', 'aidez', 'help', 'lisalisa', 'assistance', 'fonction', 'fonctions', 'menu', 'options', 'sais', 'peux', 'capable'],
    ],
    samples: [
      'aide',
      'que sais tu faire',
      'comment ca marche',
      'lisalisa',
      'quelles sont tes fonctions',
      'que peux tu faire pour moi',
    ],
  },
];

/**
 * Libellés présentés par l'intent `aide`, avec le public concerné : les intents
 * internes ne sont jamais annoncés à un client (cloisonnement des données).
 */
export const INTENT_HELP: Record<
  Exclude<IntentName, 'inconnu' | 'aide' | 'salutation'>,
  { label: string; audience: 'CLIENT' | 'INTERNE' | 'TOUS' }
> = {
  statut_commande: { label: "le statut d'une commande", audience: 'TOUS' },
  suivi_livraison: { label: 'le suivi des livraisons', audience: 'TOUS' },
  solde_consigne: { label: 'le solde des consignes', audience: 'TOUS' },
  prix_produit: { label: 'les prix du catalogue', audience: 'TOUS' },
  fidelite: { label: 'les points de fidélité', audience: 'TOUS' },
  stock_produit: { label: 'les niveaux de stock', audience: 'INTERNE' },
  tournee_du_jour: { label: 'les tournées du jour', audience: 'INTERNE' },
  encaissement_jour: { label: 'les encaissements de la journée', audience: 'INTERNE' },
};

/**
 * Références métier reconnues dans la question, aux formats produits par le
 * back-end : CMD-<date>-<séquence>, LIV-<date>-<séquence>, TR-<date>-<séquence>.
 */
const REFERENCE_PATTERNS: Array<{ entity: 'orderNumber' | 'deliveryNumber' | 'tourNumber'; pattern: RegExp }> = [
  { entity: 'orderNumber', pattern: /\bcmd[\s-]([a-z0-9]{2,12})(?:[\s-]([a-z0-9]{1,10}))?/i },
  { entity: 'deliveryNumber', pattern: /\bliv[\s-]([a-z0-9]{2,12})(?:[\s-]([a-z0-9]{1,10}))?/i },
  { entity: 'tourNumber', pattern: /\btrn?[\s-]([a-z0-9]{2,12})(?:[\s-]([a-z0-9]{1,10}))?/i },
];

/** L'ordre est significatif : « 25 litres » contient « 5 litres ». */
const FORMAT_SYNONYMS: Array<{ format: ProductFormat; terms: string[] }> = [
  { format: ProductFormat.BIDON_25L, terms: ['25l', '25 l', '25 litres'] },
  { format: ProductFormat.BONBONNE_19L, terms: ['19l', '19 l', '19 litres', 'bonbonne'] },
  { format: ProductFormat.BIDON_10L, terms: ['10l', '10 l', '10 litres'] },
  { format: ProductFormat.BIDON_5L, terms: ['5l', '5 l', '5 litres'] },
];

/** Les références sont lues sur le texte brut, avant perte de la ponctuation. */
export function extractEntities(question: string): IntentEntities {
  const entities: IntentEntities = {};
  for (const { entity, pattern } of REFERENCE_PATTERNS) {
    const found = question.match(pattern);
    if (found) {
      entities[entity] = found[0].trim().toUpperCase().replace(/\s+/g, '-');
    }
  }

  const normalized = normalize(question);
  const tokens = tokenize(normalized);
  for (const { format, terms } of FORMAT_SYNONYMS) {
    if (terms.some((term) => hasSynonym(tokens, normalized, term))) {
      entities.productFormat = format;
      break;
    }
  }
  return entities;
}

/** Score d'un intent pour une question déjà normalisée, entre 0 et 1. */
export function scoreIntent(definition: IntentDefinition, normalized: string): number {
  const tokens = tokenize(normalized);
  const satisfiedGroups = definition.keywords.filter((group) =>
    group.some((synonym) => hasSynonym(tokens, normalized, synonym)),
  ).length;
  const groupRatio = definition.keywords.length
    ? satisfiedGroups / definition.keywords.length
    : 0;

  const questionSet = meaningfulSet(normalized);
  const sampleScore = definition.samples.reduce(
    (best, sample) => Math.max(best, jaccard(questionSet, meaningfulSet(normalize(sample)))),
    0,
  );

  const specificity =
    Math.min(satisfiedGroups, SPECIFICITY_REFERENCE_GROUPS) / SPECIFICITY_REFERENCE_GROUPS;

  const score =
    KEYWORD_WEIGHT * groupRatio + SAMPLE_WEIGHT * sampleScore + SPECIFICITY_WEIGHT * specificity;
  return Math.round(Math.min(score, 1) * 100) / 100;
}

/**
 * Reconnaissance de l'intention : le meilleur score l'emporte, l'ordre de
 * déclaration servant d'arbitre en cas d'égalité pour rester déterministe.
 */
export function detectIntent(question: string): IntentMatch {
  const normalized = normalize(question);
  const entities = extractEntities(question);

  let best: IntentName = 'inconnu';
  let bestScore = 0;
  for (const definition of INTENTS) {
    const score = scoreIntent(definition, normalized);
    const usable =
      score > 0 &&
      (definition.requiredEntities ?? []).every((entity) => entities[entity] !== undefined);
    if (usable && score > bestScore) {
      best = definition.name;
      bestScore = score;
    }
  }

  return { intent: best, confidence: bestScore, entities, normalized };
}
