# Add-ons Catalog - Location Advanced Features

## Filosofia Add-ons

**One-time purchase** invece di subscription add-on:
- Cliente compra feature per sempre
- No costo ricorrente aggiuntivo
- Works anche in self-hosted (con license key)
- Upsell senza frustrazione recurring billing

**Modular approach**:
- Compri solo quello che ti serve
- No feature bloat
- Scale gradualmente con esigenze

---

## 1. Housing System Advanced (€49)

### Descrizione
Sistema completo di gestione affitti immobiliari con calcolo automatico, riscossione, contratti e eviction.

### Problema che Risolve
- Master vuole economia realistica
- Gestione manuale affitti è noiosa
- Personaggi dimenticano di pagare
- No conseguenze per mancati pagamenti

### Features

#### 1.1 Rental System
- **Contratti di affitto**: Durata configurabile (mensile, trimestrale, annuale)
- **Auto-collect rent**: Sistema automatico preleva da wallet personaggio ogni mese
- **Payment reminders**: Notifica 3 giorni prima scadenza
- **Grace period**: X giorni di tolleranza configurabile
- **Late fees**: Penali per pagamenti in ritardo

#### 1.2 Eviction System
- **Auto-eviction**: Se non paga entro grace period → evicted
- **Eviction notice**: Notifica prima di eviction
- **Belongings handling**: Oggetti del personaggio vanno in "storage" temporaneo
- **Re-rent**: Location torna disponibile dopo eviction

#### 1.3 Landlord Dashboard
```
My Properties (Landlord View)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────────────────────────┐
│ 🏠 221B Baker Street               │
│ Tenant: Sherlock Holmes            │
│ Rent: £50/month                    │
│ Status: ✅ Paid (Next: Jan 1)      │
│ Contract: Monthly (6 months left)  │
│ [View Details] [Edit Contract]     │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 🏠 15 Whitechapel Road             │
│ Tenant: John Watson                │
│ Rent: £30/month                    │
│ Status: ⚠️ Overdue (3 days)        │
│ Contract: Monthly (3 months left)  │
│ [Send Reminder] [Evict]            │
└────────────────────────────────────┘

Total Income: £200/month
Collected this month: £150
Outstanding: £50
```

#### 1.4 Tenant Dashboard
```
My Rentals (Tenant View)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────────────────────────┐
│ 🏠 221B Baker Street               │
│ Landlord: Mrs. Hudson              │
│ Rent: £50/month                    │
│ Next payment: Jan 1 (in 5 days)   │
│ Balance: £120 in wallet ✅         │
│ [Pay Now] [Request Extension]      │
└────────────────────────────────────┘

Auto-pay: [●] Enabled
(Rent will be deducted automatically)
```

#### 1.5 Subleasing
- **Sublet**: Inquilino può sub-affittare (se contratto lo permette)
- **Chain**: Landlord → Tenant → Subtenant
- **Revenue split**: Configurabile (es: tenant tiene 20%)

#### 1.6 Admin Tools
- **Rent collection logs**: Chi ha pagato quando
- **Eviction history**: Log evictions per location
- **Revenue analytics**: Totali per landlord
- **Override**: Admin può forzare pagamento o eviction

### Configurazione

**Per Location**:
```typescript
interface RentalConfig {
  enabled: boolean;
  rentAmount: number; // in-game currency
  rentPeriod: 'weekly' | 'monthly' | 'quarterly';
  gracePeriodDays: number; // default 3
  lateFeePercent: number; // default 10%
  autoEvictAfterDays: number; // default 7
  subleasingAllowed: boolean;
  contractDuration: number; // months
}
```

### Use Cases
1. **Victorian Landlord RP**: Personaggio compra palazzo, affitta stanze
2. **Business**: Affittare negozio per business simulation
3. **Economic gameplay**: Landlord = passive income, risk of non-payment
4. **Social dynamics**: Eviction = drama RP

### Technical Implementation
- **Cron job**: Daily check alle 00:00 UTC
- **Payment queue**: Redis queue per processing
- **Transactions**: Atomic (rent payment + wallet update)
- **Webhooks**: Notifica Discord/email su eventi (payment, eviction)

### Price Justification
- **Development time**: ~20-30 ore
- **Ongoing cost**: Minimal (cron job CPU)
- **Value**: Sblocca intera economia immobiliare
- **Competitor**: No comparable feature in VTT platforms

---

## 2. Key & Access System (€29)

### Descrizione
Sistema chiavi fisiche come items, con lockpicking, log accessi, e meccaniche investigative.

