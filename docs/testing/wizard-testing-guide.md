# Character Wizard Testing Guide - NEW SYSTEM

**Versione**: 2.0 (NEW SYSTEM con 6 required skills + 1-2 bonus skills)
**Data**: 2025-01-14
**Stato**: Ready for Testing

## 🎯 Obiettivo

Testare il wizard di creazione personaggio completamente refactorizzato con il NEW SYSTEM che implementa:
- Nuovo ordine steps: Info → Stats → Skills → Occupation → Background → Review
- 6 required skills per occupazione (alcune con alternative)
- 1-2 bonus skills automatici applicati tramite API
- 9 campi anagrafica opzionali
- Background strutturato con 9 campi guidati

## 📋 Pre-requisiti

1. **Backend Services Running**:
   ```bash
   npm run dev:game  # Game backend (port 3001)
   ```

2. **Frontend Application Running**:
   ```bash
   cd apps/game
   npm run dev  # Game frontend (port 4001)
   ```

3. **Database Seeded**:
   - Occupations seeded (55 occupations con NEW SYSTEM)
   - Skills seeded (tutte le skill Call of Cthulhu)
   - Test user con almeno 1 character draft

4. **Authentication**:
   - Login funzionante
   - Character context disponibile

## 🧪 Test Plan

### TEST 1: Step 1 - Informazioni Base + Anagrafica

**Azioni**:
1. Avvia wizard nuovo personaggio
2. Verifica che Step 1 sia visibile con titolo "Informazioni Base"
3. Compila campi required:
   - Nome: "Reginald"
   - Cognome: "Ashford"
   - Età: 35
   - Età apparente: 32
   - Genere: Maschio
   - Luogo di nascita: "London, Whitechapel"

4. **NEW: Compila campi anagrafica opzionali**:
   - Altezza: "1,82 m"
   - Colore occhi: "Azzurri"
   - Colore capelli: "Castano scuro"
   - Segni distintivi visibili: "Cicatrice sopracciglio sinistro"
   - Stato civile: "Married"
   - Titolo di studio: "Bachelor of Medicine"

5. Clicca "Continua con le Caratteristiche →"

**Expected Results**:
- ✅ Campi required validati (non permette procedere se vuoti)
- ✅ Campi opzionali non bloccano progressione
- ✅ Salvataggio automatico draft
- ✅ Transizione a Step 2

---

### TEST 2: Step 2 - Caratteristiche (Stats)

**Azioni**:
1. Verifica titolo "Caratteristiche"
2. Verifica counter punti disponibili: "400 punti da assegnare"
3. Assegna punti caratteristiche:
   - FOR (Strength): 55 (+35)
   - TAG (Size): 60 (+40)
   - DES (Dexterity): 70 (+50)
   - COS (Constitution): 75 (+55)
   - INT (Intelligence): 80 (+60)
   - EDU (Education): 75 (+55)
   - POT (Power): 65 (+45)
   - CHA (Charm): 60 (+40)
   - **Totale punti usati: 380/400**

4. Verifica calcolo automatico derived stats:
   - Punti Vita: (TAG + COS)/10 = 13-14
   - Sanità Mentale: POT = 65
   - Fortuna: POT = 65

5. Clicca "Continua con le Abilità →"

**Expected Results**:
- ✅ Counter aggiornato real-time
- ✅ Derived stats calcolati automaticamente
- ✅ Validazione punti totali (deve usare esattamente 400)
- ✅ Nessun controllo prerequisiti occupation (viene dopo)
- ✅ Transizione a Step 3

---

### TEST 3: Step 3 - Abilità (Skills)

