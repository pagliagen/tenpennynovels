---
name: manage-db
description: Execute MongoDB queries and manage databases. Use when you need to query, count, find, update, or modify data in the tenpennynovels (game) or botservice (bot-service state) databases. Handles natural language database requests.
user-invocable: true
---

When the user invokes this skill, you should:

## Overview
Execute MongoDB queries on the project databases using natural language. You translate the user's request into a mongosh query based on the database models, then run it with Docker exec.

## Usage Pattern
/manage-db [database] [natural_language_request]

Parameters:
- **database**: Target database name
  - `tenpennynovels` - Main game database (locations, characters, users, chats)
  - `botservice` - State of `bot-service/`: bot moods and relationships with players
- **natural_language_request**: What you want to do in plain language

Examples:
- `/manage-db tenpennynovels mostrami gli ultimi 10 messaggi della location Ten Bells Public House`
- `/manage-db tenpennynovels quanti personaggi sono approved?`
- `/manage-db botservice mostrami il rapporto di Barnaby Finch con ogni giocatore`
- `/manage-db botservice azzera umore e rapporti`

## Implementation Details

### Step-by-Step Process
1. **Understand the request**: Parse the user's natural language request
2. **Identify the collection and its fields** from the sections below
3. **Translate to mongosh**
4. **Execute via Docker**: run the query with docker exec
5. **Return results**: show the query executed and its output

### Database Configuration

Both databases live in the same MongoDB container (`tenpennynovels-mongodb`), credentials `admin:admin123` (local dev only).

**tenpennynovels:**
- URI: `mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin`
- Collections: locations, characters, users, chats, chat_scenes, occupations, items, documents, etc.
- Models: `services/unified-backend/src/core/*/models/`, `services/unified-backend/src/database/models/`, `services/unified-backend/src/features/*/models/`

**botservice:**
- URI: `mongodb://admin:admin123@localhost:27017/botservice?authSource=admin`
- Collections:
  - `bot_moods` — `_id` = characterId del bot, `pad: {p, a, d}` (-1..1), `updatedAt`
  - `relations` — una per coppia (`botId`, `playerId`): `trust`, `respect`, `suspicion` (0-100), `interactions`, `firstSeenAt`, `lastSeenAt`, `knownName` (assente finché il giocatore non si presenta), `facts[]`, `playerName` (solo per leggere il DB)
- Code: `bot-service/src/psyche/` (types.ts, store.ts)

The characters of the bots are in `tenpennynovels.characters` with `userId` = `000000000000000000000001` (user `system-bot`).

### Command Execution Template
```bash
docker exec -i tenpennynovels-mongodb mongosh "[URI]" --quiet --eval "[MONGOSH_QUERY]"
```

## Translation Examples: Natural Language → mongosh

### Grouping
Request: "conta i personaggi per stato"
```javascript
db.characters.aggregate([{ $group: { _id: '$playerStatus', n: { $sum: 1 } } }])
```

### Bot characters
Request: "quali sono i personaggi dei bot?"
```javascript
db.characters.find({ userId: ObjectId('000000000000000000000001') }, { name: 1, playerStatus: 1 })
```

### Chat of a location
Request: "ultimi 5 messaggi di Ten Bells"
```javascript
const loc = db.locations.findOne({ slug: 'ten-bells-public-house' });
db.chats.find({ locationId: loc._id.toString() }, { characterName: 1, position: 1, content: 1 }).sort({ timestamp: -1 }).limit(5)
```
Note: `chats.locationId` is a **string**, not an ObjectId.

### Bot relationships (botservice)
Request: "i rapporti di Barnaby"
```javascript
db.relations.find({ botId: '<characterId>' }, { _id: 0, interactions: 1, knownName: 1, trust: 1, respect: 1, suspicion: 1, facts: 1 })
```

## Key Considerations
- **Docker must be running**: the databases run in a container
- **Syntax**: mongosh, not the legacy mongo shell
- **ObjectId**: use `ObjectId('...')` for ObjectId fields (but `chats.locationId` and `chats.characterId` are strings)
- **Soft delete**: game documents use `deletedAt`; filter `deletedAt: null` when you only want live ones

## Error Handling
- **Container not found**: check `docker ps`
- **Connection refused**: verify MongoDB port 27017 is exposed
- **Ambiguous request**: ask the user for clarification

## Safety Protocol
- **Read-only queries** (findOne, find, countDocuments, aggregate): execute immediately
- **Write queries**: show the translated query first, explain the impact, and confirm before executing
- **Deleting chat data** also means `chatbackups` and `chat_scenes`; and for the bot, `botservice:history:<locationId>` in Redis

## Related Files
- Infrastructure: `docker-compose.yml`
- Game models: `services/unified-backend/src/`
- Bot-service state: `bot-service/src/psyche/`