### Problema che Risolve
- Accesso location troppo semplice (whitelist statica)
- No roleplay investigation (chi è entrato?)
- No mechanic per scassinare serrature
- Chiavi non trasferibili tra personaggi

### Features

#### 2.1 Physical Keys
- **Key as item**: Chiave è oggetto in inventario
- **Key types**:
  - Standard (copiabile)
  - Master (non copiabile)
  - Skeleton key (apre multiple location)
- **Durability**: Chiavi possono rompersi (opzionale)
- **Transfer**: Dai chiave a altro personaggio

#### 2.2 Key Management
```
Location Keys: "221B Baker Street"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issued Keys (3):
┌────────────────────────────────────┐
│ 🔑 Master Key #1                   │
│ Holder: Sherlock Holmes            │
│ Type: Master (non-copiable)        │
│ Issued: Dec 1, 1895                │
│ [Revoke]                           │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 🔑 Guest Key #2                    │
│ Holder: John Watson                │
│ Type: Standard (copiable)          │
│ Issued: Dec 5, 1895                │
│ Copies made: 1                     │
│ [Revoke] [View Copies]             │
└────────────────────────────────────┘

[Issue New Key...]
```

#### 2.3 Lockpicking System
- **Skill check**: Call of Cthulhu lockpick skill roll
- **Difficulty**: Based on lock quality (cheap/standard/advanced)
- **Failure consequences**:
  - Lock jams (requires repair)
  - Alarm triggers (if set)
  - Noise alert (nearby players notified)
- **Tools required**: Lockpick set (item)

#### 2.4 Access Logs
```
Access Log: "221B Baker Street"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Recent Entries:
• Jan 5, 10:23 - Sherlock Holmes (Key #1) ✅
• Jan 5, 09:15 - John Watson (Key #2) ✅
• Jan 4, 23:47 - Unknown (Lockpick) ⚠️
• Jan 4, 18:30 - Mary Morstan (Key #2 copy) ✅

Suspicious Activity:
⚠️ Jan 4, 23:47 - Failed lockpick attempt
⚠️ Jan 3, 02:15 - Lockpick success (no key)

[Export Log] [Set Alert]
```

#### 2.5 Alarm System
- **Trigger conditions**: Lockpick attempt, no-key entry
- **Notifications**:
  - Owner notified immediately
  - Nearby players hear alarm
  - Police NPC spawns (opzionale)
- **Disable alarm**: Owner can turn off

#### 2.6 Temporary Access
- **Time-limited keys**: Chiave valida solo X ore
- **One-time keys**: Chiave si consuma dopo uso
- **Guest passes**: Access senza chiave (temporary whitelist)

### Configuration

```typescript
interface KeyConfig {
  enabled: boolean;
  lockQuality: 'cheap' | 'standard' | 'advanced' | 'unpickable';
  alarmEnabled: boolean;
  logRetentionDays: number; // default 30
  maxKeysIssued: number; // limite chiavi emesse
  allowCopying: boolean;
  lockpickDifficulty: number; // CoC skill target
}
```

### Use Cases
1. **Mystery Investigation**: Chi è entrato nella scena del crimine?
2. **Heist RP**: Scassinare per entrare in location
3. **Trust dynamics**: Dare chiave = atto di fiducia RP
4. **Lost keys**: Drama quando personaggio perde chiave

### Technical Implementation
- **Item system integration**: Chiavi come items normali
- **Event logging**: Ogni access loggato in DB
- **Skill check**: Integration con sistema skills CoC
- **Real-time alerts**: WebSocket notification per alarms

### Price Justification
- **Development**: ~15-20 ore
- **Value**: Unique mechanic non disponibile altrove
- **RP enhancement**: Deep investigation gameplay

---

## 3. Smart Permissions (€19)

### Descrizione
Accesso location basato su attributi personaggio (occupazione, classe sociale, fazione, quest status).

### Problema che Risolve
- Whitelist manuale è tedious per club/organizzazioni grandi
- No automatic gatekeeping basato su lore
- Master deve manually check ogni access request

### Features

#### 3.1 Rule-Based Access
```
Access Rules: "The Diogenes Club"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Allow access if:
☑ Social class: Upper Class OR Nobility
☑ Occupation: ANY
☐ Faction: Diogenes Club Member
☐ Quest completed: "Club Initiation"
☐ Time window: 18:00-23:00 (Club hours)

Deny access if:
☑ Banned: [John Clay, Sebastian Moran]
☐ Reputation < 50

[Save Rules]
```

#### 3.2 Supported Conditions

**Character Attributes**:
- Social class (lower/working/middle/upper/nobility)
- Occupation (specific or category)
- Gender (for period-accurate clubs)
- Age range

