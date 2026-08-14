/**
 * Verifica i confini fra core/ e features/ (Fase 5 del refactor, vedi
 * docs/refactor/FEATURE-MODULES-PLAN.md §5).
 *
 * Usa il Compiler API di TypeScript per estrarre gli import reali di ogni
 * file — non regex sul sorgente, che romperebbe silenziosamente su
 * dynamic import() (pattern usato pesantemente in
 * features/corporazioni/controllers/CorporationManagementController.ts,
 * 12 occorrenze) o su una stringa che assomiglia a un import dentro un
 * commento.
 *
 * Regole enforced (asimmetriche: core è più vincolato di qualunque altro
 * chiamante esterno):
 * 1. src/core/** non importa MAI un percorso che risolve dentro
 *    src/features/** — nemmeno tramite api.ts pubblica di una feature.
 * 2. src/features/<a>/** importa da src/features/<b>/** (b !== a) SOLO
 *    tramite src/features/<b>/api.ts, e solo se <b> compare in
 *    dependsOn del manifest di <a>.
 * 3. Qualunque altro file (modules/, shared/, ecc.) importa da
 *    src/features/<b>/** SOLO tramite src/features/<b>/api.ts — non ha
 *    un manifest, quindi nessun controllo dependsOn è applicabile: il
 *    vincolo "solo api.ts" da solo implementa anche la protezione di
 *    un'eventuale features/<b>/internal/ (mai nominata esplicitamente:
 *    qualunque file diverso da api.ts è ugualmente vietato dall'esterno).
 *
 * dependsOn viene letto staticamente dal sorgente di ogni manifest.ts
 * (property assignment con inizializzatore ArrayLiteralExpression di
 * stringhe) — niente import dinamico dei manifest reali: evita di
 * eseguire codice con side-effect (registrazione model Mongoose) in
 * quello che deve restare un controllo statico e veloce.
 *
 * Uso: npx tsx src/scripts/check-boundaries.ts
 * Exit 0 se pulito, 1 con l'elenco delle violazioni altrimenti.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..');
const CORE_ROOT = path.join(SRC_ROOT, 'core');
const FEATURES_ROOT = path.join(SRC_ROOT, 'features');

const EXCLUDED_SUFFIXES = ['.d.ts', '.test.ts', '.spec.ts', '.old.ts', '.backup.ts'];
const EXCLUDED_DIR_NAMES = new Set(['node_modules', 'dist']);

interface Violation {
  location: string;
  rule: string;
  detail: string;
}

interface ImportSpecifier {
  text: string;
  /** Il nodo della stringa specifier — usato per il numero di riga riportato nella violazione. */
  node: ts.Node;
  /**
   * Il nodo dell'intera dichiarazione (import/export/dynamic import) —
   * usato per cercare un commento `// boundary-allow` in testa alla
   * dichiarazione. Per un export multi-riga lo specifier sta sull'ultima
   * riga, molto sotto il commento: serve la riga di INIZIO della
   * dichiarazione, non quella dello specifier.
   */
  statementNode: ts.Node;
}

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && full.endsWith('.ts') && !EXCLUDED_SUFFIXES.some((s) => full.endsWith(s))) {
      out.push(full);
    }
  }
  return out;
}

