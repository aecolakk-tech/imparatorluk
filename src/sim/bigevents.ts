/** v1.9.9: one hourly entry point for weapons upkeep, raids, wars, plague and fire. */
import type { World } from './types';
import { npcArmsHour, bekciPatrol } from './arms';
import { raidHour, foreignHour, payRecruits } from './events2';
import { plagueHour, fireHour } from './events3';
import { placePeople } from './place';
export function bigEventsHour(w: World, now: number): void {
  npcArmsHour(w);
  bekciPatrol(w, placePeople(w, now), now);
  raidHour(w, now); foreignHour(w, now); plagueHour(w, now); fireHour(w, now);
  if (w.hour === 12) payRecruits(w);
}
