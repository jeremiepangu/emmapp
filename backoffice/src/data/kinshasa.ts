export const KINSHASA_PROVINCE = 'KINSHASA';

export const KINSHASA_DISTRICTS = ['Lukunga', 'Funa', 'Mont-Amba', 'Tshangu'] as const;

export type KinshasaDistrict = (typeof KINSHASA_DISTRICTS)[number];

export interface KinshasaCommune {
  name: string;
  district: KinshasaDistrict;
  quartiers: string[];
  avenues: string[];
}

export const ID_DOCUMENT_TYPES = [
  { value: 'CARTE_ELECTEUR', label: "Carte d'électeur" },
  { value: 'PASSEPORT', label: 'Passeport' },
  { value: 'PERMIS_CONDUIRE', label: 'Permis de conduire' },
  { value: 'CARTE_SERVICE', label: 'Carte de service' },
  { value: 'IDNAT', label: 'Carte d’identité nationale' },
  { value: 'RCCM', label: 'RCCM (entreprise)' },
  { value: 'AUTRE', label: 'Autre pièce' },
] as const;

export const PROFESSIONS = [
  'Particulier',
  'Commerce de détail',
  'Distribution d’eau',
  'Hôtel / restauration',
  'Supérette / supermarché',
  'Entreprise / bureau',
  'Santé',
  'Éducation',
  'Administration publique',
  'Transport / logistique',
  'Industrie',
  'ONG / association',
  'Autre',
];

const CITY_AVENUES = [
  'Boulevard du 30 Juin',
  'Boulevard Lumumba',
  'Boulevard Triomphal',
  'Boulevard Sendwe',
  'Avenue de la Justice',
  'Avenue Kasa-Vubu',
  'Avenue de l’Université',
  'Avenue des Huileries',
  'Avenue Victoire',
  'Avenue Colonel Mondjiba',
  'Avenue de la Libération',
  'Avenue du Commerce',
  'Avenue Wagenia',
  'Avenue Tombalbaye',
  'Avenue Flambeau',
  'Avenue By-Pass',
  'Avenue Poids Lourds',
  'Avenue de l’Enseignement',
  'Avenue de la Paix',
  'Avenue Kabinda',
  'Avenue Kasaï',
  'Avenue Haut-Commandement',
  'Avenue des Aviateurs',
  'Avenue Roi Baudouin',
  'Avenue du Plateau',
  'Avenue de la Clinique',
  'Avenue Kimbangu',
  'Avenue Pierre Mulele',
  'Avenue de l’Église',
  'Avenue Nguma',
  'Avenue de la Montagne',
  'Avenue de l’École',
  'Avenue de la Foire',
  'Avenue de l’Industrie',
  'Avenue de la Science',
  'Avenue du Marché',
  'Avenue de l’Hôpital',
  'Avenue de l’Avenir',
  'Avenue de la Révolution',
  'Avenue de l’Indépendance',
  'Avenue du 24 Novembre',
  'Avenue des Palmiers',
  'Avenue Lukusa',
  'Avenue Tabora',
  'Avenue Itaga',
  'Avenue Wangata',
  'Avenue de la Presse',
  'Avenue des Cliniques',
  'Avenue de l’Équateur',
  'Avenue de la Démocratie',
];

