import { IBot, IActiveEmotion } from '../models/Bot';
import { ContextInsights } from './ContextAnalyzer';
import { describeEmotions } from './EmotionManager';

interface ActionContext {
  location: { id?: string; name: string; description?: string };
  actions: Array<{ characterId?: string; characterName: string; content: string; timestamp?: string }>;
  presentCharacters?: Array<{ id?: string; name: string }>;
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

  parts.push('\n--- REGOLE ---');
  parts.push('- Rispondi SEMPRE in italiano');
  parts.push('- Resta nel personaggio, non uscire mai dal ruolo');
  parts.push('- Usa azioni tra asterischi (*azione*) e dialoghi normali');
  parts.push('- Rispondi in UNA SOLA riga, senza andare a capo');
  parts.push('- Non fare meta-commenti, non menzionare che sei un AI');
  parts.push('- Adatta la lunghezza della risposta a quella del messaggio ricevuto');
  parts.push('- Se ti hanno fatto una domanda, rispondi a quella domanda');
  parts.push('- Se ricordi cose su questa persona, fai riferimento ai ricordi in modo naturale, senza elencarli');
  parts.push('- NON chiamare per nome una persona se non ti ha detto come si chiama o se non lo ricordi dalle memorie');

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
    const maskedPresent = context.presentCharacters.map((c) => {
      return knownNames.get(c.id || '') || 'Qualcuno';
    });
    const unique = [...new Set(maskedPresent)];
    parts.push(`[Presenti: ${unique.join(', ')}]`);
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
