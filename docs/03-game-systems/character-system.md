# Character System Documentation - Version 2.0 (NEW SYSTEM)

**Last Updated**: 2025-01-14
**Version**: 2.0
**Status**: Production Ready

## Overview

Il sistema personaggi di TenpennyNovels implementa le regole Call of Cthulhu complete con modifiche per l'ambientazione vittoriana. Questa versione 2.0 introduce il **NEW SYSTEM** con occupazioni basate su **6 required skills** + **1-2 bonus skills** automatici, background strutturato guidato, e anagrafica dettagliata opzionale.

## Key Changes in Version 2.0

### 🔄 Breaking Changes

1. **Wizard Step Order** Changed:
   - **OLD**: Info → Occupation → Stats → Skills → Background → Review
   - **NEW**: Info → Stats → Skills → Occupation → Background → Review

2. **Occupation System** Completely Refactored:
   - **OLD**: Generic `skillBonuses` object with variable skills
   - **NEW**: **6 required skills** (some with alternatives) + **1-2 bonus skills** (auto-applied)

3. **Background System** Enhanced:
   - **OLD**: Single text field for backstory
   - **NEW**: **9 structured guided fields** (3 required: briefHistory, personality, goalsAndMotivations)

4. **Anagrafica System** Extended:
   - **NEW**: **9 optional detailed fields** (height, eyeColor, hairColor, maritalStatus, etc.)

### ✅ New Features

- **API-driven occupation bonuses** applied automatically when progressing Step 4 → Step 5
- **Real-time character count feedback** on required fields
- **Detailed validation errors** with field-specific messages
- **Alternative skill selection** for flexible occupation requirements
- **Graceful degradation** if API fails (bonuses applied during final submission)

---

## Database Architecture

### Character Model (Updated)

```typescript
interface Character {
  _id: ObjectId;
  userId: ObjectId;
  name: string;           // First name
  surname: string;        // Last name
  state: CharacterState;  // DRAFT | PENDING_APPROVAL | APPROVED | DELETED
  roles: GameplayRole[];  // personaggio | master | moderatore | amministratore

  // Basic Info (Step 1)
  age: number;            // 18-80 years
  apparentAge: number;    // 16-90 years (can differ from real age)
  gender: 'male' | 'female';
  birthPlace: string;

  // NEW v2.0: Anagrafica Completa (Optional)
  height?: string;
  eyeColor?: string;
  hairColor?: string;
  visibleMarks?: string;  // Scars, tattoos visible
  hiddenMarks?: string;   // Marks under clothes
  maritalStatus?: 'single' | 'married' | 'widowed' | 'separated' | 'divorced';
  illnesses?: string;
  educationTitle?: string;
  criminalRecord?: string;

  // ✨ NEW: Bot AI Integration (v2.1)
  bot_id?: string;        // If present, this Character is an AI-controlled bot
                          // Links to Bot in botai database
                          // Bot characters are auto-approved and owned by SYSTEM_BOT_USER_ID

  // Call of Cthulhu Stats (Step 2) - 8 characteristics
  stats: {
    strength: number;      // Forza (FOR)
    dexterity: number;     // Destrezza (DES)
    intelligence: number;  // Intelligenza (INT)
    constitution: number;  // Costituzione (COS)
    size: number;          // Taglia (TAG)
    charm: number;         // Fascino (CHA)
    power: number;         // Potere (POT)
    education: number;     // Educazione (EDU)
  };

  // Derived Stats (auto-calculated)
  derived: {
    ideaRoll: number;      // = INT
    luckRoll: number;      // = POW
    knowledge: number;     // = EDU
    hitPoints: number;     // = (TAG + COS) / 10
    sanityPoints: number;  // = POW
    magicPoints: number;   // = POW / 5
    damageBonus: string;   // From FOR + TAG table
    build: number;         // From FOR + TAG table
  };

  // Skills (Step 3) - Victorian London modified
  skills: Record<string, number>;  // { "Medicina": 60, "Armi da fuoco": 45, ... }
  dynamicSkills: Array<{
    skillName: string;        // e.g., "Lingua (Francese)"
    basedOnTemplate: string;  // e.g., "Lingua"
    customValue: string;      // e.g., "Francese"
    value: number;
    category: string;
  }>;

  // Occupation (Step 4) - NEW SYSTEM v2.0
  occupation: ObjectId;  // Reference to Occupation model
  occupationBonusesApplied: boolean;  // Flag to track if bonuses were applied
  selectedAlternativeSkills?: Record<string, string>;  // { requirementId: skillId }

  // Background (Step 5) - NEW SYSTEM v2.0 Structured
  background: {
    briefHistory: string;           // Required, min 100 chars - Life story
    significantEvents?: string;     // Optional - Key moments
    importantRelationships?: string; // Optional - Important people
    personality: string;            // Required, min 50 chars - Character traits
    ideology?: string;              // Optional - Beliefs and values
    significantPlaces?: string;     // Optional - Meaningful locations
    fearsAndPhobias?: string;       // Optional - Fears (important for Sanity)
    secrets?: string;               // Optional - Hidden truths
    goalsAndMotivations: string;    // Required, min 50 chars - Objectives
  };

  // Legacy fields (kept for backward compatibility)
  publicDescription: string;   // Required, min 50 chars - Public appearance
  privateDescription: string;  // Required, min 50 chars - Private aspects
  physicalDescription?: string; // Optional - Physical details
  motivations?: string;
  fears?: string;

  // Social System
  socialClass: string;  // Determined by Finanza skill value

  // Game Data
  currentLocation?: ObjectId;
  inventory: ObjectId[];
  wallet: { cash: number; deposit: number; };

  // Progression tracking
  experiencePoints: number;
  skillPoints: number;

  // Audio System
  audioTheme?: {
    type: 'file' | 'youtube';
    url: string;
    title?: string;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastActive: Date;
  approvedAt?: Date;
  approvedBy?: ObjectId;
}
```

