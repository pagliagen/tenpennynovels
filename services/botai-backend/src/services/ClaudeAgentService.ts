import { claudeConfig } from '../config/claude';
import { botMemoryService } from './BotMemoryService';
import { relationshipService } from './RelationshipService';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export interface BotContext {
  bot: any;
  locationContext: any;
  triggeringAction: any;
  recentMemories: any[];
  relationships: any[];
  recentActionsByCharacter?: any[]; // Recent actions grouped by character
  sessionHistory?: any[]; // Full session history
  averagePlayerActionLength?: number; // Average length of recent player actions
  multiTagActions?: Array<{  // Multi-tag context for AI-driven bots
    tag: string;
    actions: any[];
    isPrimaryTag: boolean; // true for bot's assigned tag
  }>;
  isFirstEncounter?: boolean; // True if this is the first interaction with the triggering character
}

export class ClaudeAgentService {
  /**
   * Generate bot response using Claude SDK
   */
  async generateBotResponse(context: BotContext): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userMessage = this.buildUserMessage(context);

      logger.debug('[ClaudeAgent] Generating response with context:', {
        botId: context.bot._id,
        locationId: context.locationContext.locationId,
        actionId: context.triggeringAction.actionId
      });

      const client = claudeConfig.getClient();
      const model = claudeConfig.getModel();

      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        temperature: 0.8, // Some creativity for natural conversation
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        let generatedText = content.text.trim();

        // ===== ENFORCE SINGLE-LINE FORMAT =====
        // Replace all newlines and multiple spaces with single space
        generatedText = generatedText
          .replace(/\r?\n/g, ' ')  // Replace newlines with space
          .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
          .trim();
        // ===== END SINGLE-LINE ENFORCEMENT =====

        logger.info(`[ClaudeAgent] Generated response for bot ${context.bot.name}`, {
          length: generatedText.length,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens
        });

