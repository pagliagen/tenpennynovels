# Character System Documentation

## Overview

Il sistema personaggi di TenpennyNovels implementa le regole Call of Cthulhu complete con modifiche per l'ambientazione vittoriana, supportando creazione wizard multi-step, approvazione staff, gestione schede personaggio e progressione del personaggio basata su esperienza.

## Database Architecture

### Character Model

```typescript
interface Character {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  state: CharacterState;
  roles: GameplayRole[];
  
  // Call of Cthulhu Stats (8 caratteristiche base)
  characteristics: {
    STR: number; // Strength (Forza)
    CON: number; // Constitution (Costituzione) 
    SIZ: number; // Size (Taglia)
    DEX: number; // Dexterity (Destrezza)
    APP: number; // Appearance (Fascino)
    INT: number; // Intelligence (Intelligenza)
    POW: number; // Power (Potere)
    EDU: number; // Education (Educazione)
  };
  
  // Skills (Victorian London modified)
  skills: Record<string, number>;
  occupation: string;
  socialClass: string;
  
  // Victorian specifics
  gender: 'male' | 'female';
  age: number;
  backstory: string;
  appearance: string;
  
  // Game Data
  currentLocation: ObjectId;
  inventory: ObjectId[];
  wallet: { cash: number; deposit: number; };
  
  // Audio System
  audioTheme?: {
    type: 'file' | 'youtube';
    url: string;
    title?: string;
  };
  
  // Progression tracking
  experiencePoints?: number;
  skillPoints?: number;
  
  createdAt: Date;
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
    case 'DRAFT': return { canEdit: true, canPlay: false, canView: true };
    case 'PENDING_APPROVAL': return { canEdit: false, canPlay: false, canView: true };
    case 'APPROVED': return { canEdit: false, canPlay: true, canView: true };
    case 'DELETED': return { canEdit: false, canPlay: false, canView: false };
  }
};
```

### Gameplay Roles

```typescript
enum GameplayRole {
  PERSONAGGIO = 'personaggio',        // Base player role
  MASTER = 'master',                  // Narrative control, XP granting
  MODERATORE = 'moderatore',          // Behavior management, chat moderation
  AMMINISTRATORE = 'amministratore'   // Full system privileges
}

// Role hierarchy for permissions
const ROLE_HIERARCHY = {
  'personaggio': 0,
  'moderatore': 1,
  'master': 2, 
  'amministratore': 3
};
```

## Character Creation System

### Call of Cthulhu Rules Implementation

#### Characteristics (Stats) - 560 Total Points
- **Base fissa**: Ogni caratteristica inizia con **20 punti** gratuiti
- **Punti da distribuire**: **400 punti** aggiuntivi da assegnare liberamente
- **Totale caratteristiche**: 560 punti (20 × 8 + 400)
- **Valore minimo**: 20 punti (base fissa, non modificabile)
- **Massimo per caratteristica**: 85 punti (20 base + 65 max investiti)
- **Validazione**: Sistema verifica che tutti i 400 punti siano completamente utilizzati

#### Skills (Abilità) - Variable Total
- **Punti base**: 200 punti liberi da distribuire
- **Bonus Intelligenza**: +(INT ÷ 2) punti aggiuntivi (arrotondati per difetto)
- **Calcolo totale**: 200 + Math.floor(INT/2) = punti abilità disponibili
- **Cap creazione**: 75 punti massimo per abilità (solo punti giocatore)
- **Cap finale**: 80 punti massimo inclusi bonus professione
- **Bonus professione**: Ogni occupazione fornisce bonus fissi su abilità specifiche

### Character Creation Wizard

