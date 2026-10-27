type Child = Node | string | number | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Partial<Record<string, string | ((e: Event) => void) | boolean>> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else if (k === 'value' && (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) el.value = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(typeof c === 'number' ? String(c) : c);
  return el;
}
export const fmt = (n: number): string => Math.round(n).toLocaleString('tr-TR');
export function bar(v: number, color: string): HTMLElement { const b = h('span', { class: 'bar' }); const i = h('i'); i.style.width = `${Math.max(0, Math.min(100, v))}%`; i.style.background = color; b.append(i); return b; }
export function select(options: [string, string][], value?: string): HTMLSelectElement {
  const s = h('select'); for (const [v, l] of options) s.append(h('option', { value: v }, l)); if (value) s.value = value; return s;
}
