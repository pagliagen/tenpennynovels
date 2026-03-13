# Tiro Contrapposto — Specifica Tecnica

> Riferimento funzionale: [Scontri sociali.md](./Scontri%20sociali.md)

---

## 1. Livelli di successo

Il sistema di risoluzione si basa su un tiro d100 confrontato con il valore della skill:

| Codice (DB) | Label (UI)  | Condizione       |
| ----------- | ----------- | ---------------- |
| `fumble`    | Maldestro   | d100 = 100       |
| `failure`   | Fallimento  | d100 > skill     |
| `normal`    | Normale     | d100 ≤ skill     |
| `hard`      | Superiore   | d100 ≤ skill / 2 |
| `extreme`   | Estremo     | d100 ≤ skill / 5 |
| `critical`  | Critico     | d100 = 1         |

Gerarchia: **critical > extreme > hard > normal > failure > fumble**

> **Convenzione:** nel codice e nei modelli a DB si usano sempre i codici inglesi. Le label italiane sono usate esclusivamente nell'output a video.
>
> **Fumble:** ai fini del codice è solo un livello numerico (peggio di `failure`) usato nel confronto dei gradi di successo. Eventuali effetti collaterali (caduta arma, colpo a vuoto, ecc.) sono gestiti narrativamente dal master, non dal sistema.

---

## 2. Configurazione a DB

Gli scontri (sociali e non) devono essere configurabili tramite una tabella a DB. Per ogni skill attiva vanno memorizzate almeno:

- **Nome della skill attiva** (es. Raggirare, Arma da Fuoco, Intimidire)
- **Skill contrapposte** (una o più, es. Raggirare → [Empatia], Arma da Fuoco → [Parata, Schivata])
- **Tipo di tiro**: palese o nascosto
- **Richiede messaggio aggiuntivo**: sì/no (es. Raggirare richiede il testo della bugia)
- **Modificatori / regole speciali** (opzionale): array di regole configurabili con label e condizione. Esempio:

```json
{
  "modifiers": [
    {
      "label": "Tiro Rapido",
      "description": "Sparo nello stesso turno dell'estrazione, senza mirare",
      "minSuccessLevel": "hard"
    }
  ]
}
```

> Quando un modificatore è attivo, il BE valuta il tiro secondo la condizione indicata (es. per "Tiro Rapido", un successo `normal` viene trattato come `failure` — serve almeno `hard`).

---

## 3. Flusso base — Skill contrapposta univoca

Quando la skill attiva ha **una sola** skill contrapposta (es. Intimidire → Autocontrollo):

1. X seleziona la skill e il bersaglio Y.
2. L'azione viene inviata al backend.
3. Il backend tira d100 per X (skill attiva) e d100 per Y (skill contrapposta).
4. Confronta i livelli di successo.
5. Invia il risultato in chat (visibile a tutti o solo ai coinvolti, a seconda del tipo di tiro).

**Messaggio di risultato (tiro palese):**
> "{X} ha effettuato una prova di {nomeSkill} contro {Y}. Risultato: {esito}"

---

## 4. Flusso — Skill contrapposte multiple

Quando la skill attiva ha **più di una** skill contrapposta (es. Arma da Fuoco → [Parata, Schivata]):

1. X seleziona la skill e il bersaglio Y.
2. L'azione viene inviata al backend.
3. Il backend invia un **messaggio temporaneo in chat** (`actionType: "confrontation_reaction_request"`), visibile **esclusivamente a X e Y**.
4. Il messaggio chiede a Y di scegliere con quale skill difendersi (es. "Parata" o "Schivata").
5. Una volta che Y ha scelto, il backend procede con il flusso base (punto 3 della sezione precedente).

---

## 5. Caso speciale — Raggirare (tiro nascosto)

Raggirare è un tiro in **due fasi**: un tiro preliminare di X, seguito da un eventuale tiro contrapposto di Y.

### Fase 1: il tiro di Raggirare

1. X apre il popup del tiro contrapposto e seleziona **Raggirare**.
2. Il popup mostra un secondo step con un campo per il **testo della bugia** (es. "Veramente sto vestito fa schifo, ma dove l'ha comprato?").
3. X invia. Il tiro viene spedito **separatamente dall'azione di chat** (l'azione "Lo sai che sei proprio bella vestita così?" va in chat come messaggio normale).
4. Il backend tira d100 per X contro la skill Raggirare.

**Se X fallisce (o fumble)** → la bugia è scoperta. Y riceve una notifica (visibile solo a lui):
> "{X} sta evidentemente cercando di nasconderti qualcosa quando dice: '{testo della bugia}'"

**Se X riesce** → si passa alla Fase 2.

### Fase 2: il tiro contrapposto (Empatia di Y)

