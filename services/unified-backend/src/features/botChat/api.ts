/**
 * Barrel pubblico della feature. Espone solo ciò che serve fuori: lo stato della configurazione della chat dei bot
 * (tab Bot del gestionale) e l'invalidazione dell'elenco delle location con bot (dopo la creazione di un bot).
 */
export { botChatConfigStatus } from './utils/botChatConfig';
export type { BotChatConfigStatus } from './utils/botChatConfig';
export { invalidateBotDirectory, startBotChatForwarder } from './services/forwarderWiring';
