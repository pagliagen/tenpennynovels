**Navigation**: [Home](../INDEX.md) > [Reference](./README.md) > Occupations Reference

**Status**: ✅ Production Ready
**Last Updated**: 2026-02-28
**Total Occupations**: 57

# Victorian Occupations Reference

TenPennyNovels offre **57 occupazioni storiche** dell'epoca vittoriana (Londra, 1895), organizzate in **18 categorie tematiche**. Ogni occupazione fornisce **6 required skills** (alcune con alternative) + **1-2 bonus skills** con valori predeterminati.

## Occupation System (NEW v2.0)

### Skill Bonuses Structure

**Required Skills** (6 total):
- Applicate automaticamente quando selezioni l'occupazione
- Alcune offrono **alternatives** (es. "Medicina OR Primo Soccorso")
- Base value standard: 40 points per skill

**Bonus Skills** (1-2 total):
- Bonus fissi aggiunti a skill specifiche
- Formato: `SkillName:BonusValue` (es. "Sopravvivenza:10")
- Non contano verso i required 6

**Example - Medico**:
```typescript
{
  requiredSkills: [
    "Medicina",
    "Lingua (Latina)",
    "Primo soccorso",
    "Psicologia",
    "Biologia",
    "Chimica"
  ],
  bonusSkills: [
    "Antropologia:10",
    "Farmacologia:10"
  ]
}
```

---

## Categories Overview

| Category | Count | Description |
|----------|-------|-------------|
| Avventurieri | 5 | Esploratori, cacciatori, investigatori privati |
| Arti Creative | 6 | Scultori, pittori, musicisti, scrittori |
| Artisti Spettacolo | 4 | Attori, ballerini, acrobati |
| Sport | 2 | Pugili, fantini |
| Affari | 8 | Commercianti, industriali, banchieri |
| Religiosi | 3 | Sacerdoti, monaci, teologi |
| Criminali | 6 | Ladri, truffatori, contrabbandieri |
| Giornalismo | 2 | Giornalisti, fotoreporter |
| Lavoro Rurale | 3 | Agricoltori, pastori, boscaioli |
| Lavoro Urbano | 5 | Operai, facchini, cocchieri |
| Tutori Ordine | 4 | Poliziotti, detective, guardie |
| Professione Legale | 2 | Avvocati, giudici |
| Operatori Sanitari | 5 | Medici, chirurghi, infermieri |
| Salute Mentale | 2 | Psichiatri, alienisti |
| Forze Armate | 4 | Soldati, ufficiali, marinai |
| Politica | 2 | Politici, diplomatici |
| Studiosi | 7 | Professori, archeologi, bibliotecari |
| Professioni Varie | 4 | Occultisti, detective dell'occulto, dilettanti |

---

## Occupations by Category

### Avventurieri

**Esploratore**
- **Social Class**: Variabile (dipende da successo)
- **Required Skills**: Armi da fuoco | Lingua Straniera | Orientamento | Atletica | Nuotare | Percezione
- **Bonus Skills**: Sopravvivenza:10
- **Contacts**: Altri esploratori, mecenati, dipendenti di museo
- **Description**: Carriere nell'esplorazione di territori inesplorati (Africa, Matto Grosso, deserti, Poli)

**Esperto di caccia grossa**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Armi da fuoco | Percezione | Furtività | Lingua Straniera | Sopravvivenza | Seguire tracce
- **Bonus Skills**: Primo soccorso:10
- **Contacts**: Altri esperti di caccia, alta società, mercato nero
- **Description**: Guida spedizioni armate per caccia trofei esotici

**Investigatore privato**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Cercare | Seguire tracce | Percezione | Contabilità | Legge | Psicologia
- **Bonus Skills**: Raggiro:10
- **Contacts**: Polizia, avvocati, informatori, clienti vari
- **Description**: Detective privato per infedeltà, frodi, persone scomparse

**Detective dell'occulto**
- **Social Class**: Variabile
- **Required Skills**: Biblioteconomia | Occultismo | Lingue antiche | Storia | Percezione | Antropologia
- **Bonus Skills**: Medicina:10
- **Contacts**: Studiosi, società segrete, antiquari
- **Description**: Specialista in fenomeni paranormali e antichi misteri

