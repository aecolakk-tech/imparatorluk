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
export type Sfx = 'click' | 'coins' | 'door' | 'bell' | 'crowd' | 'drums' | 'prison' | 'death' | 'step' | 'error' | 'msg' | 'gavel' | 'menu' | 'confirm' | 'cancel' | 'tap';
export const sfxLog: Sfx[] = []; // for tests: what was played (only when not muted)
export function sfx(k: Sfx): void {
  if (muted) return; sfxLog.push(k); if (sfxLog.length > 50) sfxLog.shift(); (window as unknown as { __sfx?: Sfx[]; __sfxN?: number }).__sfx = sfxLog; const ww = window as unknown as { __sfxN?: number }; ww.__sfxN = (ww.__sfxN ?? 0) + 1;
  switch (k) {
    case 'menu': tone(520, 0.06, 'triangle', 0.08); tone(780, 0.08, 'triangle', 0.07, 0.05); break;
    case 'confirm': tone(660, 0.06, 'square', 0.05); tone(990, 0.09, 'square', 0.05, 0.06); break;
    case 'cancel': tone(520, 0.06, 'square', 0.05); tone(350, 0.09, 'square', 0.05, 0.06); break;
    case 'tap': tone(1200, 0.03, 'sine', 0.06); break;
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
  void root; // v1.7: one global delegated handler – every button, icon, tab, menu item, link and map tap clicks
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement; startMusic();
    const bt = t.closest('button') as HTMLElement | null; if (bt) { const r = bt.getBoundingClientRect(); bt.style.setProperty('--rx', `${e.clientX - r.left}px`); bt.style.setProperty('--ry', `${e.clientY - r.top}px`); }
    const el = t.closest('button, [role="button"], .tab, select, summary, a, label, input[type="checkbox"], input[type="radio"], .stat, .icon, tr[style*="pointer"], .card[onclick]') as HTMLElement | null;
    if (t.tagName === 'CANVAS') { sfx('tap'); return; }
    if (!el) return;
    const txt = el.textContent ?? '';
    if (el.classList.contains('close') || /^✕|İptal|Vazgeç|Reddet|Kapat/.test(txt.trim())) sfx('cancel');
    else if (el.classList.contains('tab') || /Menü/.test(txt)) sfx('menu');
    else if (el.classList.contains('primary') || /Tamam|Gönder|Onayla|Kaydet|Evet/.test(txt)) sfx('confirm');
    else sfx('click');
  }, { capture: true });
}

