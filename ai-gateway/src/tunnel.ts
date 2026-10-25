/**
 * `npm run tunnel`: apre il tunnel ngrok verso il gateway con il dominio statico di NGROK_URL.
 * Equivale a: ngrok http <PORT> --url <NGROK_URL>
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8787';
const url = process.env.NGROK_URL;
if (!url) {
  process.stderr.write('NGROK_URL mancante nel .env (es. https://<dominio>.ngrok-free.dev)\n');
  process.exit(1);
}

const child = spawn('ngrok', ['http', port, '--url', url], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
