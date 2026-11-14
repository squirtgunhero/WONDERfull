// Bundles the standalone player into public/wonderfull-runtime.js. Runs before every build.
import { build } from 'esbuild';
await build({
  entryPoints: ['lib/embed.js'], bundle: true, minify: true, format: 'iife', globalName: 'WONDERfull',
  outfile: 'public/wonderfull-runtime.js', target: 'es2020', legalComments: 'none', logLevel: 'warning',
});