**Game State**:
- Faction membership
- Quest completion status
- Reputation score (if system exists)
- Experience level

**Time-Based**:
- Day/night
- Specific hours (es: club opens 18:00-23:00)
- Day of week (es: "Gentlemen's night" only Thursday)
- Season/month

**Inventory**:
- Must possess specific item (es: membership card)
- Must wear specific clothing (dress code)

#### 3.3 Granular Permissions

Beyond "can enter", define what they can do:

```typescript
interface PermissionLevel {
  canEnter: boolean;
  canChat: boolean;
  canViewOthers: boolean;
  canInviteOthers: boolean;
  canEditLocation: boolean;
}

// Example: Public location with reading room
{
  // Anyone can enter
  default: { canEnter: true, canChat: false, canViewOthers: true },

  // Members can chat
  'faction:library-member': { canChat: true },

  // Librarians can moderate
  'occupation:librarian': { canEditLocation: true }
}
```

#### 3.4 Temporary Passes

- **Guest passes**: Admin emette pass temporaneo
- **Vouching system**: Membro può "vouch" per guest (limited uses)
- **Trial period**: Primo accesso = trial, poi serve membership

#### 3.5 Auto-Application

Quando character attributes cambiano:
- **Promoted to nobility**: Automatic access a upper-class clubs
- **Join faction**: Automatic access a faction locations
- **Complete quest**: Unlock new areas

#### 3.6 Access Denied Messages

Custom messages per condition:
```
"Sorry, the Diogenes Club is for gentlemen of distinguished
standing only. Perhaps you could gain introduction from a member?"

vs.

"The club is closed. Opening hours: 18:00-23:00"
```

### Configuration UI

```
Smart Permissions Builder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rule Type: [Dropdown]
• Social Class
• Occupation
• Faction
• Quest Status
• Time Window
• Inventory Check
• Custom Script

[Add Rule] [Test Rules]

Preview:
✅ Sherlock Holmes (Upper Class, Detective) - Access granted
❌ Street Urchin (Lower Class) - Access denied
✅ Dr. Watson (Middle Class, Doctor) - Access granted
```

### Use Cases
1. **Period-accurate clubs**: Men-only clubs, class-restricted venues
2. **Faction bases**: Automatic access per faction membri
3. **Quest-gated areas**: Unlock after story progression
4. **Business hours**: Location open only certain times
5. **Dress code**: Must have formal attire item

### Technical Implementation
- **Rule engine**: Evaluate rules on access attempt
- **Caching**: Cache evaluated rules (invalidate on character update)
- **Performance**: Rules evaluated in <10ms
- **Testing**: Admin can preview "would X character have access?"

### Price Justification
- **Development**: ~10-15 ore
- **Low cost**: Mostly logic, no infra
- **Value**: Saves tons of manual whitelist management
- **Immersion**: Period-accurate restrictions

---

## 4. Dynamic Environments (€39)

### Descrizione
Location che cambiano stato basate su tempo, eventi, numero presenti. Atmosfera dinamica.

### Problema che Risolve
- Location statiche = boring
- No sense of time passing
- No dynamic atmosphere
- Master must manually update descriptions

### Features

#### 4.1 Location States
```typescript
interface LocationState {
  id: string;
  name: string; // "tavern-empty", "tavern-crowded"
  description: string;
  imageUrl: string;
  ambientSound?: string;
  lighting: 'dark' | 'dim' | 'bright';
  temperature: 'cold' | 'comfortable' | 'hot';
}
```

**Example: The Brass Monkey Tavern**
- **Empty** (0-5 present): Quiet, barman cleaning glasses
- **Busy** (6-15 present): Lively chatter, smoke-filled
- **Crowded** (16+ present): Loud, cramped, rowdy

#### 4.2 Automatic State Transitions

**Triggers**:
1. **Time-based**:
   - Morning (6-12): Market busy, shops open
   - Afternoon (12-18): Moderate activity
   - Evening (18-24): Taverns fill, offices close
   - Night (0-6): Streets dangerous, most closed

2. **Population-based**:
   - Threshold: Change state when X players present

3. **Event-based**:
   - Global event: "Jack the Ripper strikes" → all Whitechapel locations become "fearful"
   - Weather: Rain → locations become "wet and muddy"

4. **Schedule-based**:
   - Monday-Friday: Office "busy"
   - Saturday: Office "closed"
   - Sunday: Church "service in progress"

#### 4.3 Dynamic Descriptions

