/** v2.0.1: in-game styled replacements for window.alert/confirm/prompt (no system dialogs, also inside the APK WebView). */
import { h } from './dom';

function shell(title: string, body: (Node | string)[], buttons: HTMLElement[]): HTMLElement {
  const el = h('div', { class: 'modal app-dialog' }, h('div', { class: 'box parchment' }, h('h2', {}, title), ...body, h('div', { class: 'row dialog-buttons' }, ...buttons)));
  document.body.append(el); return el;
}
/** Yes/no question; resolves true only on the confirm button. Escape / backdrop = no. */
export function askConfirm(text: string, yes = 'Evet', no = 'Vazgeç', title = 'Emin misiniz?'): Promise<boolean> {
  return new Promise((res) => {
    let el: HTMLElement | null = null; const done = (v: boolean): void => { el?.remove(); document.removeEventListener('keydown', key); res(v); };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
    el = shell(title, [h('div', { class: 'msg' }, text)], [h('button', { onclick: () => done(false) }, no), h('button', { class: 'danger', onclick: () => done(true) }, yes)]);
    el.addEventListener('click', (e) => { if (e.target === el) done(false); });
    document.addEventListener('keydown', key);
  });
}
/** Text question; resolves the typed text or null. */
export function askText(text: string, placeholder = '', title = 'Onay'): Promise<string | null> {
  return new Promise((res) => {
    const inp = h('input', { placeholder, maxlength: '40' }) as HTMLInputElement;
    let el: HTMLElement | null = null; const done = (v: string | null): void => { el?.remove(); res(v); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); });
    el = shell(title, [h('div', { class: 'msg' }, text), inp], [h('button', { onclick: () => done(null) }, 'Vazgeç'), h('button', { class: 'primary', onclick: () => done(inp.value) }, 'Tamam')]);
    setTimeout(() => inp.focus(), 30);
  });
}
/** Generic modal with custom content; returns a close function. */
export function openModal(title: string, body: (Node | string)[], buttons: { label: string; cls?: string; onClick: (close: () => void) => void }[], extraClass = ''): () => void {
  let el: HTMLElement | null = null; const close = (): void => { el?.remove(); el = null; };
  el = shell(title, body, buttons.map((b) => h('button', { class: b.cls ?? '', onclick: () => b.onClick(close) }, b.label)));
  if (extraClass) el.classList.add(...extraClass.split(' '));
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  return close;
}
