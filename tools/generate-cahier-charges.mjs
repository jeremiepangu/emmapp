/**
 * Génère le cahier des charges EMMAPURE au format .docx (OOXML natif, sans dépendance).
 * Usage : node tools/generate-cahier-charges.mjs
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, '.docx-build');
const OUT = join(ROOT, 'docs', 'Cahier_des_Charges_EMMAPURE_v2.1.docx');

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const body = [];

const runs = (text, { b = false, i = false, color = null, size = null, font = null } = {}) => {
  const props = [];
  if (font) props.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>`);
  if (b) props.push('<w:b/>');
  if (i) props.push('<w:i/>');
  if (color) props.push(`<w:color w:val="${color}"/>`);
  if (size) props.push(`<w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/>`);
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
};

/** Texte riche : segments [{t, b, i, color}] */
const richPara = (segments, { style = null, align = null, spacing = null } = {}) => {
  const props = [];
  if (style) props.push(`<w:pStyle w:val="${style}"/>`);
  if (spacing) props.push(`<w:spacing ${spacing}/>`);
  if (align) props.push(`<w:jc w:val="${align}"/>`);
  const pPr = props.length ? `<w:pPr>${props.join('')}</w:pPr>` : '';
  body.push(`<w:p>${pPr}${segments.map((s) => runs(s.t, s)).join('')}</w:p>`);
};

const p = (text = '', opts = {}) => richPara([{ t: text, ...opts }], opts);
const h1 = (text) => p(text, { style: 'Heading1' });
const h2 = (text) => p(text, { style: 'Heading2' });
const h3 = (text) => p(text, { style: 'Heading3' });

const bullet = (text, level = 0) => {
  body.push(
    `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr></w:pPr>${runs(text)}</w:p>`,
  );
};

const pageBreak = () => body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');

/**
 * Tableau. rows[0] = en-têtes. widths en cinquantièmes de point (dxa), total ~9360.
 */
const table = (headers, rows, widths) => {
  const total = 9360;
  const w = widths ?? headers.map(() => Math.floor(total / headers.length));
  const grid = w.map((x) => `<w:gridCol w:w="${x}"/>`).join('');

  const cell = (text, idx, { header = false, bold = false } = {}) => {
    const shd = header ? '<w:shd w:val="clear" w:color="auto" w:fill="0E6BA8"/>' : '';
    const segs = Array.isArray(text) ? text : [{ t: text }];
    const content = segs
      .map((s) => runs(s.t, { b: header || bold || s.b, color: header ? 'FFFFFF' : s.color, size: 9 }))
      .join('');
    return `<w:tc><w:tcPr><w:tcW w:w="${w[idx]}" w:type="dxa"/>${shd}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${content}</w:p></w:tc>`;
  };

  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((hh, i) => cell(hh, i, { header: true })).join('')}</w:tr>`;
  const dataRows = rows
    .map((r, ri) => {
      const shade = ri % 2 === 1 ? 'F2F7FB' : null;
      const cells = r
        .map((c, i) => {
          const base = cell(c, i);
          return shade ? base.replace('<w:vAlign', `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/><w:vAlign`) : base;
        })
        .join('');
      return `<w:tr>${cells}</w:tr>`;
    })
    .join('');

  body.push(
    `<w:tbl><w:tblPr><w:tblStyle w:val="GrilleTableau"/><w:tblW w:w="${total}" w:type="dxa"/>` +
      `<w:tblBorders>` +
      `<w:top w:val="single" w:sz="4" w:color="B8CFE0"/><w:left w:val="single" w:sz="4" w:color="B8CFE0"/>` +
      `<w:bottom w:val="single" w:sz="4" w:color="B8CFE0"/><w:right w:val="single" w:sz="4" w:color="B8CFE0"/>` +
      `<w:insideH w:val="single" w:sz="4" w:color="B8CFE0"/><w:insideV w:val="single" w:sz="4" w:color="B8CFE0"/>` +
      `</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
      `<w:tblGrid>${grid}</w:tblGrid>${headerRow}${dataRows}</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`,
  );
};

// ── Images ──────────────────────────────────────────────────────────────────
const ASSETS = join(ROOT, 'docs', 'assets');
const EMU_PER_CM = 360000;
/** Médias enregistrés : { relId, zipPath, srcPath } */
const media = [];

