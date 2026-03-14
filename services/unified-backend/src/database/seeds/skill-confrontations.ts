import mongoose from 'mongoose';
import { SkillConfrontation } from '../models/SkillConfrontation';
import { logger } from '@shared/utils/logger';

/**
 * Seed: SkillConfrontation Configuration
 *
 * Seeds the SkillConfrontation collection with combat and social skill configurations.
 * Phase 1 seeds only Corpo a Corpo (unarmed combat) for proof of concept.
 *
 * Run with: npm run seed:skill-confrontations
 */

export async function seedSkillConfrontations() {
  logger.info('[Seed] Starting SkillConfrontation seed...');

  try {
    // Clear existing configurations (development only - remove this in production)
    const existing = await SkillConfrontation.countDocuments();
    if (existing > 0) {
      logger.info(`[Seed] Found ${existing} existing configurations. Clearing...`);
      await SkillConfrontation.deleteMany({});
    }

    // Phase 1: Corpo a Corpo (unarmed combat with multi-defense)
    const corpoACorpoConfig = {
      skillName: 'Corpo a Corpo',
      category: 'combat_unarmed',
      counterSkills: [
        {
          skillName: 'Schivata',
          label: 'Schivata'
        },
        {
          skillName: 'Corpo a Corpo',
          label: 'Parata (Corpo a Corpo)'
        }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(corpoACorpoConfig);
    logger.info('[Seed] Created: Corpo a Corpo configuration');

    // Phase 2: Armi da botta (blunt weapons)
    const armiDaBottaConfig = {
      skillName: 'Armi da botta',
      category: 'combat_melee',
      counterSkills: [
        { skillName: 'Schivata', label: 'Schivata' },
        { skillName: 'Armi da botta', label: 'Parata (Armi da botta)' }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(armiDaBottaConfig);
    logger.info('[Seed] Created: Armi da botta configuration');

    // Phase 2: Armi da taglio (bladed weapons)
    const armiDaTaglioConfig = {
      skillName: 'Armi da taglio',
      category: 'combat_melee',
      counterSkills: [
        { skillName: 'Schivata', label: 'Schivata' },
        { skillName: 'Armi da taglio', label: 'Parata (Armi da taglio)' }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(armiDaTaglioConfig);
    logger.info('[Seed] Created: Armi da taglio configuration');

    // Phase 2: Armi da fuoco (firearms)
    const armiDaFuocoConfig = {
      skillName: 'Armi da fuoco',
      category: 'combat_ranged',
      counterSkills: [
        { skillName: 'Schivata', label: 'Schivata' }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(armiDaFuocoConfig);
    logger.info('[Seed] Created: Armi da fuoco configuration');

    // Phase 3: Raggirare (hidden two-phase)
    const raggirareConfig = {
      skillName: 'Raggirare',
      category: 'social',
      counterSkills: [
        { skillName: 'Empatia', label: 'Empatia (Rilevare bugia)' }
      ],
      rollType: 'hidden',
      requiresAdditionalMessage: true,
      additionalMessageLabel: 'Testo della bugia (visibile solo al master)'
    };

    await SkillConfrontation.create(raggirareConfig);
    logger.info('[Seed] Created: Raggirare configuration');

    // Phase 4: Social conflicts
    const intimidireConfig = {
      skillName: 'Intimidire',
      category: 'social',
      counterSkills: [
        { skillName: 'Autocontrollo', label: 'Autocontrollo' }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(intimidireConfig);
    logger.info('[Seed] Created: Intimidire configuration');

    const persuadereConfig = {
      skillName: 'Persuadere',
      category: 'social',
      counterSkills: [
        { skillName: 'Empatia', label: 'Empatia' }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(persuadereConfig);
    logger.info('[Seed] Created: Persuadere configuration');

    const ammaliareConfig = {
      skillName: 'Ammaliare',
      category: 'social',
      counterSkills: [
        { skillName: 'Autocontrollo', label: 'Autocontrollo' }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(ammaliareConfig);
    logger.info('[Seed] Created: Ammaliare configuration');

    const oratoriaConfig = {
      skillName: 'Oratoria',
      category: 'social',
      counterSkills: [
        { skillName: 'Empatia', label: 'Empatia' }
      ],
      rollType: 'open',
      requiresAdditionalMessage: false
    };

    await SkillConfrontation.create(oratoriaConfig);
    logger.info('[Seed] Created: Oratoria configuration');

    logger.info('[Seed] Seed complete: 8 configurations created (4 combat + 4 social)');

    // Verify
    const count = await SkillConfrontation.countDocuments();
    logger.info(`[Seed] Verification: ${count} configurations in database`);

    return { success: true, count };
  } catch (error) {
    logger.error('[Seed] Fatal error:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      // Connect to MongoDB
      const mongoUri = process.env.MONGO_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
      await mongoose.connect(mongoUri);
      logger.info('[Seed] Connected to MongoDB');

      // Run seed
      await seedSkillConfrontations();

      // Disconnect
      await mongoose.disconnect();
      logger.info('[Seed] Disconnected from MongoDB');

      process.exit(0);
    } catch (error) {
      logger.error('[Seed] Failed:', error);
      process.exit(1);
    }
  })();
}
