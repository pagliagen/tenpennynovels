/**
 * User Seeder - Standalone Script
 *
 * Creates initial admin users and test accounts.
 * When using --force, deletes Characters FIRST to avoid orphaned records.
 */

import { getConnection } from '../utils/connection.js';
import * as bcrypt from 'bcryptjs';

const ADMIN_ACCOUNTS = [
  { username: 'admin', email: 'gennaro.paglia@gmail.com', password: 'admin123', displayName: 'System Administrator', isGestore: true },
  { username: 'tibbi', email: 'gdrplayer89@gmail.com', password: 'tibbi', displayName: 'Tibbi', isGestore: false },
  { username: 'susi', email: 'tenpennynovels@gmail.com', password: 'susi', displayName: 'Susanna', isGestore: false },
  { username: 'linda', email: 'sonolindanegrini@gmail.com', password: 'linda', displayName: 'Linda', isGestore: false }
];

async function seedUsers() {
  console.log('👤 User Seeder\n');
  const { client, db } = await getConnection();
  const force = process.argv.includes('--force');

  try {
    const usersCol = db.collection('users');
    const charsCol = db.collection('characters');

    const adminUsernames = ADMIN_ACCOUNTS.map(u => u.username);
    const existingAdmins = await usersCol.countDocuments({ username: { $in: adminUsernames } });

    if (existingAdmins > 0 && !force) {
      console.log(`   ℹ️  ${existingAdmins} admin users already exist, skipping`);
      console.log('   💡 Use --force to re-seed\n');
      return;
    }

    if (force && existingAdmins > 0) {
      console.log('   🗑️  --force: cascade deleting existing admin data...');

      const existingUsers = await usersCol.find({ username: { $in: adminUsernames } }).toArray();
      const userIds = existingUsers.map((u: any) => u._id);

      if (userIds.length > 0) {
        const delChars = await charsCol.deleteMany({ $or: [
          { userId: { $in: userIds } },
          { name: { $in: adminUsernames } }
        ]});
        console.log(`   ✓ Deleted ${delChars.deletedCount} characters`);
      }

      const delUsers = await usersCol.deleteMany({ username: { $in: adminUsernames } });
      console.log(`   ✓ Deleted ${delUsers.deletedCount} users\n`);
    }

    console.log('   👤 Creating admin users...\n');

    for (const admin of ADMIN_ACCOUNTS) {
      const existing = await usersCol.findOne({ username: admin.username });
      if (existing) {
        console.log(`   ⏭️  ${admin.username} already exists, skipping`);
        continue;
      }

      const adminData = {
        username: admin.username,
        email: admin.email,
        passwordHash: await bcrypt.hash(admin.password, 12),
        displayName: admin.displayName,
        isEmailVerified: true,
        canAccessAdminPanel: admin.isGestore,
        isActive: true,
        isBanned: false,
        multipleCharactersAllowed: false,
        userRoles: ['user'],
        characterRoles: ['amministratore'],
        characterPermissions: [],
        preferences: {
          emailNotifications: true,
          marketingEmails: false,
          theme: 'victorian_dark',
          language: 'it',
          timezone: 'Europe/Rome'
        },
        loginCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const userResult = await usersCol.insertOne(adminData);
      console.log(`   ✓ Created admin: ${admin.username}`);

      // Get or create default location (Londra)
      const defaultLocation = await db.collection('locations').findOne({ slug: 'london' });
      const locationId = defaultLocation?._id || new (await import('mongodb')).ObjectId();

      await charsCol.insertOne({
        characterType: 'pg_master',
        userId: userResult.insertedId,
        name: admin.displayName || admin.username,
        playerStatus: 'approved',
        canAccessAdminPanel: admin.isGestore,
        isGestore: admin.isGestore,
        gameplayRoles: ['master'],
        characterPermissions: [],
        adminPermissions: [],
        skills: {},
        equipment: [],
        currentLocation: locationId,
        isActive: false,
        isBanned: false,
        stats: {
          strength: 50,
          constitution: 50,
          size: 50,
          dexterity: 50,
          appearance: 50,
          intelligence: 50,
          power: 50,
          education: 50
        },
        derived: {
          ideaRoll: 50,
          luckRoll: 50,
          knowledge: 50,
          hitPoints: 10,
          sanity: 50,
          maxSanity: 50,
          magicPoints: 10,
          movementRate: 8,
          bonusDamage: '0',
          build: 0
        },
        forumStats: {
          followerCount: 0,
          followingCount: 0,
          postCount: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: userResult.insertedId,
        approvedByName: 'System'
      });
      console.log(`   ✓ Created admin character: ${admin.displayName || admin.username} (isGestore=${admin.isGestore})`);
    }

    // Test user
    console.log('\n   👤 Creating test user...');
    const existingTest = await usersCol.findOne({ username: 'testuser' });

    if (existingTest && force) {
      await charsCol.deleteMany({ userId: existingTest._id });
      await usersCol.deleteOne({ username: 'testuser' });
    }

    if (!existingTest || force) {
      await usersCol.insertOne({
        username: 'testuser',
        email: 'test@tenpennynovels.com',
        passwordHash: await bcrypt.hash('test123', 12),
        displayName: 'Test User',
        isEmailVerified: true,
        canAccessAdminPanel: false,
        isActive: true,
        isBanned: false,
        multipleCharactersAllowed: false,
        userRoles: ['user'],
        characterRoles: ['personaggio'],
        characterPermissions: [],
        preferences: {
          emailNotifications: true,
          marketingEmails: false,
          theme: 'victorian_dark',
          language: 'it',
          timezone: 'Europe/Rome'
        },
        loginCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('   ✓ Created test user: testuser/test123');
    } else {
      console.log('   ⏭️  testuser already exists, skipping');
    }

    // Stats
    const totalUsers = await usersCol.countDocuments({});
    const totalAdmins = await usersCol.countDocuments({ canAccessAdminPanel: true });
    console.log(`\n📊 Stats: ${totalUsers} users total, ${totalAdmins} admins\n`);

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedUsers();