**Cacciatore di taglie**
- **Social Class**: Working Class
- **Required Skills**: Armi da fuoco | Atletica | Seguire tracce | Intimidire | Furtività | Percezione
- **Bonus Skills**: Diritto:10
- **Contacts**: Sceriffi, criminali, informatori
- **Description**: Cattura criminali ricercati per ricompense

### Arti Creative

**Pittore/Scultore**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Arte (Pittura/Scultura) | Storia dell'arte | Percezione | Valutare | Charm | Finanza
- **Bonus Skills**: Fotografia:10
- **Contacts**: Gallerie d'arte, mecenati, altri artisti
- **Description**: Artista visivo con commissioni o vendite indipendenti

**Musicista**
- **Social Class**: Working Class - Alta Borghesia
- **Required Skills**: Musica | Recitazione | Charm | Finanza | Autorità | Percezione
- **Bonus Skills**: Lingua Straniera:10
- **Contacts**: Teatri, aristocrazia, impresari
- **Description**: Compositore, concertista o musicista di ensemble

**Scrittore**
- **Social Class**: Middle Class
- **Required Skills**: Biblioteconomia | Lingua propria | Storia | Percezione | Charm | Finanza
- **Bonus Skills**: Psicologia:10
- **Contacts**: Editori, giornalisti, altri scrittori
- **Description**: Autore di romanzi, saggi, articoli o poesie

**Architetto**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Matematica | Arte (Disegno) | Riparazione meccanica | Valutare | Finanza | Autorità
- **Bonus Skills**: Geologia:10
- **Contacts**: Costruttori, alta società, ingegneri
- **Description**: Progettista di edifici e spazi urbani

**Fotografo**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Fotografia | Arte (Composizione) | Chimica | Riparazione meccanica | Valutare | Persuasione
- **Bonus Skills**: Raggiro:10
- **Contacts**: Giornali, famiglie facoltose, studi fotografici
- **Description**: Fotografia artistica, ritrattistica o documentaristica

**Falsario**
- **Social Class**: Criminale
- **Required Skills**: Falsificare | Arte | Valutare | Chimica | Storia dell'arte | Percezione
- **Bonus Skills**: Raggiro:10
- **Contacts**: Mercato nero, collezionisti, truffatori
- **Description**: Crea falsi documenti, opere d'arte o monete

### Artisti di Spettacolo

**Attore/Attrice**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Recitazione | Charm | Camuffarsi | Danza | Musica | Persuasione
- **Bonus Skills**: Psicologia:10
- **Contacts**: Teatri, impresari, alta società
- **Description**: Performer teatrale o di varietà

**Ballerino/Ballerina**
- **Social Class**: Working Class
- **Required Skills**: Danza | Atletica | Charm | Musica | Recitazione | Percezione
- **Bonus Skills**: Primo soccorso:10
- **Contacts**: Teatri, music hall, aristocrazia
- **Description**: Danzatore classico o di varietà

### Sport

**Pugile**
- **Social Class**: Working Class
- **Required Skills**: Lotta | Atletica | Schivare | Intimidire | Psicologia | Percezione
- **Bonus Skills**: Primo soccorso:10
- **Contacts**: Promoter, scommettitori, medici
- **Description**: Combattente professionista nei ring vittoriani

**Fantino**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Guidare | Atletica | Percezione | Charm | Finanza | Valutare (cavalli)
- **Bonus Skills**: Veterinaria:10
- **Contacts**: Scuderie, aristocrazia, scommettitori
- **Description**: Cavaliere professionista in corse ippiche

### Affari

**Commerciante**
- **Social Class**: Middle Class
- **Required Skills**: Persuasione | Contabilità | Finanza | Valutare | Lingua Straniera | Navigare
- **Bonus Skills**: Raggiro:10
- **Contacts**: Fornitori, clienti, banche
- **Description**: Mercante di beni con negozio o commercio all'ingrosso

**Industriale**
- **Social Class**: Alta Borghesia - Aristocrazia
- **Required Skills**: Contabilità | Finanza | Autorità | Persuasione | Legge | Riparazione meccanica
- **Bonus Skills**: Chimica:10
- **Contacts**: Banche, politici, operai, fornitori
- **Description**: Proprietario di fabbriche o grandi imprese

