import { useState } from 'react';

interface BotInfo {
  _id: string;
  name: string;
  gender?: string;
  publicDescription?: string;
  personality?: {
    traits?: string[];
    speech_style?: string;
    background?: string;
  };
}

interface SidebarProps {
  config: { gatewayUrl: string; callbackUrl: string; apiKey: string } | null;
  bot: BotInfo | null;
  onBotGenerated: (bot: BotInfo) => void;
  connected: boolean;
  waitingForBot: boolean;
  onWaitingChange: (waiting: boolean) => void;
  savedBots: Array<{ id: string; name: string }>;
}

export default function Sidebar({ config, bot, onBotGenerated, connected, waitingForBot, onWaitingChange, savedBots }: SidebarProps) {
  const [description, setDescription] = useState(
    'Un vecchio oste irlandese, burbero ma dal cuore d\'oro, veterano della guerra in Sudafrica, con una cicatrice sulla mano destra e un debole per il whisky',
  );
  const [locationName, setLocationName] = useState('The Rusty Anchor Pub');
  const [locationDesc, setLocationDesc] = useState(
    'Un pub fumoso nel quartiere portuale di Londra, con pareti di legno scuro e lampade a gas',
  );
  const [error, setError] = useState('');
  const [loadingBotId, setLoadingBotId] = useState<string | null>(null);

  async function handleGenerate() {
    if (!config) return;
    onWaitingChange(true);
    setError('');

    try {
      const body = {
        requestId: `gen-${Date.now()}`,
        description,
        location: { name: locationName, description: locationDesc },
        locale: 'it',
        callback: {
          url: config.callbackUrl,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      };

      const res = await fetch(`${config.gatewayUrl}/botai/bots/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Errore durante la generazione');
        onWaitingChange(false);
      }
    } catch (err: any) {
      setError(err.message);
      onWaitingChange(false);
    }
  }

  async function handleLoadBot(botId: string) {
    if (!config || !botId.trim()) return;
    setError('');
    setLoadingBotId(botId);
    try {
      const res = await fetch(`${config.gatewayUrl}/botai/bots/${botId}`, {
        headers: { 'X-API-Key': config.apiKey },
      });
      const data = await res.json();
      if (data.success) {
        onBotGenerated(data.data);
      } else {
        setError(data.error || 'Bot non trovato');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingBotId(null);
    }
  }

  return (
    <aside className="sidebar">
      <h2>Local AI Test</h2>

      <div className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? 'SSE Connesso' : 'SSE Disconnesso'}
      </div>

      <section className="sidebar-section">
        <h3>Genera Bot</h3>
        <label>
          Descrizione
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} disabled={waitingForBot} />
        </label>
        <label>
          Location (nome)
          <input value={locationName} onChange={(e) => setLocationName(e.target.value)} disabled={waitingForBot} />
        </label>
        <label>
          Location (desc)
          <input value={locationDesc} onChange={(e) => setLocationDesc(e.target.value)} disabled={waitingForBot} />
        </label>
        <button onClick={handleGenerate} disabled={waitingForBot || !config} className={waitingForBot ? 'btn-loading' : ''}>
          {waitingForBot ? 'Generazione in corso...' : 'Genera Bot'}
        </button>
        {waitingForBot && (
          <div className="generating-hint">Ollama sta elaborando. Puo impiegare 1-2 minuti.</div>
        )}
      </section>

      {savedBots.length > 0 && (
        <section className="sidebar-section">
          <h3>Bot salvati</h3>
          <div className="saved-bots-list">
            {savedBots.map((sb) => (
              <button
                key={sb.id}
                className={`saved-bot-item ${bot?._id === sb.id ? 'active' : ''}`}
                onClick={() => handleLoadBot(sb.id)}
                disabled={loadingBotId === sb.id}
              >
                <span className="saved-bot-name">{sb.name}</span>
                <span className="saved-bot-id">{sb.id.substring(0, 8)}...</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <div className="error-msg">{error}</div>}

      {bot && (
        <section className="sidebar-section bot-info">
          <h3>Bot attivo</h3>
          <p><strong>Nome:</strong> {bot.name}</p>
          <p><strong>ID:</strong> <code>{bot._id}</code></p>
          {bot.gender && <p><strong>Genere:</strong> {bot.gender}</p>}
          {bot.publicDescription && <p><strong>Descrizione:</strong> {bot.publicDescription}</p>}
          {bot.personality?.traits && (
            <p><strong>Tratti:</strong> {bot.personality.traits.join(', ')}</p>
          )}
          {bot.personality?.speech_style && (
            <p><strong>Stile:</strong> {bot.personality.speech_style}</p>
          )}
        </section>
      )}

      {config && (
        <section className="sidebar-section config-info">
          <h3>Config</h3>
          <p><strong>Gateway:</strong> <code>{config.gatewayUrl}</code></p>
          <p><strong>Callback:</strong> <code>{config.callbackUrl}</code></p>
        </section>
      )}
    </aside>
  );
}
