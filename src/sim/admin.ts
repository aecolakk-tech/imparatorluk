import type { World } from './types';
import { findPerson } from './world';
import { log } from './log';

export type AdminOp =
  | { t: 'setTreasury'; amount: number }
  | { t: 'editPerson'; personId: string; field: 'money' | 'mood' | 'loyalty' | 'republic' | 'hunger' | 'jailedDays' | 'name'; value: number | string }
  | { t: 'ban'; playerId: string; banned: boolean }
  | { t: 'kick'; playerId: string }
  | { t: 'releaseAll' }
  | { t: 'resetCumhuriyet' }
  | { t: 'allowStateTakeover'; allow: boolean };

/** Founder-only maintenance. Note: setTreasury/editPerson money deliberately break conservation (bug fixing). */
export function applyAdmin(w: World, op: AdminOp): string {
  switch (op.t) {
    case 'setTreasury': w.treasury = Math.max(-100000, Math.min(1e7, op.amount)); return 'Hazine ayarlandı.';
    case 'editPerson': {
      const p = findPerson(w, op.personId); if (!p) return 'Kişi yok.';
      if (op.field === 'name') { p.name = String(op.value).slice(0, 24); return 'İsim değişti.'; }
      const v = Number(op.value); if (!Number.isFinite(v)) return 'Geçersiz değer.';
      p[op.field] = op.field === 'money' ? v : Math.max(0, Math.min(100, v)); return 'Değer değişti.';
    }
    case 'ban': { const pl = w.players[op.playerId]; if (!pl || pl.founder) return 'Olmaz.'; pl.banned = op.banned; const p = findPerson(w, pl.personId); if (p) p.npc = op.banned; log(w, `${pl.name} ${op.banned ? 'sürgün edildi' : 'affedildi'}.`); return 'Tamam.'; }
    case 'kick': { const pl = w.players[op.playerId]; if (!pl) return 'Yok.'; pl.lastSeen = 0; return 'Oyundan atıldı.'; }
    case 'releaseAll': for (const p of w.people) p.jailedDays = 0; for (const c of w.cases) c.stage = 'kapandi'; return 'Zindan boşaltıldı.';
    case 'allowStateTakeover': w.allowStateTakeover = op.allow; return op.allow ? 'Yeni oyuncular devlet görevlilerini de devralabilir.' : 'Devlet görevlileri devralınamaz.';
    case 'resetCumhuriyet': for (const p of w.people) p.republic = 5; w.cumhuriyet = 5; w.cumhuriyetDays = 0; return 'Sıfırlandı.';
  }
}