// ---------------- v1.7 background music: procedural, Hicaz makamı (oud + ney drone + darbuka), own toggle ----------------
let musicEnabled = localStorage.getItem('imp-music') !== '0';
let musicGain: GainNode | null = null; let musicTimer: number | null = null; let nextBar = 0; let barNo = 0;
export const musicOn = (): boolean => musicEnabled;
export function setMusic(on: boolean): void { musicEnabled = on; localStorage.setItem('imp-music', on ? '1' : '0'); if (on) startMusic(); else stopMusic(); }
const D3 = 146.83; const HICAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16]; // semitones over D (Hicaz on D)
const f = (st: number, base = D3): number => base * Math.pow(2, st / 12);
// short melodic phrases (scale degrees), repeated with variation → a loop that does not tire quickly
const PHRASES = [[4, 3, 2, 1, 2, 3, 2, 1, 0, -1], [0, 1, 2, 3, 4, 5, 4, 3, 2, -1], [7, 6, 5, 4, 5, 4, 3, 2, 1, 0], [2, 3, 4, 3, 2, 1, 2, 1, 0, -1]];
function pluck(ac2: AudioContext, out: AudioNode, freq: number, at: number, dur: number, vol: number): void {
  const o = ac2.createOscillator(); const o2 = ac2.createOscillator(); const g = ac2.createGain(); const lp = ac2.createBiquadFilter();
  o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = freq; o2.frequency.value = freq * 2.003; lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, at); lp.frequency.exponentialRampToValueAtTime(500, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out); o.start(at); o2.start(at); o.stop(at + dur + 0.05); o2.stop(at + dur + 0.05);
}
function drum(ac2: AudioContext, out: AudioNode, at: number, low: boolean, vol: number): void {
  const o = ac2.createOscillator(); const g = ac2.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(low ? 110 : 330, at); o.frequency.exponentialRampToValueAtTime(low ? 55 : 180, at + (low ? 0.18 : 0.06));
  g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + (low ? 0.25 : 0.08)); o.connect(g); g.connect(out); o.start(at); o.stop(at + 0.3);
}
function scheduleBar(ac2: AudioContext, out: AudioNode, t0: number): number {
  const beat = 0.42; const ph = PHRASES[barNo % PHRASES.length]!; const oct = barNo % 8 >= 4 ? 12 : 0;
  ph.forEach((deg, i) => { if (deg < 0) return; const st = HICAZ[Math.min(HICAZ.length - 1, deg)]! + oct; pluck(ac2, out, f(st), t0 + i * beat * 0.8, beat * (i === ph.length - 2 ? 2.2 : 1.1), 0.07); });
  // darbuka: düm-tek-tek-düm-tek (Maksum feel)
  [[0, true], [1, false], [1.5, false], [2, true], [3, false], [4, true], [5, false], [5.5, false], [6, true], [7, false]].forEach(([b, low]) => drum(ac2, out, t0 + (b as number) * beat, low as boolean, low ? 0.09 : 0.04));
  // drone (D + A), soft
  [D3 / 2, f(7, D3 / 2)].forEach((fr) => { const o = ac2.createOscillator(); const g = ac2.createGain(); o.type = 'triangle'; o.frequency.value = fr; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.025, t0 + 0.6); g.gain.linearRampToValueAtTime(0.0001, t0 + 8 * beat); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 8 * beat + 0.1); });
  barNo += 1; return 8 * beat;
}
// ---------------- v1.9.3 night music: slow, sparse, minor (D minor + flat 2nd), low drones, distant bell ----------------
let mood: 'gun' | 'gece' = 'gun'; let dayBus: GainNode | null = null; let nightBus: GainNode | null = null; let nightBarNo = 0;
const NIGHT = [0, 1, 3, 5, 7, 8, 10, 12]; // Phrygian on D: uneasy minor
function scheduleNightBar(ac2: AudioContext, out: AudioNode, t0: number): number {
  const len = 9.6; const r = (k: number): number => { const x = Math.sin((nightBarNo * 13 + k) * 91.7) * 43758.5; return x - Math.floor(x); };
  // two detuned low drones (D1 + Ab1 tritone shadow every other bar) with a slow swell
  const roots = [D3 / 4, nightBarNo % 2 ? f(6, D3 / 4) : f(7, D3 / 4)];
  roots.forEach((fr, i) => { for (const dt of [0, 0.7]) { const o = ac2.createOscillator(); const g = ac2.createGain(); const lp = ac2.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = fr + dt; lp.type = 'lowpass'; lp.frequency.value = 260; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(i ? 0.016 : 0.03, t0 + len * 0.45); g.gain.linearRampToValueAtTime(0.0001, t0 + len + 0.8); o.connect(lp); lp.connect(g); g.connect(out); o.start(t0); o.stop(t0 + len + 1); } });
  // a few lonely notes, far apart, soft and long
  const n = 2 + Math.floor(r(1) * 3);
  for (let i = 0; i < n; i++) { const deg = NIGHT[Math.floor(r(i + 2) * NIGHT.length)]!; pluck(ac2, out, f(deg), t0 + 0.8 + i * (len - 2) / n + r(i + 9) * 0.6, 2.6, 0.035); }
  // distant bell now and then
  if (nightBarNo % 3 === 2) for (const [m, v] of [[1, 0.03], [2.76, 0.012], [5.4, 0.006]] as const) { const o = ac2.createOscillator(); const g = ac2.createGain(); o.frequency.value = f(1, D3) * m; const at = t0 + len * 0.6; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 4.5); o.connect(g); g.connect(out); o.start(at); o.stop(at + 4.6); }
  // a slow heartbeat-like low thud
  [0, 0.35, 4.8, 5.15].forEach((b, i) => drum(ac2, out, t0 + b, true, i % 2 ? 0.035 : 0.05));
  nightBarNo += 1; return len;
}
/** Day (Hicaz) ↔ night (dark, uneasy) background music with a 5 s crossfade. */
export function setMusicMood(m: 'gun' | 'gece'): void {
  if (m === mood) return; mood = m; const a = ctx; if (!a || !dayBus || !nightBus) return; const t = a.currentTime;
  for (const [bus, on] of [[dayBus, m === 'gun'], [nightBus, m === 'gece']] as const) { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(on ? 1 : 0.0001, t + 5); }
  nextBar = Math.max(t + 0.1, Math.min(nextBar, t + 2.5)); // start the new mood within a couple of seconds
}
export const musicMood = (): string => mood;
export function startMusic(): void {
  if (!musicEnabled || musicTimer !== null) return; const a = ac(); if (!a) return;
  if (!musicGain) { musicGain = a.createGain(); musicGain.gain.value = 0.55; musicGain.connect(a.destination); dayBus = a.createGain(); nightBus = a.createGain(); dayBus.gain.value = mood === 'gun' ? 1 : 0.0001; nightBus.gain.value = mood === 'gece' ? 1 : 0.0001; dayBus.connect(musicGain); nightBus.connect(musicGain); }
  nextBar = a.currentTime + 0.2;
  musicTimer = window.setInterval(() => { const x = ac(); if (!x || !dayBus || !nightBus) return; while (nextBar < x.currentTime + 1.5) nextBar += mood === 'gece' ? scheduleNightBar(x, nightBus, nextBar) : scheduleBar(x, dayBus, nextBar); }, 300);
}
export function stopMusic(): void { if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; } if (musicGain) { musicGain.disconnect(); musicGain = null; dayBus = null; nightBus = null; } }
