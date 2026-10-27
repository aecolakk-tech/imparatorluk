// src/sim/types.ts
var GOODS = ["ekmek", "su", "et", "balik", "kumas", "alet", "odun"];

// src/sim/constants.ts
var DAY_MS = 10 * 60 * 1e3;
var HOUR_MS = DAY_MS / 24;
var ONLINE_WINDOW_MS = 60 * 1e3;
var MAX_CATCHUP_HOURS = 48;
var SNAPSHOT_EVERY_MS = 3 * 24 * 3600 * 1e3;
var INACTIVE_TO_NPC_MS = 21 * 24 * 3600 * 1e3;
var MAP_W = 72;
var MAP_H = 52;
var BASE_PRICE = { ekmek: 3, su: 2, et: 12, balik: 8, kumas: 18, alet: 22, odun: 5 };
var GOOD_LABEL = { ekmek: "Ekmek", su: "Su", et: "Et", balik: "Bal\u0131k", kumas: "Kuma\u015F", alet: "Alet", odun: "Odun" };
var PRODUCES = {
  firinci: { good: "ekmek", qty: 11, market: "gida" },
  sucu: { good: "su", qty: 14, market: "gida" },
  kasap: { good: "et", qty: 9, market: "gida" },
  balikci: { good: "balik", qty: 6, market: "pazar" },
  terzi: { good: "kumas", qty: 2, market: "zanaat" },
  demirci: { good: "alet", qty: 2, market: "zanaat" },
  marangoz: { good: "odun", qty: 4, market: "yeni" }
};
var DECAY = { ekmek: 0.35, su: 0.3, et: 0.3, balik: 0.4, kumas: 0.01, alet: 5e-3, odun: 0.03 };
var STATE_PROFS = ["memur", "tahsildar", "bekci", "savci", "hakim", "asker", "hoca", "imam"];
var DEFAULT_SALARY = {
  memur: 11,
  tahsildar: 11,
  bekci: 11,
  savci: 14,
  hakim: 15,
  asker: 10,
  hoca: 10,
  imam: 8,
  naip: 0,
  kayzer: 0
};
var PROF_LABEL = {
  firinci: "F\u0131r\u0131nc\u0131",
  sucu: "Sucu",
  kasap: "Kasap",
  balikci: "Bal\u0131k\xE7\u0131",
  terzi: "Terzi",
  demirci: "Demirci",
  marangoz: "Marangoz",
  tuccar: "T\xFCccar",
  hekim: "Hekim",
  hoca: "Hoca",
  hamal: "Hamal",
  insaatci: "\u0130n\u015Faat\xE7\u0131",
  kalemsor: "Kalem\u015F\xF6r",
  imam: "\u0130mam",
  memur: "Memur",
  tahsildar: "Tahsildar",
  bekci: "Bek\xE7i",
  savci: "Savc\u0131",
  hakim: "H\xE2kim",
  asker: "Asker",
  kayzer: "Kayzer",
  naip: "Naip"
};
var PLAYER_PROFS = ["firinci", "sucu", "kasap", "balikci", "terzi", "demirci", "marangoz", "tuccar", "hekim", "hamal", "insaatci", "kalemsor"];

