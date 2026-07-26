export interface ServiceConfig {
  name: string;
  prefix: string;
  target: string;
  healthPath: string;
}

const allServices: ServiceConfig[] = [
  { name: 'botai',         prefix: '/botai',         target: process.env.BOTAI_TARGET     || 'http://localhost:8080', healthPath: '/health' },
  { name: 'character-gen', prefix: '/character-gen', target: process.env.CHAR_GEN_TARGET  || 'http://localhost:8130', healthPath: '/health' },
];

const enabledNames = (process.env.ENABLED_SERVICES || 'botai').split(',').map(s => s.trim());
export const services: ServiceConfig[] = allServices.filter(s => enabledNames.includes(s.name));
