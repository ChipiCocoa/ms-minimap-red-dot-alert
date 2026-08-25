// Produces the deployable site in dist/.
//
// The app is bundled and minified, and the JS and CSS filenames carry a content
// hash so a new version is never served from a stale cache. The service worker
// keeps its plain name because the page registers it by path.

import { rm, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');

// Anything that supports MediaStreamTrackProcessor is far newer than this, so
// there is nothing to transpile down to.
const TARGET = 'es2022';

/** Bundles one entry point and returns its hashed output filename. */
async function bundle(entry) {
  const result = await build({
    entryPoints: [join(ROOT, entry)],
    outdir: DIST,
    entryNames: '[name]-[hash]',
    bundle: true,
    minify: true,
    format: 'esm',
    target: TARGET,
    sourcemap: true,
    metafile: true,
    logLevel: 'warning',
  });

  const [output] = Object.keys(result.metafile.outputs).filter((file) => !file.endsWith('.map'));
  return basename(output);
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const [scriptFile, styleFile] = await Promise.all([
    bundle('src/main.js'),
    bundle('styles.css'),
  ]);

  const html = (await readFile(join(ROOT, 'index.html'), 'utf8'))
    .replace('href="styles.css"', `href="${styleFile}"`)
    .replace('src="src/main.js"', `src="${scriptFile}"`);

  if (html.includes('src/main.js') || html.includes('"styles.css"')) {
    throw new Error('index.html still references unbundled assets');
  }

  await writeFile(join(DIST, 'index.html'), html);
  await copyFile(join(ROOT, 'sw.js'), join(DIST, 'sw.js'));

  console.log(`built dist/: index.html, ${scriptFile}, ${styleFile}, sw.js`);
}

await main();