/** Lit largeur/hauteur dans le bloc IHDR d'un PNG. */
const pngSize = (path) => {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(12) !== 0x49484452) throw new Error(`IHDR absent : ${path}`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

/**
 * Insère une image centrée, redimensionnée pour tenir dans la boîte donnée
 * tout en conservant ses proportions.
 */
const image = (fileName, { maxWidthCm = 16.5, maxHeightCm = 21, border = true } = {}) => {
  const srcPath = join(ASSETS, fileName);
  if (!existsSync(srcPath)) {
    console.warn(`  ! image absente, ignorée : ${fileName}`);
    return false;
  }
  const { w, h } = pngSize(srcPath);
  const scale = Math.min((maxWidthCm * EMU_PER_CM) / w, (maxHeightCm * EMU_PER_CM) / h);
  const cx = Math.round(w * scale);
  const cy = Math.round(h * scale);

  const idx = media.length + 1;
  const relId = `rIdImg${idx}`;
  media.push({ relId, zipPath: `word/media/image${idx}.png`, srcPath });

  const ln = border
    ? '<a:ln w="9525"><a:solidFill><a:srgbClr val="C4D3DF"/></a:solidFill></a:ln>'
    : '';

  body.push(
    `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:drawing>` +
      `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
      `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="${idx}" name="Image ${idx}" descr="${esc(fileName)}"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic><pic:nvPicPr><pic:cNvPr id="${idx}" name="${esc(fileName)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${ln}</pic:spPr>` +
      `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`,
  );
  return true;
};

let figureNo = 0;
/** Figure = capture + légende numérotée. */
const figure = (fileName, legend, opts = {}) => {
  if (!image(fileName, opts)) return;
  figureNo += 1;
  richPara(
    [
      { t: `Figure ${figureNo} — `, b: true, size: 9, color: '115E86' },
      { t: legend, size: 9, color: '4A5A68' },
    ],
    { align: 'center', spacing: 'w:before="0" w:after="220"' },
  );
};

// ============================================================================
// CONTENU DU DOCUMENT
// ============================================================================

// --- Page de garde ---
p('', { spacing: 'w:before="1600"' });
image('emmas-logo-cover.png', { maxWidthCm: 11, maxHeightCm: 5, border: false });
p('', { spacing: 'w:before="200"' });
richPara([{ t: 'ERP / CRM de production et distribution d’eau potable', size: 16, color: '4A5A68' }], {
  align: 'center',
});
p('', { spacing: 'w:before="240"' });
richPara([{ t: 'CAHIER DES CHARGES', b: true, size: 22 }], { align: 'center' });
richPara([{ t: 'Version 2.1 — Enterprise Optimisée', size: 13, color: '4A5A68' }], { align: 'center' });
p('', { spacing: 'w:before="1200"' });

table(
  ['Rubrique', 'Valeur'],
  [
    ['Projet', 'EMMAPURE / EMMAS — plateforme ERP-CRM eau potable'],
    ['Version du document', '2.1'],
    ['Statut', 'Document de référence — reconstitué depuis l’implémentation'],
    ['Périmètre', 'Production, qualité, distribution, commerce, finance, RH, supervision'],
    ['Composants', 'API REST NestJS · Back-office React · PWA terrain · App Android'],
    ['Zone d’exploitation', 'République Démocratique du Congo (Kinshasa et provinces)'],
    ['Date d’édition', new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['Confidentialité', 'Document interne — diffusion restreinte'],
  ],
  [3000, 6360],
);

pageBreak();

// --- Sommaire ---
h1('Sommaire');
const toc = [
  '1. Présentation générale et contexte',
  '2. Objectifs et bénéfices attendus',
  '3. Périmètre fonctionnel',
  '4. Acteurs, profils et organisation',
  '5. Matrice des habilitations (CRUDV)',
  '6. Exigences fonctionnelles détaillées',
  '7. Système de notifications',
  '8. Modèle de données',
  '9. Architecture technique',
  '10. Interfaces de programmation (API REST)',
  '11. Exigences d’interface et d’expérience utilisateur',
  '12. Exigences non fonctionnelles',
  '13. Sécurité, traçabilité et conformité',
  '14. Environnements et déploiement',
  '15. Stratégie de recette et de tests',
  '16. Lotissement et trajectoire projet',
  '17. Annexe A — Comptes, glossaire et versions',
  '18. Annexe B — Captures des interfaces',
];
toc.forEach((t) => p(t, { spacing: 'w:after="60"' }));

pageBreak();

// --- 1. Présentation ---
h1('1. Présentation générale et contexte');

h2('1.1 Contexte métier');
p(
  'EMMAPURE est une unité de production et de distribution d’eau potable conditionnée opérant en République Démocratique du Congo. ' +
    'Son activité couvre la chaîne complète depuis le traitement et l’embouteillage de l’eau jusqu’à la livraison au client final, ' +
    'en incluant la gestion circulaire des emballages consignés (bidons et bonbonnes) qui reviennent en production après lavage.',
);
p(
  'Cette chaîne présente trois particularités qui structurent l’ensemble du besoin logiciel. ' +
    'Premièrement, la production est soumise à une exigence sanitaire forte qui impose une traçabilité par lot et un contrôle qualité libératoire. ' +
    'Deuxièmement, la distribution s’effectue en tournées sur un terrain où la connectivité réseau est intermittente, ce qui interdit de reposer ' +
    'uniquement sur une application connectée. Troisièmement, une part significative de la valeur circule sous forme d’emballages consignés ' +
    'dont le solde par client doit être suivi au bidon près, faute de quoi les pertes deviennent invisibles.',
);

h2('1.2 Situation actuelle et limites');
p(
  'La gestion s’appuie aujourd’hui sur des outils bureautiques hétérogènes et des registres papier renseignés par les équipes de production, ' +
    'de magasin et de livraison. Cette organisation engendre des ruptures de saisie entre les maillons de la chaîne, une consolidation ' +
    'manuelle et tardive des indicateurs, une absence de traçabilité opposable en cas d’incident qualité, et un suivi des consignes ' +
    'et des encaissements terrain dont la fiabilité dépend de la rigueur individuelle.',
);

h2('1.3 Objet du présent document');
p(
  'Ce cahier des charges décrit les exigences fonctionnelles, techniques et non fonctionnelles de la plateforme EMMAPURE. ' +
    'Il sert de référence contractuelle entre le métier et l’équipe de réalisation, de support à la recette, et de base à la ' +
    'trajectoire d’évolution du produit. Les exigences sont numérotées pour permettre leur traçabilité jusqu’aux cas de test.',
);

h2('1.4 Documents de référence');
table(
  ['Référence', 'Intitulé'],
  [
    ['DR-01', 'Cahier des charges EMMAPURE optimisé (version métier initiale)'],
    ['DR-02', 'Étiquette produit EMMA 5L — charte graphique et mentions réglementaires'],
    ['DR-03', 'Procédures opératoires normalisées de lavage des bidons 5 L et bonbonnes 19 L'],
    ['DR-04', 'Schéma de données Prisma de la plateforme (schema.prisma)'],
    ['DR-05', 'Matrice des habilitations par profil (permissions.ts)'],
  ],
  [1600, 7760],
);

pageBreak();

// --- 2. Objectifs ---
h1('2. Objectifs et bénéfices attendus');

h2('2.1 Objectifs généraux');
p(
  'La plateforme poursuit un objectif central : disposer d’un système d’information unique couvrant la chaîne de valeur de bout en bout, ' +
    'dans lequel chaque événement métier est saisi une seule fois, au plus près de son lieu de survenance, et alimente automatiquement ' +
    'les indicateurs de pilotage et les pièces comptables.',
);

h2('2.2 Objectifs opérationnels détaillés');
table(
  ['Réf.', 'Objectif', 'Indicateur de réussite'],
  [
    ['OBJ-01', 'Tracer chaque lot produit depuis la matière jusqu’à la livraison client', 'Traçabilité amont-aval reconstituable en moins de 5 minutes'],
    ['OBJ-02', 'Interdire la sortie de tout lot non libéré par le contrôle qualité', 'Zéro sortie de lot en statut Quarantaine ou Bloqué'],
    ['OBJ-03', 'Fiabiliser le solde de consignes par client', 'Écart d’inventaire emballages inférieur à 2 %'],
    ['OBJ-04', 'Permettre la saisie terrain sans connexion réseau', 'Aucune perte de saisie lors d’une coupure réseau en tournée'],
    ['OBJ-05', 'Réduire le délai de consolidation des indicateurs', 'Tableau de bord disponible en temps réel'],
    ['OBJ-06', 'Sécuriser les encaissements terrain', 'Rapprochement livraison / encaissement systématique par tournée'],
    ['OBJ-07', 'Cloisonner l’accès à l’information selon le profil', 'Aucun accès hors périmètre constaté en audit'],
    ['OBJ-08', 'Fidéliser la clientèle récurrente', 'Programme de fidélité opérationnel sur quatre niveaux'],
    ['OBJ-09', 'Optimiser l’affectation du personnel polyvalent', 'Planification des vacations couvrant 100 % des postes critiques'],
    ['OBJ-10', 'Détecter les anomalies d’exploitation au plus tôt', 'Notification du responsable concerné dès la détection'],
  ],
  [900, 4460, 4000],
);

h2('2.3 Bénéfices attendus par direction');
bullet('Direction générale : visibilité consolidée et temps réel sur l’activité, les encaissements et la performance industrielle.');
bullet('Production : ordonnancement des ordres de fabrication, suivi des rendements et maîtrise des statuts de lot.');
bullet('Qualité : dossier de lot électronique, contrôles horodatés et nominatifs, décision de libération opposable.');
bullet('Exploitation et logistique : planification des tournées, bordereaux de chargement et réconciliation de retour.');
bullet('Commerce : fiche client enrichie, historique de commandes, segmentation et animation de la fidélité.');
bullet('Finance : encaissements rattachés aux livraisons, suivi des créances et pistes d’audit complètes.');
bullet('Ressources humaines : gestion des vacations, de la polyvalence et des rapports d’activité journaliers.');

pageBreak();

// --- 3. Périmètre ---
h1('3. Périmètre fonctionnel');

h2('3.1 Modules couverts');
p(
  'Le périmètre se décompose en seize modules fonctionnels regroupés en domaines. Chaque module correspond à une rubrique de navigation ' +
    'du back-office et à un ensemble cohérent de règles de gestion et de droits d’accès.',
);
table(
  ['Domaine', 'Module', 'Objet fonctionnel'],
  [
    ['Analyse', 'Tableau de bord', 'Indicateurs consolidés du jour et tendances d’activité'],
    ['Analyse', 'Supervision', 'Observabilité technique et fonctionnelle de la plateforme'],
    ['Annuaires', 'Clients', 'Référentiel clients, segments, zones, encours et consignes'],
    ['Commandes', 'Historique commandes', 'Prise de commande, validation, suivi de cycle de vie'],
    ['Commandes', 'Catalogue produits', 'Formats conditionnés, tarifs et montants de consigne'],
    ['Achats', 'Stocks et achats', 'Emplacements de stock, mouvements et ajustements'],
    ['Fabrication', 'Fabrication / OF', 'Ordres de fabrication, lots et rendements'],
    ['Fabrication', 'Contrôle qualité', 'Contrôles physico-chimiques et libération de lot'],
    ['Livraison', 'Tournées', 'Planification, bordereaux de chargement, exécution'],
    ['Livraison', 'Livraisons', 'Saisie terrain, retours de consignes, géolocalisation'],
    ['Factures', 'Factures et paiements', 'Encaissements multi-moyens et suivi des créances'],
    ['Commerce', 'Fidélité', 'Points, niveaux et avantages clients'],
    ['Commerce', 'Consignes circulaires', 'Cycle de vie des emballages consignés'],
    ['Personnel', 'Personnel / shifts', 'Vacations, polyvalence et rapports d’activité'],
    ['Personnel', 'Utilisateurs', 'Comptes, rôles et états d’activation'],
    ['Paramétrage', 'Notifications', 'Alertes contextuelles par profil'],
  ],
  [1500, 2600, 5260],
);

h2('3.2 Canaux d’accès');
table(
  ['Canal', 'Public visé', 'Usage principal'],
  [
    ['Back-office web', 'Sièges et encadrement', 'Pilotage, paramétrage et saisie de gestion'],
    ['Interface terrain PWA', 'Livreurs et chargés de livraison', 'Exécution de tournée en mobilité, y compris hors connexion'],
    ['Application Android', 'Équipes terrain', 'Variante native distribuable, notamment via Google Play'],
    ['API REST', 'Systèmes tiers', 'Intégration et échanges de données'],
  ],
  [2400, 2800, 4160],
);

h2('3.3 Exclusions du périmètre');
p(
  'Les éléments suivants sont explicitement hors périmètre de la présente version et feront l’objet d’un cadrage ultérieur : ' +
    'la comptabilité générale et les liasses fiscales, la paie, la maintenance industrielle préventive assistée par ordinateur, ' +
    'la vente en ligne à destination du consommateur final, et l’interconnexion automatique avec les plateformes bancaires.',
);

pageBreak();

// --- 4. Acteurs ---
h1('4. Acteurs, profils et organisation');

h2('4.1 Profils utilisateurs');
p(
  'La plateforme distingue dix-sept profils reflétant l’organisation réelle de l’entreprise. Le profil conditionne les rubriques visibles, ' +
    'les actions autorisées, les catégories de notifications reçues et l’interface d’atterrissage après connexion.',
);
table(
  ['Code technique', 'Libellé', 'Responsabilité principale'],
  [
    ['ADMIN', 'Administrateur', 'Administration complète de la plateforme et du paramétrage'],
    ['DG', 'Direction générale', 'Consultation transversale de l’ensemble des indicateurs'],
    ['CHEF_PRODUCTION', 'Chef production', 'Ordonnancement et pilotage des ordres de fabrication'],
    ['CHEF_EXPLOITATION', 'Chef exploitation', 'Validation des commandes et organisation des tournées'],
    ['CHARGE_EXPLOITATION', 'Chargé exploitation', 'Suivi opérationnel des tournées et des livraisons'],
    ['RESP_QUALITE', 'Responsable qualité', 'Contrôles qualité et décision de libération des lots'],
    ['MAGASINIER', 'Magasinier', 'Gestion des stocks, chargements et emballages consignés'],
    ['AGENT_CHARGEUR', 'Agent chargeur', 'Exécution physique des chargements de véhicules'],
    ['LIVREUR', 'Livreur', 'Exécution des livraisons et encaissements terrain'],
    ['CHARGE_LIVRAISON', 'Chargé livraison', 'Exécution des livraisons avec suivi renforcé des paiements'],
    ['COMMERCIAL', 'Commercial', 'Développement du portefeuille et prise de commande'],
    ['DELEGUE_COMMERCIAL', 'Délégué commercial', 'Prospection et création de clients et de commandes'],
    ['CAISSIER', 'Caissier', 'Enregistrement et contrôle des encaissements'],
    ['COMPTABLE', 'Comptable', 'Consultation financière et rapprochements'],
    ['RH', 'Ressources humaines', 'Gestion du personnel, des vacations et des comptes'],
    ['SUPERVISEUR', 'Superviseur', 'Contrôle transversal de l’exécution terrain'],
    ['IT_GED', 'IT / GED', 'Supervision technique et gestion documentaire'],
  ],
  [2400, 2400, 4560],
);

h2('4.2 Règles d’atterrissage après connexion');
p(
  'Conformément à l’exigence métier, tout utilisateur authentifié accède au tableau de bord dès sa connexion, quel que soit son profil. ' +
    'Les profils terrain disposent en complément d’un accès direct à l’interface de mobilité. Les rubriques non autorisées ' +
    'n’apparaissent pas dans la navigation et sont refusées côté serveur en cas d’accès direct par adresse.',
);

pageBreak();

// --- 5. Matrice ---
h1('5. Matrice des habilitations (CRUDV)');

h2('5.1 Conventions de lecture');
table(
  ['Lettre', 'Action', 'Signification métier'],
  [
    ['C', 'Créer', 'Création d’un nouvel enregistrement'],
    ['R', 'Lire', 'Consultation des enregistrements du périmètre'],
    ['U', 'Modifier', 'Mise à jour d’un enregistrement existant'],
    ['D', 'Supprimer', 'Suppression ou désactivation d’un enregistrement'],
    ['V', 'Valider', 'Acte de validation métier engageant (validation, libération, clôture)'],
  ],
  [1000, 1600, 6760],
);
p(
  'Le profil Administrateur dispose de l’ensemble des droits sur l’ensemble des modules. ' +
    'Toute habilitation non explicitement accordée est refusée par défaut, à la fois dans l’interface et au niveau de l’API.',
);

h2('5.2 Habilitations par profil');
const permsRows = [
  ['Administrateur', 'Tous les modules : C R U D V'],
  ['Direction générale', 'Tous les modules : R (consultation seule)'],
  ['Chef production', 'Fabrication : R C U · Stocks : R U · Qualité : R · Produits : R · Supervision : R · Tableau de bord : R · Notifications : R'],
  ['Chef exploitation', 'Commandes : R U V · Tournées : R C U · Livraisons : R · Stocks : R · Clients : R · Tableau de bord : R · Notifications : R'],
  ['Chargé exploitation', 'Tournées : R U · Commandes : R · Livraisons : R · Stocks : R · Tableau de bord : R · Notifications : R'],
  ['Responsable qualité', 'Qualité : R C V · Fabrication : R · Consignes : R · Supervision : R · Notifications : R'],
  ['Magasinier', 'Stocks : R C U · Tournées : R C · Consignes : R U · Produits : R · Notifications : R'],
  ['Agent chargeur', 'Tournées : R U · Stocks : R · Livraisons : R · Notifications : R'],
  ['Livreur', 'Livraisons : R C · Paiements : R C · Commandes : R · Clients : R · Tableau de bord : R · Notifications : R'],
  ['Chargé livraison', 'Livraisons : R C · Paiements : R C · Commandes : R · Clients : R · Tableau de bord : R · Notifications : R'],
  ['Commercial', 'Clients : R C U · Commandes : R C U · Fidélité : R · Produits : R · Paiements : R · Notifications : R'],
  ['Délégué commercial', 'Clients : R C · Commandes : R C · Fidélité : R · Produits : R · Notifications : R'],
  ['Caissier', 'Paiements : R C U · Clients : R · Commandes : R · Notifications : R'],
  ['Comptable', 'Paiements : R · Clients : R · Commandes : R · Tableau de bord : R · Notifications : R'],
  ['Ressources humaines', 'Personnel : R C U · Utilisateurs : R C U · Notifications : R'],
  ['Superviseur', 'Supervision : R · Tournées : R · Livraisons : R · Utilisateurs : R · Tableau de bord : R · Notifications : R'],
  ['IT / GED', 'Supervision : R · Utilisateurs : R · Tableau de bord : R · Notifications : R'],
];
table(['Profil', 'Modules et droits'], permsRows, [2400, 6960]);

h2('5.3 Exigences relatives aux habilitations');
table(
  ['Réf.', 'Exigence'],
  [
    ['EX-HAB-01', 'Le contrôle des droits est appliqué côté serveur sur chaque point d’entrée de l’API, indépendamment de l’interface.'],
    ['EX-HAB-02', 'La navigation ne présente que les rubriques pour lesquelles le profil détient le droit de lecture.'],
    ['EX-HAB-03', 'Les commandes de création, de modification, de suppression et de validation ne sont visibles que si le droit correspondant est détenu.'],
    ['EX-HAB-04', 'Un accès direct par adresse à une rubrique non autorisée redirige l’utilisateur sans divulguer d’information.'],
    ['EX-HAB-05', 'Toute évolution de la matrice est centralisée dans un référentiel unique afin d’éviter les divergences entre modules.'],
    ['EX-HAB-06', 'Les actes de validation métier sont journalisés avec l’identité de l’auteur et l’horodatage.'],
  ],
  [1500, 7860],
);

pageBreak();

// --- 6. Exigences fonctionnelles ---
h1('6. Exigences fonctionnelles détaillées');

h2('6.1 Authentification et gestion des comptes');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-AUT-01', 'L’accès à la plateforme est soumis à une authentification par adresse électronique et mot de passe.'],
    ['EF-AUT-02', 'Les mots de passe sont stockés sous forme d’empreinte cryptographique salée, jamais en clair.'],
    ['EF-AUT-03', 'Une session authentifiée est matérialisée par un jeton signé transmis à chaque appel de l’API.'],
    ['EF-AUT-04', 'Un compte désactivé ne peut plus ouvrir de session, sans suppression de son historique.'],
    ['EF-AUT-05', 'Les messages d’erreur distinguent l’indisponibilité du service d’un identifiant invalide, sans révéler l’existence d’un compte.'],
    ['EF-AUT-06', 'Les profils Administrateur et Ressources humaines créent des comptes, affectent un profil et gèrent l’activation.'],
    ['EF-AUT-07', 'Après authentification, l’utilisateur est dirigé vers le tableau de bord quel que soit son profil.'],
    ['EF-AUT-08', 'L’expiration ou la révocation du jeton ramène l’utilisateur à l’écran de connexion avec un message explicite, sans exposer l’erreur technique.'],
    ['EF-AUT-09', 'Un refus d’habilitation sur une rubrique est restitué par un message compréhensible et non par le détail de la réponse du service.'],
  ],
  [1500, 7860],
);

