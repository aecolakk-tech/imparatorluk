/** v2.0.3 İş görevi window: 3 themed steps; each fills up, then must be tapped before its window runs out. */
import { h } from './dom';
import type { Action, Job, Person, World } from '../sim/types';
import { taskFor, tasksToday, TASKS_PER_DAY, TASK_MIN_MS, TASK_FAST_MS } from '../sim/jobtask';

export const STEP_FILL_MS = 6000, STEP_WINDOW_MS = 5000;
type ActR = (a: Action) => Promise<{ ok: boolean; msg?: string }>;
let open: HTMLElement | null = null;
export const jobTaskOpen = (): boolean => !!open?.isConnected;

export function openJobTask(cur: () => { w: World; me: Person } | null, actR: ActR, toast: (t: string) => void, onEnd?: () => void): void {
  if (jobTaskOpen()) return; const c0 = cur(); const j: Job | undefined = c0?.me.job; if (!c0 || !j) { toast('İşiniz yok.'); return; } const me = c0.me;
  const today = (): number => { const c = cur(); return c ? tasksToday(c.w, c.me.job) : 0; };
  const t = taskFor(j, me); let timer: ReturnType<typeof setInterval> | null = null; let alive = true;
  const close = (): void => { alive = false; if (timer) clearInterval(timer); timer = null; open?.remove(); open = null; onEnd?.(); };
  const title = h('h2', {}, `🛠 ${t.name}`); const sub = h('div', { class: 'muted' }, '');
  const steps = t.steps.map((s) => h('div', { class: 'jt-step' }, h('span', { class: 'jt-label' }, s), h('div', { class: 'jt-bar' }, h('i', {}))));
  const btn = h('button', { class: 'primary jt-go', disabled: true } as never, '…') as HTMLButtonElement;
  const foot = h('div', { class: 'row dialog-buttons' }, h('button', { onclick: close }, 'Vazgeç'));
  open = h('div', { class: 'modal app-dialog jobtask' }, h('div', { class: 'box parchment' }, title, sub, ...steps, btn, foot));
  document.body.append(open);
  let i = 0; let phase: 'fill' | 'tap' = 'fill'; let t0 = performance.now(); const started = performance.now();
  const setBar = (k: number, f: number, cls = ''): void => { const bar = steps[k]!.querySelector('i') as HTMLElement; bar.style.width = `${Math.round(f * 100)}%`; steps[k]!.className = `jt-step ${cls}`; };
  const finish = async (): Promise<void> => {
    btn.disabled = true; btn.textContent = '⏳ Kontrol ediliyor…';
    const wait = TASK_MIN_MS + 300 - (performance.now() - started); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const r = await actR({ t: 'jobTask', step: 'done' }); if (!alive) return;
    sub.textContent = r.msg ?? ''; if (r.msg) toast(r.msg);
    const n = today();
    btn.remove(); foot.replaceChildren(
      r.ok && n < TASKS_PER_DAY ? h('button', { class: 'primary', onclick: () => { close(); openJobTask(cur, actR, toast, onEnd); } }, `Sonraki görev (${n + 1}/${TASKS_PER_DAY})`) : '',
      h('button', { onclick: close }, 'Kapat'));
  };
  const tickUi = (): void => {
    if (!alive) return; const now = performance.now(); const el = now - t0;
    if (phase === 'fill') { setBar(i, Math.min(1, el / STEP_FILL_MS), 'on'); btn.disabled = true; btn.textContent = `${t.steps[i]} …`; if (el >= STEP_FILL_MS) { phase = 'tap'; t0 = now; } return; }
    const left = STEP_WINDOW_MS - el; btn.disabled = false; btn.textContent = `👉 ${t.steps[i]} (${Math.ceil(left / 1000)} sn)`; setBar(i, 1, 'ready');
    if (left <= 0) { phase = 'fill'; t0 = now; setBar(i, 0, 'miss'); sub.textContent = '⌛ Kaçırdınız – bu adımı yeniden yapın.'; }
  };
  btn.onclick = () => {
    if (phase !== 'tap') return; setBar(i, 1, 'done'); i += 1; sub.textContent = '';
    if (i >= t.steps.length) { if (timer) clearInterval(timer); timer = null; void finish(); return; }
    phase = 'fill'; t0 = performance.now();
  };
  sub.textContent = `Görev ${today() + 1}/${TASKS_PER_DAY} · her adım dolunca düğmeye basın. ${Math.round(TASK_FAST_MS / 1000)} sn içinde biterse bahşiş!`;
  void actR({ t: 'jobTask', step: 'start' }).then((r) => {
    if (!alive) return; if (!r.ok) { if (r.msg) toast(r.msg); close(); return; }
    t0 = performance.now(); timer = setInterval(tickUi, 100); tickUi();
  });
}
