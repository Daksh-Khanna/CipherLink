import { build } from 'esbuild';
import { resolve } from 'node:path';
await build({
  entryPoints: ['src/index.ts'], outfile: 'dist/index.cjs', bundle: true,
  platform: 'node', target: 'node22', packages: 'external', sourcemap: true,
  plugins: [{ name: 'bundle-shared', setup(builder) {
    builder.onResolve({ filter: /^@cipherlink\/shared$/ }, () => ({ path: resolve('../shared/src/index.ts') }));
  } }],
});
console.log('Built server/dist/index.cjs.');