```typescript
interface WizardStep {
  id: string;
  title: string;
  component: React.ComponentType;
  validation: Joi.ObjectSchema;
  isComplete: (data: Partial<Character>) => boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'basic-info',
    title: 'Informazioni Base',
    component: BasicInfoStep,
    validation: basicInfoSchema,
    isComplete: (data) => !!(data.name && data.gender && data.age)
  },
  {
    id: 'characteristics', 
    title: 'Caratteristiche (400 pts)',
    component: CharacteristicsStep,
    validation: characteristicsSchema,
    isComplete: (data) => {
      const total = Object.values(data.characteristics || {})
        .reduce((sum, val) => sum + (val - 20), 0);
      return total === 400;
    }
  },
  {
    id: 'skills',
    title: 'Abilità (200 + INT/2 pts)', 
    component: SkillsStep,
    validation: skillsSchema,
    isComplete: (data) => {
      const skillPoints = Object.values(data.skills || {})
        .reduce((sum, val) => sum + val, 0);
      const intBonus = Math.floor((data.characteristics?.INT || 20) / 2);
      return skillPoints === 200 + intBonus;
    }
  },
  {
    id: 'occupation',
    title: 'Occupazione',
    component: OccupationStep,
    validation: occupationSchema,
    isComplete: (data) => !!data.occupation
  },
  {
    id: 'background',
    title: 'Background & Aspetto',
    component: BackgroundStep, 
    validation: backgroundSchema,
    isComplete: (data) => !!(data.backstory && data.appearance)
  },
  {
    id: 'review',
    title: 'Revisione Finale',
    component: ReviewStep,
    validation: Joi.object(),
    isComplete: () => true
  }
];
```

## Victorian Occupation System

### Gender-Based Profession System

```typescript
interface Occupation {
  id: string;
  name: string;
  allowedGenders: ('male' | 'female')[];
  prerequisites?: {
    characteristics?: Partial<Record<keyof Characteristics, number>>;
    skills?: Partial<Record<string, number>>;
    socialClass?: string[];
  };
  skillBonuses: Record<string, number>;
  startingItems?: string[];
  description: string;
  historicalAccuracy: string;
}

// Male-only professions (historically accurate)
const MALE_OCCUPATIONS: Occupation[] = [
  {
    id: 'barrister',
    name: 'Barrister (Avvocato)',
    allowedGenders: ['male'],
    prerequisites: {
      characteristics: { EDU: 65, INT: 60 },
      socialClass: ['middle_class', 'wealthy', 'elite']
    },
    skillBonuses: {
      'Law': 30,
      'Library Use': 20,
      'Persuade': 25,
      'Psychology': 15
    },
    startingItems: ['legal_documents', 'law_books'],
    description: 'Avvocato che rappresenta clienti in tribunale',
    historicalAccuracy: 'Legal profession era riservata agli uomini nell\'era vittoriana'
  },
  {
    id: 'gentleman_detective',
    name: 'Gentleman Detective',
    allowedGenders: ['male'],
    prerequisites: {
      characteristics: { INT: 65, EDU: 60 },
      socialClass: ['middle_class', 'wealthy', 'elite']
    },
    skillBonuses: {
      'Spot Hidden': 25,
      'Psychology': 20,
      'Library Use': 15,
      'Persuade': 20
    },
    description: 'Detective privato di estrazione borghese',
    historicalAccuracy: 'Figura tipica della letteratura vittoriana, ispirata a Sherlock Holmes'
  }
];

// Female-accessible professions
const FEMALE_OCCUPATIONS: Occupation[] = [
  {
    id: 'governess',
    name: 'Governess (Governante)',
    allowedGenders: ['female'],
    prerequisites: {
      characteristics: { EDU: 55, INT: 50 },
      socialClass: ['modest', 'middle_class']
    },
    skillBonuses: {
      'Education': 40,
      'Psychology': 20,
      'Art': 15,
      'Other Language': 25
    },
    description: 'Educatrice privata per bambini di famiglie benestanti',
    historicalAccuracy: 'Una delle poche professioni rispettabili per donne educate'
  },
  {
    id: 'spiritualist',
    name: 'Spiritualist (Spiritista)',
    allowedGenders: ['female', 'male'], // Both allowed
    prerequisites: {
      characteristics: { POW: 60, APP: 55 }
    },
    skillBonuses: {
      'Occult': 35,
      'Psychology': 25,
      'Fast Talk': 15,
      'Art (Performance)': 15
    },
    description: 'Medium che comunica con gli spiriti',
    historicalAccuracy: 'Lo spiritismo era molto popolare nell\'epoca vittoriana'
  }
];
```

## Social Class System

### FINANZA-Based Classification

