/**
 * PromptBuilder.ts
 *
 * Centralized prompt builders for all 8 steps of character generation.
 * Keeps CharacterGenerator.ts clean and focuses on orchestration.
 */

const REFERENCE_YEAR = 1895;

// ============ STEP 1: Narrative ============
export function buildNarrativePrompt(
  character: { firstName: string; lastName: string; gender: string; description: string },
  occupations: Array<{ id: string; name: string; description?: string }>
) {
  // Derive gender from narrative context if not specified
  const genderDisplay = character.gender && character.gender !== 'not specified'
    ? character.gender
    : '[Gender to be derived from narrative]';

  const system = `Sei un esperto creatore di personaggi per un GDR ambientato nella Londra vittoriana del 1895 (sistema Call of Cthulhu).
Generi un paragrafo narrativo immersivo e affascinante che descriva il personaggio.

La narrativa deve contenere informazioni su:
- Nome e cognome: ${character.firstName} ${character.lastName}
- Genere: ${genderDisplay}
- Età (numero intero tra 18-80)
- Altezza approssimativa
- Colore degli occhi e capelli
- Descrizione fisica (aspetto, distintivi)
- Come appare agli altri (pubblico)
- Chi è veramente (privato)
- Professione/mestiere
- Stato civile

Scrivi in italiano, in terza persona, naturale e immersivo. Non essere artefatto.
Lunghezza: 400-600 parole.`;

  const user = `Nome: ${character.firstName} ${character.lastName}
Genere: ${genderDisplay}
Descrizione: ${character.description}

Crea la narrazione di questo personaggio.`;

  return { system, user };
}

// ============ STEP 2: Basic Info ============
export function buildBasicInfoPrompt(
  narrativeText: string
) {
  const system = `Leggi la narrazione del personaggio e estrai le seguenti informazioni in formato MARKDOWN (una per riga, formato "campo: valore").
Se un'informazione non è esplicita nel testo, usa un valore ragionevole dedotto dal contesto. Tutte le stringhe devono essere in italiano.
NON includere backticks, NON includere JSON, rispondi SOLO in markdown semplice formato "campo: valore".

IMPORTANTE:
- La data di nascita deve essere coerente con l'età nel 1895. Se età è 42, la data deve essere 1895-42=1853 (più giorno e mese casuali, non sempre 01-01).
- eyeColor e hairColor: SOLO il colore vero (marrone, blu, verde, grigio, nero, castano, etc), NON descrizioni come "acuto" o "penetrante"
- gender: DEVE essere uno tra "male" o "female", basato su pronomi e contesto della narrativa
- birthPlace: città/paese di nascita coerente con l'ambientazione vittoriana (Londra e dintorni, provincia inglese, colonie, Europa)
- pathologies: patologie croniche o disturbi di salute. Se il personaggio è sano scrivi "nessuna"`;

  const user = `Narrazione:\n${narrativeText}\n\nEstrazioni richieste (formato markdown, SOLO QUESTI CAMPI):\nfirstName: [nome]\nlastName: [cognome]\ngender: [male or female, dedotto dalla narrativa]\nbirthDate: [YYYY-MM-DD, calcolato come ${REFERENCE_YEAR} - age, con mese/giorno random]\nbirthPlace: [città o paese di nascita]\nage: [numero intero]\napparentAge: [numero intero, simile all'age ±5 anni]\nheight: [numero in cm]\nweight: [numero in kg]\neyeColor: [SOLO colore esatto: marrone, blu, verde, grigio, nero, castano, nocciola, ambra, etc]\nhairColor: [SOLO colore esatto: nero, marrone, castano, biondo, rosso, grigio, biancoperla, etc]\nmaritalStatus: [uno tra: celibe, nubile, coniugato, coniugata, divorziato, divorziata, vedovo, vedova]\neducationTitle: [titolo studio o "nessuno"]\ncriminalRecord: [descrizione o "no"]\npathologies: [patologie croniche o "nessuna"]\ncurrentOccupation: [professione]`;

  return { system, user };
}