export const KINSHASA_COMMUNES: KinshasaCommune[] = [
  {
    name: 'Gombe',
    district: 'Lukunga',
    quartiers: ['Gombe', 'Batetela', 'Golf', 'Premier Mai', 'Haut Commandement'],
    avenues: ['Boulevard du 30 Juin', 'Avenue Wagenia', 'Avenue Lukusa', 'Avenue du Commerce', 'Avenue Tombalbaye'],
  },
  {
    name: 'Barumbu',
    district: 'Lukunga',
    quartiers: ['Tshimanga', 'Nzanza', 'De la Voix du Peuple', 'Mozindo'],
    avenues: ['Avenue de la Justice', 'Avenue Wangata', 'Avenue Itaga'],
  },
  {
    name: 'Kinshasa',
    district: 'Lukunga',
    quartiers: ['Aketi', 'Mandiangu', 'Salongo', 'Réclamation'],
    avenues: ['Avenue du 24 Novembre', 'Avenue de la Paix', 'Avenue Kasa-Vubu'],
  },
  {
    name: 'Lingwala',
    district: 'Lukunga',
    quartiers: ['Force Publique', 'Station', 'Victoire', 'La Voix du Peuple'],
    avenues: ['Avenue Victoire', 'Avenue de la Justice', 'Boulevard du 30 Juin'],
  },
  {
    name: 'Kintambo',
    district: 'Lukunga',
    quartiers: ['Utex', 'Camp Kokolo', 'Camp Tshatshi', 'Nguma'],
    avenues: ['Avenue Kasa-Vubu', 'Avenue Nguma', 'Avenue Colonel Mondjiba'],
  },
  {
    name: 'Ngaliema',
    district: 'Lukunga',
    quartiers: ['Joli Parc', 'Ma Campagne', 'Binza Pigeon', 'Binza Ozone', 'Delvaux', 'Djelo Binza'],
    avenues: ['Avenue Colonel Mondjiba', 'Avenue de l’Université', 'Avenue de la Montagne'],
  },
  {
    name: 'Bandalungwa',
    district: 'Funa',
    quartiers: ['Makelele', 'Kasa-Vubu', 'Salongo', 'Lingwala-Bandal'],
    avenues: ['Avenue Kasa-Vubu', 'Avenue Pierre Mulele', 'Avenue de l’École'],
  },
  {
    name: 'Bumbu',
    district: 'Funa',
    quartiers: ['Bumbu', 'Kasai', 'Matadi Kibala', 'Camp Mpolo'],
    avenues: ['Avenue By-Pass', 'Avenue Kasaï', 'Avenue de la Paix'],
  },
  {
    name: 'Kalamu',
    district: 'Funa',
    quartiers: ['Matonge', 'Yolo Nord', 'Yolo Sud', 'Kauka', 'Camp Futa'],
    avenues: ['Avenue Victoire', 'Avenue Kasa-Vubu', 'Boulevard Sendwe'],
  },
  {
    name: 'Kasa-Vubu',
    district: 'Funa',
    quartiers: ['Anciens Combattants', 'Onatra', 'Lodja', 'Katuba'],
    avenues: ['Avenue Kasa-Vubu', 'Avenue Victoire', 'Avenue de la Libération'],
  },
  {
    name: 'Makala',
    district: 'Funa',
    quartiers: ['Kabila', 'Mabulu', 'Camp Bumba', 'Salongo'],
    avenues: ['Avenue By-Pass', 'Avenue de l’Enseignement', 'Avenue Kasaï'],
  },
  {
    name: 'Ngiri-Ngiri',
    district: 'Funa',
    quartiers: ['Diangenda', 'Assossa', 'Petite Cite'],
    avenues: ['Avenue Kasa-Vubu', 'Avenue Pierre Mulele', 'Avenue de l’Église'],
  },
  {
    name: 'Selembao',
    district: 'Funa',
    quartiers: ['Mbanza Lemba', 'Herady', 'Ndjili Brasserie', 'Camp Mpolo'],
    avenues: ['Avenue By-Pass', 'Avenue de la Libération', 'Avenue de l’Avenir'],
  },
  {
    name: 'Kisenso',
    district: 'Mont-Amba',
    quartiers: ['Kisenso', 'Mission', 'Revolution', 'Mokali'],
    avenues: ['Avenue By-Pass', 'Avenue de l’Enseignement', 'Avenue de la Montagne'],
  },
  {
    name: 'Lemba',
    district: 'Mont-Amba',
    quartiers: ['Righini', 'Commercial', 'Gombele', 'Livulu', 'Campus'],
    avenues: ['Avenue de l’Université', 'Avenue de la Science', 'Avenue de l’École'],
  },
  {
    name: 'Limete',
    district: 'Mont-Amba',
    quartiers: ['Résidentiel', 'Industriel', 'Kingabwa', 'Salongo', 'Mombele'],
    avenues: ['Boulevard Lumumba', 'Avenue de l’Industrie', 'Avenue Flambeau', 'Avenue Poids Lourds'],
  },
  {
    name: 'Matete',
    district: 'Mont-Amba',
    quartiers: ['Dondo', 'Bahumbu', 'Viaduc', 'Sans Fil'],
    avenues: ['Boulevard Lumumba', 'Avenue de l’Enseignement', 'Avenue de la Foire'],
  },
  {
    name: 'Ngaba',
    district: 'Mont-Amba',
    quartiers: ['Ngaba', 'Mpudi', 'Mukulusi'],
    avenues: ['Avenue By-Pass', 'Avenue de l’Université', 'Avenue de la Paix'],
  },
  {
    name: 'Mont-Ngafula',
    district: 'Mont-Amba',
    quartiers: ['Kimwenza', 'Kimbondo', 'Mitendi', 'Righini', 'Manoah'],
    avenues: ['Avenue de l’Université', 'Avenue de la Montagne', 'Avenue By-Pass'],
  },
  {
    name: 'Kimbanseke',
    district: 'Tshangu',
    quartiers: ['Ngampani', 'Mokali', 'Kikimi', 'Esanga', 'Bahumbu'],
    avenues: ['Boulevard Lumumba', 'Avenue de l’Avenir', 'Avenue de la Révolution'],
  },
  {
    name: 'Maluku',
    district: 'Tshangu',
    quartiers: ['Kingakati', 'Mbankana', 'Menkao', 'Nsele-Maluku'],
    avenues: ['Boulevard Lumumba', 'Avenue de l’Avenir'],
  },
  {
    name: 'Masina',
    district: 'Tshangu',
    quartiers: ['Sans Fil', 'Pelé Pelé', 'Mafuta', 'Tshala', 'Pakadjuma'],
    avenues: ['Boulevard Lumumba', 'Avenue de l’Enseignement', 'Avenue Flambeau'],
  },
  {
    name: 'Ndjili',
    district: 'Tshangu',
    quartiers: ['Quartier 1', 'Quartier 7', 'Quartier 13', 'Brasserie', 'Aéroport'],
    avenues: ['Boulevard Lumumba', 'Avenue de l’Aéroport', 'Avenue de l’Enseignement'],
  },
  {
    name: 'Nsele',
    district: 'Tshangu',
    quartiers: ['Kingasani', 'Mikonga', 'Dumez', 'Cité Pumbu'],
    avenues: ['Boulevard Lumumba', 'Avenue de la Foire', 'Avenue de l’Avenir'],
  },
];