```typescript
interface SocialClass {
  name: string;
  label: string;
  range: { min: number; max: number; };
  weeklyCredit: number;              // Weekly income simulation
  initialCash: { min: number; max: number; };
  apartmentPrivileges: string[];     // Housing access levels
  occupationRestrictions?: string[]; // Limited professions
}

const SOCIAL_CLASSES: SocialClass[] = [
  {
    name: 'destitute',
    label: 'Indigente',
    range: { min: 1, max: 9 },
    weeklyCredit: 2,
    initialCash: { min: 5, max: 15 },
    apartmentPrivileges: [],
    occupationRestrictions: ['laborer', 'street_performer', 'beggar']
  },
  {
    name: 'poor',
    label: 'Povero',
    range: { min: 10, max: 19 },
    weeklyCredit: 5,
    initialCash: { min: 20, max: 40 },
    apartmentPrivileges: [],
    occupationRestrictions: ['servant', 'factory_worker', 'street_vendor']
  },
  {
    name: 'modest',
    label: 'Modesto',
    range: { min: 20, max: 39 },
    weeklyCredit: 15,
    initialCash: { min: 50, max: 100 },
    apartmentPrivileges: ['basic_rooms']
  },
  {
    name: 'middle_class',
    label: 'Media borghesia',
    range: { min: 50, max: 69 },
    weeklyCredit: 75,
    initialCash: { min: 400, max: 800 },
    apartmentPrivileges: ['basic_rooms', 'furnished_rooms']
  },
  {
    name: 'wealthy',
    label: 'Ricco',
    range: { min: 70, max: 89 },
    weeklyCredit: 150,
    initialCash: { min: 1000, max: 2000 },
    apartmentPrivileges: ['basic_rooms', 'furnished_rooms', 'luxury_suites']
  },
  {
    name: 'elite',
    label: 'Élite',
    range: { min: 90, max: 99 },
    weeklyCredit: 500,
    initialCash: { min: 8000, max: 15000 },
    apartmentPrivileges: ['all_available']
  }
];

// Automatic assignment based on FINANZA skill
const assignSocialClass = (finanzaSkill: number): SocialClass => {
  return SOCIAL_CLASSES.find(cls => 
    finanzaSkill >= cls.range.min && finanzaSkill <= cls.range.max
  ) || SOCIAL_CLASSES[0]; // Default to destitute
};
```

## Character Management System

### Multi-Character Support

```typescript
interface UserCharacters {
  userId: string;
  characters: Character[];
  activeCharacterId?: string;
  maxCharacters: number; // Configurable limit (default: 5)
}

// Character switching with JWT context update
const switchActiveCharacter = async (userId: string, characterId: string) => {
  // Validate character ownership and state
  const character = await Character.findOne({ 
    _id: characterId, 
    userId,
    state: { $ne: 'DELETED' }
  });
  
  if (!character) {
    throw new Error('Character not found or inaccessible');
  }
  
  // Update Redis active character context  
  await redis.set(`character:active:${userId}`, characterId);
  
  // Generate new character_context JWT
  const characterToken = jwt.sign({
    characterId: character._id,
    characterName: character.name,
    userId: character.userId,
    gameplayRoles: character.roles,
    type: 'character'
  }, process.env.JWT_SECRET!, { expiresIn: '24h' });
  
  return characterToken;
};
```

### Character Approval Workflow

```typescript
// Staff approval process with automatic social class assignment
const approveCharacter = async (characterId: string, staffId: string) => {
  const character = await Character.findById(characterId);
  
  if (character.state !== 'PENDING_APPROVAL') {
    throw new Error('Character not in pending state');
  }
  
  // Auto-assign social class based on FINANZA skill
  const socialClass = assignSocialClass(character.skills.FINANZA || 20);
  
  // Generate initial cash within social class range
  const initialCash = Math.floor(
    Math.random() * (socialClass.initialCash.max - socialClass.initialCash.min + 1)
  ) + socialClass.initialCash.min;
  
  // Update character to approved state
  const updatedCharacter = await Character.findByIdAndUpdate(characterId, {
    state: 'APPROVED',
    socialClass: socialClass.name,
    'wallet.cash': initialCash,
    'wallet.deposit': 0,
    approvedAt: new Date(),
    approvedBy: staffId
  }, { new: true });
  
  // Initialize character progression tracking
  await initializeCharacterProgression(characterId);
  
  // Publish approval event for other systems
  await redis.publish('character:events', JSON.stringify({
    type: 'CHARACTER_APPROVED',
    characterId,
    userId: character.userId,
    characterName: character.name,
    socialClass: socialClass.name,
    initialCash,
    timestamp: new Date()
  }));
  
  // Send approval notification
  await sendCharacterApprovalNotification(character.userId, character.name);
  
  return updatedCharacter;
};
```