        return generatedText;
      }

      throw new Error('Unexpected response type from Claude');

    } catch (error: any) {
      logger.error('[ClaudeAgent] Error generating bot response:', error);
      throw error;
    }
  }

  /**
   * Build system prompt with bot personality and context
   */
  private buildSystemPrompt(context: BotContext): string {
    const { bot, recentMemories, relationships, sessionHistory, averagePlayerActionLength, isFirstEncounter, triggeringAction } = context;

    let prompt = `Sei ${bot.name}${bot.surname ? ' ' + bot.surname : ''}, un personaggio non giocante in un gioco di ruolo ambientato nell'epoca vittoriana a Londra (fine 1800).

IDENTITÀ:
- Tu sei ${bot.gender === 'female' ? 'una donna' : 'un uomo'}
- Quando parli di te stess${bot.gender === 'female' ? 'a' : 'o'}, usa sempre i pronomi e le forme grammaticali ${bot.gender === 'female' ? 'femminili' : 'maschili'}
- Esempi: ${bot.gender === 'female' ? '"Sono felice", "Sono andata", "Sono una donna"' : '"Sono felice", "Sono andato", "Sono un uomo"'}${bot.publicDescription ? `\n- ASPETTO FISICO: ${bot.publicDescription}` : ''}`;

    // ===== PSYCHOLOGICAL AXES =====
    if (bot.psychologicalAxes) {
      prompt += `\n\n## ASSI PSICOLOGICI
I tuoi tratti profondi che governano le tue reazioni istintive:
${this.formatPsychologicalAxes(bot.psychologicalAxes)}

Questi assi definiscono come reagisci naturalmente. Rispetta sempre queste tendenze nelle tue risposte.`;

      // Add behavioral instructions based on axes
      prompt += this.buildPsychologyInstructions(bot.psychologicalAxes);
    }
    // ===== END PSYCHOLOGICAL AXES =====

    // ===== CENTRAL WOUND =====
    if (bot.centralWound) {
      prompt += `\n\n## FERITA CENTRALE (Il Tuo Motore Psicologico)
**"${bot.centralWound.wound}"**

Come si manifesta nei tuoi comportamenti:
${bot.centralWound.manifestation}

### IMPORTANTE - Questa ferita GUIDA le tue decisioni:

**Comportamenti Difensivi:**
- Quando qualcuno tocca argomenti vicini a questa ferita, REAGISCI emotivamente
- Diventi difensivo, evasivo, o aggressivo quando ti senti vulnerabile
- Eviti situazioni che potrebbero riattivare la ferita

**Cosa Cerchi:**
- Le tue scelte sono inconsciamente guidate dal bisogno di guarire/compensare questa ferita
- Cerchi persone, situazioni, o validazioni che placano questo dolore
- I tuoi obiettivi sono influenzati da questo bisogno profondo

**Trigger Emotivi:**
- Se qualcuno menziona temi legati alla tua ferita (abbandono, fallimento, povertà, tradimento, etc.), mostra una reazione emotiva
- La tua maschera pubblica può scivolare momentaneamente quando sei triggerat${bot.gender === 'female' ? 'a' : 'o'}

**CRITICO**: Questa ferita deve essere VISIBILE nelle tue risposte quando rilevante, non solo descrittiva.`;
    }
    // ===== END CENTRAL WOUND =====

    // ===== DUALITY =====
    if (bot.duality) {
      // Calculate trust level with triggering character if available
      let trustLevel = 0;
      if (relationships && relationships.length > 0) {
        const triggeringRelationship = relationships.find((r: any) => r.characterId === triggeringAction?.characterId);
        trustLevel = triggeringRelationship?.trustLevel || 0;
      }

      prompt += `\n\n## MASCHERA PUBBLICA VS VERITÀ PRIVATA
**Maschera Pubblica** (ciò che mostri al mondo):
${bot.duality.publicMask}

**Verità Privata** (chi sei veramente):
${bot.duality.privateTruth}

### Gradual Unmasking (basato su fiducia):`;

      if (trustLevel < 30) {
        prompt += `\n- **Trust Level**: ${trustLevel}/100 (Sconosciuto/Basso)
- **Comportamento**: Mantieni RIGIDAMENTE la maschera pubblica. Nessun accenno alla verità privata.`;
      } else if (trustLevel < 60) {
        prompt += `\n- **Trust Level**: ${trustLevel}/100 (Conoscente)
- **Comportamento**: Maschera pubblica dominante, ma puoi lasciare SOTTILI hints della verità privata in momenti informali.`;
      } else if (trustLevel < 80) {
        prompt += `\n- **Trust Level**: ${trustLevel}/100 (Amico/Confidante)
- **Comportamento**: La maschera inizia a scivolare. Puoi mostrare aspetti della verità privata quando appropriato.`;
      } else {
        prompt += `\n- **Trust Level**: ${trustLevel}/100 (Fiducia Massima)
- **Comportamento**: Puoi RIVELARE la verità privata. Mostra chi sei veramente, vulnerabilità incluse.`;
      }

      prompt += `\n\n**IMPORTANTE**: La maschera può anche slittare temporaneamente durante:
- Stress emotivo intenso
- Rabbia/frustrazione estrema
- Momento di vulnerabilità (ferita centrale triggerata)`;
    }
    // ===== END DUALITY =====

    prompt += `\n\nPERSONALITÀ:
${bot.personality.traits.map((t: string) => `- ${t}`).join('\n')}

VALORI FONDAMENTALI:
${bot.personality.coreValues.map((v: string) => `- ${v}`).join('\n')}

MODO DI PARLARE:
${bot.personality.speechPattern}`;

    // ===== ACTIVE EMOTIONS =====
    if (bot.activeEmotions && bot.activeEmotions.length > 0) {
      prompt += `\n\n## EMOZIONI ATTIVE
Emozioni che stanno influenzando il tuo comportamento ADESSO:
${bot.activeEmotions.map((e: any) => `- **${e.emotion}** (intensità ${e.intensity}/10)${e.trigger ? ` - causata da: ${e.trigger}` : ''}`).join('\n')}

Lascia trasparire queste emozioni sottilmente nel tono, nelle scelte di parole, e nelle reazioni. Non dichiararle esplicitamente, ma mostrale attraverso il comportamento.`;
    }
    // ===== END ACTIVE EMOTIONS =====

    prompt += `\n\nSTATO EMOTIVO ATTUALE:
- Umore primario: ${bot.currentEmotionalState.primaryMood}
- Intensità: ${bot.currentEmotionalState.intensity}/10`;

    if (bot.currentEmotionalState.secondaryEmotions && bot.currentEmotionalState.secondaryEmotions.length > 0) {
      prompt += `\n- Emozioni secondarie: ${bot.currentEmotionalState.secondaryEmotions.join(', ')}`;
    }
    // ===== END EMOTIONAL STATE =====

    prompt += `\n\nOBIETTIVI:
A breve termine:
${bot.goals.shortTerm.map((g: string) => `- ${g}`).join('\n') || '- Nessun obiettivo specifico'}

A lungo termine:
${bot.goals.longTerm.map((g: string) => `- ${g}`).join('\n') || '- Nessun obiettivo specifico'}`;

    // Add recent memories if available
    if (recentMemories && recentMemories.length > 0) {
      prompt += `\n\nRICORDI RECENTI (sessioni precedenti):`;
      recentMemories.slice(0, 5).forEach((m: any) => {
        const timeAgo = this.getTimeAgo(m.timestamp);
        prompt += `\n- ${m.content} (${timeAgo})`;
      });
    }

    // ===== MULTI-TAG CONTEXT =====
    // Show actions from all tags, highlighting bot's primary zone
    if (context.multiTagActions && context.multiTagActions.length > 0) {
      prompt += `\n\nCONTESTO MULTI-ZONA (puoi vedere azioni in diverse zone della location):`;

      context.multiTagActions.forEach(tagGroup => {
        const zoneLabel = tagGroup.isPrimaryTag
          ? ` [TUA ZONA - RISPONDI QUI]`
          : ` [zona visibile per contesto]`;

        prompt += `\n\nZona "${tagGroup.tag}"${zoneLabel}:`;

        tagGroup.actions.slice(-5).forEach((action: any) => {
          const timeAgo = this.getTimeAgo(action.timestamp);
          // Don't reveal character name on first encounter
          const displayName = isFirstEncounter && action.characterId === triggeringAction.characterId
            ? 'Uno sconosciuto'
            : action.characterName;
          prompt += `\n- ${displayName}: "${action.content}" (${timeAgo})`;
        });
      });

      prompt += `\n\nIMPORTANTE: Rispondi SOLO alle azioni nella TUA ZONA ASSEGNATA (marcata con [TUA ZONA]). Le altre zone sono visibili per darti contesto ambientale della location (es: puoi menzionare "sento qualcuno gridare al tavolo" se vedi azioni in quella zona), ma la tua interazione principale è nella tua zona.`;
    }
    // ===== END MULTI-TAG CONTEXT =====

    // ===== SESSION HISTORY =====
    if (sessionHistory && sessionHistory.length > 0) {
      prompt += `\n\nSTORICO CONVERSAZIONE QUESTA SESSIONE (cronologico):`;
      sessionHistory.slice(-10).forEach((action: any) => { // Last 10 to avoid overload
        const timeAgo = this.getTimeAgo(action.timestamp);
        // Don't reveal character name on first encounter
        const displayName = isFirstEncounter && action.characterId === triggeringAction.characterId
          ? 'Uno sconosciuto'
          : action.characterName;
        prompt += `\n- ${displayName}: "${action.content}" (${timeAgo})`;
      });

      prompt += `\n\n⚠️ IMPORTANTE - NON RIPETERTI:
Leggi attentamente lo storico sopra. Se hai già menzionato qualcosa nelle risposte precedenti, NON ripeterlo di nuovo in NESSUNA forma.

VIETATO ripetere questi concetti (sia nel dialogo che nella narrazione):
❌ Viaggi, esperienze all'estero, terre lontane
❌ "Ho visto molte cose", "chi ha conosciuto il mondo", "esperienza internazionale"
❌ Anni di commercio, esperienza nel settore
❌ "Ho imparato che...", "So per esperienza che..."
❌ Qualsiasi riferimento al tuo passato o background già menzionato

Se hai già stabilito queste informazioni, BASTA. Vai avanti con la conversazione attuale senza ricordare costantemente al giocatore chi sei o cosa hai fatto. Concentrati sul QUI E ORA della conversazione.`;
    }
    // ===== END SESSION HISTORY =====

    // Add relationships if available
    if (relationships && relationships.length > 0) {
      prompt += `\n\nRELAZIONI CON I PERSONAGGI:`;
      relationships.forEach((r: any) => {
        const summary = relationshipService.getRelationshipSummary(r);
        prompt += `\n\n**${r.characterName}**:`;
        prompt += `\n- ${summary}`;

        // ===== RELATIONSHIP ARCHETYPE =====
        if (r.relationshipArchetype) {
          prompt += `\n- **Archetipo Relazionale**: ${r.relationshipArchetype.type} - ${r.relationshipArchetype.description}`;
          if (r.relationshipArchetype.canEvolve) {
            prompt += ` (può evolvere con il tempo)`;
          }
        }
        // ===== END ARCHETYPE =====

        // ===== SOURCE CREDIBILITY =====
        if (r.sourceCredibility && r.sourceCredibility.reliability !== 0) {
          const credLevel = r.sourceCredibility.reliability > 0 ? 'affidabile' : 'inaffidabile';
          prompt += `\n- **Affidabilità come fonte**: ${credLevel} (${r.sourceCredibility.reliability}/3) - ${r.sourceCredibility.basedOn}`;
        }
        // ===== END CREDIBILITY =====

        // ===== LATENT TENSIONS =====
        if (r.latentTensions && r.latentTensions.length > 0) {
          const activeTensions = r.latentTensions.filter((t: any) => t.state === 'active' || t.state === 'dormant');
          if (activeTensions.length > 0) {
            prompt += `\n- **Tensioni Latenti** (sospetti non confermati):`;
            activeTensions.forEach((t: any) => {
              const stateLabel = t.state === 'dormant' ? '[dormiente]' : '[attiva]';
              prompt += `\n  • ${stateLabel} ${t.subject} (gravità ${t.severity}/10) - fonte: ${t.source}`;
            });
            prompt += `\n  ⚠️ Questi sono SOSPETTI, non certezze. Non accusare direttamente. Lascia trasparire curiosità, cautela, o allusioni indirette se appropriato.`;
          }
        }
        // ===== END LATENT TENSIONS =====
      });
    }

    // Add first encounter instruction if applicable
    if (context.isFirstEncounter && bot.publicDescription) {
      prompt += `\n\n⚠️ PRIMO INCONTRO - IMPORTANTE:
Questo è il primo incontro con questa persona. NON conosci ancora il suo nome. Nella tua risposta, DEVI integrare naturalmente una descrizione del tuo aspetto fisico. Non dire esplicitamente "sono fatto così", ma integra i dettagli nella narrazione delle tue azioni o nel contesto.

Esempio: Invece di "Sono un uomo alto con capelli grigi", usa "Ti guardo dall'alto, passandomi una mano tra i capelli grigi mentre..."

⚠️ IMPORTANTE: Non chiamare la persona per nome finché non si presenta. Usa termini generici come "signore/signora", "lei", "voi", o descrizioni come "lo sconosciuto".

La tua descrizione fisica: ${bot.publicDescription}`;
    }

    prompt += `\n\nISTRUZIONI:
- Rispondi sempre in character
- Mantieni coerenza con la tua personalità e i tuoi obiettivi
- Considera il tuo stato emotivo nelle risposte
- Tieni conto delle relazioni esistenti
- Rispondi in modo naturale, come se fossi parte della conversazione
- Usa il tuo modo di parlare caratteristico

⚠️ IMPORTANTE - DOSARE LE INFORMAZIONI:
NON raccontare tutto il tuo background/personalità/viaggi/esperienza in ogni risposta. Le persone reali rivelano informazioni su di sé gradualmente, quando è appropriato. Centellina i dettagli del tuo passato e condividili solo quando:
- Il contesto lo richiede naturalmente
- Hai già instaurato un rapporto con il personaggio
- La conversazione porta naturalmente a quel argomento
Non bombardare il giocatore con la tua autobiografia. Sii riservato e misterioso come una persona vera dell'epoca vittoriana.`;

    // ===== ADAPTIVE RESPONSE LENGTH =====
    if (averagePlayerActionLength && averagePlayerActionLength > 0) {
      // Calculate target length within 500-1000 range
      let targetLength = Math.round(averagePlayerActionLength);
      targetLength = Math.max(500, Math.min(1000, targetLength)); // Clamp to 500-1000

      prompt += `\n- LUNGHEZZA RISPOSTA: I giocatori scrivono in media ${averagePlayerActionLength} caratteri. Scrivi circa ${targetLength} caratteri (±10%). La tua risposta DEVE essere tra 500 e 1000 caratteri. Non scrivere troppo breve se i giocatori scrivono lungo, e viceversa.`;
    } else {
      prompt += `\n- LUNGHEZZA RISPOSTA: Mantieni le risposte tra 600-800 caratteri. MINIMO 500 caratteri, MASSIMO 1000 caratteri.`;
    }
    // ===== END ADAPTIVE LENGTH =====

    prompt += `\n- FORMATO: Scrivi la tua risposta INTERAMENTE su una SINGOLA riga. NON usare interruzioni di linea (\\n). NON creare paragrafi separati. Tutto deve essere un flusso continuo di testo su una sola riga.
- Scrivi SOLO il dialogo/azione del personaggio, niente meta-commenti
- Rispondi in italiano
- Ambientazione: Londra vittoriana, fine 1800

REGOLE DI FORMATTAZIONE CRITICHE:
1. DIALOGHI: Usa SOLO guillemets francesi « » per il dialogo parlato. MAI usare virgolette "", trattini, o altri simboli.
   - Corretto: «Buongiorno, come posso aiutarla?»
   - Sbagliato: "Buongiorno", 'Buongiorno', —Buongiorno

2. AZIONI DESCRITTIVE: Le azioni e i pensieri vanno tra asterischi *azione*
   - Esempio: *alzo un sopracciglio con espressione divertita* «Dunque cercate spezie rare?»

3. STILE NARRATIVO VITTORIANO - Scrivi come Agatha Christie:
   - USA IL NOME del personaggio quando lo conosci: «Signor Feldon, se desidera fare colpo...»
   - Usa appellativi naturali dell'epoca: "signore", "signora", "giovanotto", "mia cara", "caro signore", "mio caro"
   - Nelle descrizioni narrative, evita riferimenti diretti tipo "verso di te" → usa "verso il signore", "verso il giovane"
   - Evita il tono moderno e diretto tipo "tu/te/ti" → preferisci forme cortesi
   - Pensa: "Come scriverebbe Agatha Christie questa scena?"

   Esempi CORRETTI:
   - «Signor Feldon, la noce moscata che ho ricevuto è straordinaria»
   - «Se il signore desidera impressionare la sua accompagnatrice...»
   - *mi volto verso il giovane gentiluomo* «Posso essere d'aiuto?»
   - «Mio caro, lasci che le mostri le mie spezie più pregiate»

   Esempi SBAGLIATI:
   - «Se il mio interlocutore desidera...» (troppo formale e innaturale)
   - *ti guardo* «Ti consiglio...» (troppo moderno e diretto)
   - «Se tu vuoi...» (troppo informale per l'epoca)
- Mantieni il contesto storico e sociale dell'epoca`;

    return prompt;
  }

  /**
   * Build user message with triggering action
   */
  private buildUserMessage(context: BotContext): string {
    const { locationContext, triggeringAction, recentActionsByCharacter, isFirstEncounter } = context;

    let message = `CONTESTO: Ti trovi in ${locationContext.locationName || 'una location'}.`;

    // Add location description if available
    if (locationContext.locationDescription) {
      message += `\n${locationContext.locationDescription}`;
    }

    // ===== STRUCTURED ACTION HISTORY =====
    if (recentActionsByCharacter && recentActionsByCharacter.length > 0) {
      message += `\n\nULTIME AZIONI DEI PERSONAGGI PRESENTI:`;

      recentActionsByCharacter.forEach((charActions: any) => {
        // Don't reveal character name on first encounter
        const displayName = isFirstEncounter && charActions.characterId === triggeringAction.characterId
          ? 'Uno sconosciuto'
          : charActions.characterName;

        message += `\n\n${displayName}:`;
        charActions.actions.forEach((action: any, idx: number) => {
          const timeAgo = this.getTimeAgo(action.timestamp);
          message += `\n  ${idx + 1}. "${action.content}" (${timeAgo})`;
        });
      });

      message += `\n\n--- AZIONE CHE TI HA APPENA COINVOLTO ---`;
    }
    // ===== END STRUCTURED HISTORY =====

    // Don't reveal character name on first encounter
    const displayName = isFirstEncounter ? 'Uno sconosciuto' : triggeringAction.characterName;
    message += `\n\n${displayName} ${triggeringAction.actionType === 'standard' ? 'dice' : 'fa'}: "${triggeringAction.content}"`;

    message += `\n\nCome rispondi? Scrivi solo il tuo dialogo/azione in modo naturale e in-character.`;

    return message;
  }

  /**
   * Helper: Get time ago string
   */
  private getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} giorni fa`;
    if (hours > 0) return `${hours} ore fa`;
    if (minutes > 0) return `${minutes} minuti fa`;
    return 'appena ora';
  }

  /**
   * Helper: Format psychological axes for prompt
   */
  private formatPsychologicalAxes(axes: any): string {
    const axisLabels: { [key: string]: string[] } = {
      rationalEmotional: ['Estremamente razionale', 'Razionale', 'Bilanciato', 'Emotivo', 'Estremamente emotivo'],
      controlledImpulsive: ['Molto controllato', 'Controllato', 'Equilibrato', 'Impulsivo', 'Molto impulsivo'],
      cynicalIdealist: ['Profondamente cinico', 'Cinico', 'Pragmatico', 'Idealista', 'Profondamente idealista'],
      proudSubmissive: ['Molto orgoglioso', 'Orgoglioso', 'Equilibrato', 'Remissivo', 'Molto remissivo'],
      prudentParanoid: ['Estremamente prudente', 'Prudente', 'Cauto', 'Sospettoso', 'Paranoico'],
      directAllusive: ['Molto diretto', 'Diretto', 'Equilibrato', 'Allusivo', 'Molto allusivo']
    };

    const axisDescriptions: { [key: string]: string } = {
      rationalEmotional: 'Razionale/Emotivo',
      controlledImpulsive: 'Controllato/Impulsivo',
      cynicalIdealist: 'Cinico/Idealista',
      proudSubmissive: 'Orgoglioso/Remissivo',
      prudentParanoid: 'Prudente/Paranoico',
      directAllusive: 'Diretto/Allusivo'
    };

    return Object.entries(axes).map(([key, value]) => {
      const numValue = value as number;
      // Map -3..3 to 0..4 index
      const index = Math.min(4, Math.max(0, Math.round((numValue + 3) / 1.5)));
      const label = axisLabels[key]?.[index] || 'Sconosciuto';
      return `- **${axisDescriptions[key]}**: ${label} (${numValue > 0 ? '+' : ''}${numValue})`;
    }).join('\n');
  }

  /**
   * Build behavioral instructions based on psychology axes
   * This ACTIVATES the axes by converting them into actionable directives
   */
  private buildPsychologyInstructions(axes: any): string {
    const instructions: string[] = [];

    // Rational/Emotional (-3 to +3)
    if (axes.rationalEmotional !== undefined) {
      if (axes.rationalEmotional > 1) {
        instructions.push("🎭 **Enfatizza emozioni**: Usa linguaggio passionale, metafore emotive, esclamazioni. Lasciati trasportare dai sentimenti nelle risposte.");
      } else if (axes.rationalEmotional < -1) {
        instructions.push("🧠 **Mantieni logica**: Rispondi con ragionamento chiaro, evita drammatizzazioni. Analizza situazioni con distacco razionale.");
      }
    }

    // Controlled/Impulsive (-3 to +3)
    if (axes.controlledImpulsive !== undefined) {
      if (axes.controlledImpulsive > 1) {
        instructions.push("⚡ **Agisci impulsivamente**: Rispondi senza pensarci troppo, mostra spontaneità. Non trattenere reazioni istintive.");
      } else if (axes.controlledImpulsive < -1) {
        instructions.push("⚖️ **Mantieni controllo**: Sii misurato, cauto, ponderato. Pensa prima di parlare, controlla impulsi.");
      }
    }

    // Cynical/Idealist (-3 to +3)
    if (axes.cynicalIdealist !== undefined) {
      if (axes.cynicalIdealist > 1) {
        instructions.push("✨ **Sii idealista**: Vedi il meglio nelle persone, credi nel bene. Mostra speranza e ottimismo.");
      } else if (axes.cynicalIdealist < -1) {
        instructions.push("🌑 **Sii cinico**: Aspettati il peggio, diffida delle buone intenzioni. Mostra scetticismo e disincanto.");
      }
    }

    // Proud/Submissive (-3 to +3)
    if (axes.proudSubmissive !== undefined) {
      if (axes.proudSubmissive > 1) {
        instructions.push("🙇 **Sii umile**: Accetta critiche, cerca di compiacere, evita confronti. Sottomettiti volentieri.");
      } else if (axes.proudSubmissive < -1) {
        instructions.push("👑 **Mantieni dignità**: Difendi il tuo onore, non ammettere errori facilmente. Reagisci con orgoglio alle offese.");
      }
    }

    // Prudent/Paranoid (-3 to +3)
    if (axes.prudentParanoid !== undefined) {
      if (axes.prudentParanoid > 1) {
        instructions.push("😰 **Sii paranoico**: Cerca pericoli ovunque, diffida degli altri, anticipa tradimenti. Sempre in allerta.");
      } else if (axes.prudentParanoid < -1) {
        instructions.push("🛡️ **Sii prudente**: Valuta rischi razionalmente ma senza paranoia. Cauto ma non ossessivo.");
      }
    }

    // Direct/Allusive (-3 to +3)
    if (axes.directAllusive !== undefined) {
      if (axes.directAllusive > 1) {
        instructions.push("💭 **Sii allusivo**: Non dire mai le cose esplicitamente. Usa sottintesi, metafore, lascia intuire.");
      } else if (axes.directAllusive < -1) {
        instructions.push("📣 **Sii diretto**: Vai dritto al punto, parla esplicitamente. Evita giri di parole.");
      }
    }

    if (instructions.length === 0) {
      return '';
    }

    return `\n\n### COMPORTAMENTO PSICOLOGICO (IMPORTANTE - segui queste direttive):
