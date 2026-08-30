export const WEBSITE_NAV = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'services', label: 'Services' },
  { id: 'apropos', label: 'À propos' },
  { id: 'produits', label: 'Produits' },
  { id: 'qualite', label: 'Qualité' },
  { id: 'contact', label: 'Contact' },
];

export function sectionHref(id: string) {
  return `/#${id}`;
}
