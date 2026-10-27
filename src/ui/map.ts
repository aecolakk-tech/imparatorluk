import type { Building, Person, World } from '../sim/types';
import { HOUR_MS, MAP_H, MAP_W } from '../sim/constants';
import { ROADS_X, ROADS_Y } from '../sim/world';
import { shade, spriteFor } from './sprites';

export const T = 16;
interface Pt { x: number; y: number }

const ROOF: Record<string, string> = {
  saray: '#7b2d8b', meclis: '#2d5b8b', mahkeme: '#5a4636', zindan: '#3c3c3c', kisla: '#8b2d2d', cami: '#3a8a6a', okul: '#b5652b',
  hekimhane: '#e4e4e4', kahve: '#8b5a2b', pazar: '#c9a227', firin: '#b5442b', kasap: '#9b2b2b', degirmen: '#8a7a5a', kuyu: '#5a6a7a',
  atolye: '#6a5a4a', santiye: '#c08a2a', liman: '#4a6a8a', ev: '#a8553a',
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
  if (b.kind === 'firin') { g.fillStyle = '#7a7a7a'; g.fillRect(X + W - 14, Y - 12, 8, 14); g.fillStyle = 'rgba(220,220,220,0.7)'; g.fillRect(X + W - 16, Y - 22, 10, 6); }
}

// ---------- people movement (client-side, deterministic from game time) ----------
export function nearestRoad(y: number): number { return ROADS_Y.reduce((a, r) => (Math.abs(r - y) < Math.abs(a - y) ? r : a), ROADS_Y[0]!); }

function route(a: Pt, b: Pt): Pt[] {
  const ry = nearestRoad(a.y);
  const ry2 = nearestRoad(b.y);
  const rx = ROADS_X.reduce((acc, r) => (Math.abs(r - b.x) < Math.abs(acc - b.x) ? r : acc), ROADS_X[0]!);
  if (ry === ry2) return [a, { x: a.x, y: ry }, { x: b.x, y: ry }, b];
  return [a, { x: a.x, y: ry }, { x: rx, y: ry }, { x: rx, y: ry2 }, { x: b.x, y: ry2 }, b];
}
function along(path: Pt[], f: number): Pt {
  let total = 0; const seg: number[] = [];
  for (let i = 1; i < path.length; i += 1) { const d = Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y); seg.push(d); total += d; }
  let t = f * total;
  for (let i = 1; i < path.length; i += 1) {
    const d = seg[i - 1]!; if (t <= d || i === path.length - 1) { const k = d ? Math.min(1, t / d) : 1; const p0 = path[i - 1]!, p1 = path[i]!; return { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k }; }
    t -= d;
  }
  return path[path.length - 1]!;
}

const MARKETS = ['pazar', 'gida', 'zanaat', 'yeni', 'kahve'];
const findPersonLite = (w: World, id: string | undefined): Person | undefined => (id ? w.people.find((p) => p.id === id) : undefined);
export interface Placed { p: Person; x: number; y: number; moving: boolean; visible: boolean; dir: number }