// src/sim/rng.ts
function rand(w) {
  let t = w.rng = w.rng + 1831565813 | 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function randInt(w, lo, hi) {
  return lo + Math.floor(rand(w) * (hi - lo + 1));
}
function pick(w, arr) {
  return arr[Math.floor(rand(w) * arr.length)];
}
function chance(w, p) {
  return rand(w) < p;
}
function nextId(w, prefix) {
  w.idSeq += 1;
  return `${prefix}${w.idSeq}`;
}
var clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// src/sim/log.ts
function isOnline(w, playerId, now, windowMs = 6e4) {
  if (!playerId) return false;
  const pl = w.players[playerId];
  return !!pl && !pl.banned && now - pl.lastSeen < windowMs;
}
function log(w, text, personId, now) {
  const p = findPerson(w, personId);
  const b2 = p ? w.buildings.find((x) => x.id === (w.hour >= 8 && w.hour < 18 ? p.work : p.home)) : void 0;
  w.events.push({ day: w.day, hour: w.hour, text, personId, x: b2?.door.x, y: b2?.door.y });
  if (w.events.length > 120) w.events.splice(0, w.events.length - 120);
  w.todayEvents.push(text);
  if (w.todayEvents.length > 200) w.todayEvents.shift();
  if (p?.playerId) personal(w, p.playerId, text, now);
}
function personal(w, playerId, text, now) {
  const pl = w.players[playerId];
  if (!pl) return;
  if (now === void 0 || now - pl.lastSeen > 6e4) {
    pl.awayLog.push(`G\xFCn ${w.day}: ${text}`);
    if (pl.awayLog.length > 40) pl.awayLog.shift();
  }
}
var headTitle = (w) => w.regime === "cumhuriyet" ? "Ba\u015Fkan" : "Kayzer";
function kayzerPlayerId(w) {
  return findPerson(w, w.kayzerId)?.playerId ?? null;
}

// src/sim/ai.ts
var fullAI = (p) => p.playerId === null || p.npc;
function isState(p) {
  return STATE_PROFS.includes(p.prof);
}
function consume(w, p) {
  if (p.prof === "naip") {
    p.hunger = 0;
    p.thirst = 0;
    return;
  }
  p.hunger = clamp(p.hunger + 34);
  p.thirst = clamp(p.thirst + 40);
  if (p.jailedDays > 0) {
    p.hunger = clamp(p.hunger - 25);
    p.thirst = clamp(p.thirst - 40);
    return;
  }
  const need = (g, n) => {
    if (p.inv[g] < n) buy(w, p.id, g, n - p.inv[g], p.money * 0.6);
  };
  need("ekmek", 1);
  need("su", 1);
  if (p.money > 25 && chance(w, 0.55)) need(chance(w, 0.5) ? "et" : "balik", 1);
  if (p.money > 40 && chance(w, 0.08)) buy(w, p.id, "kumas", 1, p.money * 0.5);
  if (p.money > 40 && chance(w, 0.06)) buy(w, p.id, "alet", 1, p.money * 0.5);
  if (p.money > 15 && chance(w, 0.25)) buy(w, p.id, "odun", 1, p.money * 0.5);
  if (p.inv.ekmek === 0 && lawOn(w, "askida")) {
    const sponsor = w.people.find((x) => x.inv.ekmek > 3 && x.money > 200 && x.id !== p.id && x.prof !== "firinci");
    if (sponsor) {
      sponsor.inv.ekmek -= 1;
      p.inv.ekmek += 1;
    }
  }
  while (p.hunger > 15 && p.inv.ekmek > 0) {
    p.inv.ekmek -= 1;
    p.hunger = clamp(p.hunger - 35);
  }
  for (const g of ["et", "balik"]) if (p.inv[g] > 0 && p.hunger > 0) {
    p.inv[g] -= 1;
    p.hunger = clamp(p.hunger - 30);
    p.mood = clamp(p.mood + 3);
  }
  while (p.thirst > 15 && p.inv.su > 0) {
    p.inv.su -= 1;
    p.thirst = clamp(p.thirst - 45);
  }
  if (p.inv.kumas > 0) p.mood = clamp(p.mood + 0.5);
  if (p.inv.odun > 0) {
    p.inv.odun -= 1;
    p.mood = clamp(p.mood + 1);
  }
}
function spendSurplus(w, p) {
  if (p.prof === "naip" || p.id === w.kayzerId || p.jailedDays > 0 || p.money <= 120) return;
  let budget = (p.money - 120) * 0.12;
  for (const g of ["et", "balik", "kumas", "odun", "alet"]) {
    if (budget <= 0) break;
    const pr = w.prices[g];
    if (pr <= budget * 0.5) {
      buy(w, p.id, g, 1, budget);
      budget -= pr;
    }
  }
  const services = w.people.filter((x) => ["hamal", "hekim", "hoca", "kalemsor", "insaatci", "imam", "terzi", "marangoz"].includes(x.prof) && x.jailedDays === 0 && x.id !== p.id);
  const poor = w.people.filter((x) => x.money < 10 && x.id !== p.id && x.prof !== "naip");
  if (poor.length && budget > 2) {
    const r = pick(w, poor);
    const amt = Math.round(budget * 0.25 * 100) / 100;
    if (transfer(w, p.id, r.id, amt, "sadaka")) {
      budget -= amt;
      r.relations[p.id] = clamp((r.relations[p.id] ?? 0) + 5, -100, 100);
    }
  }
  for (let i = 0; i < 3 && budget > 1 && services.length; i += 1) {
    const s = pick(w, services);
    const amt = Math.round(budget / (3 - i) * 100) / 100;
    if (transfer(w, p.id, s.id, amt, "hizmet")) {
      s.incomeToday += amt;
      budget -= amt;
    }
  }
}
function isPoor(w, p, avgMoney) {
  const avg = avgMoney ?? w.people.reduce((s, x) => s + x.money, 0) / w.people.length;
  return p.money < Math.max(25, avg * 0.3) && p.incomeToday < 12;
}
function feel(w, p) {
  if (p.prof === "naip" || p.id === w.kayzerId) return;
  const hungry = p.hunger > 60 || p.thirst > 60;
  if (hungry) {
    p.mood -= 7;
    p.health -= 6;
    p.republic += 1.2;
    p.loyalty -= 1;
  } else {
    p.mood += 0.6;
    p.health += 3;
  }
  const avgMoney = w.people.reduce((s, x) => s + x.money, 0) / w.people.length;
  const poor = isPoor(w, p, avgMoney);
  if (poor) {
    p.mood -= 1.2;
    p.republic += 0.9;
  }
  if (chance(w, 0.04)) {
    p.health -= 30;
    p.mood -= 5;
  }
  const breadPrice = marketPrice(w, "ekmek");
  if (breadPrice > 5) p.mood -= 1.5;
  if (w.taxRate > 10) {
    p.mood -= (w.taxRate - 10) * 0.18;
  }
  if (w.taxRate > 18) p.loyalty -= 0.4;
  if (w.taxRate < 10) {
    p.mood += 0.5;
  }
  if (p.money < 5) p.mood -= 2;
  if (p.money > 300) p.mood += 0.5;
  if (p.unemployedDays > 2) p.mood -= 3;
  if (p.spouse) p.mood += 0.7;
  p.mood += (60 - p.mood) * 0.05;
  p.loyalty += (p.mood - 50) * 0.02;
  if (!poor && !hungry && p.plotting !== "revolution") p.republic -= 0.5;
  if (p.loyalty > 75 && p.plotting !== "revolution") p.republic -= 0.4;
  if (w.headAwayDays > 3 && w.regime === "imparatorluk") {
    p.loyalty -= 0.5;
    p.mood -= 0.3;
  }
  p.mood = clamp(p.mood);
  p.loyalty = clamp(p.loyalty);
  p.republic = clamp(p.republic);
  p.health = clamp(p.health);
  p.thought = think(w, p);
}
function think(w, p) {
  if (p.jailedDays > 0) return "Zindanday\u0131m\u2026 H\xE2kim insaf etsin.";
  if (p.hunger > 60) return marketPrice(w, "ekmek") > 4.5 ? "Ekmek pahal\u0131, saraya dilek\xE7e yazay\u0131m." : "Karn\u0131m a\xE7, bir lokma ekmek\u2026";
  if (p.thirst > 60) return "Su laz\u0131m, kuyuya gideyim.";
  if (p.money < 5) return "Cebimde metelik yok.";
  if (p.unemployedDays > 2) return "\u0130\u015F yok, \u015Fantiyede i\u015F arayay\u0131m.";
  if (p.plotting !== "none") return p.plotting === "coup" ? "Askerlerle konu\u015Fmak laz\u0131m\u2026" : "Halk uyanmal\u0131, cumhuriyet!";
  if (p.republic > 60) return w.regime === "cumhuriyet" ? "Ya\u015Fas\u0131n cumhuriyet!" : "Bu saltanat b\xF6yle gitmez.";
  if (w.taxRate > 18) return "Vergiler belimizi b\xFCk\xFCyor.";
  if (p.mood > 75) return pick(w, ["Ne g\xFCzel bir g\xFCn!", "Allah devletimize zeval vermesin.", "\u0130\u015Fler yolunda."]);
  if (p.prof === "tuccar") return "Ucuz al, pahal\u0131 sat.";
  if (p.prof === "kalemsor") return "Yar\u0131nki man\u015Fet ne olsun?";
  if (p.prof === "asker") return p.loyalty > 60 ? "Kayzer i\xE7in n\xF6betteyim." : "Maa\u015F da az, n\xF6bet de uzun.";
  return pick(w, ["Bug\xFCn pazara u\u011Framal\u0131.", "Kom\u015Fuyla biraz sohbet edeyim.", "\u0130\u015Fe gidiyorum.", "Ak\u015Fama ne pi\u015Firsek?"]);
}
function openPetition(w, p, kind, text, amount = 0, payload) {
  if (w.petitions.some((x) => x.fromId === p.id && x.status === "bekliyor")) return null;
  const pet = { id: nextId(w, "D"), fromId: p.id, kind, text, day: w.day, expires: w.day + (kind === "kanun" || kind === "gorev" ? 5 : 2), status: "bekliyor", amount, payload };
  w.petitions.push(pet);
  log(w, `${p.name} saraya dilek\xE7e verdi: \u201C${text}\u201D`, p.id);
  return pet;
}
function decide(w, p) {
  if (!fullAI(p) || p.jailedDays > 0 || p.prof === "naip" || p.id === w.kayzerId) return;
  if (chance(w, 0.18)) {
    if (p.hunger > 55 && p.money < 10) openPetition(w, p, "yardim", `Efendim, ${p.money < 2 ? "evde ekmek yok" : "\xE7ocuklar a\xE7"}, ${Math.round(15)} Dinar yard\u0131m rica ederim.`, 15);
    else if (p.unemployedDays > 2) openPetition(w, p, "is", "Efendim, i\u015F bulam\u0131yorum. \u015Eantiyede ya da limanda bir i\u015F verilsin.");
    else if (w.taxRate > 16 && p.mood < 45) openPetition(w, p, "vergi", `Vergi %${w.taxRate} \xE7ok a\u011F\u0131r, indirilmesini rica ederiz.`);
    else if (marketPrice(w, "ekmek") > 5 && p.mood < 50) openPetition(w, p, "sikayet", "Ekmek fiyat\u0131 \xE7ok y\xFCkseldi, f\u0131r\u0131nlar denetlensin.");
  }
  if (p.money < 8 && p.hunger > 45 && p.honesty < 55 && chance(w, (60 - p.honesty) / 160)) {
    const victims = w.people.filter((v) => v.money > 80 && v.id !== p.id && v.prof !== "kayzer" && v.prof !== "naip");
    if (victims.length) steal(w, p, pick(w, victims));
  }
  if (p.prof === "tuccar" && p.honesty < 30 && p.money > 200 && chance(w, 0.12)) {
    const t = w.people.find((x) => x.prof === "tahsildar" && x.honesty < 50 && x.jailedDays === 0);
    if (t) {
      transfer(w, p.id, t.id, 20, "r\xFC\u015Fvet");
      log(w, `${p.name}, ${t.name}'a r\xFC\u015Fvet verdi diye f\u0131s\u0131ldan\u0131yor.`, p.id);
      if (lawOn(w, "rusvet") && chance(w, bekciPower(w) * 0.6)) openCase(w, p.id, "rusvet", t.id, 20, 55);
    }
  }
  if (p.mood < 28 && lawOn(w, "toplanti") && chance(w, 0.25)) {
    p.republic = clamp(p.republic + 2);
    log(w, `${p.name} Pazar meydan\u0131nda protesto yapt\u0131.`, p.id);
  }
  if (p.republic > 65 && p.ambition > 55 && p.plotting === "none" && chance(w, 0.1)) {
    p.plotting = "revolution";
    log(w, `${p.name} gizlice cumhuriyet\xE7ilere kat\u0131ld\u0131.`, p.id);
  }
  if (p.plotting === "revolution" && p.republic < 40) p.plotting = "none";
  if (p.plotting === "revolution" && w.regime === "imparatorluk") {
    const avgMoney = w.people.reduce((s, x) => s + x.money, 0) / w.people.length;
    for (let i = 0; i < 2; i += 1) {
      const t = pick(w, w.people);
      if (t.id === p.id || t.prof === "naip" || t.id === w.kayzerId) continue;
      const receptive = isPoor(w, t, avgMoney) || t.hunger > 60 || t.loyalty < 50;
      t.republic = clamp(t.republic + (receptive ? 4 : 0.8));
      if (receptive && chance(w, 0.3)) log(w, `${p.name}, ${t.name}'a cumhuriyet propagandas\u0131 yapt\u0131.`, p.id);
    }
  }
  const other = pick(w, w.people);
  if (other && other.id !== p.id && other.prof !== "naip") {
    const rel = (p.relations[other.id] ?? 0) + (rand(w) < 0.7 ? 4 : -6);
    p.relations[other.id] = clamp(rel, -100, 100);
    if (p.republic > 60 && other.republic < p.republic) other.republic = clamp(other.republic + (other.hunger > 60 || other.money < 10 ? 2 : 0.3));
    else if (p.loyalty > 70 && other.republic > 10) other.republic = clamp(other.republic - 0.3);
    if (!p.spouse && !other.spouse && p.female !== other.female && rel > 30 && fullAI(other) && chance(w, 0.25) && p.home.startsWith("ev")) {
      p.spouse = other.id;
      other.spouse = p.id;
      other.home = p.home;
      p.mood = clamp(p.mood + 15);
      other.mood = clamp(other.mood + 15);
      log(w, `${p.name} ile ${other.name} evlendi! Cami avlusunda d\xFC\u011F\xFCn var.`, p.id);
    }
    trimRelations(p);
  }
}
function trimRelations(p) {
  const keys = Object.keys(p.relations);
  if (keys.length > 12) {
    keys.sort((a, b2) => Math.abs(p.relations[a] ?? 0) - Math.abs(p.relations[b2] ?? 0));
    for (const k of keys.slice(0, keys.length - 12)) delete p.relations[k];
  }
}
function bekciPower(w) {
  const b2 = w.people.filter((x) => x.prof === "bekci" && x.jailedDays === 0).length;
  return Math.min(0.85, 0.12 + b2 * 0.09);
}
function steal(w, thief, victim) {
  const amt = Math.min(Math.round(victim.money * 0.15), 30);
  if (amt <= 0) return 0;
  transfer(w, victim.id, thief.id, amt, "h\u0131rs\u0131zl\u0131k");
  victim.mood = clamp(victim.mood - 10);
  victim.relations[thief.id] = -60;
  thief.lastAction = "h\u0131rs\u0131zl\u0131k";
  log(w, `${victim.name} gece soyuldu (${amt} Dinar).`, victim.id);
  if (chance(w, bekciPower(w))) {
    const bekci = w.people.find((x) => x.prof === "bekci" && x.jailedDays === 0);
    log(w, `${bekci?.name ?? "Bek\xE7i"} h\u0131rs\u0131z\u0131 kovalad\u0131 ve yakalad\u0131: ${thief.name}!`, thief.id);
    openCase(w, thief.id, "hirsizlik", victim.id, amt, 50 + Math.round(rand(w) * 40));
  }
  return amt;
}
function openCase(w, accusedId, crime, victimId, amount, evidence) {
  if (w.cases.some((c) => c.accusedId === accusedId && c.stage !== "kapandi" && c.crime === crime)) return;
  const acc = findPerson(w, accusedId);
  if (acc?.meclis && acc.immune) {
    log(w, `${acc.name} yakaland\u0131 ama Meclis dokunulmazl\u0131\u011F\u0131 var; dava a\xE7\u0131lamad\u0131.`, acc.id);
    return;
  }
  w.cases.push({ id: nextId(w, "C"), accusedId, crime, victimId, amount, evidence, stage: "savci", day: w.day, deadline: w.day + 1 });
  const a = findPerson(w, accusedId);
  if (a) a.jailedDays = Math.max(a.jailedDays, 1);
}
var CRIME_LABEL = { hirsizlik: "H\u0131rs\u0131zl\u0131k", rusvet: "R\xFC\u015Fvet", zimmet: "Zimmet", isyan: "\u0130syan" };

// src/sim/meclis.ts
var FACTIONS = [
  { id: "saltanat", name: "Saltanat Partisi", ideology: "saltanatci", leaderId: null, color: "#7b2d8b" },
  { id: "cumhuriyet", name: "Cumhuriyet Hareketi", ideology: "cumhuriyetci", leaderId: null, color: "#3a6ad0" },
  { id: "esnaf", name: "Esnaf Birli\u011Fi", ideology: "esnaf", leaderId: null, color: "#c9a227" },
  { id: "halk", name: "Halk F\u0131rkas\u0131", ideology: "halkci", leaderId: null, color: "#c8483a" }
];
var SEATS = [
  { id: "bat\u0131", label: "Bat\u0131 Mahallesi", kind: "bolge", key: "bati" },
  { id: "merkez", label: "\xC7ar\u015F\u0131 (Merkez)", kind: "bolge", key: "merkez" },
  { id: "do\u011Fu", label: "Do\u011Fu Mahallesi", kind: "bolge", key: "dogu" },
  { id: "liman", label: "Liman Mahallesi", kind: "bolge", key: "liman" },
  { id: "esnaf", label: "Esnaf Sandalyesi", kind: "meslek", key: "esnaf" },
  { id: "devlet", label: "Devlet Memurlar\u0131", kind: "meslek", key: "devlet" },
  { id: "emekci", label: "Emek\xE7iler", kind: "meslek", key: "emekci" }
];
var DEBATE_DAYS = 1;
var VOTE_DAYS = 1;
var SANCTION_DAYS = 3;
var DEFAULT_BUDGET = 600;
function initMeclis() {
  return { seats: SEATS.map((s) => ({ ...s, holder: null })), factions: FACTIONS.map((f) => ({ ...f })), bills: [], log: [], bribes: [], salary: 10 };
}
function districtOf(w, p) {
  const b2 = w.buildings.find((x2) => x2.id === p.home);
  const x = b2?.x ?? 36;
  const y = b2?.y ?? 20;
  if (y >= 38) return "liman";
  if (x < 24) return "bati";
  if (x < 48) return "merkez";
  return "dogu";
}
function profGroup(p) {
  if (PRODUCES[p.prof] || p.prof === "tuccar" || p.prof === "hekim") return "esnaf";
  if (STATE_PROFS.includes(p.prof)) return "devlet";
  if (p.prof === "hamal" || p.prof === "insaatci" || p.prof === "kalemsor") return "emekci";
  return null;
}
var inSeat = (w, p, s) => s.kind === "bolge" ? districtOf(w, p) === s.key : profGroup(p) === s.key;
function naturalFaction(p) {
  if (p.republic > 55 || p.plotting === "revolution") return "cumhuriyet";
  if (p.loyalty > 72) return "saltanat";
  if (profGroup(p) === "esnaf") return "esnaf";
  return "halk";
}
var members = (w) => w.people.filter((p) => p.meclis);
var mlog = (w, text, personId) => {
  w.meclis.log.push({ day: w.day, text });
  if (w.meclis.log.length > 150) w.meclis.log.shift();
  log(w, `Meclis: ${text}`, personId);
};
function meclisElection(w, playerCandidates, playerVotes, npcAI) {
  const winners = [];
  for (const s of w.meclis.seats) {
    const pool = w.people.filter((p) => inSeat(w, p, s) && p.jailedDays === 0 && p.prof !== "naip" && p.prof !== "kayzer" && p.id !== w.kayzerId && !winners.includes(p.id));
    const cands = [.../* @__PURE__ */ new Set([
      ...playerCandidates.filter((id) => pool.some((p) => p.id === id)),
      ...pool.filter((p) => npcAI(p) && p.ambition > 45).sort((a, b2) => b2.ambition + b2.money / 20 - (a.ambition + a.money / 20)).slice(0, 3).map((p) => p.id)
    ])];
    if (!cands.length) {
      s.holder = null;
      continue;
    }
    const tally2 = {};
    for (const c of cands) tally2[c] = 0;
    for (const v of w.people.filter((p) => inSeat(w, p, s) && p.prof !== "naip")) {
      const pv = playerVotes[v.id];
      if (pv && tally2[pv] !== void 0) {
        tally2[pv] += 1;
        continue;
      }
      let best = "";
      let bs = -Infinity;
      for (const c of cands) {
        const cp = findPerson(w, c);
        const sc = (v.relations[c] ?? 0) - Math.abs(v.republic - cp.republic) - Math.abs(v.loyalty - cp.loyalty) * 0.3 + rand(w) * 30 + (c === v.id ? 50 : 0);
        if (sc > bs) {
          bs = sc;
          best = c;
        }
      }
      if (best) tally2[best] = (tally2[best] ?? 0) + 1;
    }
    const win = Object.entries(tally2).sort((a, b2) => b2[1] - a[1])[0][0];
    s.holder = win;
    winners.push(win);
  }
  for (const p of w.people) {
    const was = p.meclis;
    p.meclis = winners.includes(p.id);
    if (p.meclis && !was) {
      p.immune = true;
      if (!p.faction) p.faction = naturalFaction(p);
    }
    if (!p.meclis) p.immune = false;
  }
  electLeaders(w);
  mlog(w, `Se\xE7im sonu\xE7lar\u0131: ${w.meclis.seats.map((s) => `${s.label}: ${findPerson(w, s.holder)?.name ?? "bo\u015F"}`).join(", ")}.`);
  return winners;
}
function electLeaders(w) {
  for (const f of w.meclis.factions) {
    const m = w.people.filter((p) => p.faction === f.id && p.meclis);
    const pool = m.length ? m : w.people.filter((p) => p.faction === f.id);
    const cur = findPerson(w, f.leaderId);
    if (cur && cur.faction === f.id && (cur.meclis || !m.length)) continue;
    f.leaderId = pool.sort((a, b2) => (b2.playerId ? 1e3 : 0) + b2.ambition - ((a.playerId ? 1e3 : 0) + a.ambition))[0]?.id ?? null;
  }
}
function validateBill(w, kind, value, target) {
  switch (kind) {
    case "vergi":
      return value >= 0 && value <= 40 ? null : "Vergi 0\u201340 aras\u0131 olmal\u0131.";
    case "fiyat":
      return GOODS.includes(target) && value > 0 && value <= 100 ? null : "Ge\xE7ersiz narh.";
    case "maas":
      return (STATE_PROFS.includes(target) || target === "meclis") && value >= 0 && value <= 60 ? null : "Ge\xE7ersiz maa\u015F.";
    case "butce":
      return value >= 0 && value <= 5e4 ? null : "B\xFCt\xE7e 0\u201350000.";
    case "kanun":
      return w.laws.some((l) => l.id === target) ? null : "Kanun yok.";
    case "insaat":
      return value >= 100 && value <= 2e4 ? null : "\u0130n\u015Faat 100\u201320000 Dinar.";
    case "af":
      return null;
    case "gensoru": {
      const p = findPerson(w, target);
      return p && STATE_PROFS.includes(p.prof) ? null : "Gensoru sadece devlet g\xF6revlileri i\xE7in.";
    }
    case "sorusturma":
      return findPerson(w, target) && target !== w.kayzerId ? null : "Ge\xE7ersiz ki\u015Fi.";
    case "dokunulmazlik": {
      const p = findPerson(w, target);
      return p?.meclis && p.immune ? null : "Bu ki\u015Finin dokunulmazl\u0131\u011F\u0131 yok.";
    }
    case "azil":
      return w.regime === "cumhuriyet" && w.kayzerId ? null : "Azil sadece cumhuriyette, Ba\u015Fkan i\xE7in.";
  }
}
function billTitle(w, kind, value, target) {
  const who = findPerson(w, target)?.name ?? "";
  switch (kind) {
    case "vergi":
      return `Sat\u0131\u015F vergisi %${value} olsun`;
    case "fiyat":
      return `${GOOD_LABEL[target] ?? target} narh\u0131 ${value} Dinar`;
    case "maas":
      return `${target === "meclis" ? "Meclis \xFCyesi" : PROF_LABEL[target]} maa\u015F\u0131 ${value} Dinar`;
    case "butce":
      return `20 g\xFCnl\xFCk b\xFCt\xE7e: ${value} Dinar harcama s\u0131n\u0131r\u0131`;
    case "kanun": {
      const l = w.laws.find((x) => x.id === target);
      return `${l?.name ?? target} ${l?.active ? "kald\u0131r\u0131ls\u0131n" : "y\xFCr\xFCrl\xFC\u011Fe girsin"}`;
    }
    case "insaat":
      return `Yeni in\u015Faat (${value} Dinar)`;
    case "af":
      return "Genel af: zindan bo\u015Falt\u0131ls\u0131n";
    case "gensoru":
      return `Gensoru: ${who} g\xF6revden al\u0131ns\u0131n`;
    case "sorusturma":
      return `Soru\u015Fturma komisyonu: ${who}`;
    case "dokunulmazlik":
      return `${who}'\u0131n dokunulmazl\u0131\u011F\u0131 kald\u0131r\u0131ls\u0131n`;
    case "azil":
      return `Ba\u015Fkan ${who} azledilsin`;
  }
}
function propose(w, proposer, kind, value, target, title) {
  if (!proposer.meclis) return "Sadece Meclis \xFCyeleri kanun teklif edebilir.";
  if (kind === "azil") target = w.kayzerId ?? "";
  const err = validateBill(w, kind, value, target);
  if (err) return err;
  if (w.meclis.bills.filter((b2) => b2.status === "tartisma" || b2.status === "oylama").length >= 6) return "Meclis g\xFCndemi dolu.";
  if (w.meclis.bills.some((b2) => b2.proposerId === proposer.id && (b2.status === "tartisma" || b2.status === "oylama"))) return "G\xF6r\xFC\u015F\xFClen bir teklifiniz zaten var.";
  const bill = {
    id: nextId(w, "B"),
    kind,
    value,
    target,
    title: title?.slice(0, 60) || billTitle(w, kind, value, target),
    proposerId: proposer.id,
    day: w.day,
    debateUntil: w.day + DEBATE_DAYS,
    voteUntil: w.day + DEBATE_DAYS + VOTE_DAYS,
    status: "tartisma",
    votes: {},
    speeches: []
  };
  w.meclis.bills.push(bill);
  mlog(w, `${proposer.name} teklif verdi: \u201C${bill.title}\u201D.`, proposer.id);
  return bill;
}
function stance(w, p, b2) {
  const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? "halkci";
  let s = 0;
  const target = findPerson(w, b2.target);
  switch (b2.kind) {
    case "vergi":
      s = b2.value < w.taxRate ? f === "esnaf" ? 0.8 : f === "saltanatci" ? -0.2 : 0.4 : f === "saltanatci" ? 0.3 : -0.6;
      if (b2.value > 20) s -= 0.6;
      break;
    case "fiyat":
      s = f === "esnaf" ? -0.7 : f === "halkci" ? 0.6 : 0;
      break;
    case "maas":
      s = b2.target === p.prof || b2.target === "meclis" ? 0.8 : f === "halkci" ? 0.4 : f === "esnaf" ? -0.4 : 0;
      break;
    case "butce":
      s = f === "saltanatci" ? 0.7 : f === "esnaf" ? b2.value < 1500 ? 0.4 : -0.5 : b2.value > 3e3 ? -0.3 : 0.3;
      break;
    case "kanun": {
      const l = w.laws.find((x) => x.id === b2.target);
      s = l?.id === "saraykor" ? f === "saltanatci" ? 0.6 : -0.7 : l?.id === "toplanti" ? f === "cumhuriyetci" ? l.active ? -0.9 : 0.9 : 0 : f === "halkci" ? 0.3 : 0;
      break;
    }
    case "insaat":
      s = f === "halkci" ? 0.7 : f === "esnaf" ? 0.2 : 0.1;
      break;
    case "af":
      s = f === "cumhuriyetci" || f === "halkci" ? 0.5 : -0.6;
      break;
    case "gensoru":
      s = f === "cumhuriyetci" ? 0.6 : f === "saltanatci" ? -0.7 : 0;
      if (target) s += (50 - target.honesty) / 80;
      break;
    case "sorusturma":
      s = f === "cumhuriyetci" ? 0.6 : f === "saltanatci" ? -0.3 : 0.2;
      if (target && target.honesty < 40) s += 0.3;
      if (target?.id === p.id) s = -1;
      break;
    case "dokunulmazlik":
      s = target?.id === p.id ? -1 : target?.faction === p.faction ? -0.6 : 0.3;
      break;
    case "azil": {
      const avgMood = w.people.reduce((a, x) => a + x.mood, 0) / w.people.length;
      s = (50 - avgMood) / 40 + (target?.faction === p.faction ? -0.8 : 0.2);
      break;
    }
  }
  const leader = findPerson(w, w.meclis.factions.find((x) => x.id === p.faction)?.leaderId);
  const lv = leader && leader.id !== p.id ? b2.votes[leader.id] : void 0;
  if (lv) s += lv === "evet" ? 0.5 : lv === "hayir" ? -0.5 : 0;
  s += (p.relations[b2.proposerId] ?? 0) / 200;
  const bribe = w.meclis.bribes.filter((x) => x.to === p.id && w.day - x.day <= 10 && x.from === b2.proposerId).reduce((a, x) => a + x.amount, 0);
  if (bribe > 0 && p.honesty < 70) s += Math.min(1.2, bribe / 60);
  return Math.max(-1.5, Math.min(1.5, s + (rand(w) - 0.5) * 0.5));
}
function npcVote(w, p, b2) {
  const s = stance(w, p, b2);
  return s > 0.15 ? "evet" : s < -0.15 ? "hayir" : "cekimser";
}
var SPEECH = {
  evet: ["Bu teklif halk\u0131n yarar\u0131nad\u0131r, destekliyoruz!", "\u015Eehir bunu bekliyor; evet diyece\u011Fiz."],
  hayir: ["Bu teklif hazineyi de halk\u0131 da yorar, kar\u015F\u0131y\u0131z!", "B\xF6yle bir karar \u015Fehre zarar verir."],
  cekimser: ["Teklifin baz\u0131 y\xF6nleri iyi, baz\u0131lar\u0131 de\u011Fil; d\xFC\u015F\xFCnmeliyiz.", "Daha fazla g\xF6r\xFC\u015Fme gerekiyor."]
};
function enactable(b2) {
  return b2.status === "kabul";
}
function enact(w, b2) {
  b2.status = "kabul";
  switch (b2.kind) {
    case "vergi":
      w.taxRate = b2.value;
      break;
    case "fiyat": {
      const g = b2.target;
      w.prices[g] = b2.value;
      for (const l of w.listings) if (l.good === g && l.price > b2.value) l.price = b2.value;
      break;
    }
    case "maas":
      if (b2.target === "meclis") w.meclis.salary = b2.value;
      else w.salaries[b2.target] = b2.value;
      break;
    case "butce":
      w.budget = { limit: b2.value, spent: 0, until: w.day + 20, approved: true };
      break;
    case "kanun": {
      const l = w.laws.find((x) => x.id === b2.target);
      if (l) l.active = !l.active;
      break;
    }
    case "insaat": {
      if (!w.projects.some((p) => !p.done)) w.projects.push({ id: `pr${++w.idSeq}`, name: b2.title.replace(/^Yeni inşaat/, "Meclis in\u015Faat\u0131"), site: "santiye", cost: b2.value, paid: 0, progress: 0, needed: Math.round(b2.value / 10), done: false });
      const pr = w.projects.find((p) => !p.done);
      if (pr) transfer(w, "saray", `proje:${pr.id}`, Math.min(b2.value, Math.max(0, w.treasury)), "Meclis in\u015Faat \xF6dene\u011Fi");
      break;
    }
    case "af":
      for (const p of w.people) p.jailedDays = 0;
      for (const c of w.cases) if (c.stage !== "kapandi") {
        c.stage = "kapandi";
        c.verdict = "af";
      }
      break;
    case "gensoru": {
      const t = findPerson(w, b2.target);
      if (t) {
        const old = PROF_LABEL[t.prof];
        t.prof = "hamal";
        t.work = WORKPLACE.hamal;
        t.mood = clamp(t.mood - 20);
        mlog(w, `Gensoru kabul edildi: ${t.name} ${old} g\xF6revinden al\u0131nd\u0131.`, t.id);
      }
      break;
    }
    case "sorusturma":
      investigate(w, b2.target);
      break;
    case "dokunulmazlik": {
      const t = findPerson(w, b2.target);
      if (t) {
        t.immune = false;
        mlog(w, `${t.name}'\u0131n dokunulmazl\u0131\u011F\u0131 kald\u0131r\u0131ld\u0131.`, t.id);
      }
      break;
    }
    case "azil": {
      const t = findPerson(w, w.kayzerId);
      w.kayzerId = null;
      w.election.baskanNextDay = w.day + 1;
      mlog(w, `Ba\u015Fkan ${t?.name ?? ""} azledildi! Yar\u0131n yeni Ba\u015Fkanl\u0131k se\xE7imi var.`);
      break;
    }
  }
  b2.result = "y\xFCr\xFCrl\xFC\u011Fe girdi";
}
function investigate(w, targetId) {
  const t = findPerson(w, targetId);
  if (!t) return "kimse yok";
  const dirty = w.ledger.filter((l) => (l.to === t.id || l.from === t.id) && ["r\xFC\u015Fvet", "zimmet", "h\u0131rs\u0131zl\u0131k"].includes(l.reason) && w.day - l.day <= 30);
  const bribes = w.meclis.bribes.filter((x) => (x.to === t.id || x.from === t.id) && w.day - x.day <= 30);
  for (const x of bribes) x.exposed = true;
  const amount = dirty.reduce((a, l) => a + l.amount, 0) + bribes.reduce((a, x) => a + x.amount, 0);
  if (!dirty.length && !bribes.length) {
    mlog(w, `Soru\u015Fturma komisyonu ${t.name} hakk\u0131nda su\xE7 bulamad\u0131.`);
    return "temiz";
  }
  const crime = dirty.some((l) => l.reason === "zimmet") ? "zimmet" : dirty.some((l) => l.reason === "h\u0131rs\u0131zl\u0131k") ? "hirsizlik" : "rusvet";
  if (t.meclis && t.immune) {
    mlog(w, `Komisyon ${t.name} hakk\u0131nda ${Math.round(amount)} Dinar'l\u0131k delil buldu, ama dokunulmazl\u0131\u011F\u0131 var.`, t.id);
    return "dokunulmazl\u0131k";
  }
  openCase(w, t.id, crime, null, Math.round(amount), Math.min(95, 50 + dirty.length * 10 + bribes.length * 15));
  mlog(w, `Soru\u015Fturma komisyonu ${t.name} hakk\u0131ndaki delilleri mahkemeye g\xF6nderdi (${Math.round(amount)} Dinar).`, t.id);
  return "mahkemeye";
}
function sanction(w, b2, approve) {
  if (b2.status !== "onay") return "Bu karar onay beklemiyor.";
  if (approve) {
    enact(w, b2);
    mlog(w, `Kayzer \u201C${b2.title}\u201D karar\u0131n\u0131 onaylad\u0131.`);
    return "Onayland\u0131, y\xFCr\xFCrl\xFCkte.";
  }
  b2.status = "veto";
  b2.result = "Kayzer veto etti (kesin)";
  for (const x of w.people) if (x.prof !== "naip" && x.id !== w.kayzerId) {
    x.republic = clamp(x.republic + 0.7);
    x.loyalty = clamp(x.loyalty - 1.5);
  }
  mlog(w, `Kayzer \u201C${b2.title}\u201D karar\u0131n\u0131 veto etti. Veto kesindir.`);
  return "Veto edildi. Veto kesindir.";
}
function tally(b2) {
  const t = { evet: 0, hayir: 0, cekimser: 0 };
  for (const v of Object.values(b2.votes)) t[v] += 1;
  return t;
}
function meclisDay(w, playerDecides, headOnline) {
  const ms = members(w);
  for (const p of ms) if (w.meclis.salary > 0 && p.jailedDays === 0) transfer(w, "saray", p.id, w.meclis.salary, "meclis maa\u015F\u0131");
  for (const p of ms) if (!playerDecides(p) && chance(w, 0.12)) npcPropose(w, p);
  for (const b2 of w.meclis.bills) {
    if (b2.status === "tartisma") {
      for (const p of ms) if (!playerDecides(p) && !b2.speeches.some((s) => s.personId === p.id) && chance(w, 0.5)) {
        const v = npcVote(w, p, b2);
        b2.speeches.push({ personId: p.id, text: pick(w, SPEECH[v]), day: w.day });
      }
      if (w.day >= b2.debateUntil) {
        b2.status = "oylama";
        mlog(w, `\u201C${b2.title}\u201D oylamaya a\xE7\u0131ld\u0131.`);
      }
    } else if (b2.status === "oylama" && w.day >= b2.voteUntil) {
      for (const p of ms) if (!b2.votes[p.id] && !playerDecides(p)) b2.votes[p.id] = npcVote(w, p, b2);
      const t = tally(b2);
      const need = b2.kind === "azil" ? Math.ceil(ms.length * 2 / 3) : Math.floor(ms.length / 2) + 1;
      const passed = t.evet >= need && t.evet > t.hayir;
      mlog(w, `\u201C${b2.title}\u201D: ${t.evet} evet, ${t.hayir} hay\u0131r, ${t.cekimser} \xE7ekimser \u2192 ${passed ? "KABUL" : "RET"}.`);
      if (!passed) {
        b2.status = "ret";
        b2.result = "Meclis reddetti";
        continue;
      }
      const needsSanction = w.regime === "imparatorluk" && b2.kind !== "sorusturma" && b2.kind !== "dokunulmazlik" && !!w.kayzerId;
      if (needsSanction) {
        b2.status = "onay";
        b2.voteUntil = w.day + SANCTION_DAYS;
        mlog(w, `\u201C${b2.title}\u201D Kayzer'in onay\u0131n\u0131 bekliyor.`);
      } else enact(w, b2);
    } else if (b2.status === "onay" && w.day > b2.voteUntil) {
      b2.status = "zamanasimi";
      b2.result = "Kayzer onaylamad\u0131, karar d\xFC\u015Ft\xFC";
      mlog(w, `\u201C${b2.title}\u201D Kayzer onaylamad\u0131\u011F\u0131 i\xE7in d\xFC\u015Ft\xFC.`);
    }
  }
  void headOnline;
  void enactable;
  for (const x of w.meclis.bribes) if (!x.exposed && chance(w, 0.06)) {
    x.exposed = true;
    const a = findPerson(w, x.from), m = findPerson(w, x.to);
    mlog(w, `SKANDAL! Kalem\u015F\xF6rler ${a?.name ?? "?"}'\u0131n ${m?.name ?? "?"}'a ${x.amount} Dinar r\xFC\u015Fvet verdi\u011Fini yazd\u0131.`, x.to);
    if (m) {
      m.loyalty = clamp(m.loyalty - 5);
      for (const p of w.people) p.relations[x.to] = clamp((p.relations[x.to] ?? 0) - 5, -100, 100);
      if (!(m.meclis && m.immune)) openCase(w, m.id, "rusvet", null, x.amount, 60);
    }
    if (a) openCase(w, a.id, "rusvet", null, x.amount, 55);
  }
  w.meclis.bribes = w.meclis.bribes.filter((x) => w.day - x.day <= 30);
  w.meclis.bills = w.meclis.bills.filter((b2) => ["tartisma", "oylama", "onay"].includes(b2.status) || w.day - b2.day < 25);
  if (w.day % 5 === 0) electLeaders(w);
}
function npcPropose(w, p) {
  const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? "halkci";
  const avgMood = w.people.reduce((a, x) => a + x.mood, 0) / w.people.length;
  const corrupt = w.ledger.filter((l) => (l.reason === "zimmet" || l.reason === "r\xFC\u015Fvet") && w.day - l.day < 15).map((l) => l.to);
  const off = w.people.filter((x) => STATE_PROFS.includes(x.prof) && x.honesty < 40);
  let r = "";
  if (!w.budget.approved && f !== "cumhuriyetci") r = propose(w, p, "butce", Math.round(Math.min(3e3, Math.max(800, w.treasury * 0.2)) / 100) * 100, "");
  else if (f === "esnaf" && w.taxRate > 12) r = propose(w, p, "vergi", w.taxRate - 2, "");
  else if (f === "cumhuriyetci" && corrupt[0] && findPerson(w, corrupt[0])?.id !== w.kayzerId) r = propose(w, p, "sorusturma", 0, corrupt[0]);
  else if (f === "cumhuriyetci" && w.regime === "cumhuriyet" && avgMood < 35 && w.kayzerId && findPerson(w, w.kayzerId)?.faction !== p.faction) r = propose(w, p, "azil", 0, "");
  else if (f === "cumhuriyetci" && off[0]) r = propose(w, p, "gensoru", 0, off[0].id);
  else if (f === "halkci" && w.people.filter((x) => x.jailedDays > 0).length > 4) r = propose(w, p, "af", 0, "");
  else if (f === "halkci" && !w.projects.some((x) => !x.done) && w.treasury > 1500) r = propose(w, p, "insaat", 800, "");
  else if (f === "halkci" && w.prices.ekmek > 4.5) r = propose(w, p, "fiyat", Math.round(BASE_PRICE.ekmek * 1.2 * 10) / 10, "ekmek");
  else if (f === "saltanatci" && (w.salaries.asker ?? 0) < 12) r = propose(w, p, "maas", 12, "asker");
  void r;
}
function budgetLeft(w) {
  if (w.day > w.budget.until) w.budget = { limit: DEFAULT_BUDGET, spent: 0, until: w.day + 20, approved: false };
  return Math.max(0, w.budget.limit - w.budget.spent);
}
function spend(w, amount) {
  if (budgetLeft(w) < amount) return false;
  w.budget.spent += amount;
  return true;
}

// src/sim/world.ts
function b(id, name, kind, x, y, w, h, market = false) {
  return { id, name, kind, x, y, w, h, door: { x: x + Math.floor(w / 2), y: y + h }, market };
}
var ROADS_Y = [13, 20, 29, 35, 44];
var ROADS_X = [6, 17, 29, 44, 56, 68];
function makeBuildings() {
  const list = [
    b("saray", "Saray", "saray", 30, 2, 12, 9),
    b("meclis", "Meclis", "meclis", 46, 5, 8, 6),
    b("mahkeme", "Mahkeme", "mahkeme", 19, 5, 8, 6),
    b("zindan", "Zindan", "zindan", 19, 15, 5, 4),
    b("kisla", "K\u0131\u015Fla", "kisla", 57, 3, 10, 8),
    b("cami", "Cami", "cami", 7, 3, 8, 8),
    b("okul", "Okul", "okul", 8, 15, 7, 4),
    b("hekimhane", "Hekimhane", "hekimhane", 46, 15, 7, 4),
    b("kahve", "Memurlar Kahvesi", "kahve", 34, 15, 6, 4, true),
    b("pazar", "Pazar", "pazar", 30, 22, 12, 6, true),
    b("gida", "G\u0131da Pazar\u0131", "pazar", 19, 22, 8, 5, true),
    b("zanaat", "Zanaat \xC7ar\u015F\u0131s\u0131", "pazar", 46, 22, 8, 5, true),
    b("yeni", "Yeni Pazar", "pazar", 58, 22, 8, 5, true),
    b("firin", "F\u0131r\u0131n", "firin", 8, 23, 6, 4),
    b("kasaphane", "Kasap", "kasap", 8, 30, 6, 4),
    b("degirmen", "De\u011Firmen", "degirmen", 1, 36, 4, 6),
    b("kuyu", "Su Kuyusu", "kuyu", 25, 30, 3, 3),
    b("atolye", "Zanaat At\xF6lyesi", "atolye", 58, 30, 8, 4),
    b("santiye", "\u015Eantiye", "santiye", 46, 30, 8, 4),
    b("liman", "Liman / Bal\u0131khane", "liman", 30, 45, 12, 3)
  ];
  const occupied = (x, y, w, h) => list.some((o) => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y) || ROADS_Y.some((ry) => ry >= y && ry < y + h + 1) || ROADS_X.some((rx) => rx >= x && rx < x + w);
  let n = 0;
  for (let y = 30; y <= 41; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3) && x + 3 < MAP_W && y + 3 < MAP_H - 6) {
        n += 1;
        list.push(b(`ev${n}`, `Ev ${n}`, "ev", x, y, 3, 3));
      }
    }
  }
  for (let y = 14; y <= 26; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3)) {
        n += 1;
        list.push(b(`ev${n}`, `Ev ${n}`, "ev", x, y, 3, 3));
      }
    }
  }
  return list;
}
var ERKEK = ["Ahmet", "Mehmet", "Mustafa", "Ali", "Hasan", "H\xFCseyin", "\u0130brahim", "Osman", "Yusuf", "Murat", "Kemal", "\xD6mer", "Halil", "Recep", "Ramazan", "Selim", "Kadir", "Orhan", "R\u0131za", "Fikret", "Sinan", "Levent", "Yavuz", "Cengiz", "Tuncay", "Serkan", "G\xF6khan", "Volkan", "Kerem", "B\xFClent", "Ferhat", "Erdem", "Do\u011Fan", "Haydar", "\u0130smail", "Faruk", "Nuri", "\u015E\xFCkr\xFC", "Cevdet", "Adem"];
var KADIN = ["Fatma", "Ay\u015Fe", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "\u015Eerife", "Hanife", "Sultan", "Hacer", "G\xFCls\xFCm", "Esra", "Merve", "Derya", "Sevgi", "Leyla", "Nermin", "Song\xFCl", "Filiz", "G\xFCl", "Dilek", "Nazl\u0131", "P\u0131nar", "Asl\u0131", "Melek", "Saadet", "Feride", "Kevser", "Nesrin"];
var NAMED = [
  { name: "Maecenas", prof: "naip", honesty: 95, ambition: 10, money: 200, loyalty: 100 },
  { name: "T\xFCccar Cemal", prof: "tuccar", honesty: 15, ambition: 90, money: 900, loyalty: 35 },
  { name: "Usta Bekir", prof: "insaatci", honesty: 70, ambition: 40, money: 180 },
  { name: "\xD6\u011Fretmen Nur", prof: "hoca", female: true, honesty: 85, ambition: 45, money: 120 },
  { name: "Hamal Can", prof: "hamal", honesty: 60, ambition: 30, money: 30 },
  { name: "Hamal Burak", prof: "hamal", honesty: 50, ambition: 55, money: 25 },
  { name: "F\u0131r\u0131nc\u0131 Ay\u015Fe", prof: "firinci", female: true, honesty: 80, money: 140 },
  { name: "F\u0131r\u0131nc\u0131 Zehra", prof: "firinci", female: true, honesty: 75, money: 130 },
  { name: "Bek\xE7i Emre", prof: "bekci", honesty: 70, money: 90 },
  { name: "Savc\u0131 Tar\u0131k", prof: "savci", honesty: 65, ambition: 60, money: 220 },
  { name: "H\xE2kim S\xFCleyman", prof: "hakim", honesty: 80, money: 300 },
  { name: "Kalem\u015F\xF6r Necati", prof: "kalemsor", honesty: 40, ambition: 75, money: 110, loyalty: 30 },
  { name: "Hoca Abdullah", prof: "imam", honesty: 85, money: 100, loyalty: 70 },
  { name: "Tahsildar R\u0131fat", prof: "tahsildar", honesty: 35, ambition: 60, money: 200 },
  { name: "Hekim Lokman", prof: "hekim", honesty: 85, money: 260 },
  { name: "Kasap Hayri", prof: "kasap", money: 160 },
  { name: "Bal\u0131k\xE7\u0131 R\xFCstem", prof: "balikci", money: 90 },
  { name: "Sucu Dursun", prof: "sucu", money: 80 },
  { name: "Terzi Nimet", prof: "terzi", female: true, money: 120 },
  { name: "Demirci Kaz\u0131m", prof: "demirci", money: 150 },
  { name: "Marangoz \u015Eevket", prof: "marangoz", money: 120 },
  { name: "Memur Nazmi", prof: "memur", money: 140 }
];
var COUNTS = [
  ["firinci", 10],
  ["sucu", 8],
  ["kasap", 4],
  ["balikci", 6],
  ["terzi", 5],
  ["demirci", 4],
  ["marangoz", 5],
  ["tuccar", 3],
  ["hekim", 3],
  ["hoca", 3],
  ["imam", 1],
  ["hamal", 9],
  ["insaatci", 8],
  ["kalemsor", 2],
  ["memur", 6],
  ["tahsildar", 3],
  ["bekci", 6],
  ["savci", 2],
  ["hakim", 2],
  ["asker", 10]
];
var WORKPLACE = {
  firinci: "firin",
  sucu: "kuyu",
  kasap: "kasaphane",
  balikci: "liman",
  terzi: "atolye",
  demirci: "atolye",
  marangoz: "atolye",
  tuccar: "pazar",
  hekim: "hekimhane",
  hoca: "okul",
  hamal: "pazar",
  insaatci: "santiye",
  kalemsor: "kahve",
  imam: "cami",
  memur: "saray",
  tahsildar: "kahve",
  bekci: "zindan",
  savci: "mahkeme",
  hakim: "mahkeme",
  asker: "kisla",
  kayzer: "saray",
  naip: "saray"
};
var TITLE = { asker: "Asker", bekci: "Bek\xE7i", hoca: "\xD6\u011Fretmen", hekim: "Hekim", savci: "Savc\u0131", hakim: "H\xE2kim", tuccar: "T\xFCccar", hamal: "Hamal", firinci: "F\u0131r\u0131nc\u0131", kalemsor: "Kalem\u015F\xF6r" };
function emptyInv() {
  const r = {};
  for (const g of GOODS) r[g] = 0;
  return r;
}
function makePerson(w, s, home) {
  const female = s.female ?? (s.prof === "asker" ? false : rand(w) < 0.4);
  return {
    id: `p${++w.idSeq}`,
    name: s.name,
    prof: s.prof,
    meclis: false,
    playerId: null,
    npc: true,
    home,
    work: WORKPLACE[s.prof],
    money: s.money ?? randInt(w, 40, 160),
    inv: { ...emptyInv(), ekmek: 2, su: 2 },
    hunger: randInt(w, 0, 20),
    thirst: randInt(w, 0, 20),
    mood: randInt(w, 55, 75),
    loyalty: s.loyalty ?? randInt(w, 50, 80),
    ambition: s.ambition ?? randInt(w, 10, 70),
    honesty: s.honesty ?? randInt(w, 30, 95),
    republic: randInt(w, 0, 15),
    health: 100,
    spouse: null,
    jailedDays: 0,
    incomeToday: 0,
    unemployedDays: 0,
    thought: "",
    lastAction: "evde",
    relations: {},
    hairColor: randInt(w, 0, 7),
    skin: randInt(w, 0, 3),
    shirt: randInt(w, 0, 7),
    female,
    plotting: "none",
    sidedWith: null,
    faction: null,
    immune: false,
    born: (w.day ?? 1) - randInt(w, 70, 300),
    parents: [],
    soylu: false,
    school: 0,
    exiledDays: 0
  };
}
function defaultLaws() {
  return [
    { id: "rusvet", name: "R\xFC\u015Fvet Yasa\u011F\u0131", desc: "R\xFC\u015Fvet veren ve alan yarg\u0131lan\u0131r.", active: true },
    { id: "zimmet", name: "Zimmet Yasa\u011F\u0131", desc: "Devlet paras\u0131n\u0131 zimmetine ge\xE7iren memur yarg\u0131lan\u0131r.", active: true },
    { id: "devletsuyu", name: "Devlet Suyu", desc: "Suyun fiyat\u0131 devlet\xE7e sabitlenir; fark hazineden sucuya \xF6denir.", active: true, param: 2, paramLabel: "Sabit fiyat (Dinar)" },
    { id: "devletekmegi", name: "Devlet Ekme\u011Fi", desc: "Hazine her g\xFCn en a\xE7 vatanda\u015Flara ekmek da\u011F\u0131t\u0131r.", active: true, param: 12, paramLabel: "G\xFCnl\xFCk ekmek" },
    { id: "askida", name: "Ask\u0131da Ekmek", desc: "Varl\u0131kl\u0131 vatanda\u015Flar f\u0131r\u0131na ekmek asar; a\xE7 olan al\u0131r.", active: true },
    { id: "saraykor", name: "Saray Korumas\u0131", desc: "Askerler saray\u0131 korur; darbe zorla\u015F\u0131r, maa\u015Flar\u0131 %20 artar.", active: false },
    { id: "toplanti", name: "Toplanma \xD6zg\xFCrl\xFC\u011F\xFC", desc: "Protestolar serbest; memnuniyetsizlik dilek\xE7eye d\xF6ner, cumhuriyet bask\u0131s\u0131 yava\u015F artar.", active: true }
  ];
}
function createWorld(seed = 42, now = Date.now()) {
  const w = {
    version: 1,
    seed,
    rng: seed,
    day: 1,
    hour: 6,
    lastTickAt: now,
    frozen: true,
    treasury: 1e4,
    taxRate: 12,
    headTax: 1,
    salaries: { ...DEFAULT_SALARY },
    laws: defaultLaws(),
    people: [],
    buildings: makeBuildings(),
    listings: [],
    prices: { ...BASE_PRICE },
    market: { sold: emptyInv(), unmet: emptyInv() },
    ledger: [],
    petitions: [],
    cases: [],
    projects: [{ id: "saray-insa", name: "Saray Kanad\u0131 \u0130n\u015Faat\u0131 (Usta Bekir)", site: "santiye", cost: 1200, paid: 200, progress: 0, needed: 120, done: false }],
    election: { nextDay: 10, candidates: [], votes: {}, seats: 5, baskanNextDay: 0, baskanCandidates: [], baskanVotes: {} },
    gazette: [],
    events: [],
    todayEvents: [],
    players: {},
    regime: "imparatorluk",
    meclis: initMeclis(),
    budget: { limit: DEFAULT_BUDGET, spent: 0, until: 20, approved: false },
    headAwayDays: 0,
    children: [],
    proposals: [],
    pregnancies: [],
    veliaht: null,
    regentId: null,
    regentFor: null,
    isyan: null,
    deposed: null,
    allowStateTakeover: false,
    kayzerId: null,
    founderPersonId: null,
    hanedanId: "",
    cumhuriyet: 5,
    cumhuriyetDays: 0,
    coup: null,
    stats: [],
    dailyIncome: 0,
    dailyExpense: 0,
    lastSnapshotAt: now,
    idSeq: 0
  };
  const houses = w.buildings.filter((x) => x.kind === "ev");
  let hi = 0;
  const nextHome = () => {
    const h = houses[hi % houses.length];
    hi += 1;
    return h ? h.id : "ev1";
  };
  const kayzer = makePerson(w, { name: "Kayzer", prof: "kayzer", honesty: 70, ambition: 50, money: 500, loyalty: 100 }, "saray");
  kayzer.work = "saray";
  w.people.push(kayzer);
  w.kayzerId = kayzer.id;
  w.hanedanId = kayzer.id;
  const usedNames = /* @__PURE__ */ new Set();
  const counts = new Map(COUNTS);
  for (const s of NAMED) {
    const home = s.prof === "naip" ? "saray" : nextHome();
    w.people.push(makePerson(w, s, home));
    usedNames.add(s.name);
    counts.set(s.prof, (counts.get(s.prof) ?? 0) - 1);
  }
  for (const [prof, c] of counts) {
    for (let i = 0; i < c; i += 1) {
      const female = prof === "asker" ? false : rand(w) < 0.4;
      let name = "";
      for (let k = 0; k < 20; k += 1) {
        const first = pick(w, female ? KADIN : ERKEK);
        name = TITLE[prof] ? `${TITLE[prof]} ${first}` : first;
        if (!usedNames.has(name)) break;
        name = `${name} ${String.fromCharCode(65 + randInt(w, 0, 25))}.`;
      }
      usedNames.add(name);
      w.people.push(makePerson(w, { name, prof, female }, prof === "asker" ? "kisla" : nextHome()));
    }
  }
  while (w.people.length < 112) {
    const prof = pick(w, ["hamal", "firinci", "sucu", "balikci", "insaatci", "marangoz", "terzi"]);
    const female = rand(w) < 0.5;
    const name = `${pick(w, female ? KADIN : ERKEK)} ${pick(w, ["Usta", "Efendi", "Han\u0131m", "A\u011Fa", "Kalfa"])}`;
    w.people.push(makePerson(w, { name, prof, female }, nextHome()));
  }
  const singles = w.people.filter((p) => p.home.startsWith("ev"));
  for (let i = 0; i + 1 < singles.length && i < 30; i += 2) {
    const a = singles[i];
    const c = singles[i + 1];
    if (a && c && a.female !== c.female && rand(w) < 0.5) {
      a.spouse = c.id;
      c.spouse = a.id;
      c.home = a.home;
    }
  }
  const nec = w.people.find((p) => p.name === "Kalem\u015F\xF6r Necati");
  if (nec) {
    nec.republic = 75;
    nec.plotting = "revolution";
    nec.faction = "cumhuriyet";
  }
  const cem = w.people.find((p) => p.name === "T\xFCccar Cemal");
  if (cem) cem.faction = "esnaf";
  meclisElection(w, [], {}, () => true);
  w.todayEvents = [];
  return w;
}
function findPerson(w, id) {
  if (!id) return void 0;
  return w.people.find((p) => p.id === id);
}