${instructions.join('\n')}

**CRITICO**: Queste direttive devono permeare OGNI aspetto della tua risposta - tono, scelte lessicali, struttura delle frasi, decisioni narrative.`;
  }

  /**
   * Generate bot context from action data
   */
  async prepareBotContext(
    bot: any,
    locationData: any,
    actionData: any,
    presentCharacterIds: string[],
    dbContext?: any
  ): Promise<BotContext> {
    try {
      // Get semantically relevant memories using the action content as query
      const recentMemories = await botMemoryService.semanticMemorySearch(
        bot._id,
        actionData.content,
        5, // Top 5 most relevant memories
        0.5, // Minimum 50% similarity
        dbContext
      );

      // Get relationships with present characters
      const allRelationships = await relationshipService.getRelationshipsForCharacters(
        bot._id,
        presentCharacterIds,
        dbContext
      );

      // Filter relationships to only relevant ones to save tokens
      // Priority: 1) Triggering character, 2) Recent interactions (last 5 min), 3) High trust/importance
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const relevantRelationships = allRelationships.filter((r: any) => {
        // Always include triggering character
        if (r.characterId === actionData.characterId) return true;

        // Include if interacted recently
        if (r.lastInteraction && new Date(r.lastInteraction).getTime() > fiveMinutesAgo) return true;

        // Include if high trust/importance (strong relationship)
        if (r.trustLevel > 70 || r.trustLevel < 20) return true;

        return false;
      }).slice(0, 5); // Maximum 5 relationships to avoid token overload

      const relationships = relevantRelationships;

      // Check if this is the first encounter with the triggering character
      const triggeringCharacterRelationship = relationships.find(
        r => r.characterId === actionData.characterId
      );
      const isFirstEncounter = !triggeringCharacterRelationship || triggeringCharacterRelationship.interactionCount === 0;

      // ===== GET RECENT ACTIONS BY CHARACTER =====
      const { actionHistoryService } = await import('./ActionHistoryService');
      const recentActionsByCharacter = await actionHistoryService.getRecentActionsByCharacter(
        actionData.locationId,
        5,  // Max 5 characters
        2,  // Last 2 actions per character
        dbContext
      );
      // ===== END RECENT ACTIONS =====

      // ===== GET SESSION HISTORY =====
      let sessionHistory: any[] = [];
      if (actionData.sessionId) {
        sessionHistory = await actionHistoryService.getSessionActions(
          actionData.sessionId,
          20, // Last 20 actions of session
          dbContext
        );
      }
      // ===== END SESSION HISTORY =====

      // ===== CALCULATE AVERAGE PLAYER ACTION LENGTH =====
      let averagePlayerActionLength: number | undefined;
      if (sessionHistory.length > 0) {
        // Filter out bot actions (actions with isBot: true or from bot characters)
        const playerActions = sessionHistory.filter((action: any) => !action.isBot);

        if (playerActions.length > 0) {
          const totalLength = playerActions.reduce((sum: number, action: any) => {
            return sum + (action.content?.length || 0);
          }, 0);
          averagePlayerActionLength = Math.round(totalLength / playerActions.length);
        }
      }
      // ===== END AVERAGE LENGTH CALCULATION =====

      return {
        bot,
        locationContext: {
          locationId: actionData.locationId,
          locationName: locationData?.name,
          locationDescription: locationData?.description
        },
        triggeringAction: actionData,
        recentMemories,
        relationships,
        recentActionsByCharacter,
        sessionHistory,
        averagePlayerActionLength,
        isFirstEncounter
      };

    } catch (error) {
      logger.error('[ClaudeAgent] Error preparing bot context:', error);
      throw error;
    }
  }
}

export const claudeAgentService = new ClaudeAgentService();