## Audio Theme System

### Multi-Format Audio Support

```typescript
interface AudioTheme {
  type: 'file' | 'youtube';
  url: string;
  title?: string;
  autoplay: boolean;
  volume?: number;
}

// YouTube URL detection and validation
const detectAudioFormat = (url: string): 'file' | 'youtube' | 'invalid' => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.+/;
  const fileRegex = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i;
  
  if (youtubeRegex.test(url)) return 'youtube';
  if (fileRegex.test(url)) return 'file';
  return 'invalid';
};

// React component for character audio themes
const CharacterAudioTheme: React.FC<{ 
  theme: AudioTheme;
  isOwner: boolean;
  canHear: boolean;
}> = ({ theme, isOwner, canHear }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(theme.volume || 0.3);
  
  // Only show controls to character owner or those with permission
  if (!canHear) return null;
  
  if (theme.type === 'youtube') {
    return (
      <div className="character-audio-theme youtube">
        <iframe
          src={`${theme.url}?autoplay=${theme.autoplay ? 1 : 0}&controls=0`}
          style={{ display: 'none' }}
          allow="autoplay"
          title={theme.title || 'Character Theme'}
        />
        <div className="audio-controls">
          <button 
            className="play-pause"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <span className="theme-title">
            {theme.title || 'Character Theme'}
          </span>
          {isOwner && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="volume-slider"
            />
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="character-audio-theme file">
      <audio 
        src={theme.url} 
        controls={isOwner}
        autoPlay={theme.autoplay && canHear}
        volume={volume}
        title={theme.title || 'Character Theme'}
      />
    </div>
  );
};
```

## Character Sheet Display System

### Role-Based Information Visibility

```typescript
interface CharacterSheetProps {
  character: Character;
  viewerRoles: string[];
  isOwner: boolean;
  canEdit: boolean;
}

const CharacterSheet: React.FC<CharacterSheetProps> = ({ 
  character, 
  viewerRoles,
  isOwner,
  canEdit
}) => {
  // Determine what information viewer can see
  const canSeePrivateInfo = isOwner || 
    viewerRoles.includes('master') || 
    viewerRoles.includes('amministratore');
    
  const canSeeFinancialInfo = canSeePrivateInfo ||
    viewerRoles.includes('moderatore');
    
  const canEditCharacter = isOwner && canEdit && 
    (character.state === 'DRAFT' || hasEditPermission(character.state));
    
  return (
    <div className="character-sheet victorian-panel">
      {/* Basic Character Information - Always visible */}
      <CharacterBasicInfo 
        character={character}
        showAge={canSeePrivateInfo}
        showGender={true}
      />
      
      {/* Call of Cthulhu Statistics */}
      <CharacteristicsDisplay 
        characteristics={character.characteristics}
        showValues={true}
        allowEditing={canEditCharacter}
      />
      
      {/* Skills Display */}
      <SkillsDisplay 
        skills={character.skills}
        occupation={character.occupation}
        showProfessionBonuses={true}
        allowEditing={canEditCharacter}
      />
      
      {/* Social Information */}
      <SocialClassDisplay 
        socialClass={character.socialClass}
        occupation={character.occupation}
        showPrivileges={canSeePrivateInfo}
      />
      
      {/* Private Information - Masters, Admins, Owner only */}
      {canSeePrivateInfo && (
        <div className="private-character-info">
          <div className="backstory-section">
            <h4>Background</h4>
            <p>{character.backstory}</p>
          </div>
          
          <div className="appearance-section">
            <h4>Aspetto Fisico</h4>
            <p>{character.appearance}</p>
          </div>
        </div>
      )}
      
      {/* Financial Information - Moderators+ only */}
      {canSeeFinancialInfo && character.wallet && (
        <div className="financial-info">
          <h4>Situazione Economica</h4>
          <div className="wallet-display">
            <span className="cash">Contanti: £{character.wallet.cash}</span>
            <span className="deposit">Deposito: £{character.wallet.deposit}</span>
          </div>
        </div>
      )}
      
      {/* Character Audio Theme */}
      {character.audioTheme && (
        <CharacterAudioTheme 
          theme={character.audioTheme}
          isOwner={isOwner}
          canHear={canSeePrivateInfo}
        />
      )}
      
      {/* Edit Controls - Owner only, when editable */}
      {canEditCharacter && (
        <CharacterEditControls 
          character={character}
          allowedFields={getAllowedEditFields(character.state)}
          onSave={handleCharacterUpdate}
        />
      )}
      
      {/* Admin Controls - Staff only */}
      {(viewerRoles.includes('master') || viewerRoles.includes('amministratore')) && (
        <CharacterAdminControls
          character={character}
          viewerRoles={viewerRoles}
          onApprove={handleCharacterApproval}
          onReject={handleCharacterRejection}
        />
      )}
    </div>
  );
};
```

