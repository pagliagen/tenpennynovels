/**
 * Bot Character Seeder - Standalone Script
 *
 * Crea i personaggi bot (quelli che bot-service fa parlare in chat), tutti
 * agganciati all'utente di sistema `system-bot` (SYSTEM_BOT_USER_ID).
 *
 * Il personaggio NON ha una location: l'associazione bot → location vive in
 * bot-service/mapping.json. Il seeder stampa il file bots/<nome>.json con characterId, persona e scheda.
 *
 * characterType è 'pg_principale' e non 'png': il modello impone a un 'png' un
 * referentCharacterId (un pg_principale dello stesso utente) e l'utente di
 * sistema non ne ha. Gli id restano gli stessi a ogni run (idempotente per
 * userId + name), --force li ricrea.
 */

import { getConnection } from '../utils/connection.js';
import { ObjectId } from 'mongodb';
import { SYSTEM_BOT_USER_ID } from '../utils/systemBot.js';

interface BotCharacterSeed {
  name: string;
  firstName: string;
  surname: string;
  gender: 'male' | 'female';
  age: number;
  apparentAge: number;
  height: string;
  eyeColor: string;
  hairColor: string;
  visibleMarks: string;
  physicalDescription: string;
  publicDescription: string;
  /** Prompt del personaggio per bot-service. Non finisce nel DB. */
  persona: string;
  /** Scheda psicologica per bot-service (Big Five 1-100, Enneagramma, PAD di base). Non finisce nel DB. */
  psyche: {
    ocean: { O: number; C: number; E: number; A: number; N: number };
    enneagram: { type: number; fear: string; desire: string };
    pad: { p: number; a: number; d: number };
  };
}

const BOT_CHARACTERS: BotCharacterSeed[] = [
  {
    name: 'Barnaby Finch',
    firstName: 'Barnaby',
    surname: 'Finch',
    gender: 'male',
    age: 46,
    apparentAge: 50,
    height: '1.75m',
    eyeColor: 'grigi',
    hairColor: 'brizzolati',
    visibleMarks: 'Una cicatrice sottile sull\'avambraccio sinistro, sempre coperta da una manica rimboccata.',
    physicalDescription: 'Uomo robusto dalle spalle larghe, con baffi folti e un grembiule di tela macchiato. Si muove con lentezza misurata dietro il bancone e asciuga continuamente boccali già puliti.',
    publicDescription: 'Il barista del locale. Serve birra e gin, ascolta più di quanto parli.',
    persona: 'Sei Barnaby Finch, barista di una taverna dell\'East End nella Londra del 1888. Hai quarantasei anni, ex marinaio, da molti anni dietro il bancone. Sei laconico e osservatore: ascolti tutto, commenti poco, non ti scomponi mai. Sei cortese con chi paga e si comporta bene, secco con gli ubriachi molesti, e non fai domande a chi non vuole parlare. Conosci i pettegolezzi del quartiere ma li dai solo a chi ti è simpatico o a chi ti offre un giro. Parli in frasi brevi, con qualche espressione marinaresca.',
    psyche: {
      ocean: { O: 35, C: 70, E: 30, A: 45, N: 25 },
      enneagram: {
        type: 6,
        fear: 'essere tradito o truffato, e perdere il suo locale',
        desire: 'sentirsi al sicuro in un posto suo, circondato da gente di cui potersi fidare',
      },
      pad: { p: 0.1, a: -0.2, d: 0.4 },
    },
  },
];

async function seedBotCharacters() {
  console.log('🤖 Bot Character Seeder\n');
  const { client, db } = await getConnection();
  const force = process.argv.includes('--force');

  try {
    const usersCol = db.collection('users');
    const charsCol = db.collection('characters');

    const botUserId = ObjectId.createFromHexString(SYSTEM_BOT_USER_ID);
    const botUser = await usersCol.findOne({ _id: botUserId });
    if (!botUser) {
      console.error(`❌ Utente system-bot (${SYSTEM_BOT_USER_ID}) non trovato: esegui prima seed:*:users`);
      process.exit(1);
    }

    const snippets: Record<string, unknown>[] = [];

    for (const bot of BOT_CHARACTERS) {
      const existing = await charsCol.findOne({ userId: botUserId, name: bot.name });

      if (existing && !force) {
        console.log(`   ⏭️  ${bot.name} already exists (${existing._id}), skipping`);
        snippets.push({ name: bot.name, characterId: String(existing._id), persona: bot.persona, psyche: bot.psyche });
        continue;
      }
      if (existing && force) {
        await charsCol.deleteOne({ _id: existing._id });
        console.log(`   🗑️  --force: deleted ${bot.name}`);
      }

      const now = new Date();
      const { persona: _persona, psyche: _psyche, ...fields } = bot;
      const result = await charsCol.insertOne({
        ...fields,
        characterType: 'pg_principale',
        userId: botUserId,
        playerStatus: 'approved',
        gameplayRoles: ['player'],
        canAccessAdminPanel: false,
        isGestore: false,
        characterPermissions: [],
        adminPermissions: [],
        skills: {},
        equipment: [],
        // Mai selezionato da una sessione: esiste un solo isActive per utente.
        isActive: false,
        isBanned: false,
        stats: {
          strength: 55, constitution: 55, size: 60, dexterity: 45,
          appearance: 45, intelligence: 55, power: 50, education: 40,
        },
        derived: {
          ideaRoll: 55, luckRoll: 50, knowledge: 40, hitPoints: 11,
          sanity: 50, maxSanity: 99, magicPoints: 10, movementRate: 7,
          bonusDamage: '+1d4', build: 1,
        },
        forumStats: { followerCount: 0, followingCount: 0, postCount: 0 },
        createdAt: now,
        updatedAt: now,
        submittedAt: now,
        approvedAt: now,
        approvedBy: botUserId,
        approvedByName: 'System',
      });
      console.log(`   ✓ Created bot character: ${bot.name} (${result.insertedId})`);
      snippets.push({ name: bot.name, characterId: String(result.insertedId), persona: bot.persona, psyche: bot.psyche });
    }

    console.log('\n📋 Un file per bot in bot-service/bots/<nome>.json:\n');
    for (const snippet of snippets) console.log(JSON.stringify(snippet, null, 2), '\n');
    console.log('📍 Poi la mappatura in bot-service/mapping.json: { "locationId": "<_id Location>", "botId": "<characterId>" }\n');
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedBotCharacters();