### Character States

```typescript
enum CharacterState {
  DRAFT = 'DRAFT',                    // Wizard creation in progress
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Awaiting staff review
  APPROVED = 'APPROVED',              // Full gameplay access
  DELETED = 'DELETED'                 // Soft deleted, no access
}

// Access rules per state
const getCharacterAccess = (state: CharacterState) => {
  switch (state) {
    case 'DRAFT':
      return { canEdit: true, canPlay: false, canView: true };
    case 'PENDING_APPROVAL':
      return { canEdit: false, canPlay: false, canView: true };
    case 'APPROVED':
      return { canEdit: false, canPlay: true, canView: true };
    case 'DELETED':
      return { canEdit: false, canPlay: false, canView: false };
  }
};
```

### ✨ Bot Characters (v2.1) - AI-Controlled NPCs

Bot Characters sono personaggi non-giocanti (NPC) controllati da intelligenza artificiale tramite il BotAI Backend e Claude API. Questi personaggi hanno caratteristiche speciali che li distinguono dai personaggi giocatore.

#### Bot Character Properties

```typescript
interface BotCharacter extends Character {
  bot_id: string;              // REQUIRED - Links to Bot in botai database
  status: 'APPROVED';          // Auto-approved, no review needed
  userId: SYSTEM_BOT_USER_ID;  // Owned by system user, not real player
  gameplayRoles: ['personaggio']; // Always 'personaggio' role
  isActive: false;             // Never shown in active character lists
}
```

#### Differences: Bot vs Player Characters

| Property | Player Character | Bot Character |
|----------|-----------------|---------------|
| `bot_id` | `undefined` | **Required** string (links to botai DB) |
| `status` | DRAFT → PENDING → APPROVED | **APPROVED** (immediately) |
| `userId` | Real user ID | **SYSTEM_BOT_USER_ID** (env variable) |
| `isActive` | `true` when selected | **`false`** (always hidden from lists) |
| Approval workflow | Manual staff review | **Auto-approved** on creation |
| Character lists | Shown in player lists | **Hidden** from all lists |
| Creation endpoint | `POST /game/characters/create` | **`POST /game/characters/bot`** (bot API key) |

#### Bot Character Creation

Bot characters are created by the BotAI Backend via bot API:

