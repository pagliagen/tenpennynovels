/**
 * User Seeder - Standalone Script
 *
 * Creates initial admin users and test accounts.
 * IMPORTANT: When using --force, deletes Characters FIRST to avoid orphaned records.
 *
 * NO dependencies on unified-backend mongoose models.
 */

import { getConnection } from '../utils/connection.js';
import * as bcrypt from 'bcryptjs';

export class UserSeeder {
  name = 'users';
  description = 'Seed initial users (admin accounts, test users)';

  async seed(force: boolean = false): Promise<void> {
    const { client, db } = await getConnection();

    try {
      const usersCollection = db.collection('users');
      const charactersCollection = db.collection('characters');

      console.log('👤 User Seeder\n');

      // Check if admin users already exist
      const adminCount = await usersCollection.countDocuments({ canAccessAdminPanel: true });

      if (adminCount > 0 && !force) {
        console.log(`   ℹ️  ${adminCount} admin users already exist, skipping seeding`);
        console.log('   💡 Use --force to re-seed\n');
        return;
      }

      // Admin accounts to seed
      const adminAccounts = [
        {
          username: 'admin',
          email: 'gennaro.paglia@gmail.com',
          password: 'admin123',
          displayName: 'System Administrator'
        },
        {
          username: 'tibbi',
          email: 'gdrplayer89@gmail.com',
          password: 'tibbi',
          displayName: 'Tibbi'
        },
        {
          username: 'susi',
          email: 'tenpennynovels@gmail.com',
          password: 'susi',
          displayName: 'Susanna'
        },
        {
          username: 'linda',
          email: 'sonolindanegrini@gmail.com',
          password: 'linda',
          displayName: 'Linda'
        }
      ];

      // CRITICAL: Delete Characters FIRST if --force flag is used
      if (force && adminCount > 0) {
        console.log('🗑️  --force flag detected, performing cascade deletion...\n');

        // Get userIds for admin users
        const adminUsernames = adminAccounts.map(u => u.username);
        const existingUsers = await usersCollection.find({
          username: { $in: adminUsernames }
        }).toArray();

        if (existingUsers.length > 0) {
          const userIds = existingUsers.map((u: any) => u._id);

          // STEP 1: Delete Characters FIRST (cascade)
          const deletedCharacters = await charactersCollection.deleteMany({
            userId: { $in: userIds }
          });
          console.log(`   ✓ Deleted ${deletedCharacters.deletedCount} characters\n`);

          // STEP 2: Delete Users
          const deletedUsers = await usersCollection.deleteMany({
            username: { $in: adminUsernames }
          });
          console.log(`   ✓ Deleted ${deletedUsers.deletedCount} users\n`);
        }
      }

      // STEP 3: Create admin users
      console.log('👤 Creating admin users...\n');

      for (const admin of adminAccounts) {
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
          userRoles: ['gestore'],
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

        await usersCollection.insertOne(adminData);
        console.log(`   ✓ Created admin: ${adminData.username}/${admin.password}`);
      }

      console.log('');

      // Create test user
      console.log('👤 Creating test user...\n');

      const testUserData = {
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
      };

      const existingTestUser = await usersCollection.findOne({ username: testUserData.username });
      if (!existingTestUser || force) {
        if (force && existingTestUser) {
          // Delete test user's characters first
          await charactersCollection.deleteMany({ userId: existingTestUser._id });
          await usersCollection.deleteOne({ username: testUserData.username });
        }

        await usersCollection.insertOne(testUserData);
        console.log('   ✓ Created test user: testuser/test123\n');
      }

      // Stats
      const totalUsers = await usersCollection.countDocuments({});
      const totalAdmins = await usersCollection.countDocuments({ canAccessAdminPanel: true });

      console.log('📊 Stats:');
      console.log(`   Total users: ${totalUsers}`);
      console.log(`   Admin users: ${totalAdmins}\n`);

      console.log('✅ User seeding completed');

    } catch (error) {
      console.error('❌ UserSeeder error:', error);
      throw error;
    } finally {
      await client.close();
    }
  }
}

// Run seeder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new UserSeeder();
  const force = process.argv.includes('--force');

  seeder.seed(force)
    .then(() => {
      console.log('👋 Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}
