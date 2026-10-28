/**
 * v2.0.1 mobile-first controls: Minecraft-style 8-slot hotbar, on-screen joystick, 'Saldır' and 'Etkileşim' buttons,
 * and the same on a keyboard (WASD / arrows, 1–8, Space/F = saldır, E = etkileşim).
 */
import type { Good, Person } from '../sim/types';
import { h } from './dom';
import { ARM_LABEL, type ArmItem } from '../sim/arms';
import { GOOD_LABEL } from '../sim/constants';

export type SlotItem = ArmItem | Good;
const ICON: Record<string, string> = { kilic: '🗡️', hancer: '🔪', yay: '🏹', kalkan: '🛡️', ok: '➶', ekmek: '🍞', su: '💧', et: '🍖', balik: '🐟', yumurta: '🥚', sut: '🥛', icki: '🍷', odun: '🪵', un: '🌾' };
const WEAP = ['kilic', 'hancer', 'yay'];
const FOOD = ['ekmek', 'su', 'et', 'balik', 'yumurta', 'sut'];
export const slotLabel = (k: string): string => (ARM_LABEL as Record<string, string>)[k] ?? GOOD_LABEL[k as Good] ?? k;
export function countOf(me: Person, k: string): number { return (me.arms as Record<string, number> | undefined)?.[k] ?? (me.inv as Record<string, number>)[k] ?? 0; }

export interface CtlApi {
  me: () => Person | null;
  useSlot: (k: SlotItem) => void;
  move: (dx: number, dy: number) => void; // joystick vector, |v| ≤ 1; (0,0) = stop
  attack: () => void; interact: () => void;
  canAttack: () => { on: boolean; label: string }; canInteract: () => { on: boolean; label: string };
}
const key = (me: Person): string => `imp-hotbar-${me.id}`;
export function hotbarSlots(me: Person): (string | null)[] {
  let s: (string | null)[] = []; try { s = JSON.parse(localStorage.getItem(key(me)) ?? '[]'); } catch { s = []; }
  while (s.length < 8) s.push(null); s = s.slice(0, 8);
  // auto-fill empty slots with what you carry (weapons first, then food) – never duplicates
  const have = [...WEAP, 'kalkan', ...FOOD].filter((k) => countOf(me, k) > 0 && !s.includes(k));
  for (let i = 0; i < 8 && have.length; i++) if (!s[i]) s[i] = have.shift()!;
  return s;
}
export function assignSlot(me: Person, k: string, slot: number): void { const s = hotbarSlots(me).map((x) => (x === k ? null : x)); s[slot] = k; localStorage.setItem(key(me), JSON.stringify(s)); }

export function buildControls(root: HTMLElement, api: CtlApi): { refresh: () => void; el: HTMLElement } {
  const bar = h('div', { class: 'hotbar', role: 'toolbar' });
  const knob = h('div', { class: 'joy-knob' }); const joy = h('div', { class: 'joy', title: 'Yürü' }, knob);
  const atk = h('button', { class: 'act-btn atk' }, '⚔', h('span', {}, 'Saldır')) as HTMLButtonElement;
  const itr = h('button', { class: 'act-btn itr' }, '✋', h('span', {}, 'Etkileşim')) as HTMLButtonElement;
  const acts = h('div', { class: 'act-btns' }, itr, atk);
  const el = h('div', { class: 'controls' }, joy, bar, acts); root.append(el);
  const press = (b: HTMLElement): void => { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 160); };
  atk.addEventListener('pointerdown', (e) => { e.preventDefault(); press(atk); api.attack(); });
  itr.addEventListener('pointerdown', (e) => { e.preventDefault(); press(itr); api.interact(); });
  // joystick
  let jid: number | null = null; let cx = 0, cy = 0; const R = 42;
  const setKnob = (dx: number, dy: number): void => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(e.pointerId); const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.classList.add('on'); onJ(e); });
  const onJ = (e: PointerEvent): void => { if (e.pointerId !== jid) return; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } setKnob(dx, dy); const m = Math.hypot(dx, dy) / R; api.move(m < 0.18 ? 0 : dx / R, m < 0.18 ? 0 : dy / R); };
  joy.addEventListener('pointermove', onJ);
  const endJ = (e: PointerEvent): void => { if (e.pointerId !== jid) return; jid = null; setKnob(0, 0); joy.classList.remove('on'); api.move(0, 0); };
  joy.addEventListener('pointerup', endJ); joy.addEventListener('pointercancel', endJ);
  // keyboard
  const keys = new Set<string>();
  const kv = (): void => { const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0); const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0); const n = Math.hypot(x, y) || 1; api.move(x / n, y / n); };
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { if (!keys.has(k)) { keys.add(k); kv(); } e.preventDefault(); return; }
    if (k === ' ' || k === 'f') { e.preventDefault(); press(atk); api.attack(); return; }
    if (k === 'e') { press(itr); api.interact(); return; }
    if (/^[1-8]$/.test(k)) { const m = api.me(); if (!m) return; const s = hotbarSlots(m)[+k - 1]; if (s) api.useSlot(s as SlotItem); }
  });
  addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keys.delete(k)) kv(); });
  addEventListener('blur', () => { if (keys.size) { keys.clear(); api.move(0, 0); } });
  let sig = '';
  const refresh = (): void => {
    const m = api.me(); el.style.display = m ? '' : 'none'; if (!m) return;
    const s = hotbarSlots(m); const a = api.canAttack(); const it = api.canInteract();
    const nsig = JSON.stringify([s.map((k) => (k ? [k, countOf(m, k)] : null)), m.drawn, a, it]); if (nsig === sig) return; sig = nsig;
    bar.replaceChildren(...s.map((k, i) => { const n = k ? countOf(m, k) : 0; const sel = !!k && m.drawn === k;
      const b = h('button', { class: `slot${sel ? ' sel' : ''}${k && !n ? ' empty' : ''}`, title: k ? `${slotLabel(k)} × ${n}` : 'Boş yuva (Çanta’dan atayın)' }, h('span', { class: 'n' }, String(i + 1)), k ? h('span', { class: 'ic' }, ICON[k] ?? '•') : '', k && n > 1 ? h('span', { class: 'c' }, String(n)) : '');
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(b); if (k) api.useSlot(k as SlotItem); }); return b; }));
    atk.disabled = !a.on; atk.title = a.label; (atk.lastChild as HTMLElement).textContent = a.on ? 'Saldır' : 'Saldır';
    itr.disabled = !it.on; itr.title = it.label; (itr.lastChild as HTMLElement).textContent = it.on ? it.label.slice(0, 14) : 'Etkileşim';
  };
  return { refresh, el };
}
