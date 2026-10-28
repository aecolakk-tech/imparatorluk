import type { Person, Profession } from '../sim/types';
import { SKIN_TONES, HAIR_COLORS, EYES, CLOTHS, type Look } from '../sim/look';
let RULER: string | null = null;
/** The current head of state wears the crown (the title, not the profession). */
export function setRuler(id: string | null): void { if (id !== RULER) { RULER = id; cache.clear(); } }

const SKIN = ['#f1c9a5', '#e0ac7e', '#c68a5a', '#8d5a3b'];
const HAIR = ['#2b1a10', '#4a2c17', '#7a4a22', '#b07a3b', '#151515', '#6b6b6b', '#c8a060', '#3d2314'];
const SHIRT = ['#b8492f', '#3f6fb0', '#4f8a3a', '#b08a2f', '#7a4fa0', '#a0603a', '#2f8a86', '#8a2f55'];
const UNIFORM: Partial<Record<Profession, { body: string; hat?: string; trim?: string }>> = {
  asker: { body: '#9c1f1f', hat: '#8a8f98', trim: '#e2c043' },
  bekci: { body: '#24407a', hat: '#1a2a4f', trim: '#d0d0d0' },
  kayzer: { body: '#5b1f8a', hat: '#f2c230', trim: '#f2c230' },
  naip: { body: '#eeeeea', hat: '#4f9a3a', trim: '#c9a227' },
  hakim: { body: '#1d1d24', hat: '#1d1d24', trim: '#c9a227' },
  savci: { body: '#3a2d4f', trim: '#c9a227' },
  imam: { body: '#2c5a3a', hat: '#f4f1e8' },
  hoca: { body: '#5a4a8a' },
  hekim: { body: '#e8e8e8', trim: '#c03030' },
  memur: { body: '#4a4a4a', hat: '#9b1c1c' },
  tahsildar: { body: '#5a4a1d', hat: '#9b1c1c' },
  firinci: { body: '#f0ead8', hat: '#f8f8f8' },
  insaatci: { body: '#c0782a', hat: '#e0b020' },
  balikci: { body: '#2f6d8a', hat: '#d8c890' },
  ciftci: { body: '#7a8a3a', hat: '#e0c860' },
  dokumaci: { body: '#8a5a9a' },
  mobilyaci: { body: '#7a4a2a', trim: '#c9a227' },
  barci: { body: '#6a2a4a', trim: '#f0f0f0' },
  degirmenci: { body: '#d8d0c0', hat: '#f4f0e8' },
  kasap: { body: '#f0e8e0', trim: '#b03030' },
};