// ============ STEP 3: Occupation ============
export function buildOccupationPrompt(
  character: { firstName: string; lastName: string; narrativeText: string; basicInfo: Record<string, any> },
  occupations: Array<{ id: string; name: string; description?: string; category?: string }>
) {
  const occupationList = occupations
    .map(o => `- ${o.name}`)
    .join('\n');

  const system = `Sei un maestro di gioco per un GDR ambientato nella Londra vittoriana del 1895.
Basandoti sulla narrativa e il background del personaggio, scegli l'occupazione/mestiere PIÙ ADATTA dalla lista fornita.

CRITICO: La tua risposta DEVE essere ESATTAMENTE UNO dei nomi dalla lista fornita.
Non inventare occupazioni, non modificare i nomi.
Rispondi con SOLO il nome dell'occupazione, nient'altro.

Esempi di risposte corrette:
- Medico
- Consulente investigativo
- Scrittore
- Investigatore`;

  const user = `Personaggio: ${character.firstName} ${character.lastName}

Narrativa: ${character.narrativeText}

Background: Età ${character.basicInfo.age}, ${character.basicInfo.currentOccupation || 'senza mestiere specifico'}, ${character.basicInfo.maritalStatus || 'stato civile sconosciuto'}

Occupazioni disponibili (scegli ESATTAMENTE una di queste):
${occupationList}

DEVE cambiare mestiere, quale occupazione è PIÙ ADATTA tra quelle disponibili, in base al suo pregresso lavorativo? Rispondi con SOLO il nome esatto, senza spiegazioni.`;

  return { system, user };
}

// ============ STEP 4: Background ============
export function buildBackgroundPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  basicInfo: Record<string, any>
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Generi il background completo di un personaggio per un GDR ambientato a Londra, 1895.

Scrivi in italiano, naturale e immersivo. Ogni sezione deve essere un paragrafo o più, coerente con il personaggio e la sua narrativa.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}, ${basicInfo.age} anni, ${basicInfo.selectedOccupation?.occupationName || basicInfo.currentOccupation}

Narrativa precedente: ${narrativeText}

Generi esattamente questi campi (separati da una riga vuota per chiarezza):

STORIA IN BREVE:
[racconta origine, educazione, momenti di svolta, scelte di vita, 200-300 parole]

FATTI SALIENTI:
[successi, fallimenti, lutti, incontri, scandali chiave che hanno segnato la vita]

RELAZIONI IMPORTANTI:
[famiglia, amici, mentori, rivali, nemici con descrizione dei legami]

PERSONALITÀ:
[tratti dominanti, atteggiamento, abitudini, contraddizioni, ossessioni]

IDEOLOGIA/CREDO:
[valori morali, religione, filosofia, visione del mondo]`;

  return { system, user };
}

// ============ STEP 4.1: Brief History ============
export function buildBriefHistoryPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  basicInfo: Record<string, any>
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Generi la STORIA IN BREVE di un personaggio per un GDR ambientato a Londra, 1895.
Scrivi in italiano, naturale e immersivo.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}, ${basicInfo.age} anni, ${basicInfo.selectedOccupation?.occupationName || basicInfo.currentOccupation}

Narrativa: ${narrativeText}

Scrivi la storia in breve di questo personaggio: racconta origine, educazione, momenti di svolta, scelte di vita importanti.
Circa 250-350 parole.`;

  return { system, user };
}

// ============ STEP 4.2: Significant Events ============
export function buildSignificantEventsPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Descrivi i FATTI SALIENTI di un personaggio per un GDR.
Scrivi in italiano, naturale e sintetico.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia in breve: ${briefHistory}

Elenca i fatti salienti (successi, fallimenti, lutti, incontri, scandali chiave) che hanno segnato la vita di questo personaggio.
Formato: lista di punti concisi, ognuno con 1-2 righe.`;

  return { system, user };
}

// ============ STEP 4.3: Important Relationships ============
export function buildImportantRelationshipsPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Descrivi le RELAZIONI IMPORTANTI di un personaggio per un GDR.
Scrivi in italiano, naturale e descrittivo.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia: ${briefHistory}

Descrivi le relazioni importanti di questo personaggio: famiglia, amici, mentori, rivali, nemici. Per ogni relazione, spiega il legame e la sua importanza.
Formato: nome/ruolo e descrizione del legame.`;

  return { system, user };
}