```typescript
// BotAI Backend calls Game Backend:
POST /game/characters/bot
Headers: {
  'x-bot-api-key': process.env.GAME_BACKEND_BOT_API_KEY
}
Body: {
  name: "Sherlock",
  surname: "Holmes",
  bot_id: "sherlock_holmes_v1",  // REQUIRED - links to bot in botai DB

  // Optional fields with defaults:
  age: 30,
  apparentAge: 30,
  gender: "male",
  birthPlace: "London",

  physicalDescription: "Alto, magro, con occhi penetranti",
  publicDescription: "Detective consulente di Baker Street",
  privateDescription: "Genio deduttivo con dipendenza da cocaina",

  stats: {
    strength: 50,
    dexterity: 70,
    intelligence: 95,
    constitution: 60,
    size: 65,
    charm: 40,
    power: 80,
    education: 90
  },

  background: {
    briefHistory: "...",
    personality: "...",
    goalsAndMotivations: "..."
  }
}

Response: {
  success: true,
  data: { characterId: "67890abcdef" }
}
```

#### Bot Character Lifecycle

```
BotAI Backend creates Bot
    ↓
POST /game/characters/bot
    ↓
Character created with:
- bot_id = link to botai DB
- status = APPROVED (auto)
- userId = SYSTEM_BOT_USER_ID
- isActive = false
    ↓
Bot can now participate in gameplay:
- Create location actions
- Participate in turn-based sessions
- Interact with players
    ↓
Bot actions tracked and analyzed for:
- Relationship building
- Memory formation
- Sentiment analysis
```

#### System Configuration

```bash
# .env file (Game Backend)
SYSTEM_BOT_USER_ID=507f1f77bcf86cd799439011  # System user owns all bots
BOT_API_KEY=shared_secret_key                # Authentication for bot endpoints
```

#### Bot Character Identification

```typescript
// Check if character is bot:
function isBot(character: Character): boolean {
  return !!character.bot_id;
}

// Get bot characters:
const botCharacters = await Character.find({ bot_id: { $exists: true } });

// Get player characters only:
const playerCharacters = await Character.find({
  bot_id: { $exists: false },
  status: 'APPROVED'
});
```

#### Security & Access Control

- **Bot Creation**: Only accessible via `x-bot-api-key` header (not JWT)
- **Bot Actions**: Bot can create actions via `POST /game/locations/actions/bot`
- **Bot Ownership**: All bots owned by `SYSTEM_BOT_USER_ID`, not accessible to regular users
- **Bot Visibility**: Bots never appear in character selection lists
- **Bot Permissions**: Bots have same gameplay permissions as 'personaggio' role

#### Integration with Bot AI System

