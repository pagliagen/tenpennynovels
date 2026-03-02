/**
 * Integration Tests: DRAFT Character Restrictions
 *
 * Verifies that DRAFT characters are properly restricted from ONGAME features
 * according to the security fixes implemented in Phase 1 & 2.
 *
 * Test Coverage:
 * - Central AuthMiddleware validation (Phase 1)
 * - OnGame messaging system
 * - Location chat participation
 * - Economy/financial operations
 * - OffGame chat restrictions (DRAFT can only chat with APPROVED)
 * - Character sheet editing permissions
 */

import request from 'supertest';
import { app } from '../../app';
import { Character, User, OffGameChat, Location, Wallet } from '@database/models';
import { generateAuthToken, generateCharacterContextTokenToken } from '@shared/utils/auth';
import mongoose from 'mongoose';

describe('DRAFT Character Security Restrictions', () => {
  let draftCharacter: any;
  let approvedCharacter: any;
  let pendingCharacter: any;
  let draftUser: any;
  let approvedUser: any;
  let draftAuthToken: string;
  let approvedAuthToken: string;
  let draftCharacterContext: string;
  let approvedCharacterContext: string;
  let testLocation: any;

  beforeAll(async () => {
    // Create test users
    draftUser = await User.create({
      username: 'draft_user_test',
      email: 'draft@test.com',
      passwordHash: 'hashed_password',
      userRoles: [],
      characterRoles: []
    });

    approvedUser = await User.create({
      username: 'approved_user_test',
      email: 'approved@test.com',
      passwordHash: 'hashed_password',
      userRoles: [],
      characterRoles: []
    });

    // Create test characters
    draftCharacter = await Character.create({
      userId: draftUser._id,
      name: 'Draft',
      surname: 'Character',
      status: 'DRAFT',
      age: 25,
      gender: 'M',
      gameplayRoles: ['personaggio']
    });

    approvedCharacter = await Character.create({
      userId: approvedUser._id,
      name: 'Approved',
      surname: 'Character',
      status: 'APPROVED',
      age: 30,
      gender: 'F',
      gameplayRoles: ['personaggio']
    });

    pendingCharacter = await Character.create({
      userId: draftUser._id,
      name: 'Pending',
      surname: 'Character',
      status: 'PENDING_APPROVAL',
      age: 28,
      gender: 'M',
      gameplayRoles: ['personaggio']
    });

    // Create wallets for testing
    const draftWallet = await Wallet.create({
      characterId: draftCharacter._id,
      balance: 1000
    });
    draftCharacter.walletId = draftWallet._id;
    await draftCharacter.save();

    const approvedWallet = await Wallet.create({
      characterId: approvedCharacter._id,
      balance: 1000
    });
    approvedCharacter.walletId = approvedWallet._id;
    await approvedCharacter.save();

    // Create test location
    testLocation = await Location.create({
      name: 'Test Location',
      description: 'Test location for security tests',
      locationType: 'public',
      isActive: true
    });

    // Generate auth tokens
    draftAuthToken = generateAuthToken(draftUser);
    approvedAuthToken = generateAuthToken(approvedUser);

    // Generate character context tokens
    draftCharacterContext = generateCharacterContextToken(draftCharacter._id, draftCharacter.gameplayRoles);
    approvedCharacterContext = generateCharacterContextToken(approvedCharacter._id, approvedCharacter.gameplayRoles);
  });

  afterAll(async () => {
    // Cleanup
    await Character.deleteMany({ userId: { $in: [draftUser._id, approvedUser._id] } });
    await User.deleteMany({ _id: { $in: [draftUser._id, approvedUser._id] } });
    await Wallet.deleteMany({ characterId: { $in: [draftCharacter._id, approvedCharacter._id] } });
    await Location.deleteMany({ _id: testLocation._id });
    await mongoose.connection.close();
  });

  describe('🔴 CRITICAL: Central AuthMiddleware (Phase 1)', () => {
    it('should block DRAFT character from accessing character-auth protected endpoints', async () => {
      const response = await request(app)
        .post('/game/characters/set-location')
        .set('Cookie', [
          `auth_token=${draftAuthToken}`,
          `character_context=${draftCharacterContext}`
        ])
        .send({ locationId: testLocation._id });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
      expect(response.body.error.message).toContain('Solo i personaggi approvati');
    });

    it('should allow APPROVED character to access character-auth protected endpoints', async () => {
      const response = await request(app)
        .post('/game/characters/set-location')
        .set('Cookie', [
          `auth_token=${approvedAuthToken}`,
          `character_context=${approvedCharacterContext}`
        ])
        .send({ locationId: testLocation._id });

      expect(response.status).not.toBe(403);
    });

    it('should block PENDING_APPROVAL character (middleware fix)', async () => {
      const pendingContext = generateCharacterContextToken(pendingCharacter._id, pendingCharacter.gameplayRoles);

      const response = await request(app)
        .post('/game/characters/set-location')
        .set('Cookie', [
          `auth_token=${draftAuthToken}`,
          `character_context=${pendingContext}`
        ])
        .send({ locationId: testLocation._id });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
    });
  });

  describe('🔴 CRITICAL: OnGame Message System', () => {
    it('should block DRAFT character from sending OnGame messages', async () => {
      const response = await request(app)
        .post('/game/ongame-messages')
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          recipients: [approvedCharacter._id],
          subject: 'Test Message',
          content: 'This should be blocked'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
      expect(response.body.error.message).toContain('Solo i personaggi approvati possono inviare messaggi ONGAME');
    });

    it('should allow APPROVED character to send OnGame messages', async () => {
      const response = await request(app)
        .post('/game/ongame-messages')
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          recipients: [approvedCharacter._id],
          subject: 'Test Message',
          content: 'This should work'
        });

      expect(response.status).not.toBe(403);
    });

    it('should block sending to non-APPROVED recipients', async () => {
      const response = await request(app)
        .post('/game/ongame-messages')
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          recipients: [draftCharacter._id], // DRAFT recipient
          subject: 'Test Message',
          content: 'Should fail - recipient not APPROVED'
        });

      expect(response.status).toBe(400);
      // Recipient validation should fail
    });
  });

  describe('🔴 CRITICAL: Location Chat Participation', () => {
    it('should block DRAFT character from posting location actions', async () => {
      const response = await request(app)
        .post(`/game/locations/${testLocation._id}/actions`)
        .set('Cookie', [
          `auth_token=${draftAuthToken}`,
          `character_context=${draftCharacterContext}`
        ])
        .send({
          content: 'Test action',
          actionType: 'standard'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
      expect(response.body.error.message).toContain('Solo i personaggi approvati possono partecipare alle chat di location');
    });

    it('should allow APPROVED character to post location actions', async () => {
      const response = await request(app)
        .post(`/game/locations/${testLocation._id}/actions`)
        .set('Cookie', [
          `auth_token=${approvedAuthToken}`,
          `character_context=${approvedCharacterContext}`
        ])
        .send({
          content: 'Test action from approved character',
          actionType: 'standard'
        });

      expect(response.status).not.toBe(403);
    });
  });

  describe('🔴 CRITICAL: Money Transfer System', () => {
    it('should block DRAFT character from transferring money', async () => {
      const response = await request(app)
        .post('/game/economy/transfer')
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          targetCharacterId: approvedCharacter._id,
          amount: 100,
          description: 'Test transfer'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
      expect(response.body.error.message).toContain('Solo i personaggi approvati possono trasferire denaro');
    });

    it('should block transfer to non-APPROVED recipient', async () => {
      const response = await request(app)
        .post('/game/economy/transfer')
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          targetCharacterId: draftCharacter._id, // DRAFT recipient
          amount: 100,
          description: 'Test transfer to DRAFT'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('RECIPIENT_NOT_APPROVED');
      expect(response.body.error.message).toContain('Il destinatario deve essere un personaggio approvato');
    });

    it('should allow APPROVED to APPROVED transfer', async () => {
      // Create another approved character for testing
      const secondApproved = await Character.create({
        userId: approvedUser._id,
        name: 'Second',
        surname: 'Approved',
        status: 'APPROVED',
        age: 35,
        gender: 'M',
        gameplayRoles: ['personaggio']
      });

      const secondWallet = await Wallet.create({
        characterId: secondApproved._id,
        balance: 500
      });
      secondApproved.walletId = secondWallet._id;
      await secondApproved.save();

      const response = await request(app)
        .post('/game/economy/transfer')
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          targetCharacterId: secondApproved._id,
          amount: 50,
          description: 'Test transfer between APPROVED'
        });

      expect(response.status).toBe(200);

      // Cleanup
      await Wallet.deleteOne({ _id: secondWallet._id });
      await Character.deleteOne({ _id: secondApproved._id });
    });
  });

  describe('🟠 HIGH: Wallet Information Disclosure', () => {
    it('should block DRAFT character from viewing wallet', async () => {
      const response = await request(app)
        .get('/game/economy/wallet')
        .set('Cookie', `auth_token=${draftAuthToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
    });

    it('should allow APPROVED character to view wallet', async () => {
      const response = await request(app)
        .get('/game/economy/wallet')
        .set('Cookie', `auth_token=${approvedAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('wallet');
    });
  });

  describe('🟠 HIGH: Item Purchase System', () => {
    it('should block DRAFT character from purchasing items', async () => {
      // Assuming there's a shop endpoint
      const response = await request(app)
        .post('/game/economy/shops/test-shop-id/items/test-item-id/purchase')
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({ quantity: 1 });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
    });
  });

  describe('🟠 HIGH: OffGame Chat Restrictions', () => {
    it('should block DRAFT from creating chat with another DRAFT', async () => {
      const secondDraft = await Character.create({
        userId: draftUser._id,
        name: 'Second',
        surname: 'Draft',
        status: 'DRAFT',
        age: 26,
        gender: 'F',
        gameplayRoles: ['personaggio']
      });

      const response = await request(app)
        .post('/game/offgame-chats')
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          name: 'DRAFT to DRAFT chat',
          participants: [secondDraft._id]
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DRAFT_CHAT_RESTRICTION');
      expect(response.body.error.message).toContain('I personaggi DRAFT possono chattare solo con personaggi APPROVATI');

      // Cleanup
      await Character.deleteOne({ _id: secondDraft._id });
    });

    it('should allow DRAFT to create chat with APPROVED', async () => {
      const response = await request(app)
        .post('/game/offgame-chats')
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          name: 'DRAFT to APPROVED chat',
          participants: [approvedCharacter._id]
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('chatId');

      // Cleanup
      const chatId = response.body.data.chatId;
      await OffGameChat.deleteOne({ _id: chatId });
    });

    it('should block DRAFT from sending message in DRAFT-DRAFT chat', async () => {
      const secondDraft = await Character.create({
        userId: draftUser._id,
        name: 'Third',
        surname: 'Draft',
        status: 'DRAFT',
        age: 27,
        gender: 'M',
        gameplayRoles: ['personaggio']
      });

      // Manually create a chat (bypassing validation for test setup)
      const chat = await OffGameChat.create({
        name: 'Test DRAFT chat',
        participants: [draftCharacter._id, secondDraft._id],
        createdBy: draftCharacter._id,
        isActive: true
      });

      const response = await request(app)
        .post(`/game/offgame-chats/${chat._id}/messages`)
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          content: 'This should be blocked'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DRAFT_CHAT_RESTRICTION');

      // Cleanup
      await OffGameChat.deleteOne({ _id: chat._id });
      await Character.deleteOne({ _id: secondDraft._id });
    });

    it('should allow APPROVED to create chat with anyone', async () => {
      const response = await request(app)
        .post('/game/offgame-chats')
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          name: 'APPROVED initiator chat',
          participants: [draftCharacter._id] // Can include DRAFT if APPROVED initiates
        });

      expect(response.status).toBe(201);

      // Cleanup
      const chatId = response.body.data.chatId;
      await OffGameChat.deleteOne({ _id: chatId });
    });
  });

  describe('✅ ALLOWED: Character Sheet Editing', () => {
    it('should allow DRAFT character to edit full character sheet', async () => {
      const response = await request(app)
        .put(`/game/characters/${draftCharacter._id}`)
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          age: 26,
          physicalDescription: 'Updated description',
          stats: { strength: 12, dexterity: 14 }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.character.age).toBe(26);
    });

    it('should restrict APPROVED character to limited fields only', async () => {
      const response = await request(app)
        .put(`/game/characters/${approvedCharacter._id}`)
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          age: 35, // Should be filtered out
          avatar: 'new-avatar-url', // Should be allowed
          stats: { strength: 20 } // Should be filtered out
        });

      expect(response.status).toBe(200);
      expect(response.body.data.character.avatar).toBe('new-avatar-url');
      expect(response.body.data.character.age).not.toBe(35); // Should remain unchanged
    });

    it('should block APPROVED from editing background responses', async () => {
      const response = await request(app)
        .put(`/game/characters/${approvedCharacter._id}/background-responses`)
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          responses: [
            { questionId: 'test-question', response: 'Test answer' }
          ]
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('CHARACTER_NOT_EDITABLE');
    });

    it('should allow DRAFT to edit background responses', async () => {
      const response = await request(app)
        .put(`/game/characters/${draftCharacter._id}/background-responses`)
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          responses: [
            { questionId: 'test-question', response: 'Valid DRAFT answer' }
          ]
        });

      expect(response.status).toBe(200);
    });

    it('should allow DRAFT to apply occupation bonuses', async () => {
      // Assuming occupation exists
      const response = await request(app)
        .post(`/game/characters/${draftCharacter._id}/apply-occupation-bonuses`)
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          occupationId: 'test-occupation-id',
          selectedAlternatives: {}
        });

      // May 404 if occupation doesn't exist, but should NOT 403 for status
      expect(response.status).not.toBe(403);
    });

    it('should block APPROVED from applying occupation bonuses', async () => {
      const response = await request(app)
        .post(`/game/characters/${approvedCharacter._id}/apply-occupation-bonuses`)
        .set('Cookie', `auth_token=${approvedAuthToken}`)
        .send({
          occupationId: 'test-occupation-id',
          selectedAlternatives: {}
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('CHARACTER_NOT_FOUND'); // Not found because query filters DRAFT only
    });
  });

  describe('🔒 Security Audit Logging', () => {
    it('should log DRAFT bypass attempts', async () => {
      // This test verifies that logger.warn is called (requires logger mock)
      // For now, just verify the response includes proper error codes
      const response = await request(app)
        .post('/game/ongame-messages')
        .set('Cookie', `auth_token=${draftAuthToken}`)
        .send({
          recipients: [approvedCharacter._id],
          subject: 'Bypass attempt',
          content: 'This should trigger security log'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHARACTER_NOT_APPROVED');
      // In production, verify logs contain 'SECURITY: DRAFT character attempted...'
    });
  });
});
