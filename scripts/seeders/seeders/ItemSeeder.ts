/**
 * Item Seeder - Standalone Script
 *
 * Reads items from CSV, seeds MongoDB.
 * NO dependencies on unified-backend.
 */

import { getConnection } from '../utils/connection.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../data/items.csv');

interface ItemRow {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  basePrice: string;
  prerequisites: string;
  isConsumable: string;
  consumptionType: string;
  consumesItems: string;
  providesSkillBonus: string;
  rarity: string;
  filename: string;
  // "prompt" esiste in items.csv (prompt AI per local-tools/imagegen) ma NON va a DB:
  // volutamente non incluso in questa interfaccia/mapping.
  weaponType: string;
  weaponSkill: string;
  damageFormula: string;
  range: string;
  requiresExtraction: string;
  applyBonusDamage: string;
  halfBonusDamage: string;
  ammoCapacity: string;
  rangeMeters: string;
  blastRadiusMeters: string;
  isAdminOnly: string;
  marketSection: string;
  tradeOccupations: string;
}

const MARKET_SECTIONS = ['servizi', 'farmacia', 'camuffamento', 'armi', 'trasporti', 'mestiere'];
const MIN_TRADE_ITEMS_PER_OCCUPATION = 3;
const OCCUPATIONS_CSV_PATH = join(__dirname, '../data/occupations.csv');

function parseCsv<T>(path: string): T[] {
  return parse(readFileSync(path, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    comment: '#',
  }) as T[];
}

function splitList(value: string | undefined): string[] {
  return value ? value.split('|').map((v) => v.trim()).filter(Boolean) : [];
}

/**
 * Controlli sul catalogo, indipendenti dal DB (i nomi delle occupazioni vengono
 * da occupations.csv). Ritorna l'elenco degli errori; vuoto = ok.
 */
function validateCatalog(rows: ItemRow[], occupationNames: string[]): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  const files = new Set<string>();
  const coverage = new Map<string, number>(occupationNames.map((n) => [n, 0]));
  const bySection = new Map<string, number>();

  for (const row of rows) {
    if (names.has(row.name)) errors.push(`Nome duplicato: ${row.name}`);
    names.add(row.name);
    if (row.filename) {
      if (files.has(row.filename)) errors.push(`Filename duplicato: ${row.filename} (${row.name})`);
      files.add(row.filename);
    }
    const price = parseFloat(row.basePrice);
    if (!(price > 0) && row.isAdminOnly !== 'true') errors.push(`Prezzo non valido: ${row.name}`);
    if (!MARKET_SECTIONS.includes(row.marketSection)) {
      errors.push(`marketSection mancante o non valido: ${row.name} ("${row.marketSection}")`);
    } else {
      bySection.set(row.marketSection, (bySection.get(row.marketSection) ?? 0) + 1);
    }
    for (const occ of splitList(row.tradeOccupations)) {
      if (!coverage.has(occ)) errors.push(`Occupazione sconosciuta "${occ}" in ${row.name}`);
      else coverage.set(occ, (coverage.get(occ) ?? 0) + 1);
    }
  }

  // Il reparto «servizi» non ha item (usa la collection Service)
  for (const section of MARKET_SECTIONS.filter((x) => x !== 'servizi')) {
    if (!bySection.get(section)) errors.push(`Reparto senza item: ${section}`);
  }
  for (const [occ, count] of coverage) {
    if (count < MIN_TRADE_ITEMS_PER_OCCUPATION) {
      errors.push(`Occupazione con meno di ${MIN_TRADE_ITEMS_PER_OCCUPATION} attrezzi: ${occ} (${count})`);
    }
  }
  return errors;
}

