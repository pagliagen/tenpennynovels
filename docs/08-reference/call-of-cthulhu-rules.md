**Navigation**: [Home](../INDEX.md) > [Reference](./README.md) > Call of Cthulhu Rules

**Status**: ✅ Production Ready
**Last Updated**: 2026-02-28
**Version**: 7th Edition (Victorian Adaptation)

# Call of Cthulhu Rules Reference

TenpennyNovels utilizza il sistema di gioco **Call of Cthulhu 7th Edition** adattato per l'ambientazione vittoriana (Londra, 1895). Questo documento fornisce le regole base del sistema d100 e le modifiche specifiche per l'ambientazione.

## Core Mechanic: d100 System

### Basic Skill Check

Ogni azione significativa richiede un **skill check** (tiro abilità):

1. **Determinare l'abilità**: Quale skill si applica all'azione?
2. **Tirare d100**: Generare numero casuale tra 1 e 100
3. **Confrontare con skill value**: Se risultato ≤ valore abilità → **Successo**
4. **Applicare modificatori** (se presenti): Bonus/Penalty dice

**Esempio**:
```
Personaggio con "Medicina: 60"
Tira d100: 45
45 ≤ 60 → SUCCESSO
```

### Degrees of Success

#### Regular Success
- **Condizione**: Risultato ≤ skill value
- **Effetto**: Azione completata con successo standard

#### Hard Success
- **Condizione**: Risultato ≤ (skill value / 2)
- **Effetto**: Successo superiore, risultati migliori
- **Esempio**: Medicina 60 → Hard threshold = 30

#### Extreme Success
- **Condizione**: Risultato ≤ (skill value / 5)
- **Effetto**: Successo eccezionale, risultati ottimali
- **Esempio**: Medicina 60 → Extreme threshold = 12

#### Critical Success
- **Condizione**: Risultato = 01
- **Effetto**: Miglior risultato possibile, effetti speciali

#### Failure
- **Condizione**: Risultato > skill value
- **Effetto**: Azione fallita

#### Fumble (Failure Critico)
- **Condizione**: Risultato = 96-100 (se skill value < 50) o risultato = 100 (se skill ≥ 50)
- **Effetto**: Fallimento catastrofico, conseguenze negative

### Opposed Checks

Quando due personaggi si oppongono direttamente:

1. Entrambi tirano per le loro abilità
2. **Chi ottiene il degree of success più alto vince**
3. Parità → vince chi ha skill value più alto

**Esempio - Inseguimento**:
```
Investigatore (Atletica 50): tira 25 → HARD SUCCESS
Criminale (Atletica 70): tira 40 → REGULAR SUCCESS
→ Investigatore vince (Hard > Regular)
```

### Bonus and Penalty Dice

Modificatori alle prove basati su circostanze:

**Bonus Die**:
- Circostanze favorevoli
- Tira 1d10 extra (o più), usa il **più basso** come decina
- Aumenta probabilità successo

**Penalty Die**:
- Circostanze sfavorevoli
- Tira 1d10 extra (o più), usa il **più alto** come decina
- Riduce probabilità successo

**Esempio - Penalty Die**:
```
Skill: Medicina 60
Tiro: d100 + 1 penalty die
Risultato: 4 (unità), 3 (decina normale), 7 (penalty die)
→ Usa decina più alta (7) → Risultato finale: 74
→ 74 > 60 → FAILURE
```

---

## Characteristics (Caratteristiche)

I personaggi hanno **8 caratteristiche base** che definiscono le loro capacità fisiche e mentali.

### Strength (FOR - Forza)
- **Range**: 15-90 (umani standard 40-70)
- **Utilizzo**: Sollevare, spingere, danni in combattimento corpo a corpo
- **Skill associata**: Lotta, Arti Marziali

### Dexterity (DES - Destrezza)
- **Range**: 15-90
- **Utilizzo**: Coordinazione, equilibrio, riflessi
- **Skill associate**: Atletica, Furtività, Schivare

### Intelligence (INT - Intelligenza)
- **Range**: 15-90
- **Utilizzo**: Ragionamento, memoria, problem-solving
- **Derived**: Idea Roll = INT
- **Bonus**: Punti abilità extra all'inizio (INT / 10)

### Constitution (COS - Costituzione)
- **Range**: 15-90
- **Utilizzo**: Resistenza, salute, recupero ferite
- **Derived**: Hit Points = (COS + TAG) / 10