5. Il backend tira d100 per Y contro la skill Empatia.
6. Si confrontano i livelli di successo di X e Y.

### Tabella esiti

| Confronto Y vs X                        | Notifica a X                          | Notifica a Y                                                                    |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| Y pareggia o fa peggio di X             | "Hai effettuato un tiro di Raggirare" | Nessuna                                                                         |
| Y supera X di **1 livello di successo** | "Hai effettuato un tiro di Raggirare" | "Ti rendi conto che {X} ti sta nascondendo qualcosa."                           |
| Y supera X di **2+ livelli di successo** | "Hai effettuato un tiro di Raggirare" | "{X} sta evidentemente cercando di nasconderti qualcosa quando dice: '{testo}'" |

> **Nota:** X non viene mai informato dell'esito specifico, vede solo la conferma del tiro.

---

## 6. Danno

### Calcolo e visualizzazione

Il danno viene **calcolato e tirato dal backend** al termine di ogni scambio (attacco + reazione), e **mostrato in chat**:

> "{X} dà un colpo in testa col bastone a {Y} e gli fa **10** danni."

Il danno **non viene sottratto automaticamente** ai PF del bersaglio. Sarà il **master** ad assegnarlo manualmente (meccanismo da definire).

### Danno critico

Il danno critico si attiva quando il tiro d'attacco raggiunge almeno il livello **`extreme`** (extreme o critical).

**Formula del danno critico:**

> Danno massimo dell'arma + tiro normale dell'arma

**Esempio:** un'arma con danno `1d10+2`:
- **Colpo normale:** tiro `1d10+2` (risultato da 3 a 12)
- **Colpo critico:** `12` (massimo) + `1d10+2` (tiro normale) = da 15 a 24

---

## 7. UI — Popup del tiro contrapposto

Quando l'utente clicca su "Tiro Contrapposto" in chat:

1. **Step 1:** Selezione della skill attiva e del bersaglio.
2. **Step 2 (condizionale):** In base alla skill selezionata, il popup mostra un secondo step adeguato:
   - **Raggirare:** campo di testo per la bugia.
   - **Altre skill:** conferma diretta (nessun campo aggiuntivo).
3. Clic su "Invia" → il tiro viene inviato al backend **separatamente dall'azione di chat**.

---

## 8. Proposta modelli a DB

### 8.1 — `SkillConfrontation` (nuova collection: `skill_confrontations`)

Tabella di configurazione che definisce le regole per ogni tipo di scontro. Ogni record rappresenta una skill che può essere usata attivamente in un tiro contrapposto.

```json
{
  "_id": "ObjectId",
  "skillId": "ObjectId",           // ref: Skill
  "skillName": "Raggirare",        // denormalizzato

  "category": "social",
  // Valori: "social" | "combat_unarmed" | "combat_melee" | "combat_ranged"

  "counterSkills": [
    { "skillId": "ObjectId", "skillName": "Empatia" }
  ],
  // Valore speciale: { "skillName": "_equipped_weapon_skill" }
  // indica "la skill dell'arma equipaggiata dal difensore"

  "rollType": "hidden",
  // "open" = palese (tutti vedono) | "hidden" = nascosto (solo coinvolti)

  "requiresAdditionalMessage": true,
  "additionalMessageLabel": "Testo della bugia",

  "modifiers": [
    {
      "label": "Tiro Rapido",
      "description": "Sparo senza mirare, nello stesso turno dell'estrazione",
      "minSuccessLevel": "hard"
    }
  ],

  "outcomeTemplates": {
    "attackerFails": "{attacker} sta evidentemente cercando di nasconderti qualcosa quando dice: '{message}'",
    "defenderWinsBy1": "Ti rendi conto che {attacker} ti sta nascondendo qualcosa.",
    "defenderWinsBy2": "{attacker} sta evidentemente cercando di nasconderti qualcosa quando dice: '{message}'"
  }
}
```

**Esempi di record:**

| skillName       | category       | counterSkills                                            | rollType | modifiers     |
| --------------- | -------------- | -------------------------------------------------------- | -------- | ------------- |
| Raggirare       | social         | [Empatia]                                                | hidden   | —             |
| Intimidire      | social         | [Autocontrollo]                                          | open     | —             |
| Ammaliare       | social         | [Autocontrollo]                                          | open     | —             |
| Persuadere      | social         | [Tempra]                                                 | open     | —             |
| Oratoria        | social         | [Tempra]                                                 | open     | —             |
| Empatia         | social         | [Raggirare]                                              | open     | —             |
| Corpo a Corpo   | combat_unarmed | [Schivata, Corpo a Corpo]                                | open     | —             |
| Armi da botta   | combat_melee   | [Schivata, _equipped_weapon_skill, Corpo a Corpo]        | open     | —             |
| Armi da taglio  | combat_melee   | [Schivata, _equipped_weapon_skill, Corpo a Corpo]        | open     | —             |
| Armi da fuoco   | combat_ranged  | [Schivata, Corpo a Corpo]                                | open     | [Tiro Rapido] |
| Armi da lancio  | combat_ranged  | [Schivata, Corpo a Corpo]                                | open     | [Tiro Rapido] |