/** 16x16 "16-bit" sprite, 2 walk frames, generated from the person's seeds. */
export function makeSprite(p: Person): HTMLCanvasElement[] {
  if (p.look) return makeLookSprite(p, p.look);
  return [0, 1].map((frame) => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d')!;
    const px = (x: number, y: number, w: number, h: number, col: string): void => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const u = p.prof === 'kayzer' && RULER && p.id !== RULER ? undefined : UNIFORM[p.prof];
    const skin = SKIN[p.skin % SKIN.length]!; const hair = HAIR[p.hairColor % HAIR.length]!;
    const body = u?.body ?? SHIRT[p.shirt % SHIRT.length]!;
    const dark = shade(body, -0.35); const outline = '#1a1410';
    // shadow
    px(4, 15, 8, 1, 'rgba(0,0,0,0.25)');
    // legs
    const legCol = p.female ? shade(body, -0.15) : '#3b3030';
    if (p.female) { px(4, 10, 8, 4, legCol); px(4, 13, 8, 1, shade(legCol, -0.2)); px(5, 14, 2, 1, outline); px(9, 14, 2, 1, outline); }
    else if (frame === 0) { px(5, 11, 2, 3, legCol); px(9, 11, 2, 3, legCol); px(5, 14, 2, 1, outline); px(9, 14, 2, 1, outline); }
    else { px(4, 11, 2, 3, legCol); px(10, 11, 2, 3, legCol); px(4, 14, 2, 1, outline); px(10, 14, 2, 1, outline); }
    // torso
    px(4, 6, 8, 5, body); px(4, 10, 8, 1, dark); px(4, 6, 1, 5, shade(body, 0.15));
    if (u?.trim) { px(7, 6, 2, 5, u.trim); }
    // arms
    const armY = frame === 0 ? 7 : 6;
    px(3, armY, 1, 4, body); px(12, 13 - armY + 0, 1, 4, body); px(3, armY + 4, 1, 1, skin); px(12, 13 - armY + 4, 1, 1, skin);
    // head
    px(5, 1, 6, 5, skin); px(5, 5, 6, 1, shade(skin, -0.12));
    px(6, 3, 1, 1, outline); px(9, 3, 1, 1, outline);
    // hair / hat
    if (u?.hat) {
      if (p.prof === 'kayzer') { px(5, 0, 6, 1, u.hat); px(5, -1 + 1, 1, 1, u.hat); px(7, 0, 2, 1, '#e03030'); }
      else if (p.prof === 'asker') { px(4, 0, 8, 2, u.hat); px(4, 2, 1, 2, u.hat); px(11, 2, 1, 2, u.hat); }
      else if (p.prof === 'naip') { px(5, 1, 6, 1, u.hat); px(4, 2, 1, 1, u.hat); px(11, 2, 1, 1, u.hat); }
      else if (p.prof === 'imam') { px(4, 0, 8, 2, u.hat); }
      else { px(5, 0, 6, 1, u.hat); px(6, -1 + 1, 4, 1, u.hat); }
    } else {
      px(5, 0, 6, 2, hair); px(5, 2, 1, 2, hair); px(10, 2, 1, 2, hair);
      if (p.female) { px(4, 2, 1, 5, hair); px(11, 2, 1, 5, hair); }
    }
    if (!p.female && p.hairColor % 3 === 0 && !u) px(6, 5, 4, 1, hair); // moustache
    rankMarks(p, px, frame);
    return c;
  });
}

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const cache = new Map<string, HTMLCanvasElement[]>();
export function spriteFor(p: Person): HTMLCanvasElement[] {
  const key = `${p.id}:${p.prof}:${p.id === RULER ? 'R' : ''}${p.soylu || p.rank ? 'N' : ''}:${p.look ? JSON.stringify(p.look) : ''}`;
  let s = cache.get(key); if (!s) { s = makeSprite(p); cache.set(key, s); }
  return s;
}

