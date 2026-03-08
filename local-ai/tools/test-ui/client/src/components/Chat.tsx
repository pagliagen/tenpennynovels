import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: Date;
}

interface BotInfo {
  _id: string;
  name: string;
}

interface ChatProps {
  config: { gatewayUrl: string; callbackUrl: string; apiKey: string } | null;
  bot: BotInfo | null;
  messages: Message[];
  onSendMessage: (msg: Message) => void;
}

export default function Chat({ config, bot, messages, onSendMessage }: ChatProps) {
  const [input, setInput] = useState('');
  const [characterId, setCharacterId] = useState('pg-001');
  const [characterName, setCharacterName] = useState('Test Player');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !bot || !config) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: input,
      timestamp: new Date(),
    };
    onSendMessage(userMsg);

    const requestId = `resp-${Date.now()}`;
    const body = {
      requestId,
      bot: { id: bot._id, name: bot.name },
      context: {
        location: { name: 'The Rusty Anchor Pub', description: 'Un pub fumoso' },
        actions: [
          {
            characterId,
            characterName,
            content: input,
            timestamp: new Date().toISOString(),
          },
        ],
        presentCharacters: [{ id: characterId, name: characterName }],
      },
      callback: {
        url: config.callbackUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    };

    setInput('');
    setSending(true);

    try {
      const res = await fetch(`${config.gatewayUrl}/botai/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        onSendMessage({
          id: `err-${Date.now()}`,
          sender: 'system',
          text: `Errore: ${data.error}`,
          timestamp: new Date(),
        });
      }
    } catch (err: any) {
      onSendMessage({
        id: `err-${Date.now()}`,
        sender: 'system',
        text: `Errore di rete: ${err.message}`,
        timestamp: new Date(),
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="chat-area">
      <div className="chat-header">
        <div className="chat-header-left">
          {bot ? (
            <span>Chat con <strong>{bot.name}</strong></span>
          ) : (
            <span>Genera o carica un bot per iniziare</span>
          )}
        </div>
        <div className="chat-header-right">
          <label>
            PG ID
            <input value={characterId} onChange={(e) => setCharacterId(e.target.value)} className="input-sm" />
          </label>
          <label>
            PG Nome
            <input value={characterName} onChange={(e) => setCharacterName(e.target.value)} className="input-sm" />
          </label>
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Nessun messaggio. Genera un bot dalla sidebar e inizia a chattare.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.sender}`}>
            <div className="message-meta">
              <span className="message-sender">
                {msg.sender === 'user' ? characterName : msg.sender === 'bot' ? bot?.name || 'Bot' : 'Sistema'}
              </span>
              <span className="message-time">
                {msg.timestamp.toLocaleTimeString('it-IT')}
              </span>
            </div>
            <div className="message-text">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={bot ? 'Scrivi un messaggio...' : 'Genera un bot prima di scrivere'}
          disabled={!bot || sending}
          rows={2}
        />
        <button onClick={handleSend} disabled={!bot || !input.trim() || sending}>
          {sending ? '...' : 'Invia'}
        </button>
      </div>
    </main>
  );
}