// src/sim/economy.ts
function transfer(w, from, to, amount, reason) {
  const amt = Math.round(amount * 100) / 100;
  if (!(amt > 0)) return false;
  if (balance(w, from) + 1e-9 < amt) return false;
  adjust(w, from, -amt);
  adjust(w, to, amt);
  if (from === "saray" || to === "saray") {
    if (to === "saray") w.dailyIncome += amt;
    else w.dailyExpense += amt;
  }
  w.ledger.push({ day: w.day, from, to, amount: amt, reason });
  if (w.ledger.length > 600) w.ledger.splice(0, w.ledger.length - 600);
  return true;
}
function balance(w, acc) {
  if (acc === "saray") return w.treasury;
  if (acc === "fon") return w.coup?.fund ?? 0;
  if (acc.startsWith("proje:")) return w.projects.find((p) => `proje:${p.id}` === acc)?.paid ?? 0;
  return findPerson(w, acc)?.money ?? 0;
}
function adjust(w, acc, d) {
  const r = (v) => Math.round(v * 100) / 100;
  if (acc === "saray") {
    w.treasury = r(w.treasury + d);
    return;
  }
  if (acc === "fon") {
    if (w.coup) w.coup.fund = r(w.coup.fund + d);
    return;
  }
  if (acc.startsWith("proje:")) {
    const p2 = w.projects.find((x) => `proje:${x.id}` === acc);
    if (p2) p2.paid = r(p2.paid + d);
    return;
  }
  const p = findPerson(w, acc);
  if (p) p.money = r(p.money + d);
}
function lawOn(w, id) {
  return w.laws.some((l) => l.id === id && l.active);
}
function lawParam(w, id, def) {
  return w.laws.find((l) => l.id === id)?.param ?? def;
}
function marketPrice(w, g) {
  if (g === "su" && lawOn(w, "devletsuyu")) return lawParam(w, "devletsuyu", 2);
  return w.prices[g];
}
function addListing(w, seller, good, qty, price, market) {
  const ex = w.listings.find((l) => l.sellerId === seller.id && l.good === good && Math.abs(l.price - price) < 0.01);
  if (ex) {
    ex.qty += qty;
    return;
  }
  w.listings.push({ id: nextId(w, "L"), sellerId: seller.id, good, qty, price: Math.round(price * 100) / 100, market });
}
function buy(w, buyerAcc, good, qty, maxPrice = Infinity) {
  let got = 0;
  const offers = w.listings.filter((l) => l.good === good && l.qty > 0 && l.sellerId !== buyerAcc).sort((a, b2) => a.price - b2.price);
  const fixedWater = good === "su" && lawOn(w, "devletsuyu");
  for (const l of offers) {
    while (got < qty && l.qty > 0) {
      const pay = fixedWater ? Math.min(l.price, lawParam(w, "devletsuyu", 2)) : l.price;
      if (pay > maxPrice || balance(w, buyerAcc) < pay) return finishPoor();
      transfer(w, buyerAcc, l.sellerId, pay, `${good} al\u0131m\u0131`);
      if (fixedWater && l.price > pay) transfer(w, "saray", l.sellerId, l.price - pay, "su s\xFCbvansiyonu");
      const tax = pay * w.taxRate / 100;
      transfer(w, l.sellerId, "saray", tax, "sat\u0131\u015F vergisi");
      const s = findPerson(w, l.sellerId);
      if (s) s.incomeToday += pay - tax;
      l.qty -= 1;
      got += 1;
      w.market.sold[good] += 1;
    }
    if (got >= qty) break;
  }
  return finish();
  function finishPoor() {
    const b2 = findPerson(w, buyerAcc);
    if (b2) b2.inv[good] += got;
    return got;
  }
  function finish() {
    if (got < qty) w.market.unmet[good] += qty - got;
    const b2 = findPerson(w, buyerAcc);
    if (b2) b2.inv[good] += got;
    return got;
  }
}
function resetMarketDay(w) {
  for (const g of GOODS) {
    w.market.sold[g] = 0;
    w.market.unmet[g] = 0;
  }
}
function produce(w, p) {
  const spec = PRODUCES[p.prof];
  if (!spec || p.jailedDays > 0) return;
  const tools = p.inv.alet > 0 ? 1.15 : 1;
  const qty = Math.max(1, Math.round(spec.qty * tools * (p.health / 100)));
  addListing(w, p, spec.good, qty, w.prices[spec.good], spec.market);
  p.lastAction = `${spec.qty} ${spec.good} \xFCretti`;
}
function settleMarket(w) {
  for (const g of GOODS) {
    const left = w.listings.filter((l) => l.good === g).reduce((s, l) => s + l.qty, 0);
    const sold = w.market.sold[g];
    const miss = w.market.unmet[g];
    let p = w.prices[g];
    if (miss > 0) p *= 1 + Math.min(0.12, 0.02 + miss / Math.max(20, sold + miss) * 0.2);
    else if (left > sold * 0.25 + 2) p *= 0.95;
    w.prices[g] = Math.round(Math.max(BASE_PRICE[g] * 0.4, Math.min(BASE_PRICE[g] * 4, p)) * 100) / 100;
  }
  for (const l of w.listings) l.qty = Math.floor(l.qty * (1 - DECAY[l.good]));
  w.listings = w.listings.filter((l) => l.qty > 0);
  for (const p of w.people) for (const g of GOODS) {
    const d = p.inv[g] * DECAY[g];
    p.inv[g] = Math.max(0, Math.floor(p.inv[g] - d));
  }
  for (const l of w.listings) {
    const s = findPerson(w, l.sellerId);
    if (s && s.npc) l.price = w.prices[l.good];
  }
}

