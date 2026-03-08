import { createApp } from './app';

const PORT = parseInt(process.env.AVATAR_GEN_PORT || '8120', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`[avatar-gen] Stub service listening on port ${PORT}`);
});
