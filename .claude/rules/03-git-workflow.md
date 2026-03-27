---
name: Git Workflow & Conventions
description: Git branching, commit messages, and workflow patterns
type: standard
---

# 03 - Git Workflow & Conventions

Standard per Git branching strategy, commit messages, e workflow.

---

## Branch Naming

### Main Branches:

- `master` - Production-ready code
- `develop` - Integration branch (if using GitFlow)

### Feature Branches:

```
feature/description-in-kebab-case
feature/user-authentication
feature/bot-interaction-system
feature/semantic-search
```

### Fix Branches:

```
fix/description-in-kebab-case
fix/websocket-memory-leak
fix/mongodb-id-field-bug
fix/optimistic-update-race-condition
```

### Refactor Branches:

```
refactor/description-in-kebab-case
refactor/split-chat-controller
refactor/extract-websocket-context
```

### Hotfix Branches (Production Issues):

```
hotfix/critical-bug-description
hotfix/auth-bypass-vulnerability
hotfix/memory-leak-in-worker
```

---

## Commit Message Format

### Pattern:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types:

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add JWT refresh token support` |
| `fix` | Bug fix | `fix(websocket): prevent memory leak in event handlers` |
| `refactor` | Code restructuring (no functionality change) | `refactor(chat): extract message validation logic` |
| `perf` | Performance improvement | `perf(db): add index on character.userId` |
| `docs` | Documentation only | `docs(api): update character endpoint examples` |
| `style` | Code style (formatting, missing semicolons) | `style(backend): fix eslint warnings` |
| `test` | Adding/updating tests | `test(auth): add session expiration tests` |
| `chore` | Build, dependencies, tooling | `chore(deps): update mongoose to 9.2.0` |
| `ci` | CI/CD changes | `ci(github): add Node version matrix` |

### Scope Examples:

- `auth` - Authentication module
- `chat` - Chat system
- `websocket` - WebSocket functionality
- `db` - Database changes
- `api` - API endpoints
- `ui` - User interface
- `docker` - Docker configuration

### Subject Rules:

- ✅ Use imperative mood ("add" not "added" or "adds")
- ✅ Lowercase first letter
- ✅ No period at end
- ✅ Max 72 characters
- ❌ Don't use past tense

### ❌ WRONG:
```
Fixed bug in websocket handler.
Added new feature for character creation.
Updated dependencies.
```

### ✅ CORRECT:
```
fix(websocket): prevent memory leak in event subscription
feat(character): add character creation wizard
chore(deps): update mongoose to 9.2.0
```

### Body (Optional):

- Explain **why** the change was made
- Explain **what** problem it solves
- Reference **related issues**

```
feat(auth): add JWT refresh token support

Previous implementation required users to re-login after token expiration.
This adds refresh token support to maintain session continuity.

- Add /auth/refresh endpoint
- Store refresh tokens in Redis with 7-day TTL
- Update frontend to automatically refresh before expiration

Closes #123
Related to #100
```

### Footer:

```
Closes #123                    # Closes issue
Fixes #456                     # Fixes bug
Related to #789                # Related issue
Breaking Change: ...           # Breaking changes (rare)
Co-Authored-By: Name <email>   # Multiple authors
```

---

## Commit Frequency

### ✅ DO:

- Commit **small, atomic changes**
- One logical change per commit
- Commit **often** during development

### ❌ DON'T:

- Wait until end of day to commit
- Combine multiple unrelated changes
- Commit half-finished features (unless using feature flags)

### Example:

```bash
# ✅ GOOD - Atomic commits
git commit -m "feat(auth): add JWT middleware"
git commit -m "feat(auth): add refresh token endpoint"
git commit -m "test(auth): add JWT middleware tests"

# ❌ BAD - Everything in one commit
git commit -m "add authentication system"
```

---

## Pre-commit Hooks

### If Hook Fails:

**✅ DO:**
1. **Fix the underlying issue** (lint error, test failure, etc.)
2. Stage the fix
3. Create **NEW commit** (not amend)

**❌ DON'T:**
- Skip hooks with `--no-verify` (unless explicitly requested by user)
- Amend previous commit (can lose work if hook failed)
- Ignore hook failures

### Pattern:

```bash
# Hook fails on lint error
git commit -m "feat(chat): add message validation"
# → Pre-commit hook fails: eslint errors

# ✅ CORRECT: Fix and create NEW commit
npm run lint:fix
git add .
git commit -m "style(chat): fix eslint warnings from previous commit"

