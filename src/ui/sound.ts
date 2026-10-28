/**
 * All sounds are synthesised with the Web Audio API (no files, nothing to license):
 * morning birds, evening crickets, clicks, coins, door, bell, crowd, drums, prison door, death.
 */
let ctx: AudioContext | null = null; let master: GainNode | null = null;
let muted = localStorage.getItem('imp-mute') === '1';
export const isMuted = (): boolean => muted;
export function setMuted(m: boolean): void { muted = m; localStorage.setItem('imp-mute', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : 0.6; }
function ac(): AudioContext | null {
  if (!ctx) { try { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, at = 0, slideTo?: number): void {
  const c = ac(); if (!c || !master || muted) return; const t = c.currentTime + at;
  const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, vol = 0.2, filter = 1200, at = 0, q = 0.7, type: BiquadFilterType = 'lowpass'): void {
  const c = ac(); if (!c || !master || muted) return; const t = c.currentTime + at;
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q; const g = c.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export type Sfx = 'click' | 'coins' | 'door' | 'bell' | 'crowd' | 'drums' | 'prison' | 'death' | 'step' | 'error' | 'msg' | 'gavel';
export function sfx(k: Sfx): void {
  switch (k) {
    case 'click': tone(880, 0.05, 'square', 0.05); break;
    case 'step': noise(0.05, 0.05, 600); break;
    case 'error': tone(220, 0.15, 'sawtooth', 0.07); tone(180, 0.2, 'sawtooth', 0.07, 0.12); break;
    case 'msg': tone(660, 0.08, 'sine', 0.12); tone(990, 0.12, 'sine', 0.1, 0.08); break;
    case 'coins': for (let i = 0; i < 4; i += 1) tone(1800 + i * 300, 0.09, 'triangle', 0.09, i * 0.06); break;
    case 'door': noise(0.18, 0.35, 300); tone(90, 0.25, 'sine', 0.25, 0.02); break;
    case 'bell': for (const [f, v] of [[523, 0.25], [1046, 0.12], [1568, 0.06], [2093, 0.04]] as const) tone(f, 2.2, 'sine', v); tone(523, 2.2, 'sine', 0.2, 1.1); break;
    case 'crowd': for (let i = 0; i < 6; i += 1) noise(1.2, 0.08, 500 + i * 120, i * 0.25, 4, 'bandpass'); tone(392, 0.3, 'triangle', 0.05, 0.4); tone(494, 0.3, 'triangle', 0.05, 0.7); break;
    case 'drums': for (let i = 0; i < 8; i += 1) { tone(70, 0.3, 'sine', i % 4 === 0 ? 0.5 : 0.3, i * 0.32, 40); if (i % 2) noise(0.08, 0.1, 2000, i * 0.32 + 0.16); } break;
    case 'prison': noise(0.4, 0.4, 2500, 0, 8, 'bandpass'); tone(160, 0.6, 'square', 0.12, 0.05, 80); noise(0.25, 0.3, 400, 0.45); break;
    case 'gavel': noise(0.06, 0.5, 900); tone(140, 0.12, 'sine', 0.3); noise(0.06, 0.5, 900, 0.3); tone(140, 0.12, 'sine', 0.3, 0.3); break;
    case 'death': tone(392, 0.4, 'sawtooth', 0.12, 0, 196); tone(330, 0.6, 'sawtooth', 0.1, 0.35, 110); noise(0.4, 0.3, 300, 0.9); break;
  }
}
// ---------- ambience ----------
let ambTimer: number | null = null; let ambKind = '';
export function ambience(kind: 'sabah' | 'aksam' | 'gece' | 'gun' | 'festival' | 'isyan'): void {
  if (kind === ambKind) return; ambKind = kind; if (ambTimer) clearInterval(ambTimer); ambTimer = null;
  const step = (): void => {
    if (muted || document.hidden) return;
    if (kind === 'sabah') { const f = 2500 + Math.random() * 1500; for (let i = 0; i < 3 + Math.random() * 3; i += 1) tone(f + Math.random() * 600, 0.07, 'sine', 0.035, i * 0.09, f * 1.3); }
    else if (kind === 'aksam' || kind === 'gece') { for (let i = 0; i < 6; i += 1) tone(4200 + Math.random() * 300, 0.03, 'square', kind === 'gece' ? 0.012 : 0.018, i * 0.05); }
    else if (kind === 'gun') { if (Math.random() < 0.3) tone(3000 + Math.random() * 800, 0.06, 'sine', 0.02, 0, 3600); }
    else if (kind === 'festival') { if (Math.random() < 0.5) sfx('crowd'); }
    else if (kind === 'isyan') sfx('drums');
  };
  ambTimer = window.setInterval(step, kind === 'isyan' ? 3200 : kind === 'festival' ? 2600 : kind === 'sabah' ? 1400 : 900);
}
/** Click sound for every button/icon in the app. */
export function installClickSounds(root: HTMLElement): void {
  root.addEventListener('pointerdown', (e) => { const t = e.target as HTMLElement; if (t.closest('button, .tab, select, summary')) sfx('click'); }, { capture: true });
}