## API Endpoints

### Game Backend (/game/characters)

```typescript
// Character Management
GET    /game/characters                    // Lista personaggi utente
POST   /game/characters                    // Creazione nuovo personaggio
GET    /game/characters/:id                // Dettagli personaggio specifico
PUT    /game/characters/:id                // Aggiornamento personaggio
DELETE /game/characters/:id                // Soft delete personaggio
POST   /game/characters/:id/activate       // Attivazione personaggio

// Character Sheet Access
GET    /game/characters/:id/sheet          // Scheda personaggio completa
PUT    /game/characters/:id/audio-theme    // Aggiorna tema audio
GET    /game/characters/public             // Lista personaggi pubblici approvati
GET    /game/characters/:id/public         // Scheda pubblica (info non sensibili)

// Character Creation Wizard
GET    /game/characters/wizard/occupations // Lista occupazioni per genere
GET    /game/characters/wizard/skills      // Lista skill base Call of Cthulhu
POST   /game/characters/wizard/validate    // Validazione step wizard
POST   /game/characters/wizard/submit      // Sottomissione personaggio completo

// Character Progression  
GET    /game/characters/:id/progression    // Dati progressione esperienza
POST   /game/characters/:id/spend-xp       // Spesa punti esperienza
GET    /game/characters/:id/xp-history     // Storico guadagni esperienza
```

### Management Backend (/admin/characters)

```typescript
// Character Administration
GET    /admin/characters/pending           // Personaggi in attesa di approvazione
POST   /admin/characters/:id/approve       // Approvazione personaggio
POST   /admin/characters/:id/reject        // Rifiuto personaggio con motivazione
GET    /admin/characters                   // Lista completa tutti personaggi
PUT    /admin/characters/:id               // Modifica admin personaggio
DELETE /admin/characters/:id/hard-delete   // Eliminazione definitiva

// Statistics and Oversight
GET    /admin/characters/stats             // Statistiche generali personaggi
GET    /admin/characters/audit-log         // Log modifiche amministrative
GET    /admin/characters/social-class-distribution // Distribuzione classi sociali
GET    /admin/characters/occupation-stats  // Statistiche occupazioni
```

## Character Validation Schemas

### Creation Validation