# ❌ WRONG: Skip hook
git commit -m "feat(chat): add message validation" --no-verify

# ❌ WRONG: Amend (dangerous after hook failure)
npm run lint:fix
git add .
git commit --amend  # Can overwrite wrong commit!
```

### When to Amend:

**✅ Safe to amend:**
- Fixing typo in commit message (before push)
- Adding forgotten file to commit (before push)
- Small style fix immediately after commit (before push)

**❌ NEVER amend:**
- After `git push`
- After hook failure (create new commit instead)
- Commits referenced by others

---

## Merging vs Rebasing

### Main Branch (master):

```bash
# ✅ CORRECT - Merge with no-ff (preserves history)
git checkout master
git merge --no-ff feature/my-feature
git push origin master

# ❌ WRONG - Rebase main branch (rewrites history)
git checkout master
git rebase feature/my-feature
```

### Feature Branch:

```bash
# ✅ CORRECT - Rebase to update feature branch
git checkout feature/my-feature
git rebase master
git push --force-with-lease origin feature/my-feature

# ✅ ALSO CORRECT - Merge to update feature branch
git checkout feature/my-feature
git merge master
git push origin feature/my-feature
```

### Rules:

- **Public branches** (master, develop): Use merge
- **Feature branches**: Can use rebase or merge
- **After push**: Avoid rebase (use `--force-with-lease` if necessary)

---

## Pull Request Best Practices

### PR Title:

Follow commit message format:

```
feat(auth): add JWT refresh token support
fix(websocket): prevent memory leak in handlers
```

### PR Description Template:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Added X
- Modified Y
- Removed Z

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
![Screenshot](url)

## Related Issues
Closes #123
Related to #456
```

### Before Creating PR:

```bash
# 1. Update from main
git fetch origin
git rebase origin/master  # or merge

# 2. Run tests
npm test

# 3. Check lint
npm run lint

# 4. Check types
npm run type-check

# 5. Build
npm run build

# 6. Push
git push origin feature/my-feature
```

---

## Destructive Operations

### ⚠️ Require User Confirmation:

These operations are **hard to reverse** or affect **shared state**:

- `git push --force` (or `--force-with-lease`)
- `git reset --hard`
- `git clean -fd`
- `git rebase` (on public branches)
- `git push` to master without PR
- Deleting branches with unmerged commits

### Pattern:

```bash
# ❌ NEVER do automatically
git push --force origin master

# ✅ Always confirm with user first
echo "About to force push to master. This is dangerous! Proceed? (y/N)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
  git push --force-with-lease origin master
fi
```

---

## .gitignore Patterns

### Standard Patterns:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/
.next/
out/

# Environment
.env.local
.env.production
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Temporary
*.tmp
.cache/
```

### ✅ ALWAYS Commit:

- `.env` (with placeholder values)
- `.nvmrc`
- `package-lock.json`
- `tsconfig.json`
- `.gitignore` itself

### ❌ NEVER Commit:

- `node_modules/`
- `.env.local`, `.env.production`
- Secrets, API keys, passwords
- Build artifacts (`dist/`, `.next/`)
- IDE-specific files (unless project-wide config)

---

## Git Stash

### Usage:

```bash
# Save current work
git stash push -m "work in progress on feature X"

# List stashes
git stash list

# Apply stash (keep in list)
git stash apply stash@{0}

# Apply and remove stash
git stash pop

# Show stash content
git stash show -p stash@{0}

# Drop stash
git stash drop stash@{0}

# Clear all stashes
git stash clear
```

---

## Resolving Merge Conflicts

### Pattern:

```bash
# 1. Attempt merge
git merge master
# → CONFLICT in file.ts

# 2. Check status
git status

# 3. Open conflicted files
# Look for:
# <<<<<<< HEAD
# Your changes
# =======
# Incoming changes
# >>>>>>> master

# 4. Resolve manually or use tool
git mergetool

# 5. Mark as resolved
git add file.ts

# 6. Complete merge
git commit  # Uses default merge commit message
```

### package-lock.json Conflicts:

```bash
# Always regenerate, don't resolve manually
git checkout --theirs package-lock.json  # Or --ours
npm install
git add package-lock.json
git commit
```

---

## Cross-References

- **Commit creation**: See [CLAUDE.md](../CLAUDE.md) for commit workflow
- **Pre-commit hooks**: See [00-project-wide.md](./00-project-wide.md)
- **Docker and git**: See [docker-deployment.md](./docker-deployment.md)
