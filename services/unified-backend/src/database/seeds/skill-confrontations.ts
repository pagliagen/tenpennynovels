/**
 * Seed script: skill_confrontations config for the TiroContrapposto system.
 *
 * Without these documents, every createConfrontationAttack call fails with
 * 400 INVALID_ATTACK_SKILL — the collection was never populated (no seed
 * script, no admin UI existed for it before this).
 *
 * Social pairings match the design already encoded in the (unreachable)
 * legacy SOCIAL_SKILL_PAIRS map in utils/socialConflicts.ts, verified
 * against the real Skill catalog (all skill names confirmed to exist,
 * category: 'social').
 *
 * Combat categories are derived from each skill's own description in the
 * Skill catalog (not guessed): Corpo a corpo = mani nude (unarmed); Armi da
 * botta/taglio = melee (bastoni/martelli/mazze, ascia/spada/pugnale); Armi
 * da fuoco/lancio/pesanti = ranged (revolver/fucili, archi/balestre,
 * cannoni/mortai/mitragliatrici).
 *
 * Defense is NOT a fixed pair like the social skills: the defender can
 * respond with any combat skill they're holding/using in the moment (parry
 * a blade with a blade, shoot back at a melee attacker if their gun is
 * already drawn, etc.), or dodge. So every combat attack skill's
 * counterSkills is the full combat skill set (including itself) + Schivare.
 *
 * Idempotent: upserts by skillName, safe to re-run.
 *
 * Usage: npm run seed:skill-confrontations
 */

import mongoose from 'mongoose';
import { SkillConfrontation } from '../models/SkillConfrontation';

const COMBAT_SKILLS = [
  'Armi da botta',
  'Armi da fuoco',
  'Armi da lancio',
  'Armi da taglio',
  'Armi pesanti',
  'Corpo a corpo',
] as const;

const COMBAT_COUNTERS = [
  ...COMBAT_SKILLS.map((skillName) => ({ skillName, label: skillName })),
  { skillName: 'Schivare', label: 'Schivata' },
];

const SOCIAL_CONFRONTATIONS = [
  {
    skillName: 'Ammaliare',
    category: 'social' as const,
    counterSkills: [{ skillName: 'Autocontrollo', label: 'Autocontrollo' }],
    rollType: 'open' as const,
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Persuadere',
    category: 'social' as const,
    counterSkills: [{ skillName: 'Tempra', label: 'Tempra' }],
    rollType: 'open' as const,
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Intimidire',
    category: 'social' as const,
    counterSkills: [{ skillName: 'Autocontrollo', label: 'Autocontrollo' }],
    rollType: 'open' as const,
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Oratoria',
    category: 'social' as const,
    counterSkills: [{ skillName: 'Tempra', label: 'Tempra' }],
    rollType: 'open' as const,
    requiresAdditionalMessage: false,
  },
  {
    skillName: 'Raggirare',
    category: 'social' as const,
    counterSkills: [{ skillName: 'Empatia', label: 'Empatia' }],
    rollType: 'hidden' as const,
    requiresAdditionalMessage: true,
    additionalMessageLabel: 'Intenzione nascosta (cosa pensi davvero)',
  },
];

const COMBAT_CONFRONTATIONS = [
  { skillName: 'Corpo a corpo', category: 'combat_unarmed' as const },
  { skillName: 'Armi da botta', category: 'combat_melee' as const },
  { skillName: 'Armi da taglio', category: 'combat_melee' as const },
  { skillName: 'Armi da fuoco', category: 'combat_ranged' as const },
  { skillName: 'Armi da lancio', category: 'combat_ranged' as const },
  { skillName: 'Armi pesanti', category: 'combat_ranged' as const },
].map((entry) => ({
  ...entry,
  counterSkills: COMBAT_COUNTERS,
  rollType: 'open' as const,
  requiresAdditionalMessage: false,
}));

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
  await mongoose.connect(uri);

  for (const config of [...SOCIAL_CONFRONTATIONS, ...COMBAT_CONFRONTATIONS]) {
    await SkillConfrontation.updateOne(
      { skillName: config.skillName },
      { $set: config },
      { upsert: true }
    );
    // eslint-disable-next-line no-console
    console.log(`Upserted SkillConfrontation: ${config.skillName}`);
  }

  await mongoose.disconnect();
}

seed()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exit(1);
  });
