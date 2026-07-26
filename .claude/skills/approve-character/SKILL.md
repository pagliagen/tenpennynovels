---
name: approve-character
description: Approve character and set up finances. Use when you need to approve a pending character, activate a character, or initialize character finances and equipment.
user-invocable: true
---

## Overview
AI-driven command to approve a character directly in MongoDB, replicating the complete logic of `POST /admin/characters/:characterId/approve` endpoint from management-backend.

## Usage Pattern
/approve-character [characterId]

Example:
- /approve-character 693dda96dfe0250b25663311

## MongoDB Credentials
- URI: `mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin`
- Database: `tenpennynovels`
- Credentials from: `docker-compose.yml`

## Required Models
Check `services/unified-backend/src/database/models/` for available models:
- `Character` - Character model
- `Occupation` - Occupation model (for starting items)
- `CharacterFinances` - Character finances model
- `SocialClassConfig` - Social class configuration
- `User` - User model (for reviewedBy)

## Fields Updated in Character

When a character is approved:
1. **equipment** - Array of ObjectIds from occupation starting items
2. **status** - Set to `'APPROVED'`
3. **approvedAt** - Set to `new Date()`
4. **approvedBy** - Set to system user ID found in database
5. **gameplayRoles** - Set to `['personaggio']`
6. **reviewNote** - Optional approval note (can be null or string)
7. **reviewHistory** - Add entry with:
   - `action: 'approve'`
   - `reviewedBy` - ObjectId of system user (required by schema)
   - `note` - Optional note
   - `reviewedAt: new Date()`

## CharacterFinances Record Created

Created with:
- **characterId** - Reference to approved character
- **socialClass** - Name of social class based on FINANZA skill
- **financeSkillValue** - Value of FINANZA skill (1-99)
- **cash** - 30% of calculated initial wealth
- **bankDeposit** - 70% of calculated initial wealth
- **creditLine**:
  - `maxWeekly` - Weekly credit from social class config
  - `currentAvailable` - Initially equal to maxWeekly
  - `lastResetDate` - Current date
  - `nextResetDate` - Next Sunday (calculated with helper)
- **properties** - Empty array `[]`
- **lastCalculated** - Current date
- **createdAt** - Current date
- **updatedAt** - Current date

**IMPORTANT**: Delete any existing CharacterFinances for the character before creating new one.

## Implementation Pattern

When user requests character approval:

1. **Connect to MongoDB**:
   ```typescript
   import mongoose from 'mongoose';
   const MONGODB_URI = 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
   await mongoose.connect(MONGODB_URI);
   ```

2. **Import models**:
   ```typescript
   import { Character, Occupation, CharacterFinances, SocialClassConfig, User } from '../../database/models';
   ```

3. **Find system user for reviewedBy**:
   - Search for admin/master user in database
   - If not found, search for user with admin/system email or username
   - Fallback: use first available user
   - If no user found, throw error (reviewedBy is required by schema)

4. **Validate character**:
   - Find character by ID with status `PENDING_APPROVAL`
   - Verify it exists
   - Return clear error if invalid

5. **Get starting items from occupation**:
   - If character has occupation, find Occupation document
   - Extract `occupation.benefits.startingItems`
   - Map to get only `itemId`: `startingItems.map(item => item.itemId)`

6. **Calculate FINANZA skill**:
   - Handle both Map and object formats for `character.skills`
   - Support SkillBreakdown objects (with `total` field)
   - Search keys: `'Finanza'`, `'FINANZA'`, `'finanza'`
   - Default: `1` if not found
   - Limit between 1 and 99: `Math.max(1, Math.min(99, finanzaSkill || 1))`

7. **Find SocialClassConfig**:
   - Find where `minFinanceSkill <= finanzaSkill <= maxFinanceSkill`
   - Throw error if not found

8. **Calculate initial wealth**:
   - Use `socialClassConfig.initialWealth.minCash` and `maxCash`
   - Default: `240` if not specified
   - Random: `Math.floor(Math.random() * (maxWealth - minWealth + 1)) + minWealth`
   - Cash: `Math.floor(baseWealth * 0.3)` (30%)
   - Bank: `Math.floor(baseWealth * 0.7)` (70%)

9. **Create CharacterFinances**:
   - Delete existing: `await CharacterFinances.deleteOne({ characterId: character._id })`
   - Create new record with all calculated fields
   - Use `getNextSunday()` helper for `creditLine.nextResetDate`
   - Save record

10. **Update Character**:
    - Set all approval fields
    - Add to reviewHistory
    - Save character

11. **Close connection**:
    ```typescript
    await mongoose.disconnect();
    ```

## Helper Function: getNextSunday()

Calculate next Sunday for credit line reset:

```typescript
function getNextSunday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);

  return nextSunday;
}
```

## Key Considerations
- **Always close connection** after use
- **Use try/catch** for error handling
- **Verify character exists** and is in PENDING_APPROVAL status
- **Verify SocialClassConfig exists** for calculated FINANZA skill
- **Delete existing CharacterFinances** before creating new one
- **Handle skills format** correctly (Map vs object, with SkillBreakdown support)
- **reviewedBy is required** by schema
- **Handle all errors** with clear messages
