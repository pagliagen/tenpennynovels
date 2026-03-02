/**
 * Centralized Skill Categories Translation System
 *
 * DB stores categories in English, APIs return Italian translations
 * Management operations convert Italian → English before DB save
 */

export type SkillCategory =
  | 'general'
  | 'combat'
  | 'knowledge'
  | 'social'
  | 'technical'
  | 'special'
  | 'criminal'
  | 'physical'
  | 'artistic'
  | 'financial'
  | 'occult';

export const SKILL_CATEGORY_TRANSLATIONS: Record<SkillCategory, string> = {
  general: 'Generali',
  combat: 'Combattimento',
  knowledge: 'Conoscenza',
  social: 'Sociali',
  technical: 'Tecniche',
  special: 'Speciali',
  criminal: 'Criminali',
  physical: 'Fisiche',
  artistic: 'Artistiche',
  financial: 'Finanziarie',
  occult: 'Occulte'
};

export const SKILL_CATEGORY_DESCRIPTIONS: Record<SkillCategory, string> = {
  general: 'Abilità di uso quotidiano e comune',
  combat: 'Abilità di combattimento e tattiche militari',
  knowledge: 'Competenze accademiche e sapere intellettuale',
  social: 'Capacità di interazione e influenza sociale',
  technical: 'Competenze tecniche e artigianali',
  special: 'Abilità specializzate e non comuni',
  criminal: 'Competenze illecite e furtive',
  physical: 'Capacità fisiche e atletiche',
  artistic: 'Talenti creativi e performativi',
  financial: 'Competenze economiche e commerciali',
  occult: 'Conoscenze esoteriche e paranormali'
};

/**
 * Translate category from English to Italian
 */
export function translateCategory(category: SkillCategory): string {
  return SKILL_CATEGORY_TRANSLATIONS[category] || category;
}

/**
 * Reverse translation: Italian → English
 * Used in management operations to convert user input back to DB format
 */
export function reverseCategoryTranslation(italianCategory: string): SkillCategory | null {
  const normalized = italianCategory.toLowerCase().trim();

  const entry = Object.entries(SKILL_CATEGORY_TRANSLATIONS)
    .find(([_, italian]) => italian.toLowerCase() === normalized);

  return entry ? (entry[0] as SkillCategory) : null;
}

/**
 * Get Italian description for a category
 */
export function getCategoryDescription(category: SkillCategory): string {
  return SKILL_CATEGORY_DESCRIPTIONS[category] || '';
}

/**
 * Get all categories with Italian translations (for dropdowns, filters)
 */
export function getAllCategoriesItalian(): Array<{ value: SkillCategory; label: string }> {
  return Object.entries(SKILL_CATEGORY_TRANSLATIONS).map(([eng, ita]) => ({
    value: eng as SkillCategory,
    label: ita
  }));
}