> **Logica derivata automaticamente dal BE:**
> - `counterSkills.length === 1` → il BE tira direttamente per entrambi (flusso automatico, sezione 3).
> - `counterSkills.length > 1` → il BE manda un messaggio temporaneo a Y per scegliere la difesa (sezione 4).
> - `rollType === "hidden"` → il tiro è in due fasi: l'attaccante tira da solo prima, e solo in caso di successo si procede col contrapposto (sezione 5).
>
> **`_equipped_weapon_skill`:** quando il difensore sceglie "Parata", il BE legge `weaponStats.skill` dall'arma equipaggiata da Y e usa quella skill per il tiro.

---

### 8.2 — Estensione di `Item` con `weaponStats` (campo opzionale)

Aggiungere un sotto-documento opzionale al modello `Item` esistente. Presente solo quando `category === 'weapons'`.

```json
{
  "name": "Revolver Webley",
  "category": "weapons",
  "weaponStats": {
    "weaponType": "ranged_firearm",
    // Valori: "unarmed" | "melee_blunt" | "melee_blade" | "ranged_firearm" | "ranged_thrown"

    "skill": "Armi da fuoco",
    // Skill richiesta per usare quest'arma

    "damageFormula": "1d10+2",
    // Formato: "XdY" o "XdY+Z" — il BE parsa e tira

    "range": "ranged",
    // "melee" | "ranged"

    "requiresExtraction": true,
    // Se true, estrarre l'arma richiede 1 turno

    "applyBonusDamage": false
    // Se true, si aggiunge il bonus FOR+TAG al danno
    // (true per melee/unarmed, false per ranged)
  }
}
```

> **Danno a mani nude:** non è un Item. Il BE usa un danno base fisso di `2` (configurabile via `SystemConfiguration` con `configKey: "combat_unarmed_base_damage"`, `configSection: "combat_system"`). Il bonus FOR+TAG si applica sempre.

---

### 8.3 — `SystemConfiguration` — Configurazioni combat_system

Due record nella collection `system_configurations` esistente:

**Danno base mani nude:**
```json
{
  "configKey": "combat_unarmed_base_damage",
  "configSection": "combat_system",
  "configType": "number",
  "value": 2,
  "defaultValue": 2,
  "description": "Danno base inflitto con un attacco a mani nude (senza bonus FOR+TAG)"
}
```

**Tabella bonus danno FOR+TAG:**
```json
{
  "configKey": "combat_damage_bonus_table",
  "configSection": "combat_system",
  "configType": "json",
  "value": [
    { "min": 2,   "max": 64,  "bonus": "-2" },
    { "min": 65,  "max": 84,  "bonus": "-1" },
    { "min": 85,  "max": 124, "bonus": "0" },
    { "min": 125, "max": 164, "bonus": "1d4" },
    { "min": 165, "max": 204, "bonus": "1d6" },
    { "min": 205, "max": 284, "bonus": "2d6" },
    { "min": 285, "max": 364, "bonus": "3d6" },
    { "min": 365, "max": 444, "bonus": "4d6" },
    { "min": 445, "max": 524, "bonus": "5d6" }
  ],
  "defaultValue": [],
  "description": "Tabella bonus danno basato su FOR + TAG del personaggio"
}
```

**Mappa label livelli di successo:**
```json
{
  "configKey": "combat_success_level_labels",
  "configSection": "combat_system",
  "configType": "json",
  "value": {
    "fumble": "Maldestro",
    "failure": "Fallimento",
    "normal": "Normale",
    "hard": "Superiore",
    "extreme": "Estremo",
    "critical": "Critico"
  },
  "defaultValue": {},
  "description": "Label italiane per i livelli di successo, usate nell'output a video"
}
```

---

### 8.4 — `CombatEncounter` (nuova collection: `combat_encounters`)

Traccia un combattimento in corso tra due o più personaggi. Ogni scontro genera un record che vive finché il combattimento non è concluso.

