/**
 * Database Migration: Convert Character Skills from Name Keys to ObjectId Keys
 *
 * **Problem**: Characters have skills stored with Italian name keys (e.g., "Finanza", "Armi da botta")
 * but the new system uses ObjectId keys (e.g., "699f40ffe64a58b319bbb170").
 *
 * **Solution**: This migration converts all existing characters' skills from name-based keys
 * to ObjectId-based keys by looking up each skill name in the Skill collection.
 *
 * **Usage**:
 * ```bash
 * cd services/unified-backend
 * npm run migration:skills-objectid
 * # OR manually:
 * npx ts-node src/database/migrations/migrate-skills-to-objectid-keys.ts
 * ```
 *
 * **Safety**:
 * - Idempotent: Can be run multiple times safely (skips already-migrated characters)
 * - Read-only check first: Logs what would change without --execute flag
 * - Validates all skill names exist before migrating each character
 *
 * **Rollback**: Not needed - migration is one-way (name → ObjectId)
 */

import mongoose from 'mongoose';
import { Character } from '../models/Character';
import { Skill } from '../models/Skill';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');
const isVerbose = args.includes('--verbose');

interface MigrationStats {
  total: number;
  alreadyMigrated: number;
  migrated: number;
  failed: number;
  errors: Array<{ characterId: string; characterName: string; error: string }>;
}

/**
 * Check if a key is an ObjectId (24 hex characters)
 */
function isObjectIdKey(key: string): boolean {
  return /^[0-9a-f]{24}$/i.test(key);
}

/**
 * Migrate a single character's skills from name keys to ObjectId keys
 */
async function migrateCharacterSkills(
  character: any,
  nameToIdMap: Map<string, string>,
  stats: MigrationStats
): Promise<void> {
  const oldSkills = character.skills;
  const newSkills = new Map<string, any>();
  let hasNameKeys = false;
  const missingSkills: string[] = [];

  if (!oldSkills || oldSkills.size === 0) {
    stats.alreadyMigrated++;
    if (isVerbose) {
      console.log(`  ⊘ Character ${character._id} (${character.name}) has no skills - skipping`);
    }
    return;
  }

  // Analyze current skills
  oldSkills.forEach((breakdown: any, key: string) => {
    if (isObjectIdKey(key)) {
      // Already ObjectId - keep as-is
      newSkills.set(key, breakdown);
    } else {
      // Name key - needs migration
      hasNameKeys = true;
      const objectId = nameToIdMap.get(key);

      if (objectId) {
        newSkills.set(objectId, breakdown);
        if (isVerbose) {
          console.log(`    ✓ "${key}" → ${objectId}`);
        }
      } else {
        missingSkills.push(key);
        console.warn(`    ⚠ Skill not found in database: "${key}" (character ${character._id})`);
      }
    }
  });

  // Check for errors
  if (missingSkills.length > 0) {
    const error = `Missing skills in database: ${missingSkills.join(', ')}`;
    stats.errors.push({
      characterId: character._id.toString(),
      characterName: character.name,
      error
    });
    stats.failed++;
    console.error(`  ✗ Failed: ${error}`);
    return;
  }

  // Apply migration if needed
  if (hasNameKeys) {
    if (isDryRun) {
      console.log(`  ▶ Would migrate character ${character._id} (${character.name}) - ${oldSkills.size} skills`);
    } else {
      character.skills = newSkills;
      character.markModified('skills');
      await character.save();
      console.log(`  ✓ Migrated character ${character._id} (${character.name}) - ${oldSkills.size} skills`);
    }
    stats.migrated++;
  } else {
    stats.alreadyMigrated++;
    if (isVerbose) {
      console.log(`  ⊘ Character ${character._id} (${character.name}) already uses ObjectId keys - skipping`);
    }
  }
}

/**
 * Main migration function
 */
async function migrateSkillsToObjectIdKeys(): Promise<void> {
  console.log('='.repeat(80));
  console.log('CHARACTER SKILLS MIGRATION: Name Keys → ObjectId Keys');
  console.log('='.repeat(80));
  console.log();

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made to the database');
    console.log('   Run with --execute flag to apply changes');
    console.log();
  }

  if (isVerbose) {
    console.log('📋 VERBOSE MODE - Detailed output enabled');
    console.log();
  }

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tenpennynovels';
  console.log(`📡 Connecting to: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');
  console.log();

  // Initialize stats
  const stats: MigrationStats = {
    total: 0,
    alreadyMigrated: 0,
    migrated: 0,
    failed: 0,
    errors: []
  };

  try {
    // Step 1: Fetch all skills and build name → ObjectId map
    console.log('📖 Step 1: Building skill name → ObjectId lookup map...');
    const allSkills = await Skill.find({});
    const nameToIdMap = new Map<string, string>();

    allSkills.forEach(skill => {
      nameToIdMap.set(skill.name, skill._id.toString());
    });

    console.log(`✓ Loaded ${allSkills.length} skills from database`);
    if (isVerbose) {
      console.log(`  Sample mappings:`);
      Array.from(nameToIdMap.entries()).slice(0, 5).forEach(([name, id]) => {
        console.log(`    "${name}" → ${id}`);
      });
    }
    console.log();

    // Step 2: Fetch all characters
    console.log('📖 Step 2: Fetching characters...');
    const characters = await Character.find({
      status: { $ne: 'DELETED' }
    });
    stats.total = characters.length;

    console.log(`✓ Found ${characters.length} characters (excluding DELETED)`);
    console.log();

    // Step 3: Migrate each character
    console.log('🔄 Step 3: Processing characters...');
    console.log();

    for (const character of characters) {
      await migrateCharacterSkills(character, nameToIdMap, stats);
    }

    // Step 4: Print summary
    console.log();
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total characters:        ${stats.total}`);
    console.log(`Already migrated:        ${stats.alreadyMigrated} (no action needed)`);
    console.log(`${isDryRun ? 'Would migrate' : 'Migrated'}:          ${stats.migrated}`);
    console.log(`Failed:                  ${stats.failed}`);
    console.log();

    if (stats.errors.length > 0) {
      console.log('❌ ERRORS:');
      stats.errors.forEach((err, idx) => {
        console.log(`${idx + 1}. Character ${err.characterId} (${err.characterName})`);
        console.log(`   Error: ${err.error}`);
      });
      console.log();
    }

    if (isDryRun && stats.migrated > 0) {
      console.log('⚠️  To apply these changes, run with: --execute');
    } else if (!isDryRun && stats.migrated > 0) {
      console.log('✅ Migration completed successfully!');
    } else if (stats.migrated === 0 && stats.alreadyMigrated === stats.total) {
      console.log('✅ All characters already migrated - no action needed');
    }

  } catch (error: any) {
    console.error('❌ Migration failed with error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  migrateSkillsToObjectIdKeys()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { migrateSkillsToObjectIdKeys };