**Banchiere**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Contabilità | Finanza | Persuasione | Matematica | Legge | Valutare
- **Bonus Skills**: Psicologia:10
- **Contacts**: Alta società, imprenditori, politici
- **Description**: Gestore di istituto di credito o investimenti

**Agente di cambio**
- **Social Class**: Middle Class
- **Required Skills**: Finanza | Matematica | Contabilità | Persuasione | Psicologia | Percezione
- **Bonus Skills**: Legge:10
- **Contacts**: Investitori, imprese, banche
- **Description**: Broker di titoli e azioni alla Borsa

**Orefice**
- **Social Class**: Middle Class
- **Required Skills**: Artigianato | Valutare | Arte | Chimica | Finanza | Percezione
- **Bonus Skills**: Geologia:10
- **Contacts**: Gioiellieri, aristocrazia, banche
- **Description**: Artigiano di gioielli e metalli preziosi

**Albergatore/Locandiere**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Contabilità | Persuasione | Psicologia | Cercare | Autorità | Finanza
- **Bonus Skills**: Raggiro:10
- **Contacts**: Viaggiatori, locali, fornitori
- **Description**: Gestore di albergo, locanda o pub

**Assicuratore**
- **Social Class**: Middle Class
- **Required Skills**: Contabilità | Finanza | Matematica | Persuasione | Legge | Valutare
- **Bonus Skills**: Medicina:10
- **Contacts**: Clienti, avvocati, medici
- **Description**: Agente assicurativo su vita, proprietà o navi

**Farmacista**
- **Social Class**: Middle Class
- **Required Skills**: Chimica | Farmacologia | Contabilità | Finanza | Medicina | Biologia
- **Bonus Skills**: Botanica:10
- **Contacts**: Medici, clienti, fornitori chimici
- **Description**: Preparatore e venditore di farmaci e rimedi

### Religiosi

**Sacerdote**
- **Social Class**: Middle Class
- **Required Skills**: Storia | Lingua (Latina) | Persuasione | Psicologia | Biblioteconomia | Autorità
- **Bonus Skills**: Medicina:10
- **Contacts**: Parrocchiani, chiesa, comunità
- **Description**: Ministro religioso anglicano o cattolico

**Monaco/Monaca**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Lingua (Latina) | Storia | Biblioteconomia | Medicina | Primo soccorso | Agricoltura
- **Bonus Skills**: Farmacologia:10
- **Contacts**: Comunità monastica, chiesa
- **Description**: Religioso in ordine contemplativo o attivo

**Teologo**
- **Social Class**: Middle Class
- **Required Skills**: Storia | Biblioteconomia | Lingua (Latina) | Lingua (Greco) | Filosofia | Persuasione
- **Bonus Skills**: Antropologia:10
- **Contacts**: Università, chiesa, studiosi
- **Description**: Studioso di dottrine religiose

### Criminali

**Ladro**
- **Social Class**: Criminale
- **Required Skills**: Scassinare | Furtività | Camuffarsi | Percezione | Atletica | Raggiro
- **Bonus Skills**: Cercare:10
- **Contacts**: Ricettatori, altri criminali, informatori
- **Description**: Scassinatore professionista

**Truffatore**
- **Social Class**: Variabile (assume identità)
- **Required Skills**: Raggiro | Persuasione | Camuffarsi | Psicologia | Recitazione | Finanza
- **Bonus Skills**: Contabilità:10
- **Contacts**: Vittime, complici, rete criminale
- **Description**: Con artist specializzato in inganni elaborati

**Contrabbandiere**
- **Social Class**: Working Class - Criminale
- **Required Skills**: Navigare | Furtività | Percezione | Raggiro | Finanza | Autorità
- **Bonus Skills**: Guidare:10
- **Contacts**: Mercato nero, doganieri corrotti, clienti
- **Description**: Trasportatore illegale di beni proibiti

**Falsario di documenti**
- **Social Class**: Criminale
- **Required Skills**: Falsificare | Camuffarsi | Raggiro | Chimica | Arte | Percezione
- **Bonus Skills**: Legge:10
- **Contacts**: Criminali, falsari, mercato nero
- **Description**: Specialista in documenti falsi (passaporti, titoli, atti)

