import { ICONS } from './icons.gen';
/** Inline SVG icon from game-icons.net (CC BY 3.0 – see Ayarlar → Emeği geçenler). Colour = currentColor. */
export function ic(name: string, cls = ''): HTMLElement {
  const s = document.createElement('span'); s.className = `ic${cls ? ' ' + cls : ''}`; s.setAttribute('aria-hidden', 'true');
  const body = ICONS[name]; if (body) s.innerHTML = `<svg viewBox="0 0 512 512" width="1em" height="1em">${body}</svg>`; return s;
}
export const CREDITS = 'Simgeler: game-icons.net (Lorc, Delapouite ve katkıda bulunanlar) – CC BY 3.0 lisansı. Hayvan ve karakter pikselleri, müzik ve sesler oyunun kendi kodunda üretilir.';

// ---- v1.9: one central pass that swaps emoji in the UI chrome for licensed SVG icons (unmapped emoji are dropped) ----
const EMO: [string, string][] = Object.entries({
  '👑': 'crown', '💰': 'coin', '💵': 'money', '🪙': 'coin', '👛': 'coin', '❤️': 'heart', '❤': 'heart', '🍞': 'bread', '🍽': 'meal', '💧': 'water', '🚰': 'water', '☀️': 'sun', '☀': 'sun', '🌙': 'moon', '❄️': 'winter', '❄': 'winter', '🍂': 'autumn', '🌸': 'spring', '🌞': 'summer',
  '📜': 'scroll', '⚔️': 'swords', '⚔': 'swords', '🗡': 'swords', '⏱': 'clock', '⏳': 'hourglass', '🎵': 'music', '🔊': 'sound', '🔇': 'mute', '🏠': 'house', '🏡': 'farm', '🏰': 'castle', '⚖️': 'scales', '⚖': 'scales', '⛓': 'cuffs', '✉️': 'mail', '✉': 'mail', '💬': 'talk', '🗣': 'megaphone',
  '🎒': 'bag', '🎯': 'goal', '🕯': 'candle', '📖': 'book', '📚': 'book', '⚙️': 'cog', '⚙': 'cog', '🛠': 'cog', '🏆': 'trophy', '👤': 'person', '❌': 'close', '✕': 'close', '✅': 'check', '✔': 'check', '🏪': 'shop', '🛒': 'shop', '🔨': 'hammer', '🌾': 'wheat', '📋': 'list', '📲': 'phone', '📱': 'phone',
  '⚜': 'noble', '🕵': 'spy', '🥩': 'meat', '🍖': 'meat', '🥛': 'milk', '🥚': 'egg', '🕌': 'mosque', '🍺': 'beer', '🍷': 'wine', '🔥': 'fire', '🗽': 'banner', '🚩': 'banner', '📣': 'megaphone', '📢': 'megaphone', '⚡': 'bolt', '🐄': 'cow', '🐑': 'sheep', '🐔': 'chicken', '🐎': 'horse',
  '💍': 'ring', '👶': 'baby', '👪': 'family', '🏥': 'doctor', '🩺': 'doctor', '🤕': 'wound', '🎓': 'school', '🏫': 'school', '🎣': 'fishing', '🐟': 'fishing', '🧵': 'needle', '🪑': 'sofa', '🚶': 'walk', '🔒': 'lock', '💀': 'skull', '⚰': 'skull', '👁': 'eye', '⏰': 'clock', '🎉': 'party', '🐪': 'camel', 'ℹ️': 'info', '❓': 'help', '🗑': 'trash', '🚪': 'exit', '🛡': 'shield', '🎲': 'dice', '✋': 'hand', '📍': 'pin', '📅': 'calendar', '📊': 'chart', '🏦': 'bank', '🏛': 'castle', '🤝': 'hand', '🦹': 'spy', '🤫': 'spy', '🎁': 'coin', '🍻': 'beer', '😊': 'sun', '🙂': 'sun', '🏗': 'hammer', '📈': 'chart', '📉': 'chart', '🧺': 'bag', '🔎': 'eye', '🔍': 'eye', '🗳': 'scroll', '🪧': 'scroll', '🌧': 'water', '🧑‍⚖️': 'scales',
});
const EMO_RE = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\uFE0F\u20E3)*|✕)/gu;
function swap(node: Text): void {
  const t = node.nodeValue ?? ''; if (!EMO_RE.test(t)) return; EMO_RE.lastIndex = 0;
  const frag = document.createDocumentFragment(); let last = 0;
  for (const m of t.matchAll(EMO_RE)) {
    const i = m.index ?? 0; if (i > last) frag.append(t.slice(last, i));
    const name = EMO.find(([e]) => e === m[0] || e === m[0].replace(/\uFE0F/g, ''))?.[1]; if (name) frag.append(ic(name, 'emo'));
    last = i + m[0].length;
  }
  let rest = t.slice(last); if (frag.childNodes.length && /^\s/.test(rest) === false && last > 0 && rest && !/^[\s,.:)]/.test(rest)) rest = ' ' + rest; frag.append(rest);
  node.replaceWith(frag);
}
export function iconify(root: Node): void {
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('input, textarea, .msgs, .ic, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const list: Text[] = []; while (it.nextNode()) list.push(it.currentNode as Text); for (const n of list) swap(n);
}
export function installIconify(): void {
  iconify(document.body);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 3) { if (!(n.parentElement?.closest('input, textarea, .msgs, .ic'))) swap(n as Text); } else if (n.nodeType === 1) iconify(n); } }).observe(document.body, { childList: true, subtree: true });
}
const imgCache = new Map<string, HTMLImageElement>();
/** The same icon as an <img> for canvas drawing (white glyph on a dark rounded badge). */
export function iconImg(name: string, color = '#f3d27a', bg = '#1a120bdd'): HTMLImageElement {
  const k = `${name}|${color}|${bg}`; let im = imgCache.get(k); if (im) return im;
  const body = (ICONS[name] ?? '').replace(/currentColor/g, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-64 -64 640 640"><rect x="-64" y="-64" width="640" height="640" rx="150" fill="${bg}"/>${body}</svg>`;
  im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); imgCache.set(k, im); return im;
}
export function drawIcon(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, color?: string, bg?: string): void {
  const im = iconImg(name, color, bg); if (im.complete && im.naturalWidth) ctx.drawImage(im, Math.round(cx - size / 2), Math.round(cy - size / 2), Math.round(size), Math.round(size));
}
