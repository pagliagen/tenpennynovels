---
name: manage-db
description: Execute MongoDB queries and manage databases. Use when you need to query, count, find, update, or modify data in tenpennynovels, botai-dev, or botai-prod databases. Handles natural language database requests.
user-invocable: true
---

When the user invokes this skill, you should:

## Overview
Execute MongoDB queries on any of the three project databases using natural language. You will translate the user's request into appropriate mongosh queries based on the database models, then execute them using Docker exec.

## Usage Pattern
/manage-db [database] [natural_language_request]

Parameters:
- **database**: Target database name
  - `tenpennynovels` - Main game database (locations, characters, users)
  - `botai-dev` - Bot AI development database (bots, relationships)
  - `botai-prod` - Bot AI production database (bots, relationships)
- **natural_language_request**: What you want to do in plain language

Examples:
- `/manage-db botai-dev trova tutti i bot presenti, raggruppandoli per locations`
- `/manage-db tenpennynovels verifica se la location Whitechapel Tavern ha i bot abilitati`
- `/manage-db botai-dev conta quanti bot sono attivi`
- `/manage-db botai-dev mostrami le relazioni del bot con ID xxx`

## Implementation Details

### Step-by-Step Process
1. **Understand the request**: Parse the user's natural language request
2. **Identify the database models**: Reference the appropriate model schemas
3. **Translate to mongosh**: Convert the request into a valid mongosh query
4. **Execute via Docker**: Run the query using docker exec
5. **Return results**: Show the query executed and its output

### Database Configuration

**tenpennynovels:**
- Container: `tenpennynovels-mongodb`
- URI: `mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin`
- Collections: locations, characters, users, campaigns, occupations, items, documents, etc.
- Models: `services/unified-backend/src/database/models/`

**botai-dev:**
- Container: `botai-mongodb-dev`
- URI: `mongodb://admin:botai123@localhost:27017/botai-dev?authSource=admin`
- Collections: bots, bot_relationships, conversations, etc.
- Models: `services/botai-backend/src/models/Bot.ts`, `BotRelationship.ts`

**botai-prod:**
- Container: `botai-mongodb-prod`
- URI: `mongodb://admin:botai123@localhost:27017/botai-prod?authSource=admin`
- Collections: bots, bot_relationships, conversations, etc.
- Models: Same as botai-dev

### Bot Model Schema Reference (botai-dev/prod)
Key fields in `bots` collection:
- `name`, `surname`, `gender`
- `assignedLocations` (array of location IDs)
- `tags` (array, e.g., ["bancone", "tavolo"])
- `isActive` (boolean)
- `psychologicalAxes` (6 axes: rationalEmotional, controlledImpulsive, cynicalIdealist, proudSubmissive, prudentParanoid, directAllusive)
- `centralWound` {wound, manifestation}
- `duality` {publicMask, privateTruth}
- `personality` {traits, coreValues, speechPattern, emotionalRange}
- `activeEmotions` (array with emotion, intensity, trigger)

Key fields in `bot_relationships` collection:
- `botId` (ObjectId reference to bot)
- `characterId`, `characterName`
- `sentiment` (-100 to 100)
- `trustLevel`, `familiarity` (0-100)
- `relationshipArchetype` {type, description}
- `sourceCredibility` {reliability: -3 to +3, basedOn}
- `latentTensions` (array with subject, source, severity, state)

### Command Execution Template
Use the Bash tool with this format:
```bash
docker exec -i [CONTAINER_NAME] mongosh "[URI]" --quiet --eval "[MONGOSH_QUERY]"
```

## Translation Examples: Natural Language → mongosh

### Example 1: Grouping
**Request**: "trova tutti i bot presenti, raggruppandoli per locations"
**Translation**:
```javascript
db.bots.aggregate([
  {$unwind: '$assignedLocations'},
  {$group: {
    _id: '$assignedLocations',
    bots: {$push: {name: '$name', surname: '$surname', isActive: '$isActive'}},
    count: {$sum: 1}
  }},
  {$sort: {count: -1}}
])
```