For complete Bot AI system documentation:
- **Turn-based gameplay**: [Session Management](./session-management.md)
- **Bot decision logic**: [Bot AI System](./bot-ai-system.md)
- **API endpoints**: [API Documentation](../api-docs.md#bot-api-endpoints)

---

## Character Creation System v2.0

### Call of Cthulhu Rules Implementation

#### Characteristics (Stats) - Step 2

- **Base fissa**: Ogni caratteristica inizia con **20 punti** gratuiti (non modificabili)
- **Punti da distribuire**: **400 punti** aggiuntivi da assegnare liberamente
- **Totale caratteristiche**: 560 punti (20 × 8 + 400)
- **Valore minimo**: 20 punti per caratteristica
- **Massimo per caratteristica**: 85 punti (limite creazione)
- **Validazione**: Sistema verifica che tutti i 400 punti siano completamente utilizzati
- **Regola speciale**: Massimo **2 caratteristiche** possono superare 80 punti

**Environment Variables**:
```bash
CHARACTER_STAT_TOTAL_POINTS=400
CHARACTER_MAX_STATS_ABOVE_80=2
CHARACTER_MIN_STR=20
CHARACTER_MIN_SIZ=20
CHARACTER_MIN_DEX=30
CHARACTER_MIN_CON=30
CHARACTER_MIN_INT=15
CHARACTER_MIN_EDU=15
CHARACTER_MIN_POW=15
CHARACTER_MIN_CHA=15
```

#### Skills (Abilità) - Step 3

- **Punti base**: 200 punti liberi da distribuire
- **Bonus Intelligenza**: +(INT ÷ 2) punti aggiuntivi (arrotondati per difetto)
- **Calcolo totale**: 200 + Math.floor(INT/2) = punti abilità disponibili
- **Cap creazione**: 75 punti massimo per abilità (solo punti giocatore)
- **Cap finale**: 80 punti massimo inclusi bonus professione
- **Validazione**: Tutti i punti devono essere completamente utilizzati

**Environment Variables**:
```bash
CHARACTER_SKILL_TOTAL_POINTS=200
CHARACTER_SKILL_CAP=75
CHARACTER_FINAL_SKILL_CAP=80
```

**Example**:
- Intelligence = 80
- INT bonus = 80 / 2 = 40
- Total skill points = 200 + 40 = **240 points**

---

## NEW SYSTEM: Occupation System v2.0

### Occupation Model (Updated)

```typescript
interface Occupation {
  _id: ObjectId;
  name: string;  // e.g., "Medico"
  description: string;
  category: string;  // medical | legal | criminal | entertainment | etc.

  // Gender and age restrictions (historical accuracy)
  allowedGenders: ('male' | 'female')[];

  // Prerequisites
  prerequisites?: {
    minimumStats?: Record<string, number>;    // { intelligence: 60, education: 65 }
    minimumSkills?: Record<string, number>;   // { "Medicina": 40 }
    minimumAge?: number;
    maximumAge?: number;
  };

  // NEW SYSTEM v2.0: Required Skills (exactly 6)
  requiredSkills: Array<{
    skillId: ObjectId;         // Reference to Skill model
    isFixed: boolean;          // true = must improve this exact skill
                               // false = can choose from alternatives
    alternatives?: ObjectId[]; // List of alternative skills if isFixed=false
  }>;

  // NEW SYSTEM v2.0: Bonus Skills (1-2 skills)
  bonusSkills: Array<{
    skillId: ObjectId;    // Reference to Skill model
    bonusValue: number;   // e.g., 20 = +20 points to this skill
  }>;

  // Economic and social data
  dailySalary: number;
  socialRespectability: number;
  socialClass: string[];  // Compatible social classes
  workingConditions: string;
  rarity: 'common' | 'uncommon' | 'rare';

  // Starting equipment
  startingItems?: Array<{
    itemId: ObjectId;
    quantity: number;
  }>;

  createdAt: Date;
  updatedAt: Date;
}
```

### Required Skills System

Every occupation has **exactly 6 required skills** that the player must improve during character creation (Step 3).

**Types of Required Skills**:

1. **Fixed Skills** (`isFixed: true`):
   - Player MUST improve this specific skill
   - No alternatives available
   - Example: "Medicina" for Medico occupation

2. **Choice Skills** (`isFixed: false`):
   - Player can choose ONE skill from a list of alternatives
   - Example: "Ammaliare OR Intimidire OR Persuadere OR Raggirare"

**Example - Medico (Doctor)**:
```typescript
{
  name: "Medico",
  requiredSkills: [
    { skillId: "lingua_id", isFixed: true },              // 1. Lingua (fixed)
    { skillId: "medicina_id", isFixed: true },            // 2. Medicina (fixed)
    { skillId: "primo_soccorso_id", isFixed: true },      // 3. Primo soccorso (fixed)
    { skillId: "empatia_id", isFixed: true },             // 4. Empatia (fixed)
    { skillId: "biologia_id", isFixed: true },            // 5. Biologia (fixed)
    {                                                      // 6. Farmacologia (fixed)
      skillId: "farmacologia_id",
      isFixed: true
    }
  ],
  bonusSkills: [
    { skillId: "empatia_id", bonusValue: 20 }  // +20 to Empatia (auto-applied)
  ]
}
```

**Example with Alternatives - Artista (Artist)**:
```typescript
{
  name: "Artista",
  requiredSkills: [
    {  // 1. Arte - Pittura OR Arte - Scultura (choice)
      skillId: "arte_pittura_id",
      isFixed: false,
      alternatives: ["arte_scultura_id"]
    },
    { skillId: "individuare_id", isFixed: true },         // 2. Individuare (fixed)
    { skillId: "lingua_id", isFixed: true },              // 3. Lingua (fixed)
    { skillId: "storia_id", isFixed: true },              // 4. Storia (fixed)
    { skillId: "empatia_id", isFixed: true },             // 5. Empatia (fixed)
    {  // 6. Ammaliare OR Intimidire OR Persuadere OR Raggirare (choice)
      skillId: "ammaliare_id",
      isFixed: false,
      alternatives: ["intimidire_id", "persuadere_id", "raggirare_id"]
    }
  ],
  bonusSkills: [
    { skillId: "manualita_id", bonusValue: 20 }  // +20 to Manualità
  ]
}
```

### Bonus Skills System

Occupation bonuses are **automatically applied** when the player confirms their occupation and proceeds from Step 4 to Step 5.

**API Integration**:
```typescript
// Endpoint: POST /game/characters/:characterId/apply-occupation-bonuses
// Called automatically in wizard.tsx nextStep() function

const applyOccupationBonuses = async (characterId: string) => {
  const response = await fetch(`${API_URL}/game/characters/${characterId}/apply-occupation-bonuses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selectedAlternatives: { /* requirementId: skillId map */ }
    }),
    credentials: 'include'
  });

  // Backend applies bonuses and returns updated character
  const result = await response.json();
  // Frontend reloads character data to show updated skill values
};
```

**Backend Logic** (`characterCreationUtils.ts`):
```typescript
export async function applyOccupationBonuses(
  character: ICharacter,
  occupation: IOccupation,
  selectedAlternatives?: { [requirementId: string]: string }
): Promise<OccupationBonusResult> {

  // For each bonus skill:
  for (const bonusSkill of occupation.bonusSkills) {
    const skill = await Skill.findById(bonusSkill.skillId);
    const currentValue = character.skills[skill.name] || skill.baseValue;
    const newValue = currentValue + bonusSkill.bonusValue;

    // Cap at finalSkillCap (80)
    character.skills[skill.name] = Math.min(newValue, 80);
  }

  character.occupationBonusesApplied = true;
  await character.save();

  return { bonusesApplied: [...], exceededCap: false, warnings: [] };
}
```

**Bonus Rules**:
- Bonuses can push skills above normal cap (75) up to final cap (80)
- If bonus would exceed 80, skill is capped at 80
- Bonuses are applied ONCE per character
- Flag `occupationBonusesApplied` prevents double application

---

## Character Creation Wizard Flow

### NEW Step Order (v2.0)

```typescript
const WIZARD_STEPS = [
  { id: 1, title: 'Informazioni Base', component: WizardStep1_BasicInfo },
  { id: 2, title: 'Caratteristiche', component: WizardStep2_Stats },
  { id: 3, title: 'Abilità', component: WizardStep3_Skills },
  { id: 4, title: 'Occupazione', component: WizardStep4_Occupation },
  { id: 5, title: 'Background', component: WizardStep5_Background },
  { id: 6, title: 'Revisione', component: WizardStep6_Review }
];
```

### Step 1: Informazioni Base + Anagrafica

**Required Fields**:
- firstName (string)
- lastName (string)
- age (number, 18-80)
- apparentAge (number, 16-90)
- gender ('male' | 'female')
- birthPlace (string)

**NEW v2.0: Optional Anagrafica Fields**:
- height (string) - e.g., "1,75 m", "5'9\""
- eyeColor (string) - e.g., "Castani", "Azzurri"
- hairColor (string) - e.g., "Neri", "Biondi"
- visibleMarks (string) - e.g., "Cicatrice sul sopracciglio"
- hiddenMarks (string) - e.g., "Tatuaggio sulla schiena"
- maritalStatus (dropdown) - single | married | widowed | separated | divorced
- illnesses (string) - e.g., "Asma", "Reumatismi"
- educationTitle (string) - e.g., "Laurea in Medicina"
- criminalRecord (string) - e.g., "Pulito", "Furto (1885)"

**Validation**:
- All required fields must be filled
- Age within valid range
- Optional fields do NOT block progression

### Step 2: Caratteristiche (Stats)

**Allocation Rules**:
- Start with 20 base points per stat (fixed, not modifiable)
- Distribute exactly 400 points across 8 characteristics
- Maximum 2 stats can exceed 80
- Maximum value per stat: 85

**Auto-calculated Derived Stats**:
- Hit Points = (SIZE + CON) / 10
- Sanity Points = POWER
- Luck Roll = POWER
- Idea Roll = INTELLIGENCE
- Knowledge = EDUCATION
- Magic Points = POWER / 5
- Damage Bonus = from FOR + TAG table
- Build = from FOR + TAG table

### Step 3: Abilità (Skills)

**Allocation Rules**:
- Base points: 200
- Intelligence bonus: +INT/2
- Total = 200 + (INT/2)
- Maximum per skill: 75 (before occupation bonuses)
- All points must be spent

**Dynamic Skills**:
Players can add custom skills based on templates:
- Lingua (Francese), Lingua (Tedesco), etc.
- Arte - specific types
- Conoscenze - specific areas

### Step 4: Occupazione ⭐ NEW SYSTEM

**UI Display**:
- Shows ALL occupations (55 total)
- Incompatible occupations show ⚡ badge
- Each card shows:
  - **Required Skills (6)**: List with alternatives if applicable
  - **Bonus Skills (1-2)**: With bonus values (+20, +15, etc.)
  - **Starting Items**: Equipment provided
  - **Prerequisites**: If not met, shows warnings

**Selection Flow**:
1. Player reviews occupation cards
2. Clicks to select occupation
3. Wizard validates prerequisites (gender, age, stats, skills)
4. If valid, occupation is stored
5. Player clicks "Continua con il Background →"
6. **API Call**: Backend applies occupation bonuses
7. Frontend reloads character data with updated skills
8. Progression to Step 5

**API Call** (automatic):
```typescript
// In wizard.tsx nextStep() function
if (currentStep === 4 && characterData.occupation && !characterData.occupationBonusesApplied) {
  const response = await fetch(`${API_URL}/game/characters/${characterId}/apply-occupation-bonuses`, {
    method: 'POST',
    body: JSON.stringify({ selectedAlternatives: {...} }),
    credentials: 'include'
  });

  // Reload character to get updated skills
  const updatedCharacter = await fetchCharacter(characterId);
  updateCharacterData({ skills: updatedCharacter.skills, occupationBonusesApplied: true });
}
```

### Step 5: Background Strutturato ⭐ NEW SYSTEM

**Required Fields** (min character counts):
- **publicDescription** (min 50 chars) - How character appears to others
- **privateDescription** (min 50 chars) - Hidden aspects, secrets
- **background.briefHistory** (min 100 chars) - Life story chronology
- **background.personality** (min 50 chars) - Character traits, temperament
- **background.goalsAndMotivations** (min 50 chars) - Objectives, ambitions

**Optional Fields**:
- physicalDescription - Physical details
- background.significantEvents - Key moments that shaped character
- background.importantRelationships - Important people in life
- background.ideology - Beliefs and values
- background.significantPlaces - Meaningful locations
- background.fearsAndPhobias - Fears (important for Sanity system)
- background.secrets - Hidden truths, things character doesn't want discovered

**UI Features**:
- Real-time character count feedback on required fields
- Detailed validation error list
- Victorian-themed tips and suggestions
- Auto-save on field blur

### Step 6: Revisione Finale

**Display Sections**:
1. **Informazioni Base**: Name, age, gender, birthplace, social class
   - **+ Anagrafica Dettagliata** (if filled): All 9 optional fields

2. **Caratteristiche**: All 8 stats + derived stats

3. **Occupazione** ⭐:
   - Occupation name
   - **Required Skills (6)**: With alternatives shown
   - **Bonus Skills (1-2)**: With applied values

4. **Abilità Principali**: Top 8 skills with values **INCLUDING applied bonuses**

5. **Background e Storia** ⭐:
   - Public/Private/Physical descriptions
   - All 9 structured background fields (if filled)

**Validation**:
- All required fields completed
- All skill/stat points spent
- Occupation bonuses applied
- Background structured fields minimum lengths met

**Submission**:
- Button "Invia per Approvazione"
- Creates character with state PENDING_APPROVAL
- Staff review queue notification

---

## API Endpoints

### Character Creation

```typescript
// Create new draft character
POST /game/characters/create
Body: { name, surname, gender, age, ... }
Response: { character: Character }

