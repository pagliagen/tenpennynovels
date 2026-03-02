# Location Features - Private Locations System

## Filosofia

**Location private illimitate per tutti** - Il costo per noi è praticamente zero (solo record nel database). Le **features avanzate** delle location sono il vero valore e vengono vendute come add-ons.

---

## Base Features (Incluse in Tutti i Tier)

### ✅ Location Private - Illimitate

**Cosa puoi fare**:
- Creare infinite location private
- Customizzare nome, descrizione, immagine
- Impostare visibilità (privata/pubblica)
- Invitare giocatori manualmente (whitelist)

**Access Control Base**:
- **Whitelist manuale**: Owner aggiunge giocatori uno per uno
- **Ownership**: Un personaggio è proprietario
- **Purchase**: Acquisto una tantum dal personaggio (€ in-game)
- **No rental system**: Solo acquisto (affitto è add-on)

**Customizzazione**:
- Nome location
- Descrizione testuale
- Immagine (upload max 5MB)
- Tags/categoria
- Zona geografica (Whitechapel, Mayfair, etc.)

**Costo per noi**: ~€0 (solo record MongoDB)

---

## Location Lifecycle

### 1. Creazione

**Chi può creare**:
- ✅ Tutti i giocatori (no limits)
- ✅ Admin/Master sempre

**Process**:
```
1. Player apre "Create Location"
2. Compila form:
   - Nome (es: "La Mia Taverna")
   - Descrizione
   - Tipo (casa, negozio, club, etc.)
   - Zona di Londra
   - Prezzo acquisto (in-game currency)
3. Upload immagine (opzionale)
4. Salva → Location creata (draft)
```

**Stati location**:
- `draft`: Appena creata, solo owner vede
- `active`: Attiva, invitati possono accedere
- `archived`: Disattivata temporaneamente

### 2. Ownership & Purchase

**Acquisto Base** (incluso):
- Personaggio spende soldi in-game
- Diventa owner
- Pagamento una tantum (no recurring)
- Proprietà permanente (fino a vendita)

**No Rental** (è add-on):
- Nel base tier: Solo acquisto
- Affitto mensile = add-on "Housing System"

### 3. Access Management (Base)

**Whitelist Manuale**:
```
Owner → Settings → Invite Players
└── Aggiunge username/character
    └── Player riceve notifica
        └── Può entrare nella location
```

**Permessi base**:
- `owner`: Può tutto (invite, kick, edit, delete)
- `guest`: Può solo entrare e chattare

**No Advanced Permissions** (è add-on):
- Ruoli complessi = add-on "Smart Permissions"
- Chiavi fisiche = add-on "Key & Access"

### 4. Location Discovery

**Per Location Private**:
- ❌ Non appaiono in lista pubblica
- ❌ Non ricercabili
- ✅ Solo invitati le vedono

**Per Location Pubbliche**:
- ✅ Appaiono in directory
- ✅ Ricercabili
- ✅ Tutti possono entrare

### 5. Deletion & Transfer

**Cancellazione**:
- Owner può cancellare location
- Warning: "Questa azione è permanente"
- Dati archiviati 30 giorni (recovery possibile)

**Transfer Ownership**:
- Owner può trasferire a altro giocatore
- Richiede accettazione destinatario
- Transfer = transazione in-game (vendita)

---

## Location Types (Base)

**Predefiniti**:
1. **Residence** - Casa, appartamento, mansion
2. **Business** - Negozio, taverna, laboratorio
3. **Club** - Club esclusivo, società segreta
4. **Warehouse** - Magazzino, deposito
5. **Office** - Ufficio, studio professionale
6. **Other** - Custom type

**Proprietà base**:
- Ogni type ha description template
- Suggerimenti per pricing in-game
- Icon/emoji associato

---

## Location Zones (Victorian London)

**Zone disponibili** (geografiche):
1. **Whitechapel** - East End, povero, pericoloso
2. **Mayfair** - West End, ricco, aristocratico
3. **Soho** - Bohemien, artistico, internazionale
4. **Westminster** - Politico, governativo
5. **Docklands** - Porto, commercio, criminalità
6. **Camden** - Working class, operaio
7. **Other** - Altre zone

