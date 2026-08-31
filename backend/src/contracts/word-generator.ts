import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

export type ContractDocKind = 'AGENT' | 'SUPPLIER' | 'KEY_CLIENT';

const NAVY = '1F4E79';
const MUTED = '555555';

const COMPANY = {
  name: 'EMMANUEL SERVICES SARLU',
  tagline: 'Production et distribution d\'eau potable',
  address: 'Kinshasa, Bandalungwa, RDC',
  phone: '+243 813 170 215',
  email: 'contact@emmas.cd',
  legal: 'RCCM KNG/RCCM/24-B-02180 · IMPOT A2425053J · ID NAT 01-F4300-N64238H',
  rccm: 'KNG/RCCM/24-B-02180',
  nif: 'A2425053J',
  idnat: '01-F4300-N64238H',
  form: 'société à responsabilité limitée unipersonnelle de droit congolais',
};

export const CONTRACT_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: 'reference', label: 'Référence contrat' },
  { key: 'title', label: 'Intitulé' },
  { key: 'kind', label: 'Type de contrat' },
  { key: 'status', label: 'Statut' },
  { key: 'partyKind', label: 'Nature de la partie' },
  { key: 'partyName', label: 'Nom de la partie' },
  { key: 'partyCode', label: 'Code / matricule' },
  { key: 'partyPhone', label: 'Téléphone' },
  { key: 'partyEmail', label: 'E-mail' },
  { key: 'startDate', label: 'Date de début' },
  { key: 'endDate', label: 'Date de fin' },
  { key: 'noticeDays', label: 'Préavis (jours)' },
  { key: 'autoRenew', label: 'Reconduction tacite' },
  { key: 'amount', label: 'Montant' },
  { key: 'currency', label: 'Devise' },
  { key: 'paymentTerms', label: 'Conditions de paiement' },
  { key: 'billingCycle', label: 'Cycle de facturation' },
  { key: 'volume', label: 'Engagement volume' },
  { key: 'territory', label: 'Territoire' },
  { key: 'exclusivity', label: 'Exclusivité' },
  { key: 'clauses', label: 'Clauses' },
  { key: 'notes', label: 'Notes' },
  { key: 'signedByParty', label: 'Signataire partie' },
  { key: 'signedByCompany', label: 'Signataire société' },
  { key: 'companyName', label: 'Raison sociale' },
  { key: 'companyAddress', label: 'Adresse société' },
  { key: 'companyLegal', label: 'Mentions légales' },
  { key: 'companyPhone', label: 'Téléphone société' },
  { key: 'companyEmail', label: 'E-mail société' },
  { key: 'today', label: 'Date du jour' },
  { key: 'jobTitle', label: 'Poste (agent)' },
  { key: 'department', label: 'Service (agent)' },
  { key: 'agentRole', label: 'Profil / rôle agent' },
];

export type AgentTemplateOpts = {
  agentKind?: string;
  role?: string;
  jobLabel?: string;
  department?: string;
  missions?: string[];
};