Description changes based on state:
```
The Brass Monkey Tavern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current State: Crowded (Evening, 18 present)

The tavern is packed to the rafters with dockworkers
fresh off their shifts. Cigarette smoke hangs thick
in the air. The barman struggles to keep up with orders.
Somewhere in the back, a bawdy song erupts.

[This location's atmosphere changes based on time and occupancy]
```

vs. same location, different state:

```
The Brass Monkey Tavern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current State: Empty (Morning, 2 present)

The tavern is quiet, save for the barman wiping down
tables. Morning light streams through grimy windows.
The floor still sticky from last night's revelry.
A lone patron nurses a hair-of-the-dog pint in the corner.

[This location's atmosphere changes based on time and occupancy]
```

#### 4.4 Spawn System

Auto-spawn objects/NPCs based on state:

**Tavern "Crowded" state**:
- Spawn 5-10 background NPC (crowd filler)
- Spawn drunk NPC (interaction target)
- Generate ambient chat messages

**Market "Morning" state**:
- Spawn vendor NPCs
- Generate shop inventory items
- Ambient: "Fresh fish! Get your fresh fish!"

#### 4.5 Weather System

Global weather affects all outdoor locations:
- **Clear**: Normal
- **Foggy**: Descriptions add fog, visibility reduced
- **Rainy**: Descriptions add rain, characters get "wet" status
- **Snowy**: Victorian London snow (rare but impactful)

#### 4.6 Lighting & Ambiance

**Lighting changes**:
- Auto-adjust based on time of day
- Gaslight flickers in evening
- Darkness = need lantern/torch (inventory item)

**Ambient sounds** (if supported):
- Tavern: Chatter, music, glass clinks
- Street: Horse hooves, vendors shouting
- Docks: Seagulls, water lapping, ships creaking

### Configuration

```
Dynamic Environment Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

States (3):
┌────────────────────────────────────┐
│ State: "Empty"                     │
│ Trigger: 0-5 present OR time 6-12  │
│ Description: [Custom text...]       │
│ Image: [Upload]                    │
│ NPCs: None                         │
│ [Edit] [Delete]                    │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ State: "Busy"                      │
│ Trigger: 6-15 present OR time 18-24│
│ Description: [Custom text...]       │
│ Image: [Upload]                    │
│ NPCs: Spawn 3 "patron"             │
│ [Edit] [Delete]                    │
└────────────────────────────────────┘

[+ Add New State]

Weather Integration: [●] Enabled
Time-based transitions: [●] Enabled
Population triggers: [●] Enabled
```

### Use Cases
1. **Immersion**: Living, breathing world
2. **Realism**: Tavern isn't same at 10am vs 10pm
3. **Atmosphere**: Fog rolls in = eerie Victorian mood
4. **Gameplay**: Crowded tavern = easier to hide, sneak
5. **Events**: Global events affect all locations

### Technical Implementation
- **State machine**: Location has current state, transitions
- **Cron jobs**: Check time-based triggers every 15 min
- **WebSocket**: Broadcast state change to all in location
- **Cache**: Pre-render state descriptions
- **Fallback**: Default state if no rules match

### Price Justification
- **Development**: ~20-25 ore (complex state logic)
- **Value**: Transforms static world to dynamic
- **Unique**: No VTT has this level of environmental dynamism

---

## 5. Location Economy (€59)

### Descrizione
Business simulation completo per location - revenue passivo, costi operativi, upgrade, reputazione.

### Problema che Risolve
- Location ownership = no gameplay after purchase
- No economic simulation depth
- No incentive to maintain/improve location
- No competition between businesses

### Features

#### 5.1 Business Dashboard
```
Business: "The Brass Monkey Tavern"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Financial Summary (This Month):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Revenue:        £450
Operating Costs: £200
Net Profit:      £250

Revenue Breakdown:
• Ale sales:     £280 (62%)
• Food:          £120 (27%)
• Lodging:       £50  (11%)

Operating Costs:
• Staff wages:   £100
• Supplies:      £60
• Maintenance:   £20
• Taxes:         £20

Performance:
• Avg customers/day: 15
• Reputation: ⭐⭐⭐⭐☆ (4.2/5)
• Customer satisfaction: 82%

[View Details] [Manage Staff] [Upgrades]
```

#### 5.2 Revenue Generation

**Automatic revenue** based on:
- **Traffic**: # players visit daily
- **Customer satisfaction**: Rating affects spending
- **Pricing**: Owner sets prices (balance profit vs satisfaction)
- **Location type**: Tavern revenue differs from shop
- **Zone**: Mayfair clients spend more than Whitechapel

