import type { Building, Person, World } from '../sim/types';
import { MAP_H, MAP_W } from '../sim/constants';
import { electionPhase } from '../sim/tick';
import { ROADS_X, ROADS_Y } from '../sim/world';
import { shade, spriteFor } from './sprites';

export const T = 16;

const ROOF: Record<string, string> = {
  saray: '#7b2d8b', meclis: '#2d5b8b', mahkeme: '#5a4636', zindan: '#3c3c3c', kisla: '#8b2d2d', cami: '#3a8a6a', okul: '#b5652b',
  hekimhane: '#e4e4e4', kahve: '#8b5a2b', pazar: '#c9a227', firin: '#b5442b', kasap: '#9b2b2b', degirmen: '#8a7a5a', kuyu: '#5a6a7a',
  atolye: '#6a5a4a', santiye: '#c08a2a', liman: '#4a6a8a', ev: '#a8553a',
  bar: '#6a2a4a', festival: '#c04a8a', dokuma: '#7a5a8a', mobilyahane: '#6a4a2a', ambar: '#9a7a3a', yapi: '#8a6a9a',
};

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function buildStatic(w: World): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = MAP_W * T; c.height = MAP_H * T;
  const g = c.getContext('2d')!;
  // grass with dither
  for (let y = 0; y < MAP_H; y += 1) for (let x = 0; x < MAP_W; x += 1) {
    const h = hash(`${x},${y}`);
    g.fillStyle = h % 7 === 0 ? '#5f9a3e' : h % 5 === 0 ? '#6aa847' : '#64a242'; g.fillRect(x * T, y * T, T, T);
    if (h % 11 === 0) { g.fillStyle = '#4f8a33'; g.fillRect(x * T + (h % 12), y * T + ((h >> 4) % 12), 2, 2); }
    if (h % 37 === 0) { g.fillStyle = '#e8d84a'; g.fillRect(x * T + 6, y * T + 6, 2, 2); }
  }
  // sea
  for (let y = 48; y < MAP_H; y += 1) for (let x = 0; x < MAP_W; x += 1) {
    g.fillStyle = y === 48 ? '#d8c890' : (x + y) % 3 === 0 ? '#2f6fa8' : '#3577b0'; g.fillRect(x * T, y * T, T, T);
    if (y > 48 && hash(`s${x},${y}`) % 6 === 0) { g.fillStyle = '#8ab8e0'; g.fillRect(x * T + 3, y * T + 7, 6, 1); }
  }
  // roads
  g.fillStyle = '#b8a070';
  for (const ry of ROADS_Y) g.fillRect(0, ry * T, MAP_W * T, T);
  for (const rx of ROADS_X) g.fillRect(rx * T, 0, T, 48 * T);
  g.fillStyle = '#a08a5a';
  for (const ry of ROADS_Y) for (let x = 0; x < MAP_W; x += 2) g.fillRect(x * T + 4, ry * T + 7, 4, 2);
  // plaza in front of the big pazar
  g.fillStyle = '#c8b48a'; g.fillRect(28 * T, 20 * T, 16 * T, 9 * T);
  for (const b of w.buildings) {
    // path from the door to the nearest road
    const ry = ROADS_Y.reduce((a, r) => (Math.abs(r - b.door.y) < Math.abs(a - b.door.y) ? r : a), ROADS_Y[0]!);
    g.fillStyle = '#b8a070'; const y0 = Math.min(ry, b.door.y), y1 = Math.max(ry, b.door.y);
    g.fillRect(b.door.x * T + 4, y0 * T, 8, (y1 - y0 + 1) * T);
  }
  for (const b of w.buildings) drawBuilding(g, b);
  // trees
  for (let i = 0; i < 90; i += 1) {
    const h = hash(`t${i}`); const x = h % MAP_W; const y = (h >> 8) % 47;
    if (w.buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h + 1)) continue;
    if (ROADS_Y.includes(y) || ROADS_X.includes(x)) continue;
    g.fillStyle = '#5a3a1a'; g.fillRect(x * T + 7, y * T + 9, 3, 6);
    g.fillStyle = '#2f6a2a'; g.fillRect(x * T + 2, y * T + 1, 12, 9); g.fillStyle = '#3f8a35'; g.fillRect(x * T + 4, y * T + 2, 7, 5);
  }
  return c;
}

