import { createApp } from './app';

const PORT = parseInt(process.env.ITEM_IMAGE_GEN_PORT || '8100', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`[item-image-gen] Stub service listening on port ${PORT}`);
});