**Revenue formula**:
```
Daily Revenue =
  (Base Traffic × Zone Multiplier × Reputation Bonus)
  × Average Spending
  × Random Variance (0.8-1.2)
```

#### 5.3 Operating Costs

**Recurring costs** (daily/weekly/monthly):
- **Staff wages**: Depends on # employees
- **Supplies**: Inventory restocking (food, ale, goods)
- **Maintenance**: Building upkeep
- **Taxes**: Victorian business taxes
- **Utilities**: Gas, coal, water

**Can't pay**: Business temporarily closes, reputation drops

#### 5.4 Staff Management

```
Staff Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Staff (3/5):
┌────────────────────────────────────┐
│ 👨 Barman Tom                      │
│ Role: Bartender                    │
│ Wage: £2/day                       │
│ Efficiency: ⭐⭐⭐⭐⭐ (Excellent)      │
│ Happiness: 85%                     │
│ [Fire] [Raise Wage]                │
└────────────────────────────────────┘

Available Positions:
• Cook (£1.5/day) - Increases food sales 20%
• Server (£1/day) - Increases customer satisfaction
• Security (£3/day) - Reduces trouble, attracts upper class

[Hire Staff]
```

**Staff effects**:
- Better staff = higher satisfaction = more revenue
- Unhappy staff = quit or sabotage (random events)
- Can hire player characters (creates jobs RP)

#### 5.5 Upgrades & Improvements

```
Upgrades: "The Brass Monkey Tavern"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Available Upgrades:
┌────────────────────────────────────┐
│ 🍺 Premium Ale Selection           │
│ Cost: £100                         │
│ Effect: +15% revenue, +10% reputation │
│ [Purchase]                         │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 🎹 Piano Entertainment             │
│ Cost: £200                         │
│ Effect: +20% customers, +5% satisfaction │
│ [Purchase]                         │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 🛏️ Add Lodging Rooms (3)          │
│ Cost: £300                         │
│ Effect: New revenue stream £50/month │
│ [Purchase]                         │
└────────────────────────────────────┘

Current Upgrades (2):
• Gas lighting (purchased Dec 1)
• Quality furniture (purchased Nov 15)
```

#### 5.6 Reputation System

**Reputation score** (0-100):
- Affects customer traffic
- Unlock access to better suppliers
- Upper class won't visit low reputation venues

**Reputation factors**:
- Customer satisfaction (biggest factor)
- Reviews (players can review)
- Incidents (fights, theft lower reputation)
- Cleanliness/maintenance
- Staff quality

**Reputation tiers**:
- **1-20**: Dive (only desperate/criminals)
- **21-40**: Shabby (lower class)
- **41-60**: Decent (working/middle class)
- **61-80**: Respectable (middle/upper class)
- **81-100**: Prestigious (upper/nobility)

#### 5.7 Random Events

To add spice and risk:

**Positive events**:
- "Famous patron visits!" +20 reputation temporary
- "Excellent review in Times!" +15% traffic for week
- "Lucky week" +30% revenue

**Negative events**:
- "Bar fight breaks out!" -10 reputation
- "Supplier shortage" +50% supply costs this week
- "Inspection failed" £50 fine + -5 reputation
- "Staff steals from till" -£30

**Frequency**: 1-2 events per month (configurable)

#### 5.8 Competition

Track competing businesses in same zone:

```
Market Analysis: Taverns in Whitechapel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your Tavern: The Brass Monkey
• Rank: #2 of 7
• Market share: 18%
• Reputation: ⭐⭐⭐⭐☆

Top Competitors:
1. The Ten Bells (⭐⭐⭐⭐⭐) - 24% share
2. The Brass Monkey (You) - 18% share
3. The Blind Beggar (⭐⭐⭐☆☆) - 15% share

[View Competitor Details]
```

**Market effects**:
- Many competitors = lower traffic per business
- Price wars (if you underprice → others may too)
- Steal customers with better reputation

#### 5.9 Analytics & Reports

```
Business Analytics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Revenue Trend (6 months):
[Graph: showing growth from £200 to £450/month]

Customer Demographics:
• Lower class: 60%
• Working class: 30%
• Middle class: 10%

Peak Hours:
• 18:00-20:00 (35% of traffic)
• 20:00-22:00 (40% of traffic)

Best Performers:
• Ale sales consistently strong
• Food sales improved after hiring cook
• Lodging underutilized (3/10 rooms)

[Export Report]
```

### Configuration

