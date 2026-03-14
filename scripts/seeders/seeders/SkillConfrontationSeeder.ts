/**
 * SkillConfrontation Seeder - Standalone Script
 *
 * Seeds the skillconfrontations collection with combat and social skill configurations.
 */

import { getConnection } from '../utils/connection.js';

const COLLECTION = 'skillconfrontations';

const CONFRONTATIONS = [
  {
    skillName: 'Corpo a Corpo',
    category: 'combat_unarmed',
    counterSkills: [
      { skillName: 'Schivata', label: 'Schivata' },
      { skillName: 'Corpo a Corpo', label: 'Parata (Corpo a Corpo)' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Armi da botta',
    category: 'combat_melee',
    counterSkills: [
      { skillName: 'Schivata', label: 'Schivata' },
      { skillName: 'Armi da botta', label: 'Parata (Armi da botta)' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Armi da taglio',
    category: 'combat_melee',
    counterSkills: [
      { skillName: 'Schivata', label: 'Schivata' },
      { skillName: 'Armi da taglio', label: 'Parata (Armi da taglio)' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Armi da fuoco',
    category: 'combat_ranged',
    counterSkills: [
      { skillName: 'Schivata', label: 'Schivata' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Raggirare',
    category: 'social',
    counterSkills: [
      { skillName: 'Empatia', label: 'Empatia (Rilevare bugia)' },
    ],
    rollType: 'hidden',
    requiresAdditionalMessage: true,
    additionalMessageLabel: 'Testo della bugia (visibile solo al master)',
  },
  {
    skillName: 'Intimidire',
    category: 'social',
    counterSkills: [
      { skillName: 'Autocontrollo', label: 'Autocontrollo' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Persuadere',
    category: 'social',
    counterSkills: [
      { skillName: 'Empatia', label: 'Empatia' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Ammaliare',
    category: 'social',
    counterSkills: [
      { skillName: 'Autocontrollo', label: 'Autocontrollo' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Oratoria',
    category: 'social',
    counterSkills: [
      { skillName: 'Empatia', label: 'Empatia' },
    ],
    rollType: 'open',
    requiresAdditionalMessage: false,
  },
];

async function main() {
  const { client, db } = await getConnection();

  try {
    const collection = db.collection(COLLECTION);

    const existing = await collection.countDocuments();
    if (existing > 0) {
      console.log(`[SkillConfrontation] ${existing} configurazioni esistenti, pulizia...`);
      await collection.deleteMany({});
    }

    const now = new Date();
    const docs = CONFRONTATIONS.map((c) => ({ ...c, createdAt: now, updatedAt: now }));

    const result = await collection.insertMany(docs);
    console.log(`[SkillConfrontation] Inserite ${result.insertedCount} configurazioni (${CONFRONTATIONS.filter(c => c.category.startsWith('combat')).length} combattimento + ${CONFRONTATIONS.filter(c => c.category === 'social').length} sociali)`);

    const count = await collection.countDocuments();
    console.log(`[SkillConfrontation] Verifica: ${count} configurazioni nel database`);
  } finally {
    await client.close();
    console.log('[SkillConfrontation] Disconnesso da MongoDB');
  }
}

main().catch((err) => {
  console.error('[SkillConfrontation] Errore:', err);
  process.exit(1);
});