export function fillPlaceholders(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

type Article = { num: string; title: string; paragraphs: string[] };

function v(vars: Record<string, string>, key: string, fallback = 'à convenir'): string {
  const s = (vars[key] ?? '').trim();
  return s || fallback;
}

function articlesToText(articles: Article[]): string {
  return articles
    .map((a) => `ARTICLE ${a.num} - ${a.title}\n\n${a.paragraphs.join('\n\n')}`)
    .join('\n\n');
}

export function defaultContractTemplateBody(kind: ContractDocKind, opts?: AgentTemplateOpts): string {
  const vars = Object.fromEntries(CONTRACT_PLACEHOLDERS.map((p) => [p.key, `{{${p.key}}}`]));
  if (opts?.jobLabel) vars.jobTitle = vars.jobTitle || opts.jobLabel;
  if (opts?.department) vars.department = vars.department || opts.department;
  if (opts?.role) vars.agentRole = vars.agentRole || opts.role;
  if (opts?.agentKind) vars.kind = vars.kind || opts.agentKind;
  return articlesToText(defaultArticles(kind, vars, opts));
}

export function defaultArticles(kind: ContractDocKind, vars: Record<string, string>, opts?: AgentTemplateOpts): Article[] {
  if (kind === 'SUPPLIER') return supplierArticles(vars);
  if (kind === 'KEY_CLIENT') return clientArticles(vars);
  if ((opts?.agentKind ?? vars.kind) === 'PRESTATION') return prestationArticles(vars, opts);
  return employmentArticles(vars, opts);
}

function employmentArticles(vars: Record<string, string>, opts?: AgentTemplateOpts): Article[] {
  const company = v(vars, 'companyName', COMPANY.name);
  const worker = v(vars, 'partyName', 'le Travailleur');
  const job = v(vars, 'jobTitle', opts?.jobLabel || 'le poste convenu');
  const dept = v(vars, 'department', opts?.department || 'le service d\'affectation');
  const start = v(vars, 'startDate');
  const amount = v(vars, 'amount');
  const notice = v(vars, 'noticeDays', '30');
  const pay = v(vars, 'paymentTerms', 'mensuellement, à terme échu');
  const agentKind = (opts?.agentKind ?? vars.kind ?? 'CDI').toUpperCase();
  const missions = opts?.missions?.filter(Boolean) ?? [];
  return [
    {
      num: '1',
      title: 'Objet',
      paragraphs: [
        `Le présent contrat a pour objet de définir les conditions d'engagement de ${worker} par ${company}, en qualité de ${job}, rattaché(e) au service ${dept}.`,
        'Il constitue le cadre unique des relations de travail entre les parties, sous réserve des dispositions impératives du Code du travail de la République Démocratique du Congo, des conventions applicables et du règlement intérieur de l\'Employeur.',
      ],
    },
    {
      num: '2',
      title: 'Engagement, classification et missions',
      paragraphs: [
        `L'Employeur engage le Travailleur, qui accepte, pour exercer les fonctions de ${job}${opts?.role ? ` (profil ${opts.role})` : ''}. Le Travailleur reconnaît avoir reçu une description de poste et s'engage à l'exécuter avec diligence, loyauté et professionnalisme.`,
        'La classification, le service d\'affectation et le lieu habituel de travail peuvent être adaptés selon les besoins de l\'exploitation, sans que cela constitue une modification substantielle du contrat dès lors que la rémunération et la qualification principale sont maintenues.',
        ...missions,
      ],
    },
    {
      num: '3',
      title: 'Lieu de travail',
      paragraphs: [
        `Le lieu habituel de travail est situé à ${v(vars, 'companyAddress', COMPANY.address)}, ainsi que tout site, tournée, dépôt, point de vente ou client desservi par l'Employeur sur le territoire de ${v(vars, 'territory', 'Kinshasa')}.`,
        'Le Travailleur accepte les déplacements professionnels nécessaires à l\'exécution de sa mission, notamment les tournées de livraison, les interventions qualité et les formations internes.',
      ],
    },
    {
      num: '4',
      title: 'Durée et prise d\'effet',
      paragraphs: durationParagraphs(agentKind, start, vars.endDate),
    },
    {
      num: '5',
      title: agentKind === 'STAGE' ? 'Statut du stagiaire' : agentKind === 'JOURNALIER' ? 'Exécution à la journée' : 'Période d\'essai',
      paragraphs: trialParagraphs(agentKind),
    },
    {
      num: '6',
      title: 'Durée du travail et horaires',
      paragraphs: [
        'La durée du travail est celle en vigueur dans l\'entreprise, conformément à la législation du travail et aux besoins de la production, du conditionnement et de la distribution d\'eau potable.',
        'Des heures supplémentaires, un travail de nuit, un weekend ou un jour férié peuvent être demandés selon l\'activité. Ils sont compensés ou rémunérés selon la loi et la politique interne. Le Travailleur s\'engage à pointer, le cas échéant, et à respecter les plannings de tournée.',
      ],
    },
    {
      num: '7',
      title: agentKind === 'STAGE' ? 'Indemnité de stage' : 'Rémunération',
      paragraphs: payParagraphs(agentKind, amount, pay),
    },
    {
      num: '8',
      title: 'Protection sociale',
      paragraphs: [
        'L\'Employeur procède à l\'affiliation du Travailleur aux organismes sociaux applicables, notamment la CNSS, dans les délais légaux, et verse les cotisations patronales correspondantes.',
        'Le Travailleur communique sans délai tout changement d\'état civil, d\'adresse ou de personnes à charge. Il se soumet aux visites médicales d\'embauche et périodiques exigées par l\'activité.',
      ],
    },
    {
      num: '9',
      title: 'Obligations du Travailleur',
      paragraphs: [
        'Le Travailleur s\'engage à exécuter personnellement sa prestation, à respecter les instructions de sa hiérarchie, le règlement intérieur, les consignes d\'hygiène, de sécurité, de traçabilité et de qualité (HACCP), ainsi que les règles de conduite et de représentation de la marque.',
        'Il interdit toute consommation, détournement, revente non autorisée de produits, tout usage personnel des véhicules ou emballages, et toute atteinte à l\'image de l\'Employeur. Les manquements graves (vol, fraude, alcool au volant, falsification de documents, violence) peuvent justifier une rupture pour faute lourde.',
      ],
    },
    {
      num: '10',
      title: 'Obligations de l\'Employeur',
      paragraphs: [
        'L\'Employeur fournit le travail, les moyens nécessaires, verse la rémunération aux échéances convenues et veille à des conditions de travail respectueuses de la santé et de la sécurité.',
        'Il assure l\'information du Travailleur sur les procédures qualité, les équipements de protection et les règles de livraison. Il traite les données personnelles du dossier RH de manière confidentielle.',
      ],
    },
    {
      num: '11',
      title: 'Hygiène, sécurité et qualité de l\'eau',
      paragraphs: [
        'Compte tenu de l\'activité de production et de distribution d\'eau potable, le Travailleur applique strictement les protocoles de lavage des mains, de manipulation des bonbonnes, de non-contamination des lots et de signalement immédiat de tout incident (casse, fuite, réclamation client, anomalie de goût ou d\'odeur).',
        'Tout lot non conforme doit être isolé et signalé. Aucun produit non libéré par le contrôle qualité ne peut être commercialisé ou livré.',
      ],
    },
    {
      num: '12',
      title: 'Confidentialité',
      paragraphs: [
        'Le Travailleur s\'interdit de divulguer, pendant le contrat et cinq (5) ans après sa cessation, les informations confidentielles de l\'Employeur : clientèle, prix, tournées, recettes, procédures, fichiers, mots de passe, données RH ou commerciales.',
        'Les documents, téléphones, terminaux et identifiants restent la propriété de l\'Employeur et sont restitués le jour de la sortie.',
      ],
    },
    {
      num: '13',
      title: 'Matériel, véhicules et consignes',
      paragraphs: [
        'Les véhicules, téléphones, bonbonnes, bidons, outillage et équipements confiés sont utilisés exclusivement pour le service. Le Travailleur en a la garde et signale toute avarie. Les pertes, casses ou manquants imputables à une négligence grave peuvent donner lieu à retenue dans les limites légales.',
        'Les emballages consignés restent la propriété de l\'Employeur. Leur suivi (sorties, retours, manquants) fait partie des obligations du poste lorsque la fonction l\'implique.',
      ],
    },
    {
      num: '14',
      title: 'Congés et absences',
      paragraphs: [
        'Le Travailleur bénéficie des congés payés et repos conformément à la loi. Toute absence est justifiée dans les 48 heures. Une absence non justifiée constitue une faute pouvant entraîner des sanctions disciplinaires.',
        'Les demandes de congé sont adressées à la hiérarchie selon le planning d\'exploitation, afin de ne pas interrompre les tournées ni la production.',
      ],
    },
    {
      num: '15',
      title: 'Discipline et sanctions',
      paragraphs: [
        'En cas de manquement, l\'Employeur peut prononcer un avertissement, une mise à pied conservatoire ou une rupture, après entretien préalable lorsque la loi l\'exige. La proportionnalité est appréciée au regard de la faute, de l\'ancienneté et des conséquences sur la sécurité alimentaire.',
        'Le Travailleur peut consigner ses observations par écrit. Les sanctions sont versées au dossier.',
      ],
    },
    {
      num: '16',
      title: 'Rupture et préavis',
      paragraphs: [
        `Hors faute grave ou lourde et hors cas légaux de rupture immédiate, la partie qui entend rompre le contrat notifie sa décision par écrit avec un préavis de ${notice} jours.`,
        'À la sortie, un solde de tout compte, un certificat de travail et les documents sociaux sont établis. Le Travailleur restitue immédiatement le matériel, les clés, les badges et les documents.',
      ],
    },
    {
      num: '17',
      title: 'Modification du contrat',
      paragraphs: [
        'Toute modification substantielle (rémunération de base, qualification principale, durée) fait l\'objet d\'un avenant écrit. Les ajustements d\'organisation, d\'horaires ou de zone de tournée liés à l\'exploitation ne constituent pas, à eux seuls, une modification substantielle.',
      ],
    },
    {
      num: '18',
      title: 'Droit applicable et litiges',
      paragraphs: [
        'Le présent contrat est régi par le droit de la République Démocratique du Congo. Les parties s\'efforcent de régler tout différend à l\'amiable, le cas échéant par conciliation interne.',
        'À défaut, les juridictions compétentes de Kinshasa sont seules saisies, sans préjudice des compétences de l\'inspection du travail.',
      ],
    },
    {
      num: '19',
      title: 'Dispositions finales',
      paragraphs: [
        'Si une clause est déclarée nulle, les autres demeurent. Le présent contrat annule et remplace tout accord antérieur portant sur le même objet. Les annexes (fiche de poste, règlement intérieur, barème de consigne, politique qualité) font partie intégrante du contrat dès remise au Travailleur.',
        'Le contrat est établi en deux (2) exemplaires originaux. Chaque partie reconnaît avoir lu, compris et accepté l\'ensemble des articles.',
      ],
    },
  ];
}

function durationParagraphs(agentKind: string, start: string, endDate?: string): string[] {
  if (agentKind === 'CDD') {
    return [
      `Le présent contrat est conclu à durée déterminée. Il prend effet le ${start} et expire le ${endDate?.trim() || '{{endDate}}'}, sans reconduction au-delà de ce que la loi autorise, sauf avenant écrit.`,
      'Il ne peut être rompu avant terme que pour faute grave, force majeure ou accord écrit des deux parties. Toute poursuite de l\'activité au-delà du terme sans avenant peut, selon la loi, emporter requalification.',
    ];
  }
  if (agentKind === 'STAGE') {
    return [
      `La présente convention de stage prend effet le ${start} et s'achève le ${endDate?.trim() || '{{endDate}}'}. Elle n'emporte pas contrat de travail, sauf requalification prévue par la loi.`,
      'Le stagiaire reste sous la responsabilité pédagogique de son établissement, le cas échéant, et sous l\'autorité fonctionnelle de l\'Employeur pendant le temps de présence en entreprise.',
    ];
  }
  if (agentKind === 'JOURNALIER') {
    return [
      `Le présent contrat est conclu à la journée. Il prend effet le ${start}. Chaque journée travaillée donne lieu à un décompte. L'absence de nouvelle journée n'ouvre pas droit à préavis, hors dispositions légales impératives.`,
      'La répétition de journées successives peut, selon la loi, emporter requalification en contrat à durée indéterminée. L\'Employeur tient un registre des journées effectuées.',
    ];
  }
  return [
    `Le présent contrat est conclu pour une durée indéterminée (CDI). Il prend effet le ${start}.`,
    'Toute période antérieure accomplie à titre d\'essai, de stage ou de contrat temporaire auprès de l\'Employeur est rappelée pour mémoire et n\'emporte pas reprise d\'ancienneté au-delà de ce que la loi prévoit.',
  ];
}

function trialParagraphs(agentKind: string): string[] {
  if (agentKind === 'STAGE') {
    return [
      'Le stagiaire n\'est pas soumis à une période d\'essai de contrat de travail. La convention peut être rompue par écrit, de part et d\'autre, en cas de manquement grave aux consignes de sécurité, d\'hygiène ou de confidentialité, ou d\'inadéquation manifeste.',
      'Un tuteur interne est désigné. Le stagiaire suit les mêmes règles de présence, d\'hygiène et de confidentialité que le personnel, dans la limite de sa mission d\'apprentissage.',
    ];
  }
  if (agentKind === 'JOURNALIER') {
    return [
      'Chaque journée constitue l\'unité d\'exécution. L\'aptitude est vérifiée à l\'embauche (identité, visite médicale si exigée, consignes de sécurité). L\'Employeur peut ne pas reconduire la journée suivante sans indemnité, hors abus.',
      'Le journalier se présente à l\'heure convenue, équipé le cas échéant, et pointe selon les règles du dépôt ou de la tournée.',
    ];
  }
  if (agentKind === 'CDD') {
    return [
      'Sauf stipulation contraire, une période d\'essai de quinze (15) jours est applicable, non renouvelable au-delà des limites légales. Durant cette période, chacune des parties peut rompre le contrat sans indemnité, sous réserve du préavis d\'usage.',
      'L\'essai vérifie l\'aptitude professionnelle, notamment en matière de sécurité, d\'hygiène et d\'exécution de la mission confiée.',
    ];
  }
  return [
    'Sauf stipulation particulière contraire, une période d\'essai d\'un (1) mois est applicable, renouvelable une fois dans les limites légales. Durant cette période, chacune des parties peut rompre le contrat sans indemnité, sous réserve du préavis d\'usage.',
    'L\'essai a pour objet de vérifier l\'aptitude professionnelle du Travailleur et l\'adéquation du poste à ses compétences, notamment en matière de sécurité, d\'hygiène et de conduite des tournées.',
  ];
}

function payParagraphs(agentKind: string, amount: string, pay: string): string[] {
  if (agentKind === 'STAGE') {
    return [
      `Le stagiaire perçoit une indemnité de ${amount}, versée ${pay}. Cette indemnité n'a pas le caractère d'un salaire, sous réserve des seuils légaux de requalification.`,
      'Les frais de mission dûment autorisés peuvent être remboursés sur justificatifs. Aucune commission n\'est due sauf avenant.',
    ];
  }
  if (agentKind === 'JOURNALIER') {
    return [
      `Le journalier perçoit une rémunération journalière de ${amount}, payable ${pay || 'en fin de journée ou selon décompte hebdomadaire'}, après les retenues légales le cas échéant.`,
      'Les heures au-delà de la journée normale sont compensées selon la loi. Un décompte signé fait foi des journées prestées.',
    ];
  }
  return [
    `En contrepartie de son travail, le Travailleur perçoit une rémunération de ${amount}, payable ${pay}, après les retenues légales (impôt, cotisations sociales et autres retenues autorisées).`,
    'Des primes, indemnités de transport, commissions ou avantages en nature peuvent s\'ajouter selon les barèmes internes. Ils n\'ont pas de caractère automatique s\'ils ne sont pas expressément prévus. Un bulletin de paie est remis à chaque échéance.',
  ];
}

function prestationArticles(vars: Record<string, string>, opts?: AgentTemplateOpts): Article[] {
  const company = v(vars, 'companyName', COMPANY.name);
  const party = v(vars, 'partyName', 'le Prestataire');
  const job = v(vars, 'jobTitle', opts?.jobLabel || 'la mission convenue');
  const start = v(vars, 'startDate');
  const end = v(vars, 'endDate', 'terme à convenir');
  const amount = v(vars, 'amount');
  const pay = v(vars, 'paymentTerms', 'sur facture, à trente (30) jours');
  const missions = opts?.missions?.filter(Boolean) ?? [];
  return [
    {
      num: '1',
      title: 'Objet',
      paragraphs: [
        `Le présent contrat a pour objet la réalisation, par ${party}, d'une prestation indépendante de ${job} au profit de ${company}.`,
        'Le Prestataire n\'est pas lié par un contrat de travail. Il organise librement son temps, sous réserve des échéances et des consignes de sécurité, d\'hygiène et de confidentialité liées à l\'eau potable.',
        ...missions,
      ],
    },
    {
      num: '2',
      title: 'Durée',
      paragraphs: [
        `La mission prend effet le ${start} et s'achève le ${end}, sauf résiliation anticipée selon l'article 8.`,
      ],
    },
    {
      num: '3',
      title: 'Obligations du Prestataire',
      paragraphs: [
        'Le Prestataire exécute la mission avec diligence, selon les règles de l\'art, et remet les livrables convenus. Il déclare être en règle au plan fiscal et social.',
        'Il s\'interdit tout conflit d\'intérêts, toute divulgation des données clients, tournées, prix ou recettes, et toute utilisation des marques hors mission.',
      ],
    },
    {
      num: '4',
      title: 'Obligations de la société',
      paragraphs: [
        `${company} fournit les informations et accès nécessaires à la mission et paie les honoraires aux échéances convenues.`,
      ],
    },
    {
      num: '5',
      title: 'Honoraires',
      paragraphs: [
        `Les honoraires s'élèvent à ${amount}, payables ${pay}. Ils s'entendent hors taxes applicables. Aucun remboursement de frais n'est dû sans accord préalable écrit.`,
      ],
    },
    {
      num: '6',
      title: 'Confidentialité et propriété',
      paragraphs: [
        'Les livrables, fichiers et procédés réalisés pour la mission deviennent la propriété de la société dès paiement. Le Prestataire conserve ses outils génériques antérieurs.',
        'La confidentialité survit trois (3) ans après la fin de la mission.',
      ],
    },
    {
      num: '7',
      title: 'Responsabilité',
      paragraphs: [
        'Le Prestataire est responsable des dommages causés par sa faute. Il justifie d\'une assurance professionnelle adaptée, le cas échéant.',
      ],
    },
    {
      num: '8',
      title: 'Résiliation et litiges',
      paragraphs: [
        `Chaque partie peut résilier sous préavis de ${v(vars, 'noticeDays', '15')} jours, ou immédiatement en cas de manquement grave. Le droit congolais s'applique. Les tribunaux de Kinshasa sont compétents.`,
      ],
    },
  ];
}

function supplierArticles(vars: Record<string, string>): Article[] {
  const buyer = v(vars, 'companyName', COMPANY.name);
  const supplier = v(vars, 'partyName', 'le Fournisseur');
  const start = v(vars, 'startDate');
  const end = v(vars, 'endDate', 'terme à convenir');
  const amount = v(vars, 'amount');
  const pay = v(vars, 'paymentTerms', 'trente (30) jours date de facture');
  const cycle = v(vars, 'billingCycle', 'mensuel');
  const territory = v(vars, 'territory', 'Kinshasa');
  const notice = v(vars, 'noticeDays', '30');
  const renew = v(vars, 'autoRenew', 'non');
  return [
    {
      num: '1',
      title: 'Objet',
      paragraphs: [
        `Le présent contrat cadre a pour objet de définir les conditions dans lesquelles ${supplier} fournit à ${buyer} les biens, matières, emballages, pièces, réactifs ou services nécessaires à la production, au conditionnement et à la distribution d'eau potable.`,
        'Les commandes particulières (bons de commande, appels de livraison) précisent les quantités, références, délais et lieux. Elles s\'exécutent conformément au présent cadre, qui prévaut sur les conditions générales du Fournisseur, sauf avenant écrit.',
      ],
    },
    {
      num: '2',
      title: 'Définitions',
      paragraphs: [
        'On entend par « Produits » les biens ou prestations décrits dans les commandes ; par « Non-conformité » tout écart aux spécifications, normes, échantillons agréés ou à la réglementation applicable ; par « Site » l\'usine, le dépôt ou tout lieu désigné par l\'Acheteur à Kinshasa.',
      ],
    },
    {
      num: '3',
      title: 'Durée',
      paragraphs: [
        `Le contrat prend effet le ${start} et expire le ${end}, sauf reconduction. La reconduction tacite est : ${renew}. En cas de reconduction, les conditions restent applicables par périodes successives d'un (1) an, sauf dénonciation dans le préavis prévu à l'article 14.`,
      ],
    },
    {
      num: '4',
      title: 'Périmètre et territoire',
      paragraphs: [
        `Les fournitures sont destinées aux besoins de l'Acheteur sur le territoire de ${territory}. Le Fournisseur ne cède pas le contrat sans accord préalable écrit. Les sous-traitants restent sous son entière responsabilité.`,
      ],
    },
    {
      num: '5',
      title: 'Commandes et délais',
      paragraphs: [
        'Chaque commande indique la référence, la quantité, le prix unitaire, le délai et le lieu de livraison. Le Fournisseur accuse réception sous quarante-huit (48) heures. Le silence au-delà de ce délai vaut acceptation.',
        'Les délais sont de rigueur. Tout retard prévisible est signalé immédiatement. L\'Acheteur peut refuser une livraison hors délai, appliquer des pénalités ou s\'approvisionner ailleurs aux frais du Fournisseur après mise en demeure restée infructueuse.',
      ],
    },
    {
      num: '6',
      title: 'Qualité, conformité et traçabilité',
      paragraphs: [
        'Les Produits sont neufs, marchands, conformes aux spécifications et, le cas échéant, aux exigences alimentaires, d\'hygiène et de contact avec l\'eau potable. Le Fournisseur fournit les certificats d\'analyse, fiches techniques et traces de lot demandés.',
        'L\'Acheteur peut inspecter, prélever et refuser les lots non conformes. Les Produits refusés sont repris à la charge du Fournisseur. Un plan d\'actions correctives est communiqué sous cinq (5) jours ouvrés.',
      ],
    },
    {
      num: '7',
      title: 'Livraison, transfert des risques et emballage',
      paragraphs: [
        'Sauf stipulation contraire, la livraison s\'effectue aux sites de l\'Acheteur, dûment déchargée, avec bon de livraison signé. Les risques sont transférés après réception qualitative.',
        'Les emballages, palettes et contenants consignés restent identifiés. Les manquants sont facturés selon le barème communiqué. Le Fournisseur assure un conditionnement protégeant les Produits jusqu\'à l\'utilisation.',
      ],
    },
    {
      num: '8',
      title: 'Prix',
      paragraphs: [
        `Le montant de référence du présent cadre est de ${amount}. Les prix sont fermes pour la période initiale, hors révisions expressément convenues par avenant. Ils s'entendent selon l'Incoterm ou le lieu de livraison indiqué sur la commande.`,
        'Toute hausse unilatérale est nulle. Les taxes applicables sont celles en vigueur en RDC au jour de la facture.',
      ],
    },
    {
      num: '9',
      title: 'Facturation et paiement',
      paragraphs: [
        `Les factures sont émises selon un cycle ${cycle}, mentionnent la référence de commande et du contrat ${v(vars, 'reference')}, et sont payables à ${pay}.`,
        'L\'Acheteur peut retenir le paiement des lignes contestées de bonne foi. La compensation avec créances certaines et exigibles est autorisée. Un escompte pour paiement anticipé peut être négocié.',
      ],
    },
    {
      num: '10',
      title: 'Pénalités et responsabilité',
      paragraphs: [
        'Sauf cas de force majeure, tout retard de livraison imputable au Fournisseur peut donner lieu à une pénalité de deux pour cent (2 %) de la valeur de la commande par semaine commencée, plafonnée à dix pour cent (10 %), sans préjudice de la résolution et des dommages-intérêts.',
        'Le Fournisseur est responsable des dommages causés par ses Produits, son personnel ou ses sous-traitants. Il détient une assurance responsabilité civile professionnelle suffisante et en justifie sur demande.',
      ],
    },
    {
      num: '11',
      title: 'Propriété intellectuelle et confidentialité',
      paragraphs: [
        'Les spécifications, moules, fichiers, logos et procédés communiqués par l\'Acheteur restent sa propriété. Le Fournisseur ne les utilise que pour l\'exécution du contrat et ne les divulgue pas.',
        'Les informations commerciales, volumes, prix et procédés de traitement de l\'eau sont confidentiels pendant la durée du contrat et trois (3) ans après son terme.',
      ],
    },
    {
      num: '12',
      title: 'Éthique et conformité',
      paragraphs: [
        'Le Fournisseur respecte la réglementation sociale, fiscale, environnementale et anti-corruption. Il s\'interdit tout cadeau, commission occulte ou conflit d\'intérêts à l\'égard du personnel de l\'Acheteur. Tout manquement grave autorise la résiliation immédiate.',
      ],
    },
    {
      num: '13',
      title: 'Force majeure',
      paragraphs: [
        'Est un cas de force majeure un événement imprévisible, irrésistible et extérieur empêchant l\'exécution (catastrophe, guerre, interdiction administrative durable). La partie empêchée notifie l\'autre sous cinq (5) jours. Si l\'empêchement dépasse soixante (60) jours, chaque partie peut résilier sans indemnité.',
      ],
    },
    {
      num: '14',
      title: 'Résiliation',
      paragraphs: [
        `Chaque partie peut résilier le contrat à tout moment, sous réserve d'un préavis écrit de ${notice} jours. En cas de manquement grave non réparé sous quinze (15) jours après mise en demeure, la résiliation peut être prononcée de plein droit.`,
        'La résiliation n\'annule pas les commandes en cours déjà acceptées, sauf faute du Fournisseur. Les clauses de confidentialité, responsabilité et paiement survivent.',
      ],
    },
    {
      num: '15',
      title: 'Droit applicable et litiges',
      paragraphs: [
        'Le contrat est soumis au droit de la République Démocratique du Congo. Les parties recherchent une solution amiable. À défaut, les tribunaux de Kinshasa sont compétents.',
      ],
    },
    {
      num: '16',
      title: 'Dispositions finales',
      paragraphs: [
        'Le présent cadre et ses annexes (barème, spécifications, planning) forment l\'accord entier. Toute modification est un avenant signé. Le contrat est établi en deux (2) exemplaires originaux.',
      ],
    },
  ];
}

function clientArticles(vars: Record<string, string>): Article[] {
  const supplier = v(vars, 'companyName', COMPANY.name);
  const client = v(vars, 'partyName', 'le Client');
  const start = v(vars, 'startDate');
  const end = v(vars, 'endDate', 'terme à convenir');
  const amount = v(vars, 'amount');
  const volume = v(vars, 'volume', 'selon commandes');
  const territory = v(vars, 'territory', 'Kinshasa');
  const pay = v(vars, 'paymentTerms', 'paiement à la livraison ou selon encours agréé');
  const cycle = v(vars, 'billingCycle', 'hebdomadaire');
  const exclusive = v(vars, 'exclusivity', 'non');
  const notice = v(vars, 'noticeDays', '30');
  return [
    {
      num: '1',
      title: 'Objet',
      paragraphs: [
        `Le présent contrat a pour objet la fourniture, par ${supplier} au profit de ${client}, d'eau potable conditionnée (bidons, bonbonnes et formats catalogue) ainsi que les services associés de livraison, de consigne d'emballages et de suivi de tournée.`,
        'Le Client reconnaît la nature alimentaire du produit et l\'importance du respect de la chaîne de qualité, de stockage à l\'abri du soleil et de rotation des lots.',
      ],
    },
    {
      num: '2',
      title: 'Produits et volumes',
      paragraphs: [
        `Les produits concernés sont ceux du catalogue actif de ${supplier}. L'engagement de volume est le suivant : ${volume}. Les volumes indicatifs n'exonèrent pas le Client de commander selon ses besoins réels, ni le Fournisseur de s'organiser pour y répondre dans la limite de sa capacité de production.`,
        'Toute évolution durable de volume supérieure à trente pour cent (30 %) est signalée avec un préavis de quinze (15) jours afin d\'ajuster la tournée.',
      ],
    },
    {
      num: '3',
      title: 'Territoire et livraisons',
      paragraphs: [
        `Les livraisons s'effectuent sur le territoire de ${territory}, à l'adresse du Client ou aux points convenus. Les jours et créneaux sont fixés d'un commun accord et peuvent être adaptés selon le planning des tournées.`,
        'Le Client assure l\'accessibilité du lieu, la présence d\'un réceptionnaire habilité et un espace de stockage propre. Un bon de livraison signé vaut réception des quantités indiquées, sous réserve des réserves portées à l\'arrivée.',
      ],
    },
    {
      num: '4',
      title: 'Durée',
      paragraphs: [
        `Le contrat prend effet le ${start} et expire le ${end}. La reconduction tacite est : ${v(vars, 'autoRenew', 'non')}. En cas de reconduction, les conditions restent applicables par périodes successives, sauf dénonciation dans le préavis de l'article 13.`,
      ],
    },
    {
      num: '5',
      title: 'Qualité, HACCP et non-conformité',
      paragraphs: [
        'Le Fournisseur livre une eau potable contrôlée, issue de son process (captage, clarification, filtration, désinfection, conditionnement). Un lot non libéré par le laboratoire n\'entre pas dans le circuit commercial.',
        'Toute réclamation (goût, odeur, corps étranger, étanchéité) est notifiée sous vingt-quatre (24) heures avec le numéro de lot. Le Fournisseur reprend ou remplace le produit non conforme. Le Client ne revend pas un lot litigieux.',
      ],
    },
    {
      num: '6',
      title: 'Consignes d\'emballages',
      paragraphs: [
        'Les bonbonnes et emballages réutilisables restent la propriété du Fournisseur. Ils sont mis à disposition sous consigne selon le barème en vigueur. Le Client les restitue propres, complets et sans détournement.',
        'Les manquants, casses et détournements sont facturés. Le solde de consigne est exigible à la fin du contrat, après inventaire contradictoire. Le Client n\'appose pas d\'étiquettes concurrentes ni ne remplit les emballages d\'un autre liquide.',
      ],
    },
    {
      num: '7',
      title: 'Prix',
      paragraphs: [
        `Le montant de référence est de ${amount}. Les prix unitaires applicables sont ceux du tarif du segment du Client, éventuellement assortis des bonus volume du catalogue. Tout bonus exceptionnel fait l'objet d'un avenant.`,
        'Les prix peuvent être révisés avec un préavis de trente (30) jours en cas de hausse significative des intrants (énergie, emballages, traitement). Le Client peut alors dénoncer le contrat dans ce même délai.',
      ],
    },
    {
      num: '8',
      title: 'Facturation et paiement',
      paragraphs: [
        `La facturation suit un cycle ${cycle}. Les conditions de paiement sont : ${pay}. Tout retard porte de plein droit, après mise en demeure, des pénalités et peut entraîner la suspension des livraisons et l'exigibilité de l'encours.`,
        'Le Fournisseur peut exiger un acompte, une garantie ou un plafond d\'encours. Les paiements se font par les moyens acceptés (espèces selon politique interne, mobile money, virement).',
      ],
    },
    {
      num: '9',
      title: 'Exclusivité et revente',
      paragraphs: [
        `L'exclusivité territoriale ou de produit est : ${exclusive}. Sauf exclusivité écrite, le Client reste libre de s'approvisionner ailleurs. Il s'interdit toutefois de présenter un produit concurrent comme issu d'EMMANUEL SERVICES SARLU.`,
        'La revente s\'effectue dans des conditions d\'hygiène compatibles avec un produit alimentaire. Le Client n\'altère pas les étiquettes, dates ni mentions légales.',
      ],
    },
    {
      num: '10',
      title: 'Portail client et commandes',
      paragraphs: [
        'Lorsque le Client dispose d\'un accès au portail, les commandes passées en ligne ont la même valeur qu\'une commande écrite. Le Client préserve la confidentialité de ses identifiants et signale toute utilisation frauduleuse.',
        'Le Fournisseur peut refuser une commande en cas d\'encours impayé, d\'adresse inaccessible ou de rupture de production dûment signalée.',
      ],
    },
    {
      num: '11',
      title: 'Responsabilité',
      paragraphs: [
        'Chaque partie est responsable des dommages qu\'elle cause par sa faute. Le Fournisseur n\'est pas responsable des mauvaises conditions de stockage chez le Client, ni de l\'usage après la date de durabilité, ni des retards dus à la circulation, aux intempéries ou à un cas de force majeure à Kinshasa.',
        'La responsabilité du Fournisseur au titre d\'une livraison est limitée, hors faute lourde et hors dommages corporels, au montant de la commande concernée.',
      ],
    },
    {
      num: '12',
      title: 'Données et confidentialité',
      paragraphs: [
        'Les parties traitent les données (identité, adresse, commandes, paiements) uniquement pour l\'exécution du contrat. Elles ne les cèdent pas à des tiers non habilités. Les informations tarifaires et volumes sont confidentielles pendant la durée du contrat et deux (2) ans après.',
      ],
    },
    {
      num: '13',
      title: 'Résiliation',
      paragraphs: [
        `Chaque partie peut résilier le contrat moyennant un préavis écrit de ${notice} jours. En cas de manquement grave (impayés répétés, détournement d'emballages, revente dangereuse, atteinte à la marque), la résiliation peut être immédiate après mise en demeure de quarante-huit (48) heures restée infructueuse.`,
        'À la fin du contrat, le Client restitue les emballages, solde son compte et cesse l\'usage des signes distinctifs du Fournisseur.',
      ],
    },
    {
      num: '14',
      title: 'Droit applicable et litiges',
      paragraphs: [
        'Le contrat est régi par le droit de la République Démocratique du Congo. Les litiges sont soumis, à défaut d\'accord amiable, aux juridictions de Kinshasa.',
      ],
    },
    {
      num: '15',
      title: 'Dispositions finales',
      paragraphs: [
        'Le présent contrat, le tarif applicable, le barème de consigne et les bons de livraison forment un ensemble. En cas de contradiction, l\'ordre de priorité est : avenants, présent contrat, tarif, conditions du portail.',
        'Le contrat est établi en deux (2) exemplaires originaux. Chaque partie déclare en avoir pris pleinement connaissance.',
      ],
    },
  ];
}

const ARTICLE_RE = /^ARTICLE\s+(\d+)\s*[-–—:]\s*(.+)$/i;

function parseArticles(text: string): Article[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const articles: Article[] = [];
  let current: Article | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (!current) return;
    const t = buf.join('\n').trim();
    if (t) {
      current.paragraphs.push(...t.split(/\n{2,}/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean));
    }
    buf = [];
  };
  for (const line of lines) {
    const m = line.trim().match(ARTICLE_RE);
    if (m) {
      flush();
      current = { num: m[1], title: m[2].trim(), paragraphs: [] };
      articles.push(current);
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return articles;
}

function run(text: string, opts?: {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
  allCaps?: boolean;
}) {
  return new TextRun({
    text: opts?.allCaps ? text.toUpperCase() : text,
    bold: opts?.bold,
    italics: opts?.italics,
    size: opts?.size ?? 22,
    font: 'Times New Roman',
    color: opts?.color,
  });
}

function titlePara(text: string, size: number) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [run(text, { bold: true, size, color: NAVY, allCaps: true })],
  });
}