**Azioni**:
1. Verifica titolo "Abilità"
2. Verifica counter skill points: "200 + INT/2 bonus = 240 punti"
3. Assegna punti abilità (migliorare almeno 6 skill diverse per soddisfare requisiti occupation futuri):
   - Medicina: 60 (+55 dal base 5)
   - Primo soccorso: 50 (+20 dal base 30)
   - Biologia: 55 (+50 dal base 5)
   - Farmacologia: 50 (+45 dal base 5)
   - Empatia: 45 (+30 dal base 15)
   - Persuadere: 40 (+25 dal base 15)
   - Percezione: 35 (+10 dal base 25)
   - **Totale punti usati: 235/240**

4. Aggiungi skill dinamica:
   - Lingua (Francese): 30 (+25 dal base 5)
   - **Totale finale: 260/240** (atteso errore validazione)

5. Correggi per usare esattamente 240 punti

6. Clicca "Continua con l'Occupazione →"

**Expected Results**:
- ✅ Counter aggiornato real-time
- ✅ Skill dinamiche funzionanti
- ✅ Validazione punti totali (deve usare esattamente 240)
- ✅ Nessun controllo prerequisiti occupation (viene dopo)
- ✅ Transizione a Step 4

---

### TEST 4: Step 4 - Occupazione ⭐ (NEW SYSTEM)

**Azioni**:
1. Verifica titolo "Occupazione"
2. Verifica descrizione: "Ogni occupazione ha **6 abilità richieste** ... **1-2 bonus automatici**"
3. Scorri lista occupazioni
4. Seleziona "Medico" (dovrebbe essere compatibile con stats/skills assegnate)

5. **Verifica NEW SYSTEM UI**:
   - Banner sticky in alto mostra:
     - "Occupazione Selezionata: Medico"
     - "Abilità Richieste (6): Medicina, Primo soccorso, Biologia, Farmacologia, Empatia, Lingua"
     - "Bonus Automatici (1-2): Empatia +20" (o simile)
     - "Equipaggiamento: Medical bag, Stethoscope..." (se presente)

6. Verifica card occupazione mostra:
   - Descrizione occupazione
   - **6 Required Skills** con label "(6)"
   - **1-2 Bonus Skills** con valori "+X"
   - Prerequisiti (se presenti)
   - Badge ⚡ se prerequisiti non soddisfatti

7. Clicca "Continua con il Background →"

8. **CRITICAL: Verifica API call occupation bonuses**:
   - Console del browser mostra: "🎯 Applying occupation bonuses..."
   - Console mostra: "✅ Occupation bonuses applied"
   - Console mostra: "✅ Character data reloaded with applied bonuses"
   - Se errore, alert con messaggio graceful degradation

**Expected Results**:
- ✅ UI mostra chiaramente 6 required + 1-2 bonus
- ✅ API chiamata automaticamente quando procede a Step 5
- ✅ Bonus applicati alle skill (verificabile in Step 6 Review)
- ✅ Flag `occupationBonusesApplied = true`
- ✅ Transizione a Step 5

---

### TEST 5: Step 5 - Background Strutturato ⭐ (NEW SYSTEM)

**Azioni**:
1. Verifica titolo "Background e Storia del Personaggio"
2. Verifica presenza **12 campi totali** (3 descrizioni + 9 background):

**Sezione 1: Descrizioni Base (Required)**:
3. Compila:
   - Descrizione Pubblica (min 50 chars): "Dr. Reginald Ashford è un distinto medico londinese di mezza età. Alto e di corporatura media, veste sempre in modo impeccabile con completo scuro e cilindro. Il suo sguardo azzurro è penetrante ma rassicurante."
   - Descrizione Privata (min 50 chars): "Dietro la facciata professionale, Reginald nasconde un profondo senso di colpa per un paziente perso anni fa. Questo trauma lo spinge a lavorare instancabilmente nei quartieri poveri."
   - Descrizione Fisica (optional): "Cicatrice sul sopracciglio sinistro da incidente d'infanzia. Mani curate da chirurgo."

