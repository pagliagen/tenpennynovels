#!/usr/bin/env node
// Legge metriche, issue e stato del quality gate da SonarCloud.
// Config: .env nella cartella della skill (vedi .env.example). Nessuna dipendenza npm.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const path = join(SKILL_DIR, '.env');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    fail(`File .env mancante: ${path}\nCopia .env.example in .env e inserisci il token.`);
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

function fail(msg) {
  console.error(`\x1b[31m${msg}\x1b[0m`);
  process.exit(1);
}

loadEnv();

const HOST = (process.env.SONAR_HOST || 'https://sonarcloud.io').replace(/\/$/, '');
const TOKEN = process.env.SONAR_TOKEN;
const ORG = process.env.SONAR_ORGANIZATION;
const PROJECT = process.env.SONAR_PROJECT_KEY;

if (!TOKEN) fail('SONAR_TOKEN non impostato nel .env');

async function api(path, params = {}) {
  const url = new URL(`${HOST}/api/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = typeof body === 'object' && body.errors ? body.errors.map((e) => e.msg).join('; ') : text;
    fail(`SonarCloud ${res.status} su /api/${path}: ${err}`);
  }
  return body;
}

const METRIC_KEYS = [
  'alert_status',
  'bugs',
  'vulnerabilities',
  'security_hotspots',
  'code_smells',
  'coverage',
  'duplicated_lines_density',
  'ncloc',
  'sqale_index', // technical debt in minuti
  'sqale_rating',
  'reliability_rating',
  'security_rating',
];

const RATING = { '1.0': 'A', '2.0': 'B', '3.0': 'C', '4.0': 'D', '5.0': 'E' };

function fmtMeasure(key, value) {
  if (value === undefined) return '—';
  switch (key) {
    case 'coverage':
    case 'duplicated_lines_density':
      return `${value}%`;
    case 'sqale_index': {
      const min = Number(value);
      const d = Math.floor(min / 60 / 8);
      const h = Math.floor((min / 60) % 8);
      return `${value} min (~${d}g ${h}h)`;
    }
    case 'sqale_rating':
    case 'reliability_rating':
    case 'security_rating':
      return RATING[value] || value;
    default:
      return String(value);
  }
}

function requireProject() {
  if (!PROJECT) fail('SONAR_PROJECT_KEY non impostato nel .env');
}

async function cmdSummary() {
  requireProject();
  const [status, measures] = await Promise.all([
    api('qualitygates/project_status', { projectKey: PROJECT }),
    api('measures/component', { component: PROJECT, metricKeys: METRIC_KEYS.join(',') }),
  ]);

  const byKey = Object.fromEntries((measures.component?.measures || []).map((m) => [m.metric, m.value]));

  console.log(`\nProgetto: ${PROJECT}${ORG ? `  (org: ${ORG})` : ''}`);
  const gate = status.projectStatus?.status;
  const gateColor = gate === 'OK' ? 32 : gate === 'ERROR' ? 31 : 33;
  console.log(`Quality gate: \x1b[${gateColor}m${gate}\x1b[0m\n`);

  const rows = [
    ['Bugs', 'bugs'],
    ['Vulnerabilità', 'vulnerabilities'],
    ['Security hotspots', 'security_hotspots'],
    ['Code smells', 'code_smells'],
    ['Coverage', 'coverage'],
    ['Duplicazione', 'duplicated_lines_density'],
    ['Righe di codice', 'ncloc'],
    ['Debito tecnico', 'sqale_index'],
    ['Rating manutenibilità', 'sqale_rating'],
    ['Rating affidabilità', 'reliability_rating'],
    ['Rating sicurezza', 'security_rating'],
  ];
  for (const [label, key] of rows) {
    console.log(`  ${label.padEnd(24)} ${fmtMeasure(key, byKey[key])}`);
  }

  const failing = (status.projectStatus?.conditions || []).filter((c) => c.status !== 'OK');
  if (failing.length) {
    console.log('\nCondizioni del gate non superate:');
    for (const c of failing) {
      console.log(`  ✗ ${c.metricKey}: ${c.actualValue} (soglia ${c.comparator} ${c.errorThreshold})`);
    }
  }
  console.log();
}

async function cmdIssues(args) {
  requireProject();
  const opts = parseFlags(args);
  const params = {
    componentKeys: PROJECT,
    organization: ORG,
    ps: opts.limit || '30',
    s: 'SEVERITY',
    asc: 'false',
    resolved: opts.resolved || 'false',
  };
  if (opts.severities) params.severities = opts.severities.toUpperCase();
  if (opts.types) params.types = opts.types.toUpperCase();
  if (opts.branch) params.branch = opts.branch;

  const data = await api('issues/search', params);
  console.log(`\nIssue: ${data.total} totali (mostro ${data.issues.length})\n`);
  for (const i of data.issues) {
    const loc = i.component?.replace(`${PROJECT}:`, '') || '';
    console.log(`  [${i.severity}] ${i.type}  ${loc}:${i.line ?? '?'}`);
    console.log(`    ${i.message}`);
    console.log(`    rule: ${i.rule}  effort: ${i.effort || '—'}\n`);
  }
}

async function cmdQualityGate() {
  requireProject();
  const status = await api('qualitygates/project_status', { projectKey: PROJECT });
  console.log(JSON.stringify(status.projectStatus, null, 2));
}

async function cmdMeasures(args) {
  requireProject();
  const opts = parseFlags(args);
  const keys = opts.keys || METRIC_KEYS.join(',');
  const data = await api('measures/component', { component: PROJECT, metricKeys: keys });
  for (const m of data.component?.measures || []) {
    console.log(`  ${m.metric.padEnd(28)} ${m.value ?? JSON.stringify(m.periods)}`);
  }
}

async function cmdProjects() {
  if (!ORG) fail('SONAR_ORGANIZATION non impostato nel .env');
  const data = await api('projects/search', { organization: ORG, ps: '100' });
  for (const p of data.components || []) {
    console.log(`  ${p.key.padEnd(40)} ${p.name}`);
  }
}

async function cmdRaw(args) {
  const [path, ...rest] = args;
  if (!path) fail('uso: raw <endpoint> [chiave=valore ...]  (es. raw project_branches/list project=' + (PROJECT || 'KEY') + ')');
  const params = Object.fromEntries(rest.map((kv) => kv.split('=').map((s) => s.trim())));
  const data = await api(path, params);
  console.log(JSON.stringify(data, null, 2));
}

function parseFlags(args) {
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([a-z-]+)=(.*)$/);
    if (m) out[m[1].replace(/-/g, '')] = m[2];
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);

const commands = {
  summary: cmdSummary,
  measures: cmdMeasures,
  issues: cmdIssues,
  'quality-gate': cmdQualityGate,
  projects: cmdProjects,
  raw: cmdRaw,
};

const fn = commands[cmd || 'summary'];
if (!fn) {
  console.log(`Comandi: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

fn(rest).catch((e) => fail(e.stack || String(e)));
