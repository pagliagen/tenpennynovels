# TenPennyNovels Permission System Architecture

This directory contains ALL permission and role configuration files for the entire system.

## File Overview

### 1. admin-permissions.json (LEGACY - DEPRECATED)
**Status**: Active but deprecated
**Purpose**: Admin panel permission system (OLD)
**Format**: Nested structure (section.detail.action)
**Used By**: 13+ admin route files via requireViewPermission()
**Migration**: Gradually moving to database-driven permissions

**When to use**: NEVER for new code. Only maintained for backward compatibility.

### 2. roles.json (CURRENT)
**Status**: Active - Primary system
**Purpose**: Character roles bridge (admin panel ↔ game runtime)
**Format**: Flat permission strings (e.g., "users.view", "characters.approve")
**Used By**:
- Admin panel: AdminAuthMiddleware.requireGranularPermission()
- Character model: characterRoles field
- Database: User.hasViewPermission()

**When to use**: When defining character permissions for admin panel operations.

### 3. game-permissions.json (CURRENT)
**Status**: Active - Primary system
**Purpose**: Game runtime permissions (in-game operations)
**Format**: Colon-separated (e.g., "game:chat:send", "game:locations:enter")
**Used By**:
- Game routes: requireGamePermission() middleware
- Character model: gameplayRoles field (auto-calculated)
- Session API: returns gamePermissions array to frontend

**When to use**: When protecting game endpoints or checking in-game permissions.

---

## Permission System Flow

### Admin Panel Operations
```
User logs in → User.characterRoles → roles.json lookup → AdminAuthMiddleware
                                                                ↓
                                                    GRANT or DENY admin action
```

### Game Runtime Operations
```
Character session → Character.gameplayRoles → game-permissions.json lookup
                            ↓
                    requireGamePermission() middleware
                            ↓
                    GRANT or DENY game action
```

### Role Assignment Flow
```
1. Character created → characterRoles: ['draft']
2. Character approved → characterRoles: ['personaggio']
3. Admin assigns master → characterRoles: ['personaggio', 'master']

Pre-save hook calculates:
- status: DRAFT → gameplayRoles: ['player']
- status: APPROVED → gameplayRoles: ['approved-player']
- characterRoles includes 'master' → adds 'master' to gameplayRoles
```

---

## Key Differences

| Aspect | Admin Panel (roles.json) | Game Runtime (game-permissions.json) |
|--------|--------------------------|--------------------------------------|
| Format | Dot notation (users.view) | Colon notation (game:users:view) |
| Scope | Admin panel pages/operations | In-game character actions |
| Inheritance | Via "inherits" field | Via "inherits" field |
| Status Restrictions | No | Yes (DRAFT blocks certain actions) |
| Middleware | AdminAuthMiddleware | requireGamePermission() |
| Field | characterRoles | gameplayRoles |

---

## Adding New Permissions

### For Admin Panel Operations:
1. Add permission to `roles.json` → characterRoles section
2. Apply via `AdminAuthMiddleware.requireGranularPermission(['permission.name'])`
3. Update User model if needed

### For Game Runtime Operations:
1. Add permission to `game-permissions.json` → gameplay_roles section
2. Apply via `requireGamePermission('game:category:action')`
3. Update Character model if needed (usually auto-calculated)

---

## Migration Status

**Current State**: Dual system (transitioning)
- Old system (admin-permissions.json) still active for backward compatibility
- New system (roles.json + game-permissions.json) is standard for new code

**Goal**: Single unified system
- Move menu_structure and dashboard_badges to database
- Replace requireViewPermission() with AdminAuthMiddleware in all routes
- Delete admin-permissions.json once all routes migrated

**Target**: Q2 2026
