import { createApp } from './app';

const PORT = parseInt(process.env.LOCATION_IMAGE_GEN_PORT || '8110', 10);
const app = createApp();

app.listen(PORT, () => {
  console.log(`[location-image-gen] Stub service listening on port ${PORT}`);
});
