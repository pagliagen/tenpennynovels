/** Configurazione completa per i test della chat dei bot. Importato per primo: `appConfig` legge l'ambiente al caricamento. */
export const SECRET = '0123456789abcdef0123456789abcdef'; // 32 caratteri
process.env.BOT_SERVICE_SECRET = SECRET;
process.env.ENABLE_BOT_CHAT = 'true';
process.env.BOT_REPLY_BASE_URL = 'http://localhost:3001';
process.env.AI_GATEWAY_URL = 'http://127.0.0.1:8787';
process.env.AI_GATEWAY_SECRET = 's'.repeat(40);
process.env.APP_ENVIRONMENT = 'local';