async function seedItems() {
  console.log('🛍️  Item Seeder\n');

  // Lettura e validazione del CSV PRIMA di toccare il DB: un catalogo rotto non deve cancellare nulla.
  console.log('📄 Reading items from CSV...');
  const records = parseCsv<ItemRow>(CSV_PATH);
  console.log(`   Found ${records.length} items\n`);

  const occupationNames = parseCsv<{ name: string }>(OCCUPATIONS_CSV_PATH).map((o) => o.name).filter(Boolean);
  const errors = validateCatalog(records, occupationNames);
  if (errors.length > 0) {
    console.error('❌ Catalogo non valido:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log('✅ Catalogo valido');

  // `--check`: solo validazione, nessuna connessione al DB
  if (process.argv.includes('--check')) {
    return;
  }

  const { client, db } = await getConnection();

  try {
    const itemsCol = db.collection('items');

    // Occupazioni nel DB: servono gli _id per tradeOccupations. Vanno seedate PRIMA degli item.
    const occupationIds = new Map<string, unknown>();
    const dbOccupations = await db.collection('occupations').find({}, { projection: { name: 1 } }).toArray();
    for (const o of dbOccupations) occupationIds.set(o.name, o._id);
    const missing = occupationNames.filter((n) => !occupationIds.has(n));
    if (missing.length > 0) {
      console.error(`❌ Occupazioni assenti dal DB (esegui prima seed:*:occupations): ${missing.join(', ')}`);
      process.exit(1);
    }

    console.log('🗑️  Clearing items...');
    await itemsCol.deleteMany({});

    let created = 0;
    const categories: Record<string, number> = {};

    for (const row of records) {
      // Parse consumable fields
      const isConsumable = row.isConsumable === 'true';
      const consumesItems = row.consumesItems ? row.consumesItems.split(',').map(s => s.trim()) : [];
      const providesSkillBonus = row.providesSkillBonus ? row.providesSkillBonus.split(',').map(s => s.trim()) : [];

      // Parse weapon stats (only present for category=weapons rows)
      const weaponStats = row.weaponType ? {
        weaponType: row.weaponType,
        skill: row.weaponSkill,
        damageFormula: row.damageFormula,
        range: row.range || 'melee',
        requiresExtraction: row.requiresExtraction === 'true',
        applyBonusDamage: row.applyBonusDamage === 'true',
        halfBonusDamage: row.halfBonusDamage === 'true',
        ammoCapacity: row.ammoCapacity ? parseInt(row.ammoCapacity, 10) : undefined,
        rangeMeters: row.rangeMeters ? parseInt(row.rangeMeters, 10) : undefined,
        blastRadiusMeters: row.blastRadiusMeters ? parseInt(row.blastRadiusMeters, 10) : undefined,
      } : undefined;

      await itemsCol.insertOne({
        name: row.name,
        description: row.description,
        category: row.category,
        subcategory: row.subcategory || null,
        image: row.filename || null,
        basePrice: parseFloat(row.basePrice),
        // Nessun prerequisito per ora (decisione di prodotto): né di lavoro né di abilità.
        marketSection: row.marketSection,
        tradeOccupations: splitList(row.tradeOccupations).map((n) => occupationIds.get(n)),
        // Gli item solo admin (es. «Documento falso», prezzo variabile) non vanno al banco:
        // il negozio filtra per isPublic, sia nel catalogo sia all'acquisto.
        isPublic: row.isAdminOnly !== 'true',
        isAdminOnly: row.isAdminOnly === 'true',
        availableLocations: [],
        weaponStats,
        properties: {
          isStackable: false,
          isConsumable,
          consumptionType: row.consumptionType || undefined,
        },
        shopSettings: {
          canBePurchased: true,
          canBeSold: true,
          canBeTradedBetweenPlayers: true,
          hasLimitedStock: false,
        },
        financialSettings: {
          eligibleForCredit: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      created++;

      // Track categories
      categories[row.category] = (categories[row.category] || 0) + 1;

      if (created % 50 === 0) {
        console.log(`   💾 Processed ${created} items...`);
      }
    }

    console.log(`\n✨ Created ${created} items\n`);

    console.log('📊 Stats by category:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
    console.log('');

    console.log('   isPublic: true, tranne gli item isAdminOnly (non in vendita al banco)');

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedItems();
