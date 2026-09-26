import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A blank same-origin document for browser tests, not a product demo.
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Engine tests</title>');
    return;
  }
  if (!/^\/src\/[a-z-]+\.js$/.test(pathname)) { response.writeHead(404); response.end(); return; }
  try {
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    response.end(await readFile(path.join(root, pathname)));
  } catch { response.end(); }
}).listen(5187, '127.0.0.1');
