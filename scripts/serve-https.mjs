import https from 'node:https'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { extname, join } from 'node:path';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
https.createServer({ key: readFileSync('/tmp/k.pem'), cert: readFileSync('/tmp/c.pem') }, (q, r) => {
  let p = join('/tmp/site', decodeURIComponent(new URL(q.url, 'https://x').pathname)); if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404); r.end('nf'); return; } r.writeHead(200, { 'content-type': T[extname(p)] ?? 'application/octet-stream', 'cache-control': 'max-age=600' }); r.end(readFileSync(p));
}).listen(8443, () => console.log('https on 8443'));
