import type { World } from '../sim/types';
import { applyView, haveOf, type Have, type WorldView } from '../server/view';

/** v2.0.5: client copy of the slim world view; turns server deltas into a whole World for the UI. */
export class ViewCache {
  world: World | null = null; private view: WorldView | null = null; private ver = -1; private freshW: World | null = null;
  have(): Have | null { return haveOf(this.view); }
  reset(): void { this.view = null; this.ver = -1; }
  /** apply a view; returns the current world, or null if it could not be applied (caller asks for a full view) */
  take(v: WorldView & { ver?: number }, fresh = false): World | null {
    if (typeof v.ver === 'number' && v.ver < this.ver && this.world) return this.world; // an older answer overtook a newer one: ignore it
    const w = applyView(this.world, this.view, v);
    if (!w) { this.reset(); return null; }
    this.world = w; this.view = v; if (typeof v.ver === 'number') this.ver = v.ver;
    if (fresh) this.freshW = w;
    return w;
  }
  /** world delivered with an action's answer that the UI has not consumed yet (saves a heartbeat round trip) */
  takeFresh(): World | null { const w = this.freshW; this.freshW = null; return w && w === this.world ? w : null; }
}