// src/sim/state.ts
function answerPetition(w, pet, accept, by, now) {
  const p = findPerson(w, pet.fromId);
  if (!p || pet.status !== "bekliyor") return false;
  if (by === "naip" && accept && (pet.kind === "vergi" || pet.kind === "kanun" || pet.kind === "gorev")) return false;
  if (accept) {
    switch (pet.kind) {
      case "yardim": {
        const amt = Math.min(pet.amount || 15, by === "naip" ? 20 : 500);
        if (amt > 25 && !spend(w, amt)) return false;
        if (!transfer(w, "saray", p.id, amt, "saray yard\u0131m\u0131")) return false;
        break;
      }
      case "is":
        giveJob(w, p);
        break;
      case "vergi":
        w.taxRate = Math.max(0, w.taxRate - 2);
        log(w, `Ferman: vergi %${w.taxRate}'e indirildi.`);
        break;
      case "sikayet":
        w.prices.ekmek = Math.round(w.prices.ekmek * 0.9 * 100) / 100;
        break;
      case "kanun": {
        const law = w.laws.find((l) => l.id === pet.payload);
        if (law) {
          law.active = !law.active;
          log(w, `Ferman: ${law.name} ${law.active ? "y\xFCr\xFCrl\xFC\u011Fe girdi" : "kald\u0131r\u0131ld\u0131"}.`);
        }
        break;
      }
      case "gorev": {
        const prof = pet.payload;
        if (prof && PROF_LABEL[prof]) {
          p.prof = prof;
          p.work = WORKPLACE[prof];
          log(w, `${p.name} ${PROF_LABEL[prof]} olarak atand\u0131.`, p.id);
        }
        break;
      }
    }
    p.loyalty = clamp(p.loyalty + 8);
    p.mood = clamp(p.mood + 6);
    p.republic = clamp(p.republic - 3);
  } else {
    p.loyalty = clamp(p.loyalty - 6);
    p.mood = clamp(p.mood - 4);
    p.republic = clamp(p.republic + 1);
  }
  pet.status = accept ? "kabul" : "ret";
  pet.answeredBy = by;
  const who = by === "naip" ? "Naip Maecenas" : headTitle(w);
  if (p.playerId) personal(w, p.playerId, `${who} dilek\xE7enizi ${accept ? "kabul" : "ret"} etti: \u201C${pet.text}\u201D`, now);
  return true;
}
function giveJob(w, p) {
  const proj = w.projects.find((x) => !x.done && x.paid > 20);
  p.prof = proj ? "insaatci" : "hamal";
  p.work = proj ? "santiye" : "pazar";
  p.unemployedDays = 0;
  log(w, `${p.name} ${proj ? "\u015Fantiyede" : "pazarda hamal olarak"} i\u015Fe ba\u015Flad\u0131.`, p.id);
}
function naipPetitions(w, now) {
  const done = [];
  for (const pet of w.petitions.filter((x) => x.status === "bekliyor")) {
    const p = findPerson(w, pet.fromId);
    if (!p) continue;
    let accept = null;
    if (pet.kind === "yardim") accept = w.treasury > 300 && (p.money < 15 || p.hunger > 50) && (pet.amount || 15) <= 20;
    else if (pet.kind === "is") accept = true;
    else if (pet.kind === "sikayet") accept = w.prices.ekmek > 4;
    else continue;
    if (answerPetition(w, pet, accept, "naip", now)) done.push(`${p.name}: ${pet.kind} \u2192 ${accept ? "kabul" : "ret"}`);
  }
  return done;
}
function expirePetitions(w, now) {
  for (const pet of w.petitions) {
    if (pet.status === "bekliyor" && w.day > pet.expires) {
      pet.status = "zamanasimi";
      const p = findPerson(w, pet.fromId);
      if (p) {
        p.loyalty = clamp(p.loyalty - 8);
        p.republic = clamp(p.republic + 2);
        if (p.playerId) personal(w, p.playerId, `Dilek\xE7eniz cevaps\u0131z kald\u0131: \u201C${pet.text}\u201D`, now);
      }
    }
  }
  w.petitions = w.petitions.filter((x) => x.status === "bekliyor" || w.day - x.day < 4);
}
function saraykorBonus(w) {
  return lawOn(w, "saraykor") ? 1.2 : 1;
}