**Influenza zone su location**:
- **Prezzo base** suggerito (Mayfair > Whitechapel)
- **Social class** dei frequentatori
- **Flavor text** automatico nelle descrizioni

---

## Location Data Structure (Technical)

```typescript
interface Location {
  _id: ObjectId;
  name: string;
  description: string;
  type: LocationType;
  zone: LondonZone;

  // Ownership
  ownerId: ObjectId; // Character ID
  ownerName: string;
  purchasePrice: number; // in-game currency
  purchaseDate: Date;

  // Access
  isPublic: boolean;
  whitelist: ObjectId[]; // Character IDs invited

  // Customization
  imageUrl?: string;
  customFields?: Record<string, any>;

  // State
  status: 'draft' | 'active' | 'archived';

  // Add-on Features (disabled by default)
  features: {
    rental?: RentalConfig; // Housing System add-on
    keyAccess?: KeyConfig; // Key & Access add-on
    smartPermissions?: PermissionConfig; // Smart Permissions add-on
    economy?: EconomyConfig; // Location Economy add-on
    multiRoom?: RoomConfig[]; // Multi-Room add-on
    dynamicState?: StateConfig; // Dynamic Environments add-on
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

---

## UI/UX Base Features

### Location List (Player View)

```
My Locations
┌─────────────────────────────────────┐
│ 🏠 My Victorian Home                │
│ Whitechapel • Residence • Private   │
│ 3 guests invited                    │
│ [Enter] [Manage] [Edit]             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🍺 The Rusty Anchor Tavern          │
│ Docklands • Business • Private      │
│ 12 guests invited                   │
│ [Enter] [Manage] [Edit]             │
│ 💎 Add-on: Housing System Active    │
└─────────────────────────────────────┘

[+ Create New Location]
```

### Location Management Screen

```
Manage Location: "My Victorian Home"
────────────────────────────────────────

Settings:
• Name: [My Victorian Home]
• Description: [A cozy home in the East End...]
• Type: Residence
• Zone: Whitechapel
• Visibility: [○] Public [●] Private

Access Control:
┌─────────────────────────────────────┐
│ Invited Guests (3)                  │
│ • John Watson [Remove]              │
│ • Mary Shelley [Remove]             │
│ • Arthur Doyle [Remove]             │
│                                     │
│ [+ Invite Player]                   │
└─────────────────────────────────────┘

Ownership:
• Purchased: Dec 15, 1895
• Price paid: £500
• [Transfer Ownership...]

Danger Zone:
• [Archive Location]
• [Delete Location] (permanent)
```

### Location Entry (Player View)

```
🏠 My Victorian Home
Whitechapal • Private Residence

[Description]
A modest two-story home in the heart of Whitechapel.
The flickering gaslight casts shadows on worn furniture.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Chat (3 present)
• John Watson
• Mary Shelley
• You (Sherlock Holmes)

