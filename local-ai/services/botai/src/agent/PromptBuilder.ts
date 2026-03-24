import { IBot, IActiveEmotion } from '../models/Bot';
import { ContextInsights } from './ContextAnalyzer';
import { describeEmotions } from './EmotionManager';

interface CharacterAppearance {
  id?: string;
  name: string;
  gender?: string;
  apparentAge?: number;
  physicalDescription?: string;
  visibleMarks?: string;
  height?: string;
  eyeColor?: string;
  hairColor?: string;
}

interface ActionContext {
  location: { id?: string; name: string; description?: string };
  actions: Array<{ characterId?: string; characterName: string; content: string; timestamp?: string }>;
  presentCharacters?: Array<CharacterAppearance>;
}

export function buildSystemPrompt(
  bot: IBot,
  insights: ContextInsights,
  activeEmotions: IActiveEmotion[],
): string {
  const parts: string[] = [];

  parts.push(`Sei ${bot.name}. ${bot.systemPrompt}`);

  if (bot.gender) {
    parts.push(`\nGenere: ${bot.gender === 'male' ? 'maschio' : 'femmina'}.`);
  }
  if (bot.publicDescription) {
    parts.push(`Aspetto: ${bot.publicDescription}`);
  }

  if (bot.personality.traits.length > 0) {
    parts.push(`\nTratti: ${bot.personality.traits.join(', ')}`);
  }
  if (bot.personality.speech_style) {
    parts.push(`Stile di parlata: ${bot.personality.speech_style}`);
  }
  if (bot.personality.background) {
    parts.push(`Background: ${bot.personality.background}`);
  }
  if (bot.personality.coreValues && bot.personality.coreValues.length > 0) {
    parts.push(`Valori: ${bot.personality.coreValues.join(', ')}`);
  }

  const emotionDesc = describeEmotions(activeEmotions);
  if (emotionDesc) {
    parts.push(`\n${emotionDesc}`);
  }

  parts.push('\n--- CONTESTO DELLA SITUAZIONE ---');

  if (insights.isFirstEncounter) {
    parts.push('Uno sconosciuto ti sta parlando. Non l\'hai mai incontrato prima.');
    parts.push('Comportati come faresti con uno sconosciuto — in base al tuo carattere potresti essere diffidente, curioso, accogliente o indifferente.');
    parts.push('NON dare per scontato di conoscere il suo nome. Lo conosci SOLO se te lo dice esplicitamente nel messaggio.');
    parts.push('PRIMO INCONTRO — descrizione fisica: nella tua risposta includi almeno un dettaglio fisico su di te (aspetto, abbigliamento, gesto, postura) così che l\'altro personaggio possa vederti. Fallo in modo naturale, attraverso un\'azione o una descrizione narrativa, non come una presentazione esplicita.');
  } else {
    parts.push(`CHI E: ${insights.whoIsThis}`);
    if (insights.ourHistory) {
      parts.push(`LA VOSTRA STORIA: ${insights.ourHistory}`);
    }
    if (insights.currentRelationship) {
      parts.push(`COME TI SENTI VERSO DI LUI/LEI: ${insights.currentRelationship}`);
    }
  }

  if (insights.myCurrentState) {
    parts.push(`\nIN QUESTO MOMENTO: ${insights.myCurrentState}`);
  }

  parts.push(`\nTIPO DI MESSAGGIO: ${insights.messageAnalysis.intent} (tono: ${insights.messageAnalysis.emotionalTone})`);

  if (insights.suggestedApproach) {
    parts.push(`\nCOME REAGIRE: ${insights.suggestedApproach}`);
  }

  if (bot.narrativeStyle) {
    parts.push(`\n--- STILE NARRATIVO: ${bot.narrativeStyle.author.toUpperCase()} ---`);
    parts.push(bot.narrativeStyle.guidance);
    parts.push(`NOTA: lo stile narrativo governa la RICCHEZZA delle descrizioni e delle azioni fisiche. La voce e il carattere del personaggio (il suo tono, la sua concisione o verbosità, il suo accento) rimangono invariati. Uno stile narrativo ricco non significa che il personaggio parla diversamente — significa che le sue azioni sono descritte con più dettaglio.`);
  }

  parts.push('\n--- REGOLE ---');
  parts.push('- Rispondi SEMPRE in italiano corretto. Usa solo parole italiane esistenti. NON inventare parole, verbi o costruzioni grammaticali che non esistono.');
  parts.push('- Scrivi in modo narrativo e coinvolgente: descrivi azioni fisiche, atmosfera, dettagli sensoriali. Non limitarti al solo dialogo.');
  parts.push('- Resta nel personaggio, non uscire mai dal ruolo');
  parts.push('- Usa azioni tra asterischi (*azione*) e dialoghi normali. MAI usare parentesi quadre [*azione*]. Solo asterischi.');
  parts.push('- Rispondi in UNA SOLA riga fisica, senza MAI inserire un a capo');
  if (bot.narrativeStyle) {
    parts.push(`- LUNGHEZZA: tra 400 e 600 caratteri. Abbastanza per una scena completa e vivida, mai così lungo da diventare ripetitivo. Non ripetere lo stesso concetto due volte. Fermati quando hai detto quello che c'è da dire.`);
  } else {
    parts.push('- Adatta la lunghezza della risposta al tipo di interazione ricevuta');
  }
  parts.push('- Non fare meta-commenti, non menzionare che sei un AI');
  parts.push('- Se ti hanno fatto una domanda, rispondi a quella domanda');
  parts.push('- Se ricordi cose su questa persona, fai riferimento ai ricordi in modo naturale, senza elencarli');
  parts.push('- NON chiamare per nome una persona se non ti ha detto come si chiama o se non lo ricordi dalle memorie');
  parts.push('- Rispondi SOLO a quello che e stato effettivamente detto o fatto. Non anticipare argomenti che nessuno ha toccato. Se sei riservato/a, dimostralo con il tono e il comportamento — non dichiarandolo. Se sei diffidente, mostralo con la freddezza — non spiegandolo.');

  return parts.join('\n');
}