h2('6.2 Référentiel clients');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-CLI-01', 'Chaque client dispose d’une fiche identifiée de manière unique et rattachée à une zone de distribution.'],
    ['EF-CLI-02', 'Le client est qualifié par un segment parmi Particulier, Boutique, Détaillant, Supermarché, Entreprise et Hôtellerie-restauration.'],
    ['EF-CLI-03', 'La fiche client porte les coordonnées de contact, l’adresse et, le cas échéant, les coordonnées géographiques du point de livraison.'],
    ['EF-CLI-04', 'Le solde d’emballages consignés détenus par le client est consultable et calculé à partir des mouvements enregistrés.'],
    ['EF-CLI-05', 'La fiche client expose l’historique des commandes, des livraisons et des encaissements associés.'],
    ['EF-CLI-06', 'Le client est rattaché à un niveau de fidélité et à un solde de points.'],
    ['EF-CLI-07', 'La suppression d’un client est réservée à l’Administrateur et refusée si des mouvements y sont rattachés.'],
  ],
  [1500, 7860],
);

h2('6.3 Catalogue produits');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-PRD-01', 'Le catalogue couvre les formats Bidon 5 L, Bidon 10 L, Bidon 25 L et Bonbonne 19 L.'],
    ['EF-PRD-02', 'Chaque produit porte un prix de vente et, pour les formats consignés, un montant de consigne distinct du prix du contenu.'],
    ['EF-PRD-03', 'Un produit peut être rendu indisponible à la vente sans être supprimé du référentiel.'],
    ['EF-PRD-04', 'La présentation des produits respecte l’identité visuelle et les mentions figurant sur l’étiquette réglementaire.'],
    ['EF-PRD-05', 'La création, la modification et la suppression d’un produit sont réservées aux profils habilités.'],
  ],
  [1500, 7860],
);

h2('6.4 Production et ordres de fabrication');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-PRO-01', 'Un ordre de fabrication précise le produit, la quantité planifiée, le lot et la date de production.'],
    ['EF-PRO-02', 'L’ordre de fabrication évolue selon les statuts Planifié, En cours, Terminé et Bloqué.'],
    ['EF-PRO-03', 'La quantité effectivement produite est saisie à la clôture et comparée à la quantité planifiée pour établir le rendement.'],
    ['EF-PRO-04', 'Chaque lot produit porte un statut parmi En production, Quarantaine, Libéré et Bloqué.'],
    ['EF-PRO-05', 'Un lot nouvellement produit est placé en quarantaine par défaut et ne peut être vendu en l’état.'],
    ['EF-PRO-06', 'La libération d’un lot est un acte de validation réservé au Responsable qualité et à l’Administrateur.'],
    ['EF-PRO-07', 'Le rebut et les écarts de production sont enregistrés et rattachés à l’ordre de fabrication concerné.'],
    ['EF-PRO-08', 'La création et la modification des ordres de fabrication sont réservées au Chef production et à l’Administrateur.'],
  ],
  [1500, 7860],
);

h2('6.5 Contrôle qualité');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-QUA-01', 'Un contrôle qualité est rattaché à un lot et horodaté avec l’identité du contrôleur.'],
    ['EF-QUA-02', 'Le contrôle enregistre les paramètres mesurés, notamment le pH, la conductivité, la turbidité et le chlore résiduel.'],
    ['EF-QUA-03', 'Le contrôle aboutit à un statut parmi En attente, Conforme et Non conforme.'],
    ['EF-QUA-04', 'Un résultat non conforme place le lot en statut Bloqué et interdit sa sortie de stock.'],
    ['EF-QUA-05', 'La validation d’un contrôle est un acte engageant, réservé au Responsable qualité et à l’Administrateur.'],
    ['EF-QUA-06', 'L’historique des contrôles d’un lot constitue son dossier qualité et n’est pas modifiable après validation.'],
    ['EF-QUA-07', 'Les contrôles relatifs aux procédures de lavage des emballages consignés sont enregistrés selon la même logique.'],
  ],
  [1500, 7860],
);

h2('6.6 Stocks et emplacements');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-STK-01', 'Les stocks sont ventilés par emplacement typé, distinguant notamment matières premières, production, produits finis et stock embarqué véhicule.'],
    ['EF-STK-02', 'Le cycle des emballages consignés est modélisé par des emplacements dédiés : bidons à trier, en lavage et libérés.'],
    ['EF-STK-03', 'Les emplacements Quarantaine, Retraitement, Réparation et Rebut isolent les articles non commercialisables.'],
    ['EF-STK-04', 'Tout ajustement de stock est justifié par un motif et journalisé avec son auteur.'],
    ['EF-STK-05', 'Le stock embarqué d’un véhicule est consultable indépendamment du stock du dépôt.'],
    ['EF-STK-06', 'Un seuil d’alerte par article déclenche une notification vers les profils responsables du réapprovisionnement.'],
  ],
  [1500, 7860],
);

