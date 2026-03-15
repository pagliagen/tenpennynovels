#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('services/unified-backend/src/modules/*/controllers/*.ts');

console.log(`🔄 Fixing imports in ${files.length} controllers...`);

let fixed = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf8');

  // Skip if doesn't use apiResponse
  if (!content.includes('apiResponse')) continue;

  // Remove old import line
  let newContent = content.replace(
    /^import\s*{\s*[^}]*}\s*from\s*['"]\.\.\/utils\/apiResponse['"];?\s*$/gm,
    ''
  );

  // Skip if already has new import
  if (newContent.includes("from '@shared/types/responses'")) continue;

  // Add new import after last existing import
  const lines = newContent.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0,
      "import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';"
    );
    newContent = lines.join('\n');

    writeFileSync(file, newContent, 'utf8');
    fixed++;
    console.log(`✓ ${file}`);
  }
}

console.log(`\n✅ Fixed ${fixed} files!`);
