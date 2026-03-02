---
name: generate-bot
description: Generate AI bots for locations. Use when you need to create NPC bots, populate a location with characters, or activate bot system for a location.
user-invocable: true
---

## Overview
Generate AI-powered NPC bots for a specific location with contextual personalities based on location tags. The command activates `bot_enabled` on the location and creates bots via the BotAI API.

## Usage Pattern
/generate-bot [environment] [location_name] [num_bots]

Parameters:
- **environment**: 'dev' (port 8082) or 'prod' (port 8080) - MANDATORY
- **location_name**: Exact name of the location (e.g., "Borough Market", "The Blind Beggar")
- **num_bots**: Number of bots to generate (positive integer)

Examples:
- /generate-bot dev "Borough Market" 3
- /generate-bot prod "The Blind Beggar" 5
- /generate-bot dev "Whitechapel High Street" 1

## Implementation Details

### Command Execution
The skill executes the TypeScript script `scripts/utilities/bots/generate-bot.ts` with proper environment variables:

**DEV Environment:**
- BOTAI_WEBHOOK_URL: http://localhost:8082
- ADMIN_BACKEND_BOT_API_KEY: x3vC8bN5mK2pW7jL4gT9sR6hQ1aF8dY3zM7nV2uE5cX9bK4wP6jT8rL3qH5nM2

**PROD Environment:**
- BOTAI_WEBHOOK_URL: http://localhost:8080
- ADMIN_BACKEND_BOT_API_KEY: x3vC8bN5mK2pW7jL4gT9sR6hQ1aF8dY3zM7nV2uE5cX9bK4wP6jT8rL3qH5nM2

### What the Script Does

1. **Connect to MongoDB** (tenpennynovels database)
2. **Find location** by exact name
3. **Activate bot_enabled** flag on location if not already active
4. **Generate N bots** with:
   - Contextual personalities based on location tags
   - Italian names and surnames
   - Gender alternation (even=male, odd=female)
   - Activation rules with location-specific keywords
   - Appropriate traits and speech patterns
5. **Create bots** via BotAI API (POST /bots)
6. **Return summary** with bot IDs and details

### Bot Personality Mapping

Based on location tags:

| Tag | Possible Roles | Traits |
|-----|----------------|--------|
| commercio | Commerciante di spezie, Venditore ambulante | affabile, commerciante, intraprendente |
| cibo | Venditore di cibo, Fornaio | cordiale, generoso, culinario |
| mercato | Bancarellista, Venditrice di fiori | vivace, socievole, contrattatore |
| taverna | Locandiere, Barista | gioviale, discreto, narratore |
| strada | Passante, Guardiano notturno | cauto, osservatore, diffidente |

**Default** (no tags): Residente locale, traits: curioso, disponibile, locale

## MongoDB Credentials
- URI: `mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin`
- Database: `tenpennynovels`

## BotAI API
- DEV URL: `http://localhost:8082`
- PROD URL: `http://localhost:8080`
- Endpoint: `POST /bots`
- Auth Header: `x-admin-api-key: admin-secret-key`

## Key Considerations
- **Environment selection**: Always specify 'dev' or 'prod' explicitly
- **Location name**: Must match exactly (case-sensitive)
- **BotAI must be running**: Verify with `curl http://localhost:8080/health`
- **MongoDB must be accessible**: Check with `docker ps | grep mongodb`
- **Script path**: Executed from project root as `npx tsx scripts/generate-bot.ts`

## Error Handling
- **Location not found**: Verify exact name with database query
- **BotAI unreachable**: Check if BotAI service is running
- **MongoDB connection refused**: Verify Docker containers are up
- **Invalid API key**: Check .env.botai configuration

## Verification Checklist
- [ ] Location exists in database with correct name
- [ ] BotAI service is running (dev or prod)
- [ ] MongoDB container is accessible
- [ ] bot_enabled flag is set to true on location
- [ ] N bots were created successfully
- [ ] Bots have correct assignedLocations array
- [ ] Bots are marked as isActive: true

## Related Files
- Script: `scripts/utilities/bots/generate-bot.ts`
- Location Model: `services/unified-backend/src/database/models/Location.ts`
- BotAI Docs: `services/botai-backend/README.md`