// Update draft character
PUT /game/characters/:characterId
Body: { stats, skills, occupation, background, ... }
Response: { character: Character, message: string }

// Get my characters
GET /game/characters/my
Response: { characters: Character[] }

// Get specific character
GET /game/characters/:characterId
Response: { character: Character }

// NEW v2.0: Apply occupation bonuses
POST /game/characters/:characterId/apply-occupation-bonuses
Body: { selectedAlternatives?: { [requirementId]: skillId } }
Response: {
  message: string,
  bonusesApplied: Array<{ skillId, skillName, bonusValue, finalValue }>,
  exceededCap: boolean,
  warnings: string[]
}

// NEW v2.0: Get skill points calculation
GET /game/characters/:characterId/skill-points
Response: {
  basePoints: 200,
  intBonus: number,
  totalAvailable: number,
  occupationRequiredSkills: 6,
  skillCap: 75,
  finalSkillCap: 80
}

// NEW v2.0: Check occupation prerequisites
GET /occupations/:occupationId/check-prerequisites?characterId=:id
Response: {
  canAccess: boolean,
  issues: string[]
}

// Submit character for approval
POST /game/characters/:characterId/submit
Response: { character: Character, message: string }

// Select active character
POST /game/characters/:characterId/select
Response: { character: Character, message: string }