function drawBuilding(g: CanvasRenderingContext2D, b: Building): void {
  const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
  const roof = ROOF[b.kind] ?? '#8a5a3a';
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X + 4, Y + 6, W, H);
  if (b.kind === 'pazar' || b.kind === 'kahve') {
    // stalls with striped awnings
    g.fillStyle = '#d8c49a'; g.fillRect(X, Y, W, H);
    const n = Math.max(2, Math.floor(b.w / 3));
    for (let i = 0; i < n; i += 1) {
      const sx = X + 4 + i * (W - 8) / n; const sw = (W - 8) / n - 4;
      for (let k = 0; k < sw; k += 4) { g.fillStyle = k % 8 === 0 ? (b.kind === 'kahve' ? '#8b5a2b' : roof) : '#f4f0e0'; g.fillRect(sx + k, Y + 4, 4, 10); }
      g.fillStyle = '#7a5a3a'; g.fillRect(sx, Y + 14, sw, 6); g.fillRect(sx, Y + 20, 2, H - 26); g.fillRect(sx + sw - 2, Y + 20, 2, H - 26);
      const goods = ['#e0a040', '#c03030', '#4a8ad0', '#f0f0f0', '#6a4a2a'];
      for (let k = 0; k < 3; k += 1) { g.fillStyle = goods[(i + k) % goods.length]!; g.fillRect(sx + 3 + k * 5, Y + 16, 4, 3); }
    }
    if (b.kind === 'kahve') { g.fillStyle = '#5a3a1a'; for (let i = 0; i < 3; i += 1) g.fillRect(X + 10 + i * 28, Y + H - 14, 10, 8); }
    return;
  }
  if (b.kind === 'santiye') {
    g.fillStyle = '#a08a6a'; g.fillRect(X, Y, W, H);
    g.fillStyle = '#c8c0b0'; for (let i = 0; i < 4; i += 1) g.fillRect(X + 8 + i * 28, Y + 20, 20, 30);
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; for (let i = 0; i < W; i += 16) { g.beginPath(); g.moveTo(X + i, Y); g.lineTo(X + i + 16, Y + H); g.stroke(); }
    g.fillStyle = '#e0b020'; g.fillRect(X + W - 20, Y - 30, 4, H + 30); g.fillRect(X + W - 60, Y - 30, 44, 4);
    return;
  }
  if (b.kind === 'liman') {
    g.fillStyle = '#7a5a3a'; g.fillRect(X, Y, W, H + 3 * T); g.fillStyle = '#5a4026'; for (let i = 0; i < W; i += 8) g.fillRect(X + i, Y, 2, H + 3 * T);
    g.fillStyle = '#8a3a2a'; g.fillRect(X + 10, Y + H + 20, 40, 12); g.fillStyle = '#f0f0e8'; g.fillRect(X + 26, Y + H - 4, 3, 24); g.fillRect(X + 29, Y + H - 2, 14, 16);
    g.fillStyle = '#3a6a8a'; g.fillRect(X + W - 60, Y + 6, 50, H - 12);
    return;
  }
  if (b.kind === 'ciftlik') {
    for (let yy = 0; yy < b.h; yy += 1) { g.fillStyle = yy % 2 ? '#c8a840' : '#a88a30'; g.fillRect(X, Y + yy * T, W, T); g.fillStyle = '#e0c860'; for (let xx = 2; xx < W; xx += 6) g.fillRect(X + xx, Y + yy * T + 3, 2, 8); }
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.strokeRect(X, Y, W, H); return;
  }
  if (b.kind === 'arsa') {
    g.fillStyle = '#9a8a6a'; g.fillRect(X, Y, W, H); g.fillStyle = '#7a6a4a'; for (let i = 0; i < 30; i += 1) { const hh = hash(b.id + i); g.fillRect(X + (hh % W), Y + ((hh >> 8) % H), 3, 2); }
    g.fillStyle = '#e0e0d0'; for (const [cx, cy] of [[X, Y], [X + W - 3, Y], [X, Y + H - 3], [X + W - 3, Y + H - 3]] as const) g.fillRect(cx, cy, 3, 3);
    g.strokeStyle = 'rgba(240,240,220,0.7)'; g.setLineDash([4, 4]); g.lineWidth = 1; g.strokeRect(X + 1, Y + 1, W - 2, H - 2); g.setLineDash([]); return;
  }
  if (b.kind === 'festival') {
    g.fillStyle = '#b8c87a'; g.fillRect(X, Y, W, H); g.fillStyle = '#e0d0a0'; g.fillRect(X + W / 2 - 20, Y + H / 2 - 12, 40, 24);
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.strokeRect(X, Y, W, H); return;
  }
  if (b.kind === 'kuyu') {
    g.fillStyle = '#7a7a7a'; g.fillRect(X + 6, Y + 14, W - 12, H - 18); g.fillStyle = '#2a4a8a'; g.fillRect(X + 10, Y + 18, W - 20, 8);
    g.fillStyle = '#6a4a2a'; g.fillRect(X + 6, Y + 2, 3, 14); g.fillRect(X + W - 9, Y + 2, 3, 14); g.fillStyle = roof; g.fillRect(X + 2, Y, W - 4, 5);
    return;
  }
  // generic building: walls + roof
  const wall = b.kind === 'saray' ? '#efe2c2' : b.kind === 'zindan' ? '#6a6a6a' : b.kind === 'hekimhane' ? '#f4f4f4' : '#dcc8a0';
  const roofH = Math.max(T, Math.floor(H * 0.45));
  g.fillStyle = wall; g.fillRect(X, Y + roofH - 4, W, H - roofH + 4);
  g.fillStyle = shade(wall, -0.15); g.fillRect(X, Y + H - 4, W, 4);
  g.fillStyle = roof; g.fillRect(X - 2, Y, W + 4, roofH);
  g.fillStyle = shade(roof, -0.25); for (let yy = Y + 4; yy < Y + roofH; yy += 5) g.fillRect(X - 2, yy, W + 4, 1);
  g.fillStyle = shade(roof, 0.2); g.fillRect(X - 2, Y, W + 4, 2);
  // windows
  g.fillStyle = b.kind === 'zindan' ? '#222' : '#5a8ab0';
  for (let wx = X + 6; wx < X + W - 8; wx += 14) { g.fillRect(wx, Y + roofH + 4, 6, 6); if (b.kind === 'zindan') { g.fillStyle = '#999'; g.fillRect(wx + 2, Y + roofH + 4, 1, 6); g.fillStyle = '#222'; } }
  // door
  g.fillStyle = '#5a3a1a'; g.fillRect(b.door.x * T + 3, Y + H - 14, 10, 14); g.fillStyle = '#c9a227'; g.fillRect(b.door.x * T + 10, Y + H - 8, 2, 2);
  // specials
  if (b.kind === 'cami') { g.fillStyle = '#f0f0e8'; g.fillRect(X + W - 10, Y - 26, 6, roofH + 26); g.fillStyle = roof; g.fillRect(X + W - 11, Y - 32, 8, 6); g.fillStyle = '#4aa07a'; g.beginPath(); g.arc(X + W / 2 - 6, Y + 6, W / 4, Math.PI, 0); g.fill(); }
  if (b.kind === 'saray') { g.fillStyle = '#f2c230'; for (let i = 0; i < 4; i += 1) g.fillRect(X + 8 + i * (W - 16) / 3, Y - 12, 6, 12); g.fillStyle = '#c03030'; g.fillRect(X + W / 2, Y - 26, 2, 18); g.fillRect(X + W / 2 + 2, Y - 26, 12, 8); }
  if (b.kind === 'kisla') { g.fillStyle = '#c03030'; g.fillRect(X + 6, Y - 18, 2, 18); g.fillRect(X + 8, Y - 18, 12, 7); g.fillStyle = '#8a8a8a'; for (let i = 0; i < W; i += 10) g.fillRect(X + i, Y - 4, 5, 4); }
  if (b.kind === 'meclis') { g.fillStyle = '#f0f0f0'; for (let i = 0; i < 5; i += 1) g.fillRect(X + 6 + i * (W - 16) / 4, Y + roofH, 4, H - roofH - 4); }
  if (b.kind === 'mahkeme') { g.fillStyle = '#c9a227'; g.fillRect(X + W / 2 - 8, Y + 6, 16, 2); g.fillRect(X + W / 2 - 1, Y + 2, 2, 10); }
  if (b.kind === 'hekimhane') { g.fillStyle = '#d03030'; g.fillRect(X + W / 2 - 6, Y + 4, 12, 4); g.fillRect(X + W / 2 - 2, Y, 4, 12); }
  if (b.kind === 'degirmen') { g.strokeStyle = '#f0e8d8'; g.lineWidth = 3; const cx = X + W / 2, cy = Y + 8; for (let a = 0; a < 4; a += 1) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a * Math.PI / 2 + 0.4) * 26, cy + Math.sin(a * Math.PI / 2 + 0.4) * 26); g.stroke(); } }
  if (b.kind === 'bar') { g.fillStyle = '#c9a227'; g.fillRect(X + 4, Y + roofH + 2, 14, 8); g.fillStyle = '#6a2a1a'; g.fillRect(X + W - 18, Y + H - 12, 8, 10); }
  if (b.kind === 'ambar') { g.fillStyle = '#e0c860'; g.fillRect(X + W / 2 - 10, Y + roofH + 2, 20, 6); }
  if (b.kind === 'firin') { g.fillStyle = '#7a7a7a'; g.fillRect(X + W - 14, Y - 12, 8, 14); g.fillStyle = 'rgba(220,220,220,0.7)'; g.fillRect(X + W - 16, Y - 22, 10, 6); }
}