type Px = (x: number, y: number, w: number, h: number, col: string) => void;
/** Rank markers: crown for the ruler, a gold pin for nobles (helmets/hats come with the asker/bekçi uniforms). */
function rankMarks(p: Person, px: Px, _f: number): void {
  if (p.id === RULER) { px(5, 0, 6, 1, '#f2c230'); px(5, -1 + 1, 1, 1, '#f2c230'); px(6, 0, 1, 1, '#e03030'); px(9, 0, 1, 1, '#3060e0'); px(7, 0, 2, 1, '#f2c230'); }
  else if (p.soylu || p.rank) px(10, 7, 1, 1, '#f2c230');
}
/** v1.9.7: sprite from a chosen look (same 16x16 frame layout as the generated sprites → walk/ride/sit work unchanged). */
function makeLookSprite(p: Person, L: Look): HTMLCanvasElement[] {
  return [0, 1].map((frame) => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d')!;
    const px: Px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const ruler = p.id === RULER; const u = p.prof === 'kayzer' && !ruler ? undefined : UNIFORM[p.prof];
    const skin = SKIN_TONES[L.skin]!; const hair = HAIR_COLORS[L.hairColor]!; const eye = EYES[L.eye]!;
    const body = u?.body ?? CLOTHS[L.cloth]!; const dark = shade(body, -0.35); const outline = '#1a1410';
    const dy = L.height === 0 ? 1 : 0; // short: head and torso 1px lower
    const x0 = L.build === 0 ? 5 : L.build === 2 ? 3 : 4; const tw = 16 - 2 * x0;
    px(4, 15, 8, 1, 'rgba(0,0,0,0.25)');
    const long = !u && (L.outfit === 1 || L.outfit === 3 || L.outfit === 5);
    const legCol = p.female || long ? shade(body, -0.15) : '#3b3030';
    if (p.female || long) { px(4, 10 + dy, 8, 4 - dy, legCol); px(4, 13, 8, 1, shade(legCol, -0.2)); px(5, 14, 2, 1, outline); px(9, 14, 2, 1, outline); }
    else if (frame === 0) { px(5, 11, 2, 3, legCol); px(9, 11, 2, 3, legCol); px(5, 14, 2, 1, outline); px(9, 14, 2, 1, outline); }
    else { px(4, 11, 2, 3, legCol); px(10, 11, 2, 3, legCol); px(4, 14, 2, 1, outline); px(10, 14, 2, 1, outline); }
    // torso + outfit
    px(x0, 6 + dy, tw, 5 - dy, body); px(x0, 10, tw, 1, dark); px(x0, 6 + dy, 1, 5 - dy, shade(body, 0.15));
    if (u?.trim) px(7, 6 + dy, 2, 5 - dy, u.trim);
    else if (L.outfit === 2) { px(x0, 6 + dy, 2, 4, shade(body, -0.45)); px(x0 + tw - 2, 6 + dy, 2, 4, shade(body, -0.45)); }
    else if (L.outfit === 3) { px(7, 6 + dy, 1, 8 - dy, '#e2c043'); }
    else if (L.outfit === 4) { px(6, 7 + dy, 4, 6 - dy, '#efe9dc'); }
    else if (L.outfit === 5) { px(x0, 6 + dy, tw, 1, shade(body, -0.3)); }
    if (L.belt) px(x0, 9, tw, 1, '#5a3a1a');
    if (L.scarf) px(x0 + 1, 6 + dy, tw - 2, 1, shade(CLOTHS[(L.cloth + 5) % CLOTHS.length]!, 0));
    // arms
    const armY = (frame === 0 ? 7 : 6) + dy;
    px(x0 - 1, armY, 1, 4, body); px(x0 + tw, 13 - armY + 2 * dy, 1, 4, body); px(x0 - 1, armY + 4, 1, 1, skin); px(x0 + tw, 13 - armY + 2 * dy + 4, 1, 1, skin);
    // head
    const hy = 1 + dy; px(5, hy, 6, 5, skin); px(5, hy + 4, 6, 1, shade(skin, -0.12));
    px(6, hy + 2, 1, 1, eye); px(9, hy + 2, 1, 1, eye);
    if (L.jewel) { px(5, hy + 3, 1, 1, '#f2c230'); px(7, 6 + dy, 2, 1, '#f2c230'); }
    // beard
    if (!p.female) {
      if (L.beard === 1) px(6, hy + 3, 4, 1, hair);
      else if (L.beard === 2) { px(5, hy + 3, 6, 1, hair); px(5, hy + 4, 1, 1, hair); px(10, hy + 4, 1, 1, hair); }
      else if (L.beard === 3) { px(6, hy + 3, 4, 1, hair); px(7, hy + 4, 2, 2, hair); }
      else if (L.beard === 4) { px(5, hy + 3, 6, 2, hair); px(6, hy + 3, 4, 1, shade(hair, 0.15)); px(7, hy + 3, 2, 1, skin); }
      else if (L.beard === 5) { px(5, hy + 3, 6, 3, hair); px(7, hy + 3, 2, 1, skin); }
    }
    // hair (12 styles; hidden under uniform hats)
    const covered = !!u?.hat || (!u && (L.head === 2 || L.head === 4));
    if (!covered) drawHair(px, p.female ? FEMALE_MAP[L.hair]! : L.hair, hair, hy, skin);
    if (u?.hat && !ruler) uniformHat(p.prof, u.hat, px);
    else if (!u && !ruler) drawHead(px, L.head, hy, body);
    rankMarks(p, px, frame);
    return c;
  });
}
// female style list → shared shape ids (12 shapes: 0 short … 11 bald + female-only 12–15)
const FEMALE_MAP = [6, 12, 13, 8, 7, 5, 3, 0, 4, 9, 14, 15];
function drawHair(px: Px, s: number, hair: string, hy: number, skin: string): void {
  const top = (h = 2): void => px(5, hy - 1, 6, h, hair);
  switch (s) {
    case 0: top(); px(5, hy + 1, 1, 1, hair); px(10, hy + 1, 1, 1, hair); break; // short
    case 1: px(5, hy - 1, 6, 1, hair); break; // military
    case 2: top(); px(5, hy + 1, 3, 1, hair); px(10, hy + 1, 1, 2, hair); break; // side part
    case 3: top(); px(5, hy + 1, 4, 1, hair); break; // fringe
    case 4: px(4, hy - 1, 8, 2, hair); px(4, hy + 1, 1, 2, hair); px(11, hy + 1, 1, 2, hair); px(6, hy - 1, 1, 1, shade(hair, 0.2)); px(9, hy - 1, 1, 1, shade(hair, 0.2)); break; // curly
    case 5: top(); px(4, hy, 1, 4, hair); px(11, hy, 1, 4, hair); px(4, hy + 2, 1, 1, shade(hair, 0.2)); break; // wavy
    case 6: top(); px(4, hy + 1, 1, 6, hair); px(11, hy + 1, 1, 6, hair); break; // long
    case 7: top(); px(11, hy + 1, 2, 1, hair); px(12, hy + 2, 1, 4, hair); break; // ponytail
    case 8: top(); px(7, hy - 2, 2, 1, hair); break; // bun
    case 9: top(); px(4, hy + 1, 1, 4, hair); px(11, hy + 1, 1, 4, hair); break; // shoulder
    case 10: px(5, hy - 2, 6, 3, hair); px(6, hy - 2, 1, 1, shade(hair, 0.25)); break; // spiky
    case 11: px(5, hy - 1, 6, 1, skin); px(5, hy + 1, 1, 1, hair); px(10, hy + 1, 1, 1, hair); break; // bald
    case 12: top(); px(11, hy + 1, 1, 7, hair); px(11, hy + 3, 1, 1, shade(hair, 0.25)); px(11, hy + 5, 1, 1, shade(hair, 0.25)); break; // braid
    case 13: top(); px(4, hy + 1, 1, 6, hair); px(11, hy + 1, 1, 6, hair); px(4, hy + 3, 1, 1, shade(hair, 0.25)); px(11, hy + 3, 1, 1, shade(hair, 0.25)); break; // two braids
    case 14: top(); px(4, hy + 1, 1, 7, hair); px(4, hy + 4, 1, 1, shade(hair, 0.25)); break; // side braid
    case 15: top(); px(6, hy - 3, 4, 2, hair); break; // high bun
  }
}
function drawHead(px: Px, k: number, hy: number, body: string): void {
  switch (k) {
    case 1: px(6, hy - 2, 4, 2, '#b01e23'); px(8, hy - 2, 1, 1, '#1a1410'); break; // fes
    case 2: px(4, hy - 2, 8, 3, '#f4f1e8'); px(5, hy - 2, 6, 1, '#e0dccc'); break; // sarık
    case 3: px(5, hy - 2, 6, 2, '#2a2420'); px(5, hy - 2, 6, 1, '#3a3430'); break; // kalpak
    case 4: { const sc = shade(body, 0.25); px(4, hy - 1, 8, 2, sc); px(4, hy + 1, 1, 5, sc); px(11, hy + 1, 1, 5, sc); break; } // başörtüsü
    case 5: px(3, hy, 10, 1, '#d8c890'); px(5, hy - 2, 6, 2, '#d8c890'); px(5, hy - 1, 6, 1, '#a04030'); break; // hasır şapka
    case 6: px(5, hy - 1, 6, 1, '#f4f1e8'); break; // takke
  }
}
function uniformHat(prof: Profession, hat: string, px: Px): void {
  if (prof === 'asker') { px(4, 0, 8, 2, hat); px(4, 2, 1, 2, hat); px(11, 2, 1, 2, hat); px(7, 0, 2, 1, shade(hat, 0.3)); }
  else if (prof === 'naip') { px(5, 1, 6, 1, hat); px(4, 2, 1, 1, hat); px(11, 2, 1, 1, hat); }
  else if (prof === 'imam') px(4, 0, 8, 2, hat);
  else { px(5, 0, 6, 1, hat); px(6, 0, 4, 1, hat); px(4, 1, 8, 1, shade(hat, -0.2)); }
}
