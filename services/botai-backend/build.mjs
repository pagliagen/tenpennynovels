import * as esbuild from 'esbuild'

const isProd = process.env.NODE_ENV === 'production'

try {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/index.js',
    format: 'cjs',
    sourcemap: !isProd,
    minify: isProd,
    external: [
      '@anthropic-ai/sdk',
      'express',
      'mongoose',
      'axios',
      'cors',
      'dotenv',
      'helmet',
      'morgan',
      'winston'
    ],
    logLevel: 'info',
    loader: {
      '.json': 'json'
    }
  })

  console.log('✅ Build complete!')
} catch (error) {
  console.error('❌ Build failed:', error)
  process.exit(1)
}
