export interface ServiceConfig {
  name: string;
  prefix: string;
  target: string;
  healthPath: string;
}

const allServices: ServiceConfig[] = [
  { name: 'botai',     prefix: '/botai',     target: process.env.BOTAI_TARGET     || 'http://localhost:8080', healthPath: '/health' },
  { name: 'qa',        prefix: '/qa',        target: process.env.QA_TARGET        || 'http://localhost:8090', healthPath: '/health' },
  { name: 'image-gen', prefix: '/image-gen', target: process.env.IMAGE_GEN_TARGET || 'http://localhost:8100', healthPath: '/health' },
];

const enabledNames = (process.env.ENABLED_SERVICES || 'image-gen').split(',').map(s => s.trim());
export const services: ServiceConfig[] = allServices.filter(s => enabledNames.includes(s.name));
