import mongoose from 'mongoose';
import { Chat } from '../models/Chat';

/**
 * Migration: socialConflict → confrontation
 *
 * Converts legacy socialConflict field to unified confrontation field.
 * This migration maintains backward compatibility during transition period.
 *
 * Run with: npm run migrate:social-conflict
 */

export async function migrateSocialConflictToConfrontation() {
  console.log('[Migration] Starting socialConflict → confrontation migration...');

  try {
    // Find all messages with socialConflict field
    const messages = await Chat.find({ socialConflict: { $exists: true } }).lean();

    console.log(`[Migration] Found ${messages.length} messages to migrate`);

    let migrated = 0;
    let errors = 0;

    for (const msg of messages) {
      try {
        const sc = (msg as any).socialConflict;

        // Build confrontation object from socialConflict data
        const confrontation: any = {
          type: 'social',
          phase: 'result',
          attackerCharacterId: msg.characterId,
          defenderCharacterId: sc.defenderCharacterId || 'unknown',
          attackSkill: sc.attackerSkill,
          defenseSkill: sc.defenderSkill,
          attackRoll: sc.attackerRoll,
          defenseRoll: sc.defenderRoll,
          attackSuccessLevel: sc.attackerSuccessDegree,
          defenseSuccessLevel: sc.defenderSuccessDegree,
          outcome: mapLegacyOutcome(sc.result)
        };

        // Preserve Raggirare-specific fields if present
        if (sc.messageForDefender) {
          confrontation.messageForDefender = sc.messageForDefender;
          confrontation.visibleToDefenderOnly = sc.visibleToDefenderOnly || false;
        }

        // Update message with confrontation field, remove socialConflict
        await Chat.updateOne(
          { _id: msg._id },
          {
            $set: { confrontation },
            $unset: { socialConflict: '' }
          }
        );

        migrated++;

        if (migrated % 100 === 0) {
          console.log(`[Migration] Progress: ${migrated}/${messages.length}`);
        }
      } catch (error) {
        console.error(`[Migration] Error migrating message ${msg._id}:`, error);
        errors++;
      }
    }

    console.log(`[Migration] Complete: ${migrated} migrated, ${errors} errors`);

    // Verify migration
    const remaining = await Chat.countDocuments({ socialConflict: { $exists: true } });
    console.log(`[Migration] Verification: ${remaining} messages still have socialConflict`);

    if (remaining > 0) {
      console.warn('[Migration] WARNING: Some messages were not migrated. Check logs above.');
    }

    return { migrated, errors, remaining };
  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    throw error;
  }
}

/**
 * Maps legacy result strings to confrontation outcomes
 */
function mapLegacyOutcome(legacyResult: string): string {
  // Legacy results were descriptive strings like "attacker wins", "defender wins", etc.
  const normalized = legacyResult.toLowerCase();

  if (normalized.includes('attacker') && normalized.includes('win')) {
    return 'attacker_wins';
  }
  if (normalized.includes('defender') && normalized.includes('win')) {
    return 'defender_wins';
  }
  if (normalized.includes('draw') || normalized.includes('tie')) {
    return 'draw';
  }

  // Default fallback
  return 'attacker_wins';
}

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      // Connect to MongoDB
      const mongoUri = process.env.MONGO_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
      await mongoose.connect(mongoUri);
      console.log('[Migration] Connected to MongoDB');

      // Run migration
      const result = await migrateSocialConflictToConfrontation();

      // Disconnect
      await mongoose.disconnect();
      console.log('[Migration] Disconnected from MongoDB');

      // Exit with appropriate code
      process.exit(result.errors > 0 ? 1 : 0);
    } catch (error) {
      console.error('[Migration] Failed:', error);
      process.exit(1);
    }
  })();
}
