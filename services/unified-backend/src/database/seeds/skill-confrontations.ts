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
 * Combat skills (Armi da botta/fuoco/lancio/taglio/pesanti, Corpo a corpo,
 * Schivare) are deliberately NOT seeded here — their category assignment
 * (combat_unarmed vs combat_melee vs combat_ranged) and counter-skill rules
 * need game-design input, not a guess.
 *
 * Idempotent: upserts by skillName, safe to re-run.
 *
 * Usage: npm run seed:skill-confrontations
 */

import mongoose from 'mongoose';
import { SkillConfrontation } from '../models/SkillConfrontation';

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

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
  await mongoose.connect(uri);

  for (const config of SOCIAL_CONFRONTATIONS) {
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