**Sezione 2: Background Strutturato NEW SYSTEM (3 required + 6 optional)**:
4. Compila i 3 **required**:
   - 1. Breve Storia (min 100 chars): "Nato a Whitechapel da famiglia operaia, Reginald ha studiato medicina grazie a una borsa di studio. Dopo la laurea ha lavorato in ospedali prestigiosi ma un caso tragico lo ha spinto a tornare nei quartieri poveri dove è cresciuto, offrendo cure gratuite."
   - 4. Personalità (min 50 chars): "Compassionevole ma riservato. Determinato nel suo lavoro ma tormentato dal passato. Razionale ma capace di grande empatia."
   - 9. Obiettivi e Motivazioni (min 50 chars): "Redimere il suo passato salvando più vite possibili. Migliorare le condizioni sanitarie nei quartieri poveri. Dimostrare che la medicina deve servire tutti, non solo i ricchi."

5. Compila alcuni **opzionali** (es: 2, 3, 7):
   - 2. Eventi Significativi: "1883: Morte di paziente durante chirurgia complessa. 1885: Decisione di lasciare Harley Street per East End."
   - 3. Relazioni Importanti: "Moglie Margaret (supportive), Dr. Thompson (mentor), Padre John (contatto coi poveri)"
   - 7. Paure e Fobie: "Paura di fallire ancora come medico. Claustrofobia in spazi ristretti dopo incidente in miniera."

6. Verifica feedback real-time character count per campi required
7. Verifica lista errori validazione dettagliata
8. Clicca "Continua con la Revisione →"

**Expected Results**:
- ✅ 12 campi visibili (3 descrizioni + 9 background)
- ✅ Validazione sui 5 required (2 descrizioni + 3 background)
- ✅ Character count real-time funzionante
- ✅ Lista errori dettagliata se campi mancanti
- ✅ Campi opzionali non bloccano progressione
- ✅ Transizione a Step 6

---

### TEST 6: Step 6 - Revisione Finale ⭐ (Verifica NEW SYSTEM completo)

**Azioni**:
1. Verifica titolo "Revisione Finale"
2. Verifica tutte le sezioni siano visualizzate correttamente:

**Sezione: Informazioni Base**:
3. Verifica campi base visibili
4. **NEW: Verifica sezione "Anagrafica Dettagliata"** se compilata:
   - Altezza, Colore Occhi, Colore Capelli
   - Segni Distintivi, Stato Civile, Titolo di Studio
   - Casellario Giudiziario, Malattie

**Sezione: Caratteristiche**:
5. Verifica stats e derived stats

**Sezione: Occupazione** ⭐:
6. **CRITICAL: Verifica NEW SYSTEM display**:
   - Nome occupazione: "Medico"
   - **"Abilità Richieste (6):"** con lista delle 6 skill
     - Se skill ha alternatives: mostra "(alternative: Alt1, Alt2)"
   - **"Bonus Automatici (1-2):"** con skill + valori (es: "Empatia: +20")

**Sezione: Abilità Principali**:
7. **CRITICAL: Verifica che le skill mostrino valori CON bonus applicati**
   - Es: Se Empatia era 45 e bonus +20 → dovrebbe mostrare 65

**Sezione: Background e Storia** ⭐:
8. **Verifica NEW SYSTEM structured background**:
   - Descrizione Pubblica
   - Descrizione Privata
   - Descrizione Fisica (se compilata)
   - **Storia del Personaggio** (briefHistory)
   - **Personalità** (personality)
   - **Obiettivi e Motivazioni** (goalsAndMotivations)
   - Altre sezioni opzionali se compilate (Paure, Segreti, etc.)

**Validazione Finale**:
9. Se campi mancanti, verifica "Dati Mancanti" panel con lista dettagliata:
   - Step 1 fields
   - Step 3: Skill FINANZA
   - Step 4: Occupazione
   - **Step 5 NEW: Descrizioni (50+ chars) + Background structured (100/50/50 chars)**

