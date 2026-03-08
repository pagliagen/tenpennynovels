import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import { useSSE } from './hooks/useSSE';

interface Config {
  gatewayUrl: string;
  callbackUrl: string;
  apiKey: string;
}

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

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: Date;
}

const STORAGE_KEY = 'local-ai-test-bots';

function loadSavedBots(): Array<{ id: string; name: string }> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveBot(id: string, name: string) {
  const bots = loadSavedBots().filter((b) => b.id !== id);
  bots.unshift({ id, name });
  if (bots.length > 20) bots.length = 20;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const [savedBots, setSavedBots] = useState(loadSavedBots);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch((err) => console.error('Failed to load config:', err));
  }, []);

  const handleSSEEvent = useCallback((event: string, data: any) => {
    if (event === 'bot-generated') {
      const botData = data.data;
      setBot(botData);
      setWaitingForBot(false);
      saveBot(botData._id, botData.name);
      setSavedBots(loadSavedBots());
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'system' as const,
          text: `Bot "${botData.name}" generato con successo (ID: ${botData._id})`,
          timestamp: new Date(),
        },
      ]);
    } else if (event === 'bot-response' || event === 'callback') {
      const response = data.response;
      if (response) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot' as const,
            text: response.text || response,
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, []);

  const { connected } = useSSE('/api/events', handleSSEEvent);

  function handleBotSelected(selectedBot: BotInfo) {
    setBot(selectedBot);
    saveBot(selectedBot._id, selectedBot.name);
    setSavedBots(loadSavedBots());
  }

  function handleSendMessage(msg: Message) {
    setMessages((prev) => [...prev, msg]);
  }

  return (
    <div className="app-layout">
      <Sidebar
        config={config}
        bot={bot}
        onBotGenerated={handleBotSelected}
        connected={connected}
        waitingForBot={waitingForBot}
        onWaitingChange={setWaitingForBot}
        savedBots={savedBots}
      />
      <Chat config={config} bot={bot} messages={messages} onSendMessage={handleSendMessage} />
    </div>
  );
}