```json
{
  "_id": "ObjectId",
  "locationId": "string",
  "sessionId": "string",

  "status": "waiting_reaction",
  // "initiative" | "in_progress" | "waiting_reaction" | "completed"

  "participants": [
    {
      "characterId": "string",
      "characterName": "John",
      "initiativeRoll": 67,
      "hasWeaponDrawn": true,
      "drawnWeaponId": "string"
    },
    {
      "characterId": "string",
      "characterName": "Mary",
      "initiativeRoll": 42,
      "hasWeaponDrawn": false
    }
  ],

  "currentTurn": {
    "turnNumber": 1,
    "attackerId": "string",
    "defenderId": "string",
    "attackSkill": "Armi da fuoco",
    "attackWeaponId": "string",
    "attackRoll": 23,
    "attackSuccessLevel": "normal",
    "modifier": null,

    "defenseSkill": null,
    "defenseRoll": null,
    "defenseSuccessLevel": null,

    "damageRoll": null,
    "isCriticalDamage": false,

    "status": "waiting_defense"
    // "attacking" | "waiting_defense" | "resolved"
  },

  "turnHistory": [
    {
      "turnNumber": 0,
      "phase": "initiative",
      "results": [
        { "characterId": "string", "roll": 67, "skillValue": 75 },
        { "characterId": "string", "roll": 42, "skillValue": 60 }
      ]
    }
  ],

  "startedAt": "2026-03-13T10:00:00Z",
  "endedAt": null
}
```

---

### 8.5 — Estensione di `Chat` — Sotto-documento unificato `confrontation`

Si sostituisce l'attuale `socialConflict` con un unico sotto-documento `confrontation` che gestisce **sia scontri sociali che di combattimento**. Si aggiungono tre nuovi `actionType`.

**Nuovi `actionType`:**
- `"social_confrontation"` — esito di uno scontro sociale (Intimidire, Persuadere, Raggirare...)
- `"combat_action"` — esito di un turno di combattimento
- `"confrontation_reaction_request"` — messaggio temporaneo per chiedere a Y di scegliere la difesa

**Enum `actionType` aggiornato:**
```
'standard' | 'master' | 'moderation' | 'whisper' | 'ooc' |
'dice_roll' | 'skill_check' | 'stat_check' | 'item_use' |
'social_confrontation' | 'combat_action' | 'confrontation_reaction_request'
```

> **Nota:** `diceResult` resta invariato e continua a servire esclusivamente per i **tiri di dado liberi** (non legati a scontri).

**Sotto-documento `confrontation` (sostituisce `socialConflict`):**

```json
{
  "actionType": "combat_action",

  "confrontation": {
    "type": "combat",
    // "social" | "combat"

    "encounterId": "string",
    // Solo per combat — ref a CombatEncounter. Null per social.

    "turnNumber": 1,
    // Solo per combat

    "phase": "result",
    // "initiative" | "attack" | "waiting_reaction" | "reaction" | "result"

    "attackerCharacterId": "string",
    "defenderCharacterId": "string",

    "attackSkill": "Armi da fuoco",
    "defenseSkill": "Schivata",
    "weaponName": "Revolver Webley",
    // weaponName: solo per combat, null per social

    "attackRoll": 23,
    "attackSuccessLevel": "normal",
    "defenseRoll": 45,
    "defenseSuccessLevel": "failure",

    "outcome": "hit",
    // Combat: "hit" | "miss" | "parry" | "dodge" | "disarm"
    // Social: "attacker_wins" | "defender_wins" | "draw"

    "damageDealt": 10,
    "isCriticalDamage": false,
    "damageFormula": "1d10+2",
    // Solo per combat

    "messageForDefender": "Ti rendi conto che John ti sta nascondendo qualcosa.",
    "visibleToDefenderOnly": true
    // Solo per social hidden (Raggirare)
  },

  "visibility": "public"
  // I messaggi "confrontation_reaction_request" usano "whisper"
  // con targetCharacters = [attacker, defender]
}
```

> **Migrazione:** il campo `socialConflict` esistente va migrato a `confrontation` con `type: "social"`. I campi sono mappabili 1:1.

> **Messaggio temporaneo di scelta difesa:** è un messaggio `Chat` con `actionType: "confrontation_reaction_request"`, `visibility: "whisper"`, `targetCharacters: [X, Y]`, e `confrontation.phase: "waiting_reaction"`. Contiene le opzioni di difesa disponibili. Una volta che Y sceglie, il messaggio viene aggiornato in-place con il risultato finale e l'`actionType` cambia in `"combat_action"` o `"social_confrontation"`.
>
> **Embedding:** il post-save hook di `Chat` pubblica eventi embedding **solo** per `actionType` = `standard`, `master`, `moderation`. Tutti gli altri action type (inclusi `combat_action`, `social_confrontation`, `confrontation_reaction_request`, `dice_roll`, ecc.) non generano embedding. La mutazione in-place del reaction request è quindi sicura.

---

### 8.6 — Rimozione TTL da `Chat`

Rimuovere il TTL index attualmente presente:

```js
// DA RIMUOVERE:
ChatSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
```

I messaggi di chat non devono più essere auto-eliminati. La gestione del ciclo di vita dei messaggi sarà gestita manualmente o tramite un sistema di archiviazione dedicato.
