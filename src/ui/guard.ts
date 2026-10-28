/** v2.0.3 input guards (pure, unit-tested). */
/** A click that belongs to a press which began BEFORE the panel/window existed (the tap that opened it) must not land on it. */
export function isGhostClick(bornAt: number, lastDownAt: number, now: number, detail: number): boolean {
  return detail > 0 && bornAt > lastDownAt && now - bornAt < 1000;
}
/** A modal whose box can't be seen can't be closed either: the watchdog removes it. */
export function invisibleBox(r: { width: number; height: number } | null | undefined, display?: string, visibility?: string, opacity?: string | number): boolean {
  return !r || r.width < 4 || r.height < 4 || display === 'none' || visibility === 'hidden' || Number(opacity ?? 1) < 0.05;
}
/** A busy/press flag older than `maxMs` is stale. */
export const staleFlag = (on: boolean, since: number, now: number, maxMs: number): boolean => on && now - since > maxMs;