// Delete character (soft delete)
DELETE /game/characters/:characterId
Response: { message: string }
```

---

## Validation System

### Centralized Validation

All validation is performed in `wizard.tsx` using `validateAllSteps()` function:

```typescript
interface StepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  pointsUsed?: number;
  pointsTotal?: number;
  pointsRemaining?: number;
}

const validateAllSteps = (data: CharacterWizardData): ValidationResults => {
  // Step 1: Basic Info
  // Step 2: Stats (400 points, max 2 above 80)
  // Step 3: Skills (200 + INT/2 points, cap 75)
  // Step 4: Occupation (prerequisites check)
  // Step 5: Background (min lengths, required fields)
  // Step 6: Review (all previous steps valid)

  return results;
};
```

### Server-Side Validation

Backend validates on:
- **Character Update** (`CharacterController.updateCharacter`)
- **Character Submission** (`CharacterController.submitCharacter`)

Validation middleware:
- `CharacterValidationMiddleware.validateCharacterCreation`
- `CharacterValidationMiddleware.validateVictorianContent`
- `CharacterValidationMiddleware.validateBackgroundCompletion`

---

## Social Class System

Social class is **automatically determined** from the **Finanza (Finance)** skill value:

```typescript
const SOCIAL_CLASS_RANGES = [
  { min: 1,  max: 9,  name: 'destitute',        label: 'Indigente' },
  { min: 10, max: 19, name: 'poor',             label: 'Povero' },
  { min: 20, max: 39, name: 'modest',           label: 'Modesto' },
  { min: 40, max: 49, name: 'lower_middle',     label: 'Piccola borghesia' },
  { min: 50, max: 69, name: 'middle_class',     label: 'Media borghesia' },
  { min: 70, max: 79, name: 'wealthy',          label: 'Ricco' },
  { min: 80, max: 89, name: 'affluent',         label: 'Facoltoso' },
  { min: 90, max: 99, name: 'elite',            label: 'Élite' }
];
```

**Impact**:
- Determines compatible occupations
- Affects social respectability
- Influences starting resources
- Impacts NPC interactions

---

## Staff Approval System

### Review Workflow

1. **Character Submitted**: State → PENDING_APPROVAL
2. **Staff Notified**: Review queue updated
3. **Staff Reviews**: Checks historical accuracy, role-play quality, rule compliance
4. **Approval**: Character → APPROVED, player notified
5. **Rejection**: Character → DRAFT with feedback, player can revise

### Management Interface

Staff tools at `management.tenpennynovels.com`:
- Character review queue
- Character details view with all wizard data
- Approval/rejection with feedback comments
- Batch operations for multiple characters

---

## Testing

### Manual Testing Guide

See: [`docs/testing/wizard-testing-guide.md`](../07-testing/wizard-testing-guide.md)

Comprehensive test plan covering:
- All 6 wizard steps
- Occupation bonus API integration
- Background structured validation
- Review step display verification
- Submission workflow

### Automated Testing

```bash
# API endpoint testing
./scripts/test-character-endpoints.sh