// src/sim/family.ts
var ADULT_AGE = 60;
var CHILD_UPKEEP = 3;
var SCHOOL_FEE = 1;
var CURE_FEE = 8;
var PREGNANCY_DAYS = 5;
var WEDDING_COST = 20;
var PROSPERITY_MONEY = 300;
var MAX_CHILDREN = 4;
function age(w, x) {
  return w.day - x.born;
}
function stage(w, x) {
  const a = age(w, x);
  return a < 10 ? "bebek" : a < 35 ? "cocuk" : a < ADULT_AGE ? "genc" : "yetiskin";
}
var findChild = (w, id) => id ? w.children.find((c) => c.id === id) : void 0;
var nameOf = (w, id) => findPerson(w, id)?.name ?? findChild(w, id)?.name ?? "?";
function childrenOf(w, id) {
  return [
    ...w.people.filter((p) => p.parents.includes(id)).map((p) => ({ id: p.id, born: p.born, adult: true })),
    ...w.children.filter((c) => c.parents.includes(id)).map((c) => ({ id: c.id, born: c.born, adult: false }))
  ].sort((a, b2) => a.born - b2.born);
}
function ancestorsOf(w, id, depth = 6) {
  const out = [];
  let frontier = [id];
  for (let d = 0; d < depth && frontier.length; d += 1) {
    const next = [];
    for (const f of frontier) {
      const par = findPerson(w, f)?.parents ?? findChild(w, f)?.parents ?? [];
      for (const p of par) if (!out.includes(p)) {
        out.push(p);
        next.push(p);
      }
    }
    frontier = next;
  }
  return out;
}
function isHanedan(w, id) {
  const roots = [w.founderPersonId, w.hanedanId].filter(Boolean);
  return roots.includes(id) || ancestorsOf(w, id).some((a) => roots.includes(a));
}
var adultFree = (w, p) => !!p && !p.spouse && p.prof !== "naip" && stage(w, p) === "yetiskin";
function proposeMarriage(w, from, to, playerDecides) {
  if (from.id === to.id) return "Kendinizle evlenemezsiniz.";
  if (!adultFree(w, from)) return "Zaten evlisiniz.";
  if (!adultFree(w, to)) return `${to.name} evli ya da evlenemez.`;
  if (from.parents.some((x) => to.parents.includes(x)) || from.parents.includes(to.id) || to.parents.includes(from.id)) return "Akrabalar evlenemez.";
  if (w.proposals.some((x) => x.kind === "evlilik" && x.from === from.id)) return "Bekleyen bir teklifiniz var.";
  if (playerDecides(to)) {
    w.proposals.push({ id: nextId(w, "E"), kind: "evlilik", from: from.id, to: to.id, day: w.day });
    log(w, `${from.name}, ${to.name}'a evlenme teklif etti.`, to.id);
    return `Teklif ${to.name}'a iletildi; cevab\u0131n\u0131 bekleyin.`;
  }
  const s = (to.relations[from.id] ?? 0) + to.mood / 2 + (from.money > 150 ? 10 : 0) + (from.soylu || from.id === w.kayzerId ? 25 : 0) + rand(w) * 30;
  if (s < 45) {
    to.relations[from.id] = clamp((to.relations[from.id] ?? 0) - 3, -100, 100);
    return `${to.name} teklifi nazik\xE7e reddetti.`;
  }
  wed(w, from, to);
  return `${to.name} \u201Cevet\u201D dedi! D\xFC\u011F\xFCn yap\u0131ld\u0131.`;
}
function answerProposal(w, me, id, accept) {
  const pr = w.proposals.find((x) => x.id === id && x.to === me.id);
  if (!pr) return "Teklif yok.";
  w.proposals = w.proposals.filter((x) => x !== pr);
  const from = findPerson(w, pr.from);
  if (pr.kind === "evlilik") {
    if (!accept || !from) {
      if (from) log(w, `${me.name}, ${from.name}'\u0131n evlenme teklifini reddetti.`, from.id);
      return "Teklif reddedildi.";
    }
    if (!adultFree(w, from) || !adultFree(w, me)) return "Art\u0131k evlenemezsiniz.";
    wed(w, from, me);
    return "Evlendiniz! Mutluluklar.";
  }
  if (!accept || !from || from.spouse !== me.id) return "\xC7ocuk teklifi reddedildi.";
  return conceive(w, from, me);
}
function wed(w, a, b2) {
  a.spouse = b2.id;
  b2.spouse = a.id;
  const imam = w.people.find((p) => p.prof === "imam" && p.jailedDays === 0);
  for (const x of [a, b2]) {
    const c = Math.min(WEDDING_COST / 2, x.money);
    if (c > 0) transfer(w, x.id, imam?.id ?? "saray", c, "d\xFC\u011F\xFCn");
    x.mood = clamp(x.mood + 15);
  }
  a.relations[b2.id] = 80;
  b2.relations[a.id] = 80;
  const royal = [a, b2].find((x) => x.id === w.kayzerId && w.regime === "imparatorluk");
  if (royal) {
    const sp = royal === a ? b2 : a;
    sp.soylu = true;
    sp.home = "saray";
    royal.home = "saray";
  } else {
    const host = a.home.startsWith("ev") || b2.home === "kisla" ? a : b2;
    const other = host === a ? b2 : a;
    if (other.home !== "saray") other.home = host.home;
  }
  log(w, `${a.name} ile ${b2.name} evlendi! ${royal ? "Saray d\xFC\u011F\xFCn\xFC: yeni e\u015F art\u0131k soylu ve sarayda ya\u015F\u0131yor." : "B\xFCt\xFCn mahalle d\xFC\u011F\xFCne geldi."}`, a.id);
  for (const x of w.people) if (x.home === a.home && x !== a && x !== b2) x.mood = clamp(x.mood + 1);
}
function divorce(w, me) {
  const sp = findPerson(w, me.spouse);
  if (!sp) return "Evli de\u011Filsiniz.";
  me.spouse = null;
  sp.spouse = null;
  const total = me.money + sp.money;
  const half = total / 2;
  if (me.money > half) transfer(w, me.id, sp.id, me.money - half, "bo\u015Fanma pay\u0131");
  else if (sp.money > half) transfer(w, sp.id, me.id, sp.money - half, "bo\u015Fanma pay\u0131");
  for (const g of Object.keys(me.inv)) {
    const t = me.inv[g] + sp.inv[g];
    me.inv[g] = Math.ceil(t / 2);
    sp.inv[g] = Math.floor(t / 2);
  }
  me.relations[sp.id] = -30;
  sp.relations[me.id] = -30;
  me.mood = clamp(me.mood - 10);
  sp.mood = clamp(sp.mood - 15);
  const leaver = sp.id === w.kayzerId ? me : sp;
  if (leaver.soylu && leaver.home === "saray") {
    leaver.soylu = false;
  }
  if (leaver.home === "saray" || leaver.home === (leaver === me ? sp.home : me.home)) leaver.home = emptiestHouse(w);
  if (w.regentId === leaver.id) {
    w.regentId = null;
    w.regentFor = null;
  }
  log(w, `${me.name} ile ${sp.name} bo\u015Fand\u0131; mallar payla\u015F\u0131ld\u0131.`, me.id);
  return "Bo\u015Fand\u0131n\u0131z; mallar ikiye b\xF6l\xFCnd\xFC.";
}
function emptiestHouse(w) {
  const houses = w.buildings.filter((b2) => b2.kind === "ev");
  const counts = /* @__PURE__ */ new Map();
  for (const x of w.people) counts.set(x.home, (counts.get(x.home) ?? 0) + 1);
  return [...houses].sort((a, b2) => (counts.get(a.id) ?? 0) - (counts.get(b2.id) ?? 0))[0]?.id ?? "ev1";
}
function canHaveChild(w, a, b2) {
  const kids = childrenOf(w, a.id).filter((k) => !k.adult).length;
  if (kids >= MAX_CHILDREN) return "Bu evde yeterince \xE7ocuk var.";
  if (a.money + b2.money < PROSPERITY_MONEY + kids * 100) return `\xC7ocuk i\xE7in hanede en az ${PROSPERITY_MONEY + kids * 100} Dinar birikim gerekir.`;
  if (a.hunger > 45 || b2.hunger > 45) return "Hane tok de\u011Fil; \xF6nce karn\u0131n\u0131z\u0131 doyurun.";
  if (a.jailedDays > 0 || b2.jailedDays > 0) return "Zindandayken olmaz.";
  if (!foodSecure(w)) return "\u015Eehirde ekmek k\u0131tl\u0131\u011F\u0131 var; \u015Fimdi \xE7ocuk zor beslenir.";
  if (w.pregnancies.some((p) => p.parents.includes(a.id))) return "Zaten bir bebek yolda.";
  return null;
}
function foodSecure(w) {
  const pop = w.people.length + w.children.length;
  return w.market.unmet.ekmek <= 2 && pop < 140 && w.prices.ekmek < 2.5;
}
function requestChild(w, me, playerDecides) {
  const sp = findPerson(w, me.spouse);
  if (!sp) return "\xD6nce evlenmelisiniz.";
  const err = canHaveChild(w, me, sp);
  if (err) return err;
  if (playerDecides(sp)) {
    if (w.proposals.some((x) => x.kind === "cocuk" && x.from === me.id)) return "E\u015Finizin cevab\u0131n\u0131 bekleyin.";
    w.proposals.push({ id: nextId(w, "E"), kind: "cocuk", from: me.id, to: sp.id, day: w.day });
    return "E\u015Finize soruldu.";
  }
  if (sp.mood < 35) return `${sp.name} \u015Fimdi haz\u0131r de\u011Fil.`;
  return conceive(w, me, sp);
}
function conceive(w, a, b2) {
  const err = canHaveChild(w, a, b2);
  if (err) return err;
  w.pregnancies.push({ parents: [a.id, b2.id], due: w.day + PREGNANCY_DAYS });
  log(w, `${a.name} ile ${b2.name} bir bebek bekliyor!`, a.id);
  return `M\xFCjde! ${PREGNANCY_DAYS} g\xFCn sonra bebe\u011Finiz do\u011Facak.`;
}
var ERKEK2 = ["Kerem", "Emir", "Yi\u011Fit", "Alp", "Aras", "Batu", "Deniz", "Efe", "Mert", "Kaan", "Tuna", "O\u011Fuz"];
var KIZ = ["Defne", "Elif", "Ece", "Asya", "Nehir", "Zeynep", "Lale", "Su", "Ada", "Selin", "Duru", "\u0130pek"];
function birth(w, parents) {
  const [a, b2] = parents.map((id) => findPerson(w, id));
  if (!a) return null;
  const female = rand(w) < 0.5;
  const mix = (x, y) => Math.round(clamp((x + y) / 2 + (rand(w) - 0.5) * 30));
  const royal = parents.includes(w.kayzerId ?? "-") || !!a.soylu || !!b2?.soylu || parents.some((x) => isHanedan(w, x));
  const last = a.name.replace(/\(.*?\)/g, "").trim().split(" ").filter((x) => !["Kayzer", "Usta", "Efendi", "Han\u0131m", "A\u011Fa", "Kalfa", "Asker", "Bek\xE7i", "Hekim", "T\xFCccar", "Hamal", "F\u0131r\u0131nc\u0131", "Kalem\u015F\xF6r", "\xD6\u011Fretmen", "Savc\u0131", "H\xE2kim"].includes(x)).pop() ?? "Ana";
  const c = {
    id: nextId(w, "c"),
    name: `${pick(w, female ? KIZ : ERKEK2)}${royal ? " \u015Eehzade".replace("\u015Eehzade", female ? "Sultan" : "\u015Eehzade") : ""} ${royal ? "" : `(${last})`}`.replace(/\s+/g, " ").trim(),
    female,
    born: w.day,
    parents,
    honesty: mix(a.honesty, b2?.honesty ?? a.honesty),
    ambition: mix(a.ambition, b2?.ambition ?? a.ambition),
    hairColor: rand(w) < 0.5 ? a.hairColor : b2?.hairColor ?? a.hairColor,
    skin: rand(w) < 0.5 ? a.skin : b2?.skin ?? a.skin,
    shirt: randInt(w, 0, 7),
    school: 0,
    inSchool: false,
    sick: 0,
    hunger: 0,
    orphan: false,
    soylu: royal
  };
  w.children.push(c);
  for (const p of [a, b2]) if (p) p.mood = clamp(p.mood + 12);
  log(w, `${a.name}${b2 ? ` ile ${b2.name}` : ""} ailesine bir ${female ? "k\u0131z" : "erkek"} bebek do\u011Fdu: ${c.name}.`, a.id);
  return c;
}
function familyDay(w, npcDecides, now) {
  for (const pg of w.pregnancies.filter((x) => x.due <= w.day)) birth(w, pg.parents);
  w.pregnancies = w.pregnancies.filter((x) => x.due > w.day);
  w.proposals = w.proposals.filter((x) => w.day - x.day <= 3);
  const singles = w.people.filter((p) => npcDecides(p) && adultFree(w, p) && p.jailedDays === 0 && p.home !== "kisla" && p.id !== w.kayzerId);
  for (const p of singles) if (!p.spouse && chance(w, 0.012)) {
    const o = singles.find((x) => x !== p && !x.spouse && x.female !== p.female && (x.relations[p.id] ?? 0) > -10);
    if (o) wed(w, p, o);
  }
  for (const p of w.people) {
    const sp = findPerson(w, p.spouse);
    if (!sp || p.id > sp.id || !npcDecides(p) || !npcDecides(sp)) continue;
    if (!canHaveChild(w, p, sp) && chance(w, 0.015)) conceive(w, p, sp);
  }
  for (const c of [...w.children]) {
    const parents = c.parents.map((id) => findPerson(w, id)).filter((x) => !!x);
    c.orphan = parents.length === 0;
    const payer = [...parents].sort((a, b2) => b2.money - a.money)[0];
    const fee = CHILD_UPKEEP + (c.inSchool ? SCHOOL_FEE : 0);
    let fed = false;
    if (payer && payer.money >= fee) {
      fed = buyFood(w, payer, c, fee);
    } else if (c.orphan) {
      const baker = w.people.find((p) => p.prof === "firinci" && p.jailedDays === 0);
      fed = !!baker && transfer(w, "saray", baker.id, fee, "yetim bak\u0131m\u0131 (devlet)");
    }
    c.hunger = fed ? 0 : clamp(c.hunger + 30);
    if (!fed && payer) payer.mood = clamp(payer.mood - 4);
    const st = stage(w, c);
    if (c.inSchool && (st === "cocuk" || st === "genc") && fed) c.school += 1;
    if (st !== "cocuk" && st !== "genc") c.inSchool = false;
    if (!c.inSchool && (st === "cocuk" || st === "genc") && (c.orphan || payer && npcDecides(payer) && payer.money > 120)) c.inSchool = true;
    if (c.sick > 0) {
      c.sick += 1;
      const healer = w.people.find((p) => p.prof === "hekim" && p.jailedDays === 0);
      const auto = payer && npcDecides(payer) && payer.money > CURE_FEE + 10;
      if (healer && (auto || c.orphan && w.treasury > CURE_FEE)) {
        cureChild(w, c, auto ? payer : null);
      } else if (c.sick > 6) {
        removeChild(w, c, `${c.name} hastal\u0131ktan kurtulamad\u0131. \u015Eehir yasta.`);
        continue;
      }
    } else if (chance(w, c.hunger > 40 ? 0.15 : 0.02)) {
      c.sick = 1;
      for (const p of parents) if (p.playerId) log(w, `${c.name} hastaland\u0131! Hekime g\xF6t\xFCr\xFCn.`, p.id);
    }
    if (st === "yetiskin") growUp(w, c);
  }
  for (const p of [...w.people]) if (!p.playerId && p.prof !== "naip" && p.id !== w.kayzerId && age(w, p) > 540 && chance(w, 0.01)) die(w, p, `${p.name} ihtiyarl\u0131ktan hayata g\xF6zlerini yumdu.`);
  if (w.regentFor && !findChild(w, w.regentFor) && findPerson(w, w.regentFor)) {
    const heir = findPerson(w, w.regentFor);
    const reg = findPerson(w, w.regentId);
    w.kayzerId = heir.id;
    heir.prof = "kayzer";
    heir.work = "saray";
    heir.home = "saray";
    heir.soylu = true;
    if (reg && reg.prof === "kayzer") {
      reg.prof = "memur";
      reg.work = "saray";
    }
    log(w, `${heir.name} re\u015Fit oldu ve tahta \xE7\u0131kt\u0131! ${reg?.name ?? ""} naipli\u011Fi sona erdi.`, heir.id);
    w.regentId = null;
    w.regentFor = null;
  }
  void now;
  void isOnline;
}
function buyFood(w, payer, c, fee) {
  const baker = w.people.find((p) => p.prof === "firinci" && p.jailedDays === 0);
  const ok2 = transfer(w, payer.id, baker?.id ?? "saray", CHILD_UPKEEP, "\xE7ocuk bak\u0131m\u0131");
  if (ok2 && c.inSchool) {
    const hoca = w.people.find((p) => p.prof === "hoca" && p.jailedDays === 0);
    transfer(w, payer.id, hoca?.id ?? "saray", fee - CHILD_UPKEEP, "okul \xFCcreti");
  }
  return ok2;
}
function cureChild(w, c, payer) {
  if (c.sick <= 0) return "\xC7ocuk hasta de\u011Fil.";
  const healer = w.people.find((p) => p.prof === "hekim" && p.jailedDays === 0);
  if (!healer) return "\u015Eehirde hekim yok!";
  if (!transfer(w, payer?.id ?? "saray", healer.id, CURE_FEE, "\xE7ocuk tedavisi")) return "Hekim paras\u0131 yetmiyor.";
  c.sick = 0;
  healer.incomeToday += CURE_FEE;
  log(w, `${healer.name}, ${c.name}'\u0131 iyile\u015Ftirdi.`, payer?.id);
  return `${c.name} iyile\u015Fti.`;
}
function removeChild(w, c, text) {
  w.children = w.children.filter((x) => x !== c);
  if (w.veliaht === c.id) w.veliaht = null;
  for (const id of c.parents) {
    const p = findPerson(w, id);
    if (p) p.mood = clamp(p.mood - 30);
  }
  log(w, text, c.parents[0]);
}
function growUp(w, c) {
  const par = c.parents.map((id) => findPerson(w, id)).filter((x) => !!x);
  const good = ["memur", "hoca", "hekim", "kalemsor", "tuccar"];
  const prof = c.school >= 25 && chance(w, 0.5) ? pick(w, good) : c.school >= 25 ? pick(w, ["terzi", "demirci", "marangoz", "firinci", "balikci"]) : c.school >= 10 ? pick(w, ["terzi", "demirci", "marangoz", "firinci"]) : par[0] && par[0].prof !== "kayzer" && par[0].prof !== "naip" && par[0].prof !== "asker" ? par[0].prof : "hamal";
  const home = c.soylu && c.parents.includes(w.kayzerId ?? "-") ? "saray" : par[0]?.home && par[0].home !== "saray" && par[0].home !== "kisla" ? par[0].home : emptiestHouse(w);
  const p = makePerson(w, { name: c.name, prof, female: c.female, honesty: c.honesty, ambition: c.ambition, money: 0, loyalty: Math.round(par.reduce((s, x) => s + x.loyalty, 60) / (par.length + 1)) }, home);
  w.idSeq -= 1;
  p.id = c.id;
  p.born = c.born;
  p.parents = c.parents;
  p.school = c.school;
  p.soylu = c.soylu;
  p.hairColor = c.hairColor;
  p.skin = c.skin;
  p.shirt = c.shirt;
  p.republic = Math.round(par.reduce((s, x) => s + x.republic, 0) / Math.max(1, par.length) * 0.7);
  p.work = WORKPLACE[prof];
  w.children = w.children.filter((x) => x !== c);
  w.people.push(p);
  for (const x of par) {
    const gift = Math.min(40, x.money * 0.1);
    if (gift > 1) transfer(w, x.id, p.id, gift, "har\xE7l\u0131k");
    p.relations[x.id] = 60;
    x.relations[p.id] = 60;
  }
  log(w, `${p.name} b\xFCy\xFCd\xFC, art\u0131k yeti\u015Fkin: ${PROF_LABEL[prof]}${c.school >= 25 ? " (okul sayesinde)" : ""}.`, p.id);
  return p;
}
function die(w, p, text) {
  const heirs = childrenOf(w, p.id);
  const sp = findPerson(w, p.spouse);
  const adults = heirs.filter((h) => h.adult).map((h) => findPerson(w, h.id)).filter(Boolean);
  const money = Math.max(0, p.money);
  if (money > 0) {
    const toSp = sp ? adults.length ? money / 2 : money : 0;
    if (sp && toSp > 0) transfer(w, p.id, sp.id, toSp, "miras");
    const rest = Math.max(0, p.money);
    if (adults.length && rest > 0) for (const a of adults) transfer(w, p.id, a.id, rest / adults.length, "miras");
    else if (rest > 0) transfer(w, p.id, "saray", rest, "mirass\u0131z mal hazineye");
  }
  if (p.money > 0) transfer(w, p.id, "saray", p.money, "kalan mal hazineye");
  const invHeir = sp ?? adults[0];
  if (invHeir) for (const g of Object.keys(p.inv)) {
    invHeir.inv[g] += p.inv[g];
    p.inv[g] = 0;
  }
  for (const l of w.listings) if (l.sellerId === p.id) l.sellerId = invHeir?.id ?? "saray";
  if (sp) {
    sp.spouse = null;
    sp.mood = clamp(sp.mood - 25);
  }
  w.people = w.people.filter((x) => x !== p);
  for (const s of w.meclis.seats) if (s.holder === p.id) s.holder = null;
  if (w.isyan) w.isyan.rebels = w.isyan.rebels.filter((id) => id !== p.id);
  log(w, text, sp?.id ?? adults[0]?.id);
}
function heirOf(w, k) {
  const kids = childrenOf(w, k.id);
  const v = kids.find((x) => x.id === w.veliaht);
  if (v) return v;
  return kids.find((x) => x.adult) ?? kids[0] ?? null;
}
function succeed(w, k) {
  const heir = heirOf(w, k);
  const sp = findPerson(w, k.spouse);
  const step = () => {
    k.prof = "memur";
    k.work = "saray";
  };
  if (heir?.adult) {
    const h = findPerson(w, heir.id);
    step();
    w.kayzerId = h.id;
    h.prof = "kayzer";
    h.work = "saray";
    h.home = "saray";
    h.soylu = true;
    w.veliaht = null;
    return `${k.name} tahttan feragat etti. Yeni Kayzer: ${h.name}!`;
  }
  if (heir && sp) {
    step();
    w.kayzerId = sp.id;
    sp.prof = "kayzer";
    sp.work = "saray";
    w.regentId = sp.id;
    w.regentFor = heir.id;
    return `${k.name} tahttan feragat etti. Veliaht ${nameOf(w, heir.id)} re\u015Fit olana dek ${sp.name} naip olarak tahtta.`;
  }
  if (sp) {
    step();
    w.kayzerId = sp.id;
    sp.prof = "kayzer";
    sp.work = "saray";
    return `${k.name} tahttan feragat etti. Tahta e\u015Fi ${sp.name} \xE7\u0131kt\u0131.`;
  }
  return null;
}
function actingHead(w, now, windowMs) {
  const k = findPerson(w, w.kayzerId);
  if (!k) return void 0;
  const present = k.playerId && !k.npc && isOnline(w, k.playerId, now, windowMs);
  if (present || w.regime !== "imparatorluk") return k;
  const sp = findPerson(w, k.spouse);
  return sp && sp.jailedDays === 0 ? sp : k;
}
function canRule(w, p, now, windowMs) {
  if (p.id === w.kayzerId) return true;
  return w.regime === "imparatorluk" && actingHead(w, now, windowMs)?.id === p.id;
}

// src/sim/isyan.ts
var TARGETS = ["pazar", "kahve", "meclis", "mahkeme", "kisla", "saray"];
var FATE_LABEL = { surgun: "S\xFCrg\xFCn", zindan: "Zindan", af: "Af (s\u0131radan vatanda\u015Fl\u0131k)" };
var ilog = (w, text, pid) => {
  if (w.isyan) {
    w.isyan.log.push(`G\xFCn ${w.day} ${String(w.hour).padStart(2, "0")}:00 \u2013 ${text}`);
    if (w.isyan.log.length > 40) w.isyan.log.shift();
  }
  log(w, `\u0130SYAN: ${text}`, pid);
};
var discontent = (w, p) => p.prof !== "naip" && p.id !== w.kayzerId && p.jailedDays === 0 && p.exiledDays === 0 && !p.soylu && (p.republic > 50 || p.plotting === "revolution" || p.mood < 25 && p.loyalty < 40);
var loyalSoldiers = (w) => w.people.filter((p) => p.prof === "asker" && p.jailedDays === 0 && !w.isyan?.rebels.includes(p.id));
function strength(w) {
  const i = w.isyan;
  if (!i) return { rebels: 0, loyal: 0 };
  const reb = i.rebels.map((id) => findPerson(w, id)).filter((p) => !!p && p.jailedDays === 0);
  const rebels = reb.reduce((s, p) => s + (p.prof === "asker" ? 3 : 1), 0) + i.occupied.length * 2;
  const loyal = loyalSoldiers(w).reduce((s, p) => s + 2 + p.loyalty / 50, 0) + w.people.filter((p) => p.prof === "bekci" && p.jailedDays === 0 && p.loyalty > 40).length;
  return { rebels: Math.round(rebels), loyal: Math.round(loyal) };
}
function startIsyan(w) {
  if (w.isyan || w.regime !== "imparatorluk" || !w.kayzerId) return;
  const rebels = w.people.filter((p) => discontent(w, p) || p.prof === "asker" && p.loyalty < 30);
  const leader = rebels.find((p) => p.plotting === "revolution") ?? [...rebels].sort((a, b2) => b2.republic + b2.ambition - a.republic - a.ambition)[0];
  w.isyan = { day: w.day, hour: w.hour, leaderId: leader?.id ?? null, rebels: rebels.map((p) => p.id), occupied: [], killed: 0, soldiersLost: 0, lastCmd: "", lastCmdHour: -99, log: [], hours: 0, concessions: 0 };
  ilog(w, `${leader?.name ?? "Halk"} \xF6nderli\u011Finde ${rebels.length} ki\u015Fi ayakland\u0131! Asiler Pazar'da toplan\u0131yor.`, leader?.id);
}
function isyanHour(w, aiCommand) {
  const i = w.isyan;
  if (!i) return;
  i.hours += 1;
  for (const p of w.people) if (!i.rebels.includes(p.id) && discontent(w, p) && chance(w, 0.08)) i.rebels.push(p.id);
  for (const p of loyalSoldiers(w)) if (p.loyalty < 30 && chance(w, 0.12)) {
    i.rebels.push(p.id);
    ilog(w, `${p.name} silah\u0131yla asilere kat\u0131ld\u0131!`, p.id);
  }
  if (aiCommand && i.hours - i.lastCmdHour >= 4) {
    const c = aiCommand();
    if (c) command(w, c, "Naip");
  }
  const s = strength(w);
  if (i.hours % 3 === 0 && s.rebels > s.loyal * 0.8) {
    const next = TARGETS.find((t) => !i.occupied.includes(t));
    if (next) {
      i.occupied.push(next);
      ilog(w, `Asiler ${w.buildings.find((b2) => b2.id === next)?.name ?? next} binas\u0131n\u0131 i\u015Fgal etti!`);
    }
  }
  if (i.occupied.includes("saray") || loyalSoldiers(w).length === 0) {
    rebelVictory(w);
    return;
  }
  if (s.rebels <= 2 || i.hours > 72) endIsyan(w, i.hours > 72 ? "\u0130syan kendili\u011Finden s\xF6nd\xFC; asiler evlerine d\xF6nd\xFC." : "\u0130syan bast\u0131r\u0131ld\u0131.");
}
function command(w, cmd, by) {
  const i = w.isyan;
  if (!i) return "Ortada isyan yok.";
  i.lastCmd = cmd;
  i.lastCmdHour = i.hours;
  const s = strength(w);
  const rebels = i.rebels.map((id) => findPerson(w, id)).filter((p) => !!p);
  if (cmd === "dagit") {
    const cost = Math.min(w.treasury, 150 + rebels.length * 5);
    if (cost > 0) transfer(w, "saray", rebels[0]?.id ?? "saray", cost, "isyan tavizi");
    w.taxRate = Math.max(0, w.taxRate - 2);
    i.concessions += 1;
    let left = 0;
    for (const p of rebels) if (p.plotting !== "revolution" && p.republic < 75 && chance(w, 0.55)) {
      i.rebels = i.rebels.filter((x) => x !== p.id);
      p.mood = clamp(p.mood + 10);
      p.republic = clamp(p.republic - 15);
      left += 1;
    }
    if (left >= 2) i.occupied.pop();
    ilog(w, `${by} asilerle pazarl\u0131k etti: vergi %${w.taxRate}, ${Math.round(cost)} Dinar taviz. ${left} ki\u015Fi evine d\xF6nd\xFC.`);
    return `${left} asi da\u011F\u0131ld\u0131.`;
  }
  if (cmd === "tutukla") {
    if (s.loyal < s.rebels * 0.5) {
      for (const p of loyalSoldiers(w)) p.loyalty = clamp(p.loyalty - 5);
      ilog(w, `${by} tutuklama emri verdi ama askerler kalabal\u0131\u011Fa yakla\u015Famad\u0131.`);
      return "Asker say\u0131s\u0131 yetmedi; moral d\xFC\u015Ft\xFC.";
    }
    const taken = [...rebels].sort((a, b2) => (b2.id === i.leaderId ? 100 : 0) + b2.republic - (a.id === i.leaderId ? 100 : 0) - a.republic).slice(0, 5);
    for (const p of taken) {
      openCase(w, p.id, "isyan", null, 0, 80);
      p.jailedDays = Math.max(p.jailedDays, 5);
      i.rebels = i.rebels.filter((x) => x !== p.id);
    }
    for (const p of w.people) if (p.republic > 30) p.loyalty = clamp(p.loyalty - 1);
    ilog(w, `${by} emriyle ${taken.length} eleba\u015F\u0131 tutukland\u0131: ${taken.map((p) => p.name).join(", ")}.`);
    return `${taken.length} ki\u015Fi tutukland\u0131.`;
  }
  const ratio = s.loyal / Math.max(1, s.rebels);
  const rebelLoss = Math.min(rebels.length, Math.max(1, Math.round(rebels.length * Math.min(0.5, 0.15 * ratio))));
  const soldierLoss = Math.min(loyalSoldiers(w).length, Math.round(rebelLoss / Math.max(0.6, ratio)));
  const victims = [...rebels].filter((p) => !p.playerId).sort((a, b2) => a.health - b2.health).slice(0, rebelLoss);
  for (const p of victims) die(w, p, `${p.name} \xE7at\u0131\u015Fmada hayat\u0131n\u0131 kaybetti.`);
  for (const p of rebels.filter((x) => x.playerId).slice(0, Math.max(0, rebelLoss - victims.length))) {
    p.health = 10;
    p.jailedDays = 7;
    i.rebels = i.rebels.filter((x) => x !== p.id);
  }
  const sl = loyalSoldiers(w).filter((p) => !p.playerId).slice(0, soldierLoss);
  for (const p of sl) die(w, p, `Asker ${p.name} \xE7at\u0131\u015Fmada \u015Fehit d\xFC\u015Ft\xFC.`);
  i.killed += victims.length;
  i.soldiersLost += sl.length;
  for (const p of w.people) {
    p.mood = clamp(p.mood - 6);
    p.loyalty = clamp(p.loyalty - 3);
    if (p.prof === "asker") p.loyalty = clamp(p.loyalty - 4);
  }
  if (ratio > 1.5) i.occupied = i.occupied.slice(0, -1);
  ilog(w, `${by} sald\u0131r\u0131 emri verdi! ${victims.length} asi ve ${sl.length} asker \xF6ld\xFC.`);
  return `\xC7at\u0131\u015Fma: ${victims.length} asi, ${sl.length} asker \xF6ld\xFC.`;
}
function endIsyan(w, text) {
  ilog(w, text);
  for (const p of w.people) p.republic = clamp(p.republic - 20);
  w.isyan = null;
  w.cumhuriyetDays = 0;
}
function rebelVictory(w) {
  const i = w.isyan;
  const old = findPerson(w, w.kayzerId);
  const voters = i.rebels.filter((id) => findPerson(w, id)?.playerId);
  ilog(w, `Asiler Saray'\u0131 ald\u0131! ${old?.name ?? "Kayzer"} tahttan indirildi. CUMHUR\u0130YET \u0130LAN ED\u0130LD\u0130!`);
  w.isyan = null;
  w.regime = "cumhuriyet";
  w.kayzerId = null;
  w.taxRate = Math.min(w.taxRate, 12);
  w.coup = null;
  w.regentId = null;
  w.regentFor = null;
  w.election.baskanNextDay = w.day + 1;
  w.election.baskanCandidates = [];
  w.election.baskanVotes = {};
  for (const p of w.people) {
    p.republic = clamp(p.republic - 40);
    p.mood = clamp(p.mood + 10);
    if (p.prof === "asker") p.loyalty = 60;
  }
  for (const p of w.people) if (p.soylu && p.home === "saray") {
    p.soylu = false;
    p.home = emptiestHouse(w);
  }
  if (old) {
    old.prof = "memur";
    old.work = "saray";
    old.home = emptiestHouse(w);
    w.deposed = { personId: old.id, until: w.day + 1, killed: i.killed, votes: {}, voters };
  }
  w.cumhuriyetDays = 0;
  w.cumhuriyet = Math.round(w.people.reduce((s, p) => s + p.republic, 0) / w.people.length);
}
function ruleFate(w, killed) {
  if (killed >= 3) return "zindan";
  if (w.taxRate >= 20 || w.treasury < 500) return "surgun";
  return "af";
}
function voteFate(w, p, fate) {
  const d = w.deposed;
  if (!d) return "Karar verilecek bir devrik h\xFCk\xFCmdar yok.";
  if (!d.voters.includes(p.id)) return "Sadece isyana kat\u0131lan oyuncular oy verir.";
  d.votes[p.id] = fate;
  return `Oyunuz: ${FATE_LABEL[fate]}.`;
}
function settleFate(w) {
  const d = w.deposed;
  if (!d || w.day < d.until) return;
  const killed = d.killed;
  const t = { surgun: 0, zindan: 0, af: 0 };
  for (const f of Object.values(d.votes)) t[f] += 1;
  const voted = Object.values(t).some((x) => x > 0);
  const fate = voted ? Object.entries(t).sort((a, b2) => b2[1] - a[1])[0][0] : ruleFate(w, killed);
  const p = findPerson(w, d.personId);
  w.deposed = null;
  if (!p) return;
  if (fate === "surgun") {
    p.exiledDays = 20;
    p.home = "liman";
  } else if (fate === "zindan") {
    p.jailedDays = 15;
  } else {
    p.prof = "hamal";
    p.work = "pazar";
  }
  log(w, `Asilerin karar\u0131 (${voted ? "oylama" : "\xF6nderlerin karar\u0131"}): devrik ${p.name} i\xE7in ${FATE_LABEL[fate]}. Hanedan hakk\u0131 yine de s\xFCr\xFCyor.`, p.id);
}

