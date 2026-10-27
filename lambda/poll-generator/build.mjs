import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: ['handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.mjs',
  format: 'esm',
  external: ['@aws-sdk/*'],
  alias: {
    '@': path.resolve(__dirname, '../../src'),
  },
  banner: {
    js: `import { createRequire } from 'module';
const require = createRequire(import.meta.url);`,
  },
  sourcemap: true,
  minify: false, // Keep readable for debugging
});

console.log('Build completed: dist/index.mjs');