```typescript
import Joi from 'joi';

// Basic information validation
export const basicInfoSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(30)
    .pattern(/^[A-Za-z\s\-\.\']+$/) // Letters, spaces, hyphens, periods, apostrophes
    .required()
    .messages({
      'string.pattern.base': 'Name must contain only letters, spaces, hyphens, periods, and apostrophes'
    }),
  gender: Joi.string().valid('male', 'female').required(),
  age: Joi.number().min(18).max(70).required()
});

// Characteristics validation with 400-point distribution
export const characteristicsSchema = Joi.object({
  STR: Joi.number().min(20).max(85).required(),
  CON: Joi.number().min(20).max(85).required(),
  SIZ: Joi.number().min(20).max(85).required(),
  DEX: Joi.number().min(20).max(85).required(),
  APP: Joi.number().min(20).max(85).required(),
  INT: Joi.number().min(20).max(85).required(),
  POW: Joi.number().min(20).max(85).required(),
  EDU: Joi.number().min(20).max(85).required()
}).custom((value, helpers) => {
  // Validate 400-point distribution rule
  const totalInvestedPoints = Object.values(value).reduce(
    (sum, val) => sum + (val - 20), 0
  );
  
  if (totalInvestedPoints !== 400) {
    return helpers.error('characteristics.pointDistribution', { 
      invested: totalInvestedPoints,
      required: 400
    });
  }
  
  // Validate maximum high stats rule (max 2 stats above 80)
  const highStats = Object.values(value).filter(val => val > 80).length;
  if (highStats > 2) {
    return helpers.error('characteristics.tooManyHighStats', { 
      count: highStats,
      max: 2
    });
  }
  
  return value;
});

// Skills validation with variable points based on INT
export const skillsSchema = Joi.object().pattern(
  Joi.string(), // Skill name
  Joi.number().min(0).max(75) // Skill value (75 cap during creation)
).custom((value, helpers) => {
  const context = helpers.state.ancestors[0]; // Full character data
  const intelligence = context.characteristics?.INT || 20;
  
  // Calculate available skill points
  const baseSkillPoints = 200;
  const intBonus = Math.floor(intelligence / 2);
  const totalAvailablePoints = baseSkillPoints + intBonus;
  
  // Calculate spent skill points
  const totalSkillPoints = Object.values(value).reduce(
    (sum, val) => sum + (val as number), 0
  );
  
  if (totalSkillPoints !== totalAvailablePoints) {
    return helpers.error('skills.pointDistribution', { 
      spent: totalSkillPoints,
      available: totalAvailablePoints,
      base: baseSkillPoints,
      intBonus
    });
  }
  
  return value;
});

// Occupation validation with prerequisites
export const occupationSchema = Joi.object({
  occupationId: Joi.string().required(),
  customProfession: Joi.string().max(100).optional()
}).custom(async (value, helpers) => {
  const context = helpers.state.ancestors[0];
  const occupation = await getOccupationById(value.occupationId);
  
  if (!occupation) {
    return helpers.error('occupation.notFound');
  }
  
  // Validate gender restrictions
  if (!occupation.allowedGenders.includes(context.gender)) {
    return helpers.error('occupation.genderRestriction', {
      occupation: occupation.name,
      allowedGenders: occupation.allowedGenders
    });
  }
  
  // Validate prerequisites if any
  if (occupation.prerequisites) {
    const prereqs = occupation.prerequisites;
    
    // Check characteristic requirements
    if (prereqs.characteristics) {
      for (const [char, minValue] of Object.entries(prereqs.characteristics)) {
        if (context.characteristics[char] < minValue) {
          return helpers.error('occupation.characteristicPrereq', {
            characteristic: char,
            required: minValue,
            current: context.characteristics[char]
          });
        }
      }
    }
    
    // Check skill requirements
    if (prereqs.skills) {
      for (const [skill, minValue] of Object.entries(prereqs.skills)) {
        if ((context.skills[skill] || 0) < minValue) {
          return helpers.error('occupation.skillPrereq', {
            skill,
            required: minValue,
            current: context.skills[skill] || 0
          });
        }
      }
    }
  }
  
  return value;
});

// Background validation
export const backgroundSchema = Joi.object({
  backstory: Joi.string()
    .min(100)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Backstory must be at least 100 characters',
      'string.max': 'Backstory cannot exceed 2000 characters'
    }),
  appearance: Joi.string()
    .min(50)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Physical description must be at least 50 characters',
      'string.max': 'Physical description cannot exceed 1000 characters'
    })
});

// Audio theme validation
export const audioThemeSchema = Joi.object({
  type: Joi.string().valid('file', 'youtube').required(),
  url: Joi.string().uri().required(),
  title: Joi.string().max(100).optional(),
  autoplay: Joi.boolean().default(false),
  volume: Joi.number().min(0).max(1).default(0.3)
}).custom((value, helpers) => {
  const detectedType = detectAudioFormat(value.url);
  
  if (detectedType === 'invalid') {
    return helpers.error('audioTheme.invalidFormat');
  }
  
  if (value.type !== detectedType) {
    return helpers.error('audioTheme.typeMismatch', {
      declared: value.type,
      detected: detectedType
    });
  }
  
  return value;
});
```

## Performance & Caching

### Character Data Caching Strategy

