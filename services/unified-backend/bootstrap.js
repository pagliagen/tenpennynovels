/**
 * Bootstrap file - explicitly registers module aliases before loading the app
 * This ensures module-alias resolves paths correctly regardless of where it's loaded from
 */

const path = require('path');
const moduleAlias = require('module-alias');

// Explicitly register aliases relative to THIS directory (unified-backend root)
const rootDir = __dirname;

moduleAlias.addAliases({
  '@': path.join(rootDir, 'dist'),
  '@shared': path.join(rootDir, 'dist/shared'),
  '@modules': path.join(rootDir, 'dist/modules'),
  '@database': path.join(rootDir, 'dist/database'),
  '@config': path.join(rootDir, 'dist/config'),
});

console.log('✅ Module aliases registered from:', rootDir);
console.log('   @shared →', path.join(rootDir, 'dist/shared'));

// Now load the actual server
require('./dist/server');