export function buildUserMessage(
  context: ActionContext,
  knownNames: Map<string, string>,
): string {
  const parts: string[] = [];

  parts.push(`[Luogo: ${context.location.name}]`);
  if (context.location.description) {
    parts.push(`[Descrizione: ${context.location.description}]`);
  }

  if (context.presentCharacters && context.presentCharacters.length > 0) {
    parts.push('\n[PERSONE PRESENTI — aspetto visibile]');
    for (const c of context.presentCharacters) {
      const displayName = knownNames.get(c.id || '') || 'Sconosciuto';
      const details: string[] = [];
      if (c.gender) details.push(c.gender === 'male' ? 'uomo' : c.gender === 'female' ? 'donna' : c.gender);
      if (c.apparentAge) details.push(`dimostra circa ${c.apparentAge} anni`);
      if (c.height) details.push(`altezza ${c.height}`);
      if (c.hairColor) details.push(`capelli ${c.hairColor}`);
      if (c.eyeColor) details.push(`occhi ${c.eyeColor}`);
      const summary = details.length > 0 ? ` (${details.join(', ')})` : '';
      parts.push(`- ${displayName}${summary}`);
      if (c.physicalDescription) parts.push(`  Aspetto: ${c.physicalDescription}`);
      if (c.visibleMarks) parts.push(`  Segni visibili: ${c.visibleMarks}`);
    }
  }

  const actions = context.actions.slice(-10);
  if (actions.length > 0) {
    parts.push('');
    for (const action of actions) {
      const speaker = knownNames.get(action.characterId || '') || 'Sconosciuto';
      parts.push(`${speaker}: ${action.content}`);
    }
  }

  return parts.join('\n');
}

export function maskActions(
  actions: Array<{ characterId?: string; characterName: string; content: string }>,
  knownNames: Map<string, string>,
): Array<{ speaker: string; content: string }> {
  return actions.map((a) => ({
    speaker: knownNames.get(a.characterId || '') || 'Sconosciuto',
    content: a.content,
  }));
}

export function getLastCharacterFromActions(actions: ActionContext['actions']): { characterId: string; characterName: string } {
  const last = actions[actions.length - 1];
  return {
    characterId: last?.characterId || '',
    characterName: last?.characterName || '',
  };
}
