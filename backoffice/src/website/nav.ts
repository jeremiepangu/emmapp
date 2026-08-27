export const WEBSITE_NAV = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'systeme', label: 'Pourquoi nous' },
  { id: 'eau', label: 'Notre eau' },
  { id: 'origine', label: 'Origine' },
  { id: 'produits', label: 'Produits' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'contact', label: 'Contact' },
];

export function sectionHref(id: string) {
  return `/#${id}`;
}