```typescript
// Redis caching for frequently accessed character data
const getCachedCharacter = async (characterId: string, includePrivate: boolean = false) => {
  const cacheKey = `character:${characterId}:${includePrivate ? 'full' : 'public'}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const character = await Character.findById(characterId);
  if (!character) return null;
  
  // Prepare data based on privacy level
  const characterData = includePrivate 
    ? character.toObject()
    : sanitizePublicCharacterData(character.toObject());
  
  // Cache for 5 minutes (characters don't change frequently)
  await redis.setex(cacheKey, 300, JSON.stringify(characterData));
  
  return characterData;
};

// Cache invalidation on character updates
const invalidateCharacterCache = async (characterId: string) => {
  await Promise.all([
    redis.del(`character:${characterId}:full`),
    redis.del(`character:${characterId}:public`),
    redis.del(`character:${characterId}:progression`)
  ]);
};

// Batch character loading for lists
const getCachedCharactersBatch = async (characterIds: string[], includePrivate: boolean = false) => {
  const cacheKeys = characterIds.map(id => 
    `character:${id}:${includePrivate ? 'full' : 'public'}`
  );
  
  const cached = await redis.mget(...cacheKeys);
  const results = [];
  const missingIds = [];
  
  cached.forEach((data, index) => {
    if (data) {
      results[index] = JSON.parse(data);
    } else {
      missingIds.push(characterIds[index]);
    }
  });
  
  // Fetch missing characters from database
  if (missingIds.length > 0) {
    const missingCharacters = await Character.find({
      _id: { $in: missingIds }
    });
    
    // Cache and add missing characters
    for (const character of missingCharacters) {
      const data = includePrivate 
        ? character.toObject()
        : sanitizePublicCharacterData(character.toObject());
        
      const cacheKey = `character:${character._id}:${includePrivate ? 'full' : 'public'}`;
      await redis.setex(cacheKey, 300, JSON.stringify(data));
      
      const index = characterIds.indexOf(character._id.toString());
      results[index] = data;
    }
  }
  
  return results.filter(Boolean); // Remove null entries
};
```

### Database Indexing

```typescript
// MongoDB indexes for optimal character queries
await db.collection('characters').createIndex({ 
  userId: 1, 
  state: 1 
}); // User's characters by state

await db.collection('characters').createIndex({ 
  state: 1, 
  createdAt: -1 
}); // Admin approval queue

await db.collection('characters').createIndex({ 
  name: 1 
}, { unique: true }); // Character name uniqueness

await db.collection('characters').createIndex({ 
  'characteristics.STR': 1 
}); // Stats-based searches

await db.collection('characters').createIndex({ 
  socialClass: 1, 
  occupation: 1 
}); // Social/profession queries

await db.collection('characters').createIndex({ 
  gameplayRoles: 1,
  state: 1 
}); // Role-based queries

await db.collection('characters').createIndex({ 
  lastActive: -1 
}); // Activity-based queries

await db.collection('characters').createIndex({ 
  approvedAt: -1,
  approvedBy: 1 
}); // Admin oversight
```

## Environment Configuration

```bash
# Character Creation Rules
CHARACTER_STAT_TOTAL_POINTS=400
CHARACTER_MAX_STATS_ABOVE_80=2
CHARACTER_SKILL_CAP=75
CHARACTER_FINAL_SKILL_CAP=80

# Character Limits
MAX_CHARACTERS_PER_USER=5
CHARACTER_NAME_MIN_LENGTH=3
CHARACTER_NAME_MAX_LENGTH=30

# Audio System
AUDIO_THEME_MAX_SIZE=10MB
YOUTUBE_API_KEY=your-youtube-api-key

# Social Class System
SOCIAL_CLASS_AUTO_ASSIGNMENT=true
INITIAL_CASH_RANDOMIZATION=true

# Character States
AUTO_APPROVE_CHARACTERS=false
REQUIRE_STAFF_APPROVAL=true
ALLOW_CHARACTER_DELETION=true
```

Il sistema personaggi di TenpennyNovels implementa un'esperienza completa di creazione e gestione personaggio che rispetta sia le regole storiche Call of Cthulhu che l'accuratezza dell'ambientazione vittoriana, fornendo un'interfaccia wizard intuitiva e strumenti di gestione avanzati per staff e giocatori.