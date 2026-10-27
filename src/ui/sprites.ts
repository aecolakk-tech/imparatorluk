import type { Person, Profession } from '../sim/types';

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
  kasap: { body: '#f0e8e0', trim: '#b03030' },
};

/** 16x16 "16-bit" sprite, 2 walk frames, generated from the person's seeds. */
export function makeSprite(p: Person): HTMLCanvasElement[] {
  return [0, 1].map((frame) => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d')!;
    const px = (x: number, y: number, w: number, h: number, col: string): void => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const u = UNIFORM[p.prof];
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
  const key = `${p.id}:${p.prof}`;
  let s = cache.get(key); if (!s) { s = makeSprite(p); cache.set(key, s); }
  return s;
}
