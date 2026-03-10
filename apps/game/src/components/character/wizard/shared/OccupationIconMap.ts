/**
 * Occupation Utilities
 *
 * Category labels and image fallback helper.
 * All occupation data (name, description, contacts, earnings, image)
 * comes from the API - nothing is hardcoded here.
 *
 * @module components/character/wizard/shared/OccupationIconMap
 * @since 2.1.0
 */

const DEFAULT_OCCUPATION_IMAGE = '/images/occupations/default-image.png';

export const CATEGORY_LABELS: Record<string, string> = {
  avventurieri: 'Avventurieri',
  arti_creative: 'Arti Creative',
  artisti_spettacolo: 'Artisti e Spettacolo',
  sport: 'Sport',
  affari: 'Affari',
  religiosi: 'Religiosi',
  criminali: 'Criminali',
  giornalismo: 'Giornalismo',
  lavoro_rurale: 'Lavoro Rurale',
  lavoro_urbano: 'Lavoro Urbano',
  tutori_ordine: "Tutori dell'Ordine",
  professione_legale: 'Professione Legale',
  operatori_sanitari: 'Operatori Sanitari',
  salute_mentale: 'Salute Mentale',
  forze_armate: 'Forze Armate',
  politica: 'Politica',
  studiosi: 'Studiosi',
  professioni_varie: 'Professioni Varie',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

export function getOccupationImage(image: string | null | undefined): string {
  return image || DEFAULT_OCCUPATION_IMAGE;
}
