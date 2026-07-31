import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8']
]);

function safePathname(requestUrl) {
  const parsed = new URL(requestUrl, `http://${HOST}:${PORT}`);
  const decoded = decodeURIComponent(parsed.pathname);
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, '');
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    throw Object.assign(new Error('Invalid path'), { statusCode: 400 });
  }
  return normalized;
}

async function resolveFile(requestUrl) {
  let relative = safePathname(requestUrl);
  if (!relative || relative.endsWith('/')) relative = `${relative}index.html`;

  let candidate = path.join(ROOT, relative);
  try {
    const stat = await fs.stat(candidate);
    if (stat.isDirectory()) candidate = path.join(candidate, 'index.html');
    const finalStat = await fs.stat(candidate);
    if (finalStat.isFile()) return { file: candidate, statusCode: 200 };
  } catch {
    // Fall through to the custom 404 page.
  }

  return { file: path.join(ROOT, '404.html'), statusCode: 404 };
}

const server = http.createServer(async (request, response) => {
  try {
    const { file, statusCode } = await resolveFile(request.url || '/');
    const body = await fs.readFile(file);
    const type = MIME_TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream';

    response.writeHead(statusCode, {
      'Content-Type': type,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch (error) {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error.statusCode === 400 ? 'Bad request' : 'Internal server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Static audit server listening at http://${HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