h2('6.7 Commandes');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-CMD-01', 'Une commande est composée de lignes associant un produit, une quantité et un prix unitaire.'],
    ['EF-CMD-02', 'La commande suit les statuts Brouillon, Validée, En préparation, Chargée, En livraison, Livrée et Annulée.'],
    ['EF-CMD-03', 'La validation d’une commande est un acte réservé au Chef exploitation et à l’Administrateur.'],
    ['EF-CMD-04', 'Le montant total intègre le prix des produits et, le cas échéant, les consignes dues.'],
    ['EF-CMD-05', 'L’annulation d’une commande est possible avant chargement et conserve la trace de la commande annulée.'],
    ['EF-CMD-06', 'La prise de commande est ouverte aux profils commerciaux et à l’exploitation selon la matrice d’habilitation.'],
  ],
  [1500, 7860],
);

h2('6.8 Tournées et chargement');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-TRN-01', 'Une tournée associe un véhicule, un livreur, une date et un ensemble de commandes à livrer.'],
    ['EF-TRN-02', 'La tournée suit les statuts Planifiée, En chargement, En cours, Terminée et Annulée.'],
    ['EF-TRN-03', 'Un bordereau de chargement récapitule les quantités confiées au véhicule avant départ.'],
    ['EF-TRN-04', 'La validation du bordereau de chargement conditionne le passage de la tournée en exécution.'],
    ['EF-TRN-05', 'Le retour de tournée donne lieu à une réconciliation entre les quantités chargées, livrées et retournées.'],
    ['EF-TRN-06', 'Tout écart de réconciliation est mis en évidence et notifié aux profils de supervision.'],
  ],
  [1500, 7860],
);

h2('6.9 Livraisons');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-LIV-01', 'Une livraison est rattachée à une tournée et à un client, et détaille les quantités effectivement remises.'],
    ['EF-LIV-02', 'La livraison suit les statuts En attente, Livrée, Refusée et Partielle.'],
    ['EF-LIV-03', 'Les emballages consignés repris chez le client sont saisis lors de la livraison et mettent à jour son solde.'],
    ['EF-LIV-04', 'Les coordonnées géographiques et l’horodatage du point de livraison sont enregistrés lorsque disponibles.'],
    ['EF-LIV-05', 'La saisie d’une livraison est possible sans connexion réseau, avec mise en file locale et synchronisation différée.'],
    ['EF-LIV-06', 'La synchronisation est idempotente : une même saisie transmise plusieurs fois ne crée qu’un seul enregistrement.'],
    ['EF-LIV-07', 'Un refus de livraison est motivé et remonté aux profils d’exploitation.'],
  ],
  [1500, 7860],
);

h2('6.10 Encaissements et paiements');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-PAY-01', 'Un encaissement est rattaché à un client et, lorsque applicable, à une livraison ou à une commande.'],
    ['EF-PAY-02', 'Les moyens de paiement pris en charge sont les espèces, le chèque, le virement, le crédit et la monnaie électronique.'],
    ['EF-PAY-03', 'La monnaie électronique distingue explicitement M-Pesa, Orange Money, Airtel Money et Wave.'],
    ['EF-PAY-04', 'Un encaissement en crédit constitue une créance suivie jusqu’à son règlement.'],
    ['EF-PAY-05', 'Le rapprochement entre livraisons et encaissements d’une tournée est produit automatiquement.'],
    ['EF-PAY-06', 'Toute création ou modification d’encaissement est journalisée de manière non répudiable.'],
  ],
  [1500, 7860],
);

h2('6.11 Consignes circulaires');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-CON-01', 'Chaque mouvement d’emballage consigné est enregistré avec son sens, sa quantité et son motif.'],
    ['EF-CON-02', 'Le solde de consignes par client est calculé à partir des mouvements et non saisi manuellement.'],
    ['EF-CON-03', 'Les emballages retournés transitent par les états de tri, de lavage et de libération avant réemploi.'],
    ['EF-CON-04', 'Un emballage jugé inapte est orienté vers la réparation ou le rebut, avec traçabilité de la décision.'],
    ['EF-CON-05', 'Les unités de conditionnement sont identifiées afin de permettre le suivi du parc d’emballages.'],
    ['EF-CON-06', 'Un solde de consignes anormalement élevé chez un client déclenche une alerte.'],
  ],
  [1500, 7860],
);

h2('6.12 Fidélité');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-FID-01', 'Le programme de fidélité comporte quatre niveaux : Bronze, Argent, Or et Platine.'],
    ['EF-FID-02', 'Des points sont attribués au client en fonction de son activité d’achat.'],
    ['EF-FID-03', 'Le franchissement d’un seuil de points fait évoluer le niveau du client et le lui notifie.'],
    ['EF-FID-04', 'L’attribution manuelle de points est réservée aux profils habilités et journalisée.'],
    ['EF-FID-05', 'Le niveau de fidélité est visible sur la fiche client et exploitable par les équipes commerciales.'],
  ],
  [1500, 7860],
);

h2('6.13 Personnel, vacations et polyvalence');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-RH-01', 'Une vacation affecte un collaborateur à un poste sur une plage horaire déterminée.'],
    ['EF-RH-02', 'La polyvalence est prise en compte : tout collaborateur actif peut être affecté à n’importe quel poste, indépendamment de son profil d’habilitation.'],
    ['EF-RH-03', 'Un rapport d’activité journalier est renseigné et rattaché à son auteur et à sa date.'],
    ['EF-RH-04', 'La planification et la modification des vacations sont réservées aux Ressources humaines et à l’Administrateur.'],
    ['EF-RH-05', 'Les postes critiques non couverts sur une plage horaire sont signalés.'],
  ],
  [1500, 7860],
);

h2('6.14 Tableau de bord et supervision');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-TDB-01', 'Le tableau de bord présente les indicateurs du jour : commandes, livraisons, encaissements et production.'],
    ['EF-TDB-02', 'Les indicateurs affichés sont restreints au périmètre autorisé du profil connecté.'],
    ['EF-TDB-03', 'Les tendances sont représentées graphiquement afin de permettre une lecture immédiate.'],
    ['EF-TDB-04', 'La rubrique de supervision expose l’état de santé fonctionnel et technique de la plateforme.'],
    ['EF-TDB-05', 'Les anomalies détectées en supervision sont accompagnées de leur date et de leur niveau de gravité.'],
    ['EF-TDB-06', 'Le parc de fontaines et d’équipements installés chez les clients est suivi et consultable.'],
    ['EF-TDB-07', 'Le tableau de bord est consultable par tout profil authentifié et constitue son écran d’accueil.'],
    ['EF-TDB-08', 'Un panneau portant sur une rubrique non autorisée est omis sans empêcher l’affichage du reste du tableau de bord.'],
  ],
  [1500, 7860],
);

pageBreak();

// --- 7. Notifications ---
h1('7. Système de notifications');

h2('7.1 Principes');
p(
  'Le système de notifications informe chaque utilisateur des événements qui relèvent de sa responsabilité, sans le submerger d’informations ' +
    'hors de son périmètre. Une notification porte un titre, un message, un type de gravité, une catégorie métier, un lien de rebond ' +
    'vers l’objet concerné et un état de lecture.',
);

h2('7.2 Types et catégories');
table(
  ['Dimension', 'Valeurs'],
  [
    ['Types de gravité', 'Information, Succès, Avertissement, Alerte'],
    [
      'Catégories métier',
      'Commande, Tournée, Livraison, Paiement, Production, Qualité, Stock, Consigne, Fidélité, Ressources humaines, Système, Supervision',
    ],
  ],
  [2400, 6960],
);

h2('7.3 Affectation des catégories par profil');
table(
  ['Profil', 'Catégories notifiées'],
  [
    ['Administrateur', 'Toutes les catégories'],
    ['Direction générale', 'Commande, Paiement, Production, Qualité, Supervision, Système'],
    ['Chef production', 'Production, Qualité, Stock, Système'],
    ['Chef exploitation', 'Commande, Tournée, Livraison, Stock'],
    ['Chargé exploitation', 'Tournée, Livraison, Commande'],
    ['Responsable qualité', 'Qualité, Production, Consigne, Supervision'],
    ['Magasinier', 'Stock, Tournée, Consigne'],
    ['Agent chargeur', 'Tournée, Stock'],
    ['Livreur', 'Tournée, Livraison, Commande'],
    ['Chargé livraison', 'Tournée, Livraison, Commande, Paiement'],
    ['Commercial', 'Commande, Fidélité'],
    ['Délégué commercial', 'Commande, Fidélité'],
    ['Caissier', 'Paiement, Livraison'],
    ['Comptable', 'Paiement, Système'],
    ['Ressources humaines', 'Ressources humaines, Système'],
    ['Superviseur', 'Supervision, Tournée, Qualité, Système'],
    ['IT / GED', 'Supervision, Système'],
  ],
  [2400, 6960],
);

h2('7.4 Exigences fonctionnelles');
table(
  ['Réf.', 'Exigence fonctionnelle'],
  [
    ['EF-NOT-01', 'Un indicateur permanent affiche le nombre de notifications non lues de l’utilisateur connecté.'],
    ['EF-NOT-02', 'L’utilisateur consulte la liste de ses notifications, les marque comme lues individuellement ou globalement.'],
    ['EF-NOT-03', 'Une notification comporte un lien de rebond direct vers l’enregistrement concerné.'],
    ['EF-NOT-04', 'Les notifications sont générées automatiquement par les événements métier et adressées aux profils concernés.'],
    ['EF-NOT-05', 'Un utilisateur ne peut consulter que ses propres notifications.'],
    ['EF-NOT-06', 'La suppression d’un compte entraîne la suppression de ses notifications.'],
  ],
  [1500, 7860],
);

h2('7.5 Événements déclencheurs attendus');
bullet('Validation, annulation ou retard d’une commande.');
bullet('Affectation d’une tournée, départ, retour et écart de réconciliation.');
bullet('Livraison refusée ou partielle.');
bullet('Encaissement enregistré, créance échue.');
bullet('Ouverture, blocage ou clôture d’un ordre de fabrication.');
bullet('Résultat de contrôle qualité non conforme et libération de lot.');
bullet('Franchissement d’un seuil d’alerte de stock.');
bullet('Solde de consignes anormal chez un client.');
bullet('Changement de niveau de fidélité.');
bullet('Poste critique non couvert sur une vacation.');
bullet('Anomalie technique détectée en supervision.');

