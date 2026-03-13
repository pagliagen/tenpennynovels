import mongoose from 'mongoose';
import { SkillConfrontation } from '../models/SkillConfrontation';

/**
 * Seed: SkillConfrontation Configuration
 *
 * Seeds the SkillConfrontation collection with combat and social skill configurations.
 * Phase 1 seeds only Corpo a Corpo (unarmed combat) for proof of concept.
 *
 * Run with: npm run seed:skill-confrontations
 */

export async function seedSkillConfrontations() {
  console.log('[Seed] Starting SkillConfrontation seed...');

  try {
    // Clear existing configurations (development only - remove this in production)
    const existing = await SkillConfrontation.countDocuments();
    if (existing > 0) {
      console.log(`[Seed] Found ${existing} existing configurations. Clearing...`);
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
    console.log('[Seed] ✅ Created: Corpo a Corpo configuration');

    // Future phases will add:
    // - Armi da botta (melee_blunt)
    // - Armi da taglio (melee_blade)
    // - Armi da fuoco (ranged_firearm)
    // - Intimidire, Persuadere, Ammaliare, Raggirare, Oratoria (social)

    console.log('[Seed] ✅ Seed complete: 1 configuration created');

    // Verify
    const count = await SkillConfrontation.countDocuments();
    console.log(`[Seed] Verification: ${count} configurations in database`);

    return { success: true, count };
  } catch (error) {
    console.error('[Seed] Fatal error:', error);
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
      console.log('[Seed] Connected to MongoDB');

      // Run seed
      await seedSkillConfrontations();

      // Disconnect
      await mongoose.disconnect();
      console.log('[Seed] Disconnected from MongoDB');

      process.exit(0);
    } catch (error) {
      console.error('[Seed] Failed:', error);
      process.exit(1);
    }
  })();
}