**Ricettatore**
- **Social Class**: Working Class - Criminale
- **Required Skills**: Valutare | Finanza | Persuasione | Raggiro | Psicologia | Percezione
- **Bonus Skills**: Intimidire:10
- **Contacts**: Ladri, mercato nero, acquirenti
- **Description**: Compratore e rivenditore di beni rubati

**Borseggiatore**
- **Social Class**: Criminale
- **Required Skills**: Furtività | Percezione | Camuffarsi | Raggiro | Atletica | Psicologia
- **Bonus Skills**: Scassinare:10
- **Contacts**: Gang, informatori, ricettatori
- **Description**: Pickpocket specializzato in folle

### Giornalismo

**Giornalista**
- **Social Class**: Middle Class
- **Required Skills**: Persuasione | Biblioteconomia | Lingua propria | Storia | Psicologia | Percezione
- **Bonus Skills**: Raggiro:10
- **Contacts**: Fonti, redattori, politici, polizia
- **Description**: Reporter per quotidiani o riviste

**Fotoreporter**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Fotografia | Percezione | Persuasione | Chimica | Atletica | Camuffarsi
- **Bonus Skills**: Lingua Straniera:10
- **Contacts**: Giornali, fotografi, informatori
- **Description**: Fotografo giornalistico documentaristico

### Lavoro Rurale

**Agricoltore**
- **Social Class**: Working Class
- **Required Skills**: Agricoltura | Riparazione meccanica | Guidare (animali) | Percezione | Primo soccorso | Sopravvivenza
- **Bonus Skills**: Botanica:10
- **Contacts**: Mercati, proprietari terrieri, veterinari
- **Description**: Contadino o mezzadro

**Pastore**
- **Social Class**: Working Class
- **Required Skills**: Sopravvivenza | Percezione | Primo soccorso | Seguire tracce | Guidare (animali) | Atletica
- **Bonus Skills**: Veterinaria:10
- **Contacts**: Mercati, proprietari, veterinari
- **Description**: Custode di greggi ovine o bovine

**Boscaiolo**
- **Social Class**: Working Class
- **Required Skills**: Atletica | Riparazione meccanica | Sopravvivenza | Percezione | Primo soccorso | Orientamento
- **Bonus Skills**: Botanica:10
- **Contacts**: Segherie, mercanti legname
- **Description**: Tagliaboschi per legname commerciale

### Lavoro Urbano

**Operaio**
- **Social Class**: Working Class
- **Required Skills**: Riparazione meccanica | Atletica | Intimidire | Primo soccorso | Percezione | Artigianato
- **Bonus Skills**: Elettricità:10
- **Contacts**: Sindacati, fabbriche, capisquadra
- **Description**: Lavoratore di fabbrica o cantiere

**Facchino/Scaricatore**
- **Social Class**: Working Class
- **Required Skills**: Atletica | Percezione | Orientamento | Guidare | Primo soccorso | Intimidire
- **Bonus Skills**: Raggiro:10
- **Contacts**: Datori lavoro, altri facchini, doganieri
- **Description**: Trasportatore merci nei porti o stazioni

**Cocchiere**
- **Social Class**: Working Class
- **Required Skills**: Guidare (carrozza) | Percezione | Orientamento | Atletica | Riparazione meccanica | Primo soccorso
- **Bonus Skills**: Veterinaria:10
- **Contacts**: Datori lavoro, scuderie, passaggieri
- **Description**: Conducente di carrozze pubbliche o private

**Domestico/Cameriere**
- **Social Class**: Working Class
- **Required Skills**: Etichetta vittoriana | Psicologia | Percezione | Camuffarsi | Primo soccorso | Charm
- **Bonus Skills**: Raggiro:10
- **Contacts**: Datori lavoro, altri domestici, fornitori
- **Description**: Servitore in casa aristocratica o hotel

**Sarto/Sarta**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Artigianato | Valutare | Arte | Charm | Finanza | Persuasione
- **Bonus Skills**: Etichetta:10
- **Contacts**: Clienti, mercanti tessuti, alta società
- **Description**: Creatore di abiti su misura