pageBreak();

// --- 8. Modèle de données ---
h1('8. Modèle de données');

h2('8.1 Entités principales');
table(
  ['Entité', 'Rôle dans le modèle'],
  [
    ['Utilisateur', 'Compte d’accès, profil, état d’activation et rattachement aux notifications'],
    ['Client', 'Fiche client, segment, zone, niveau de fidélité et solde de consignes'],
    ['Produit', 'Article du catalogue, format conditionné, prix et montant de consigne'],
    ['Emplacement de stock', 'Localisation typée des articles, du dépôt au véhicule'],
    ['Article en stock', 'Quantité d’un produit à un emplacement donné'],
    ['Véhicule', 'Moyen de transport porteur du stock embarqué'],
    ['Commande', 'Engagement de vente, statut et montant total'],
    ['Ligne de commande', 'Détail produit, quantité et prix unitaire d’une commande'],
    ['Tournée', 'Regroupement de livraisons affecté à un véhicule et à un livreur'],
    ['Bordereau de chargement', 'Récapitulatif des quantités confiées au véhicule'],
    ['Livraison', 'Remise effective au client, statut et géolocalisation'],
    ['Ligne de livraison', 'Détail des quantités livrées par produit'],
    ['Mouvement de consigne', 'Entrée ou sortie d’emballage consigné chez un client'],
    ['Paiement', 'Encaissement, moyen de paiement et rattachement métier'],
    ['Ordre de fabrication', 'Production planifiée, lot, quantités et statut'],
    ['Contrôle qualité', 'Mesures physico-chimiques et décision de conformité'],
    ['Unité de conditionnement', 'Emballage identifié du parc consigné'],
    ['Vacation', 'Affectation d’un collaborateur à un poste sur une plage horaire'],
    ['Rapport d’activité journalier', 'Compte rendu quotidien rattaché à son auteur'],
    ['Équipement fontaine', 'Matériel installé chez un client et suivi dans le temps'],
    ['Notification', 'Alerte contextuelle destinée à un utilisateur'],
    ['Journal d’audit', 'Trace horodatée des opérations sensibles'],
    ['Événement de synchronisation', 'Élément de file de synchronisation hors connexion'],
  ],
  [3000, 6360],
);

h2('8.2 Nomenclatures');
table(
  ['Nomenclature', 'Valeurs'],
  [
    ['Profils utilisateurs', 'Dix-sept valeurs, cf. section 4.1'],
    ['Segments client', 'Particulier, Boutique, Détaillant, Supermarché, Entreprise, Hôtellerie-restauration'],
    ['Formats produit', 'Bidon 5 L, Bidon 10 L, Bidon 25 L, Bonbonne 19 L'],
    ['Niveaux de fidélité', 'Bronze, Argent, Or, Platine'],
    ['Statuts d’ordre de fabrication', 'Planifié, En cours, Terminé, Bloqué'],
    ['Statuts de lot', 'En production, Quarantaine, Libéré, Bloqué'],
    ['Statuts de contrôle qualité', 'En attente, Conforme, Non conforme'],
    ['Moyens de paiement', 'Espèces, Chèque, Virement, Monnaie électronique, M-Pesa, Orange Money, Airtel Money, Wave, Crédit'],
    ['Statuts de commande', 'Brouillon, Validée, En préparation, Chargée, En livraison, Livrée, Annulée'],
    ['Statuts de tournée', 'Planifiée, En chargement, En cours, Terminée, Annulée'],
    ['Statuts de livraison', 'En attente, Livrée, Refusée, Partielle'],
    ['Statuts de synchronisation', 'En attente, Synchronisé, En conflit, En échec'],
    [
      'Types d’emplacement de stock',
      'Matières premières, Production, Bidons à trier, Bidons en lavage, Bidons libérés, Produits finis, Véhicule, Quarantaine, Retraitement, Réparation, Rebut',
    ],
  ],
  [2800, 6560],
);

h2('8.3 Règles d’intégrité');
bullet('Les identifiants d’enregistrement sont des identifiants universels uniques, non séquentiels et non devinables.');
bullet('L’adresse électronique d’un utilisateur est unique dans le système.');
bullet('Les entités métier portent leurs dates de création et de dernière modification.');
bullet('Les suppressions en cascade sont limitées aux données strictement dépendantes, telles que les notifications d’un compte.');
bullet('Les soldes et cumuls sont dérivés des mouvements et ne constituent pas une saisie indépendante.');

pageBreak();

// --- 9. Architecture ---
h1('9. Architecture technique');

h2('9.1 Vue d’ensemble');
p(
  'La plateforme repose sur une architecture applicative en trois composants distincts : une interface d’administration web, ' +
    'une interface de mobilité destinée au terrain, et une interface de programmation qui centralise l’ensemble des règles métier ' +
    'et l’accès à la base de données. Aucun client n’accède directement à la base : toute opération transite par l’interface de programmation, ' +
    'garantissant l’unicité des contrôles d’habilitation et de cohérence.',
);

h2('9.2 Composants et technologies');
table(
  ['Composant', 'Technologie', 'Responsabilité'],
  [
    ['Interface de programmation', 'NestJS (Node.js, TypeScript)', 'Règles métier, habilitations, exposition des services'],
    ['Persistance', 'PostgreSQL', 'Stockage transactionnel des données de gestion'],
    ['Couche d’accès aux données', 'Prisma', 'Modélisation, migrations et requêtage typé'],
    ['Back-office web', 'React, Vite, TypeScript', 'Interface de pilotage et de saisie de gestion'],
    ['Interface terrain', 'Application web progressive', 'Exécution de tournée, y compris hors connexion'],
    ['Application mobile', 'Flutter (Android)', 'Variante native distribuable'],
    ['Authentification', 'Jeton signé JSON', 'Établissement et vérification de la session'],
    ['Documentation des services', 'Swagger / OpenAPI', 'Description exploitable des points d’entrée'],
  ],
  [2600, 2600, 4160],
);

h2('9.3 Organisation du code');
table(
  ['Emplacement', 'Contenu'],
  [
    ['backend/src', 'Modules de l’interface de programmation : authentification, clients, commandes, produits, stocks, tournées, livraisons, paiements, consignes, production et qualité, notifications, synchronisation, supervision'],
    ['backend/prisma', 'Schéma de données, migrations et jeu de données de démonstration'],
    ['backoffice/src/pages', 'Écrans fonctionnels du back-office et de l’interface terrain'],
    ['backoffice/src/components', 'Composants d’interface réutilisables et éléments de charte'],
    ['backoffice/src/permissions.ts', 'Référentiel unique de la matrice des habilitations et de la navigation'],
    ['mobile', 'Application Android native'],
  ],
  [2800, 6560],
);

h2('9.4 Fonctionnement hors connexion');
p(
  'L’interface terrain conserve localement les saisies réalisées sans réseau, puis les transmet à l’interface de programmation ' +
    'dès le rétablissement de la connectivité. Chaque saisie locale porte un identifiant propre qui permet au serveur de détecter ' +
    'les doublons de transmission et de garantir qu’une même opération n’est enregistrée qu’une seule fois. ' +
    'Les conflits éventuels sont matérialisés par un statut dédié afin d’être arbitrés et non silencieusement écrasés.',
);

pageBreak();

// --- 10. API ---
h1('10. Interfaces de programmation (API REST)');
p(
  'L’ensemble des services est exposé sous le préfixe /api/v1. Les appels, à l’exception de l’authentification et du contrôle de disponibilité, ' +
    'requièrent un jeton valide et sont soumis au contrôle des habilitations du profil appelant.',
);

h2('10.1 Authentification et disponibilité');
table(
  ['Méthode', 'Chemin', 'Objet'],
  [
    ['GET', '/health', 'Contrôle de disponibilité du service'],
    ['POST', '/auth/login', 'Ouverture de session et délivrance du jeton'],
    ['GET', '/auth/me', 'Profil et habilitations de l’utilisateur connecté'],
  ],
  [1200, 3400, 4760],
);

h2('10.2 Référentiels');
table(
  ['Méthode', 'Chemin', 'Objet'],
  [
    ['GET', '/clients', 'Liste des clients'],
    ['GET', '/clients/{id}', 'Fiche d’un client'],
    ['GET', '/clients/{id}/consignes', 'Solde et mouvements de consignes d’un client'],
    ['POST', '/clients', 'Création d’un client'],
    ['PATCH', '/clients/{id}', 'Modification d’un client'],
    ['DELETE', '/clients/{id}', 'Suppression d’un client'],
    ['GET', '/products', 'Catalogue des produits'],
    ['GET', '/products/{id}', 'Fiche d’un produit'],
    ['POST', '/products', 'Création d’un produit'],
    ['PATCH', '/products/{id}', 'Modification d’un produit'],
    ['DELETE', '/products/{id}', 'Suppression d’un produit'],
    ['GET', '/vehicles', 'Liste des véhicules'],
    ['GET', '/users', 'Liste des comptes utilisateurs'],
    ['GET', '/users/by-role', 'Comptes filtrés par profil'],
    ['POST', '/users', 'Création d’un compte'],
    ['PATCH', '/users/{id}', 'Modification d’un compte'],
  ],
  [1200, 3400, 4760],
);