/** `ts.isImportCall` non è nell'API pubblica di questa versione di TypeScript: stesso controllo esplicito, come type predicate. */
function isDynamicImportCall(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function extractImportSpecifiers(filePath: string): ImportSpecifier[] {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const specifiers: ImportSpecifier[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push({ text: node.moduleSpecifier.text, node: node.moduleSpecifier, statementNode: node });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push({ text: node.moduleSpecifier.text, node: node.moduleSpecifier, statementNode: node });
    } else if (isDynamicImportCall(node)) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        specifiers.push({ text: arg.text, node: arg, statementNode: node });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return specifiers;
}

/** Risolve un module specifier a un path assoluto. null se non è @core/@features/relativo (npm package o altro alias — irrilevante per questo check). */
function resolveSpecifier(specifier: string, importingFile: string): string | null {
  if (specifier.startsWith('@features/')) {
    return path.normalize(path.join(FEATURES_ROOT, specifier.slice('@features/'.length)));
  }
  if (specifier.startsWith('@core/')) {
    return path.normalize(path.join(CORE_ROOT, specifier.slice('@core/'.length)));
  }
  if (specifier.startsWith('.')) {
    return path.normalize(path.resolve(path.dirname(importingFile), specifier));
  }
  return null;
}

function isUnderDir(absPath: string, dir: string): boolean {
  const rel = path.relative(dir, absPath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const featureDirNames = new Set(
  fs.existsSync(FEATURES_ROOT)
    ? fs.readdirSync(FEATURES_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : []
);

/**
 * Nome della feature proprietaria di absPath, o null se absPath non è
 * sotto una vera sottodirectory di src/features/. src/features/index.ts
 * (il registro) e altri eventuali file diretti in FEATURES_ROOT non sono
 * una feature — solo le sottodirectory reali lo sono.
 */
function featureNameOf(absPath: string): string | null {
  const rel = path.relative(FEATURES_ROOT, absPath);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const first = rel.split(path.sep)[0];
  return first && featureDirNames.has(first) ? first : null;
}

function isFeatureApiEntry(absPath: string, featureName: string): boolean {
  const withExt = path.join(FEATURES_ROOT, featureName, 'api.ts');
  const withoutExt = path.join(FEATURES_ROOT, featureName, 'api');
  return absPath === withExt || absPath === withoutExt;
}

function extractDependsOn(manifestFilePath: string): string[] {
  const sourceText = fs.readFileSync(manifestFilePath, 'utf8');
  const sourceFile = ts.createSourceFile(manifestFilePath, sourceText, ts.ScriptTarget.Latest, true);
  let dependsOn: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'dependsOn' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      dependsOn = node.initializer.elements.filter(ts.isStringLiteral).map((el) => el.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return dependsOn;
}

function buildDependsOnMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!fs.existsSync(FEATURES_ROOT)) return map;

  for (const entry of fs.readdirSync(FEATURES_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(FEATURES_ROOT, entry.name, 'manifest.ts');
    if (fs.existsSync(manifestPath)) {
      map.set(entry.name, extractDependsOn(manifestPath));
    }
  }
  return map;
}

const FEATURES_INDEX_FILE = path.join(FEATURES_ROOT, 'index.ts');
const ALLOW_COMMENT_MARKER = 'boundary-allow';

/**
 * src/features/index.ts (il registro) importa manifest.ts di ogni
 * feature per costruire FEATURES — è l'unico punto dell'architettura
 * dove farlo è corretto by design, non un'eccezione da segnalare a
 * commento: senza questo, il registry non potrebbe esistere.
 */
function isRegistryManifestImport(importingFile: string, resolved: string, targetFeature: string): boolean {
  if (importingFile !== FEATURES_INDEX_FILE) return false;
  const withExt = path.join(FEATURES_ROOT, targetFeature, 'manifest.ts');
  const withoutExt = path.join(FEATURES_ROOT, targetFeature, 'manifest');
  return resolved === withExt || resolved === withoutExt;
}

/**
 * Escape hatch per eccezioni deliberate e temporanee (es. lo shim in
 * database/models/index.ts verso features/corporazioni/models/Corporation,
 * previsto esplicitamente dal piano fino alla Fase 6). Marcatura per riga,
 * non per file: `// boundary-allow: <motivo>` sulla riga dell'import o
 * su quella immediatamente precedente. A differenza del carve-out per il
 * registry, questa è un'eccezione che qualcuno ha scelto consapevolmente
 * riga per riga — deve restare visibile nel diff, non nascosta nello script.
 */
function hasAllowComment(sourceLines: string[], oneBasedLine: number): boolean {
  const sameLine = sourceLines[oneBasedLine - 1] ?? '';
  const lineAbove = sourceLines[oneBasedLine - 2] ?? '';
  return sameLine.includes(ALLOW_COMMENT_MARKER) || lineAbove.includes(ALLOW_COMMENT_MARKER);
}

function checkFile(filePath: string, dependsOnMap: Map<string, string[]>): Violation[] {
  const violations: Violation[] = [];
  const fileIsUnderCore = isUnderDir(filePath, CORE_ROOT);
  const ownFeature = featureNameOf(filePath);
  const sourceLines = fs.readFileSync(filePath, 'utf8').split('\n');

  for (const { text, node, statementNode } of extractImportSpecifiers(filePath)) {
    const resolved = resolveSpecifier(text, filePath);
    if (!resolved) continue;

    const targetFeature = featureNameOf(resolved);
    if (!targetFeature) continue;

    if (isRegistryManifestImport(filePath, resolved, targetFeature)) continue;

    const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1;
    const statementLine = ts.getLineAndCharacterOfPosition(statementNode.getSourceFile(), statementNode.getStart()).line + 1;
    const location = `${path.relative(SRC_ROOT, filePath)}:${line}`;

    if (fileIsUnderCore) {
      violations.push({
        location,
        rule: 'core-non-importa-feature',
        detail: `core/ importa "${text}" (risolve in features/${targetFeature}/) — vietato anche via api.ts, il core non dipende mai da una feature`,
      });
      continue;
    }

    if (targetFeature === ownFeature) continue; // una feature importa liberamente da sé stessa

    const isApiEntry = isFeatureApiEntry(resolved, targetFeature);
    if (!isApiEntry) {
      if (hasAllowComment(sourceLines, statementLine)) continue;
      violations.push({
        location,
        rule: ownFeature ? 'feature-importa-interno-altrui' : 'esterno-importa-interno-feature',
        detail: `importa "${text}" (risolve fuori da features/${targetFeature}/api) — solo features/${targetFeature}/api.ts è pubblico. Se è un'eccezione deliberata (es. shim di migrazione), marcarla con "// ${ALLOW_COMMENT_MARKER}: <motivo>"`,
      });
      continue;
    }

    if (ownFeature) {
      const declared = dependsOnMap.get(ownFeature) ?? [];
      if (!declared.includes(targetFeature)) {
        violations.push({
          location,
          rule: 'dependsOn-mancante',
          detail: `importa da features/${targetFeature}/api ma "${targetFeature}" non è dichiarata in dependsOn del manifest di ${ownFeature}`,
        });
      }
    }
  }

  return violations;
}

function main(): void {
  const files = collectTsFiles(SRC_ROOT);
  const dependsOnMap = buildDependsOnMap();

  const violations = files.flatMap((f) => checkFile(f, dependsOnMap));

  if (violations.length === 0) {
    process.stdout.write(`check-boundaries: pulito (${files.length} file analizzati)\n`);
    process.exit(0);
  }

  process.stderr.write(`check-boundaries: ${violations.length} violazione/i trovate\n\n`);
  for (const v of violations) {
    process.stderr.write(`${v.location}  [${v.rule}]\n  ${v.detail}\n\n`);
  }
  process.exit(1);
}

main();
