/**
 * User Seeder - Standalone Script
 *
 * Creates initial admin users and test accounts.
 * When using --force, deletes Characters FIRST to avoid orphaned records.
 */

import { getConnection } from '../utils/connection.js';
import * as bcrypt from 'bcryptjs';

const ADMIN_ACCOUNTS = [
  { username: 'admin', email: 'gennaro.paglia@gmail.com', password: 'admin123', displayName: 'System Administrator' },
  { username: 'tibbi', email: 'gdrplayer89@gmail.com', password: 'tibbi', displayName: 'Tibbi' },
  { username: 'susi', email: 'tenpennynovels@gmail.com', password: 'susi', displayName: 'Susanna' },
  { username: 'linda', email: 'sonolindanegrini@gmail.com', password: 'linda', displayName: 'Linda' }
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
        canAccessAdminPanel: true,
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

      await charsCol.insertOne({
        userId: userResult.insertedId,
        name: admin.username,
        status: 'APPROVED',
        adminRoles: ['amministratore'],
        gameplayRoles: ['master'],
        isGestore: true,
        characterPermissions: [],
        skills: {},
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: userResult.insertedId,
        approvedByName: 'System'
      });
      console.log(`   ✓ Created admin character: ${admin.username} (isGestore=true)`);
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