h2('10.3 Cycle commercial et logistique');
table(
  ['Méthode', 'Chemin', 'Objet'],
  [
    ['GET', '/orders', 'Liste des commandes'],
    ['GET', '/orders/{id}', 'Détail d’une commande'],
    ['POST', '/orders', 'Création d’une commande'],
    ['PATCH', '/orders/{id}/validate', 'Validation d’une commande'],
    ['PATCH', '/orders/{id}/cancel', 'Annulation d’une commande'],
    ['GET', '/tours', 'Liste des tournées'],
    ['GET', '/tours/{id}', 'Détail d’une tournée'],
    ['POST', '/tours', 'Création d’une tournée'],
    ['POST', '/tours/{id}/load-sheet', 'Création d’un bordereau de chargement'],
    ['PATCH', '/tours/{id}/load-sheet/{sheetId}/validate', 'Validation d’un bordereau de chargement'],
    ['PATCH', '/tours/{id}/start', 'Départ de tournée'],
    ['PATCH', '/tours/{id}/complete', 'Clôture de tournée'],
    ['GET', '/deliveries', 'Liste des livraisons'],
    ['GET', '/deliveries/{id}', 'Détail d’une livraison'],
    ['GET', '/deliveries/tour/{tourId}/reconciliation', 'Réconciliation de retour de tournée'],
    ['POST', '/deliveries', 'Enregistrement d’une livraison'],
    ['GET', '/payments', 'Liste des encaissements'],
    ['POST', '/payments', 'Enregistrement d’un encaissement'],
    ['GET', '/consignes/client/{clientId}', 'Mouvements de consignes d’un client'],
  ],
  [1200, 3400, 4760],
);

h2('10.4 Stocks, production et qualité');
table(
  ['Méthode', 'Chemin', 'Objet'],
  [
    ['GET', '/stock/locations', 'Emplacements de stock'],
    ['GET', '/stock', 'État des stocks'],
    ['GET', '/stock/vehicle/{vehicleId}', 'Stock embarqué d’un véhicule'],
    ['POST', '/stock/adjust', 'Ajustement de stock justifié'],
    ['GET', '/emmapure/production', 'Liste des ordres de fabrication'],
    ['POST', '/emmapure/production', 'Création d’un ordre de fabrication'],
    ['PATCH', '/emmapure/production/{id}/validate', 'Clôture et libération de production'],
    ['GET', '/emmapure/quality', 'Liste des contrôles qualité'],
    ['POST', '/emmapure/quality', 'Enregistrement d’un contrôle qualité'],
    ['PATCH', '/emmapure/quality/{id}/validate', 'Validation d’un contrôle qualité'],
    ['GET', '/emmapure/packaging', 'Parc d’unités de conditionnement'],
    ['GET', '/emmapure/fountains', 'Parc d’équipements fontaines'],
  ],
  [1200, 3400, 4760],
);

h2('10.5 Commerce, personnel et pilotage');
table(
  ['Méthode', 'Chemin', 'Objet'],
  [
    ['GET', '/emmapure/loyalty', 'État du programme de fidélité'],
    ['POST', '/emmapure/loyalty/{clientId}/points', 'Attribution de points de fidélité'],
    ['GET', '/emmapure/shifts', 'Liste des vacations'],
    ['POST', '/emmapure/shifts', 'Planification d’une vacation'],
    ['GET', '/emmapure/observability', 'Indicateurs de supervision'],
    ['GET', '/dashboard/overview', 'Indicateurs du tableau de bord'],
    ['GET', '/notifications', 'Notifications de l’utilisateur connecté'],
    ['GET', '/notifications/unread-count', 'Nombre de notifications non lues'],
    ['PATCH', '/notifications/{id}/read', 'Marquage d’une notification comme lue'],
    ['PATCH', '/notifications/read-all', 'Marquage global comme lu'],
    ['POST', '/sync/push', 'Transmission des saisies hors connexion'],
    ['GET', '/sync/pull', 'Récupération des mises à jour serveur'],
  ],
  [1200, 3400, 4760],
);

pageBreak();

// --- 11. IHM ---
h1('11. Exigences d’interface et d’expérience utilisateur');

h2('11.1 Identité visuelle');
table(
  ['Réf.', 'Exigence'],
  [
    ['EX-IHM-01', 'L’interface reprend l’identité de marque EMMAS et EMMAPURE, en cohérence avec l’étiquette produit de référence.'],
    ['EX-IHM-02', 'La palette chromatique s’articule autour des bleus de la marque, associés à des neutres clairs pour la lisibilité.'],
    ['EX-IHM-03', 'La typographie et les composants sont homogènes sur l’ensemble des écrans.'],
    ['EX-IHM-04', 'Les statuts métier sont représentés par des indicateurs visuels lisibles et constants d’un écran à l’autre.'],
  ],
  [1500, 7860],
);

h2('11.2 Ergonomie et navigation');
table(
  ['Réf.', 'Exigence'],
  [
    ['EX-IHM-05', 'La navigation latérale organise les rubriques par domaine fonctionnel et se limite au périmètre autorisé.'],
    ['EX-IHM-06', 'Une barre supérieure regroupe la recherche, les actions rapides, les notifications et l’identité de l’utilisateur.'],
    ['EX-IHM-07', 'Les listes proposent tri, filtrage et recherche sur les critères métier pertinents.'],
    ['EX-IHM-08', 'Les actions destructrices font l’objet d’une confirmation explicite.'],
    ['EX-IHM-09', 'Les messages d’erreur sont explicites et orientent l’utilisateur vers la correction attendue.'],
    ['EX-IHM-10', 'L’interface est utilisable sur poste de travail, tablette et téléphone.'],
    ['EX-IHM-11', 'L’interface terrain privilégie les grandes zones de contact et la saisie en un minimum de gestes.'],
    ['EX-IHM-12', 'L’état de connectivité et le nombre de saisies en attente de synchronisation sont visibles en permanence sur le terrain.'],
  ],
  [1500, 7860],
);

h2('11.3 Données de démonstration');
p(
  'La plateforme est livrée avec un jeu de données de démonstration couvrant l’ensemble des rubriques : comptes représentatifs de chaque profil, ' +
    'catalogue des formats conditionnés, portefeuille de clients segmentés et dotés de niveaux de fidélité, commandes à différents stades, ' +
    'tournées et livraisons, encaissements multi-moyens, ordres de fabrication et contrôles qualité, vacations, parc d’emballages et de fontaines, ' +
    'ainsi que notifications initiales par profil. Ce jeu de données permet de dérouler la recette sans saisie préalable.',
);
p(
  'Les captures reproduites en annexe B ont été réalisées sur ce jeu de données de démonstration et illustrent l’état effectif ' +
    'de chaque rubrique de la plateforme.',
);

pageBreak();

// --- 12. Non fonctionnel ---
h1('12. Exigences non fonctionnelles');

h2('12.1 Performance');
table(
  ['Réf.', 'Exigence', 'Cible'],
  [
    ['ENF-PER-01', 'Temps de réponse des consultations courantes', 'Inférieur à 1 seconde en conditions nominales'],
    ['ENF-PER-02', 'Temps d’affichage du tableau de bord', 'Inférieur à 3 secondes'],
    ['ENF-PER-03', 'Pagination des listes volumineuses', 'Obligatoire au-delà de 100 enregistrements'],
    ['ENF-PER-04', 'Utilisateurs simultanés supportés', 'Au moins 50 sessions concurrentes'],
  ],
  [1600, 4160, 3600],
);

h2('12.2 Disponibilité et résilience');
table(
  ['Réf.', 'Exigence'],
  [
    ['ENF-DIS-01', 'La plateforme est disponible pendant l’intégralité des plages d’exploitation, production et distribution incluses.'],
    ['ENF-DIS-02', 'L’indisponibilité du réseau ne bloque pas l’exécution des tournées grâce au fonctionnement hors connexion.'],
    ['ENF-DIS-03', 'Un point d’entrée de contrôle de disponibilité permet la surveillance automatisée du service.'],
    ['ENF-DIS-04', 'Les données font l’objet de sauvegardes régulières dont la restauration est testée.'],
  ],
  [1600, 7760],
);

h2('12.3 Maintenabilité et évolutivité');
table(
  ['Réf.', 'Exigence'],
  [
    ['ENF-MNT-01', 'Le code est typé statiquement de bout en bout afin de détecter les régressions à la compilation.'],
    ['ENF-MNT-02', 'Les règles d’habilitation sont centralisées dans un référentiel unique et non dupliquées par écran.'],
    ['ENF-MNT-03', 'Les évolutions du schéma de données passent par des migrations versionnées et rejouables.'],
    ['ENF-MNT-04', 'L’interface de programmation est versionnée afin de préserver la compatibilité des clients déployés.'],
    ['ENF-MNT-05', 'L’ajout d’un profil ou d’une rubrique ne nécessite pas de refonte de la navigation.'],
  ],
  [1600, 7760],
);

h2('12.4 Portabilité et internationalisation');
table(
  ['Réf.', 'Exigence'],
  [
    ['ENF-POR-01', 'L’interface est intégralement en langue française.'],
    ['ENF-POR-02', 'Les montants sont exprimés dans la devise d’exploitation et les dates au format local.'],
    ['ENF-POR-03', 'La plateforme fonctionne sur les navigateurs modernes à jour, sans extension propriétaire.'],
    ['ENF-POR-04', 'L’application mobile cible les versions d’Android en support constructeur.'],
  ],
  [1600, 7760],
);

pageBreak();

// --- 13. Sécurité ---
h1('13. Sécurité, traçabilité et conformité');

h2('13.1 Sécurité applicative');
table(
  ['Réf.', 'Exigence'],
  [
    ['ESE-01', 'L’authentification repose sur un jeton signé dont la validité est limitée dans le temps.'],
    ['ESE-02', 'Les mots de passe sont stockés sous forme d’empreinte salée au moyen d’un algorithme reconnu.'],
    ['ESE-03', 'Les habilitations sont vérifiées côté serveur sur chaque point d’entrée, sans confiance accordée au client.'],
    ['ESE-04', 'Les données transitent exclusivement sur un canal chiffré en environnement de production.'],
    ['ESE-05', 'Les secrets et paramètres sensibles sont fournis par variables d’environnement et jamais versionnés.'],
    ['ESE-06', 'Les données transmises sont validées et normalisées avant traitement.'],
    ['ESE-07', 'Les messages d’erreur ne divulguent aucune information technique exploitable.'],
  ],
  [1400, 7960],
);