[Your message here...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Present Characters:
┌────────────────────────────────────┐
│ 🎩 John Watson                     │
│ Doctor • Loyal companion           │
└────────────────────────────────────┘
```

---

## Location Add-ons Overview

Le features avanzate sono add-ons separati. Vedi `04-addons-catalog.md` per dettagli completi.

**Quick Reference**:

| Add-on | Prezzo | Cosa abilita |
|--------|--------|--------------|
| Housing System | €49 | Affitti, contratti, auto-collect |
| Key & Access | €29 | Chiavi fisiche, lockpicking, log |
| Smart Permissions | €19 | Accesso per occupazione/classe |
| Dynamic Environments | €39 | Stati location, spawn automatico |
| Location Economy | €59 | Business simulation |
| Multi-Room System | €29 | Location con stanze multiple |
| Custom Scripting | €99 | JavaScript custom logic |

---

## Migration Path (Self-Hosted → Hosted)

**Se cliente fa self-host poi migra a hosted**:

1. **Export location data** (JSON)
2. **Import in hosted** (con tool automatico)
3. **Add-ons** funzionano se acquistati (feature flags)
4. **Ownership** preserved
5. **Access lists** migrated

**Reverse** (Hosted → Self-Host):
- Esporta tutto
- Importa in self-hosted instance
- Add-ons acquistati = license key (inserisci in .env)

---

## Admin Tools (Base)

**Admin può sempre**:
- Vedere tutte le location (anche private)
- Entrare in qualsiasi location
- Modificare owner
- Archiviare/eliminare location
- Vedere analytics (# location per tipo, zona, etc.)

**Admin Dashboard**:
```
Location Management
━━━━━━━━━━━━━━━━━━━━

Statistics:
• Total locations: 247
• Public: 89
• Private: 158
• By zone: Whitechapel (45), Mayfair (23)...

Recent Activity:
• "The Brass Monkey" created by John W.
• "221B Baker St" edited by Sherlock H.

[View All] [Export Data]
```

---

## Technical Implementation Notes

### Database Indexes

```javascript
// Essential indexes for performance
db.locations.createIndex({ ownerId: 1 });
db.locations.createIndex({ zone: 1, type: 1 });
db.locations.createIndex({ isPublic: 1 });
db.locations.createIndex({ 'whitelist': 1 }); // For fast access checks
```

### Access Control Middleware

```typescript
// Check if character can access location
async function canAccessLocation(
  characterId: string,
  locationId: string
): Promise<boolean> {
  const location = await Location.findById(locationId);

  // Public location = anyone can enter
  if (location.isPublic) return true;

  // Owner always has access
  if (location.ownerId.equals(characterId)) return true;

  // Check whitelist
  if (location.whitelist.includes(characterId)) return true;

  // Check add-on features (if enabled)
  if (location.features.keyAccess) {
    // Check if character has key item
    return await hasKeyItem(characterId, locationId);
  }

  if (location.features.smartPermissions) {
    // Check occupation/class based access
    return await checkSmartPermissions(characterId, location);
  }

  return false;
}
```

### Feature Flags

```typescript
// Check if add-on is enabled for this server
function hasAddon(serverId: string, addonName: string): boolean {
  const server = Server.findById(serverId);
  return server.addons.includes(addonName);
}

// UI conditional rendering
{hasAddon(serverId, 'housing-system') && (
  <RentalSettings location={location} />
)}
```

---

## Limits & Quotas (Technical Enforcement)

### Per-Server Quotas

**No limits on**:
- Number of locations
- Number of invites per location
- Number of edits

**Soft limits** (monitoring only):
- Warning if single user creates >50 locations
- Alert admin if suspicious activity (mass creation)

**Hard limits**:
- Image uploads: Max 5MB per image
- Total images storage: Counted toward tier storage limit
- Description length: Max 5000 characters

---

## Future Enhancements (Roadmap)

**Potential base features** (no add-on):
1. **Location templates**: Pre-made location types (tavern template, club template)
2. **Location sharing**: Export/import location configs
3. **Location reviews**: Players rate/review locations
4. **Location events**: Schedule events at location
5. **Location marketplace**: Trade/sell location designs

**To be decided**: Add-on o base feature?

---

## Monetization Strategy

### Why Give Location Creation for Free?

1. **Low cost**: Record in DB is pennies
2. **Engagement**: More locations = more time in-game
3. **Upsell opportunity**: Create location → "Want rental? Upgrade!"
4. **Competitive advantage**: Competitors limit locations = bad UX
5. **Viral**: Players create cool locations → share → attract others

### How We Make Money

1. **Add-ons**: Features avanzate (rental, keys, economy) = paid
2. **Bot AI** (PRO+): NPC in location = killer feature
3. **Hosting**: Gestione server = convenience premium
4. **Storage**: Immagini custom = counted in tier storage
5. **Tier limits**: Concurrent users (non locations)

**Expected conversion**:
- 30% STARTER buy at least 1 location add-on
- 60% PRO buy location add-ons
- 80% ENTERPRISE have multiple location add-ons

---

## Conclusion

**Location private illimitate** = feature base perfetta perché:
- ✅ Costa zero per noi
- ✅ Valore percepito alto per cliente
- ✅ Engagement driver
- ✅ Upsell launchpad per add-ons
- ✅ Competitive differentiator

Il vero valore sono le **logiche complesse** (affitti, chiavi, economia) vendute come add-ons one-time.