export { nearestRoad, placePeople, type Placed } from '../sim/place';
import { TALK_MS, type Placed } from '../sim/place';
import type { Corpse } from '../sim/types';
const findPersonLite = (w: World, id: string | undefined): Person | undefined => (id ? w.people.find((p) => p.id === id) : undefined);
export const SPRITE_SCALE = 1.4;
/** The Meydan election notice board (tile coords). */
export const SIGN = { x: 28.6, y: 21.2 };

export interface Camera { x: number; y: number; z: number }

export function drawFrame(ctx: CanvasRenderingContext2D, stat: HTMLCanvasElement, w: World, cam: Camera, placed: Placed[], now: number, selected: string | null, myPersonId: string | null, dark: number, target: { x: number; y: number } | null = null): void {
  const cw = ctx.canvas.width, ch = ctx.canvas.height; const z = cam.z * T;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#5a9238'; ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(stat, Math.round(-cam.x * z), Math.round(-cam.y * z), Math.round(stat.width * cam.z), Math.round(stat.height * cam.z));
  const sz = Math.round(T * cam.z * SPRITE_SCALE);
  drawSign(ctx, w, cam, z, now);
  // corpses: blood pool + body lying on the ground
  for (const co of w.corpses ?? []) drawCorpse(ctx, co, cam, z, sz, now);
  if (target) { const tx = (target.x - cam.x) * z, ty = (target.y - cam.y) * z; ctx.strokeStyle = 'rgba(255,240,120,0.9)'; ctx.lineWidth = 2; const r0 = sz * (0.25 + 0.08 * Math.sin(now / 150)); ctx.beginPath(); ctx.ellipse(tx, ty, r0, r0 * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); }
  // people sorted by y
  const vis = placed.filter((q) => q.visible).sort((a, b) => a.y - b.y);
  for (const q of vis) {
    const sx = (q.x - cam.x) * z, sy = (q.y - cam.y) * z;
    if (sx < -sz || sy < -sz * 2 || sx > cw + sz || sy > ch + sz) continue;
    const fr = spriteFor(q.p); const f = q.moving ? Math.floor(now / 220 + q.x * 3) % 2 : 0;
    if (q.p.id === selected || q.p.id === myPersonId) {
      ctx.fillStyle = q.p.id === selected ? 'rgba(255,230,80,0.55)' : 'rgba(120,200,255,0.5)';
      ctx.beginPath(); ctx.ellipse(sx, sy, sz * 0.45, sz * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (q.dir < 0) { ctx.save(); ctx.translate(Math.round(sx), 0); ctx.scale(-1, 1); ctx.drawImage(fr[f]!, Math.round(-sz / 2), Math.round(sy - sz), sz, sz); ctx.restore(); }
    else ctx.drawImage(fr[f]!, Math.round(sx - sz / 2), Math.round(sy - sz), sz, sz);
    if (q.p.id === myPersonId) { ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.moveTo(sx - 5, sy - sz - 10); ctx.lineTo(sx + 5, sy - sz - 10); ctx.lineTo(sx, sy - sz - 3); ctx.fill(); }
  }
  // children: small sprites near home during the day
  if (w.hour >= 8 && w.hour < 20) {
    const cs = Math.round(sz * 0.6);
    for (const c of w.children) {
      const b = w.buildings.find((x) => x.id === (c.inSchool && w.hour < 14 ? 'okul' : (findPersonLite(w, c.parents[0])?.home ?? 'ev1'))); if (!b) continue;
      const hh = hash(c.id); const x = b.door.x + ((hh % 100) / 100 - 0.5) * 2.4 + Math.sin(now / 700 + hh) * 0.4; const y = b.door.y + 0.6 + ((hh >> 8) % 100) / 300;
      const sx = (x - cam.x) * z, sy = (y - cam.y) * z; if (sx < -cs || sy < -cs || sx > cw + cs || sy > ch + cs) continue;
      const pseudo = { id: c.id, prof: 'hamal', female: c.female, hairColor: c.hairColor, skin: c.skin, shirt: c.shirt } as unknown as Person;
      ctx.drawImage(spriteFor(pseudo)[Math.floor(now / 260 + hh) % 2]!, Math.round(sx - cs / 2), Math.round(sy - cs), cs, cs);
      if (c.sick > 0) { ctx.font = `${Math.round(cs * 0.6)}px system-ui`; ctx.fillText('🤒', sx, sy - cs - 4); }
    }
  }
  // isyan: occupied buildings
  if (w.isyan) for (const id of w.isyan.occupied) {
    const b = w.buildings.find((x) => x.id === id); if (!b) continue;
    ctx.fillStyle = 'rgba(200,30,30,0.28)'; ctx.fillRect((b.x - cam.x) * z, (b.y - cam.y) * z, b.w * z, b.h * z);
    ctx.font = `${Math.round(sz * 0.9)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('🚩', (b.x + b.w / 2 - cam.x) * z, (b.y - cam.y) * z + sz * 0.6 + Math.sin(now / 250) * 3);
  }
  // night overlay
  if (dark > 0) { ctx.fillStyle = `rgba(10,15,45,${dark})`; ctx.fillRect(0, 0, cw, ch); }
  // labels
  const fs = Math.max(10, Math.min(15, 5 * cam.z));
  ctx.font = `bold ${fs}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of w.buildings) {
    if (b.kind === 'ev' && cam.z < 2.2) continue;
    const sx = (b.x + b.w / 2 - cam.x) * z, sy = (b.y - cam.y) * z - fs * 0.9;
    if (sx < -200 || sy < -40 || sx > cw + 200 || sy > ch + 40) continue;
    const label = b.kind === 'ev' ? '🏠' : b.name;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(20,14,8,0.78)'; ctx.fillRect(sx - tw / 2, sy - fs * 0.75, tw, fs * 1.5);
    ctx.fillStyle = b.market ? '#ffd76a' : '#ffffff'; ctx.fillText(label, sx, sy);
  }
  // thought bubbles: selected + a rotating few
  const showN = 0; const rot = Math.floor(now / 6000);
  const bubbles = vis.filter((q, i) => q.p.id === selected || (q.p.thought && (i + rot) % Math.max(1, Math.floor(vis.length / Math.max(1, showN))) === 0)).slice(0, showN + 1);
  ctx.font = `${Math.max(10, fs - 2)}px system-ui, sans-serif`;
  for (const q of bubbles) {
    if (!q.p.thought) continue;
    const sx = (q.x - cam.x) * z, sy = (q.y - cam.y) * z - sz - 8;
    const text = q.p.thought.length > 34 ? q.p.thought.slice(0, 33) + '…' : q.p.thought;
    const tw = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(sx - tw / 2, sy - 22, tw, 20, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillText(text, sx, sy - 12);
  }
  // conversations: they walk up to each other, then speak in turns
  const byId = new Map(vis.map((q) => [q.p.id, q]));
  ctx.font = `${Math.max(10, fs - 2)}px system-ui, sans-serif`;
  if (cam.z >= 1.4) for (const tk of (w.talks ?? [])) {
    if (!tk.at || now < tk.at + 5000 || now > tk.at + TALK_MS) continue;
    const lines = tk.lines?.length ? tk.lines : [tk.text]; const k = Math.floor((now - tk.at - 5000) / 9000); if (k >= lines.length * 2) continue;
    const li = k % lines.length; const q = byId.get(li % 2 === 0 ? tk.a : tk.b); if (!q) continue;
    bubble(ctx, (q.x - cam.x) * z, (q.y - cam.y) * z - sz - 8, lines[li]!, cw);
  }
  // festival flags, campaign posters, construction at a plot
  const fb = w.buildings.find((x) => x.id === 'festival');
  if (fb && (w.festivalUntil ?? 0) >= w.day) { ctx.font = `${Math.round(fs * 1.4)}px system-ui`; for (let i = 0; i < 5; i += 1) ctx.fillText(['🎉', '🎊', '🏮', '🎶', '🎉'][i]!, (fb.x + 1 + i * (fb.w - 2) / 4 - cam.x) * z, (fb.y - cam.y) * z + Math.sin(now / 300 + i) * 4); }
  if (electionPhase(w).phase === 'propaganda') { const mb = w.buildings.find((x) => x.id === 'pazar'); if (mb) { ctx.font = `${Math.round(fs * 1.2)}px system-ui`; const n = Math.min(8, Object.values(w.election.posters ?? {}).reduce((a, b) => a + b, 0)); for (let i = 0; i < n; i += 1) ctx.fillText('📜', (mb.x + 0.5 + i * 1.4 - cam.x) * z, (mb.y - cam.y) * z - 6); } }
  for (const pr of w.projects.filter((x) => !x.done && x.plot)) { const b = w.buildings.find((x) => x.id === pr.plot); if (!b) continue; ctx.font = `${Math.round(fs * 1.4)}px system-ui`; ctx.fillText('🏗', (b.x + b.w / 2 - cam.x) * z, (b.y + b.h / 2 - cam.y) * z + Math.sin(now / 400) * 3); }
  // event markers (last 2 game hours)
  for (const e of w.events.slice(-12)) {
    if (e.x === undefined || e.y === undefined || e.day !== w.day || w.hour - e.hour > 2) continue;
    const sx = (e.x - cam.x) * z, sy = (e.y - cam.y) * z;
    const bounce = Math.sin(now / 200) * 4;
    ctx.font = `${Math.round(fs * 1.6)}px system-ui`; ctx.fillText(e.text.includes('soyuldu') || e.text.includes('yakaladı') ? '🚨' : e.text.includes('saldırdı') ? '🤕' : e.text.includes('CİNAYET') ? '💀' : e.text.includes('kervan') || e.text.includes('gemisi') ? '🐪' : e.text.includes('KURAKLIK') || e.text.includes('SALGIN') || e.text.includes('SEL') ? '⚠️' : e.text.includes('protesto') ? '✊' : e.text.includes('evlendi') ? '💍' : e.text.includes('doğdu') ? '👶' : e.text.includes('İSYAN') ? '🔥' : e.text.includes('dilekçe') ? '📜' : '❗', sx, sy - 30 + bounce);
  }
}

function bubble(ctx: CanvasRenderingContext2D, sx: number, sy: number, raw: string, cw: number): void {
  const words = raw.split(' '); const rows: string[] = []; let cur = '';
  for (const wd of words) { if ((cur + ' ' + wd).trim().length > 30 && cur) { rows.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); }
  if (cur) rows.push(cur); const lines = rows.slice(0, 3); if (rows.length > 3) lines[2] = lines[2]!.slice(0, 28) + '…';
  const lh = 15; const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14; const bh = lines.length * lh + 8;
  const x = Math.max(4, Math.min(cw - tw - 4, sx - tw / 2));
  ctx.fillStyle = 'rgba(255,250,232,0.97)'; ctx.strokeStyle = '#6a4a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, sy - bh, tw, bh, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx - 5, sy - 1); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx + 5, sy - 1); ctx.fill();
  ctx.fillStyle = '#3a2a10'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; lines.forEach((l, i) => ctx.fillText(l, x + 7, sy - bh + 4 + lh / 2 + i * lh)); ctx.textAlign = 'center';
}
function drawCorpse(ctx: CanvasRenderingContext2D, co: Corpse, cam: Camera, z: number, sz: number, now: number): void {
  const sx = (co.x - cam.x) * z, sy = (co.y - cam.y) * z; const grow = Math.min(1, (now - co.at) / 4000);
  ctx.fillStyle = 'rgba(140,10,10,0.75)'; ctx.beginPath(); ctx.ellipse(sx, sy - sz * 0.1, sz * (0.35 + 0.35 * grow), sz * (0.15 + 0.15 * grow), 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(90,0,0,0.8)'; ctx.beginPath(); ctx.ellipse(sx + sz * 0.15, sy - sz * 0.05, sz * 0.18 * grow, sz * 0.08 * grow, 0.4, 0, Math.PI * 2); ctx.fill();
  const pseudo = { id: co.personId, ...co.look } as unknown as Person;
  ctx.save(); ctx.translate(sx, sy - sz * 0.2); ctx.rotate(Math.PI / 2); ctx.drawImage(spriteFor(pseudo)[0]!, -sz / 2, -sz / 2, sz, sz); ctx.restore();
  ctx.font = `${Math.round(sz * 0.45)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(co.stage === 'yerde' ? '💀' : '🚨', sx, sy - sz * 0.75 + Math.sin(now / 250) * 2);
}
function drawSign(ctx: CanvasRenderingContext2D, w: World, cam: Camera, z: number, now: number): void {
  const sx = (SIGN.x - cam.x) * z, sy = (SIGN.y - cam.y) * z; const s = z / 16;
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(sx - 2 * s, sy, 4 * s, 18 * s); ctx.fillRect(sx + 26 * s, sy, 4 * s, 18 * s);
  ctx.fillStyle = '#b8894a'; ctx.fillRect(sx - 6 * s, sy - 20 * s, 40 * s, 22 * s); ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2 * s; ctx.strokeRect(sx - 6 * s, sy - 20 * s, 40 * s, 22 * s);
  ctx.fillStyle = '#f4ecd8'; ctx.fillRect(sx - 3 * s, sy - 17 * s, 34 * s, 16 * s);
  ctx.fillStyle = '#3a2a10'; ctx.font = `bold ${Math.max(7, 5 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ph = electionPhase(w).phase; ctx.fillText('🗳 SEÇİM', sx + 14 * s, sy - 12 * s); ctx.font = `${Math.max(6, 4 * s)}px system-ui`;
  ctx.fillText(ph === 'bekleme' ? `${w.election.nextDay}. gün` : ph === 'aday' ? 'ADAYLIK' : ph === 'propaganda' ? 'PROPAGANDA' : 'BUGÜN!', sx + 14 * s, sy - 5 * s);
  if (ph !== 'bekleme') { ctx.fillStyle = 'rgba(255,220,80,0.9)'; ctx.beginPath(); ctx.arc(sx + 32 * s, sy - 20 * s, (3 + Math.sin(now / 200)) * s, 0, Math.PI * 2); ctx.fill(); }
}

export function hitTest(w: World, placed: Placed[], cam: Camera, sx: number, sy: number): { person?: Person; building?: Building; corpse?: Corpse; sign?: boolean } {
  const z = cam.z * T; const sz = T * cam.z * SPRITE_SCALE;
  for (const co of w.corpses ?? []) { const px = (co.x - cam.x) * z, py = (co.y - cam.y) * z - sz * 0.2; if (Math.hypot(px - sx, py - sy) < Math.max(22, sz * 0.6)) return { corpse: co }; }
  { const px = (SIGN.x - cam.x) * z, py = (SIGN.y - cam.y) * z; const s = z / 16; if (sx >= px - 6 * s && sx <= px + 34 * s && sy >= py - 20 * s && sy <= py + 18 * s) return { sign: true }; }
  const r = Math.max(22, sz * 0.7);
  let best: Placed | undefined; let bd = Infinity;
  for (const q of placed) {
    if (!q.visible) continue;
    const px = (q.x - cam.x) * z, py = (q.y - cam.y) * z - sz / 2;
    const d = Math.hypot(px - sx, py - sy);
    if (d < r && d < bd) { bd = d; best = q; }
  }
  if (best) return { person: best.p };
  const tx = sx / z + cam.x, ty = sy / z + cam.y;
  const b = w.buildings.find((x) => tx >= x.x - 0.3 && tx <= x.x + x.w + 0.3 && ty >= x.y - 1 && ty <= x.y + x.h + 0.5);
  return { building: b };
}
