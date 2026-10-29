// v2.1.0: dist/version.json — the running game (web and Android app) compares it with its own VERSION to pick up updates.
import { readFileSync, writeFileSync } from 'node:fs';
const v = /export const VERSION = '([^']+)'/.exec(readFileSync('src/ui/v2.ts', 'utf8'))[1];
writeFileSync('dist/version.json', JSON.stringify({ version: v, at: new Date().toISOString() }) + '\n');
console.log('version.json', v);
