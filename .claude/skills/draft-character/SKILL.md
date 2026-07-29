---
name: draft-character
description: Revert character to draft status. Use when you need to unapprove a character, reset character approval, or allow character editing again.
user-invocable: true
---

## Overview
AI-driven command to revert a character to DRAFT status directly in MongoDB, allowing the player to modify and re-save it with complete skills.

## Usage Pattern
/draft-character [characterId]

Example:
- /draft-character 693dda96dfe0250b25663311

## MongoDB Credentials
- URI: `mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin`
- Database: `tenpennynovels`
- Credentials from: `docker-compose.yml`

## Required Models
Check `services/unified-backend/src/database/models/` for available models:
- `Character` - Character model
- `User` - User model (for reviewedBy in reviewHistory)

## Fields Updated in Character

When a character is reverted to DRAFT:
1. **playerStatus** - Set to `'draft'` (lowercase; the schema enum is `['draft', 'pending', 'approved']` — there is NO top-level `status` field on Character, only `playerStatus`)
2. **approvedAt** - Set to `undefined` or removed
3. **approvedBy** - Set to `undefined` or removed
4. **reviewHistory** - Add entry with:
   - `action: 'draft'`
   - `reviewedBy` - ObjectId of system user (required by schema)
   - `note` - Optional note (can be null)
   - `reviewedAt: new Date()`

**IMPORTANT**: Skills are preserved as-is. They are NOT deleted or modified.

**IMPORTANT**: Must call `.save()` on the Mongoose document (not a raw `updateOne`). The model's pre-save hook (`services/unified-backend/src/database/models/Character.ts`, around line 998) runs `if (this.isModified('playerStatus') || this.isNew)` and, when `playerStatus === 'draft'`, automatically grants `characterPermissions` including `'game:character:wizard'` and `-game:character:read`. The game frontend's wizard redirect (`apps/game/src/components/layout/GameLayout.tsx`, `apps/game/src/pages/character/wizard.tsx`) requires BOTH `playerStatus === 'draft'` AND the `game:character:wizard` permission — if you set `playerStatus` via a raw driver update instead of `.save()`, the hook never runs and the wizard will not launch even though the character looks like a draft.

## Implementation Pattern

When user requests character revert to draft:

1. **Connect to MongoDB**:
   ```typescript
   import mongoose from 'mongoose';
   const MONGODB_URI = 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
   await mongoose.connect(MONGODB_URI);
   ```

2. **Import models**:
   ```typescript
   import { Character, User } from '../../database/models';
   ```

3. **Find system user for reviewedBy**:
   - Search for admin/master user in database
   - If not found, search for user with admin/system email or username
   - Fallback: use first available user
   - If no user found, throw error (reviewedBy is required by schema)

4. **Validate character**:
   - Find character by ID
   - Verify it exists
   - Optionally verify it's NOT already draft (for better feedback)
   - Return clear error if invalid

5. **Update Character**:
   - Set `playerStatus = 'draft'`
   - Set `approvedAt = undefined`
   - Set `approvedBy = undefined`
   - Add entry to `reviewHistory` with `reviewedBy = systemUserId`
   - Save character (via `.save()`, so the pre-save hook grants the wizard permission)

6. **Close connection**:
   ```typescript
   await mongoose.disconnect();
   ```

## Key Considerations
- **Always close connection** after use to avoid open connections
- **Use try/catch** for connection and query errors
- **Verify character exists** before proceeding
- **Preserve skills** - don't delete or modify them
- **Handle errors** with clear messages for edge cases
- **reviewedBy is required** by schema - must find a user
- **Don't delete CharacterFinances** - character might be re-approved

## Example Implementation

```typescript
import mongoose from 'mongoose';
import { Character, User } from '../../database/models';

const MONGODB_URI = 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';

try {
  await mongoose.connect(MONGODB_URI);

  const characterId = '693dda96dfe0250b25663311';

  // Find system user for reviewedBy
  // NOTE: User model has no `role` field — use `canAccessAdminPanel` / `username`
  let systemUserId = null;
  const adminUser = await User.findOne({
    $or: [
      { canAccessAdminPanel: true },
      { username: 'admin' },
      { username: 'system' }
    ]
  });

  if (adminUser) {
    systemUserId = adminUser._id;
  } else {
    const anyUser = await User.findOne();
    if (anyUser) {
      systemUserId = anyUser._id;
    } else {
      throw new Error('No user found in database. Cannot complete without reviewedBy.');
    }
  }

  // Find and validate character
  const character = await Character.findById(characterId);

  if (!character) {
    console.error('Character not found');
    process.exit(1);
  }

  if (character.playerStatus === 'draft') {
    console.log('Character is already draft');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Update Character
  character.playerStatus = 'draft'; // triggers pre-save hook: grants 'game:character:wizard' permission
  character.approvedAt = undefined;
  character.approvedBy = undefined;

  // Add to review history
  const reviewEntry = {
    action: 'draft' as const,
    reviewedBy: systemUserId,
    note: null,
    reviewedAt: new Date()
  };

  character.reviewHistory = character.reviewHistory || [];
  character.reviewHistory.push(reviewEntry);

  await character.save();

  console.log('Character reverted to draft successfully!');
  console.log(`ID: ${characterId}`);
  console.log(`Name: ${character.name}`);

} catch (error: any) {
  console.error('Error reverting character to draft:', error.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
```
