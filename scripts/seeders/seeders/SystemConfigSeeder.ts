/**
 * System Configuration Seeder
 *
 * Seeds all SystemConfiguration records:
 * - character_creation: Game settings (approval, max chars, etc.)
 * - economy: Starting cash, salary, inflation
 * - moderation: Chat moderation, reports, appeals
 * - postal_system: Message length, edit time, delivery
 * - combat_system: Damage bonus table, unarmed damage, success labels
 * - system: Maintenance mode
 *
 * Uses upsert-skip logic: existing records are never overwritten.
 */

import { getConnection } from '../utils/connection.js';

const COLLECTION = 'system_configurations';

interface ConfigRecord {
  configKey: string;
  configSection: string;
  configType: 'boolean' | 'number' | 'string' | 'json';
  value: any;
  defaultValue: any;
  description: string;
  isActive: boolean;
  metadata: { version: number };
}

const ALL_CONFIGS: ConfigRecord[] = [
  // ── character_creation ──────────────────────────────────────────
  // Removed - max_characters_per_user no longer used (multi-character system redesigned)
  // {
  //   configKey: 'max_characters_per_user',
  //   configSection: 'character_creation',
  //   configType: 'number',
  //   value: 3,
  //   defaultValue: 3,
  //   description: 'Numero massimo di personaggi per utente',
  //   isActive: true,
  //   metadata: { version: 1 },
  // },

  // Stats Section (9 records)
  {
    configKey: 'character_creation_stats_base_points',
    configSection: 'character_creation',
    configType: 'number',
    value: 20,
    defaultValue: 20,
    description: 'Punti base per ogni statistica prima della distribuzione',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stats_total_points',
    configSection: 'character_creation',
    configType: 'number',
    value: 400,
    defaultValue: 400,
    description: 'Totale punti da distribuire nelle caratteristiche (wizard Step 3)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stats_max_above_80',
    configSection: 'character_creation',
    configType: 'number',
    value: 2,
    defaultValue: 2,
    description: 'Numero massimo di statistiche che possono superare 80 durante creazione',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stats_creation_cap',
    configSection: 'character_creation',
    configType: 'number',
    value: 85,
    defaultValue: 85,
    description: 'Cap massimo per statistica durante wizard creazione (DRAFT)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stats_gameplay_cap',
    configSection: 'character_creation',
    configType: 'number',
    value: 99,
    defaultValue: 99,
    description: 'Cap massimo per statistica durante gameplay (APPROVED)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stats_min_values',
    configSection: 'character_creation',
    configType: 'json',
    value: {
      strength: 20,
      dexterity: 20,
      intelligence: 20,
      constitution: 20,
      size: 20,
      appearance: 20,
      power: 20,
      education: 20,
    },
    defaultValue: {
      strength: 20,
      dexterity: 20,
      intelligence: 20,
      constitution: 20,
      size: 20,
      appearance: 20,
      power: 20,
      education: 20,
    },
    description: 'Valori minimi per ogni statistica (oggetto chiave-valore)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stats_description',
    configSection: 'character_creation',
    configType: 'string',
    value: 'Caratteristiche primarie: 20 base + 400 punti da distribuire. Limite creazione 85, gameplay 99.',
    defaultValue: '',
    description: 'Descrizione del sistema stats per admin UI',
    isActive: true,
    metadata: { version: 1 },
  },

  // Skills Section (7 records)
  {
    configKey: 'character_creation_skills_total_points_formula',
    configSection: 'character_creation',
    configType: 'string',
    value: 'constant:200',
    defaultValue: 'constant:200',
    description: 'Formula per calcolare punti abilità base (constant:N o formula:EDUx4)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_skills_int_bonus_formula',
    configSection: 'character_creation',
    configType: 'string',
    value: 'INT/2',
    defaultValue: 'INT/2',
    description: 'Formula bonus intelligenza (INT/2, INTx2, INT+10, constant:N)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_skills_creation_cap',
    configSection: 'character_creation',
    configType: 'number',
    value: 75,
    defaultValue: 75,
    description: 'Cap massimo per abilità normale durante creazione (wizard Step 4)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_skills_creation_cap_with_occupation',
    configSection: 'character_creation',
    configType: 'number',
    value: 80,
    defaultValue: 80,
    description: 'Cap massimo per abilità con bonus occupazione durante creazione',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_skills_gameplay_cap',
    configSection: 'character_creation',
    configType: 'number',
    value: 99,
    defaultValue: 99,
    description: 'Cap massimo per abilità durante gameplay',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_skills_physical_exclude_int_bonus',
    configSection: 'character_creation',
    configType: 'boolean',
    value: true,
    defaultValue: true,
    description: 'Le abilità fisiche escludono bonus INT',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_skills_description',
    configSection: 'character_creation',
    configType: 'string',
    value: 'Abilità: 200 base + bonus INT configurabile. Cap creazione 75 (80 con occupazione), gameplay 99. Abilità fisiche escludono bonus INT.',
    defaultValue: '',
    description: 'Descrizione del sistema skills per admin UI',
    isActive: true,
    metadata: { version: 1 },
  },

  // Occupation Section (5 records)
  {
    configKey: 'character_creation_occupation_required_skill_minimum',
    configSection: 'character_creation',
    configType: 'number',
    value: 40,
    defaultValue: 40,
    description: 'Valore minimo richiesto per abilità obbligatorie occupazione',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_occupation_bonus_skill_points',
    configSection: 'character_creation',
    configType: 'number',
    value: 30,
    defaultValue: 30,
    description: 'Punti bonus per abilità scelta (1 abilità bonus)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_occupation_required_skill_count',
    configSection: 'character_creation',
    configType: 'json',
    value: { min: 6, max: 6 },
    defaultValue: { min: 6, max: 6 },
    description: 'Range numero abilità obbligatorie per occupazione',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_occupation_bonus_skill_count',
    configSection: 'character_creation',
    configType: 'json',
    value: { min: 1, max: 1 },
    defaultValue: { min: 1, max: 1 },
    description: 'Range numero abilità bonus selezionabili',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_occupation_description',
    configSection: 'character_creation',
    configType: 'string',
    value: 'Occupazioni: 6 abilità obbligatorie (min 40), 1 abilità bonus (+30 punti gratuiti)',
    defaultValue: '',
    description: 'Descrizione del sistema occupazioni per admin UI',
    isActive: true,
    metadata: { version: 1 },
  },

  // Limits Section (4 records)
  {
    configKey: 'character_creation_limits_age',
    configSection: 'character_creation',
    configType: 'json',
    value: { min: 16, max: 80 },
    defaultValue: { min: 16, max: 80 },
    description: 'Range età personaggio (anni)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_limits_weight',
    configSection: 'character_creation',
    configType: 'json',
    value: { min: 30, max: 200, unit: 'kg' },
    defaultValue: { min: 30, max: 200, unit: 'kg' },
    description: 'Range peso personaggio',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_limits_height',
    configSection: 'character_creation',
    configType: 'json',
    value: { min: 100, max: 250, unit: 'cm' },
    defaultValue: { min: 100, max: 250, unit: 'cm' },
    description: 'Range altezza personaggio',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_limits_background_fields',
    configSection: 'character_creation',
    configType: 'json',
    value: {
      briefHistoryMin: 100,
      personalityMin: 50,
      goalsMin: 50,
      maxLength: 4000,
    },
    defaultValue: {
      briefHistoryMin: 100,
      personalityMin: 50,
      goalsMin: 50,
      maxLength: 4000,
    },
    description: 'Limiti lunghezza campi background (caratteri)',
    isActive: true,
    metadata: { version: 1 },
  },

  // Social Classes (1 JSON array record)
  {
    configKey: 'character_creation_social_classes',
    configSection: 'character_creation',
    configType: 'json',
    value: [
      { id: 'destitute', name: 'Indigente', financeSkillRange: { min: 1, max: 9 }, weeklyCredit: 480, initialWealth: { minCash: 1200, maxCash: 3600 } },
      { id: 'poor', name: 'Povero', financeSkillRange: { min: 10, max: 19 }, weeklyCredit: 1200, initialWealth: { minCash: 4800, maxCash: 9600 } },
      { id: 'modest', name: 'Modesto', financeSkillRange: { min: 20, max: 39 }, weeklyCredit: 3600, initialWealth: { minCash: 12000, maxCash: 24000 } },
      { id: 'lower_middle', name: 'Piccola borghesia', financeSkillRange: { min: 40, max: 49 }, weeklyCredit: 7200, initialWealth: { minCash: 36000, maxCash: 72000 } },
      { id: 'middle_class', name: 'Media borghesia', financeSkillRange: { min: 50, max: 69 }, weeklyCredit: 18000, initialWealth: { minCash: 96000, maxCash: 192000 } },
      { id: 'wealthy', name: 'Ricco', financeSkillRange: { min: 70, max: 79 }, weeklyCredit: 36000, initialWealth: { minCash: 240000, maxCash: 480000 } },
      { id: 'affluent', name: 'Facoltoso', financeSkillRange: { min: 80, max: 89 }, weeklyCredit: 72000, initialWealth: { minCash: 720000, maxCash: 1200000 } },
      { id: 'elite', name: 'Élite', financeSkillRange: { min: 90, max: 99 }, weeklyCredit: 120000, initialWealth: { minCash: 1920000, maxCash: 3600000 } },
    ],
    defaultValue: [],
    description: '8 classi sociali basate su skill FINANZA',
    isActive: true,
    metadata: { version: 1 },
  },

  // Formulas Section (2 JSON records)
  {
    configKey: 'character_creation_formulas_derived',
    configSection: 'character_creation',
    configType: 'json',
    value: {
      hitPoints: 'FLOOR((CON + SIZ) / 10)',
      sanity: 'POW',
      magicPoints: 'FLOOR(POW / 5)',
      luck: 'POW',
      ideaRoll: 'INT',
      knowledge: 'EDU',
      movementRate: '8',
    },
    defaultValue: {},
    description: 'Formule per calcolo statistiche derivate (supportano FLOOR, CEIL, ROUND, +, -, *, /)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_formulas_damage_bonus',
    configSection: 'character_creation',
    configType: 'json',
    value: [
      { maxTotal: 64, bonus: '-2', build: -2 },
      { maxTotal: 84, bonus: '-1', build: -1 },
      { maxTotal: 124, bonus: '0', build: 0 },
      { maxTotal: 164, bonus: '+1d4', build: 1 },
      { maxTotal: 204, bonus: '+1d6', build: 2 },
      { maxTotal: 284, bonus: '+2d6', build: 3 },
      { maxTotal: 364, bonus: '+3d6', build: 4 },
      { maxTotal: 444, bonus: '+4d6', build: 5 },
      { maxTotal: 9999, bonus: '+5d6', build: 6 },
    ],
    defaultValue: [],
    description: 'Tabella bonus danno basato su STR + SIZ',
    isActive: true,
    metadata: { version: 1 },
  },

  // Metadata (1 JSON record)
  {
    configKey: 'character_creation_meta',
    configSection: 'character_creation',
    configType: 'json',
    value: {
      version: '1.0.0',
      description: 'TenPennyNovels - Call of Cthulhu Victorian RPG Character Creation Configuration',
      lastUpdated: '2025-01-15T00:00:00.000Z',
      lastModifiedBy: 'system',
    },
    defaultValue: {},
    description: 'Metadata configurazione character creation',
    isActive: true,
    metadata: { version: 1 },
  },

  // Field visibility per wizard e filterForPublic (true = pubblico, false = privato/solo master+owner)
  {
    configKey: 'character_creation_field_visibility',
    configSection: 'character_creation',
    configType: 'json',
    value: {
      firstName: true,
      surname: true,
      apparentAge: true,
      gender: true,
      height: true,
      weight: true,
      occupation: true,
      briefHistory: true,
      significantEvents: true,
      importantRelationships: true,
      personality: true,
      ideology: true,
      birthDate: false,
      maritalStatus: false,
      hiddenMarks: false,
      pathologies: false,
      criminalRecord: false,
      educationTitle: false,
    },
    defaultValue: {},
    description: 'Visibilità dei campi del personaggio: true = pubblico (visibile a tutti), false = privato (solo master/owner)',
    isActive: true,
    metadata: { version: 1 },
  },

  // ── moderation ──────────────────────────────────────────────────
  {
    configKey: 'report_system_enabled',
    configSection: 'moderation',
    configType: 'boolean',
    value: true,
    defaultValue: true,
    description: 'Abilita il sistema di segnalazioni utente',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'ai_moderation_enabled',
    configSection: 'moderation',
    configType: 'boolean',
    value: false,
    defaultValue: false,
    description: 'Abilita la moderazione automatica AI dei messaggi chat (distilbert-multilingual-toxicity-classifier)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'ai_moderation_threshold',
    configSection: 'moderation',
    configType: 'number',
    value: 0.7,
    defaultValue: 0.7,
    description: 'Soglia di tossicità (0.0–1.0) oltre la quale un messaggio viene flaggato automaticamente',
    isActive: true,
    metadata: { version: 1 },
  },

  // ── postal_system ───────────────────────────────────────────────

  // Message Types (5 JSON records - one per type)
  {
    configKey: 'postal_message_type_note',
    configSection: 'postal_system',
    configType: 'json',
    value: {
      displayName: 'Bigliettino',
      description: 'Scambio rapido di bigliettini tra personaggi presenti',
      deliveryMode: 'realtime',
      deliveryMethod: 'to_person',
      requiresResidenceKnowledge: false,
      postageRequired: 0,
      maxLength: 200,
      requiresSealing: false,
      allowsReply: true,
      visibilityInPreview: 'first_line',
      availableToRoles: ['personaggio'],
      restrictedLocations: [],
      icon: '📝',
      allowMultipleRecipients: false,
      maxRecipients: 1,
    },
    defaultValue: {},
    description: 'Configurazione tipo messaggio: Bigliettino (realtime, gratuito)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'postal_message_type_telegram',
    configSection: 'postal_system',
    configType: 'json',
    value: {
      displayName: 'Telegramma',
      description: 'Messaggio urgente consegnato rapidamente',
      deliveryMode: 'scheduled_fixed',
      deliveryTiming: { fixedDelayMinutes: 20 },
      deliveryMethod: 'both_options',
      requiresResidenceKnowledge: false,
      postageRequired: 3,
      expressCostMultiplier: 1.5,
      maxLength: 500,
      requiresSealing: false,
      allowsReply: true,
      visibilityInPreview: 'subject_only',
      availableToRoles: ['personaggio'],
      restrictedLocations: [],
      icon: '⚡',
      allowMultipleRecipients: true,
      maxRecipients: 3,
    },
    defaultValue: {},
    description: 'Configurazione tipo messaggio: Telegramma (20min, 3 credits)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'postal_message_type_letter',
    configSection: 'postal_system',
    configType: 'json',
    value: {
      displayName: 'Lettera',
      description: 'Corrispondenza formale consegnata a domicilio',
      deliveryMode: 'scheduled_fixed',
      deliveryTiming: { fixedDelayMinutes: 240 },
      deliveryMethod: 'to_residence',
      requiresResidenceKnowledge: true,
      postageRequired: 1,
      expressCostMultiplier: 3,
      maxLength: 2000,
      requiresSealing: true,
      allowsReply: true,
      visibilityInPreview: 'subject_only',
      availableToRoles: ['personaggio'],
      restrictedLocations: [],
      icon: '✉️',
      allowMultipleRecipients: false,
      maxRecipients: 1,
    },
    defaultValue: {},
    description: 'Configurazione tipo messaggio: Lettera (4h fixed delay, 1 credit)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'postal_message_type_dispatch',
    configSection: 'postal_system',
    configType: 'json',
    value: {
      displayName: 'Dispaccio',
      description: 'Comunicazioni ufficiali e legali',
      deliveryMode: 'scheduled_variable',
      deliveryTiming: { variableDelayRange: { min: 1440, max: 2880 } },
      deliveryMethod: 'to_residence',
      requiresResidenceKnowledge: true,
      postageRequired: 6,
      expressCostMultiplier: 3,
      maxLength: 5000,
      requiresSealing: true,
      allowsReply: false,
      visibilityInPreview: 'subject_only',
      availableToRoles: ['master', 'moderatore', 'gestore'],
      restrictedLocations: [],
      icon: '📜',
      allowMultipleRecipients: true,
      maxRecipients: 20,
    },
    defaultValue: {},
    description: 'Configurazione tipo messaggio: Dispaccio (24-48h, 6 credits, master-only, no reply)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'postal_message_type_flyer',
    configSection: 'postal_system',
    configType: 'json',
    value: {
      displayName: 'Volantino',
      description: 'Messaggio broadcast senza possibilità di risposta',
      deliveryMode: 'realtime',
      deliveryMethod: 'to_person',
      requiresResidenceKnowledge: false,
      postageRequired: 0,
      maxLength: 500,
      requiresSealing: false,
      allowsReply: false,
      visibilityInPreview: 'first_line',
      availableToRoles: ['personaggio'],
      restrictedLocations: [],
      icon: '📄',
      allowMultipleRecipients: true,
      maxRecipients: 10,
    },
    defaultValue: {},
    description: 'Configurazione tipo messaggio: Volantino (realtime, free, no reply, broadcast max 10)',
    isActive: true,
    metadata: { version: 1 },
  },

  // ── combat_system ───────────────────────────────────────────────
  {
    configKey: 'combat_damage_bonus_table',
    configSection: 'combat_system',
    configType: 'json',
    value: [
      { min: 2,   max: 64,  bonus: '-2' },
      { min: 65,  max: 84,  bonus: '-1' },
      { min: 85,  max: 124, bonus: '0' },
      { min: 125, max: 164, bonus: '+1d4' },
      { min: 165, max: 204, bonus: '+1d6' },
      { min: 205, max: 284, bonus: '+2d6' },
      { min: 285, max: 364, bonus: '+3d6' },
      { min: 365, max: 444, bonus: '+4d6' },
      { min: 445, max: 524, bonus: '+5d6' },
    ],
    defaultValue: [],
    description: 'Tabella bonus danno basato su FOR + TAG del personaggio',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'combat_unarmed_base_damage',
    configSection: 'combat_system',
    configType: 'number',
    value: 2,
    defaultValue: 2,
    description: 'Danno base inflitto con un attacco a mani nude (senza bonus FOR+TAG)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'skill_check_success_level_labels',
    configSection: 'skill_check_system',
    configType: 'json',
    value: {
      fumble: 'Fallimento Critico',
      failure: 'Fallimento',
      normal: 'Successo',
      hard: 'Successo Difficile',
      extreme: 'Successo Estremo',
      critical: 'Successo Critico',
    },
    defaultValue: {
      fumble: 'Fallimento Critico',
      failure: 'Fallimento',
      normal: 'Successo',
      hard: 'Successo Difficile',
      extreme: 'Successo Estremo',
      critical: 'Successo Critico',
    },
    description: 'Label italiane per i livelli di successo di QUALSIASI tiro basato su abilità o caratteristica (skill check, stat check, combattimento)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'confrontation_allow_no_defense',
    configSection: 'combat_system',
    configType: 'boolean',
    value: true,
    defaultValue: true,
    description: 'Permetti opzione "Non voglio difendermi" (fallimento automatico per RP)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'combat_wounded_constitution_check_threshold',
    configSection: 'combat_system',
    configType: 'number',
    value: 0.5,
    defaultValue: 0.5,
    description: 'Soglia HP% per check Costituzione obbligatorio prima di difendersi (0.5 = 50%)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'confrontation_skill_usage_limit_per_scene',
    configSection: 'combat_system',
    configType: 'number',
    value: 1,
    defaultValue: 1,
    description: 'Max usi per skill sociale per scena contro stesso target (0 = illimitato, Raggirare esente)',
    isActive: true,
    metadata: { version: 1 },
  },

  // ── ticket_system ───────────────────────────────────────────────
  // Category: character_approval
  {
    configKey: 'ticket_category_character_approval',
    configSection: 'ticket_system',
    configType: 'json',
    value: {
      label: 'Approvazione Personaggio',
      description: 'Richiesta di approvazione scheda personaggio',
      department: 'administration',
      defaultPriority: 'medium',
      escalationThresholdHours: 48,
      whoCanCreate: 'all', // 'all' | 'approved_only' | 'staff_only'
      requiredStaffPermissions: ['characters.detail.approve'],
      autoClose: false,
      autoCloseMessage: null,
      autoCloseDelaySeconds: 0,
    },
    defaultValue: {},
    description: 'Configurazione categoria ticket: Approvazione Personaggio',
    isActive: true,
    metadata: { version: 1 },
  },

  // Category: character_edit
  {
    configKey: 'ticket_category_character_edit',
    configSection: 'ticket_system',
    configType: 'json',
    value: {
      label: 'Modifica Personaggio',
      description: 'Richiesta modifica personaggio post-approvazione (background, stats)',
      department: 'administration',
      defaultPriority: 'medium',
      escalationThresholdHours: 48,
      whoCanCreate: 'approved_only',
      requiredStaffPermissions: ['characters.detail.edit'],
      autoClose: false,
      autoCloseMessage: null,
      autoCloseDelaySeconds: 0,
    },
    defaultValue: {},
    description: 'Configurazione categoria ticket: Modifica Personaggio',
    isActive: true,
    metadata: { version: 1 },
  },

  // Category: quest_proposal
  {
    configKey: 'ticket_category_quest_proposal',
    configSection: 'ticket_system',
    configType: 'json',
    value: {
      label: 'Proposta Trama/Quest',
      description: 'Proposta trama o quest personalizzata',
      department: 'master',
      defaultPriority: 'low',
      escalationThresholdHours: 120,
      whoCanCreate: 'approved_only',
      requiredStaffPermissions: [],
      autoClose: false,
      autoCloseMessage: null,
      autoCloseDelaySeconds: 0,
    },
    defaultValue: {},
    description: 'Configurazione categoria ticket: Proposta Trama/Quest (auto-close)',
    isActive: true,
    metadata: { version: 1 },
  },

  // Category: game_bug_report
  {
    configKey: 'ticket_category_game_bug_report',
    configSection: 'ticket_system',
    configType: 'json',
    value: {
      label: 'Segnalazione Bug',
      description: 'Segnalazione bug in-game',
      department: 'technical',
      defaultPriority: 'high',
      escalationThresholdHours: 24,
      whoCanCreate: 'all',
      requiredStaffPermissions: [],
      autoClose: false,
      autoCloseMessage: null,
      autoCloseDelaySeconds: 0,
    },
    defaultValue: {},
    description: 'Configurazione categoria ticket: Segnalazione Bug (auto-close)',
    isActive: true,
    metadata: { version: 1 },
  },

  // Category: improvement_suggestion
  {
    configKey: 'ticket_category_improvement_suggestion',
    configSection: 'ticket_system',
    configType: 'json',
    value: {
      label: 'Suggerimento Miglioramento',
      description: 'Suggerimento per migliorare funzionalità esistenti',
      department: 'general',
      defaultPriority: 'low',
      escalationThresholdHours: 168,
      whoCanCreate: 'all',
      requiredStaffPermissions: [],
      autoClose: false,
      autoCloseMessage: null,
      autoCloseDelaySeconds: 0,
    },
    defaultValue: {},
    description: 'Configurazione categoria ticket: Suggerimento Miglioramento (auto-close)',
    isActive: true,
    metadata: { version: 1 },
  },

  // Category: sanction_appeal
  {
    configKey: 'ticket_category_sanction_appeal',
    configSection: 'ticket_system',
    configType: 'json',
    value: {
      label: 'Sanzione / contestazione',
      description: 'Contestazione o chiarimenti su una sanzione ricevuta (ban parziale o comunicazione staff)',
      department: 'moderation',
      defaultPriority: 'high',
      escalationThresholdHours: 24,
      whoCanCreate: 'all',
      requiredStaffPermissions: [],
      autoClose: false,
      autoCloseMessage: null,
      autoCloseDelaySeconds: 0,
    },
    defaultValue: {},
    description: 'Configurazione categoria ticket: Sanzione / contestazione',
    isActive: true,
    metadata: { version: 1 },
  },

  // ── ai_features ─────────────────────────────────────────────────
  {
    configKey: 'bot_management_enabled',
    configSection: 'ai_features',
    configType: 'boolean',
    value: false,
    defaultValue: false,
    description: 'Abilita la sezione Gestione Bot nel pannello di amministrazione (generazione personaggi AI). Il servizio AI non è gestito dal server al momento: di default disattivato.',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'keeper_qa_enabled',
    configSection: 'ai_features',
    configType: 'boolean',
    value: false,
    defaultValue: false,
    description: 'Abilita la risposta AI del Bibliotecario nella ricerca documenti (RAG). La ricerca testuale/semantica resta sempre attiva; disattiva solo la generazione di risposte AI. Il servizio AI non è gestito dal server al momento: di default disattivato.',
    isActive: true,
    metadata: { version: 1 },
  },

  // ── system ──────────────────────────────────────────────────────
  {
    configKey: 'system_maintenance_mode',
    configSection: 'system',
    configType: 'json',
    value: {
      enabled: false,
      message: '',
      allowedUsers: [],
      estimatedCompletion: null,
    },
    defaultValue: { enabled: false, message: '', allowedUsers: [], estimatedCompletion: null },
    description: 'Configurazione della modalità manutenzione del sistema',
    isActive: true,
    metadata: { version: 1 },
  },
];