function centerMuted(text: string, size = 20) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [run(text, { size, italics: true, color: MUTED })],
  });
}

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 140 },
    children: [run(text, { bold: true, size: 24, color: NAVY, allCaps: true })],
  });
}

function articleTitle(num: string, title: string) {
  return new Paragraph({
    spacing: { before: 320, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 1 } },
    children: [run(`Article ${num} - ${title}`, { bold: true, size: 24, color: NAVY, allCaps: true })],
  });
}

function bodyPara(text: string) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    indent: { firstLine: 320 },
    children: [run(text, { size: 22 })],
  });
}

function labelPara(text: string) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 276 },
    children: [run(text, { size: 22 })],
  });
}

function cell(text: string, width: number, opts?: { header?: boolean; fill?: boolean }) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 90, right: 90 },
    shading: opts?.fill || opts?.header
      ? { type: ShadingType.CLEAR, fill: opts?.header ? 'F4F6F8' : 'F8FAFC' }
      : undefined,
    children: text.split('\n').map((line) =>
      new Paragraph({
        children: [
          run(line, {
            bold: opts?.header || opts?.fill,
            size: opts?.header ? 18 : 20,
            color: opts?.header ? NAVY : undefined,
          }),
        ],
      }),
    ),
  });
}

function infoTable(fields: Array<{ label: string; value: string }>) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell('Fiche d\'identification du contrat', 3120, { header: true }),
          cell('Valeur', 6240, { header: true }),
        ],
      }),
      ...fields.map(
        (f, i) =>
          new TableRow({
            children: [
              cell(f.label, 3120, { fill: i % 2 === 0 }),
              cell(f.value || '-', 6240, { fill: i % 2 === 0 }),
            ],
          }),
      ),
    ],
  });
}