```typescript
interface EconomyConfig {
  enabled: boolean;
  businessType: 'tavern' | 'shop' | 'lodging' | 'service' | 'custom';

  revenue: {
    baseTrafficPerDay: number;
    averageSpending: number;
    revenueStreams: { name: string, percentage: number }[];
  };

  costs: {
    staffWages: number;
    supplies: number;
    maintenance: number;
    taxes: number;
  };

  settings: {
    allowUpgrades: boolean;
    randomEventsEnabled: boolean;
    competitionTracking: boolean;
  };
}
```

### Use Cases
1. **Business tycoon RP**: Build empire of taverns/shops
2. **Economic gameplay**: Passive income but requires management
3. **Competition**: Compete with other players businesses
4. **Jobs**: Hire player characters (create employment RP)
5. **Risk/reward**: Investment for long-term profit

### Technical Implementation
- **Simulation engine**: Daily cron calculates revenue/costs
- **Transaction log**: All financial activity logged
- **Balance checks**: Can't spend more than you have
- **Admin controls**: Can adjust formula variables
- **Export**: Financial reports exportable

### Price Justification
- **Development**: ~30-40 ore (complex simulation)
- **Value**: Complete business game within RPG
- **Unique**: No VTT has business simulation this deep
- **Replayability**: Endless optimization gameplay

---

## 6. Multi-Room System (€29)

### Descrizione
Location "container" con stanze multiple navigabili - mansion, ospedale, dungeon con mappa.

### Problema che Risolve
- Large buildings = single room = unrealistic
- No spatial sense (dove sono?)
- No room-specific events
- Party splits can't be in "different rooms"

### Features

#### 6.1 Room Hierarchy
```
Location: "Baskerville Mansion"
├── Entrance Hall
│   ├── Grand Staircase
│   └── Coat Room
├── Ground Floor
│   ├── Drawing Room
│   ├── Library
│   ├── Dining Room
│   └── Kitchen
├── First Floor
│   ├── Master Bedroom
│   ├── Guest Room 1
│   ├── Guest Room 2
│   └── Study
└── Cellar
    ├── Wine Cellar
    └── Secret Room
```

#### 6.2 Room Navigation

```
You are in: Library (Ground Floor)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A vast library with floor-to-ceiling mahogany
shelves. The smell of old leather and paper.
A fireplace crackles in the corner.

Present (2): Sherlock Holmes, John Watson

Exits:
• [North] Drawing Room
• [South] Dining Room
• [East] Entrance Hall

[Move to...] [Search Room] [Room Actions]
```

#### 6.3 Chat Options

**Per-room chat** (default):
- Chat is per-room
- Only people in same room see messages
- Good for party splits

**Unified chat**:
- All rooms share chat
- Better for small groups
- Can toggle per location

#### 6.4 Room Properties

Each room can have:
- **Custom description**
- **Custom image**
- **Access restrictions** (locked door, need key)
- **Lighting** (dark room needs lantern)
- **Hazards** (trap, poison gas)
- **NPCs** specific to room
- **Items** findable in room

#### 6.5 Visual Map

```
Baskerville Mansion - First Floor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────┬─────────┬─────────┐
│ Master  │  Guest  │  Guest  │
│ Bedroom │  Room 1 │  Room 2 │
│    🚪   │    🚪   │    🚪   │
└────┬────┴────┬────┴────┬────┘
     │         │         │
     └─────────┴─────────┘
           Hall
           🚶 You are here
```

Interactive: Click room to move

#### 6.6 Room Events

Trigger events on room entry:
- **Trap**: "You step on loose floorboard! Roll DEX"
- **Discovery**: "You notice a hidden compartment"
- **NPC spawn**: "A ghost appears!"
- **State change**: "The fire goes out suddenly"

#### 6.7 Search System

```
Search: Library
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Roll: Spot Hidden (45%)
Result: Success!

You find:
• Hidden journal behind bookshelf
• Loose floorboard (hiding place)
• Old letter tucked in book

[Take Item] [Examine] [Leave]
```

Each room can have hidden items/clues.

### Configuration

```typescript
interface Room {
  id: string;
  name: string;
  description: string;
  floor: number;
  connections: { direction: string, targetRoomId: string }[];

  properties: {
    locked: boolean;
    keyRequired?: string;
    lighting: 'dark' | 'dim' | 'bright';
    hazards?: Hazard[];
    hiddenItems?: Item[];
  };

  presentCharacters: string[]; // IDs
}
```

### Use Cases
1. **Mystery investigation**: Search mansion room by room
2. **Dungeon crawl**: Navigate dangerous corridors
3. **Heist**: Split party across building
4. **Realism**: Large buildings feel large
5. **Exploration**: Hidden rooms to discover