export function communesForDistrict(district?: string): KinshasaCommune[] {
  if (!district) return KINSHASA_COMMUNES;
  return KINSHASA_COMMUNES.filter((c) => c.district === district);
}

export function communeByName(name?: string): KinshasaCommune | undefined {
  if (!name) return undefined;
  return KINSHASA_COMMUNES.find((c) => c.name === name);
}

export function quartiersForCommune(commune?: string): string[] {
  return communeByName(commune)?.quartiers ?? [];
}

export function avenuesForCommune(commune?: string): string[] {
  const local = communeByName(commune)?.avenues ?? [];
  return Array.from(new Set([...local, ...CITY_AVENUES])).sort((a, b) => a.localeCompare(b, 'fr'));
}

export function districtForCommune(commune?: string): KinshasaDistrict | '' {
  return communeByName(commune)?.district ?? '';
}

export function formatKinshasaAddress(parts: {
  avenue?: string;
  avenueNumber?: string;
  quartier?: string;
  commune?: string;
  district?: string;
  province?: string;
}): string {
  const line = [parts.avenue, parts.avenueNumber].filter(Boolean).join(' ');
  return [line, parts.quartier, parts.commune, parts.district, parts.province || KINSHASA_PROVINCE]
    .filter(Boolean)
    .join(', ');
}
