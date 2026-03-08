export interface ServiceConfig {
  name: string;
  prefix: string;
  target: string;
  healthPath: string;
}

export const services: ServiceConfig[] = [
  { name: 'botai',              prefix: '/botai',              target: process.env.BOTAI_TARGET              || 'http://localhost:8080', healthPath: '/health' },
  { name: 'qa',                 prefix: '/qa',                 target: process.env.QA_TARGET                 || 'http://localhost:8090', healthPath: '/health' },
  { name: 'item-image-gen',     prefix: '/item-image-gen',     target: process.env.ITEM_IMAGE_GEN_TARGET     || 'http://localhost:8100', healthPath: '/health' },
  { name: 'location-image-gen', prefix: '/location-image-gen', target: process.env.LOCATION_IMAGE_GEN_TARGET || 'http://localhost:8110', healthPath: '/health' },
  { name: 'avatar-gen',         prefix: '/avatar-gen',         target: process.env.AVATAR_GEN_TARGET         || 'http://localhost:8120', healthPath: '/health' },
];