// src/sim/tick.ts
var isyanPolicy = {
  fn: (w) => {
    const s = strength(w);
    return s.loyal > s.rebels * 1.5 ? "tutukla" : "dagit";
  }
};
function onlineCount(w, now) {
  return Object.values(w.players).filter((p) => !p.banned && now - p.lastSeen < ONLINE_WINDOW_MS).length;
}
function kayzerOnline(w, now) {
  return isOnline(w, kayzerPlayerId(w), now, ONLINE_WINDOW_MS);
}
function advanceWorld(w, now) {
  if (onlineCount(w, now) === 0) {
    w.frozen = true;
    return 0;
  }
  if (w.frozen) {
    w.frozen = false;
    w.lastTickAt = now;
    return 0;
  }
  let hours = Math.floor((now - w.lastTickAt) / HOUR_MS);
  if (hours <= 0) return 0;
  if (hours > MAX_CATCHUP_HOURS) {
    w.lastTickAt = now - MAX_CATCHUP_HOURS * HOUR_MS;
    hours = MAX_CATCHUP_HOURS;
  }
  for (let i = 0; i < hours; i += 1) stepHour(w, now);
  w.lastTickAt += hours * HOUR_MS;
  w.version += 1;
  return hours;
}
function stepHour(w, now) {
  w.hour = (w.hour + 1) % 24;
  if (w.hour === 0) endOfDay(w, now);
  const kOnline = kayzerOnline(w, now);
  if (w.isyan) {
    const ruler = actingHead(w, now, ONLINE_WINDOW_MS);
    const playerCommands = !!ruler?.playerId && !ruler.npc && isOnline(w, ruler.playerId, now, ONLINE_WINDOW_MS);
    isyanHour(w, playerCommands ? null : () => isyanPolicy.fn(w));
  }
  switch (w.hour) {
    case 2:
      for (const p of w.people) decide(w, p);
      break;
    case 7:
      sellGazette(w);
      break;
    case 8:
      resetMarketDay(w);
      for (const p of w.people) {
        p.incomeToday = 0;
        produce(w, p);
      }
      traderRelist(w);
      break;
    case 10:
      court(w, now);
      break;
    case 11:
      meclisDay(w, (p) => !fullAI(p) && isOnline(w, p.playerId, now), kOnline);
      break;
    case 12:
      salaries(w);
      projects(w, kOnline);
      hamaliye(w);
      break;
    case 14:
      doctors(w);
      break;
    case 16:
      if (!kOnline) {
        const d = naipPetitions(w, now);
        if (d.length) naipNote(w, `Naip olarak ${d.length} dilek\xE7eyi karara ba\u011Flad\u0131m.`, now);
      }
      break;
    case 17:
      stateBread(w);
      break;
    case 19:
      for (const p of shuffled(w)) consume(w, p);
      break;
    case 20:
      for (const p of w.people) spendSurplus(w, p);
      break;
    case 21:
      traders(w);
      break;
    default:
      break;
  }
}
function shuffled(w) {
  const a = [...w.people];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand(w) * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
function naipNote(w, text, now) {
  const pid = kayzerPlayerId(w);
  const sp = findPerson(w, findPerson(w, w.kayzerId)?.spouse);
  if (pid) personal(w, pid, `${sp && w.regime === "imparatorluk" ? `${sp.name} (e\u015Finiz, Maecenas'\u0131n yard\u0131m\u0131yla)` : "Maecenas"}: ${text}`, now);
}
function sellGazette(w) {
  const ks = w.people.filter((p) => p.prof === "kalemsor" && p.jailedDays === 0);
  if (!ks.length) return;
  for (const p of w.people) if (p.money > 20 && chance(w, 0.25)) transfer(w, p.id, pick(w, ks).id, 1, "gazete");
}
function salaries(w) {
  let unpaid = 0;
  for (const p of w.people) {
    if (!isState(p) || p.jailedDays > 0) continue;
    const s = (w.salaries[p.prof] ?? 0) * (p.prof === "asker" ? saraykorBonus(w) : 1);
    if (s <= 0) continue;
    if (transfer(w, "saray", p.id, s, "maa\u015F")) {
      p.incomeToday += s;
      p.loyalty = clamp(p.loyalty + 0.3);
    } else {
      unpaid += 1;
      p.loyalty = clamp(p.loyalty - 5);
      p.mood = clamp(p.mood - 5);
    }
  }
  if (unpaid) log(w, `Hazine bo\u015F! ${unpaid} devlet g\xF6revlisi maa\u015F\u0131n\u0131 alamad\u0131.`);
  for (const t of w.people.filter((x) => x.prof === "tahsildar" && x.honesty < 40 && x.jailedDays === 0)) {
    if (chance(w, 0.3) && w.treasury > 100) {
      const amt = Math.round(Math.min(25, w.dailyIncome * 0.05));
      if (amt > 0 && transfer(w, "saray", t.id, amt, "zimmet")) {
        if (lawOn(w, "zimmet") && chance(w, bekciPower(w) * 0.5)) {
          log(w, `${t.name} hazineden ${amt} Dinar zimmete ge\xE7irirken yakaland\u0131!`, t.id);
          openCase(w, t.id, "zimmet", null, amt, 60);
        }
      }
    }
  }
}
function projects(w, kOnline) {
  for (const pr of w.projects.filter((x) => !x.done)) {
    if (!kOnline && pr.paid < 40 && w.treasury > 900) transfer(w, "saray", `proje:${pr.id}`, 40, "naip proje \xF6dene\u011Fi");
    const workers = w.people.filter((p) => (p.prof === "insaatci" || p.prof === "hamal" && p.work === "santiye") && p.jailedDays === 0);
    for (const p of workers) {
      if (!transfer(w, `proje:${pr.id}`, p.id, 6, `${pr.name} yevmiyesi`)) break;
      p.incomeToday += 6;
      pr.progress += 1;
      p.lastAction = "\u015Fantiyede \xE7al\u0131\u015Ft\u0131";
    }
    if (pr.progress >= pr.needed) {
      pr.done = true;
      log(w, `${pr.name} tamamland\u0131! \u015Eehirde bayram havas\u0131.`);
      for (const p of w.people) {
        p.mood = clamp(p.mood + 6);
        p.loyalty = clamp(p.loyalty + 3);
      }
      const rest = pr.paid;
      if (rest > 0) transfer(w, `proje:${pr.id}`, "saray", rest, "proje artan\u0131");
    }
    break;
  }
}
function hamaliye(w) {
  const busy = w.projects.some((x) => !x.done && x.paid >= 6);
  const hamals = w.people.filter((p) => (p.prof === "hamal" && p.work !== "santiye" || p.prof === "insaatci" && !busy) && p.jailedDays === 0);
  if (!hamals.length) return;
  for (const p of w.people) {
    if (PRODUCES[p.prof] && p.money > 10) {
      const h = pick(w, hamals);
      if (transfer(w, p.id, h.id, 1.5, "hamaliye")) h.incomeToday += 1.5;
    }
  }
  for (const t of w.people.filter((p) => p.prof === "tuccar" && p.money > 50)) {
    const h = pick(w, hamals);
    transfer(w, t.id, h.id, 4, "hamaliye");
    h.incomeToday += 4;
  }
}
function doctors(w) {
  const hs = w.people.filter((p) => p.prof === "hekim" && p.jailedDays === 0);
  if (!hs.length) return;
  for (const p of w.people) if (p.health < 70 && p.prof !== "hekim") {
    const h = pick(w, hs);
    if (transfer(w, p.id, h.id, 4, "hekim \xFCcreti")) {
      h.incomeToday += 4;
      p.health = clamp(p.health + 25);
    } else if (w.treasury > 400 && transfer(w, "saray", h.id, 3, "dar\xFClaceze")) p.health = clamp(p.health + 15);
  }
}
function stateBread(w) {
  if (!lawOn(w, "devletekmegi")) return;
  let n = lawParam(w, "devletekmegi", 12);
  const needy = [...w.people].filter((p) => p.prof !== "naip" && p.prof !== "kayzer").sort((a, b2) => a.money - a.hunger - (b2.money - b2.hunger));
  for (const p of needy) {
    if (n <= 0 || p.money > 30) break;
    const before = w.treasury;
    const got = buy(w, "saray", "ekmek", 1, 6);
    if (!got) break;
    p.inv.ekmek += 1;
    n -= 1;
    void before;
  }
}
function traders(w) {
  for (const t of w.people.filter((p) => p.prof === "tuccar" && p.jailedDays === 0 && (fullAI(p) || true))) {
    for (const g of ["kumas", "alet", "odun"]) {
      const cheap = w.listings.filter((l) => l.good === g && l.sellerId !== t.id && l.price <= w.prices[g] * 0.9);
      for (const l of cheap) {
        const q = Math.min(l.qty, 3);
        for (let i = 0; i < q && t.money > l.price + 20; i += 1) buy(w, t.id, g, 1, l.price);
      }
    }
  }
}
function traderRelist(w) {
  for (const t of w.people.filter((p) => p.prof === "tuccar")) for (const g of ["kumas", "alet", "odun"]) {
    if (t.inv[g] > 0) {
      addListing(w, t, g, t.inv[g], Math.round(w.prices[g] * 1.05 * 100) / 100, "pazar");
      t.inv[g] = 0;
    }
  }
}
function court(w, now) {
  const savci = w.people.find((p) => p.prof === "savci" && p.jailedDays === 0);
  const hakim = w.people.find((p) => p.prof === "hakim" && p.jailedDays === 0);
  for (const c of w.cases.filter((x) => x.stage !== "kapandi")) {
    const a = findPerson(w, c.accusedId);
    if (!a) {
      c.stage = "kapandi";
      continue;
    }
    const official = c.stage === "savci" ? savci : hakim;
    if (official?.playerId && !official.npc && w.day <= c.deadline) continue;
    if (c.stage === "savci") {
      if (fullAI(a) && a.honesty < 45 && a.money > 40 && savci && savci.honesty < 50 && chance(w, 0.6)) {
        transfer(w, a.id, savci.id, 30, "r\xFC\u015Fvet");
        c.bribed = true;
        c.verdict = "dusuruldu";
        c.stage = "kapandi";
        a.jailedDays = 0;
        log(w, `${CRIME_LABEL[c.crime]} davas\u0131 d\xFC\u015Ft\xFC. Savc\u0131n\u0131n cebi kabar\u0131k g\xF6r\xFCn\xFCyor\u2026`, a.id);
        continue;
      }
      if (c.evidence >= 35) {
        c.stage = "hakim";
        c.deadline = w.day + 1;
        log(w, `${savci?.name ?? "Savc\u0131"}, ${a.name} hakk\u0131nda ${CRIME_LABEL[c.crime].toLowerCase()} davas\u0131 a\xE7t\u0131.`, a.id);
      } else {
        c.stage = "kapandi";
        c.verdict = "dusuruldu";
        a.jailedDays = 0;
      }
    } else if (c.stage === "hakim") {
      const guilty = rand(w) * 100 < c.evidence * ((hakim?.honesty ?? 70) / 80);
      verdict(w, c.id, guilty, now);
    }
  }
  w.cases = w.cases.filter((c) => c.stage !== "kapandi" || w.day - c.day < 6);
}
function verdict(w, caseId, guilty, now) {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return;
  const a = findPerson(w, c.accusedId);
  if (!a) return;
  c.stage = "kapandi";
  c.verdict = guilty ? "suclu" : "beraat";
  if (guilty) {
    if (c.victimId) transfer(w, a.id, c.victimId, Math.min(a.money, c.amount), "tazminat");
    const fine = Math.min(a.money, c.crime === "isyan" ? a.money : 10 + c.amount * 0.5);
    transfer(w, a.id, "saray", fine, "para cezas\u0131");
    a.jailedDays = c.crime === "isyan" ? 7 : 3;
    a.honesty = clamp(a.honesty + 5);
    a.mood = clamp(a.mood - 15);
    c.sentence = `${a.jailedDays} g\xFCn zindan, ${Math.round(fine)} Dinar ceza`;
    log(w, `H\xE2kim karar\u0131: ${a.name} su\xE7lu bulundu (${c.sentence}).`, a.id);
  } else {
    a.jailedDays = 0;
    c.sentence = "serbest";
    log(w, `H\xE2kim karar\u0131: ${a.name} beraat etti.`, a.id);
  }
  if (a.playerId) personal(w, a.playerId, `Davan\u0131z sonu\xE7land\u0131: ${c.verdict}`, now);
}
function endOfDay(w, now) {
  for (const p of w.people) if (!isState(p) && p.prof !== "kayzer" && p.prof !== "naip" && p.jailedDays === 0 && p.money >= w.headTax) transfer(w, p.id, "saray", w.headTax, "ba\u015F vergisi");
  settleMarket(w);
  expirePetitions(w, now);
  w.headAwayDays = kayzerOnline(w, now) ? 0 : w.headAwayDays + 1;
  for (const p of w.people) {
    feel(w, p);
    if (p.incomeToday <= 0 && !isState(p) && p.prof !== "kayzer" && p.prof !== "naip") p.unemployedDays += 1;
    else p.unemployedDays = 0;
    const inCase = w.cases.some((c) => c.accusedId === p.id && c.stage !== "kapandi");
    if (p.jailedDays > 0 && !inCase) p.jailedDays -= 1;
    if (p.inv.alet > 0 && chance(w, 0.1)) p.inv.alet -= 1;
  }
  const citizens = w.people.filter((p) => p.prof !== "naip" && p.prof !== "kayzer");
  const avg = (f) => citizens.reduce((s, p) => s + f(p), 0) / Math.max(1, citizens.length);
  w.cumhuriyet = Math.round(clamp(avg((p) => p.republic)) * 10) / 10;
  revolution(w, avg((p) => p.prof === "asker" ? p.loyalty : 0) * citizens.length / Math.max(1, citizens.filter((p) => p.prof === "asker").length));
  familyDay(w, fullAI, now);
  settleFate(w);
  for (const p of w.people) if (p.exiledDays > 0) {
    p.exiledDays -= 1;
    if (p.exiledDays === 0) {
      p.home = "ev1";
      log(w, `${p.name} s\xFCrg\xFCnden d\xF6nd\xFC.`, p.id);
    }
  }
  election(w);
  inactivePlayers(w, now);
  gazette(w, avg((p) => p.mood));
  w.stats.push({ day: w.day, treasury: Math.round(w.treasury), mood: Math.round(avg((p) => p.mood)), cumhuriyet: w.cumhuriyet, money: Math.round(citizens.reduce((s, p) => s + p.money, 0)), prices: { ...w.prices } });
  if (w.stats.length > 400) w.stats.shift();
  w.dailyIncome = 0;
  w.dailyExpense = 0;
  w.todayEvents = [];
  w.day += 1;
  for (const g of GOODS) void g;
}
function revolution(w, armyLoyalty) {
  const hot = w.cumhuriyet >= 80 || w.cumhuriyet >= 50 && armyLoyalty < 25;
  if (hot) w.cumhuriyetDays += 1;
  else w.cumhuriyetDays = Math.max(0, w.cumhuriyetDays - 1);
  if (w.cumhuriyetDays >= 5 && w.kayzerId && w.regime === "imparatorluk" && !w.isyan) {
    w.cumhuriyetDays = 0;
    startIsyan(w);
  }
  void armyLoyalty;
}
function election(w) {
  baskanElection(w);
  const e = w.election;
  if (w.day < e.nextDay) return;
  meclisElection(w, e.candidates, e.votes, fullAI);
  w.election = { ...e, nextDay: w.day + 20, candidates: [], votes: {} };
}
function baskanElection(w) {
  const e = w.election;
  if (w.regime !== "cumhuriyet" || w.day < e.baskanNextDay) return;
  const npc = w.people.filter((p2) => fullAI(p2) && p2.jailedDays === 0 && p2.prof !== "naip" && p2.prof !== "asker" && (p2.meclis || p2.ambition > 65)).sort((a, b2) => b2.ambition + b2.republic + b2.money / 30 - (a.ambition + a.republic + a.money / 30)).slice(0, 4).map((p2) => p2.id);
  const cands = [.../* @__PURE__ */ new Set([...e.baskanCandidates, ...npc])].filter((id) => findPerson(w, id));
  if (!cands.length) {
    e.baskanNextDay = w.day + 1;
    return;
  }
  const tally2 = {};
  for (const c of cands) tally2[c] = 0;
  for (const v of w.people) {
    if (v.prof === "naip") continue;
    const pv = e.baskanVotes[v.id];
    if (pv && tally2[pv] !== void 0) {
      tally2[pv] += 1;
      continue;
    }
    let best = "";
    let bs = -Infinity;
    for (const c of cands) {
      const cp = findPerson(w, c);
      const s = (v.relations[c] ?? 0) + cp.republic * 0.3 - Math.abs(v.republic - cp.republic) * 0.5 + rand(w) * 30 + (c === v.id ? 50 : 0);
      if (s > bs) {
        bs = s;
        best = c;
      }
    }
    if (best) tally2[best] = (tally2[best] ?? 0) + 1;
  }
  const [winner, votes] = Object.entries(tally2).sort((a, b2) => b2[1] - a[1])[0];
  w.kayzerId = winner;
  const p = findPerson(w, winner);
  log(w, `Ba\u015Fkanl\u0131k se\xE7imi: ${p?.name ?? "?"} ${votes} oyla Cumhurba\u015Fkan\u0131 se\xE7ildi (g\xF6rev s\xFCresi 20 g\xFCn).`, winner);
  e.baskanNextDay = w.day + 20;
  e.baskanCandidates = [];
  e.baskanVotes = {};
}
function inactivePlayers(w, now) {
  for (const pl of Object.values(w.players)) {
    const p = findPerson(w, pl.personId);
    if (p && !p.npc && now - pl.lastSeen > INACTIVE_TO_NPC_MS) {
      p.npc = true;
      log(w, `${p.name} uzun s\xFCredir g\xF6r\xFCnm\xFCyor; art\u0131k kendi ba\u015F\u0131na ya\u015F\u0131yor.`, p.id);
      const sp = findPerson(w, p.spouse);
      if (p.id === w.kayzerId && sp && w.regime === "imparatorluk") log(w, `Kayzer pasif; devleti e\u015Fi ${sp.name} y\xF6netiyor.`, sp.id);
    }
  }
}
function gazette(w, mood) {
  const ev = w.todayEvents;
  const prio = ["DEVR\u0130M", "Ba\u015Fkanl\u0131k se\xE7imi", "Hanedan geri", "darbe", "Darbe", "tamamland\u0131", "Meclis se\xE7imi", "Hazine bo\u015F", "zimmet", "su\xE7lu", "evlendi", "protesto", "soyuldu"];
  let headline = ev.find((e) => prio.slice(0, 5).some((k) => e.includes(k))) ?? ev.find((e) => prio.some((k) => e.includes(k))) ?? "\u015Eehirde sakin bir g\xFCn";
  if (headline.length > 90) headline = headline.slice(0, 87) + "\u2026";
  const prev = w.stats[w.stats.length - 1];
  const delta = prev ? Math.round(w.treasury - prev.treasury) : 0;
  const lines = [
    `Hazine ${Math.round(w.treasury)} Dinar (${delta >= 0 ? "+" : ""}${delta}). Gelir ${Math.round(w.dailyIncome)}, gider ${Math.round(w.dailyExpense)}.`,
    `Ekmek ${w.prices.ekmek.toFixed(2)}, su ${(lawOn(w, "devletsuyu") ? lawParam(w, "devletsuyu", 2) : w.prices.su).toFixed(2)}, et ${w.prices.et.toFixed(2)} Dinar.`,
    w.regime === "cumhuriyet" ? `Cumhuriyet y\xF6netimi. Ba\u015Fkan: ${findPerson(w, w.kayzerId)?.name ?? "se\xE7im bekleniyor"}; sonraki se\xE7im ${w.election.baskanNextDay}. g\xFCn. Memnuniyet ${Math.round(mood)}.` : `Halk\u0131n memnuniyeti ${Math.round(mood)}, cumhuriyet iste\u011Fi ${w.cumhuriyet}.`,
    `${ev.filter((e) => e.includes("dilek\xE7e")).length} dilek\xE7e, ${ev.filter((e) => e.includes("soyuldu")).length} h\u0131rs\u0131zl\u0131k, ${ev.filter((e) => e.includes("H\xE2kim karar\u0131")).length} mahkeme karar\u0131.`
  ];
  const gossip = ev.filter((e) => e.includes("f\u0131s\u0131ldan\u0131yor") || e.includes("evlendi") || e.includes("cumhuriyet\xE7i"));
  if (gossip[0]) lines.push(`Kahvehane dedikodusu: ${gossip[0]}`);
  const ml = w.meclis.log.filter((x) => x.day === w.day).map((x) => x.text).slice(-6);
  w.gazette.push({ day: w.day, headline, lines, meclis: ml });
  if (w.gazette.length > 30) w.gazette.shift();
}

// src/sim/actions.ts
var ok = (msg) => ({ ok: true, msg });
var no = (msg) => ({ ok: false, msg });
function personOf(w, playerId) {
  const pl = w.players[playerId];
  return pl ? findPerson(w, pl.personId) : void 0;
}
function takeoverCandidates(w) {
  const taken = new Set(Object.values(w.players).map((p) => p.personId));
  return w.people.filter((p) => p.playerId === null && !taken.has(p.id) && p.prof !== "naip" && p.prof !== "kayzer" && p.id !== w.kayzerId && p.id !== w.hanedanId && p.jailedDays === 0 && (w.allowStateTakeover || !STATE_PROFS.includes(p.prof) && !p.meclis));
}
function joinWorld(w, playerId, name, prof, founder, now, takeOverId) {
  const existing = personOf(w, playerId);
  if (existing) return existing;
  let p;
  const target = !founder && takeOverId ? takeoverCandidates(w).find((x) => x.id === takeOverId) : void 0;
  if (!founder && takeOverId && !target) throw new Error("Bu vatanda\u015F se\xE7ilemez.");
  if (target) {
    p = target;
  } else if (founder) {
    p = findPerson(w, w.hanedanId) ?? makePerson(w, { name, prof: "kayzer" }, "saray");
    p.name = `Kayzer ${clean(name)}`;
    w.founderPersonId = p.id;
  } else {
    const safeProf = PLAYER_PROFS.includes(prof) ? prof : "hamal";
    const houses = w.buildings.filter((b2) => b2.kind === "ev");
    const counts = /* @__PURE__ */ new Map();
    for (const x of w.people) counts.set(x.home, (counts.get(x.home) ?? 0) + 1);
    const home = [...houses].sort((a, b2) => (counts.get(a.id) ?? 0) - (counts.get(b2.id) ?? 0))[0]?.id ?? "ev1";
    p = makePerson(w, { name: clean(name), prof: safeProf, money: 80, honesty: 60, ambition: 50, loyalty: 60 }, home);
    w.people.push(p);
  }
  p.playerId = playerId;
  p.npc = false;
  w.players[playerId] = { playerId, personId: p.id, name: p.name, founder, banned: false, lastSeen: now, lastSeenDay: w.day, awayLog: [], awayMoney: p.money };
  log(w, `${p.name} \u015Fehre geldi.`, p.id);
  return p;
}
function clean(s) {
  return s.replace(/[<>]/g, "").trim().slice(0, 24) || "Yolcu";
}
function touchPlayer(w, playerId, now) {
  const pl = w.players[playerId];
  if (!pl || pl.banned) return null;
  const p = findPerson(w, pl.personId);
  const wasAway = now - pl.lastSeen > ONLINE_WINDOW_MS;
  let summary = null;
  if (wasAway && p) {
    const days = w.day - pl.lastSeenDay;
    const dm = Math.round(p.money - pl.awayMoney);
    const lines = [`Ho\u015F geldiniz${pl.founder ? " efendim" : ""}. Siz yokken ${days} g\xFCn ge\xE7ti. Keseniz ${dm >= 0 ? "+" : ""}${dm} Dinar de\u011Fi\u015Fti (${Math.round(p.money)}).`];
    if (p.id === w.kayzerId) lines.push(`Hazine ${Math.round(w.treasury)} Dinar, cumhuriyet iste\u011Fi ${w.cumhuriyet}. Bekleyen dilek\xE7e: ${w.petitions.filter((x) => x.status === "bekliyor").length}.`);
    if (pl.founder && p.id !== w.kayzerId) lines.push(w.regime === "cumhuriyet" ? `Efendim, cumhuriyet ilan edildi; devleti Ba\u015Fkan ${findPerson(w, w.kayzerId)?.name ?? "(se\xE7im bekleniyor)"} y\xF6netiyor. Hanedan hakk\u0131yla \u201CTaht\u0131 geri al\u201D diyebilirsiniz.` : "Taht elinizden gitmi\u015F efendim. Hanedan hakk\u0131yla \u201CTaht\u0131 geri al\u201D diyebilirsiniz.");
    summary = [...lines, ...pl.awayLog.slice(-15)].join("\n");
    pl.awayLog = [];
    if (p.npc) {
      p.npc = false;
    }
  }
  pl.lastSeen = now;
  if (p) {
    pl.lastSeenDay = w.day;
    pl.awayMoney = p.money;
  }
  return summary;
}
function applyAction(w, playerId, a, now) {
  const pl = w.players[playerId];
  if (!pl || pl.banned) return no("Hesap bulunamad\u0131.");
  const me = findPerson(w, pl.personId);
  if (!me) return no("Karakter bulunamad\u0131.");
  const isKayzer = (ww, p) => canRule(ww, p, now, ONLINE_WINDOW_MS);
  const jailedOk = ["petition", "eat", "divorce", "answerProposal"];
  if (me.jailedDays > 0 && !jailedOk.includes(a.t)) return no("Zindandas\u0131n\u0131z; \u015Fimdilik sadece dilek\xE7e yazabilirsiniz.");
  const exileOk = [...jailedOk, "restore", "buy", "sell", "marry", "haveChild", "school", "cure"];
  if (me.exiledDays > 0 && !exileOk.includes(a.t)) return no(`S\xFCrg\xFCndesiniz (${me.exiledDays} g\xFCn kald\u0131).`);
  const decides = (p) => !fullAI(p);
  const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
  switch (a.t) {
    case "buy": {
      const q = num(a.qty, 1, 20);
      if (q === null || !GOODS.includes(a.good)) return no("Ge\xE7ersiz miktar.");
      const got = buy(w, me.id, a.good, Math.floor(q));
      return got ? ok(`${got} ${GOOD_LABEL[a.good]} ald\u0131n\u0131z.`) : no("Pazarda yok ya da paran\u0131z yetmiyor.");
    }
    case "sell": {
      const q = num(a.qty, 1, 500);
      const pr = num(a.price, 0.1, 1e3);
      if (q === null || pr === null || !GOODS.includes(a.good) || me.inv[a.good] < q) return no("Elinizde o kadar mal yok.");
      me.inv[a.good] -= Math.floor(q);
      addListing(w, me, a.good, Math.floor(q), pr, "pazar");
      return ok("Tezg\xE2ha koydunuz.");
    }
    case "eat": {
      if (me.inv.ekmek > 0) {
        me.inv.ekmek -= 1;
        me.hunger = clamp(me.hunger - 35);
        return ok("Ekmek yediniz.");
      }
      return no("Ekme\u011Finiz yok.");
    }
    case "askida": {
      const q = num(a.qty, 1, 20);
      if (q === null) return no("Ge\xE7ersiz.");
      const got = buy(w, me.id, "ekmek", Math.floor(q));
      me.inv.ekmek -= got;
      const poor = [...w.people].sort((x, y) => x.money - y.money).slice(0, got);
      for (const p of poor) {
        p.inv.ekmek += 1;
        p.relations[me.id] = clamp((p.relations[me.id] ?? 0) + 15, -100, 100);
      }
      me.mood = clamp(me.mood + 3);
      log(w, `${me.name} f\u0131r\u0131na ${got} ask\u0131da ekmek b\u0131rakt\u0131.`, me.id);
      return ok(`${got} ekmek ask\u0131ya kondu.`);
    }
    case "petition": {
      const text = filterProfanity(String(a.text ?? "")).slice(0, 200);
      if (text.length < 4) return no("Dilek\xE7e \xE7ok k\u0131sa.");
      const pet = openPetition(w, me, a.kind, text, Math.min(num(a.amount, 0, 500) ?? 0, 500), a.payload);
      return pet ? ok("Dilek\xE7eniz saraya ula\u015Ft\u0131.") : no("Zaten bekleyen bir dilek\xE7eniz var.");
    }
    case "answer": {
      if (!isKayzer(w, me)) return no(`Sadece ${headTitle(w)} cevaplayabilir.`);
      const pet = w.petitions.find((x) => x.id === a.petitionId);
      if (!pet) return no("Dilek\xE7e yok.");
      return answerPetition(w, pet, a.accept, "kayzer", now) ? ok("Ferman yaz\u0131ld\u0131.") : no("Bu dilek\xE7e uygulanamad\u0131 (hazine yetmiyor olabilir).");
    }
    case "setTax": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const r = num(a.rate, 0, 40);
      if (r === null) return no("0\u201340 aras\u0131.");
      w.taxRate = Math.round(r);
      log(w, `Ferman: sat\u0131\u015F vergisi %${w.taxRate}.`);
      return ok("Vergi de\u011Fi\u015Fti.");
    }
    case "setHeadTax": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const r = num(a.amount, 0, 10);
      if (r === null) return no("0\u201310 aras\u0131.");
      w.headTax = r;
      log(w, `Ferman: ba\u015F vergisi ${r} Dinar.`);
      return ok("Ba\u015F vergisi de\u011Fi\u015Fti.");
    }
    case "setSalary": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const r = num(a.amount, 0, 60);
      if (r === null || !STATE_PROFS.includes(a.prof)) return no("Ge\xE7ersiz.");
      w.salaries[a.prof] = r;
      log(w, `Ferman: ${PROF_LABEL[a.prof]} maa\u015F\u0131 ${r} Dinar.`);
      return ok("Maa\u015F de\u011Fi\u015Fti.");
    }
    case "toggleLaw": {
      if (!isKayzer(w, me)) return no(`Kanunlar\u0131 sadece ${headTitle(w)} de\u011Fi\u015Ftirir.`);
      const law = w.laws.find((l) => l.id === a.lawId);
      if (!law) return no("Kanun yok.");
      if (w.regime === "cumhuriyet" && a.active !== law.active) {
        const m = meclisVote(w);
        if (!m.pass) {
          log(w, `Meclis, ${law.name} teklifini reddetti (${m.yes}/${m.total}).`);
          return no(`Meclis reddetti (${m.yes}/${m.total} evet).`);
        }
        log(w, `Meclis, ${law.name} teklifini kabul etti (${m.yes}/${m.total}).`);
      }
      law.active = a.active;
      if (a.param !== void 0 && law.param !== void 0) {
        const v = num(a.param, 0, 100);
        if (v !== null) law.param = v;
      }
      log(w, `Ferman: ${law.name} ${law.active ? "y\xFCr\xFCrl\xFCkte" : "kald\u0131r\u0131ld\u0131"}.`);
      return ok("Kanun g\xFCncellendi.");
    }
    case "startProject": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const c = num(a.cost, 100, 2e4);
      if (c === null) return no("Maliyet 100\u201320000.");
      if (w.projects.some((p) => !p.done)) return no("\xD6nce s\xFCren in\u015Faat bitmeli.");
      w.projects.push({ id: `pr${++w.idSeq}`, name: a.name.slice(0, 40) || "Yeni in\u015Faat", site: "santiye", cost: c, paid: 0, progress: 0, needed: Math.round(c / 10), done: false });
      log(w, `Ferman: ${a.name} in\u015Faat\u0131 ba\u015Fl\u0131yor.`);
      return ok("\u0130n\u015Faat ba\u015Flad\u0131; \xF6denek ay\u0131r\u0131n.");
    }
    case "fundProject": {
      const pr = w.projects.find((p) => p.id === a.projectId && !p.done);
      const amt = num(a.amount, 1, 5e4);
      if (!pr || amt === null) return no("Ge\xE7ersiz.");
      const from = isKayzer(w, me) ? "saray" : me.id;
      if (from === "saray" && !spend(w, amt)) return no(`Meclis b\xFCt\xE7esi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      return transfer(w, from, `proje:${pr.id}`, amt, "proje \xF6dene\u011Fi") ? ok(`${amt} Dinar \xF6denek ayr\u0131ld\u0131.`) : no("Para yetmiyor.");
    }
    case "appoint": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const t = findPerson(w, a.personId);
      if (!t || t.prof === "naip" || t.id === me.id || !PROF_LABEL[a.prof] || a.prof === "kayzer" || a.prof === "naip") return no("Ge\xE7ersiz atama.");
      t.prof = a.prof;
      t.work = WORKPLACE[a.prof];
      t.loyalty = clamp(t.loyalty + 10);
      log(w, `Ferman: ${t.name} ${PROF_LABEL[a.prof]} oldu.`, t.id);
      return ok("Atand\u0131.");
    }
    case "pardon": {
      if (!isKayzer(w, me)) return no(`Sadece ${headTitle(w)} affeder.`);
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c) return no("Dava yok.");
      const acc = findPerson(w, c.accusedId);
      c.stage = "kapandi";
      c.verdict = "af";
      if (acc) {
        acc.jailedDays = 0;
        acc.loyalty = clamp(acc.loyalty + 20);
      }
      const v = findPerson(w, c.victimId);
      if (v) v.loyalty = clamp(v.loyalty - 10);
      log(w, `${headTitle(w)} ${acc?.name ?? ""} i\xE7in af \xE7\u0131kard\u0131.`);
      return ok("Affedildi.");
    }
    case "caseDecision": {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== "kapandi");
      if (!c) return no("Dava yok.");
      if (c.stage === "savci") {
        if (me.prof !== "savci") return no("Bu dava savc\u0131da.");
        const acc = findPerson(w, c.accusedId);
        if (a.decision === "kovustur") {
          c.stage = "hakim";
          c.deadline = w.day + 1;
          return ok("Dava h\xE2kime g\xF6nderildi.");
        }
        if (a.decision === "dusur") {
          c.stage = "kapandi";
          c.verdict = "dusuruldu";
          if (acc) acc.jailedDays = 0;
          return ok("Dava d\xFC\u015F\xFCr\xFCld\xFC.");
        }
      } else if (c.stage === "hakim") {
        if (me.prof !== "hakim") return no("Bu dava h\xE2kimde.");
        if (a.decision === "suclu" || a.decision === "beraat") {
          verdict(w, c.id, a.decision === "suclu", now);
          return ok("Karar verildi.");
        }
      }
      return no("Ge\xE7ersiz karar.");
    }
    case "arrest": {
      if (me.prof !== "bekci") return no("Sadece bek\xE7iler tutuklar.");
      const t = findPerson(w, a.personId);
      if (!t || t.id === w.kayzerId || t.prof === "naip") return no("Ge\xE7ersiz.");
      const recent = w.ledger.some((l) => l.from !== t.id && l.to === t.id && (l.reason === "h\u0131rs\u0131zl\u0131k" || l.reason === "r\xFC\u015Fvet" || l.reason === "zimmet") && w.day - l.day <= 3);
      openCase(w, t.id, "hirsizlik", null, 0, recent ? 70 : 15);
      log(w, `${me.name}, ${t.name}'\u0131 tutuklad\u0131.`, t.id);
      return ok(recent ? "Tutukland\u0131, deliller g\xFC\xE7l\xFC." : "Tutukland\u0131 ama delil zay\u0131f.");
    }
    case "steal": {
      const t = findPerson(w, a.personId);
      if (!t || t.id === me.id || t.prof === "naip" || t.id === w.kayzerId) return no("Ge\xE7ersiz.");
      me.honesty = clamp(me.honesty - 10);
      const got = steal(w, me, t);
      return got ? ok(`${got} Dinar \xE7ald\u0131n\u0131z\u2026`) : no("Kesesi bo\u015F \xE7\u0131kt\u0131.");
    }
    case "bribe": {
      const t = findPerson(w, a.personId);
      const amt = num(a.amount, 1, 1e4);
      if (!t || amt === null || t.id === me.id) return no("Ge\xE7ersiz.");
      if (!transfer(w, me.id, t.id, amt, "r\xFC\u015Fvet")) return no("Paran\u0131z yetmiyor.");
      if (t.meclis) w.meclis.bribes.push({ from: me.id, to: t.id, amount: amt, day: w.day, exposed: false });
      t.loyalty = clamp(t.loyalty - amt / 5);
      t.relations[me.id] = clamp((t.relations[me.id] ?? 0) + amt / 2, -100, 100);
      if (t.prof === "asker" && amt >= 40 && chance(w, (100 - t.loyalty) / 100 + 0.1)) t.sidedWith = me.id;
      if (lawOn(w, "rusvet") && chance(w, bekciPower(w) * 0.35)) {
        openCase(w, me.id, "rusvet", null, amt, 60);
        log(w, `${me.name}, ${t.name}'a r\xFC\u015Fvet verirken yakaland\u0131!`, me.id);
        return ok("R\xFC\u015Fveti verdiniz\u2026 ama bek\xE7i g\xF6rd\xFC!");
      }
      return ok(t.sidedWith === me.id ? `${t.name} art\u0131k sizin yan\u0131n\u0131zda.` : "R\xFC\u015Fveti ald\u0131; ne d\xFC\u015F\xFCnd\xFC\u011F\xFC belli de\u011Fil.");
    }
    case "give": {
      const t = findPerson(w, a.personId);
      const amt = num(a.amount, 1, 1e5);
      if (!t || amt === null) return no("Ge\xE7ersiz.");
      const from = isKayzer(w, me) && a.personId !== me.id ? "saray" : me.id;
      if (from === "saray" && !spend(w, amt)) return no(`Meclis b\xFCt\xE7esi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      if (!transfer(w, from, t.id, amt, from === "saray" ? "saray ba\u011F\u0131\u015F\u0131" : "ba\u011F\u0131\u015F")) return no("Para yetmiyor.");
      t.loyalty = clamp(t.loyalty + Math.min(15, amt / 4));
      t.mood = clamp(t.mood + 5);
      t.relations[me.id] = clamp((t.relations[me.id] ?? 0) + 10, -100, 100);
      return ok(`${t.name}'a ${amt} Dinar verildi.`);
    }
    case "propose": {
      const r = propose(w, me, a.kind, num(a.value, 0, 5e4) ?? 0, String(a.target ?? ""), a.title ? filterProfanity(a.title) : void 0);
      return typeof r === "string" ? no(r) : ok("Teklifiniz Meclis g\xFCndeminde. 1 g\xFCn g\xF6r\xFC\u015Fme, 1 g\xFCn oylama.");
    }
    case "castVote": {
      const b2 = w.meclis.bills.find((x) => x.id === a.billId);
      if (!me.meclis) return no("Sadece Meclis \xFCyeleri oy verir.");
      if (!b2 || b2.status !== "oylama" && b2.status !== "tartisma") return no("Bu teklif oylamada de\u011Fil.");
      if (!["evet", "hayir", "cekimser"].includes(a.choice)) return no("Ge\xE7ersiz oy.");
      b2.votes[me.id] = a.choice;
      return ok(`Oyunuz kaydedildi: ${a.choice}.`);
    }
    case "speak": {
      const b2 = w.meclis.bills.find((x) => x.id === a.billId);
      if (!me.meclis || !b2) return no("Sadece Meclis \xFCyeleri konu\u015Fur.");
      const text = filterProfanity(String(a.text ?? "")).slice(0, 200);
      if (text.length < 3) return no("Konu\u015Fma \xE7ok k\u0131sa.");
      if (b2.speeches.filter((s) => s.personId === me.id).length >= 3) return no("Bu teklif i\xE7in s\xF6z hakk\u0131n\u0131z bitti.");
      b2.speeches.push({ personId: me.id, text, day: w.day });
      return ok("K\xFCrs\xFCden konu\u015Ftunuz.");
    }
    case "sanction": {
      if (!isKayzer(w, me) || w.regime !== "imparatorluk") return no("Sadece Kayzer onaylar ya da veto eder.");
      const b2 = w.meclis.bills.find((x) => x.id === a.billId);
      if (!b2) return no("Karar yok.");
      const r = sanction(w, b2, a.approve);
      return { ok: r.startsWith("Onay") || r.startsWith("Veto"), msg: r };
    }
    case "joinFaction": {
      if (!w.meclis.factions.some((f) => f.id === a.factionId)) return no("B\xF6yle bir parti yok.");
      me.faction = a.factionId;
      return ok(`${w.meclis.factions.find((f) => f.id === a.factionId).name} \xFCyesisiniz.`);
    }
    case "runForBaskan": {
      if (w.regime !== "cumhuriyet") return no("Ba\u015Fkanl\u0131k se\xE7imi sadece cumhuriyette yap\u0131l\u0131r.");
      if (!w.election.baskanCandidates.includes(me.id)) w.election.baskanCandidates.push(me.id);
      return ok(`Ba\u015Fkan aday\u0131s\u0131n\u0131z. Se\xE7im ${w.election.baskanNextDay}. g\xFCn.`);
    }
    case "voteBaskan": {
      if (w.regime !== "cumhuriyet" || !findPerson(w, a.candidateId)) return no("Ge\xE7ersiz.");
      w.election.baskanVotes[me.id] = a.candidateId;
      return ok("Oyunuz sand\u0131kta.");
    }
    case "runForMeclis": {
      if (me.id === w.kayzerId && w.regime === "imparatorluk") return no("Kayzer aday olamaz.");
      if (!w.election.candidates.includes(me.id)) w.election.candidates.push(me.id);
      return ok(`Adays\u0131n\u0131z. Se\xE7im ${w.election.nextDay}. g\xFCn.`);
    }
    case "vote": {
      if (!w.election.candidates.includes(a.candidateId) && !findPerson(w, a.candidateId)) return no("Aday yok.");
      w.election.votes[me.id] = a.candidateId;
      return ok("Oyunuz sand\u0131kta.");
    }
    case "plot": {
      if (me.id === w.kayzerId) return no(`Zaten ${headTitle(w)}siniz.`);
      if (a.kind === "none") {
        me.plotting = "none";
        return ok("Komplodan vazge\xE7tiniz.");
      }
      if (w.coup && w.coup.leaderId !== me.id) return no("Ba\u015Fka bir komplo s\xFCr\xFCyor.");
      me.plotting = a.kind;
      w.coup = w.coup ?? { leaderId: me.id, kind: a.kind, day: w.day, fund: 0 };
      w.coup.kind = a.kind;
      return ok(a.kind === "coup" ? "Darbe haz\u0131rl\u0131\u011F\u0131 ba\u015Flad\u0131. Kurallar: en az 6 asker (Saray Korumas\u0131 varsa 8), 1500 Dinar fon, halk deste\u011Fi (memnuniyet < 40 ya da cumhuriyet \u2265 50)." : "Devrim haz\u0131rl\u0131\u011F\u0131 ba\u015Flad\u0131. Kurallar: cumhuriyet \u2265 70, en az 4 asker, 800 Dinar fon.");
    }
    case "fundPlot": {
      if (!w.coup || w.coup.leaderId !== me.id) return no("\xD6nce komplo ba\u015Flat\u0131n.");
      const amt = num(a.amount, 1, 1e5);
      if (amt === null) return no("Ge\xE7ersiz.");
      return transfer(w, me.id, "fon", amt, "komplo fonu") ? ok(`Fon: ${w.coup.fund} Dinar`) : no("Para yetmiyor.");
    }
    case "seize":
      return seize(w, me, now);
    case "restore":
      return restore(w, me, pl.founder || isHanedan(w, me.id));
    case "marry": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      const r = proposeMarriage(w, me, t, decides);
      return { ok: !/olamaz|evli|bekleyen|reddetti|Akraba/i.test(r) || r.includes("evet"), msg: r };
    }
    case "answerProposal": {
      const r = answerProposal(w, me, a.proposalId, a.accept);
      return ok(r);
    }
    case "divorce": {
      const r = divorce(w, me);
      return me.spouse ? no(r) : ok(r);
    }
    case "haveChild": {
      const r = requestChild(w, me, decides);
      return { ok: r.startsWith("M\xFCjde") || r.startsWith("E\u015Finize"), msg: r };
    }
    case "school": {
      const c = findChild(w, a.childId);
      if (!c || !c.parents.includes(me.id)) return no("Bu sizin \xE7ocu\u011Funuz de\u011Fil.");
      const st = stage(w, c);
      if (a.on && st !== "cocuk" && st !== "genc") return no("Okul \xE7ocuk ve gen\xE7ler i\xE7indir.");
      c.inSchool = a.on;
      return ok(a.on ? `${c.name} okula ba\u015Flad\u0131 (g\xFCnde 1 Dinar).` : `${c.name} okuldan al\u0131nd\u0131.`);
    }
    case "cure": {
      const c = findChild(w, a.childId);
      if (!c || !c.parents.includes(me.id)) return no("Bu sizin \xE7ocu\u011Funuz de\u011Fil.");
      const r = cureChild(w, c, me);
      return { ok: r.endsWith("iyile\u015Fti."), msg: r };
    }
    case "veliaht": {
      if (w.kayzerId !== me.id || w.regime !== "imparatorluk") return no("Veliahd\u0131 sadece Kayzer belirler.");
      if (a.childId && !childrenOf(w, me.id).some((k) => k.id === a.childId)) return no("Veliaht sizin \xE7ocu\u011Funuz olmal\u0131.");
      w.veliaht = a.childId;
      log(w, a.childId ? `Ferman: veliaht ${findPerson(w, a.childId)?.name ?? findChild(w, a.childId)?.name}.` : "Ferman: veliaht kald\u0131r\u0131ld\u0131; en b\xFCy\xFCk \xE7ocuk varis.");
      return ok("Veliaht belirlendi.");
    }
    case "abdicate": {
      if (w.kayzerId !== me.id || w.regime !== "imparatorluk") return no("Sadece Kayzer feragat edebilir.");
      const r = succeed(w, me);
      if (!r) return no("Taht\u0131 devredecek e\u015Finiz ya da \xE7ocu\u011Funuz yok.");
      log(w, r, w.kayzerId ?? void 0);
      return ok(r);
    }
    case "isyanCmd": {
      if (!w.isyan) return no("Ortada isyan yok.");
      const head = isKayzer(w, me);
      const commander = me.prof === "asker" && !w.people.some((p) => p.playerId && canRule(w, p, now, ONLINE_WINDOW_MS) && now - (w.players[p.playerId]?.lastSeen ?? 0) < ONLINE_WINDOW_MS);
      if (!head && !commander) return no("Askerlere sadece h\xFCk\xFCmdar (ya da o yokken bir komutan) emir verir.");
      if (!["dagit", "tutukla", "saldir"].includes(a.cmd)) return no("Ge\xE7ersiz emir.");
      return ok(command(w, a.cmd, me.name));
    }
    case "joinRebels": {
      if (!w.isyan) return no("Ortada isyan yok.");
      if (me.id === w.kayzerId || me.soylu) return no("Siz saray\u0131n taraf\u0131ndas\u0131n\u0131z.");
      if (!w.isyan.rebels.includes(me.id)) w.isyan.rebels.push(me.id);
      me.republic = clamp(me.republic + 20);
      return ok("Asilere kat\u0131ld\u0131n\u0131z!");
    }
    case "fateVote": {
      if (!["surgun", "zindan", "af"].includes(a.fate)) return no("Ge\xE7ersiz.");
      const r = voteFate(w, me, a.fate);
      return { ok: r.startsWith("Oyunuz"), msg: r };
    }
    case "festival": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const c = num(a.cost, 50, 5e3);
      if (c === null || w.treasury < c) return no("Hazine yetmiyor.");
      if (!spend(w, c)) return no(`Meclis b\xFCt\xE7esi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      const perHead = c / w.people.length;
      for (const p of w.people) if (p.prof !== "kayzer") transfer(w, "saray", p.id, perHead, "bayram har\xE7l\u0131\u011F\u0131");
      for (const p of w.people) {
        p.mood = clamp(p.mood + c / 60);
        p.loyalty = clamp(p.loyalty + c / 150);
        p.republic = clamp(p.republic - c / 120);
      }
      log(w, `${headTitle(w)} bayram ilan etti! Herkese har\xE7l\u0131k da\u011F\u0131t\u0131ld\u0131.`);
      return ok("Bayram!");
    }
  }
}
function meclisVote(w) {
  const m = w.people.filter((p) => p.meclis);
  if (!m.length) return { yes: 0, total: 0, pass: true };
  const yes = m.filter((p) => chance(w, 0.35 + p.loyalty / 200 + (p.mood - 50) / 200)).length;
  return { yes, total: m.length, pass: yes * 2 > m.length };
}
function coupStatus(w, leaderId) {
  const kind = w.coup?.kind ?? "coup";
  const soldiers = w.people.filter((p) => p.prof === "asker" && (p.sidedWith === leaderId || kind === "revolution" && p.republic > 60)).length;
  const need = kind === "coup" ? lawOn(w, "saraykor") ? 8 : 6 : 4;
  const fundNeed = kind === "coup" ? 1500 : 800;
  const avgMood = w.people.reduce((s, p) => s + p.mood, 0) / w.people.length;
  const support = kind === "coup" ? avgMood < 40 || w.cumhuriyet >= 50 : w.cumhuriyet >= 70;
  const fund = w.coup?.leaderId === leaderId ? w.coup.fund : 0;
  return { soldiers, need, fund, fundNeed, support, ok: soldiers >= need && fund >= fundNeed && support };
}
function seize(w, me, now) {
  if (!w.coup || w.coup.leaderId !== me.id) return no("Haz\u0131rlanm\u0131\u015F bir komplonuz yok.");
  const st = coupStatus(w, me.id);
  const fund = w.coup.fund;
  if (!st.ok) {
    if (fund > 0) transfer(w, "fon", "saray", fund, "komplo fonuna el konuldu");
    w.coup = null;
    me.plotting = "none";
    openCase(w, me.id, "isyan", null, 0, 90);
    log(w, `${me.name} ${st.soldiers} askerle saray\u0131 basmaya kalkt\u0131; ba\u015Far\u0131s\u0131z oldu ve tutukland\u0131!`, me.id);
    return no("Darbe ba\u015Far\u0131s\u0131z! Tutukland\u0131n\u0131z, fonunuza el konuldu.");
  }
  if (fund > 0) transfer(w, "fon", "saray", fund, "darbe fonu hazineye");
  const old = findPerson(w, w.kayzerId);
  w.kayzerId = me.id;
  w.regime = "imparatorluk";
  w.coup = null;
  me.plotting = "none";
  for (const p of w.people) {
    p.sidedWith = null;
    if (p.prof === "asker") p.loyalty = 70;
  }
  for (const p of w.people) p.republic = clamp(p.republic - 20);
  log(w, `${st.soldiers > 0 ? "DARBE" : "DEVR\u0130M"}! ${me.name} tahta oturdu.${old ? ` ${old.name} saraydan \xE7\u0131kar\u0131ld\u0131.` : ""}`, me.id);
  void now;
  void kayzerOnline;
  return ok("Taht art\u0131k sizin.");
}
function restore(w, me, founder) {
  if (!founder) return no("Hanedan hakk\u0131 sadece kurucuya ve soyundan gelenlere aittir.");
  if (w.kayzerId === me.id) return no("Zaten tahttas\u0131n\u0131z efendim.");
  const loyal = w.people.filter((p) => p.prof === "asker" && p.loyalty >= 45).length;
  if (loyal < 3 && w.cumhuriyet >= 60) return no(`Hanedan hakk\u0131 i\xE7in en az 3 sad\u0131k asker ya da cumhuriyet iste\u011Finin 60'\u0131n alt\u0131na inmesi gerekir (\u015Fu an ${loyal} asker, cumhuriyet ${w.cumhuriyet}).`);
  const old = findPerson(w, w.kayzerId);
  if (old) old.loyalty = 20;
  const wasRep = w.regime === "cumhuriyet";
  w.kayzerId = me.id;
  w.regime = "imparatorluk";
  w.election.baskanCandidates = [];
  w.election.baskanVotes = {};
  me.prof = "kayzer";
  me.work = "saray";
  me.home = "saray";
  me.exiledDays = 0;
  w.isyan = null;
  w.deposed = null;
  const sp = findPerson(w, me.spouse);
  if (sp) {
    sp.soylu = true;
    sp.home = "saray";
  }
  log(w, `Hanedan geri d\xF6nd\xFC! ${wasRep ? "Cumhuriyet sona erdi, imparatorluk yeniden kuruldu. " : ""}${me.name} yeniden tahtta.`, me.id);
  return ok("Taht\u0131n\u0131za geri d\xF6nd\xFCn\xFCz efendim.");
}
var BAD = ["amk", "aq", "mk", "o\xE7", "orospu", "pi\xE7", "sik", "yarrak", "g\xF6t", "pezevenk", "kahpe", "ibne", "fuck", "shit", "bitch"];
function filterProfanity(s) {
  return s.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const lw = word.toLocaleLowerCase("tr");
    return BAD.some((b2) => lw === b2 || b2.length >= 4 && lw.startsWith(b2)) ? "*".repeat(word.length) : word;
  });
}
function rateOk(times, now, n = 5, windowMs = 3e4) {
  while (times.length && now - (times[0] ?? 0) > windowMs) times.shift();
  if (times.length >= n) return false;
  times.push(now);
  return true;
}
function officeOf(w, p) {
  const r = [];
  if (p.id === w.kayzerId) r.push(w.regime === "cumhuriyet" ? "Cumhurba\u015Fkan\u0131" : "Kayzer");
  else r.push(p.prof === "kayzer" ? "Eski Kayzer" : PROF_LABEL[p.prof]);
  if (p.meclis) r.push("Meclis \xFCyesi");
  if (p.id === w.founderPersonId || p.soylu && isHanedan(w, p.id)) r.push("Hanedan");
  else if (p.soylu) r.push("Soylu");
  if (w.regime === "imparatorluk" && p.spouse === w.kayzerId) r.push(p.female ? "Kayzeri\xE7e" : "Kayzer\u2019in e\u015Fi");
  if (w.regentId === p.id) r.push("Naip (veliaht re\u015Fit olana dek)");
  if (p.exiledDays > 0) r.push("S\xFCrg\xFCnde");
  return r.join(" \xB7 ");
}