### Technical Implementation
- **Graph structure**: Rooms are nodes, connections are edges
- **Pathfinding**: Calculate route between rooms (for NPCs)
- **WebSocket**: Real-time updates when players move
- **Mini-map**: SVG/Canvas rendering of layout

### Price Justification
- **Development**: ~15-20 ore
- **Value**: Transforms single-room to complex space
- **Gameplay**: Exploration, investigation depth

---

## 7. Custom Scripting (€99)

### Descrizione
JavaScript/TypeScript sandboxed per logiche location totalmente custom. Per power users.

### Problema che Risolve
- Add-ons don't cover every use case
- Master wants custom mechanics
- Complex triggers not possible with UI
- Integration con API esterne

### Features

#### 7.1 Scripting Environment

**Sandboxed JavaScript**:
- Node.js VM
- Limited API access (no file system, no network by default)
- Timeout after 5 seconds
- Memory limit

**Available APIs**:
```typescript
// Location script context
interface ScriptContext {
  // Data access
  location: Location;
  characters: Character[];
  items: Item[];

  // Actions
  sendMessage(content: string, target?: 'all' | characterId): void;
  spawnNPC(npcData: NPCData): void;
  giveItem(characterId: string, item: Item): void;
  changeState(newState: string): void;

  // Checks
  rollSkill(characterId: string, skill: string): RollResult;
  hasItem(characterId: string, itemId: string): boolean;

  // Utilities
  random(min: number, max: number): number;
  setTimeout(callback: Function, ms: number): void;

  // External (if enabled)
  fetch(url: string, options?: FetchOptions): Promise<Response>;
  db: DatabaseAccess; // Query other collections
}
```

#### 7.2 Event Hooks

Scripts can hook into events:

```javascript
// onEnter - When character enters location
function onEnter(character, context) {
  // Check if character has "cursed" status
  if (character.hasStatus('cursed')) {
    context.sendMessage(
      `As ${character.name} enters, the candles flicker ominously.`,
      'all'
    );

    // Roll SAN check
    const sanRoll = context.rollSkill(character.id, 'sanity');
    if (sanRoll.failed) {
      context.sendMessage(
        `${character.name} feels a chill down their spine. (-1 SAN)`,
        character.id
      );
      character.sanity -= 1;
    }
  }
}

// onAction - When character performs action
function onAction(character, action, context) {
  // Custom action: "ring bell"
  if (action.type === 'custom' && action.name === 'ring bell') {
    context.sendMessage('CLANG! The bell echoes through the mansion.', 'all');

    // Spawn butler NPC
    context.setTimeout(() => {
      context.spawnNPC({
        name: 'Butler',
        description: 'An elderly butler appears silently',
        behavior: 'helpful'
      });
      context.sendMessage('"You rang, sir?" the butler inquires.', 'all');
    }, 3000);
  }
}

// onTimeChange - Hourly trigger
function onTimeChange(hour, context) {
  if (hour === 0) { // Midnight
    context.changeState('haunted');
    context.sendMessage(
      'As the clock strikes midnight, shadows seem to move on their own...',
      'all'
    );
  }
}

// onSearch - When character searches room
function onSearch(character, context) {
  const spotRoll = context.rollSkill(character.id, 'spot-hidden');

  if (spotRoll.success && spotRoll.value <= 20) { // Critical success
    context.sendMessage(
      `${character.name} discovers a hidden passage behind the bookshelf!`,
      'all'
    );
    context.location.revealRoom('secret-passage');
  }
}
```

#### 7.3 Script Editor

```
Script Editor: "The Haunted Mansion"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Active Scripts (3):
┌────────────────────────────────────┐
│ onEnter.js                         │
│ Lines: 23 | Last edited: 2h ago    │
│ [Edit] [Test] [Disable] [Delete]  │
└────────────────────────────────────┘

[+ New Script]

Script Template Library:
• Puzzle: Combination lock
• Puzzle: Riddle door
• Trap: Pressure plate
• Event: Timed ghost appearance
• Integration: Weather API
```

#### 7.4 Testing & Debugging

```
Script Test Console
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test onEnter.js
Character: Sherlock Holmes
Trigger: enters location

[Run Test]

Console Output:
> Script started
> Character has 'cursed' status: false
> Sending message to all: "Welcome to the mansion"
> Script completed in 12ms

Errors: None
Warnings: None

[Save & Deploy]
```

#### 7.5 External Integrations (Advanced)

With explicit enable:
```javascript
// Fetch weather API
async function onTimeChange(hour, context) {
  if (hour === 6) { // Morning update
    const weather = await context.fetch(
      'https://api.weather.com/victorian-london'
    );
    const data = await weather.json();

    context.location.weather = data.condition;
    context.sendMessage(
      `The morning brings ${data.description}`,
      'all'
    );
  }
}
```

