/**
 * v2.0.2 smooth bars: every bar eases to its new value instead of jumping (HP drops visibly after a hit), and the slow needs
 * (tokluk, su, enerji) keep moving between the hourly server updates by extrapolating their last hourly change.
 */
interface Rec { shown: number; srv: number; at: number; slope: number; t: number }
const st = new Map<string, Rec>();
const MAX_NORMAL_STEP = 8; // a bigger jump is eating/drinking/sleeping: no extrapolation from it
/** Eased display value for `key` (τ in ms). With `predict`, the value also drifts with its last normal hourly change. */
export function tween(key: string, target: number, tau = 350, predict = false): number {
  const now = performance.now(); let r = st.get(key);
  if (!r) { r = { shown: target, srv: target, at: now, slope: 0, t: now }; st.set(key, r); return target; }
  if (target !== r.srv) { const d = target - r.srv; const dt = now - r.at; r.slope = predict && Math.abs(d) <= MAX_NORMAL_STEP && dt > 2000 && dt < 600_000 ? d / dt : 0; r.srv = target; r.at = now; }
  let goal = target; if (predict && r.slope) { const drift = r.slope * (now - r.at); goal = target + Math.max(-MAX_NORMAL_STEP, Math.min(MAX_NORMAL_STEP, drift)); goal = Math.max(0, Math.min(100, goal)); }
  const dt = Math.min(250, now - r.t); r.t = now; r.shown += (goal - r.shown) * (1 - Math.exp(-dt / tau));
  if (Math.abs(goal - r.shown) < 0.05) r.shown = goal; return r.shown;
}
/** Last eased value without advancing it (for freshly built DOM bars). */
export function shownOr(key: string, v: number): number { return st.get(key)?.shown ?? v; }
