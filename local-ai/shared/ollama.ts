import { Ollama } from 'ollama';

let instance: Ollama | null = null;

export function getOllamaClient(): Ollama {
  if (!instance) {
    instance = new Ollama({
      host: process.env.OLLAMA_URL || 'http://localhost:11434',
    });
  }
  return instance;
}

export function getModel(): string {
  return process.env.OLLAMA_MODEL || 'gemma3:12b';
}

export async function warmupModel(): Promise<void> {
  const client = getOllamaClient();
  const model = getModel();
  await client.chat({
    model,
    messages: [{ role: 'user', content: 'hi' }],
    options: { num_predict: 1 },
    keep_alive: -1,
  });
}

export async function checkOllamaHealth(): Promise<{ up: boolean; models: string[] }> {
  try {
    const client = getOllamaClient();
    const list = await client.list();
    return {
      up: true,
      models: list.models.map((m) => m.name),
    };
  } catch {
    return { up: false, models: [] };
  }
}