### Size (TAG - Taglia)
- **Range**: 15-90 (umani standard 50-80)
- **Utilizzo**: Altezza, massa corporea, impatto fisico
- **Derived**: Damage Bonus, Build

### Charm (CHA - Fascino)
- **Range**: 15-90
- **Utilizzo**: Carisma, presenza, attrattiva sociale
- **Skill associate**: Persuasione, Raggiro, Autorità

### Power (POT - Potere)
- **Range**: 15-90
- **Utilizzo**: Forza di volontà, resistenza mentale, potere magico
- **Derived**: Sanity Points = POT, Magic Points = POT / 5, Luck Roll = POT

### Education (EDU - Educazione)
- **Range**: 15-90
- **Utilizzo**: Conoscenza accademica, istruzione formale
- **Skill base**: Molte skill professionali partono da EDU
- **Derived**: Knowledge Roll = EDU

---

## Derived Stats (Attributi Derivati)

### Hit Points (Punti Ferita)
- **Formula**: (CON + TAG) / 10
- **Funzione**: Danno fisico sostenibile
- **Morte**: 0 HP o meno

### Sanity Points (Punti Sanità)
- **Formula**: POW (all'inizio)
- **Funzione**: Stabilità mentale
- **Perdita**: Incontri orribili, magia
- **Follia**: Se perdi 5+ SAN in un'ora → Temporary Insanity
- **Follia permanente**: SAN scende a 0

### Magic Points (Punti Magia)
- **Formula**: POW / 5
- **Funzione**: Lanciare incantesimi (se conosciuti)
- **Recupero**: 1 punto/ora di riposo

### Luck Roll (Tiro Fortuna)
- **Formula**: POW
- **Utilizzo**: Tiri fortuna quando le skill non si applicano
- **Consumabile**: Può essere speso per ri-tirare

### Idea Roll (Tiro Idea)
- **Formula**: INT
- **Utilizzo**: Ricordare informazioni, avere intuizioni

### Knowledge Roll (Tiro Conoscenza)
- **Formula**: EDU
- **Utilizzo**: Sapere cose generali non coperte da skill specifiche

### Damage Bonus & Build

Basati su **FOR + TAG**:

| FOR + TAG | Damage Bonus | Build |
|-----------|--------------|-------|
| 2-64      | -2           | -2    |
| 65-84     | -1           | -1    |
| 85-124    | 0            | 0     |
| 125-164   | +1d4         | 1     |
| 165-204   | +1d6         | 2     |
| 205-284   | +2d6         | 3     |
| 285-364   | +3d6         | 4     |
| 365-444   | +4d6         | 5     |

**Build**: Utilizzato per calcolare capacità di spinta, resistenza in manovre di combattimento

---

## Skills (Abilità)

### Skill Values

Ogni skill ha un **valore percentuale** (0-100):

- **Base Value**: Valore iniziale (varia per skill)
- **Occupation Points**: Punti spesi dall'occupazione
- **Personal Interest Points**: Punti spesi per interessi personali

**Skill Advancement**: Le skill migliorano con l'uso (experience checks)

### Skill Categories

**Combat Skills**:
- Lotta (Fighting: Brawl)
- Armi da Fuoco (Firearms)
- Armi da Tiro (Bow, Thrown)

**Physical Skills**:
- Atletica (Climb, Jump, Swim)
- Furtività (Stealth)
- Schivare (Dodge)

**Mental Skills**:
- Investigare (Spot Hidden, Library Use)
- Psicologia (Psychology)
- Scienze (Biology, Chemistry, Physics)

**Social Skills**:
- Persuasione (Persuade)
- Autorità (Intimidate)
- Raggiro (Fast Talk)
- Fascino (Charm)

**Profession Skills**:
- Medicina (Medicine)
- Legge (Law)
- Contabilità (Accounting)
- Arte (Art/Craft)

**Victorian-Specific Skills**:
- Etichetta Vittoriana (Victorian Etiquette)
- Conoscenza Nobiliare (Knowledge: Aristocracy)
- Servizio Domestico (Domestic Service)

### Dynamic Skills

Alcune skill hanno **specializzazioni**:

- **Lingua**: Inglese, Francese, Tedesco, Latino, Greco...
- **Scienza**: Biologia, Chimica, Fisica, Astronomia...
- **Arte**: Pittura, Scultura, Musica, Letteratura...
- **Pilotare**: Carrozza, Nave, Dirigibile...

**Creazione**: Durante character creation, specificare la specializzazione

---

## Combat Rules

### Combat Flow

1. **Surprise**: Determina se qualcuno è sorpreso
2. **Initiative**: DEX determina ordine (highest first)
3. **Actions**: Ogni personaggio agisce in ordine
4. **Resolution**: Applica danni, effetti
5. **Repeat**: Nuovo round

### Actions in Combat

**Fighting Action**:
- Attacco in mischia o a distanza
- Opposed check: Attaccante vs Difensore (Dodge/Fight back)

**Movement**:
- MOV = (FOR + DEX) / 10
- Può muoversi + attaccare nello stesso round

**Dodge**:
- Evitare attacco
- Valore base = DEX / 2
- Full dodge: usa intera azione per +bonus

**Manovre**:
- Tackle, Grapple, Disarm
- Build vs Build checks

### Damage

- **Armi da fuoco**: Devastanti (1d10-2d10+)
- **Armi da mischia**: Variabili (1d3-1d8 + DB)
- **Senz'armi**: 1d3 + DB

**Locazione ferita**: Colpi possibili a testa, petto, braccia, gambe

### Healing

- **Natural**: 1 HP/giorno (riposo)
- **First Aid**: 1 HP immediato (1/wound)
- **Medicine**: 1d3 HP (weekly check)

---

## Sanity System

### Sanity Checks

Quando esposto a orrori soprannaturali:

1. **Tira SAN check** (current Sanity Points)
2. **Success**: Perdi SAN minimi (es. 0/1d3)
3. **Failure**: Perdi SAN massimi (es. 1d3/1d10)

**Esempi di perdita**:
- Vedere un cadavere: 0/1d3
- Vedere mostro minore: 0/1d6
- Vedere Grande Antico: 1d10/1d100

### Temporary Insanity

Se perdi **5+ SAN in meno di 1 ora**:

- Bout of Madness (1d10+4 rounds)
- Comportamento irrazionale
- Phobia temporanea

### Indefinite Insanity

Se perdi **20% dei tuoi SAN in una sessione**:

- Pazzia prolungata (1d6 giorni - mesi)
- Mania, fobia persistente
- Impossibile giocare finché guarito

### Permanent Insanity

**SAN scende a 0**:

- Pazzia permanente
- Personaggio diventa NPC
- Nuova character sheet necessaria

---

## Victorian London Adaptations

### Social Class System

La società vittoriana è rigidamente stratificata. Il sistema usa la skill **FINANZA** per determinare classe sociale:

| Skill Finanza | Classe Sociale | Descrizione |
|---------------|----------------|-------------|
| 0-09          | 6 - Indigente  | Senzatetto, mendicanti, criminali di strada |
| 10-29         | 5 - Working Class | Operai, domestici, artigiani |
| 30-49         | 4 - Lower Middle Class | Impiegati, commercianti |
| 50-69         | 3 - Middle Class | Professionisti, medici, avvocati |
| 70-84         | 2 - Upper Middle Class | Industriali, banchieri |
| 85-99         | 1 - Aristocrazia | Nobili, alta aristocrazia |

**Impatto**: La classe sociale influenza:
- Accesso a location esclusive
- Reazioni NPC
- Opportunità economiche
- Credibilità sociale

### Victorian Occupations

55 occupazioni specifiche per l'epoca vittoriana:

**Professional Class**:
- Medico, Avvocato, Ingegnere, Professore
- 6 required skills + 2 bonus skills
- Alta educazione (EDU 70+)

**Working Class**:
- Operaio, Domestico, Cocchiere, Cameriere
- 6 required skills + 1 bonus skill
- Educazione media-bassa (EDU 30-50)

**Criminal Class**:
- Ladro, Truffatore, Contrabbandiere
- Skill furtività, raggiro, legge (per evitarla)
- Collegamento con underworld

**Gentlemen/Ladies**:
- Dilettan te, Esplorator e, Occultista
- Ricchezza ereditata (Finanza alta)
- Skill culturali e sociali

### Victorian Technology

**Available Technology (1895)**:
- ✅ Telegrafo, telefono (limitato)
- ✅ Treni a vapore, carrozze
- ✅ Fotografia, stampa meccanica
- ✅ Illuminazione a gas, elettricità (nascente)
- ✅ Medicina moderna iniziale (antisepsi, anestesia)
- ❌ Automobili diffuse (rare)
- ❌ Radio, aeroplani (futuro)
- ❌ Antibiotici, vaccini moderni

**Skill Modifications**:
- "Computer Use" → "Meccanica"
- "Drive Auto" → "Pilotare (Carrozza)"
- "Electronics" → "Elettricità Sperimentale"

### Victorian Society Norms

**Gender Roles**:
- Donne: Limitate in occupazioni (governante, nurse, insegnante accettabili)
- Uomini: Accesso a tutte le professioni
- **Nota gioco**: Il gioco permette flessibilità narrativa

**Religion**:
- Anglicanesimo dominante
- Cattolici, ebrei, altri presenti ma marginali
- Ateismo socialmente inaccettabile

**Etiquette**:
- Appellativi formali richiesti (Mr., Mrs., Sir, Lady)
- Victorian Etiquette skill cruciale in alta società
- Violazioni causano Scandal e perdita reputazione

**Criminal Justice**:
- Scotland Yard attivo (fondato 1829)
- Pena capitale per crimini gravi
- Workhouses per indigenti

---

## Character Advancement

### Experience Points

Guadagnati a fine sessione:

- **Partecipazione**: 5 XP
- **Buon roleplay**: 5-10 XP
- **Obiettivi raggiunti**: 10-20 XP
- **Storytelling contribution**: 5 XP

**Utilizzo**:
- Improve skills (spesa XP per checks)
- Increase characteristics (costoso)

### Skill Improvement

1. **Durante sessione**: Segnare skill se usata con successo
2. **Tra sessioni**: Tirare d100 per ogni skill segnata
3. **Improvement**: Se tiro > current value → skill aumenta di 1d10

**Limite**: Skill max 99 (100 = perfezione impossibile)

### Occupation Skill Points

Spesi all'inizio basati su **EDU**:

- Occupation Points = EDU × 4
- Personal Interest Points = INT × 2

---

## Reference Tables

### Characteristic Generation (Standard)

| Method | Description |
|--------|-------------|
| 3d6 × 5 | Roll 3d6, multiply by 5 (range 15-90) |
| 2d6+6 × 5 | Roll 2d6+6, multiply by 5 (range 40-90, more heroic) |

### Age Modifiers

| Age | EDU Bonus | Penalty |
|-----|-----------|---------|
| 15-19 | -5 | -5 STR, -5 TAG |
| 20-39 | 0 | 0 |
| 40-49 | +5 | -5 STR/CON/DEX, -5 CHA |
| 50-59 | +10 | -10 STR/CON/DEX, -10 CHA |
| 60-69 | +20 | -20 STR/CON/DEX, -15 CHA |
| 70-79 | +40 | -40 STR/CON/DEX, -20 CHA |
| 80-89 | +80 | -80 STR/CON/DEX, -25 CHA |

### Wealth by Era (Victorian Pence)

| Class | Monthly Income (pence) | Annual (£) |
|-------|------------------------|------------|
| Working Class | 12,000-24,000 | £5-10 |
| Lower Middle | 24,000-60,000 | £10-25 |
| Middle Class | 60,000-240,000 | £25-100 |
| Upper Middle | 240,000-1,200,000 | £100-500 |
| Aristocracy | 1,200,000+ | £500+ |

**Note**: 1 penny = 1 pence, 12 pence = 1 shilling, 20 shillings = 1 pound (£)

---

## Related Documentation

- **Character System**: [character-system.md](../03-game-systems/character-system.md) - Complete character creation workflow
- **Skills Reference**: [skills-reference.md](./skills-reference.md) - All available skills with base values
- **Occupations Reference**: [occupations-reference.md](./occupations-reference.md) - 55 Victorian occupations
- **Experience System**: [experience-points.md](../03-game-systems/experience-points.md) - XP and advancement mechanics

## External Resources

- **Call of Cthulhu 7th Edition**: Chaosium official rulebook
- **Victorian Era Guide**: https://www.victorianlondon.org/
- **Gaslight Era Supplement**: Official CoC Victorian sourcebook
- **1890s London Maps**: https://www.oldmapsonline.org/

---

**Status**: ✅ Complete Core Rules
**System**: Call of Cthulhu 7th Edition
**Setting**: Victorian London, 1895
**Last Verified**: 2026-02-28
