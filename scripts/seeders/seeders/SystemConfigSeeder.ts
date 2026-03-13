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
  {
    configKey: 'max_characters_per_user',
    configSection: 'character_creation',
    configType: 'number',
    value: 3,
    defaultValue: 3,
    description: 'Numero massimo di personaggi per utente',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stat_total_points',
    configSection: 'character_creation',
    configType: 'number',
    value: 450,
    defaultValue: 400,
    description: 'Totale punti caratteristica da distribuire nel wizard (Step 3)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_stat_minimum',
    configSection: 'character_creation',
    configType: 'number',
    value: 20,
    defaultValue: 20,
    description: 'Valore minimo per ogni statistica nel wizard (Step 3)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'character_creation_skill_total_points',
    configSection: 'character_creation',
    configType: 'number',
    value: 250,
    defaultValue: 200,
    description: 'Totale punti abilità da distribuire nel wizard (Step 4). Sostituisce formula 200+INT/2.',
    isActive: true,
    metadata: { version: 1 },
  },

  // ── economy ─────────────────────────────────────────────────────
  {
    configKey: 'starting_cash',
    configSection: 'economy',
    configType: 'number',
    value: 50,
    defaultValue: 50,
    description: 'Contanti iniziali per un nuovo personaggio (£)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'starting_deposit',
    configSection: 'economy',
    configType: 'number',
    value: 200,
    defaultValue: 200,
    description: 'Deposito bancario iniziale per un nuovo personaggio (£)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'daily_salary_enabled',
    configSection: 'economy',
    configType: 'boolean',
    value: true,
    defaultValue: true,
    description: 'Abilita il salario giornaliero automatico',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'inflation_rate',
    configSection: 'economy',
    configType: 'number',
    value: 0.02,
    defaultValue: 0.02,
    description: 'Tasso di inflazione applicato ai prezzi (0.02 = 2%)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'taxation_enabled',
    configSection: 'economy',
    configType: 'boolean',
    value: false,
    defaultValue: false,
    description: 'Abilita il sistema di tassazione',
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
  {
    configKey: 'max_message_length',
    configSection: 'postal_system',
    configType: 'number',
    value: 2000,
    defaultValue: 2000,
    description: 'Lunghezza massima dei messaggi postali (caratteri)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'message_edit_time_limit',
    configSection: 'postal_system',
    configType: 'number',
    value: 300,
    defaultValue: 300,
    description: 'Tempo massimo per modificare un messaggio dopo l\'invio (secondi)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'message_history_retention',
    configSection: 'postal_system',
    configType: 'number',
    value: 365,
    defaultValue: 365,
    description: 'Durata di conservazione dei messaggi (giorni)',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'postal_delivery_enabled',
    configSection: 'postal_system',
    configType: 'boolean',
    value: true,
    defaultValue: true,
    description: 'Abilita il sistema di consegna postale',
    isActive: true,
    metadata: { version: 1 },
  },
  {
    configKey: 'postal_delay_simulation',
    configSection: 'postal_system',
    configType: 'boolean',
    value: true,
    defaultValue: true,
    description: 'Simula il ritardo di consegna della posta',
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
    configKey: 'combat_success_level_labels',
    configSection: 'combat_system',
    configType: 'json',
    value: {
      fumble: 'Maldestro',
      failure: 'Fallimento',
      normal: 'Normale',
      hard: 'Superiore',
      extreme: 'Estremo',
      critical: 'Critico',
    },
    defaultValue: {},
    description: 'Label italiane per i livelli di successo, usate nell\'output a video',
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
  console.log('⚙️  System Configuration Seeder\n');

  const { client, db } = await getConnection();

  try {
    const collection = db.collection(COLLECTION);
    let seeded = 0;
    let skipped = 0;

    for (const config of ALL_CONFIGS) {
      const existing = await collection.findOne({ configKey: config.configKey });

      if (existing) {
        console.log(`  [SKIP] "${config.configKey}" already exists (v${existing.metadata?.version || '?'})`);
        skipped++;
        continue;
      }

      const now = new Date();
      await collection.insertOne({
        ...config,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`  [OK]   "${config.configKey}" (${config.configSection}/${config.configType})`);
      seeded++;
    }

    console.log(`\n[DONE] Seeded: ${seeded}, Skipped: ${skipped}, Total: ${ALL_CONFIGS.length}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[ERROR] Seeder failed:', err);
  process.exit(1);
});