### Example 2: Simple Query
**Request**: "verifica se la location Whitechapel Tavern ha i bot abilitati"
**Translation**:
```javascript
db.locations.findOne(
  {name: 'The Whitechapel Tavern'},
  {_id: 1, name: 1, bot_enabled: 1, tags: 1}
)
```

### Example 3: Count
**Request**: "conta quanti bot sono attivi"
**Translation**:
```javascript
db.bots.countDocuments({isActive: true})
```

### Example 4: List with Projection
**Request**: "mostrami i primi 10 bot con nome, cognome e locations"
**Translation**:
```javascript
db.bots.find(
  {},
  {name: 1, surname: 1, assignedLocations: 1, isActive: 1}
).limit(10)
```

### Example 5: Update
**Request**: "attiva i bot per la location Borough Market"
**Translation**:
```javascript
db.locations.updateOne(
  {name: 'Borough Market'},
  {$set: {bot_enabled: true}}
)
```

### Example 6: Complex Query
**Request**: "trova tutti i bot maschi assegnati a più di una location"
**Translation**:
```javascript
db.bots.find(
  {
    gender: 'male',
    $expr: {$gt: [{$size: '$assignedLocations'}, 1]}
  },
  {name: 1, surname: 1, assignedLocations: 1}
)
```

### Example 7: Relationships
**Request**: "mostrami le relazioni del bot con ID xxx con trust sopra 50"
**Translation**:
```javascript
db.bot_relationships.find(
  {botId: ObjectId('xxx'), trustLevel: {$gt: 50}},
  {characterName: 1, trustLevel: 1, familiarity: 1, sentiment: 1}
)
```

## How to Process the Request

When this skill is invoked, follow these steps:

1. **Parse the natural language request** to understand what the user wants
2. **Identify the target collection** based on the request and database
3. **Reference the model schema** to ensure correct field names and types
4. **Translate to mongosh query** using proper syntax
5. **Determine container and URI** based on database parameter
6. **Execute using Bash tool** with docker exec command
7. **Present results** showing both the query and output

### Container and URI Mapping
```
tenpennynovels → tenpennynovels-mongodb → mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin
botai-dev → botai-mongodb-dev → mongodb://admin:botai123@localhost:27017/botai-dev?authSource=admin
botai-prod → botai-mongodb-prod → mongodb://admin:botai123@localhost:27017/botai-prod?authSource=admin
```

### Execution Command Format
```bash
docker exec -i [CONTAINER] mongosh "[URI]" --quiet --eval "[QUERY]"
```

## Key Considerations
- **Docker must be running**: All databases run in Docker containers
- **Quiet mode**: Output is piped with `--quiet` flag to reduce noise
- **Syntax**: Use mongosh syntax, not legacy mongo shell syntax
- **Destructive operations**: For write operations, show the query first and explain what will happen
- **ObjectId**: Use `ObjectId('...')` for ObjectId fields in queries
- **Authentication**: Credentials are embedded in URI

## Error Handling
- **Container not found**: Check if Docker containers are running with `docker ps`
- **Connection refused**: Verify MongoDB port is exposed (27017)
- **Invalid query syntax**: Verify mongosh syntax (not legacy mongo syntax)
- **Ambiguous request**: Ask the user for clarification if the request is unclear

## Safety Protocol
- **Read-only queries**: Execute immediately (findOne, find, countDocuments, aggregate)
- **Write queries**: Show the translated query first, explain the impact, and confirm before executing
- **Always test on dev first**: Remind users to use botai-dev before botai-prod for destructive operations

## Related Files
- Infrastructure: `docker-compose.yml`
- BotAI Dev: `services/botai-backend/docker-compose.dev.yml`
- BotAI Prod: `services/botai-backend/docker-compose.prod.yml`
- Database Models: `services/unified-backend/src/database/models/` (tenpennynovels)
- BotAI Models: `services/botai-backend/src/models/` (Bot.ts, BotRelationship.ts)