# Frontend component testing
cd apps/game
npm run test

# E2E testing
npm run test:e2e
```

---

## Migration Notes

### Migrating from OLD SYSTEM to NEW SYSTEM

**Characters created before v2.0**:
- Will have OLD occupation format with `skillBonuses` object
- Backend can read both formats for backward compatibility
- Staff can flag old characters for manual migration
- No automatic migration to avoid data loss

**Occupations**:
- All 55 occupations re-seeded with NEW SYSTEM format
- OLD occupation documents archived
- `OccupationSeeder.ts` handles CSV import with `requiredSkills` + `bonusSkills`

---

## Troubleshooting

### Issue: Occupation bonuses not applied

**Symptoms**: Skills don't show bonus values in Review step

**Causes**:
- API call failed during Step 4 → 5 transition
- Backend endpoint not responding
- Character data not reloaded after API call

**Solutions**:
1. Check browser console for API errors
2. Verify backend endpoint: `POST /game/characters/:characterId/apply-occupation-bonuses`
3. Check backend logs for errors
4. Reload wizard page to trigger re-fetch
5. If persistent, bonuses will be applied during final submission

### Issue: Validation errors on submit

**Symptoms**: Cannot submit character, validation errors shown

**Causes**:
- Required fields not filled (check character count minimums)
- Skill points not fully allocated
- Occupation prerequisites not met

**Solutions**:
1. Check Review step "Dati Mancanti" panel for specific errors
2. Go back to relevant step and fix issues
3. Verify skill point counters show 0 remaining
4. Verify occupation prerequisites met (no ⚡ badge)

### Issue: Draft auto-save not working

**Symptoms**: Progress lost on page reload

**Causes**:
- LocalStorage full or disabled
- API update endpoint failing
- Network connectivity issues

**Solutions**:
1. Check browser console for storage errors
2. Clear browser cache/localStorage
3. Use manual "💾 SALVA" button explicitly
4. Check network tab for failed API calls

---

## Future Enhancements

### Planned Features

- **Alternative Skill Selection UI**: Dropdown/radio buttons for choice skills in Step 3
- **Occupation Recommendations**: AI-powered suggestions based on stats/skills
- **Background Templates**: Pre-written background examples for inspiration
- **Character Portraits**: Upload or generate AI portraits
- **Audio Theme Selection**: Choose character theme music during creation
- **Dice Roll Stats**: Option to roll stats instead of point-buy

### Under Consideration

- **Multi-language Support**: Wizard in English, French, German
- **Mobile-Optimized Wizard**: Touch-friendly UI for tablets/phones
- **Collaborative Creation**: Multiple players create characters together
- **Character Import**: Import from other Call of Cthulhu character sheets

---

## References

### Call of Cthulhu Rules

- Call of Cthulhu 7th Edition Keeper Rulebook
- Investigator Handbook
- Victorian Age Sourcebook (if available)

### Historical Accuracy

- Victorian London social structure research
- Period-appropriate occupations and professions
- Gender roles and restrictions (1880s-1890s London)

### Code References

- **Frontend**: `apps/game/src/pages/character/wizard.tsx`
- **Components**: `apps/game/src/components/character/wizard/WizardStep*.tsx`
- **Backend**: `services/game-backend/src/controllers/CharacterController.ts`
- **Utilities**: `services/game-backend/src/utils/characterCreationUtils.ts`
- **Models**: `services/database/models/Character.ts`, `Occupation.ts`
- **Seeders**: `scripts/seeders/OccupationSeeder.ts`
- **Data**: `scripts/data/occupations.csv` (55 occupations)

---

**Document Version**: 2.0
**Last Updated**: 2025-01-14
**Status**: ✅ Production Ready
**Tested**: ⏳ Pending manual testing