h2('13.2 Traçabilité');
table(
  ['Réf.', 'Exigence'],
  [
    ['ETR-01', 'Un journal d’audit enregistre les opérations sensibles avec leur auteur, leur date et leur objet.'],
    ['ETR-02', 'Les actes de validation métier, notamment la validation de commande, la libération de lot et la validation qualité, sont systématiquement journalisés.'],
    ['ETR-03', 'Les ajustements de stock et les mouvements de consignes sont justifiés par un motif conservé.'],
    ['ETR-04', 'Le journal d’audit est consultable par les profils d’administration et de supervision, et n’est pas modifiable.'],
    ['ETR-05', 'La traçabilité d’un lot permet de remonter de la livraison client jusqu’à l’ordre de fabrication et à ses contrôles qualité.'],
  ],
  [1400, 7960],
);

h2('13.3 Conformité sanitaire et données personnelles');
table(
  ['Réf.', 'Exigence'],
  [
    ['ECO-01', 'La libération d’un lot est subordonnée à un contrôle qualité conforme, sans possibilité de contournement fonctionnel.'],
    ['ECO-02', 'Le dossier de lot électronique est conservé pendant la durée requise par la réglementation applicable.'],
    ['ECO-03', 'Les procédures de lavage des emballages consignés font l’objet d’un enregistrement traçable.'],
    ['ECO-04', 'Les données personnelles collectées sont limitées au strict nécessaire à l’exécution de la relation commerciale.'],
    ['ECO-05', 'L’accès aux données personnelles est restreint aux profils dont la mission le justifie.'],
  ],
  [1400, 7960],
);

pageBreak();

// --- 14. Déploiement ---
h1('14. Environnements et déploiement');

h2('14.1 Environnements');
table(
  ['Environnement', 'Objet', 'Caractéristiques'],
  [
    ['Développement local', 'Réalisation et mise au point', 'Base de données locale, jeu de données de démonstration, rechargement à chaud'],
    ['Recette', 'Validation métier avant mise en service', 'Configuration proche de la production, données de test représentatives'],
    ['Production', 'Exploitation', 'Canal chiffré, sauvegardes, supervision et journalisation activées'],
  ],
  [2400, 2600, 4360],
);

h2('14.2 Ports et adresses de service en développement');
table(
  ['Service', 'Adresse'],
  [
    ['Interface de programmation', 'http://localhost:3000'],
    ['Documentation des services', 'http://localhost:3000/api/docs'],
    ['Back-office web', 'http://localhost:5173'],
    ['Base de données', '127.0.0.1:5432'],
  ],
  [3400, 5960],
);
p(
  'L’usage de l’adresse de bouclage numérique plutôt que du nom d’hôte est retenu pour la chaîne de connexion à la base de données, ' +
    'afin d’éviter les échecs de résolution observés sur certains postes Windows.',
);

h2('14.3 Exigences de déploiement');
table(
  ['Réf.', 'Exigence'],
  [
    ['EDE-01', 'La mise en service de l’interface de programmation et du back-office est automatisable sans intervention manuelle.'],
    ['EDE-02', 'Les migrations de base de données sont appliquées automatiquement au déploiement.'],
    ['EDE-03', 'Le paramétrage propre à chaque environnement est externalisé et ne nécessite pas de recompilation.'],
    ['EDE-04', 'La production de l’application mobile est industrialisée en intégration continue.'],
    ['EDE-05', 'Un retour à la version antérieure est possible sans perte de données.'],
  ],
  [1400, 7960],
);

pageBreak();

// --- 15. Recette ---
h1('15. Stratégie de recette et de tests');

h2('15.1 Niveaux de test');
table(
  ['Niveau', 'Objet', 'Responsable'],
  [
    ['Tests unitaires', 'Règles de gestion isolées', 'Équipe de réalisation'],
    ['Tests d’intégration', 'Points d’entrée de l’interface de programmation et accès aux données', 'Équipe de réalisation'],
    ['Tests d’habilitation', 'Conformité à la matrice des droits, profil par profil', 'Équipe de réalisation et métier'],
    ['Recette fonctionnelle', 'Scénarios métier de bout en bout', 'Référents métier'],
    ['Recette terrain', 'Exécution réelle de tournée, y compris hors connexion', 'Exploitation et livraison'],
  ],
  [2200, 4560, 2600],
);

h2('15.2 Scénarios de recette structurants');
table(
  ['Réf.', 'Scénario', 'Résultat attendu'],
  [
    ['SR-01', 'Connexion avec chacun des dix-sept profils', 'Le tableau de bord s’affiche et la navigation est limitée au périmètre du profil'],
    ['SR-02', 'Tentative d’accès direct à une rubrique non autorisée', 'Accès refusé sans divulgation d’information'],
    ['SR-03', 'Cycle complet de commande, de la création à la livraison', 'Statuts cohérents à chaque étape et indicateurs mis à jour'],
    ['SR-04', 'Production d’un lot puis contrôle qualité non conforme', 'Le lot est bloqué et sa sortie de stock est refusée'],
    ['SR-05', 'Production d’un lot puis contrôle qualité conforme', 'Le lot est libéré et devient disponible à la vente'],
    ['SR-06', 'Tournée avec livraison partielle et reprise d’emballages', 'Solde de consignes du client mis à jour et écart signalé'],
    ['SR-07', 'Saisie de livraison sans réseau puis rétablissement', 'La saisie est transmise une seule fois, sans doublon ni perte'],
    ['SR-08', 'Encaissement par monnaie électronique', 'Le moyen de paiement est distingué et rattaché à la livraison'],
    ['SR-09', 'Franchissement d’un seuil de fidélité', 'Le niveau du client évolue et une notification est émise'],
    ['SR-10', 'Franchissement d’un seuil d’alerte de stock', 'Les profils responsables reçoivent la notification correspondante'],
    ['SR-11', 'Réconciliation de retour de tournée avec écart', 'L’écart est mis en évidence et notifié à la supervision'],
    ['SR-12', 'Consultation du journal d’audit après actes de validation', 'Les opérations figurent avec leur auteur et leur horodatage'],
  ],
  [900, 3860, 4600],
);

h2('15.3 Critères d’acceptation');
bullet('Cent pour cent des scénarios structurants de la section 15.2 sont exécutés avec succès.');
bullet('Aucun défaut bloquant ni majeur ne subsiste à la clôture de la recette.');
bullet('La matrice des habilitations est vérifiée pour l’intégralité des profils et des rubriques.');
bullet('Les exigences de performance de la section 12.1 sont mesurées et atteintes.');
bullet('La documentation d’exploitation et les comptes de production sont livrés.');

pageBreak();

// --- 16. Lotissement ---
h1('16. Lotissement et trajectoire projet');

h2('16.1 Lots de livraison');
table(
  ['Lot', 'Contenu', 'Statut'],
  [
    ['Lot 1 — Distribution', 'Clients, produits, stocks, commandes, tournées, livraisons, paiements, consignes, mode hors connexion, tableau de bord', 'Réalisé'],
    ['Lot 2 — Industrialisation', 'Ordres de fabrication, lots, contrôle qualité, procédures de lavage des emballages', 'Réalisé'],
    ['Lot 3 — Entreprise', 'Fidélité, personnel et vacations, supervision, notifications par profil, matrice d’habilitation étendue', 'Réalisé'],
    ['Lot 4 — Extensions', 'Reporting avancé, commissions commerciales, gestion de flotte, interconnexions financières', 'À cadrer'],
  ],
  [2200, 5560, 1600],
);

h2('16.2 Évolutions identifiées');
bullet('Reporting analytique avancé avec exports paramétrables et tableaux de bord personnalisables par profil.');
bullet('Calcul et suivi des commissions des équipes commerciales et de livraison.');
bullet('Gestion de flotte incluant l’entretien des véhicules et la consommation de carburant.');
bullet('Interconnexion avec les opérateurs de monnaie électronique pour le rapprochement automatique des encaissements.');
bullet('Optimisation automatique des itinéraires de tournée.');
bullet('Portail client permettant la commande en autonomie et la consultation du solde de consignes.');
bullet('Notifications poussées sur les terminaux mobiles en complément des notifications applicatives.');

h2('16.3 Risques et mesures de maîtrise');
table(
  ['Risque', 'Impact', 'Mesure de maîtrise'],
  [
    ['Connectivité réseau intermittente sur le terrain', 'Perte de saisies et retard de facturation', 'Fonctionnement hors connexion avec file locale et synchronisation idempotente'],
    ['Appropriation insuffisante par les équipes terrain', 'Contournement du système et données incomplètes', 'Interface simplifiée, accompagnement et jeu de données de démonstration pour la formation'],
    ['Dérive du parc d’emballages consignés', 'Pertes financières non détectées', 'Traçabilité des mouvements, alertes de solde et inventaires périodiques'],
    ['Non-conformité qualité non détectée', 'Risque sanitaire et réputationnel', 'Libération de lot subordonnée à un contrôle conforme, sans contournement possible'],
    ['Élargissement non maîtrisé du périmètre', 'Dérive des délais et des coûts', 'Lotissement explicite et exclusions formalisées en section 3.3'],
    ['Divergence des règles d’habilitation entre modules', 'Failles d’accès', 'Référentiel unique de la matrice et contrôle systématique côté serveur'],
  ],
  [2600, 2600, 4160],
);

pageBreak();

// --- 17. Annexes ---
h1('17. Annexe A — Comptes, glossaire et versions');

h2('17.1 Comptes de démonstration');
p(
  'Le jeu de données de démonstration installe les quatorze comptes ci-dessous, qui couvrent chacun des profils de la matrice ' +
    'des habilitations. Ils partagent un mot de passe unique et sont destinés aux seuls environnements de développement et de ' +
    'recette : ils doivent être désactivés avant la mise en production.',
);
table(
  ['Adresse électronique', 'Profil'],
  [
    ['admin@emmapure.cd', 'Administrateur'],
    ['dg@emmapure.cd', 'Direction générale'],
    ['chef.prod@emmapure.cd', 'Chef production'],
    ['chef.exploit@emmapure.cd', 'Chef exploitation'],
    ['qualite@emmapure.cd', 'Responsable qualité'],
    ['magasinier@emmapure.cd', 'Magasinier'],
    ['commercial@emmapure.cd', 'Commercial'],
    ['caissier@emmapure.cd', 'Caissier'],
    ['comptable@emmapure.cd', 'Comptable'],
    ['rh@emmapure.cd', 'Ressources humaines'],
    ['superviseur@emmapure.cd', 'Superviseur'],
    ['livreur@emmapure.cd', 'Chargé de livraison'],
    ['admin@emmapp.cd', 'Administrateur (compte de compatibilité)'],
    ['livreur@emmapp.cd', 'Livreur (compte de compatibilité)'],
  ],
  [4200, 5160],
);