### Tutori dell'Ordine

**Poliziotto**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Armi da fuoco | Lotta | Percezione | Cercare | Legge | Intimidire
- **Bonus Skills**: Primo soccorso:10
- **Contacts**: Scotland Yard, informatori, magistrati
- **Description**: Bobby di Scotland Yard o polizia locale

**Detective di polizia**
- **Social Class**: Middle Class
- **Required Skills**: Percezione | Cercare | Seguire tracce | Psicologia | Legge | Persuasione
- **Bonus Skills**: Fotografia:10
- **Contacts**: Polizia, informatori, medici legali
- **Description**: Investigatore criminale di Scotland Yard

**Guardia carceraria**
- **Social Class**: Working Class
- **Required Skills**: Intimidire | Lotta | Percezione | Psicologia | Cercare | Primo soccorso
- **Bonus Skills**: Legge:10
- **Contacts**: Prigioni, magistrati, detenuti
- **Description**: Custode di prigioni vittoriane

**Guardia giurata privata**
- **Social Class**: Working Class
- **Required Skills**: Percezione | Armi da fuoco | Lotta | Intimidire | Atletica | Cercare
- **Bonus Skills**: Primo soccorso:10
- **Contacts**: Datori lavoro, polizia, criminali
- **Description**: Guardia di sicurezza per proprietà private

### Professione Legale

**Avvocato**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Legge | Persuasione | Biblioteconomia | Lingua (Latina) | Psicologia | Autorità
- **Bonus Skills**: Contabilità:10
- **Contacts**: Magistrati, clienti, polizia
- **Description**: Solicitor o barrister per difesa/accusa

**Giudice**
- **Social Class**: Alta Borghesia
- **Required Skills**: Legge | Autorità | Psicologia | Storia | Biblioteconomia | Percezione
- **Bonus Skills**: Medicina legale:10
- **Contacts**: Avvocati, polizia, alta società
- **Description**: Magistrato delle corti britanniche

### Operatori Sanitari

**Medico**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Medicina | Lingua (Latina) | Primo soccorso | Psicologia | Biologia | Chimica
- **Bonus Skills**: Antropologia:10, Farmacologia:10
- **Contacts**: Pazienti, ospedali, farmacisti
- **Description**: Medico generico o specialista

**Chirurgo**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Medicina | Primo soccorso | Anatomia | Chimica | Percezione | Psicologia
- **Bonus Skills**: Farmacologia:10, Biologia:10
- **Contacts**: Ospedali, medici, pazienti
- **Description**: Chirurgo ospedaliero o militare

**Infermiere/Infermiera**
- **Social Class**: Working Class - Middle Class
- **Required Skills**: Primo soccorso | Medicina | Psicologia | Percezione | Farmacologia | Charm
- **Bonus Skills**: Biologia:10
- **Contacts**: Ospedali, medici, pazienti
- **Description**: Assistenza sanitaria ospedaliera o domiciliare

**Medico legale**
- **Social Class**: Middle Class
- **Required Skills**: Medicina | Anatomia | Chimica | Biologia | Percezione | Legge
- **Bonus Skills**: Fotografia:10
- **Contacts**: Polizia, magistrati, ospedali
- **Description**: Esperto di cause di morte e autopsie

**Veterinario**
- **Social Class**: Middle Class
- **Required Skills**: Medicina veterinaria | Biologia | Chimica | Farmacologia | Percezione | Psicologia (animali)
- **Bonus Skills**: Agricoltura:10
- **Contacts**: Allevatori, scuderie, agricoltori
- **Description**: Medico per animali domestici e da fattoria

### Salute Mentale

**Psichiatra**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Psicologia | Medicina | Farmacologia | Persuasione | Percezione | Psichiatria
- **Bonus Skills**: Antropologia:10
- **Contacts**: Pazienti, ospedali, medici
- **Description**: Specialista in disturbi mentali

**Alienista**
- **Social Class**: Middle Class
- **Required Skills**: Psicologia | Medicina | Percezione | Autorità | Legge | Chimica
- **Bonus Skills**: Antropologia:10
- **Contacts**: Manicomi, tribunali, polizia
- **Description**: Medico di asylum per malattie mentali