Requires:
- Whitelist specific URLs
- Rate limiting
- Owner assumes API costs

#### 7.6 Script Marketplace (Future)

Master creates script → can share/sell:
```
Script Marketplace
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Popular Scripts:
┌────────────────────────────────────┐
│ ⭐⭐⭐⭐⭐ Seance Table (52 ratings)  │
│ by MasterNarrator                  │
│ Complete seance mechanic with...  │
│ Price: Free                        │
│ [Preview] [Install]                │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ ⭐⭐⭐⭐☆ Alchemy Laboratory (31)    │
│ by DrMoriarty                      │
│ Crafting system for potions...    │
│ Price: €2.99                       │
│ [Preview] [Purchase]               │
└────────────────────────────────────┘
```

Revenue share: 70% creator, 30% platform

### Configuration

```
Custom Scripting Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security:
☑ Sandbox mode (recommended)
☐ Allow fetch() API
☐ Allow database queries

Limits:
• Max execution time: [5000]ms
• Max memory: [10]MB
• Max scripts per location: [10]

Whitelist URLs (if fetch enabled):
• api.weather.com
• [Add URL]

[Save Settings]
```

### Use Cases
1. **Unique mechanics**: Impossible with standard UI
2. **Puzzles**: Complex logic for puzzle rooms
3. **Events**: Scripted story sequences
4. **Integrations**: Connect to external services
5. **Game modes**: Custom game rules per location

### Technical Implementation
- **VM2** or similar: Sandboxed JS execution
- **Syntax highlighting**: Monaco editor (VS Code engine)
- **Version control**: Script history with rollback
- **Testing**: Dry-run environment before deploy
- **Monitoring**: Log execution times, errors

### Price Justification
- **Development**: ~40-50 ore (complex, security-critical)
- **Risk**: Sandbox must be bulletproof
- **Value**: Unlimited customization
- **Target**: Power users only (5-10% of customers)

---

## Bundle Offers

### Landlord Bundle (€99 instead of €126)
**Save €27 (21%)**

Includes:
- Housing System Advanced (€49)
- Key & Access System (€29)
- Smart Permissions (€19)
- Multi-Room System (€29)

**Perfect for**: Victorian landlords, property managers

---

### Business Owner Bundle (€129 instead of €167)
**Save €38 (23%)**

Includes:
- Location Economy (€59)
- Housing System (€49)
- Dynamic Environments (€39)
- Smart Permissions (€19)

**Perfect for**: Tavern/shop owners, entrepreneurs

---

### Master's Complete Pack (€199 instead of €323)
**Save €124 (38%)**

Includes ALL add-ons:
- Housing System (€49)
- Key & Access (€29)
- Smart Permissions (€19)
- Dynamic Environments (€39)
- Location Economy (€59)
- Multi-Room System (€29)
- Custom Scripting (€99)

**Perfect for**: Serious GMs, large campaigns

---

## Purchase & Licensing

### One-Time Purchase
- Buy once, use forever
- No expiration
- Works on current tier

### License Key System
- Purchase generates license key
- Key stored in account
- Works even if downgrade tier
- Transferable to self-hosted (same key)

### Refund Policy
- 14 days money-back
- No questions asked
- Disable feature after refund

### Upgrades
- Bundle discount applies even if already own some add-ons
- Example: Own Housing (€49) → Landlord Bundle costs only €50 (not €99)

---

## Implementation Priority

**Phase 1** (Launch):
1. Housing System - Most requested
2. Key & Access - Unique, high value

**Phase 2** (3 months post-launch):
3. Smart Permissions - Requested by club owners
4. Multi-Room - Foundation for dungeons

**Phase 3** (6 months):
5. Dynamic Environments - Polish, immersion
6. Location Economy - Complex but high value

**Phase 4** (12 months):
7. Custom Scripting - For power users, requires stable platform

---

## Success Metrics

**Target adoption** (Year 1):
- 30% of STARTER customers buy 1+ add-on
- 60% of PRO customers buy 1+ add-on
- 80% of ENTERPRISE customers buy bundle

**Revenue target**:
- €2,000 add-ons revenue in Year 1
- €5,000 add-ons revenue in Year 2
- €10,000+ add-ons revenue in Year 3

**Most popular** (predicted):
1. Housing System (60% purchase rate)
2. Key & Access (40%)
3. Landlord Bundle (25%)
4. Location Economy (20%)
5. Others (10-15% each)