// ============ STEP 4.4: Personality ============
export function buildPersonalityPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Descrivi la PERSONALITÀ di un personaggio per un GDR.
Scrivi in italiano, naturale e psicologico.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia: ${briefHistory}

Descrivi la personalità di questo personaggio: tratti dominanti, atteggiamento verso il mondo, abitudini, contraddizioni interne, ossessioni.
Circa 200-300 parole.`;

  return { system, user };
}

// ============ STEP 4.5: Ideology ============
export function buildIdeologyPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Descrivi l'IDEOLOGIA/CREDO di un personaggio per un GDR.
Scrivi in italiano, naturale e filosofico.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia: ${briefHistory}

Descrivi l'ideologia e il credo di questo personaggio: valori morali, religione, filosofia di vita, visione del mondo, cosa ritiene giusto e sbagliato.
Circa 200-300 parole.`;

  return { system, user };
}

// ============ STEP 4.6: Significant Places ============
export function buildSignificantPlacesPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Descrivi i LUOGHI SIGNIFICATIVI di un personaggio per un GDR.
Scrivi in italiano, naturale e descrittivo.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia: ${briefHistory}

Descrivi i luoghi significativi per questo personaggio: dove è cresciuto, dove lavora, café preferiti, rifugi segreti, posti che lo ricordano di momenti importanti della sua vita.
Circa 150-250 parole.`;

  return { system, user };
}

// ============ STEP 4.7: Fears and Phobias ============
export function buildFearsAndPhobiasPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di psicologia vittoriana. Descrivi le PAURE E FOBIE di un personaggio per un GDR.
Scrivi in italiano, naturale e psicologico. Questo è PRIVATO - visibile solo al proprietario/master.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia: ${briefHistory}

Descrivi le paure e fobie di questo personaggio: cosa lo terrorizza, cosa lo destabilizza emotivamente, quale traumatico evento ha lasciato cicatrici psicologiche.
Circa 150-250 parole.`;

  return { system, user };
}

// ============ STEP 4.8: Secrets ============
export function buildSecretsPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani con segreti oscuri. Descrivi i SEGRETI di un personaggio per un GDR.
Scrivi in italiano, naturale e misterioso. Questo è PRIVATO - visibile solo al proprietario/master.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia: ${briefHistory}

Descrivi i segreti di questo personaggio: cosa nasconde agli altri, quali bugie mantiene, cosa lo ricatterebbe se scoperto, quale verità non potrebbe mai rivelare senza conseguenze.
Circa 150-250 parole.`;

  return { system, user };
}

// ============ STEP 4.9: Goals and Motivations ============
export function buildGoalsAndMotivationsPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  briefHistory: string
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani con motivazioni complesse. Descrivi gli OBIETTIVI E MOTIVAZIONI di un personaggio per un GDR.
Scrivi in italiano, naturale e interiore.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}

Narrativa: ${narrativeText}

Storia: ${briefHistory}

Descrivi gli obiettivi e le motivazioni di questo personaggio: cosa lo guida, quali sono i suoi scopi a breve e lungo termine, cosa lo farebbe rischiare tutto, quale è il suo sogno più profondo.
Circa 150-250 parole.`;

  return { system, user };
}