10. Clicca sezioni per tornare indietro e verificare navigation
11. Se tutto OK, clicca "Invia per Approvazione"

**Expected Results**:
- ✅ Tutte le sezioni visibili e complete
- ✅ Anagrafica dettagliata mostrata se compilata
- ✅ Occupation mostra 6 required + 1-2 bonus skills
- ✅ Skill values includono bonus applicati
- ✅ Background strutturato visualizzato correttamente
- ✅ Validazione completa prima submission
- ✅ Navigation tra steps funzionante
- ✅ Submission invia character con status PENDING_APPROVAL

---

## 🐛 Known Issues & Workarounds

### Issue 1: API call occupation bonuses fails
**Symptom**: Alert "Errore durante l'applicazione dei bonus occupazione"
**Workaround**: Il wizard permette di procedere ugualmente. I bonus verranno applicati durante final submission.
**Fix**: Verificare che backend endpoint `/characters/:characterId/apply-occupation-bonuses` sia attivo.

### Issue 2: Skills non mostrano bonus applicati in Review
**Symptom**: Review step mostra skill values senza bonus
**Root Cause**: API call fallita o character data non ricaricato
**Fix**: Verificare console logs per errori API. Ricaricare pagina wizard.

### Issue 3: Validation errors dopo reload
**Symptom**: Wizard mostra errori validazione dopo refresh browser
**Root Cause**: LocalStorage draft non sincronizzato con DB
**Fix**: Cancellare localStorage e ricaricare wizard da DB.

---

## ✅ Success Criteria

Il wizard è considerato **FULLY FUNCTIONAL** se:

1. ✅ Tutti i 6 steps sono accessibili e funzionanti
2. ✅ Validation real-time funziona su tutti gli step
3. ✅ Anagrafica completa (9 campi) raccolta correttamente
4. ✅ Background strutturato (9 campi) raccolta correttamente
5. ✅ Occupation mostra chiaramente 6 required + 1-2 bonus skills
6. ✅ API call applica bonus occupation automaticamente Step 4→5
7. ✅ Review step mostra skill values CON bonus applicati
8. ✅ Character submission funziona e crea character con status PENDING_APPROVAL
9. ✅ Draft auto-save funziona durante tutto il wizard
10. ✅ Navigation avanti/indietro preserva tutti i dati

---

## 📊 Test Results Template

```markdown
## Test Session - [DATE]

**Tester**: [Name]
**Environment**: Development / Staging / Production
**Browser**: Chrome / Firefox / Safari [Version]

### Results Summary

| Test | Status | Notes |
|------|--------|-------|
| TEST 1: Step 1 Basic Info + Anagrafica | ✅ PASS / ❌ FAIL | |
| TEST 2: Step 2 Stats | ✅ PASS / ❌ FAIL | |
| TEST 3: Step 3 Skills | ✅ PASS / ❌ FAIL | |
| TEST 4: Step 4 Occupation + API | ✅ PASS / ❌ FAIL | |
| TEST 5: Step 5 Background Structured | ✅ PASS / ❌ FAIL | |
| TEST 6: Step 6 Review + Submission | ✅ PASS / ❌ FAIL | |

### Issues Found

1. [Issue description]
   - Severity: Critical / High / Medium / Low
   - Steps to reproduce: ...
   - Expected: ...
   - Actual: ...

### Additional Notes

[Any observations, suggestions, or feedback]
```

---

## 🚀 Next Steps After Testing

1. **If all tests PASS**: Mark wizard as PRODUCTION READY
2. **If critical issues found**: Fix issues and re-test
3. **Documentation**: Update `docs/systems/character-system.md` with final implementation details
4. **User Guide**: Create end-user documentation for character creation
5. **Staff Training**: Brief staff on new approval workflow for structured backgrounds

---

**Last Updated**: 2025-01-14
**Version**: 2.0 (NEW SYSTEM)
**Status**: Ready for Testing 🧪
