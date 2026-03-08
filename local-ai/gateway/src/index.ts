import { loadClients } from './clients';
import { createApp } from './app';

// Load client registry before starting
loadClients();

const PORT = parseInt(process.env.GATEWAY_PORT || '9000', 10);
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Gateway] Listening on 0.0.0.0:${PORT}`);
});
