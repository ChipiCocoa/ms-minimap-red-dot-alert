// Static file server for local development. getDisplayMedia only works on a
// secure origin, and http://localhost counts as one.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Resolves a request path to a file inside the project, or null if it escapes. */
function resolveRequestPath(requestUrl) {
  const { pathname } = new URL(requestUrl, 'http://localhost');
  const relative = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const path = join(ROOT, relative === '/' ? 'index.html' : relative);
  return path.startsWith(ROOT) ? path : null;
}

export function createStaticServer() {
  return createServer(async (request, response) => {
    // Decoding happens inside the guard: a malformed escape such as `/%` throws
    // a URIError, and an unhandled rejection here takes the whole server down.
    let path;
    try {
      path = resolveRequestPath(request.url);
    } catch {
      response.writeHead(400).end('bad request');
      return;
    }

    if (!path) {
      response.writeHead(403).end('forbidden');
      return;
    }

    try {
      const body = await readFile(path);
      response.writeHead(200, {
        'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createStaticServer().listen(PORT, () => {
    console.log(`小地圖紅點警報：http://localhost:${PORT}`);
  });
}