// src/sim/admin.ts
function applyAdmin(w, op) {
  switch (op.t) {
    case "setTreasury":
      w.treasury = Math.max(-1e5, Math.min(1e7, op.amount));
      return "Hazine ayarland\u0131.";
    case "editPerson": {
      const p = findPerson(w, op.personId);
      if (!p) return "Ki\u015Fi yok.";
      if (op.field === "name") {
        p.name = String(op.value).slice(0, 24);
        return "\u0130sim de\u011Fi\u015Fti.";
      }
      const v = Number(op.value);
      if (!Number.isFinite(v)) return "Ge\xE7ersiz de\u011Fer.";
      p[op.field] = op.field === "money" ? v : Math.max(0, Math.min(100, v));
      return "De\u011Fer de\u011Fi\u015Fti.";
    }
    case "ban": {
      const pl = w.players[op.playerId];
      if (!pl || pl.founder) return "Olmaz.";
      pl.banned = op.banned;
      const p = findPerson(w, pl.personId);
      if (p) p.npc = op.banned;
      log(w, `${pl.name} ${op.banned ? "s\xFCrg\xFCn edildi" : "affedildi"}.`);
      return "Tamam.";
    }
    case "kick": {
      const pl = w.players[op.playerId];
      if (!pl) return "Yok.";
      pl.lastSeen = 0;
      return "Oyundan at\u0131ld\u0131.";
    }
    case "releaseAll":
      for (const p of w.people) p.jailedDays = 0;
      for (const c of w.cases) c.stage = "kapandi";
      return "Zindan bo\u015Falt\u0131ld\u0131.";
    case "allowStateTakeover":
      w.allowStateTakeover = op.allow;
      return op.allow ? "Yeni oyuncular devlet g\xF6revlilerini de devralabilir." : "Devlet g\xF6revlileri devral\u0131namaz.";
    case "resetCumhuriyet":
      for (const p of w.people) p.republic = 5;
      w.cumhuriyet = 5;
      w.cumhuriyetDays = 0;
      return "S\u0131f\u0131rland\u0131.";
  }
}