export async function buildContractDocx(input: {
  title: string;
  reference: string;
  body: string;
  clauses?: string;
  footer?: string;
  fields: Array<{ label: string; value: string }>;
  signedByParty: string;
  signedByCompany: string;
  partyKind?: ContractDocKind;
  vars?: Record<string, string>;
}): Promise<Buffer> {
  const vars = input.vars ?? {};
  const kind = input.partyKind ?? 'KEY_CLIENT';
  const parsed = parseArticles(input.body);
  const articles = parsed.length >= 5 ? parsed : defaultArticles(kind, vars);
  if (parsed.length < 5 && input.body.trim() && !ARTICLE_RE.test(input.body.trim().split('\n')[0] ?? '')) {
    const extra = input.body.trim();
    if (extra && articles[0]) {
      articles[0].paragraphs.push(extra);
    }
  }

  const particular = (input.clauses ?? '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .filter((b) => b.toLowerCase() !== '{{clauses}}');

  const partyBlock = [
    heading('Entre les soussignés'),
    labelPara(
      `D'une part : ${v(vars, 'companyName', COMPANY.name)}, ${COMPANY.form}, ayant son siège à ${v(vars, 'companyAddress', COMPANY.address)}, ` +
      `immatriculée ${COMPANY.rccm}, numéro d'impôt ${COMPANY.nif}, ID NAT ${COMPANY.idnat}, ` +
      `tél. ${v(vars, 'companyPhone', COMPANY.phone)}, e-mail ${v(vars, 'companyEmail', COMPANY.email)}, ` +
      `représentée aux fins des présentes par ${input.signedByCompany}, ci-après « ${kind === 'AGENT' ? 'l\'Employeur' : kind === 'SUPPLIER' ? 'l\'Acheteur' : 'le Fournisseur'} ».`,
    ),
    labelPara(
      `D'autre part : ${v(vars, 'partyName')}` +
      `${vars.partyCode ? `, identifiant ${vars.partyCode}` : ''}` +
      `${vars.partyPhone ? `, tél. ${vars.partyPhone}` : ''}` +
      `${vars.partyEmail ? `, e-mail ${vars.partyEmail}` : ''}` +
      `${kind === 'AGENT' && vars.jobTitle ? `, engagé(e) en qualité de ${vars.jobTitle}` : ''}` +
      `${kind === 'AGENT' && vars.department ? ` au service ${vars.department}` : ''}, ` +
      `ci-après « ${kind === 'AGENT' ? 'le Travailleur' : kind === 'SUPPLIER' ? 'le Fournisseur' : 'le Client'} ».`,
    ),
    labelPara('Les parties sont ci-après collectivement désignées « les Parties » et individuellement « une Partie ».'),
    heading('Il a été convenu et arrêté ce qui suit'),
  ];

  const articleParas = articles.flatMap((a) => [
    articleTitle(a.num, a.title),
    ...a.paragraphs.map((p) => bodyPara(p)),
  ]);

  const clauseParas = particular.length
    ? [
        heading('Clauses particulières'),
        labelPara(
          'Les stipulations ci-dessous complètent ou précisent les articles généraux. En cas de contradiction, les clauses particulières prévalent sur le corps du contrat, sans écarter les dispositions d\'ordre public.',
        ),
        ...particular.map((p) => bodyPara(p)),
      ]
    : [];

  const doc = new Document({
    creator: COMPANY.name,
    title: `${input.reference} - ${input.title}`,
    description: 'Contrat généré pour signature',
    sections: [
      {
        properties: {
          page: { margin: { top: 900, bottom: 900, left: 1080, right: 1080 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run(COMPANY.name, { bold: true, size: 28, color: NAVY })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run(COMPANY.tagline, { italics: true, size: 18, color: MUTED })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 6 } },
                spacing: { after: 80 },
                children: [run(`${COMPANY.address}  ·  ${COMPANY.phone}  ·  ${COMPANY.email}`, { size: 16, color: MUTED })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 8 } },
                children: [run(COMPANY.legal, { size: 14, color: MUTED })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  run(
                    input.footer
                    || 'Document confidentiel destiné à la signature des parties. Chaque page est paraphée. Conserver l\'original signé au dossier.',
                    { size: 14, color: MUTED },
                  ),
                  run('   ·   Page ', { size: 14, color: MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 14 }),
                  run(' / ', { size: 14, color: MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 14 }),
                ],
              }),
            ],
          }),
        },
        children: [
          titlePara('Contrat', 40),
          titlePara(input.title, 32),
          centerMuted(`Référence ${input.reference}  ·  Fait à Kinshasa, le ${v(vars, 'today')}`),
          new Paragraph({ spacing: { after: 200 }, children: [] }),
          infoTable(input.fields),
          new Paragraph({ spacing: { after: 200 }, children: [] }),
          ...partyBlock,
          ...articleParas,
          ...clauseParas,
          heading('Signatures'),
          bodyPara(
            'Fait à Kinshasa, en deux (2) exemplaires originaux, dont un pour chacune des Parties. Les Parties reconnaissent avoir reçu un exemplaire, l\'avoir lu attentivement, et l\'accepter sans réserve. Chaque page est paraphée. La signature emporte acceptation de l\'ensemble des articles, annexes et clauses particulières.',
          ),
          labelPara(`Date et lieu : Kinshasa, le ${v(vars, 'today')}.`),
          new Paragraph({ spacing: { after: 280 }, children: [] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell(`Pour ${input.signedByCompany}`, 4680, { header: true }),
                  cell(`Pour ${input.signedByParty}`, 4680, { header: true }),
                ],
              }),
              new TableRow({
                children: [
                  cell(
                    'Nom et qualité du signataire :\n\n\nSignature précédée de la mention « Lu et approuvé »\nCachet de la société\n\n\n\n',
                    4680,
                  ),
                  cell(
                    'Nom et qualité du signataire :\n\n\nSignature précédée de la mention « Lu et approuvé »\nPièce d\'identité / cachet\n\n\n\n',
                    4680,
                  ),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 280 }, children: [] }),
          centerMuted(
            'Annexe : règlement intérieur, tarif ou barème de consigne, fiche de poste ou spécifications techniques, selon la nature du contrat, remis concomitamment ou tenus à disposition au siège de Bandalungwa.',
            16,
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
