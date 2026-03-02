# Security Integration Tests

## Overview

This directory contains integration tests for the **DRAFT Character Security Restrictions** implemented in the permission system security audit.

## Test Coverage

### 🔴 CRITICAL Vulnerabilities (Fixed)

1. **Central AuthMiddleware** - Blocks DRAFT/PENDING from `requireCharacterAuth` endpoints
2. **OnGame Message System** - DRAFT cannot send postal messages
3. **Location Chat Participation** - DRAFT cannot post location actions
4. **Money Transfer System** - DRAFT cannot transfer money, recipients must be APPROVED

### 🟠 HIGH Vulnerabilities (Fixed)

5. **Wallet Information Disclosure** - DRAFT cannot view wallet data
6. **Item Purchase System** - DRAFT cannot purchase items
7. **OffGame Chat Restrictions** - DRAFT can only chat with APPROVED participants
8. **OffGame Messaging** - DRAFT cannot send messages in DRAFT-DRAFT chats

### ✅ ALLOWED Features (Verified)

9. **Character Sheet Editing** - DRAFT has full editing, APPROVED has limited editing
10. **Background Responses** - DRAFT can edit, APPROVED cannot
11. **Occupation Bonuses** - DRAFT can apply, APPROVED cannot

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Ensure test database is configured
cp .env.example .env.test
# Edit .env.test with test database credentials
```

### Run All Security Tests

```bash
# Run all tests in security directory
npm test -- src/__tests__/security

# Run with coverage
npm test -- --coverage src/__tests__/security

# Run in watch mode (for development)
npm test -- --watch src/__tests__/security
```

### Run Specific Test Suites

```bash
# Only CRITICAL vulnerabilities
npm test -- -t "CRITICAL"

# Only OffGame chat restrictions
npm test -- -t "OffGame Chat"

# Only character sheet editing
npm test -- -t "ALLOWED: Character Sheet"
```

## Test Structure

```typescript
describe('DRAFT Character Security Restrictions', () => {
  beforeAll(async () => {
    // Setup: Create DRAFT, APPROVED, PENDING characters
    // Create wallets, locations, etc.
  });

  afterAll(async () => {
    // Cleanup: Remove test data
  });

  describe('🔴 CRITICAL: Category Name', () => {
    it('should block DRAFT character from ...', async () => {
      // Test that DRAFT gets 403 with CHARACTER_NOT_APPROVED
    });

    it('should allow APPROVED character to ...', async () => {
      // Test that APPROVED succeeds
    });
  });
});
```

## Expected Results

All tests should **PASS** after security fixes are deployed:

- ✅ DRAFT characters blocked from ONGAME features (403 errors)
- ✅ APPROVED characters allowed full access (200/201 responses)
- ✅ DRAFT can edit character sheet and chat with APPROVED only
- ✅ Security audit logs generated for bypass attempts

## Failure Scenarios

### If Tests Fail

1. **403 errors not returned**: Middleware fix not applied
   - Check `src/modules/game/middleware/auth.ts` line 185-189
   - Verify `status: 'APPROVED'` filter is present

2. **DRAFT can still access features**: Controller validation missing
   - Check individual controller methods for status validation
   - Verify defense-in-depth pattern is implemented

3. **OffGame chat allows DRAFT-DRAFT**: Custom logic not applied
   - Check `OffGameChatController.createChat()` line 86-144
   - Check `OffGameChatController.sendMessage()` line 468-540

4. **Character editing blocked incorrectly**: Status filters too strict
   - Check `CharacterController.updateCharacter()` line 825-870
   - Verify limited fields allowed for APPROVED

## Manual Testing

### Test DRAFT Restrictions (Manual)

1. Create a DRAFT character via admin panel
2. Obtain `auth_token` (user-level JWT)
3. Attempt to call protected endpoints:

```bash
# Should return 403
curl -X POST http://localhost:3001/game/ongame-messages \
  -H "Cookie: auth_token=<draft-token>" \
  -d '{"recipients":["char123"],"content":"Test"}'

# Should return 403
curl -X POST http://localhost:3001/game/economy/transfer \
  -H "Cookie: auth_token=<draft-token>" \
  -d '{"targetCharacterId":"char456","amount":100}'
```

### Test APPROVED Access (Manual)

1. Create an APPROVED character
2. Obtain tokens
3. Verify same endpoints return 200/201

```bash
# Should succeed
curl -X POST http://localhost:3001/game/ongame-messages \
  -H "Cookie: auth_token=<approved-token>" \
  -d '{"recipients":["approved-char"],"content":"Test"}'
```

## Security Audit Logging

All security tests verify that blocked attempts generate audit logs:

```
logger.warn('SECURITY: DRAFT character attempted restricted action', {
  characterId,
  characterStatus,
  endpoint,
  userId
});
```

### Checking Logs

```bash
# During test execution, verify logs contain:
grep "SECURITY: DRAFT character attempted" logs/test.log
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/security-tests.yml
- name: Run Security Tests
  run: npm test -- src/__tests__/security --ci --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Related Documentation

- [Security Audit Plan](/Users/gennaropaglia/.claude/plans/twinkling-painting-sun.md)
- [API Documentation](../../../docs/api-docs.md)
- [Character Status System](../../../docs/systems/character-status.md)

## Reporting Issues

If tests reveal new vulnerabilities:

1. Create an issue with `security` label
2. Include test case that reproduces the issue
3. Provide request/response logs
4. Tag security team for immediate review

---

**Last Updated**: 2026-02-23
**Test Coverage**: 10 vulnerability categories
**Status**: ✅ All fixes implemented and verified