// ============ STEP 4.10: Descriptions & Marks ============
export function buildDescriptionsAndMarksPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  basicInfo: Record<string, any>
) {
  const system = `Sei uno scrittore esperto di personaggi vittoriani. Crea descrizioni dettagliate di un personaggio per un GDR.
Scrivi in italiano, naturale e visivo.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}, ${basicInfo.age} anni, ${basicInfo.eyeColor} occhi, ${basicInfo.hairColor} capelli

Narrativa: ${narrativeText}

Generi cinque descrizioni dettagliate (separate da una riga vuota, mantenendo ESATTAMENTE le intestazioni indicate):

DESCRIZIONE FISICA:
Descrivi l'aspetto fisico del personaggio in dettaglio: postura, modo di muoversi, abbigliamento tipico, particolarità. 150-200 parole.

DESCRIZIONE PUBBLICA:
Come appare il personaggio agli occhi degli altri: la reputazione, il ruolo sociale, l'impressione che dà a chi lo incontra. Solo ciò che è di dominio pubblico. 150-200 parole.

DESCRIZIONE PRIVATA:
Chi è veramente il personaggio dietro la facciata: pensieri intimi, contraddizioni, ciò che nasconde al mondo. Visibile solo al proprietario e al master. 150-200 parole.

MARCHI VISIBILI:
Cicatrici, tatuaggi, segni particolari visibili a chiunque. Descrivi dove sono e come si sono formati. Se non ce ne sono, scrivi "Nessuno". Massimo 100 parole.

MARCHI NASCOSTI:
Cicatrici nascoste, segni di battaglia, particolarità che solo intimi conoscono. Descrivi dove sono e la storia dietro. Se non ce ne sono, scrivi "Nessuno". Massimo 100 parole.`;

  return { system, user };
}

// ============ STEP 5: Skills ============
export function buildSkillsPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  availableSkillsList: string
) {
  const system = 'Estrai le skill del personaggio dalla narrativa. Usa SOLO i nomi delle skill dalla lista fornita, e il valore che gli hai assegnato. Rispondi in formato markdown semplice.';

  const user = `Personaggio: ${characterFirstName} ${characterLastName}\n\nNarrativa: ${narrativeText}\n\nSkill disponibili: ${availableSkillsList}\n\nFormato richiesto:\n- skillName (total value)\n\nEsempio:\n- Firearms (20)\n- Investigation (10)\n- Psychology (15)`;

  return { system, user };
}

// ============ STEP 6: Stats Allocation (Narrative-Driven) ============
export function buildStatsAllocationPrompt(
  characterFirstName: string,
  characterLastName: string,
  narrativeText: string,
  basicInfo: Record<string, any>
) {
  const system = `Sei un master di gioco esperto di Call of Cthulhu. Analizzi la narrativa e la descrizione fisica di un personaggio per allocare statistiche coerenti con la sua descrizione.

IMPORTANTE: Le statistiche devono RISPECCHIARE la narrativa. Esempi:
- Se il personaggio è "forte e muscoloso" → Forza ALTA (65+)
- Se è "gracile o fragile" → Forza BASSA (30-45)
- Se è "intelligente e colto" → Intelligenza ALTA (60+)
- Se è "semplice" → Intelligenza BASSA (40-50)
- Se è "carismatico e affascinante" → Carisma ALTO (60+)
- Se è "sgradevole" → Carisma BASSO (35-50)
- Altezza → Taglia (più alto = Taglia più alta)

Rispondi SOLO in formato markdown "campo: valore", una riga per statistica.`;

  const user = `Personaggio: ${characterFirstName} ${characterLastName}, ${basicInfo.age} anni
Altezza: ${basicInfo.height}cm
Peso: ${basicInfo.weight}kg
Colore occhi: ${basicInfo.eyeColor}
Colore capelli: ${basicInfo.hairColor}

Narrativa (descrizione FISICA e MENTALE):
${narrativeText}

Alloca queste statistiche (0-100 scala, valori realistici 30-80):
strength: [valore basato su forza fisica descritta]
dexterity: [valore basato su agilità/coordinazione descritta]
intelligence: [valore basato su intelligenza/coltura descritta]
constitution: [valore basato su resistenza/salute descritta]
appearance: [valore basato su fascino/carisma descritto]
size: [valore basato su altezza/corporatura descritta]
power: [valore basato su forza di volontà/intuito descritto]
education: [valore basato su educazione formale descritta]

Spiega brevemente il PERCHÉ di ogni allocazione (max 10 parole per stat).`;

  return { system, user };
}