h2('17.2 Glossaire');
table(
  ['Terme', 'Définition'],
  [
    ['Bonbonne', 'Emballage réutilisable de grande contenance, généralement 19 litres, destiné aux fontaines à eau.'],
    ['Bordereau de chargement', 'Document récapitulant les quantités confiées à un véhicule avant le départ en tournée.'],
    ['Consigne', 'Montant garantissant le retour d’un emballage réutilisable, distinct du prix du contenu.'],
    ['Contrôle libératoire', 'Contrôle qualité dont le résultat conditionne l’autorisation de mise à la vente d’un lot.'],
    ['Lot', 'Ensemble d’unités produites dans des conditions homogènes, identifié pour permettre la traçabilité.'],
    ['Mode hors connexion', 'Capacité de l’application à fonctionner sans réseau, avec synchronisation différée.'],
    ['Ordre de fabrication', 'Instruction de production précisant le produit, la quantité et le lot à produire.'],
    ['Polyvalence', 'Aptitude d’un collaborateur à occuper plusieurs types de postes.'],
    ['Quarantaine', 'État d’un lot produit non encore libéré par le contrôle qualité et donc non commercialisable.'],
    ['Réconciliation de tournée', 'Rapprochement entre les quantités chargées, livrées, retournées et encaissées.'],
    ['Segment client', 'Catégorie commerciale d’un client, déterminant notamment sa politique tarifaire.'],
    ['Synchronisation idempotente', 'Mécanisme garantissant qu’une même opération transmise plusieurs fois n’est enregistrée qu’une fois.'],
    ['Vacation', 'Affectation d’un collaborateur à un poste sur une plage horaire déterminée.'],
  ],
  [2600, 6760],
);

h2('17.3 Suivi des versions du document');
table(
  ['Version', 'Date', 'Nature de la révision'],
  [
    ['1.0', '—', 'Cahier des charges initial, périmètre distribution'],
    ['2.0', '—', 'Extension au périmètre production et qualité'],
    [
      '2.1',
      new Date().toLocaleDateString('fr-FR'),
      'Version Enterprise optimisée : dix-sept profils, matrice d’habilitation complète, notifications par profil, fidélité, personnel, supervision, refonte de l’interface',
    ],
  ],
  [1200, 1800, 6360],
);

pageBreak();

// --- 18. Annexe B : captures ---
h1('18. Annexe B — Captures des interfaces');
p(
  'Les captures suivantes ont été réalisées sur la plateforme en fonctionnement, alimentée par le jeu de données de démonstration. ' +
    'Elles constituent la référence visuelle du produit livré et servent de support aux exigences d’interface énoncées au chapitre 11. ' +
    'Sauf mention contraire, la session est ouverte avec le profil Administrateur, qui donne accès à l’ensemble des rubriques.',
);

h2('18.1 Accès et pilotage');
figure('emma-01-login.png', 'Écran de connexion — identité EMMAS et sélection rapide des profils de démonstration.');
figure(
  'emma-02-dashboard.png',
  'Tableau de bord affiché immédiatement après connexion : indicateurs financiers, commandes du jour, alertes de tournée, stocks et supervision.',
);
figure(
  'emma-19-roles.png',
  'Même tableau de bord ouvert par un profil Caissier : le menu latéral est réduit à ses rubriques et les panneaux hors périmètre sont omis, sans dégrader l’écran.',
);
figure(
  'emma-17-observability.png',
  'Supervision — état des services, synchronisations en attente, lots bloqués et contrôles qualité ouverts.',
);

h2('18.2 Référentiels et cycle commercial');
figure('emma-03-clients.png', 'Référentiel clients — code, segment, zone de distribution et solde de consignes.');
figure('emma-05-products.png', 'Catalogue produits — formats conditionnés, tarifs et caractère réutilisable de l’emballage.');
figure('emma-04-orders.png', 'Commandes — historique et statuts du cycle de vie.');
figure('emma-13-loyalty.png', 'Fidélité — points cumulés et niveau atteint par client.');

h2('18.3 Production et qualité');
figure(
  'emma-06-production.png',
  'Ordres de fabrication — création d’un ordre, numérotation des lots, quantités planifiées et produites, statut de lot et action de libération.',
);
figure(
  'emma-07-quality.png',
  'Contrôle qualité — saisie des paramètres physico-chimiques et décision de conformité conditionnant la libération du lot.',
);
figure('emma-08-stock.png', 'Stocks — inventaire par produit, emplacement et lot.');

h2('18.4 Distribution et terrain');
figure('emma-09-tours.png', 'Tournées — planification par zone, affectation du livreur et du véhicule.');
figure('emma-11-deliveries.png', 'Livraisons — historique et statuts, dont les livraisons partielles.');
figure('emma-12-consignes.png', 'Consignes circulaires — rotations restantes par emballage et parc de fontaines.');
figure(
  'emma-18-mobile.png',
  'Interface terrain sur téléphone — tournée assignée au livreur, commandes à livrer et démarrage de tournée.',
  { maxWidthCm: 8, maxHeightCm: 13 },
);

h2('18.5 Finance, personnel et administration');
figure(
  'emma-10-payments.png',
  'Encaissements — registre multi-moyens intégrant les paiements par monnaie électronique (M-Pesa, Orange Money, Airtel Money).',
);
figure('emma-14-hr.png', 'Personnel — planification des vacations par poste et suivi de validation.');
figure('emma-15-users.png', 'Utilisateurs — comptes, profils d’habilitation et état d’activation.');
figure('emma-16-notifications.png', 'Notifications — messages typés et catégorisés selon le profil connecté.');

// ============================================================================
// ASSEMBLAGE DU FICHIER .docx
// ============================================================================

const sectPr =
  '<w:sectPr>' +
  '<w:footerReference w:type="default" r:id="rIdFooter"/>' +
  '<w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1276" w:right="1134" w:bottom="1276" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>' +
  '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/>' +
  '</w:sectPr>';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${body.join('')}${sectPr}</w:body></w:document>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="fr-FR"/>
</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>
<w:spacing w:after="140" w:line="264" w:lineRule="auto"/><w:jc w:val="both"/>
</w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:before="360" w:after="180"/><w:jc w:val="left"/>
<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="0E6BA8"/></w:pBdr></w:pPr>
<w:rPr><w:b/><w:color w:val="0E6BA8"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="280" w:after="120"/><w:jc w:val="left"/></w:pPr>
<w:rPr><w:b/><w:color w:val="115E86"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:outlineLvl w:val="2"/><w:spacing w:before="220" w:after="100"/><w:jc w:val="left"/></w:pPr>
<w:rPr><w:b/><w:color w:val="2E4756"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:ind w:left="425"/><w:contextualSpacing/><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/>
<w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="7A8A96"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="GrilleTableau"><w:name w:val="Table Grid"/>
<w:tblPr><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>
</w:style>
</w:styles>`;

const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${NS}>
<w:abstractNum w:abstractNumId="0">
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="425" w:hanging="283"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>
<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#9702;"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="850" w:hanging="283"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:hint="default"/></w:rPr></w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>
<w:r><w:t xml:space="preserve">EMMAPURE — Cahier des charges v2.1 — Document interne — Page </w:t></w:r>
<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>
</w:p></w:ftr>`;

const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${NS}><w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/>
<w:themeFontLang w:val="fr-FR"/></w:settings>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
${media
  .map(
    (m) =>
      `<Relationship Id="${m.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.zipPath.replace('word/', '')}"/>`,
  )
  .join('\n')}
</Relationships>`;

const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Cahier des charges EMMAPURE v2.1</dc:title>
<dc:subject>ERP/CRM de production et distribution d'eau potable</dc:subject>
<dc:creator>EMMAPURE</dc:creator>
<cp:lastModifiedBy>EMMAPURE</cp:lastModifiedBy>
<cp:revision>1</cp:revision>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
<cp:keywords>EMMAPURE, EMMAS, ERP, CRM, eau potable, cahier des charges</cp:keywords>
</cp:coreProperties>`;

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>EMMAPURE Docgen</Application><Company>EMMAPURE</Company>
</Properties>`;

const files = {
  '[Content_Types].xml': contentTypes,
  '_rels/.rels': rootRels,
  'word/document.xml': documentXml,
  'word/styles.xml': stylesXml,
  'word/numbering.xml': numberingXml,
  'word/settings.xml': settingsXml,
  'word/footer1.xml': footerXml,
  'word/_rels/document.xml.rels': docRels,
  'docProps/core.xml': coreXml,
  'docProps/app.xml': appXml,
};

if (existsSync(BUILD)) rmSync(BUILD, { recursive: true, force: true });
for (const [rel, content] of Object.entries(files)) {
  const target = join(BUILD, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}
for (const m of media) {
  const target = join(BUILD, m.zipPath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(m.srcPath, target);
}

mkdirSync(join(ROOT, 'docs'), { recursive: true });
if (existsSync(OUT)) rmSync(OUT);

// Zip via .NET, avec des noms d'entrées explicites : Word exige des séparateurs "/"
// et attend [Content_Types].xml en première entrée de l'archive.
const entries = [...Object.keys(files), ...media.map((m) => m.zipPath)]
  .map((rel) => `@{ Name = '${rel}'; Path = '${join(BUILD, rel).replace(/'/g, "''")}' }`)
  .join(',');
const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$entries = @(${entries})
$zip = [System.IO.Compression.ZipFile]::Open('${OUT.replace(/'/g, "''")}', 'Create')
try {
  foreach ($e in $entries) {
    $entry = $zip.CreateEntry($e.Name, [System.IO.Compression.CompressionLevel]::Optimal)
    $out = $entry.Open()
    try {
      $bytes = [System.IO.File]::ReadAllBytes($e.Path)
      $out.Write($bytes, 0, $bytes.Length)
    } finally { $out.Dispose() }
  }
} finally { $zip.Dispose() }
`;
execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
rmSync(BUILD, { recursive: true, force: true });

console.log(`Document généré : ${OUT}`);