### Forze Armate

**Soldato**
- **Social Class**: Working Class
- **Required Skills**: Armi da fuoco | Lotta | Atletica | Primo soccorso | Percezione | Sopravvivenza
- **Bonus Skills**: Intimidire:10
- **Contacts**: Reggimento, compagni, veterani
- **Description**: Soldato semplice dell'esercito britannico

**Ufficiale**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Armi da fuoco | Autorità | Tattica militare | Persuasione | Atletica | Storia militare
- **Bonus Skills**: Lingue Straniere:10
- **Contacts**: Altri ufficiali, truppe, War Office
- **Description**: Ufficiale dell'esercito (tenente+)

**Marinaio**
- **Social Class**: Working Class
- **Required Skills**: Navigare | Atletica | Lotta | Primo soccorso | Percezione | Riparazione meccanica
- **Bonus Skills**: Nuotare:10
- **Contacts**: Marina, compagni, porti
- **Description**: Marinaio della Royal Navy o mercantile

**Ufficiale di Marina**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Navigare | Autorità | Tattica navale | Matematica | Astronomia | Persuasione
- **Bonus Skills**: Lingue Straniere:10
- **Contacts**: Admiralty, altri ufficiali, marina
- **Description**: Ufficiale della Royal Navy

### Politica

**Politico**
- **Social Class**: Alta Borghesia - Aristocrazia
- **Required Skills**: Persuasione | Autorità | Storia | Legge | Psicologia | Charm
- **Bonus Skills**: Contabilità:10
- **Contacts**: Parlamentari, elettori, stampa
- **Description**: Membro del Parlamento o governo

**Diplomatico**
- **Social Class**: Alta Borghesia - Aristocrazia
- **Required Skills**: Lingua Straniera | Lingua Straniera | Persuasione | Psicologia | Storia | Autorità
- **Bonus Skills**: Etichetta:10, Charm:10
- **Contacts**: Governi, diplomatici, alta società
- **Description**: Rappresentante diplomatico britannico

### Studiosi

**Professore universitario**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: [Materia] | Storia | Biblioteconomia | Persuasione | Lingua (Latina) | Psicologia
- **Bonus Skills**: Scienza:10
- **Contacts**: Università, studenti, accademici
- **Description**: Docente universitario in discipline accademiche

**Archeologo**
- **Social Class**: Middle Class
- **Required Skills**: Archeologia | Storia | Lingua antica | Percezione | Valutare | Atletica
- **Bonus Skills**: Geologia:10
- **Contacts**: Musei, mecenati, università
- **Description**: Scavatore e studioso di antiche civiltà

**Bibliotecario**
- **Social Class**: Middle Class
- **Required Skills**: Biblioteconomia | Lingua (Latina) | Storia | Percezione | Contabilità | Persuasione
- **Bonus Skills**: Lingua Straniera:10
- **Contacts**: Studiosi, università, musei
- **Description**: Custode e organizzatore di biblioteche

**Naturalista**
- **Social Class**: Middle Class
- **Required Skills**: Biologia | Botanica | Zoologia | Percezione | Arte (Disegno) | Sopravvivenza
- **Bonus Skills**: Chimica:10
- **Contacts**: Università, società scientifiche, mecenati
- **Description**: Studioso di flora e fauna

**Ingegnere**
- **Social Class**: Middle Class - Alta Borghesia
- **Required Skills**: Matematica | Riparazione meccanica | Fisica | Chimica | Arte (Disegno tecnico) | Finanza
- **Bonus Skills**: Elettricità:10
- **Contacts**: Industrie, università, War Office
- **Description**: Ingegnere civile, meccanico o elettrico

**Chimico**
- **Social Class**: Middle Class
- **Required Skills**: Chimica | Farmacologia | Matematica | Percezione | Biologia | Fisica
- **Bonus Skills**: Medicina:10
- **Contacts**: Università, industrie, ospedali
- **Description**: Ricercatore chimico o consulente industriale

**Matematico**
- **Social Class**: Middle Class
- **Required Skills**: Matematica | Fisica | Astronomia | Biblioteconomia | Logica | Percezione
- **Bonus Skills**: Filosofia:10
- **Contacts**: Università, Royal Society, industrie
- **Description**: Matematico teorico o applicato