export function placePeople(w: World, now: number): Placed[] {
  const frac = w.frozen ? 0 : Math.max(0, Math.min(0.999, (now - w.lastTickAt) / HOUR_MS));
  const t = w.hour + frac;
  const B = new Map(w.buildings.map((b) => [b.id, b]));
  const door = (id: string, p: Person, spread = 1.6): Pt => {
    const b = B.get(id) ?? B.get('pazar')!; const h = hash(p.id + id);
    const isBig = b.kind === 'pazar' || b.kind === 'kahve' || b.kind === 'santiye' || b.kind === 'kisla' || b.kind === 'liman';
    if (isBig) return { x: b.x + 0.5 + (h % 100) / 100 * (b.w - 1), y: b.y + b.h + 0.3 + ((h >> 8) % 100) / 100 * spread };
    return { x: b.door.x + ((h % 100) / 100 - 0.5) * spread * 2, y: b.door.y + 0.4 + ((h >> 8) % 100) / 100 * spread * 0.6 };
  };
  return w.people.map((p): Placed => {
    const h = hash(p.id);
    const market = p.prof === 'memur' || p.prof === 'tahsildar' ? 'kahve' : MARKETS[h % 4]!;
    const work = p.jailedDays > 0 ? 'zindan' : p.work;
    const home = p.jailedDays > 0 ? 'zindan' : p.home;
    const off = (h % 60) / 60; // personal schedule offset in hours
    const s1 = 6 + off, s2 = 8 + off, s3 = 17 + off, s4 = 18 + off, s5 = 20.5 + off, s6 = 22 + off;
    let pos: Pt; let moving = false; let visible = true;
    const wiggle = Math.sin(now / 900 + h) * 0.25;
    if (p.prof === 'asker' && (t < 6 || t > 21)) { // night patrol around the kışla & saray
      const k = (now / 40000 + (h % 10) / 10) % 1; pos = along([{ x: 57, y: 13 }, { x: 30, y: 13 }, { x: 30, y: 20 }, { x: 56, y: 20 }, { x: 57, y: 13 }], k); moving = true;
    } else if (p.prof === 'bekci' && (t < 6 || t > 21)) {
      const k = (now / 50000 + (h % 10) / 10) % 1; pos = along([{ x: 6, y: 29 }, { x: 68, y: 29 }, { x: 68, y: 35 }, { x: 6, y: 35 }, { x: 6, y: 29 }], k); moving = true;
    } else if (p.jailedDays > 0) { pos = door('zindan', p, 0.8); }
    else if (t >= s1 && t < s2) { pos = along(route(door(home, p), door(work, p)), (t - s1) / (s2 - s1)); moving = true; }
    else if (t >= s2 && t < s3) { pos = door(work, p); pos.x += wiggle; }
    else if (t >= s3 && t < s4) { pos = along(route(door(work, p), door(market, p)), (t - s3) / (s4 - s3)); moving = true; }
    else if (t >= s4 && t < s5) { pos = door(market, p); pos.x += wiggle; }
    else if (t >= s5 && t < s6) { pos = along(route(door(market, p), door(home, p)), (t - s5) / (s6 - s5)); moving = true; }
    else { pos = door(home, p, 0.6); visible = h % 4 === 0; } // most are indoors at night
    if (p.id === w.kayzerId || p.prof === 'naip' || (p.soylu && p.home === 'saray')) { pos = door('saray', p, 2); visible = true; moving = false; pos.x += wiggle; }
    if (p.exiledDays > 0) visible = false;
    if (w.isyan && p.jailedDays === 0) {
      if (w.isyan.rebels.includes(p.id)) { const at = w.isyan.occupied[w.isyan.occupied.length - 1] ?? 'pazar'; pos = door(at, p, 3); pos.x += wiggle * 2; visible = true; moving = true; }
      else if (p.prof === 'asker') { pos = door('saray', p, 3); pos.y += 1; visible = true; moving = false; }
    }
    return { p, x: pos.x, y: pos.y, moving, visible, dir: 1 };
  });
}

export interface Camera { x: number; y: number; z: number }

export function drawFrame(ctx: CanvasRenderingContext2D, stat: HTMLCanvasElement, w: World, cam: Camera, placed: Placed[], now: number, selected: string | null, myPersonId: string | null, dark: number): void {
  const cw = ctx.canvas.width, ch = ctx.canvas.height; const z = cam.z * T;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2f6fa8'; ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(stat, Math.round(-cam.x * z), Math.round(-cam.y * z), Math.round(stat.width * cam.z), Math.round(stat.height * cam.z));
  // people sorted by y
  const vis = placed.filter((q) => q.visible).sort((a, b) => a.y - b.y);
  const sz = Math.round(T * cam.z * 1.15);
  for (const q of vis) {
    const sx = (q.x - cam.x) * z, sy = (q.y - cam.y) * z;
    if (sx < -sz || sy < -sz * 2 || sx > cw + sz || sy > ch + sz) continue;
    const fr = spriteFor(q.p); const f = q.moving ? Math.floor(now / 220 + q.x * 3) % 2 : 0;
    if (q.p.id === selected || q.p.id === myPersonId) {
      ctx.fillStyle = q.p.id === selected ? 'rgba(255,230,80,0.55)' : 'rgba(120,200,255,0.5)';
      ctx.beginPath(); ctx.ellipse(sx, sy, sz * 0.45, sz * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.drawImage(fr[f]!, Math.round(sx - sz / 2), Math.round(sy - sz), sz, sz);
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
  const showN = cam.z >= 2 ? 4 : 0; const rot = Math.floor(now / 6000);
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
  // event markers (last 2 game hours)
  for (const e of w.events.slice(-12)) {
    if (e.x === undefined || e.y === undefined || e.day !== w.day || w.hour - e.hour > 2) continue;
    const sx = (e.x - cam.x) * z, sy = (e.y - cam.y) * z;
    const bounce = Math.sin(now / 200) * 4;
    ctx.font = `${Math.round(fs * 1.6)}px system-ui`; ctx.fillText(e.text.includes('soyuldu') || e.text.includes('yakaladı') ? '🚨' : e.text.includes('protesto') ? '✊' : e.text.includes('evlendi') ? '💍' : e.text.includes('doğdu') ? '👶' : e.text.includes('İSYAN') ? '🔥' : e.text.includes('dilekçe') ? '📜' : '❗', sx, sy - 30 + bounce);
  }
}

export function hitTest(w: World, placed: Placed[], cam: Camera, sx: number, sy: number): { person?: Person; building?: Building } {
  const z = cam.z * T; const sz = T * cam.z * 1.15;
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