async function main() {
  const force = process.argv.includes('--force');
  console.log(`⚙️  System Configuration Seeder${force ? ' [FORCE MODE]' : ''}\n`);

  const { client, db } = await getConnection();

  try {
    const collection = db.collection(COLLECTION);
    let seeded = 0;
    let updated = 0;
    let skipped = 0;

    for (const config of ALL_CONFIGS) {
      const existing = await collection.findOne({ configKey: config.configKey });

      if (existing && !force) {
        console.log(`  [SKIP]   "${config.configKey}" already exists (v${existing.metadata?.version || '?'})`);
        skipped++;
        continue;
      }

      const now = new Date();

      if (existing && force) {
        await collection.updateOne(
          { configKey: config.configKey },
          { $set: { ...config, updatedAt: now } }
        );
        console.log(`  [UPDATE] "${config.configKey}" (${config.configSection}/${config.configType})`);
        updated++;
      } else {
        await collection.insertOne({
          ...config,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`  [OK]     "${config.configKey}" (${config.configSection}/${config.configType})`);
        seeded++;
      }
    }

    console.log(`\n[DONE] Seeded: ${seeded}, Updated: ${updated}, Skipped: ${skipped}, Total: ${ALL_CONFIGS.length}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[ERROR] Seeder failed:', err);
  process.exit(1);
});