// src/server/core.ts
function heartbeat(w, playerId, now) {
  const summary = touchPlayer(w, playerId, now);
  const hours = advanceWorld(w, now);
  const snapshotDue = now - w.lastSnapshotAt >= SNAPSHOT_EVERY_MS;
  if (snapshotDue) w.lastSnapshotAt = now;
  return { summary, hours, snapshotDue };
}
function act(w, playerId, a, now) {
  advanceWorld(w, now);
  return applyAction(w, playerId, a, now);
}
function register(w, playerId, name, prof, founder, now, takeOverId) {
  joinWorld(w, playerId, name, prof, founder, now, takeOverId);
}
function candidates(w) {
  return takeoverCandidates(w).map((p) => ({ id: p.id, name: p.name, office: officeOf(w, p), money: Math.round(p.money), mood: Math.round(p.mood), loyalty: Math.round(p.loyalty), republic: Math.round(p.republic), health: Math.round(p.health), thought: p.thought, home: p.home, spouse: w.people.find((x) => x.id === p.spouse)?.name ?? null, sprite: { hairColor: p.hairColor, skin: p.skin, shirt: p.shirt, female: p.female, prof: p.prof } }));
}
function makeChat(w, playerId, text, toPersonId, times, now) {
  const me = personOf(w, playerId);
  if (!me) return "Karakter yok.";
  if (w.players[playerId]?.banned) return "S\xFCrg\xFCndesiniz.";
  const clean2 = filterProfanity(text.replace(/[<>]/g, "").trim()).slice(0, 280);
  if (!clean2) return "Bo\u015F mesaj.";
  if (!rateOk(times, now)) return "\xC7ok h\u0131zl\u0131 yaz\u0131yorsunuz; biraz bekleyin.";
  if (toPersonId && !w.people.some((p) => p.id === toPersonId)) return "Al\u0131c\u0131 yok.";
  return { id: `${now}-${Math.round(Math.random() * 1e6)}`, fromPersonId: me.id, fromName: me.name, toPersonId, text: clean2, at: now };
}
function admin(w, op) {
  return applyAdmin(w, op);
}
export {
  act,
  admin,
  candidates,
  createWorld,
  filterProfanity,
  heartbeat,
  makeChat,
  personOf,
  rateOk,
  register
};