### Professioni Varie

**Dilettante**
- **Social Class**: Alta Borghesia - Aristocrazia
- **Required Skills**: [Scelta libera 6 skills]
- **Bonus Skills**: Charm:10, Finanza:10
- **Contacts**: Alta società, club esclusivi
- **Description**: Gentiluomo/gentildonna di ricchezza ereditata

**Occultista**
- **Social Class**: Variabile
- **Required Skills**: Occultismo | Biblioteconomia | Lingue antiche | Storia | Percezione | Antropologia
- **Bonus Skills**: Psicologia:10
- **Contacts**: Società segrete, antiquari, studiosi
- **Description**: Studioso di scienze occulte e esoterismo

**Parapsicologist**
- **Social Class**: Middle Class
- **Required Skills**: Psicologia | Occultismo | Percezione | Biblioteconomia | Persuasione | Fisica
- **Bonus Skills**: Fotografia:10
- **Contacts**: Spiritualisti, studiosi, clienti
- **Description**: Investigatore di fenomeni paranormali

**Antiquario**
- **Social Class**: Middle Class
- **Required Skills**: Valutare | Storia | Storia dell'arte | Persuasione | Finanza | Percezione
- **Bonus Skills**: Archeologia:10
- **Contacts**: Collezionisti, musei, mercanti
- **Description**: Commerciante di antichità e oggetti storici

---

## Social Class Distribution

| Social Class | Occupations | Examples |
|--------------|-------------|----------|
| Criminale | 6 | Ladro, Truffatore, Contrabbandiere, Falsario |
| Working Class | 18 | Operaio, Domestico, Soldato, Infermiere |
| Lower Middle Class | 8 | Impiegato, Commesso, Fotografo, Giornalista |
| Middle Class | 20 | Medico, Avvocato, Professore, Commerciante |
| Upper Middle Class | 10 | Industriale, Banchiere, Chirurgo, Ingegnere |
| Alta Borghesia | 5 | Politico, Diplomatico, Giudice, Arcivescovo |
| Aristocrazia | 2 | Dilettante (inherited wealth), Noble |

---

## Gender Restrictions

**Victorian Historical Accuracy**:

Alcune occupazioni storicamente limitate alle donne:
- **Solo Donne**: Governante, Cucitrice, Prostituta
- **Prevalentemente Donne**: Infermiera, Sarta, Domestica (cameriera)

Alcune occupazioni storicamente riservate agli uomini:
- **Solo Uomini**: Soldato, Sacerdote, Avvocato (fino 1919)
- **Prevalentemente Uomini**: Medico, Ingegnere, Politico

**Nota di Gioco**: TenPennyNovels permette flessibilità narrativa per storie inclusive, ma può applicare modificatori sociali (reazioni NPC, scandal risk) per fedeltà storica.

---

## Career Progression

Esempi di percorsi di carriera realistici:

**Medical Track**:
1. Studente di medicina (University)
2. Infermiere/Praticante
3. Medico generico
4. Chirurgo/Specialista
5. Professore di Medicina

**Law Enforcement Track**:
1. Bobby (Constable)
2. Sergente
3. Detective
4. Inspector
5. Superintendent

**Business Track**:
1. Impiegato/Commesso
2. Commerciante
3. Industriale
4. Banchiere
5. Magnate

**Criminal Track**:
1. Borseggiatore
2. Ladro
3. Truffatore
4. Crime Boss
5. "Respectable" Front (Antiquario, Albergatore)

---

## Related Documentation

- **Character System**: [character-system.md](../03-game-systems/character-system.md) - Occupation selection workflow
- **Skills Reference**: [skills-reference.md](./skills-reference.md) - Complete skill list
- **Call of Cthulhu Rules**: [call-of-cthulhu-rules.md](./call-of-cthulhu-rules.md) - Game mechanics
- **Experience System**: [experience-points.md](../03-game-systems/experience-points.md) - Skill advancement

---

**Data Source**: `/scripts/seeders/data/occupations.csv`
**Total Count**: 57 occupations
**Last Verified**: 2026-02-28
**Status**: ✅ Complete Victorian Era Occupations
