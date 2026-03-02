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
1. **status** - Set to `'DRAFT'`
2. **approvedAt** - Set to `undefined` or removed
3. **approvedBy** - Set to `undefined` or removed
4. **reviewNote** - Set to `null` or removed
5. **reviewHistory** - Add entry with:
   - `action: 'draft'`
   - `reviewedBy` - ObjectId of system user (required by schema)
   - `note` - Optional note (can be null)
   - `reviewedAt: new Date()`

**IMPORTANT**: Skills are preserved as-is. They are NOT deleted or modified.

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
   - Optionally verify it's NOT already DRAFT (for better feedback)
   - Return clear error if invalid

5. **Update Character**:
   - Set `status = 'DRAFT'`
   - Set `approvedAt = undefined`
   - Set `approvedBy = undefined`
   - Set `reviewNote = null`
   - Add entry to `reviewHistory` with `reviewedBy = systemUserId`
   - Save character

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
  const note = null; // Optional: reason for reverting to draft

  // Find system user for reviewedBy
  let systemUserId = null;
  const adminUser = await User.findOne({
    $or: [
      { role: 'admin' },
      { role: 'master' },
      { email: 'admin@tenpennynovels.com' },
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

  if (character.status === 'DRAFT') {
    console.log('Character is already DRAFT');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Update Character
  character.status = 'DRAFT';
  character.approvedAt = undefined;
  character.approvedBy = undefined;
  character.reviewNote = null;

  // Add to review history
  const reviewEntry = {
    action: 'draft',
    reviewedBy: systemUserId,
    note: note || null,
    reviewedAt: new Date()
  };

  character.reviewHistory = character.reviewHistory || [];
  character.reviewHistory.push(reviewEntry);

  await character.save();

  console.log('Character reverted to DRAFT successfully!');
  console.log(`ID: ${characterId}`);
  console.log(`Name: ${character.name}`);

} catch (error: any) {
  console.error('Error reverting character to draft:', error.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
```
