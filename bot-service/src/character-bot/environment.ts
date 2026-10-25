/**
 * Il meteo come lo vede il bot: lo costruisce il backend dalla stessa sorgente della
 * sidebar del game (`GET /internal/bot-chat/environment`). Qui si decide solo QUANDO
 * dirlo al modello: sempre in prompt, un 12B lo ripeterebbe in ogni battuta.
 */
export interface BotEnvironment {
  condition: string;
  /** «piove», «c'è nebbia». */
  description: string;
  /** «fa freddo»: mai il numero. */
  feel: string;
  /** Le uniche parole di meteo che il bot può dire adesso. */
  words: string[];
}

/** Il giocatore parla del tempo (o di cosa c'è fuori): il bot può rispondere con ciò che è vero. */
const ASKS_ABOUT_WEATHER = /\b(tempo|piov\w*|pioggia|nebbia|nebbios\w*|neve|nevic\w*|sole|sereno|nuvol\w*|coperto|vento|temporale|freddo|fredd\w*|caldo|gelo|umido|bagnat\w*|ombrello|cielo)\b/i;
/** Chi è appena arrivato da fuori (o sta per tornarci) ha una ragione naturale per parlarne. */
const AT_THE_DOOR = /ingresso|uscita/i;

export interface WeatherGate {
  lastPlayerText: string;
  position?: string | undefined;
  /** Le ultime battute del bot: se ha già parlato del tempo, non lo ripete da sé. */
  ownLines: string[];
}

export function mentionsWeather(text: string, env: BotEnvironment): boolean {
  const lower = text.toLowerCase();
  return env.words.some((w) => lower.includes(w.toLowerCase()));
}

/** `ask`: se il giocatore lo chiede va sempre detto; `arrival`: solo se non lo ha già detto da poco. */
export function weatherLines(env: BotEnvironment | null, gate: WeatherGate): string[] {
  const asked = ASKS_ABOUT_WEATHER.test(gate.lastPlayerText);
  if (!env) {
    // Backend muto: meglio ammettere di non saperlo che inventare un tempo diverso da quello in sidebar.
    return asked ? ['Non sai che tempo faccia fuori. Se te lo chiedono dillo semplicemente (non hai guardato), senza inventare pioggia, nebbia, sole o altro.'] : [];
  }
  const arrival = !!gate.position && AT_THE_DOOR.test(gate.position);
  const alreadySaid = gate.ownLines.slice(-2).some((l) => mentionsWeather(l, env));
  if (!asked && !(arrival && !alreadySaid)) return [];

  return [
    `Fuori dal locale ${env.description} e ${env.feel}. È l'unico meteo che esiste: non aggiungere altri fenomeni (niente neve, vento, nebbia, pioggia se non sono quelli qui).`,
    asked
      ? 'Te lo hanno chiesto o ne stanno parlando: rispondi con questo.'
      : 'Puoi accennarvi solo se viene naturale (chi arriva da fuori): non è necessario.',
  ];
}
