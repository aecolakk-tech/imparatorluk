// src/sim/types.ts
var GOODS = ["ekmek", "su", "et", "balik", "kumas", "alet", "odun", "bugday", "yun", "elbise", "mobilya", "icki"];

// src/sim/constants.ts
var DAY_MS = 5 * 60 * 1e3;
var HOUR_MS = DAY_MS / 24;
var ONLINE_WINDOW_MS = 60 * 1e3;
var MAX_CATCHUP_HOURS = 48;
var SNAPSHOT_EVERY_MS = 3 * 24 * 3600 * 1e3;
var INACTIVE_TO_NPC_MS = 21 * 24 * 3600 * 1e3;
var MAP_W = 100;
var MAP_H = 60;
var BASE_PRICE = { ekmek: 1.2, su: 0.5, et: 6, balik: 4, kumas: 8, alet: 20, odun: 2.5, bugday: 0.5, yun: 2, elbise: 18, mobilya: 40, icki: 3 };
var GOOD_LABEL = { ekmek: "Ekmek", su: "Su", et: "Et", balik: "Bal\u0131k", kumas: "Kuma\u015F", alet: "Alet", odun: "Odun", bugday: "Bu\u011Fday", yun: "Y\xFCn", elbise: "Elbise", mobilya: "Mobilya", icki: "\u0130\xE7ki" };
var PRODUCES = {
  ciftci: { good: "bugday", qty: 30, market: "gida" },
  firinci: { good: "ekmek", qty: 40, market: "gida", inputs: { bugday: 20 } },
  sucu: { good: "su", qty: 80, market: "gida" },
  kasap: { good: "et", qty: 14, market: "gida", extra: { good: "yun", qty: 3 } },
  balikci: { good: "balik", qty: 14, market: "pazar" },
  dokumaci: { good: "kumas", qty: 4, market: "zanaat", inputs: { yun: 4 } },
  terzi: { good: "elbise", qty: 2, market: "zanaat", inputs: { kumas: 2 } },
  marangoz: { good: "odun", qty: 20, market: "yeni" },
  mobilyaci: { good: "mobilya", qty: 1, market: "yeni", inputs: { odun: 4 } },
  demirci: { good: "alet", qty: 2, market: "zanaat", inputs: { odun: 2 } },
  barci: { good: "icki", qty: 16, market: "bar", inputs: { bugday: 8 } }
};
var DECAY = { ekmek: 0.35, su: 0.3, et: 0.3, balik: 0.4, kumas: 0.02, alet: 0.03, odun: 0.05, bugday: 0.12, yun: 0.02, elbise: 0.05, mobilya: 0.02, icki: 0.05 };
var STOCK_LIMIT = { ekmek: 120, su: 200, et: 40, balik: 40, kumas: 20, alet: 10, odun: 40, bugday: 150, yun: 30, elbise: 10, mobilya: 4, icki: 50 };
var RANKS = [{ xp: 0, label: "\xC7\u0131rak", mult: 0.85 }, { xp: 20, label: "Kalfa", mult: 1 }, { xp: 60, label: "Usta", mult: 1.2 }];
var STATE_PROFS = ["memur", "tahsildar", "bekci", "savci", "hakim", "asker", "hoca", "imam"];
var DEFAULT_SALARY = {
  memur: 7,
  tahsildar: 7,
  bekci: 7,
  savci: 9,
  hakim: 10,
  asker: 7,
  hoca: 7,
  imam: 6,
  naip: 0,
  kayzer: 0
};
var OLD_DEFAULT_SALARY = {
  memur: 11,
  tahsildar: 11,
  bekci: 11,
  savci: 14,
  hakim: 15,
  asker: 10,
  hoca: 10,
  imam: 8
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
  hakim: "Kad\u0131",
  ciftci: "\xC7ift\xE7i",
  dokumaci: "Dokumac\u0131",
  mobilyaci: "Mobilyac\u0131",
  barci: "Barc\u0131",
  asker: "Asker",
  kayzer: "Kayzer",
  naip: "Naip"
};
var PLAYER_PROFS = ["ciftci", "dokumaci", "mobilyaci", "barci", "firinci", "sucu", "kasap", "balikci", "terzi", "demirci", "marangoz", "tuccar", "hekim", "hamal", "insaatci", "kalemsor"];

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

// src/sim/laws.ts
var LAW_FIELDS = {
  satisVergisi: { value: [0, 40, 10, "%"] },
  basVergisi: { value: [0, 10, 1.5, "D/g\xFCn"] },
  malVergisi: { good: true, value: [1, 50, 10, "%"] },
  narh: { good: true, value: [0.1, 500, 2, "Dinar"] },
  yasak: { good: true, value: [0, 0, 0, ""] },
  sokak: { value: [18, 23, 22, "ba\u015Flang\u0131\xE7 saati"], value2: [3, 8, 5, "biti\u015F saati"] },
  hizmet: { value: [1, 20, 5, "ki\u015Fi/g\xFCn"] },
  destek: { good: true, value: [0.1, 20, 0.3, "D/adet"] },
  servetEsigi: { value: [100, 5e3, 300, "Dinar"] },
  sertCeza: { value: [10, 200, 50, "%"] }
};
function validateLaw(s) {
  if (!s || !(s.kind in LAW_FIELDS)) return "Kanun t\xFCr\xFC ge\xE7ersiz.";
  const f = LAW_FIELDS[s.kind];
  if (f.good && !GOODS.includes(s.good)) return "Bir mal se\xE7in.";
  if (s.kind !== "yasak" && (!Number.isFinite(s.value) || s.value < f.value[0] || s.value > f.value[1])) return `De\u011Fer ${f.value[0]}\u2013${f.value[1]} aras\u0131 olmal\u0131.`;
  if (f.value2 && (!Number.isFinite(s.value2) || s.value2 < f.value2[0] || s.value2 > f.value2[1])) return `\u0130kinci de\u011Fer ${f.value2[0]}\u2013${f.value2[1]} aras\u0131 olmal\u0131.`;
  return null;
}
function lawTitle(s) {
  const g = s.good ? GOOD_LABEL[s.good] : "";
  switch (s.kind) {
    case "satisVergisi":
      return `Sat\u0131\u015F vergisi %${s.value}`;
    case "basVergisi":
      return `Ba\u015F vergisi ${s.value} D/g\xFCn`;
    case "malVergisi":
      return `${g} vergisi %${s.value}`;
    case "narh":
      return `${g} narh\u0131 ${s.value} D`;
    case "yasak":
      return `${g} yasa\u011F\u0131`;
    case "sokak":
      return `Soka\u011Fa \xE7\u0131kma yasa\u011F\u0131 ${s.value}:00\u2013${s.value2}:00`;
    case "hizmet":
      return `Zorunlu hizmet: g\xFCnde ${s.value} ki\u015Fi`;
    case "destek":
      return `${g} \xFCreticisine ${s.value} D/adet destek`;
    case "servetEsigi":
      return `Servet vergisi ${s.value} D \xFCst\xFCne`;
    case "sertCeza":
      return `Cezalar %${s.value} a\u011F\u0131rla\u015Fs\u0131n`;
  }
}
var adults = (w) => w.people.filter((p) => p.prof !== "naip" && p.id !== w.kayzerId && p.jailedDays === 0);
function shock(w, s, sign) {
  for (const p of adults(w)) {
    let d = 0;
    switch (s.kind) {
      case "satisVergisi":
        d = (w.taxRate - s.value) * 0.6;
        break;
      case "basVergisi":
        d = (w.headTax - s.value) * 3;
        break;
      case "malVergisi":
        d = -2 - (p.prof && s.good && PRODUCER[p.prof] === s.good ? 8 : 0);
        break;
      case "narh":
        d = s.good && PRODUCER[p.prof] === s.good ? -6 : 1.5;
        break;
      case "yasak":
        d = s.good === "icki" ? (p.din - 50) / 6 : ["ekmek", "su", "bugday"].includes(s.good) ? -25 : -3;
        if (s.good && PRODUCER[p.prof] === s.good) d -= 10;
        break;
      case "sokak":
        d = p.honesty < 40 ? -4 : -1;
        break;
      case "hizmet":
        d = -2;
        break;
      case "destek":
        d = s.good && PRODUCER[p.prof] === s.good ? 6 : 0.5;
        break;
      case "servetEsigi":
        d = p.money > s.value ? -6 : 1;
        break;
      case "sertCeza":
        d = p.honesty < 35 ? -5 : p.republic > 50 ? -2 : 1;
        break;
    }
    p.loyalty = clamp(p.loyalty + d * sign);
    if (d < -5) p.republic = clamp(p.republic + 1);
  }
}
var PRODUCER = { ciftci: "bugday", firinci: "ekmek", sucu: "su", kasap: "et", balikci: "balik", dokumaci: "kumas", terzi: "elbise", marangoz: "odun", mobilyaci: "mobilya", demirci: "alet", barci: "icki" };
function apply(w, l, on) {
  switch (l.kind) {
    case "satisVergisi":
      if (on) w.taxRate = l.value;
      break;
    case "basVergisi":
      if (on) w.headTax = l.value;
      break;
    case "narh":
      if (on) {
        w.priceCaps[l.good] = l.value;
        for (const x of w.listings) if (x.good === l.good && x.price > l.value) x.price = l.value;
      } else delete w.priceCaps[l.good];
      break;
    case "yasak":
      if (on) {
        if (!w.bans.includes(l.good)) w.bans.push(l.good);
        for (const x of w.listings) if (x.good === l.good && x.sellerId !== "dis") x.qty = 0;
        w.listings = w.listings.filter((x) => x.qty > 0);
      } else w.bans = w.bans.filter((b2) => b2 !== l.good);
      break;
    default:
      break;
  }
}
function enactLaw(w, s, by, via) {
  const err = validateLaw(s);
  if (err) return err;
  w.customLaws = w.customLaws ?? [];
  const old = w.customLaws.find((x) => x.kind === s.kind && x.good === s.good);
  if (old) repealLaw(w, old.id, true);
  shock(w, s, 1);
  const law = { ...s, id: nextId(w, "K"), name: s.name?.trim().slice(0, 50) || lawTitle(s), by: by?.id ?? "meclis", day: w.day, via };
  w.customLaws.push(law);
  apply(w, law, true);
  log(w, `\u{1F4DC} YEN\u0130 KANUN (${via === "ferman" ? "ferman" : "Meclis"}): ${law.name}.`);
  return `Kanun y\xFCr\xFCrl\xFCkte: ${law.name}.`;
}
function repealLaw(w, id, quiet = false) {
  const l = (w.customLaws ?? []).find((x) => x.id === id);
  if (!l) return "Kanun yok.";
  w.customLaws = w.customLaws.filter((x) => x !== l);
  apply(w, l, false);
  if (!quiet) {
    shock(w, l, -1);
    log(w, `\u{1F4DC} Kanun kald\u0131r\u0131ld\u0131: ${l.name}.`);
  }
  return `${l.name} kald\u0131r\u0131ld\u0131.`;
}
var customLaw = (w, kind, good) => (w.customLaws ?? []).find((x) => x.kind === kind && (good === void 0 || x.good === good));
function goodTaxPct(w, g) {
  return customLaw(w, "malVergisi", g)?.value ?? 0;
}
function subsidyPerUnit(w, g) {
  return customLaw(w, "destek", g)?.value ?? 0;
}
function curfewAt(w, hour) {
  const c = customLaw(w, "sokak");
  if (!c) return false;
  const a = c.value, b2 = c.value2 ?? 5;
  return a > b2 ? hour >= a || hour < b2 : hour >= a && hour < b2;
}
function crimeFactor(w) {
  const c = customLaw(w, "sertCeza");
  return c ? 1 / (1 + c.value / 100) : 1;
}
function wealthThreshold(w) {
  return customLaw(w, "servetEsigi")?.value ?? 300;
}
function customLawsDay(w) {
  const serving = [];
  const h = customLaw(w, "hizmet");
  if (h) {
    const pool = adults(w).filter((p) => !p.playerId && p.prof !== "asker" && p.prof !== "bekci");
    const proj = w.projects.find((x) => !x.done);
    for (let i = 0; i < h.value && pool.length; i += 1) {
      const p = pick(w, pool);
      pool.splice(pool.indexOf(p), 1);
      serving.push(p);
      p.loyalty = clamp(p.loyalty - 1.5);
      p.lastAction = proj ? `zorunlu hizmet: ${proj.name}` : "zorunlu hizmet: devriye";
      if (proj) proj.progress = Math.min(proj.needed, proj.progress + 1);
    }
  }
  if (customLaw(w, "sokak")) for (const p of adults(w)) p.mood = clamp(p.mood - 0.3);
  w.serving = serving.map((p) => p.id);
  return serving;
}
function paySubsidy(w, sellerId, g) {
  const s = subsidyPerUnit(w, g);
  if (s > 0 && sellerId !== "dis" && sellerId !== "saray") transfer(w, "saray", sellerId, s, `${GOOD_LABEL[g]} deste\u011Fi`);
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
  if (from.female === to.female) return "Evlilik sadece bir erkek ile bir kad\u0131n aras\u0131nda olur.";
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
  if (a.female === b2.female) return;
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
var ERKEK = ["Kerem", "Emir", "Yi\u011Fit", "Alp", "Aras", "Batu", "Deniz", "Efe", "Mert", "Kaan", "Tuna", "O\u011Fuz"];
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
    name: `${pick(w, female ? KIZ : ERKEK)}${royal ? " \u015Eehzade".replace("\u015Eehzade", female ? "Sultan" : "\u015Eehzade") : ""} ${royal ? "" : `(${last})`}`.replace(/\s+/g, " ").trim(),
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
  const adults2 = heirs.filter((h) => h.adult).map((h) => findPerson(w, h.id)).filter(Boolean);
  if (p.money > 20) transfer(w, p.id, "saray", Math.round(p.money * 0.1 * 100) / 100, "miras vergisi (%10)");
  const money = Math.max(0, p.money);
  if (money > 0) {
    const toSp = sp ? adults2.length ? money / 2 : money : 0;
    if (sp && toSp > 0) transfer(w, p.id, sp.id, toSp, "miras");
    const rest = Math.max(0, p.money);
    if (adults2.length && rest > 0) for (const a of adults2) transfer(w, p.id, a.id, rest / adults2.length, "miras");
    else if (rest > 0) transfer(w, p.id, "saray", rest, "mirass\u0131z mal hazineye");
  }
  if (p.money > 0) transfer(w, p.id, "saray", p.money, "kalan mal hazineye");
  const invHeir = sp ?? adults2[0];
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
  log(w, text, sp?.id ?? adults2[0]?.id);
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

// src/sim/hoard.ts
var LIMIT = (g) => STOCK_LIMIT[g] ?? 100;
var active = (p) => p.prof !== "naip" && p.jailedDays === 0 && p.exiledDays === 0;
function diligence(b2) {
  return clamp(b2.honesty * 0.45 + b2.loyalty * 0.4 + Math.min(15, (b2.xp ?? 0) / 10), 0, 100) / 100;
}
function spikedGoods(w) {
  return GOODS.filter((g) => {
    const h = w.priceHist?.[g] ?? [];
    if (h.length < 3) return false;
    const avg = h.reduce((a, b2) => a + b2, 0) / h.length;
    return w.prices[g] > avg * 1.35 && w.prices[g] > BASE_PRICE[g];
  });
}
var excess = (p) => GOODS.map((g) => [g, p.inv[g] - LIMIT(g)]).filter(([, x]) => x > 0);
function hoarderAI(w) {
  const spiked = spikedGoods(w).filter((g) => g === "bugday" || g === "ekmek" || g === "odun" || g === "kumas");
  if (!spiked.length && w.nature?.kind !== "kuraklik") return;
  const goods = spiked.length ? spiked : ["bugday"];
  for (const p of w.people.filter((x) => !x.playerId && active(x) && x.honesty < 35 && x.money > 80 && (x.prof === "tuccar" || x.ambition > 65))) {
    if (!chance(w, 0.35)) continue;
    const g = pick(w, goods);
    buy(w, p.id, g, Math.min(60, Math.floor(p.money / Math.max(0.5, w.prices[g]) / 3)), w.prices[g] * 1.1);
    if (p.inv[g] > LIMIT(g)) p.lastAction = `${GOOD_LABEL[g]} stokluyor`;
  }
}
function patrolDay(w) {
  w.suspicion = w.suspicion ?? {};
  const S = w.suspicion;
  for (const id of Object.keys(S)) {
    S[id] = S[id] * 0.8;
    if (S[id] < 2) delete S[id];
  }
  const spiked = spikedGoods(w);
  if (spiked.length) log(w, `Bek\xE7iler ${spiked.map((g) => GOOD_LABEL[g]).join(", ")} fiyat\u0131 f\u0131rlay\u0131nca stok\xE7ular\u0131n pe\u015Fine d\xFC\u015Ft\xFC.`);
  for (const p of w.people) {
    const ex = excess(p);
    if (!ex.length || !active(p)) continue;
    let s = 0;
    for (const [g, x] of ex) {
      s += Math.min(40, x / LIMIT(g) * 40);
      if (spiked.includes(g)) s += 25;
    }
    const neighbours = w.people.filter((n) => n.home === p.home || (n.relations[p.id] ?? 0) < -30);
    const tipsters = neighbours.filter((n) => n.id !== p.id && (n.relations[p.id] ?? 0) < 0 && n.honesty > 40);
    if (tipsters.length && chance(w, 0.5)) {
      s += 15 * Math.min(3, tipsters.length);
      if (chance(w, 0.4)) w.rumors.push({ day: w.day, text: `${p.name}'\u0131n mahzeni ${GOOD_LABEL[ex[0][0]]} dolu diyorlar\u2026`, about: p.id });
    }
    if (w.rumors.some((r) => r.about === p.id && w.day - r.day <= 3)) s += 10;
    S[p.id] = clamp((S[p.id] ?? 0) + s, 0, 100);
  }
  const patrol = w.people.filter((x) => x.prof === "bekci" && active(x)).concat((w.serving ?? []).map((id) => findPerson(w, id)).filter((x) => !!x).filter(active));
  const suspects = Object.entries(S).sort((a, b2) => b2[1] - a[1]).map(([id]) => findPerson(w, id)).filter((x) => !!x && active(x));
  for (const b2 of patrol) {
    const t = suspects.shift();
    if (!t) break;
    if (t.playerId && !t.npc && b2.prof !== "bekci") continue;
    const catchP = clamp((S[t.id] ?? 0) / 100 * (0.35 + diligence(b2) * 0.65), 0, 0.95);
    if (rand(w) < catchP) searchAndSeize(w, b2, t);
  }
}
function searchAndSeize(w, b2, t) {
  const ex = excess(t);
  if (!ex.length) {
    (w.suspicion ?? {})[t.id] = 0;
    t.relations[b2.id] = clamp((t.relations[b2.id] ?? 0) - 5, -100, 100);
    return `${t.name}'\u0131n evinde fazla mal \xE7\u0131kmad\u0131.`;
  }
  if (b2.honesty < 35 && b2.loyalty < 50 && t.money > 20 && !t.playerId && chance(w, 0.6)) {
    const amt = Math.round(Math.min(t.money * 0.3, 15 + ex.length * 10));
    if (transfer(w, t.id, b2.id, amt, "karaborsa r\xFC\u015Fveti")) {
      if (chance(w, 0.3)) w.rumors.push({ day: w.day, text: `Bek\xE7i ${b2.name} stok\xE7u ${t.name}'dan r\xFC\u015Fvet alm\u0131\u015F!`, about: b2.id });
      return `${b2.name} r\xFC\u015Fvet al\u0131p g\xF6z yumdu.`;
    }
  }
  const parts = [];
  for (const [g, x] of ex) {
    t.inv[g] -= x;
    if (g === "bugday") w.granary += x;
    else w.listings.push({ id: `L${++w.idSeq}`, sellerId: "saray", good: g, qty: x, price: Math.round(BASE_PRICE[g] * 100) / 100, market: "pazar" });
    parts.push(`${x} ${GOOD_LABEL[g]}`);
  }
  const fine = Math.min(t.money, 10 + ex.reduce((a, [, x]) => a + x, 0) * 0.1);
  transfer(w, t.id, "saray", fine, "karaborsa cezas\u0131");
  b2.xp = (b2.xp ?? 0) + 3;
  b2.rep = clamp((b2.rep ?? 0) + 2, -100, 100);
  t.rep = clamp((t.rep ?? 0) - 6, -100, 100);
  t.relations[b2.id] = clamp((t.relations[b2.id] ?? 0) - 30, -100, 100);
  (t.relNote ??= {})[b2.id] = "mal\u0131ma el koydu";
  (w.suspicion ?? {})[t.id] = 0;
  log(w, `\u{1F6A8} Bek\xE7i ${b2.name}, ${t.name}'\u0131n karaborsa sto\u011Funa el koydu: ${parts.join(", ")} (ceza ${Math.round(fine)} D).`, t.id);
  if (t.playerId) personal(w, t.playerId, `Bek\xE7i ${b2.name} sto\u011Funuza el koydu: ${parts.join(", ")}.`);
  return `El konuldu: ${parts.join(", ")}; ceza ${Math.round(fine)} D.`;
}
function inspectPerson(w, b2, t) {
  if (b2.lastAction === "arama yapt\u0131") return "Bug\xFCn zaten bir arama yapt\u0131n\u0131z.";
  b2.lastAction = "arama yapt\u0131";
  return searchAndSeize(w, b2, t);
}

// src/sim/life.ts
var DOCTOR_FEE = 10;
var MEALS = 3;
var WATERS = 5;
var palace = (w, p) => p.id === w.kayzerId || p.soylu && p.home === "saray";
var active2 = (p) => p.prof !== "naip" && p.jailedDays === 0 && p.exiledDays === 0;
var rel = (a, b2, d, why) => {
  a.relations[b2.id] = clamp((a.relations[b2.id] ?? 0) + d, -100, 100);
  a.relNote[b2.id] = why;
  const keys = Object.keys(a.relNote);
  if (keys.length > 14) delete a.relNote[keys[0]];
};
var FOOD_JOY = { ekmek: 0.6, balik: 2, et: 2.5 };
function eatMeal(w, p) {
  if (p.prof === "naip") {
    p.meals += 1;
    return true;
  }
  if (palace(w, p)) {
    if (transfer(w, "saray", "dis", 1, "saray mutfa\u011F\u0131")) {
      p.meals += 1;
      p.hunger = clamp(p.hunger - 35);
      p.mood = clamp(p.mood + 1);
      return true;
    }
  }
  if (p.jailedDays > 0) {
    p.meals += 1;
    p.hunger = clamp(p.hunger - 30);
    return true;
  }
  const prefs = p.money > 30 && chance(w, 0.5) ? chance(w, 0.5) ? ["et", "balik", "ekmek"] : ["balik", "et", "ekmek"] : ["ekmek", "balik", "et"];
  for (const g of prefs) {
    if (p.inv[g] <= 0) buy(w, p.id, g, 1, Math.max(0, p.money * 0.6));
    if (p.inv[g] > 0) {
      p.inv[g] -= 1;
      p.meals += 1;
      p.hunger = clamp(p.hunger - 35);
      p.mood = clamp(p.mood + (FOOD_JOY[g] ?? 0.5));
      return true;
    }
  }
  p.hunger = clamp(p.hunger + 15);
  return false;
}
function drinkWater(w, p) {
  if (p.prof === "naip" || p.jailedDays > 0) {
    p.drinks += 1;
    return true;
  }
  if (palace(w, p) && transfer(w, "saray", "dis", 0.3, "saray mutfa\u011F\u0131")) {
    p.drinks += 1;
    p.thirst = clamp(p.thirst - 25);
    return true;
  }
  if (p.inv.su <= 0) buy(w, p.id, "su", 2, Math.max(0, p.money * 0.5));
  if (p.inv.su > 0) {
    p.inv.su -= 1;
    p.drinks += 1;
    p.thirst = clamp(p.thirst - 25);
    return true;
  }
  p.thirst = clamp(p.thirst + 15);
  return false;
}
function needsEndOfDay(w, p) {
  if (p.prof === "naip") {
    p.meals = 0;
    p.drinks = 0;
    return;
  }
  const fresh = w.day <= 1 || (p.protectedUntil ?? 0) > w.day + 4;
  const ok2 = fresh || p.meals >= MEALS && p.drinks >= WATERS;
  if (!ok2) {
    p.health = clamp(p.health - 10);
    p.mood = clamp(p.mood - 3);
  } else if (p.health >= 30 && !p.wounded) p.health = clamp(p.health + 3);
  if ((p.health < 30 || p.wounded) && ok2) p.health = clamp(p.health - 1);
  if (p.inv.elbise > 0) {
    p.mood = clamp(p.mood + 0.4);
    p.rep = clamp(p.rep + 0.1, -100, 100);
    if (p.health >= 30) p.health = clamp(p.health + 0.5);
  }
  if (p.inv.mobilya > 0) {
    p.mood = clamp(p.mood + 0.8);
    if (p.health >= 30) p.health = clamp(p.health + 0.5);
  }
  if (p.inv.odun > 0) {
    if (w.day % 3 === 0) p.inv.odun -= 1;
    p.mood = clamp(p.mood + 0.4);
  }
  p.meals = 0;
  p.drinks = 0;
  p.bought = {};
  if (p.health < 5) p.health = 5;
}
function needsHelp(p) {
  return p.health < 30 || p.wounded;
}
function seeDoctor(w, p, stateFunds = false) {
  const hs = w.people.filter((x) => x.prof === "hekim" && active2(x) && x.id !== p.id);
  const h = hs.sort((a, b2) => b2.xp - a.xp)[0];
  if (!h) return "\u015Eehirde hekim yok!";
  const fee = Math.round(DOCTOR_FEE * rankOf(h).mult);
  const payer = transfer(w, p.id, h.id, fee, "hekim \xFCcreti") ? p.id : stateFunds && transfer(w, "saray", h.id, fee * 0.6, "dar\xFClaceze") ? "saray" : null;
  if (!payer) return `Hekim ${fee} Dinar istiyor; paran\u0131z yetmiyor.`;
  h.incomeToday += fee;
  h.xp += 1;
  p.health = clamp(Math.max(p.health, 70) + 10);
  p.wounded = false;
  rel(p, h, 4, "beni iyile\u015Ftirdi");
  return `${h.name} sizi iyile\u015Ftirdi (${payer === "saray" ? "dar\xFClaceze \xF6dedi" : `${fee} Dinar`}).`;
}
function pray(w, p) {
  p.din = clamp(p.din + 2);
  p.mood = clamp(p.mood + 1.5);
  p.lastAction = "camide namaz k\u0131ld\u0131";
  const imam = w.people.find((x) => x.prof === "imam" && active2(x));
  if (p.money > 60 && chance(w, 0.3) && imam) {
    transfer(w, p.id, imam.id, 2, "cami ba\u011F\u0131\u015F\u0131");
    p.rep = clamp(p.rep + 1, -100, 100);
  }
  return "Camide namaz k\u0131ld\u0131n\u0131z (dindarl\u0131k +2, mutluluk +1,5).";
}
function drinkAlcohol(w, p) {
  if (w.bans.includes("icki")) return "\u0130\xE7ki yasak; meyhane kapal\u0131.";
  if (p.inv.icki <= 0) buy(w, p.id, "icki", 1, Math.max(0, p.money * 0.5));
  if (p.inv.icki <= 0) return "Meyhanede i\xE7ki yok ya da paran\u0131z yetmiyor.";
  p.inv.icki -= 1;
  p.mood = clamp(p.mood + 4);
  p.din = clamp(p.din - 3);
  p.lastAction = "meyhanede i\xE7ti";
  if (chance(w, 0.08)) {
    p.health = clamp(p.health - 5);
  }
  return "Meyhanede bir kadeh i\xE7tiniz (mutluluk +4, dindarl\u0131k \u22123).";
}
function sermon(w, by, topic) {
  const hearers = w.people.filter((p) => active2(p) && p.din > 35 && p.id !== by.id);
  for (const p of hearers) {
    p.din = clamp(p.din + (topic === "namaz" ? 3 : 1.5));
    if (topic === "icki" && p.din > 50) p.inv.icki = 0;
    if (topic === "sabir") {
      p.mood = clamp(p.mood + 1);
      p.republic = clamp(p.republic - 1);
    }
  }
  log(w, `${by.name} cuma vaaz\u0131 verdi (${topic === "namaz" ? "namaza \xE7a\u011Fr\u0131" : topic === "icki" ? "i\xE7kinin zararlar\u0131" : "sab\u0131r ve itaat"}); ${hearers.length} ki\u015Fi dinledi.`, by.id);
  return `${hearers.length} ki\u015Fi vaaz\u0131n\u0131z\u0131 dinledi.`;
}
function directive(w, topic) {
  for (const p of w.people) {
    if (!active2(p) || p.id === w.kayzerId) continue;
    if (topic === "namaz") {
      p.din = clamp(p.din + (p.din > 30 ? 4 : 1));
      if (p.din < 30) p.loyalty = clamp(p.loyalty - 3);
      else p.loyalty = clamp(p.loyalty + 1);
    }
    if (topic === "icki") {
      p.din = clamp(p.din + 2);
      if (p.din < 40) p.loyalty = clamp(p.loyalty - 3);
    }
    if (topic === "laik") {
      p.din = clamp(p.din - 4);
      if (p.din > 65) p.loyalty = clamp(p.loyalty - 4);
      else p.loyalty = clamp(p.loyalty + 1);
    }
  }
  log(w, `Devlet y\xF6nlendirmesi: ${topic === "namaz" ? "halk namaza te\u015Fvik ediliyor" : topic === "icki" ? "i\xE7kiye kar\u015F\u0131 kampanya" : "laik e\u011Fitim ve ya\u015Fam te\u015Fviki"}.`);
  return "Y\xF6nlendirme ilan edildi.";
}
function needsHour(w) {
  const h = w.hour;
  const meal = h === 7 || h === 13 || h === 19;
  const water = h === 7 || h === 10 || h === 13 || h === 16 || h === 19;
  if (!meal && !water) return;
  for (const p of w.people) {
    if (water) drinkWater(w, p);
    if (meal) eatMeal(w, p);
  }
  if (h === 19) {
    for (const p of w.people) {
      while (p.drinks < WATERS && drinkWater(w, p)) {
      }
      while (p.meals < MEALS && eatMeal(w, p)) {
      }
    }
  }
}
function lifeHour(w) {
  const h = w.hour;
  if (h === 9) {
    karaborsa(w);
    patrolDay(w);
  }
  if (h === 11) {
    hoarderAI(w);
    hamalWork(w);
  }
  if (h === 13) {
    for (const p of w.people) if (fullAI(p) && active2(p) && p.din > 55 && chance(w, 0.4)) pray(w, p);
  }
  if (h === 13 && w.day % 7 === 5) {
    const imam = w.people.find((x) => (x.prof === "imam" || x.prof === "hoca") && active2(x) && fullAI(x));
    if (imam) sermon(w, imam, pick(w, ["namaz", "icki", "sabir"]));
  }
  if (h === 14) {
    for (const p of w.people) if (fullAI(p) || p.npc) {
      if (needsHelp(p) && active2(p)) seeDoctor(w, p, true);
    }
  }
  if (h === 14) {
    for (const p of w.people) if (!fullAI(p) && needsHelp(p) && p.money > DOCTOR_FEE * 2) seeDoctor(w, p, false);
  }
  if (h === 15) collectTaxes(w);
  if (h === 18) {
    for (const p of w.people) if (fullAI(p) && active2(p)) shop(w, p);
  }
  if (h === 20) {
    for (const p of w.people) if (fullAI(p) && active2(p) && p.din < 45 && p.money > 10 && chance(w, 0.35)) drinkAlcohol(w, p);
  }
  if (h === 21) {
    for (const p of w.people) if (fullAI(p) && active2(p)) p.nightOut = chance(w, (p.honesty < 35 ? 0.25 : 0.05) * (lawOn(w, "gece") || curfewAt(w, 23) ? 0.3 : 1) * crimeFactor(w));
  }
  if (h === 6) {
    for (const p of w.people) if (fullAI(p)) p.nightOut = false;
  }
  if (h === 7 || h === 20) resolveArrests(w);
  if (h === 23) nightCrime(w);
}
function shop(w, p) {
  if (p.inv.elbise <= 0 && p.money > 45) buy(w, p.id, "elbise", 1, p.money * 0.4);
  if (p.inv.mobilya <= 0 && p.money > 120 && p.home !== "kisla") buy(w, p.id, "mobilya", 1, p.money * 0.4);
  if (p.inv.alet <= 0 && PRODUCES[p.prof] && p.money > 50) buy(w, p.id, "alet", 1, p.money * 0.4);
  if (p.inv.odun <= 0 && p.money > 10 && chance(w, 0.4)) buy(w, p.id, "odun", 1, p.money * 0.2);
}
function endOfDayLife(w) {
  for (const p of [...w.people]) needsEndOfDay(w, p);
  customLawsDay(w);
  nature(w);
  granaryDay(w);
  outsideWorld(w);
  wealthTax(w);
  switchJobs(w);
  rumorsDay(w);
  achievements(w);
  w.arrests = w.arrests.filter((a) => a.status === "bekliyor" && w.day - a.day <= 1);
  w.offers = w.offers.filter((o) => w.day - o.day <= 2);
  w.talks = w.talks.filter((t) => w.day - t.day <= 0);
  if (w.rumors.length > 30) w.rumors.splice(0, w.rumors.length - 30);
}
var NATURE_TEXT = { kuraklik: "KURAKLIK ba\u015Flad\u0131! \u0130ki hafta boyunca bu\u011Fday az \xE7\u0131kacak, ekmek pahalanacak.", salgin: "SALGIN! Hastal\u0131k yay\u0131l\u0131yor; hekimler \xE7ok \xE7al\u0131\u015Facak.", sel: "SEL bask\u0131n\u0131! Tarlalar ve liman zarar g\xF6rd\xFC.", bereket: "BEREKET y\u0131l\u0131: tarlalar bol \xFCr\xFCn veriyor.", balik: "Denizde bal\u0131k bollu\u011Fu var!" };
function nature(w) {
  const n = w.nature;
  if (n && w.day > n.until) {
    log(w, `${n.kind === "kuraklik" ? "Kurakl\u0131k" : n.kind === "salgin" ? "Salg\u0131n" : n.kind === "sel" ? "Sel" : n.kind === "bereket" ? "Bereket" : "Bal\u0131k bollu\u011Fu"} sona erdi.`);
    w.nature = null;
  }
  if (!w.nature && w.day >= w.nextDrought) {
    w.nature = { kind: "kuraklik", start: w.day, until: w.day + 13 };
    w.nextDrought = w.day + 180;
    log(w, NATURE_TEXT.kuraklik);
  } else if (!w.nature && chance(w, 0.02)) {
    const kind = pick(w, ["salgin", "sel", "bereket", "balik"]);
    w.nature = { kind, start: w.day, until: w.day + (kind === "bereket" ? 7 : kind === "salgin" ? 5 : 3) };
    log(w, NATURE_TEXT[kind]);
  }
  if (w.nature?.kind === "salgin") {
    for (const p of w.people) if (p.prof !== "naip" && chance(w, 0.25)) p.health = clamp(p.health - 12);
  }
}
function granaryBuy(w, qty) {
  let got = 0;
  const offers = w.listings.filter((l) => l.good === "bugday" && l.qty > 0).sort((a, b2) => a.price - b2.price);
  for (const l of offers) while (got < qty && l.qty > 0 && l.price <= BASE_PRICE.bugday * 1.1) {
    if (!transfer(w, "saray", l.sellerId, l.price, "ambar al\u0131m\u0131")) return got;
    const s = findPerson(w, l.sellerId);
    if (s) s.incomeToday += l.price;
    l.qty -= 1;
    got += 1;
    w.granary += 1;
    w.market.sold.bugday += 1;
  }
  return got;
}
function granaryRelease(w, qty) {
  const q = Math.min(Math.floor(w.granary), qty);
  if (q <= 0) return 0;
  w.granary -= q;
  const ex = w.listings.find((l) => l.sellerId === "saray" && l.good === "bugday");
  const price = Math.round(BASE_PRICE.bugday * 2 * 100) / 100;
  if (ex) {
    ex.qty += q;
    ex.price = price;
  } else w.listings.push({ id: nextId(w, "L"), sellerId: "saray", good: "bugday", qty: q, price, market: "ambar" });
  return q;
}
function granaryDay(w) {
  w.granary = Math.max(0, w.granary * 0.99);
  const drought = w.nature?.kind === "kuraklik" || w.nature?.kind === "sel";
  if (drought && w.granary > 0) {
    const q = granaryRelease(w, 40);
    if (q) log(w, `Tah\u0131l ambar\u0131ndan ${q} bu\u011Fday sabit fiyatla sat\u0131\u015Fa \xE7\u0131kt\u0131.`);
  } else if (!drought && w.prices.bugday <= BASE_PRICE.bugday * 0.9 && w.granary < 700 && w.treasury > 2500) granaryBuy(w, 30);
}
function outsideWorld(w) {
  const short = ["ekmek", "bugday", "su"].filter((g) => w.prices[g] > BASE_PRICE[g] * 2.2);
  if (w.caravan && w.day > w.caravan.until) {
    caravanBuys(w, true);
    for (const l of w.listings.filter((x) => x.sellerId === "dis")) l.qty = 0;
    w.listings = w.listings.filter((l) => l.qty > 0);
    w.caravan = null;
  }
  w.shortDays = short.length ? (w.shortDays ?? 0) + 1 : 0;
  if (w.caravan && w.day <= w.caravan.until) caravanBuys(w);
  if (!w.caravan && (short.length && (w.shortDays ?? 0) >= 3 || chance(w, 0.06))) {
    const goods = {};
    for (const g of short.length ? short : ["alet", "elbise", "icki", "yun"]) goods[g] = g === "bugday" ? 200 : g === "su" ? 150 : g === "ekmek" ? 80 : 8;
    w.caravan = { day: w.day, until: w.day + 2, goods, name: pick(w, ["Halep kervan\u0131", "Venedik gemisi", "Ba\u011Fdat kervan\u0131", "Ceneviz t\xFCccarlar\u0131"]) };
    for (const [g, q] of Object.entries(goods)) w.listings.push({ id: nextId(w, "L"), sellerId: "dis", good: g, qty: q, price: Math.round(Math.max(BASE_PRICE[g] * 1.6, w.prices[g] * 1.15) * 100) / 100, market: "liman" });
    log(w, `${w.caravan.name} limana geldi: ${Object.keys(goods).map((g) => GOOD_LABEL[g]).join(", ")} (pahal\u0131ca) sat\u0131yor. Hazine g\xFCmr\xFCk al\u0131r.`);
  }
  if (!w.threat && w.day > 15 && chance(w, 0.025)) {
    const strength2 = 6 + Math.round(rand(w) * 10);
    w.threat = { name: pick(w, ["Da\u011F a\u015Firetleri", "Korsanlar", "Kom\u015Fu bey", "E\u015Fk\u0131ya \xE7etesi"]), demand: 150 + strength2 * 25, day: w.day, deadline: w.day + 2, strength: strength2 };
    log(w, `SINIRDA TEHL\u0130KE: ${w.threat.name} ${w.threat.demand} Dinar hara\xE7 istiyor! \xD6denmezse ${w.threat.deadline}. g\xFCn sald\u0131racaklar.`);
  }
  if (w.threat && w.day >= w.threat.deadline) borderBattle(w);
}
function caravanBuys(w, leaving = false) {
  const c = w.caravan;
  let budget = 60 + (c.earned ?? 0) * 0.9 - (c.spent ?? 0);
  const start = budget;
  for (const g of ["ekmek", "balik", "kumas", "elbise", "mobilya", "alet", "bugday", "yun", "odun", "et", "icki"]) {
    const offers = w.listings.filter((l) => l.good === g && l.sellerId !== "dis" && l.sellerId !== "saray" && l.price <= BASE_PRICE[g] * (leaving ? 3 : 1.3)).sort((a, b2) => a.price - b2.price);
    for (const l of offers) while (l.qty > 0 && budget > l.price) {
      transfer(w, "dis", l.sellerId, l.price, `kervana ${g} sat\u0131\u015F\u0131`);
      const s = findPerson(w, l.sellerId);
      if (s) {
        s.incomeToday += l.price;
        s.taxDue += l.price * w.taxRate / 100;
      }
      l.qty -= 1;
      budget -= l.price;
      w.market.sold[g] += 1;
    }
  }
  c.spent = (c.spent ?? 0) + (start - budget);
}
function armyPower(w) {
  return w.people.filter((p) => p.prof === "asker" && active2(p)).reduce((s, p) => s + 0.5 + p.loyalty / 100 + (p.inv.alet > 0 ? 0.2 : 0), 0);
}
function payTribute(w) {
  const t = w.threat;
  if (!t) return "Hara\xE7 isteyen yok.";
  if (!transfer(w, "saray", "dis", t.demand, "hara\xE7")) return "Hazine haraca yetmiyor!";
  for (const p of w.people) if (p.prof === "asker") p.loyalty = clamp(p.loyalty - 3);
  log(w, `${t.name}'a ${t.demand} Dinar hara\xE7 \xF6dendi. Ordu bu a\u015Fa\u011F\u0131lanmadan ho\u015Fnut de\u011Fil.`);
  w.threat = null;
  return "Hara\xE7 \xF6dendi.";
}
function borderBattle(w) {
  const t = w.threat;
  if (!t) return;
  w.threat = null;
  const ours = armyPower(w) * (0.8 + rand(w) * 0.4);
  if (ours >= t.strength) {
    const loot = Math.round(t.demand * 0.6);
    transfer(w, "dis", "saray", loot, "ganimet");
    for (const p of w.people) {
      if (p.prof === "asker") {
        p.loyalty = clamp(p.loyalty + 6);
        p.xp += 3;
      }
      p.mood = clamp(p.mood + 2);
    }
    log(w, `ZAFER! Ordu ${t.name}'n\u0131 p\xFCsk\xFCrtt\xFC; ${loot} Dinar ganimet hazineye girdi.`);
  } else {
    const loss = Math.min(w.treasury, t.demand * 1.5);
    transfer(w, "saray", "dis", loss, "ya\u011Fma");
    const dead = w.people.filter((p) => p.prof === "asker" && !p.playerId).slice(0, 2);
    for (const p of dead) die(w, p, `Asker ${p.name} s\u0131n\u0131rda \u015Fehit d\xFC\u015Ft\xFC.`);
    for (const p of w.people) {
      p.mood = clamp(p.mood - 5);
      p.loyalty = clamp(p.loyalty - 4);
    }
    log(w, `YEN\u0130LG\u0130! ${t.name} \u015Fehri ya\u011Fmalad\u0131: hazineden ${Math.round(loss)} Dinar gitti.`);
  }
}
function collectTaxes(w) {
  const ts = w.people.filter((p) => p.prof === "tahsildar" && active2(p));
  for (const p of w.people) {
    if (p.taxDue < 0.5) continue;
    const t = ts.length ? pick(w, ts) : null;
    if (t && fullAI(p) && p.honesty < 40 && p.taxDue > 6 && chance(w, 0.4)) {
      const bribe = Math.round(p.taxDue * 0.4 * 100) / 100;
      if (t.honesty < 55 && chance(w, (100 - t.loyalty) / 100 + 0.2) && transfer(w, p.id, t.id, bribe, "r\xFC\u015Fvet")) {
        p.taxDue = 0;
        t.incomeToday += bribe;
        if (chance(w, 0.15)) rumor(w, `${t.name} vergi toplarken r\xFC\u015Fvet al\u0131yormu\u015F.`, t.id, -6);
        continue;
      }
    }
    const pay = Math.min(p.money, p.taxDue * (t ? 1 : 0.8));
    if (transfer(w, p.id, "saray", pay, "sat\u0131\u015F vergisi")) p.taxDue = Math.max(0, p.taxDue - pay / (t ? 1 : 0.8));
    if (t) t.xp += 0.05;
  }
  for (const p of w.people.filter((x) => x.smuggle && active2(x))) if (chance(w, 0.12)) arrest(w, p, "kacakcilik", null, 20);
}
function karaborsa(w) {
  for (const l of w.listings.filter((x) => w.bans.includes(x.good) && x.sellerId !== "dis")) l.qty = 0;
}
function wealthTax(w) {
  if (!lawOn(w, "servet")) return;
  const th = wealthThreshold(w);
  for (const p of w.people) if (p.money > th && p.id !== w.kayzerId) transfer(w, p.id, "saray", Math.min(25, (p.money - th) * 0.02), "servet vergisi");
}
var STAPLE_PROFS = ["ciftci", "firinci", "sucu", "kasap", "balikci"];
function switchJobs(w) {
  const count = (prof) => w.people.filter((x) => x.prof === prof).length;
  for (const p of [...w.people].sort(() => rand(w) - 0.5)) {
    const idleHamal = p.prof === "hamal" && p.money < 30;
    const own = PRODUCES[p.prof]?.good;
    const glut = !!own && w.listings.filter((l) => l.good === own).reduce((s, l) => s + l.qty, 0) > w.market.sold[own] * 1.5 + 10;
    if (!fullAI(p) || !PRODUCES[p.prof] && !idleHamal || !idleHamal && (p.unemployedDays < 6 || p.money > 60 || STAPLE_PROFS.includes(p.prof) && !glut)) continue;
    const g = PRODUCES[p.prof]?.good;
    const best = Object.entries(PRODUCES).filter(([prof]) => count(prof) < 14 && (!idleHamal || STAPLE_PROFS.includes(prof))).map(([prof, r]) => ({ prof, need: w.market.unmet[r.good] * BASE_PRICE[r.good] * (STAPLE_PROFS.includes(prof) ? 3 : 1) })).sort((a, b2) => b2.need - a.need)[0];
    if (best && best.prof !== p.prof && best.need > 20 && (!g || w.market.unmet[g] === 0)) {
      const old = PROF_LABEL[p.prof];
      p.prof = best.prof;
      p.work = WORKPLACE[best.prof];
      p.xp = 0;
      p.unemployedDays = 0;
      log(w, `${p.name} ${old} i\u015Fini b\u0131rakt\u0131, ${PROF_LABEL[best.prof]} oldu (orada talep var).`, p.id);
      return;
    }
  }
  const busy = w.projects.some((x) => !x.done && x.paid >= 6);
  for (const p of w.people.filter((x) => x.prof === "insaatci")) {
    p.work = busy ? "santiye" : "pazar";
    if (!busy) p.lastAction = "i\u015F ar\u0131yor (hamall\u0131k)";
  }
}
var isProtected = (w, p) => p.protectedUntil >= w.day || p.id === w.kayzerId || p.prof === "naip";
function catcher(w, night) {
  const pool = w.people.filter((x) => (x.prof === "bekci" || night && x.prof === "asker") && active2(x));
  const power = Math.min(0.85, 0.1 + pool.filter((x) => x.prof === "bekci").length * 0.08 + (night ? 0.05 : 0.15));
  return pool.length && chance(w, power) ? pick(w, pool) : void 0;
}
function arrest(w, criminal, crime, victimId, amount, by) {
  const c = by ?? catcher(w, w.hour >= 21 || w.hour < 6) ?? w.people.find((x) => x.prof === "bekci" && active2(x));
  if (!c) return null;
  const a = { id: nextId(w, "A"), criminalId: criminal.id, catcherId: c.id, crime, victimId, amount, day: w.day, hour: w.hour, offer: 0, status: "bekliyor" };
  w.arrests.push(a);
  criminal.jailedDays = Math.max(criminal.jailedDays, 1);
  log(w, `${c.name}, ${criminal.name}'\u0131 yakalad\u0131 (${CRIME_TEXT[crime]}). Sabah/ak\u015Fam ya h\xE2kime gidecek ya da\u2026`, criminal.id);
  if (criminal.playerId) personal(w, criminal.playerId, "Yakaland\u0131n\u0131z! Bek\xE7iye r\xFC\u015Fvet teklif edebilirsiniz (Zindan \u2192 Tutuklama).");
  return a;
}
var CRIME_TEXT = { hirsizlik: "h\u0131rs\u0131zl\u0131k", rusvet: "r\xFC\u015Fvet", zimmet: "zimmet", isyan: "isyan", saldiri: "sald\u0131r\u0131", cinayet: "cinayet", kacakcilik: "ka\xE7ak\xE7\u0131l\u0131k" };
function bribeAcceptChance(catcher2, offer) {
  return clamp((100 - catcher2.loyalty) * 0.6 + (60 - catcher2.honesty) * 0.4 + Math.min(40, offer), 0, 95) / 100;
}
function decideBribe(w, a, accept) {
  const cr = findPerson(w, a.criminalId);
  const ca = findPerson(w, a.catcherId);
  if (!cr || !ca) {
    a.status = "ret";
    return "Ki\u015Fi yok.";
  }
  if (accept && a.offer > 0 && transfer(w, cr.id, ca.id, a.offer, "r\xFC\u015Fvet")) {
    a.status = "kabul";
    cr.jailedDays = 0;
    ca.incomeToday += a.offer;
    rel(cr, ca, 10, "r\xFC\u015Fvetimi ald\u0131, beni sald\u0131");
    if (chance(w, 0.2)) rumor(w, `${ca.name} yakalad\u0131\u011F\u0131 ${cr.name}'\u0131 r\xFC\u015Fvetle salm\u0131\u015F!`, ca.id, -10);
    return `${ca.name} ${a.offer} Dinar'\u0131 ald\u0131 ve ${cr.name}'\u0131 sald\u0131.`;
  }
  a.status = "ret";
  openCase(w, cr.id, a.crime, a.victimId, a.amount, a.crime === "cinayet" ? 90 : 70);
  rel(cr, ca, -15, "beni tutuklad\u0131");
  if (a.offer > 0) {
    openCase(w, cr.id, "rusvet", null, a.offer, 80);
    ca.rep = clamp(ca.rep + 3, -100, 100);
    rumor(w, `${ca.name} r\xFC\u015Fveti reddetti, ${cr.name}'\u0131 kad\u0131ya teslim etti.`, ca.id, 5);
  }
  return `${ca.name} r\xFC\u015Fveti reddetti; ${cr.name} kad\u0131n\u0131n \xF6n\xFCne \xE7\u0131kacak.`;
}
function resolveArrests(w) {
  for (const a of w.arrests.filter((x) => x.status === "bekliyor")) {
    const cr = findPerson(w, a.criminalId);
    const ca = findPerson(w, a.catcherId);
    if (!cr || !ca) {
      a.status = "ret";
      continue;
    }
    if (cr.playerId && !cr.npc && a.offer === 0 && w.day === a.day && w.hour <= a.hour + 13) continue;
    if (fullAI(cr) && a.offer === 0 && cr.honesty < 65 && cr.money > 12) a.offer = Math.round(Math.min(cr.money * 0.4, 10 + a.amount * 0.5));
    if (!fullAI(ca) && w.day === a.day) continue;
    decideBribe(w, a, a.offer > 0 && rand(w) < bribeAcceptChance(ca, a.offer));
  }
}
function steal(w, thief, victim) {
  if (isProtected(w, victim)) return 0;
  const amt = Math.min(Math.round(victim.money * 0.15), 30);
  if (amt <= 0) return 0;
  transfer(w, victim.id, thief.id, amt, "h\u0131rs\u0131zl\u0131k");
  victim.mood = clamp(victim.mood - 10);
  rel(victim, thief, -50, "beni soydu");
  thief.lastAction = "h\u0131rs\u0131zl\u0131k";
  log(w, `${victim.name} soyuldu (${amt} Dinar).`, victim.id);
  if (catcher(w, w.hour >= 21 || w.hour < 6)) arrest(w, thief, "hirsizlik", victim.id, amt);
  return amt;
}
function assault(w, a, v) {
  if (isProtected(w, v)) return `${v.name} \u015Fehre yeni geldi; ona dokunulmaz (koruma s\xFCresi).`;
  v.health = clamp(v.health - 35);
  v.wounded = true;
  v.mood = clamp(v.mood - 10);
  rel(v, a, -60, "beni d\xF6vd\xFC");
  for (const x of w.people) if (x.relations[v.id] && (x.relations[v.id] ?? 0) > 40) rel(x, a, -20, `${v.name}'\u0131 d\xF6vd\xFC`);
  log(w, `${a.name}, ${v.name}'a sald\u0131rd\u0131 ve yaralad\u0131! Yaral\u0131 hekime gitmeli.`, v.id);
  if (catcher(w, w.hour >= 21 || w.hour < 6)) arrest(w, a, "saldiri", v.id, 0);
  return `${v.name}'\u0131 yaralad\u0131n\u0131z.`;
}
function murder(w, a, v) {
  if (isProtected(w, v)) return `${v.name}'a dokunulmaz.`;
  if (v.playerId || v.prof === "asker" && chance(w, 0.7)) {
    v.health = 5;
    v.wounded = true;
    log(w, `${a.name}, ${v.name}'\u0131 \xF6ld\xFCrmeye kalkt\u0131; a\u011F\u0131r yaral\u0131 kurtuldu!`, v.id);
    arrest(w, a, "cinayet", v.id, 0);
    return `${v.name} a\u011F\u0131r yaral\u0131 kurtuldu.`;
  }
  for (const x of w.people) if ((x.relations[v.id] ?? 0) > 20) rel(x, a, -70, `${v.name}'\u0131 \xF6ld\xFCrd\xFC`);
  die(w, v, `C\u0130NAYET! ${v.name} \xF6ld\xFCr\xFCld\xFC. Katil aran\u0131yor\u2026`);
  if (chance(w, 0.75)) arrest(w, a, "cinayet", null, 0);
  return "Cinayet i\u015Flediniz\u2026";
}
function nightCrime(w) {
  const out = w.people.filter((p) => p.nightOut && fullAI(p) && active2(p));
  for (const p of out) {
    const foes = Object.entries(p.relations).filter(([, v]) => v < -60).map(([id]) => findPerson(w, id)).filter((x) => !!x && active2(x));
    if (p.honesty < 30 && p.money < 15 && chance(w, 0.35)) {
      const vs = w.people.filter((v) => v.money > 60 && v.id !== p.id && !isProtected(w, v));
      if (vs.length) steal(w, p, pick(w, vs));
    } else if (foes.length && p.honesty < 40 && chance(w, 0.15)) {
      const v = pick(w, foes);
      if (p.honesty < 12 && (p.relations[v.id] ?? 0) < -90 && chance(w, 0.15)) murder(w, p, v);
      else assault(w, p, v);
    } else if ((lawOn(w, "gece") || curfewAt(w, w.hour)) && chance(w, 0.3)) {
      transfer(w, p.id, "saray", Math.min(3, p.money), "gece yasa\u011F\u0131 cezas\u0131");
      p.nightOut = false;
    }
  }
}
function rumor(w, text, about, delta) {
  w.rumors.push({ day: w.day, text, about });
  const p = findPerson(w, about);
  if (p) p.rep = clamp(p.rep + delta, -100, 100);
}
function rumorsDay(w) {
  for (const r of w.rumors.filter((x) => x.day === w.day)) {
    const about = findPerson(w, r.about);
    if (!about) continue;
    for (let i = 0; i < 6; i += 1) {
      const x = pick(w, w.people);
      if (x.id !== about.id) x.relations[about.id] = clamp((x.relations[about.id] ?? 0) + (about.rep >= 0 ? 2 : -3), -100, 100);
    }
  }
  if (w.day % 3 === 0) for (const p of w.people) {
    const g = PRODUCES[p.prof]?.good;
    if (!g) continue;
    const rival = w.people.find((x) => x !== p && x.prof === p.prof && chance(w, 0.3));
    if (rival) rel(p, rival, -1, "ayn\u0131 i\u015Fi yap\u0131yoruz, rakibim");
  }
}
var TITLES = [
  ["Zengin", (_w, p) => p.money >= 1e3],
  ["Hay\u0131rsever", (_w, p) => p.rep >= 40],
  ["Dindar", (_w, p) => p.din >= 90],
  ["Usta", (_w, p) => p.xp >= 60],
  ["Evli", (_w, p) => !!p.spouse],
  ["Halk\u0131n Sevgilisi", (w, p) => w.people.filter((x) => (x.relations[p.id] ?? 0) > 40).length >= 8],
  ["Meclis \xDCyesi", (_w, p) => p.meclis],
  ["K\u0131demli", (w, p) => w.day - (w.players[p.playerId ?? ""]?.lastSeenDay ?? w.day) >= 0 && p.xp >= 30],
  ["K\xF6t\xFC \u015E\xF6hretli", (_w, p) => p.rep <= -40]
];
function achievements(w) {
  for (const p of w.people) {
    if (!p.playerId) continue;
    for (const [t, f] of TITLES) if (!p.titles.includes(t) && f(w, p)) {
      p.titles.push(t);
      log(w, `\u{1F3C5} ${p.name} \u201C${t}\u201D unvan\u0131n\u0131 kazand\u0131!`, p.id);
    }
  }
}
var QUESTS = [
  { text: "Bir \xF6\u011F\xFCn yiyin (\u26A1 Ne yapabilirim \u2192 Ye)", done: (_w, p) => p.meals >= 1 },
  { text: "Su i\xE7in (g\xFCnde 5 su gerekir)", done: (_w, p) => p.drinks >= 1 },
  { text: "Pazardan bir \u015Fey al\u0131n (Pazar binas\u0131na dokunun)", done: (w, p) => w.ledger.some((l) => l.from === p.id && l.reason.endsWith("al\u0131m\u0131")) },
  { text: "Camide namaz k\u0131l\u0131n ya da meyhanede bir kadeh i\xE7in", done: (_w, p) => p.lastAction.includes("namaz") || p.lastAction.includes("i\xE7ti") },
  { text: "Bir vatanda\u015Fla sohbet edin (birine dokunun \u2192 Sohbet)", done: (_w, p) => Object.values(p.relNote).some((x) => x.includes("sohbet")) },
  { text: "Saraya bir dilek\xE7e yaz\u0131n (Saray binas\u0131)", done: (w, p) => w.petitions.some((x) => x.fromId === p.id) },
  { text: "Meclis se\xE7iminde aday olun ya da oy verin (Meclis binas\u0131)", done: (w, p) => w.election.candidates.includes(p.id) || !!w.election.votes[p.id] || p.meclis }
];
function questReward(w, playerId) {
  const pl = w.players[playerId];
  const p = findPerson(w, pl?.personId);
  if (!pl || !p) return null;
  const i = pl.quest ?? 0;
  const q = QUESTS[i];
  if (!q || !q.done(w, p)) return null;
  pl.quest = i + 1;
  p.xp += 2;
  transfer(w, "saray", p.id, 3, "rehber \xF6d\xFCl\xFC");
  return `G\xF6rev tamam: ${q.text}. \xD6d\xFCl: 3 Dinar.${QUESTS[i + 1] ? ` S\u0131radaki: ${QUESTS[i + 1].text}` : " Rehber bitti \u2014 art\u0131k \u015Fehir sizin!"}`;
}
function hamalWork(w) {
  const proj = w.projects.find((x) => !x.done && x.paid >= 3);
  const sellers = w.people.filter((s) => s.id !== "x" && w.listings.some((l) => l.sellerId === s.id && l.qty >= 15) && s.money > 15);
  for (const h of w.people.filter((x) => x.prof === "hamal" && active2(x))) {
    if (h.playerId && !h.npc) continue;
    if (proj && chance(w, 0.6) && transfer(w, `proje:${proj.id}`, h.id, 3, "y\xFCk ta\u015F\u0131ma (in\u015Faat)")) {
      proj.progress = Math.min(proj.needed, proj.progress + 1);
      h.incomeToday += 3;
      h.work = proj.plot ?? proj.site;
      h.lastAction = `${proj.name} i\xE7in ta\u015F ta\u015F\u0131yor`;
      h.xp += 1;
      continue;
    }
    h.work = "pazar";
    const s = sellers.length ? pick(w, sellers) : void 0;
    if (s && transfer(w, s.id, h.id, 2, "hamaliye (pazar ta\u015F\u0131ma)")) {
      h.incomeToday += 2;
      h.lastAction = `${s.name}'\u0131n mallar\u0131n\u0131 ta\u015F\u0131yor`;
      h.xp += 1;
      h.relations[s.id] = clamp((h.relations[s.id] ?? 0) + 1, -100, 100);
    }
  }
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
  if (p.meals < 2 && p.inv.ekmek === 0 && lawOn(w, "askida")) {
    const sponsor = w.people.find((x) => x.inv.ekmek > 3 && x.money > 200 && x.id !== p.id && x.prof !== "firinci");
    if (sponsor) {
      sponsor.inv.ekmek -= 1;
      p.inv.ekmek += 1;
    }
  }
  void buy;
  void chance;
}
function spendSurplus(w, p) {
  if (p.prof === "naip" || p.id === w.kayzerId || p.jailedDays > 0 || p.money <= 120) return;
  let budget = (p.money - 120) * 0.12;
  for (const g of ["et", "balik", "icki"]) {
    if (budget <= 0) break;
    const pr = w.prices[g];
    if (pr <= budget * 0.5 && pr < BASE_PRICE[g] * 2) {
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
  const hungry = p.meals < 3 || p.drinks < 5 || p.hunger > 60;
  if (hungry) {
    p.mood -= 3;
    p.republic += 1.2;
    p.loyalty -= 1;
  } else {
    p.mood += 0.6;
  }
  if (p.din > 70 && w.regime === "imparatorluk") {
    p.loyalty += 0.2;
    p.republic -= 0.2;
  }
  if (p.din < 25) p.republic += 0.15;
  if (w.bans.includes("icki") && p.din < 35) p.loyalty -= 0.4;
  const avgMoney = w.people.reduce((s, x) => s + x.money, 0) / w.people.length;
  const poor = isPoor(w, p, avgMoney);
  if (poor) {
    p.mood -= 1.2;
    p.republic += 0.9;
  }
  if (chance(w, 0.02)) {
    p.health -= 25;
    p.mood -= 5;
  }
  const breadPrice = marketPrice(w, "ekmek");
  if (breadPrice > 5) p.mood -= 1.5;
  if (w.taxRate > 10) {
    p.loyalty -= (w.taxRate - 10) * 0.12;
    p.mood -= (w.taxRate - 10) * 0.05;
  }
  if (w.taxRate > 18) p.loyalty -= 0.4;
  if (p.loyalty < 30 && (poor || hungry || p.money < 15)) p.republic += (30 - p.loyalty) * 0.05;
  if (w.taxRate < 10) {
    p.loyalty += 0.3;
  }
  if (p.money < 5) p.mood -= 2;
  if (p.money > 300) p.mood += 0.5;
  if (p.unemployedDays > 2) p.mood -= 3;
  if (p.spouse) p.mood += 0.7;
  p.mood += (60 - p.mood) * 0.05;
  p.loyalty += (p.mood - 50) * 0.01 + (55 - p.loyalty) * 0.02;
  if (!poor && !hungry && p.plotting !== "revolution") p.republic -= 0.5;
  if (p.loyalty > 75 && p.plotting !== "revolution") p.republic -= 0.4;
  if (w.headAwayDays > 3 && w.regime === "imparatorluk") {
    p.loyalty -= 1.2;
    p.mood -= 0.3;
    p.republic += 0.8;
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
  if (p.money < 8 && p.meals < 3 && p.honesty < 55 && chance(w, (60 - p.honesty) / 200)) {
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
    const rel2 = (p.relations[other.id] ?? 0) + (rand(w) < 0.7 ? 4 : -6);
    p.relations[other.id] = clamp(rel2, -100, 100);
    if (p.republic > 60 && other.republic < p.republic) other.republic = clamp(other.republic + (other.hunger > 60 || other.money < 10 ? 2 : 0.3));
    else if (p.loyalty > 70 && other.republic > 10) other.republic = clamp(other.republic - 0.3);
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
var CRIME_LABEL = { hirsizlik: "H\u0131rs\u0131zl\u0131k", rusvet: "R\xFC\u015Fvet", zimmet: "Zimmet", isyan: "\u0130syan", saldiri: "Sald\u0131r\u0131", cinayet: "Cinayet", kacakcilik: "Ka\xE7ak\xE7\u0131l\u0131k" };

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
  return { seats: SEATS.map((s) => ({ ...s, holder: null })), factions: FACTIONS.map((f) => ({ ...f })), bills: [], log: [], bribes: [], salary: 6 };
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
        const sc = (v.relations[c] ?? 0) - Math.abs(v.republic - cp.republic) - Math.abs(v.loyalty - cp.loyalty) * 0.3 - Math.abs(v.din - cp.din) * 0.2 + (w.election.posters?.[c] ?? 0) * 3 + cp.rep * 0.2 + rand(w) * 30 + (c === v.id ? 50 : 0);
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
function validateBill(w, kind, value, target, law) {
  switch (kind) {
    case "ozel":
      return law ? validateLaw(law) : "Kanun metni yok.";
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
function billTitle(w, kind, value, target, law) {
  const who = findPerson(w, target)?.name ?? "";
  switch (kind) {
    case "ozel":
      return law ? law.name?.trim() || lawTitle(law) : "\xD6zel kanun";
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
function propose(w, proposer, kind, value, target, title, law) {
  if (!proposer.meclis) return "Sadece Meclis \xFCyeleri kanun teklif edebilir.";
  if (kind === "azil") target = w.kayzerId ?? "";
  const err = validateBill(w, kind, value, target, law);
  if (err) return err;
  if (w.meclis.bills.filter((b2) => b2.status === "tartisma" || b2.status === "oylama").length >= 6) return "Meclis g\xFCndemi dolu.";
  if (w.meclis.bills.some((b2) => b2.proposerId === proposer.id && (b2.status === "tartisma" || b2.status === "oylama"))) return "G\xF6r\xFC\u015F\xFClen bir teklifiniz zaten var.";
  const bill = {
    id: nextId(w, "B"),
    kind,
    value,
    target,
    title: title?.slice(0, 60) || billTitle(w, kind, value, target, law),
    law,
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
    case "ozel":
      s = lawStance(w, p, f, b2.law);
      break;
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
    case "ozel":
      if (b2.law) enactLaw(w, b2.law, findPerson(w, b2.proposerId) ?? null, "meclis");
      break;
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
function lawStance(w, p, f, l) {
  if (!l) return -1;
  const PRODUCER2 = { ciftci: "bugday", firinci: "ekmek", sucu: "su", kasap: "et", balikci: "balik", dokumaci: "kumas", terzi: "elbise", marangoz: "odun", mobilyaci: "mobilya", demirci: "alet", barci: "icki" };
  const mine = l.good && PRODUCER2[p.prof] === l.good;
  switch (l.kind) {
    case "satisVergisi":
      return (w.taxRate - l.value) / 8 + (f === "saltanatci" ? 0.2 : f === "esnaf" ? -0.3 : 0);
    case "basVergisi":
      return (w.headTax - l.value) / 2 + (f === "halkci" ? -0.3 : 0);
    case "malVergisi":
      return (mine ? -1 : -0.2) + (f === "saltanatci" ? 0.3 : 0);
    case "narh":
      return mine ? -0.9 : f === "halkci" ? 0.6 : f === "esnaf" ? -0.6 : 0.1;
    case "yasak":
      return l.good === "icki" ? (p.din - 50) / 40 : ["ekmek", "su", "bugday"].includes(l.good ?? "") ? -1 : mine ? -1 : -0.2;
    case "sokak":
      return f === "saltanatci" ? 0.4 : f === "cumhuriyetci" ? -0.7 : -0.1;
    case "hizmet":
      return f === "saltanatci" ? 0.3 : f === "halkci" ? -0.6 : -0.2;
    case "destek":
      return mine ? 1 : f === "halkci" ? 0.4 : f === "esnaf" ? 0.3 : 0;
    case "servetEsigi":
      return p.money > l.value ? -0.8 : f === "halkci" ? 0.6 : 0;
    case "sertCeza":
      return f === "saltanatci" ? 0.6 : f === "cumhuriyetci" ? -0.6 : p.honesty < 35 ? -0.8 : 0.1;
  }
  return 0;
}

// src/sim/world.ts
function b(id, name, kind, x, y, w, h, market = false) {
  return { id, name, kind, x, y, w, h, door: { x: x + Math.floor(w / 2), y: y + h }, market };
}
var ROADS_Y = [13, 20, 29, 35, 44];
var ROADS_X = [6, 17, 29, 44, 56, 68, 80, 92];
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
    b("liman", "Liman / Bal\u0131khane", "liman", 30, 45, 12, 3),
    b("bar", "Meyhane (Bar)", "bar", 58, 15, 7, 4, true),
    b("festival", "Festival Alan\u0131", "festival", 70, 3, 9, 8),
    b("ciftlik", "Bu\u011Fday Tarlalar\u0131", "ciftlik", 82, 36, 14, 10),
    b("dokuma", "Dokuma Tezg\xE2h\u0131", "dokuma", 70, 30, 8, 4),
    b("mobilyahane", "Mobilyahane", "mobilyahane", 82, 22, 8, 5),
    b("ambar", "Tah\u0131l Ambar\u0131", "ambar", 70, 22, 8, 5),
    b("arsa1", "Arsa (bo\u015F)", "arsa", 82, 3, 8, 6),
    b("arsa2", "Arsa (bo\u015F)", "arsa", 93, 3, 6, 6),
    b("arsa3", "Arsa (bo\u015F)", "arsa", 93, 22, 6, 5),
    b("arsa4", "Arsa (bo\u015F)", "arsa", 46, 37, 8, 5)
  ];
  const occupied = (x, y, w, h) => list.some((o) => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y) || ROADS_Y.some((ry) => ry >= y && ry < y + h + 1) || ROADS_X.some((rx) => rx >= x && rx < x + w);
  let n = 0;
  for (let y = 30; y <= 46; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3) && x + 3 < MAP_W && y + 3 < MAP_H - 6 && n < 70) {
        n += 1;
        list.push(b(`ev${n}`, `Ev ${n}`, "ev", x, y, 3, 3));
      }
    }
  }
  for (let y = 14; y <= 26; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3) && n < 90) {
        n += 1;
        list.push(b(`ev${n}`, `Ev ${n}`, "ev", x, y, 3, 3));
      }
    }
  }
  return list;
}
var ERKEK2 = ["Ahmet", "Mehmet", "Mustafa", "Ali", "Hasan", "H\xFCseyin", "\u0130brahim", "Osman", "Yusuf", "Murat", "Kemal", "\xD6mer", "Halil", "Recep", "Ramazan", "Selim", "Kadir", "Orhan", "R\u0131za", "Fikret", "Sinan", "Levent", "Yavuz", "Cengiz", "Tuncay", "Serkan", "G\xF6khan", "Volkan", "Kerem", "B\xFClent", "Ferhat", "Erdem", "Do\u011Fan", "Haydar", "\u0130smail", "Faruk", "Nuri", "\u015E\xFCkr\xFC", "Cevdet", "Adem"];
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
  { name: "Kalem\u015F\xF6r Necati", prof: "kalemsor", female: false, honesty: 40, ambition: 75, money: 110, loyalty: 30 },
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
  ["ciftci", 5],
  ["firinci", 5],
  ["sucu", 8],
  ["kasap", 4],
  ["balikci", 6],
  ["dokumaci", 3],
  ["terzi", 3],
  ["demirci", 3],
  ["marangoz", 4],
  ["mobilyaci", 2],
  ["barci", 2],
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
  ciftci: "ciftlik",
  dokumaci: "dokuma",
  mobilyaci: "mobilyahane",
  barci: "bar",
  memur: "saray",
  tahsildar: "kahve",
  bekci: "zindan",
  savci: "mahkeme",
  hakim: "mahkeme",
  asker: "kisla",
  kayzer: "saray",
  naip: "saray"
};
var TITLE = { ciftci: "\xC7ift\xE7i", barci: "Barc\u0131", asker: "Asker", bekci: "Bek\xE7i", hoca: "\xD6\u011Fretmen", hekim: "Hekim", savci: "Savc\u0131", hakim: "Kad\u0131", tuccar: "T\xFCccar", hamal: "Hamal", firinci: "F\u0131r\u0131nc\u0131", kalemsor: "Kalem\u015F\xF6r" };
function emptyInv() {
  const r = {};
  for (const g of GOODS) r[g] = 0;
  return r;
}
function genderOfName(name) {
  for (const part of name.replace(/[().]/g, " ").split(/\s+/)) {
    if (KADIN.includes(part) || ["Han\u0131m", "Sultan", "Ay\u015Fe", "Zehra", "Nur", "Nimet", "Defne", "Ece", "Asya", "Nehir", "Lale", "Su", "Ada", "Selin", "Duru", "\u0130pek"].includes(part)) return true;
    if (ERKEK2.includes(part) || ["Cemal", "Bekir", "Can", "Burak", "Emre", "Tar\u0131k", "S\xFCleyman", "Necati", "Abdullah", "R\u0131fat", "Lokman", "Hayri", "R\xFCstem", "Dursun", "Kaz\u0131m", "\u015Eevket", "Nazmi", "A\u011Fa", "Efendi", "Kerem", "Emir", "Yi\u011Fit", "Alp", "Aras", "Batu", "Efe", "Mert", "Kaan", "Tuna", "O\u011Fuz", "\u015Eehzade"].includes(part)) return false;
  }
  return void 0;
}
function makePerson(w, s, home) {
  const female = s.female ?? genderOfName(s.name) ?? (s.prof === "asker" ? false : rand(w) < 0.4);
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
    exiledDays: 0,
    din: s.prof === "imam" || s.prof === "hoca" ? randInt(w, 70, 95) : randInt(w, 15, 85),
    meals: 0,
    drinks: 0,
    wounded: false,
    protectedUntil: 0,
    xp: randInt(w, 0, 80),
    rep: 0,
    relNote: {},
    titles: [],
    taxDue: 0,
    smuggle: false,
    nightOut: false
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
    { id: "ickiyasak", name: "\u0130\xE7ki Yasa\u011F\u0131", desc: "Meyhane kapan\u0131r; i\xE7ki satmak karaborsad\u0131r. Dindarlar memnun, sek\xFCler halk k\u0131zg\u0131n.", active: false },
    { id: "gece", name: "Gece Soka\u011Fa \xC7\u0131kma Yasa\u011F\u0131", desc: "Geceleri soka\u011Fa \xE7\u0131kan bek\xE7iye yakalan\u0131r; gece su\xE7lar\u0131 azal\u0131r, mutluluk biraz d\xFC\u015Fer.", active: false },
    { id: "servet", name: "Servet Vergisi", desc: "Kesesinde 500 Dinar \xFCst\xFC olanlardan fazlan\u0131n %2\u2019si her g\xFCn hazineye; e\u015Fitsizli\u011Fi azalt\u0131r.", active: true },
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
    taxRate: 10,
    headTax: 1.75,
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
    schema: 3,
    speed: 1,
    nature: null,
    nextDrought: 60,
    festivalUntil: 0,
    granary: 800,
    priceCaps: {},
    arrests: [],
    chatOut: [],
    talks: [],
    offers: [],
    rumors: [],
    caravan: null,
    threat: null,
    bans: [],
    loans: [],
    outsideNet: 0,
    customLaws: [],
    suspicion: {},
    treasuryBook: [],
    priceHist: {},
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
  kayzer.female = false;
  kayzer.din = 50;
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
        const first = pick(w, female ? KADIN : ERKEK2);
        name = TITLE[prof] ? `${TITLE[prof]} ${first}` : first;
        if (!usedNames.has(name)) break;
        name = `${name} ${String.fromCharCode(65 + randInt(w, 0, 25))}.`;
      }
      usedNames.add(name);
      w.people.push(makePerson(w, { name, prof, female }, prof === "asker" ? "kisla" : nextHome()));
    }
  }
  while (w.people.length < 112) {
    const prof = pick(w, ["hamal", "ciftci", "ciftci", "sucu", "balikci", "insaatci", "dokumaci", "kasap"]);
    const female = rand(w) < 0.5;
    const name = `${pick(w, female ? KADIN : ERKEK2)} ${pick(w, female ? ["Han\u0131m", "Usta", "Kalfa"] : ["Usta", "Efendi", "A\u011Fa", "Kalfa"])}`;
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
    const book = w.treasuryBook ??= [];
    let d = book[book.length - 1];
    if (!d || d.day !== w.day) {
      d = { day: w.day, items: {} };
      book.push(d);
      if (book.length > 10) book.shift();
    }
    const key = `${to === "saray" ? "+" : "-"}${reason.replace(/[\d.,]+/g, "").replace(/\s+/g, " ").trim()}`;
    d.items[key] = Math.round(((d.items[key] ?? 0) + amt) * 100) / 100;
  }
  w.ledger.push({ day: w.day, from, to, amount: amt, reason });
  if (w.ledger.length > 600) w.ledger.splice(0, w.ledger.length - 600);
  return true;
}
function balance(w, acc) {
  if (acc === "saray") return w.treasury;
  if (acc === "fon") return w.coup?.fund ?? 0;
  if (acc === "dis") return Infinity;
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
  if (acc === "dis") {
    w.outsideNet = r((w.outsideNet ?? 0) + d);
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
  if (g === "su" && lawOn(w, "devletsuyu")) return Math.min(w.prices.su, lawParam(w, "devletsuyu", 2));
  const cap = w.priceCaps[g];
  return cap ? Math.min(cap, w.prices[g]) : w.prices[g];
}
var rankOf = (p) => [...RANKS].reverse().find((r) => p.xp >= r.xp);
var listedQty = (w, sellerId, g) => w.listings.filter((l) => l.sellerId === sellerId && l.good === g).reduce((s, l) => s + l.qty, 0);
function addListing(w, seller, good, qty, price, market) {
  const room = Math.max(0, STOCK_LIMIT[good] - listedQty(w, seller.id, good));
  if (qty > room) {
    seller.inv[good] += qty - room;
    qty = room;
  }
  if (qty <= 0) return;
  const cap = w.priceCaps[good];
  if (cap && price > cap) price = cap;
  price = Math.max(0.1, price);
  const ex = w.listings.find((l) => l.sellerId === seller.id && l.good === good && Math.abs(l.price - price) < 0.01);
  if (ex) {
    ex.qty += qty;
    return;
  }
  w.listings.push({ id: nextId(w, "L"), sellerId: seller.id, good, qty, price: Math.round(price * 100) / 100, market });
}
function buy(w, buyerAcc, good, qty, maxPrice = Infinity) {
  let got = 0;
  const offers = w.listings.filter((l) => l.good === good && l.qty > 0 && l.sellerId !== buyerAcc && !(w.bans.includes(good) && l.sellerId !== "dis")).sort((a, b2) => a.price - b2.price);
  const fixedWater = good === "su" && lawOn(w, "devletsuyu");
  for (const l of offers) {
    while (got < qty && l.qty > 0) {
      const pay = Math.round((fixedWater ? Math.min(l.price, lawParam(w, "devletsuyu", 2)) : l.price) * 100) / 100;
      if (pay > maxPrice || balance(w, buyerAcc) < pay) return finishPoor();
      transfer(w, buyerAcc, l.sellerId, pay, `${good} al\u0131m\u0131`);
      if (fixedWater && l.price > pay && l.sellerId !== "dis") transfer(w, "saray", l.sellerId, l.price - pay, "su s\xFCbvansiyonu");
      const tax = pay * (w.taxRate + goodTaxPct(w, good)) / 100;
      paySubsidy(w, l.sellerId, good);
      const s = findPerson(w, l.sellerId);
      if (s) {
        s.taxDue += s.smuggle ? tax * 0.2 : tax;
        s.incomeToday += pay - tax;
      } else if (l.sellerId === "dis") {
        transfer(w, "dis", "saray", Math.max(tax, pay * 0.1), "g\xFCmr\xFCk");
        if (w.caravan) w.caravan.earned = (w.caravan.earned ?? 0) + pay;
      }
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
function natureMult(w, g) {
  const n = w.nature;
  if (!n || w.day < n.start || w.day > n.until) return 1;
  if (n.kind === "kuraklik" && g === "bugday") return 0.35;
  if (n.kind === "kuraklik" && g === "su") return 0.85;
  if (n.kind === "bereket" && g === "bugday") return 1.4;
  if (n.kind === "sel" && (g === "balik" || g === "bugday")) return 0.6;
  if (n.kind === "balik" && g === "balik") return 1.6;
  return 1;
}
function produce(w, p) {
  const spec = PRODUCES[p.prof];
  if (!spec || p.jailedDays > 0 || p.exiledDays > 0) return;
  if (w.bans.includes(spec.good)) {
    p.lastAction = spec.good === "icki" ? "meyhane kapal\u0131" : `${spec.good} yasak \u2013 \xFCretim durdu`;
    return;
  }
  const unsold = w.listings.filter((l) => l.sellerId === p.id && l.good === spec.good).reduce((s, l) => s + l.qty, 0) + p.inv[spec.good];
  let frac = unsold >= spec.qty * 1.5 ? 0 : unsold >= spec.qty * 0.7 ? 0.5 : 1;
  if (frac === 0) {
    p.lastAction = "tezg\xE2h dolu, sat\u0131\u015F bekliyor";
    return;
  }
  for (const [g, need] of Object.entries(spec.inputs ?? {})) {
    if (p.inv[g] < need * frac) buy(w, p.id, g, Math.ceil(need * frac - p.inv[g]), Math.max(0.1, Math.min(p.money * 0.7, spec.qty * w.prices[spec.good] * 0.8 / need / Object.keys(spec.inputs ?? {}).length)));
    frac = Math.min(frac, p.inv[g] / need);
  }
  if (frac <= 0) {
    p.lastAction = "ham madde bulamad\u0131";
    return;
  }
  for (const [g, need] of Object.entries(spec.inputs ?? {})) p.inv[g] = Math.max(0, p.inv[g] - Math.ceil(need * frac));
  const tools = p.inv.alet > 0 ? 1.15 : 1;
  const r = rankOf(p);
  const qty = Math.max(1, Math.round(spec.qty * frac * tools * r.mult * natureMult(w, spec.good) * Math.max(0.75, 0.5 + p.health / 200)));
  p.xp += 1;
  const price = sellerPrice(w, p, spec.good, spec.inputs, spec.qty);
  addListing(w, p, spec.good, qty, price, spec.market);
  if (spec.extra) addListing(w, p, spec.extra.good, Math.round(spec.extra.qty * frac), sellerPrice(w, p, spec.extra.good), spec.market);
  p.lastAction = `${qty} ${spec.good} \xFCretti (${r.label})`;
}
function sellerPrice(w, p, g, inputs, out = 1) {
  const ref = marketPrice(w, g);
  const cost = Object.entries(inputs ?? {}).reduce((s, [ig, n]) => s + w.prices[ig] * n, 0) / Math.max(1, out);
  const unsold = listedQty(w, p.id, g);
  const stockAdj = unsold > STOCK_LIMIT[g] * 0.5 ? 0.92 : unsold === 0 ? 1.03 : 1;
  const greed = 1 + (50 - p.honesty) / 500;
  const mine = w.listings.find((l) => l.sellerId === p.id && l.good === g)?.price ?? ref;
  const target = Math.max(cost * 1.1, ref * stockAdj * greed * rankOf(p).mult ** 0.5);
  return Math.round((mine + (target - mine) * 0.5) * 100) / 100;
}
function settleMarket(w) {
  const ph = w.priceHist ??= {};
  for (const g of GOODS) {
    const h = ph[g] ??= [];
    h.push(w.prices[g]);
    if (h.length > 7) h.shift();
  }
  for (const g of GOODS) {
    const left = w.listings.filter((l) => l.good === g).reduce((s, l) => s + l.qty, 0);
    const sold = w.market.sold[g];
    const miss = w.market.unmet[g];
    let p = w.prices[g];
    const nm = natureMult(w, g);
    if (nm < 1) p *= 1 + Math.min(0.15, (1 - nm) * 0.3);
    else if (miss > 0) p *= 1 + Math.min(0.08, 0.01 + miss / Math.max(20, sold + miss) * 0.15);
    else if (left < sold * 0.25) p *= 1.02;
    else if (left > sold * 1.2 + 5) p *= 1 - Math.min(0.06, 0.01 + left / Math.max(20, sold + left) * 0.06);
    else p += (BASE_PRICE[g] - p) * 0.03;
    w.prices[g] = Math.round(Math.max(BASE_PRICE[g] * 0.6, Math.min(BASE_PRICE[g] * 5, p)) * 100) / 100;
  }
  const lose = (q, rate) => {
    const x = q * rate;
    const n = Math.floor(x);
    return n + (rand(w) < x - n ? 1 : 0);
  };
  for (const l of w.listings) l.qty = Math.max(0, l.qty - lose(l.qty, DECAY[l.good]));
  w.listings = w.listings.filter((l) => l.qty > 0);
  for (const p of w.people) for (const g of GOODS) if (p.inv[g] > 0) p.inv[g] = Math.max(0, Math.floor(p.inv[g]) - lose(Math.floor(p.inv[g]), DECAY[g]));
  for (const l of w.listings) {
    const s = findPerson(w, l.sellerId);
    if (s && s.npc && (w.day + l.id.length + l.id.charCodeAt(l.id.length - 1)) % 2 === 0) l.price = sellerPrice(w, s, l.good);
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

// src/sim/chat.ts
var say = (w, from, to, text, at) => {
  w.chatOut.push({ fromPersonId: from.id, fromName: from.name, toPersonId: to, text: text.slice(0, 280), at });
  if (w.chatOut.length > 60) w.chatOut.splice(0, w.chatOut.length - 60);
};
var talk = (w, a, b2, text) => {
  w.talks.push({ a: a.id, b: b2.id, text: text.slice(0, 60), day: w.day, hour: w.hour });
  if (w.talks.length > 30) w.talks.shift();
};
function opinion(w, p) {
  const bread = marketPrice(w, "ekmek");
  const opts = [];
  if (p.meals < 2 && w.hour > 14) opts.push("Bug\xFCn do\u011Fru d\xFCr\xFCst bir \u015Fey yemedim, karn\u0131m zil \xE7al\u0131yor.");
  if (p.drinks < 3 && w.hour > 14) opts.push("Susuzluktan dudaklar\u0131m \xE7atlad\u0131, su da pahal\u0131.");
  if (p.health < 30 || p.wounded) opts.push("Hastay\u0131m, hekime gidecek param yok.");
  if (bread > BASE_PRICE.ekmek * 1.6) opts.push(`Ekmek ${bread.toFixed(1)} Dinar olmu\u015F, bu nas\u0131l i\u015F!`);
  else if (bread < BASE_PRICE.ekmek * 0.9) opts.push("Ekmek ucuzlad\u0131, \u015F\xFCk\xFCr.");
  if (w.nature?.kind === "kuraklik") opts.push("Bu kurakl\u0131k hepimizi a\xE7 b\u0131rakacak.");
  if (w.nature?.kind === "salgin") opts.push("Salg\u0131n kap\u0131da, ellerinizi y\u0131kay\u0131n.");
  if (w.taxRate > 15) opts.push(`Vergi %${w.taxRate}; esnaf can \xE7eki\u015Fiyor.`);
  if (p.din > 70) opts.push(pick(w, ["Cuma namaz\u0131nda g\xF6r\xFC\u015Felim in\u015Fallah.", "\u0130\xE7ki \u015Fehri bozuyor, haram i\u015Fler \xE7o\u011Fald\u0131.", "Hocan\u0131n vaaz\u0131 \xE7ok g\xFCzeldi."]));
  if (p.din < 30) opts.push(pick(w, ["Ak\u015Fam meyhanede bir kadeh i\xE7elim mi?", "Her \u015Feye dinle kar\u0131\u015Fmas\u0131nlar.", "Meyhaneci yeni \u015Farap getirmi\u015F."]));
  if (p.republic > 60 && w.regime === "imparatorluk") opts.push(pick(w, ["Saltanat bitmeli, halk kendini y\xF6netmeli!", "Meclis g\xFC\xE7lenmeli, Kayzer\u2019in s\xF6z\xFC kanun olmamal\u0131."]));
  if (p.loyalty > 75) opts.push(w.regime === "imparatorluk" ? "Kayzerimize uzun \xF6m\xFCr! Devlet sa\u011Flam." : "Ba\u015Fkan\u0131m\u0131z iyi gidiyor.");
  if (p.loyalty < 30) opts.push("Saray bizi g\xF6rm\xFCyor, umurlar\u0131nda de\u011Filiz.");
  if (w.isyan) opts.push("Sokaklar kar\u0131\u015Ft\u0131, evden \xE7\u0131kmay\u0131n!");
  if (w.threat) opts.push(`${w.threat.name} s\u0131n\u0131rda; askerimiz yeter mi acaba?`);
  if (w.caravan) opts.push(`${w.caravan.name} limanda, pahal\u0131 ama mal var.`);
  const e = w.election;
  if (w.day >= e.nextDay - 6 && w.day <= e.nextDay) opts.push(e.candidates.length ? `Se\xE7imde ${findPerson(w, pick(w, e.candidates))?.name ?? "birine"} oy verece\u011Fim.` : "Se\xE7im yakla\u015F\u0131yor, kim aday olacak?");
  if (p.mood > 75) opts.push(pick(w, ["Ne g\xFCzel bir g\xFCn!", "\u0130\u015Fler yolunda, Allah bereket versin."]));
  if (PRODUCES[p.prof]) opts.push(`${PROF_LABEL[p.prof]}l\u0131k zor zanaat; ${GOOD_LABEL[PRODUCES[p.prof].good]} ${marketPrice(w, PRODUCES[p.prof].good).toFixed(1)} Dinar ediyor.`);
  return opts.length ? pick(w, opts) : pick(w, ["Hava g\xFCzel bug\xFCn.", "Pazarda kalabal\u0131k var.", "\xC7ocuklar b\xFCy\xFCyor ma\u015Fallah."]);
}
var GREET = ["Selam\xFCnaleyk\xFCm", "Merhaba", "Hay\u0131rl\u0131 g\xFCnler", "Ooo, ho\u015F geldin"];
function replyTo(w, npc, from, text) {
  const t = text.toLocaleLowerCase("tr");
  const r = npc.relations[from.id] ?? 0;
  const cold = r < -30;
  const warm = r > 30;
  if (/\*{3,}/.test(text) || /aptal|salak|şerefsiz|defol/.test(t)) {
    rel(npc, from, -12, "bana hakaret etti");
    return pick(w, ["A\u011Fz\u0131n\u0131 topla!", "Sana yak\u0131\u015Fmad\u0131 bu s\xF6z.", "Bunu unutmayaca\u011F\u0131m."]);
  }
  rel(npc, from, 2, "sohbet ettik");
  if (/merhaba|selam|günaydın|iyi akşam/.test(t)) return `${pick(w, GREET)} ${from.name.split(" ")[0]}! ${cold ? "Ne istiyorsun?" : opinion(w, npc)}`;
  if (/nasılsın|naber|ne haber|keyif/.test(t)) return npc.mood > 60 ? `\u0130yiyim, \u015F\xFCk\xFCr. ${opinion(w, npc)}` : npc.mood > 35 ? `\u0130dare ediyoruz. ${opinion(w, npc)}` : `Hi\xE7 iyi de\u011Filim\u2026 ${opinion(w, npc)}`;
  const g = Object.keys(GOOD_LABEL).find((x) => t.includes(GOOD_LABEL[x].toLocaleLowerCase("tr")));
  if (g || /fiyat|kaç para|pahalı|ucuz/.test(t)) {
    const gg = g ?? "ekmek";
    const mine = PRODUCES[npc.prof]?.good === gg;
    return `${GOOD_LABEL[gg]} \u015Fimdi ${marketPrice(w, gg).toFixed(2)} Dinar.${mine ? ` Ben de sat\u0131yorum; ${warm ? "sana biraz indirim yapar\u0131m." : "tezg\xE2h\u0131ma bak."}` : ""}`;
  }
  if (/vergi|kayzer|saray|başkan|cumhuriyet|meclis|seçim|siyaset/.test(t)) return npc.republic > 60 ? "A\xE7\u0131k konu\u015Fay\u0131m: bu saltanat b\xF6yle gitmez. Meclis halk\u0131n sesi olmal\u0131." : npc.loyalty > 70 ? "Devletimize laf ettirmem; Kayzer ne yaparsa do\u011Fru yapar." : `Vergi %${w.taxRate}. ${w.taxRate > 14 ? "Fazla bence." : "Fena de\u011Fil."} ${opinion(w, npc)}`;
  if (/namaz|cami|din|allah|hoca|vaaz/.test(t)) return npc.din > 60 ? "Elhamd\xFClillah. \xD6\u011Fle namaz\u0131nda camide bulu\u015Fal\u0131m." : npc.din < 30 ? "Ben pek camiye gitmem, kusura bakma." : "Cumalar\u0131 giderim, in\u015Fallah.";
  if (/içki|meyhane|bar|şarap|rakı/.test(t)) return npc.din > 60 ? "T\xF6vbe! Ben i\xE7ki i\xE7mem." : "Ak\u015Fam meyhanede g\xF6r\xFC\u015Felim, bir kadeh benden!";
  if (/borç|para ver|yardım|ödünç/.test(t)) {
    if (warm && npc.money > 60) return "Sen iyi adams\u0131n; bana yaz, 10 Dinar verebilirim.";
    return npc.money < 20 ? "Kendi kesem bo\u015F, kusura bakma." : "Para i\u015Fine kar\u0131\u015Fmam, sarrafa git.";
  }
  if (/iş|çalış/.test(t)) return npc.prof === "insaatci" || npc.prof === "hamal" ? "\u015Eantiyede i\u015F var m\u0131 bak\u0131yorum ben de." : `${PROF_LABEL[npc.prof]}l\u0131k yap\u0131yorum. ${PRODUCES[npc.prof] ? "Ham madde bulmak zor." : "Maa\u015F az ama ge\xE7iniyoruz."}`;
  if (/teşekkür|sağ ol|eyvallah/.test(t)) {
    rel(npc, from, 3, "kibar biri");
    return "Rica ederim, her zaman.";
  }
  if (/evlen|sevgili|aşk/.test(t)) return npc.spouse ? "Ben evliyim, haddini bil!" : warm ? "Hmm\u2026 Ailemle konu\u015Fman laz\u0131m." : "Seni pek tan\u0131m\u0131yorum.";
  return cold ? "Seninle konu\u015Facak bir \u015Feyim yok." : opinion(w, npc);
}
function chatHour(w, now, online) {
  if (w.hour < 7 || w.hour > 22) return;
  const awake = w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.exiledDays === 0 && p.prof !== "naip");
  for (let i = 0; i < 6 && awake.length > 1; i += 1) {
    const a = pick(w, awake);
    const near = awake.filter((b3) => b3 !== a && (b3.work === a.work || b3.home === a.home));
    const b2 = near.length ? pick(w, near) : pick(w, awake);
    if (a === b2) continue;
    const line = opinion(w, a);
    talk(w, a, b2, line);
    const agree = Math.abs(a.republic - b2.republic) < 25 && Math.abs(a.din - b2.din) < 30;
    rel(a, b2, agree ? 2 : -1, agree ? "sohbetimiz tatl\u0131" : "fikirlerimiz uyu\u015Fmuyor");
    rel(b2, a, agree ? 2 : -1, agree ? "sohbetimiz tatl\u0131" : "fikirlerimiz uyu\u015Fmuyor");
  }
  if (chance(w, 0.5)) {
    const a = pick(w, awake);
    const line = opinion(w, a);
    say(w, a, null, line, now);
    if (chance(w, 0.6)) {
      const b2 = pick(w, awake);
      if (b2 !== a) say(w, b2, null, `@${a.name.split(" ")[0]} ${Math.abs(a.republic - b2.republic) < 25 ? pick(w, ["Hakl\u0131s\u0131n.", "Aynen \xF6yle.", "Ben de \xF6yle d\xFC\u015F\xFCn\xFCyorum."]) : pick(w, ["Kat\u0131lm\u0131yorum.", "Abartma bence.", "\xD6yle deme."])} ${opinion(w, b2)}`, now + 1500);
    }
  }
  for (const p of w.people.filter((x) => x.playerId && online(x))) {
    if (!chance(w, 0.12)) continue;
    const friends = awake.filter((x) => (x.relations[p.id] ?? 0) > 10);
    const n = friends.length && chance(w, 0.6) ? pick(w, friends) : pick(w, awake);
    approach(w, n, p, now);
  }
}
function approach(w, n, p, now) {
  const kind = pick(w, ["sohbet", "sohbet", "rica", "mal", "davet", "rusvet"]);
  if (kind === "rica" && n.money < 20) {
    w.offers.push({ id: nextId(w, "O"), from: n.id, to: p.id, kind: "borc", amount: 10, day: w.day, text: `${n.name} 10 Dinar bor\xE7 istiyor` });
    say(w, n, p.id, `${p.name.split(" ")[0]}, ay\u0131pt\u0131r s\xF6ylemesi kesem bo\u015F. 10 Dinar verir misin? Geri \xF6derim, bu iyili\u011Fi unutmam. (Aile/Teklifler)`, now);
    return;
  }
  const g = PRODUCES[n.prof]?.good;
  if (kind === "mal" && g && n.inv[g] + w.listings.filter((l) => l.sellerId === n.id && l.good === g).reduce((s, l) => s + l.qty, 0) > 2) {
    const price = Math.round(marketPrice(w, g) * 0.9 * 100) / 100;
    w.offers.push({ id: nextId(w, "O"), from: n.id, to: p.id, kind: "mal", good: g, qty: 3, price, day: w.day, text: `${n.name}: 3 ${GOOD_LABEL[g]}, tanesi ${price}` });
    say(w, n, p.id, `Sana \xF6zel: 3 ${GOOD_LABEL[g]} tanesi ${price} Dinar, pazardan ucuz. \u0130ster misin? (Teklifler)`, now);
    return;
  }
  if (kind === "rusvet" && ["bekci", "tahsildar", "savci", "hakim", "memur"].includes(p.prof) && n.honesty < 45 && n.money > 40) {
    w.offers.push({ id: nextId(w, "O"), from: n.id, to: p.id, kind: "rusvet", amount: 15, day: w.day, text: `${n.name} 15 Dinar kar\u015F\u0131l\u0131\u011F\u0131 g\xF6z yumman\u0131z\u0131 istiyor` });
    say(w, n, p.id, `Psst\u2026 ${PROF_LABEL[p.prof]} efendi, 15 Dinar'\u0131m var; benim i\u015Flere biraz g\xF6z yumsan? (Teklifler)`, now);
    return;
  }
  if (kind === "davet") {
    say(w, n, p.id, n.din > 55 ? "\xD6\u011Fle namaz\u0131nda camide bulu\u015Fal\u0131m m\u0131?" : "Ak\u015Fam meyhanede bir kadeh i\xE7elim mi? Benden!", now);
    return;
  }
  say(w, n, p.id, `${pick(w, GREET)}! ${opinion(w, n)}`, now);
  void clamp;
}
function playerSaid(w, from, text, toPersonId, now) {
  if (toPersonId) {
    const npc = findPerson(w, toPersonId);
    if (npc && fullAI(npc) && npc.prof !== "naip") say(w, npc, from.id, replyTo(w, npc, from, text), now + 1200);
    if (npc?.prof === "naip") say(w, npc, from.id, "Efendim, devlet i\u015Flerinde size yard\u0131mc\u0131 olmak g\xF6revimdir. Dilek\xE7elerinizi Saray\u2019a yaz\u0131n; ben de Kayzer yokken k\xFC\xE7\xFCk i\u015Fleri g\xF6r\xFCr\xFCm.", now + 1200);
    return;
  }
  const t = text.toLocaleLowerCase("tr");
  const named = w.people.filter((p) => fullAI(p) && p.name.split(" ").some((x) => x.length > 2 && t.includes(x.toLocaleLowerCase("tr"))));
  const responders = named.length ? named.slice(0, 2) : w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && chance(w, 0.03)).slice(0, 2);
  responders.forEach((npc, i) => say(w, npc, null, `@${from.name.split(" ")[0]} ${replyTo(w, npc, from, text)}`, now + 1500 * (i + 1)));
}

// src/sim/extras.ts
var LOAN_RATE = 0.15;
var LOAN_DAYS = 7;
function sarraf(w) {
  return w.people.filter((p) => p.prof === "tuccar" && p.jailedDays === 0 && !p.playerId).sort((a, b2) => b2.money - a.money)[0];
}
function borrow(w, p, amount) {
  const s = sarraf(w);
  if (!s) return "Sarraf yok.";
  if (w.loans.some((l) => l.debtor === p.id)) return "\xD6nce eski borcunuzu \xF6deyin.";
  const max = Math.min(150, Math.max(20, s.money * 0.3));
  if (amount > max) return `Sarraf ${s.name} size en fazla ${Math.round(max)} Dinar verir.`;
  if (!transfer(w, s.id, p.id, amount, "sarraf borcu")) return "Sarraf\u0131n kasas\u0131 bo\u015F.";
  const owed = Math.round(amount * (1 + LOAN_RATE) * 100) / 100;
  w.loans.push({ id: nextId(w, "K"), debtor: p.id, lender: s.id, amount: owed, due: w.day + LOAN_DAYS, day: w.day });
  return `${s.name} ${amount} Dinar verdi. ${w.day + LOAN_DAYS}. g\xFCne kadar ${owed} Dinar \xF6demelisiniz (%${LOAN_RATE * 100} faiz).`;
}
function repay(w, p, id) {
  const l = w.loans.find((x) => x.id === id && x.debtor === p.id);
  if (!l) return "Bor\xE7 yok.";
  const pay = Math.min(p.money, l.amount);
  if (pay <= 0) return "Kesede para yok.";
  transfer(w, p.id, l.lender, pay, "bor\xE7 \xF6demesi");
  l.amount = Math.round((l.amount - pay) * 100) / 100;
  if (l.amount <= 0.01) w.loans = w.loans.filter((x) => x !== l);
  return l.amount > 0.01 ? `${pay} \xF6dendi; kalan ${l.amount}.` : "Bor\xE7 kapand\u0131.";
}
function loansDay(w) {
  for (const l of [...w.loans]) {
    const d = findPerson(w, l.debtor);
    const s = findPerson(w, l.lender);
    if (!d || !s) {
      w.loans = w.loans.filter((x) => x !== l);
      continue;
    }
    if ((!d.playerId || d.npc) && d.money > l.amount + 10) repay(w, d, l.id);
    if (w.day < l.due || !w.loans.includes(l)) continue;
    const pay = Math.min(d.money, l.amount);
    if (pay > 0) {
      transfer(w, d.id, s.id, pay, "bor\xE7 \xF6demesi");
      l.amount -= pay;
    }
    if (l.amount > 0.5) {
      let seized = 0;
      for (const g of GOODS) while (d.inv[g] > 0 && l.amount > 0.5) {
        d.inv[g] -= 1;
        s.inv[g] += 1;
        l.amount -= w.prices[g] * 0.5;
        seized += 1;
      }
      log(w, `HAC\u0130Z: ${s.name}, borcunu \xF6demeyen ${d.name}'\u0131n ${seized} e\u015Fyas\u0131na el koydu.`, d.id);
      if (l.amount > 0.5) {
        openCase(w, d.id, "zimmet", s.id, Math.round(l.amount), 70);
        d.jailedDays = Math.max(d.jailedDays, 3);
        log(w, `${d.name} bor\xE7 y\xFCz\xFCnden zindana at\u0131ld\u0131.`, d.id);
      }
    }
    w.loans = w.loans.filter((x) => x !== l);
  }
}
function migrateWorld(w) {
  const any = w;
  if ((w.schema ?? 1) >= 2) return migrate3(w);
  const def = { speed: 1, nature: null, nextDrought: w.day + 60, festivalUntil: 0, granary: 400, priceCaps: {}, arrests: [], chatOut: [], talks: [], offers: [], rumors: [], caravan: null, threat: null, bans: [], loans: [] };
  for (const [k, v] of Object.entries(def)) if (any[k] === void 0) any[k] = v;
  for (const g of GOODS) {
    if (w.prices[g] === void 0) w.prices[g] = 1;
    if (w.market.sold[g] === void 0) {
      w.market.sold[g] = 0;
      w.market.unmet[g] = 0;
    }
  }
  const fresh = { ekmek: 1.2, su: 0.5, et: 6, balik: 4, kumas: 8, alet: 20, odun: 2.5, bugday: 0.5, yun: 2, elbise: 18, mobilya: 40, icki: 3 };
  for (const g of GOODS) w.prices[g] = fresh[g] ?? w.prices[g];
  w.listings = [];
  const old = new Set(w.buildings.map((b2) => b2.id));
  w.buildings = makeBuildings();
  void old;
  const ids = new Set(w.buildings.map((b2) => b2.id));
  const houses = w.buildings.filter((b2) => b2.kind === "ev");
  for (const l of defaultLaws()) if (!w.laws.some((x) => x.id === l.id)) w.laws.push(l);
  for (const [k, v] of Object.entries(DEFAULT_SALARY)) {
    const cur = w.salaries[k];
    if (cur === void 0 || cur === OLD_DEFAULT_SALARY[k]) w.salaries[k] = v;
  }
  if (w.meclis.salary === 10) w.meclis.salary = 6;
  if (w.headTax === 1) w.headTax = 1.75;
  let i = 0;
  for (const p of w.people) {
    const pa = p;
    const d = { din: 50, meals: 3, drinks: 5, wounded: false, protectedUntil: 0, xp: 30, rep: 0, relNote: {}, titles: [], taxDue: 0, smuggle: false, nightOut: false, born: w.day - 100, parents: [], soylu: false, school: 0, exiledDays: 0 };
    for (const [k, v] of Object.entries(d)) if (pa[k] === void 0) pa[k] = v;
    p.din = p.prof === "imam" || p.prof === "hoca" ? 85 : 20 + p.id.charCodeAt(p.id.length - 1) * 37 % 65;
    for (const g of GOODS) if (p.inv[g] === void 0) p.inv[g] = 0;
    const gn = genderOfName(p.name);
    if (gn !== void 0 && p.prof !== "kayzer") p.female = gn;
    if (!ids.has(p.home)) p.home = houses[i++ % houses.length].id;
    if (!ids.has(p.work)) p.work = WORKPLACE[p.prof];
    p.inv.su = Math.max(p.inv.su, 3);
    p.inv.ekmek = Math.max(p.inv.ekmek, 2);
  }
  const TARGET = { ciftci: 5, firinci: 5, sucu: 8, dokumaci: 3, mobilyaci: 2, barci: 2, kasap: 4, balikci: 6, terzi: 3, demirci: 3, marangoz: 4, hamal: 6, insaatci: 8 };
  const count = (pr) => w.people.filter((x) => x.prof === pr).length;
  const titled = (p) => / /.test(p.name) && Object.values(PROF_LABEL).some((l) => p.name.startsWith(l + " "));
  for (const [need, n] of Object.entries(TARGET)) {
    while (count(need) < n) {
      const donor = w.people.find((x) => !x.playerId && !x.meclis && !titled(x) && TARGET[x.prof] !== void 0 && count(x.prof) > (TARGET[x.prof] ?? 0) && x.prof !== need) ?? w.people.find((x) => !x.playerId && !x.meclis && TARGET[x.prof] !== void 0 && count(x.prof) > (TARGET[x.prof] ?? 0) && x.prof !== need);
      if (!donor) break;
      donor.prof = need;
      donor.work = WORKPLACE[need];
      donor.xp = 0;
    }
  }
  for (const p of w.people) {
    const s = findPerson(w, p.spouse);
    if (s && s.female === p.female) {
      p.spouse = null;
      s.spouse = null;
      if (s.home === p.home && s.home !== "saray") s.home = houses[randInt(w, 0, houses.length - 1)].id;
      log(w, `${p.name} ile ${s.name}'\u0131n evlili\u011Fi ge\xE7ersiz say\u0131ld\u0131 (evlilik bir kad\u0131n ile bir erkek aras\u0131nda olur).`);
    }
  }
  w.people = w.people.filter(Boolean);
  w.market = { sold: emptyInv(), unmet: emptyInv() };
  w.schema = 2;
  void clamp;
  void chance;
  return migrate3(w);
}
function migrate3(w) {
  if ((w.schema ?? 1) >= 3) return w;
  const any = w;
  for (const [k, v] of Object.entries({ customLaws: [], suspicion: {}, treasuryBook: [], priceHist: {}, serving: [] })) if (any[k] === void 0) any[k] = v;
  if (w.granary < 800) w.granary = 800;
  w.schema = 3;
  return w;
}

// src/sim/tick.ts
var hourMs = (w) => HOUR_MS / (w.speed > 0 ? w.speed : 1);
function electionPhase(w) {
  const n = w.election.nextDay;
  const d = w.day;
  if (d >= n - 6 && d <= n - 4) return { phase: "aday", label: `Meclis: adayl\u0131k a\xE7\u0131k (${n - 4}. g\xFCne kadar), se\xE7im ${n}. g\xFCn` };
  if (d >= n - 3 && d <= n - 1) return { phase: "propaganda", label: `Meclis: propaganda d\xF6nemi, se\xE7im ${n}. g\xFCn` };
  if (d === n) return { phase: "oylama", label: "Meclis: BUG\xDCN SE\xC7\u0130M \u2014 oy verin!" };
  return { phase: "bekleme", label: `Meclis se\xE7imi ${n}. g\xFCn (adayl\u0131k ${n - 6}. g\xFCn a\xE7\u0131l\u0131r)` };
}
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
  w.serverNow = now;
  const hm = hourMs(w);
  let hours = Math.floor((now - w.lastTickAt) / hm);
  if (hours <= 0) return 0;
  if (hours > MAX_CATCHUP_HOURS) {
    w.lastTickAt = now - MAX_CATCHUP_HOURS * hm;
    hours = MAX_CATCHUP_HOURS;
  }
  for (let i = 0; i < hours; i += 1) stepHour(w, now);
  w.lastTickAt += hours * hm;
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
    if (w.isyan) transfer(w, "saray", "dis", Math.min(w.treasury, 4), "isyan masraf\u0131 (ordu seferberli\u011Fi)");
  }
  needsHour(w);
  lifeHour(w);
  chatHour(w, now, (p) => isOnline(w, p.playerId, now, ONLINE_WINDOW_MS));
  if (w.hour === 10) campaign(w, now);
  switch (w.hour) {
    case 2:
      for (const p of w.people) decide(w, p);
      break;
    case 7:
      sellGazette(w);
      break;
    case 8:
      resetMarketDay(w);
      for (const p of w.people) p.incomeToday = 0;
      for (const p of shuffled(w)) if (!p.playerId || isOnline(w, p.playerId, now, ONLINE_WINDOW_MS)) produce(w, p);
      traderRelist(w);
      break;
    // offline players only keep their needs
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
    case 22:
      if (w.festivalUntil >= w.day) for (const p of w.people) p.mood = clamp(p.mood + 1.5);
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
      const plot = w.buildings.find((b2) => b2.id === pr.plot);
      if (plot) {
        plot.kind = "yapi";
        plot.name = pr.name.replace(/ inşaatı$/i, "");
      }
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
function campaign(w, now) {
  const ph = electionPhase(w).phase;
  const e = w.election;
  if (ph === "aday") {
    for (const p of w.people) if (fullAI(p) && p.ambition > 60 && p.jailedDays === 0 && p.prof !== "naip" && p.id !== w.kayzerId && !e.candidates.includes(p.id) && chance(w, 0.25) && e.candidates.length < 14) {
      e.candidates.push(p.id);
      log(w, `${p.name} Meclis'e aday oldu.`, p.id);
    }
  }
  if (ph === "propaganda") {
    e.posters = e.posters ?? {};
    for (const id of e.candidates) {
      const c = findPerson(w, id);
      if (!c || !fullAI(c)) continue;
      if (c.money > 20 && chance(w, 0.6) && transfer(w, c.id, "saray", 3, "afi\u015F harc\u0131")) e.posters[id] = (e.posters[id] ?? 0) + 1;
      if (chance(w, 0.5)) w.chatOut.push({ fromPersonId: c.id, fromName: c.name, toPersonId: null, text: `\u{1F4E3} ${c.republic > 55 ? "Halk\u0131n meclisi i\xE7in" : c.loyalty > 70 ? "Devlete sadakat i\xE7in" : c.din > 65 ? "Ahlak ve din i\xE7in" : "Ucuz ekmek i\xE7in"} bana oy verin! \u2013 ${c.name}`, at: now });
    }
  }
  void rumor;
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
    const fine = Math.min(a.money, c.crime === "isyan" || c.crime === "cinayet" ? a.money : 10 + c.amount * 0.5);
    transfer(w, a.id, "saray", fine, "para cezas\u0131");
    a.jailedDays = c.crime === "cinayet" ? 25 : c.crime === "isyan" ? 7 : c.crime === "saldiri" ? 5 : 3;
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
  endOfDayLife(w);
  loansDay(w);
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
  w.election = { ...e, nextDay: w.day + 20, candidates: [], votes: {}, posters: {} };
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
    p = makePerson(w, { name: clean(name), prof: safeProf, money: 40, honesty: 60, ambition: 50, loyalty: 60 }, home);
    w.people.push(p);
  }
  p.playerId = playerId;
  p.npc = false;
  p.protectedUntil = w.day + 5;
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
      if (got) {
        me.bought = me.bought ?? {};
        me.bought[a.good] = (me.bought[a.good] ?? 0) + got;
      }
      return got ? ok(`${got} ${GOOD_LABEL[a.good]} ald\u0131n\u0131z.`) : no("Pazarda yok ya da paran\u0131z yetmiyor.");
    }
    case "sell": {
      const q = num(a.qty, 1, 500);
      const pr = num(a.price, 0.1, 1e3);
      if (q === null || pr === null || !GOODS.includes(a.good) || me.inv[a.good] < q) return no("Elinizde o kadar mal yok.");
      if (me.inv[a.good] - (me.bought?.[a.good] ?? 0) < q) return no("Bug\xFCn ald\u0131\u011F\u0131n\u0131z mal\u0131 ayn\u0131 g\xFCn yeniden satamazs\u0131n\u0131z (karaborsa \xF6nlemi).");
      me.inv[a.good] -= Math.floor(q);
      addListing(w, me, a.good, Math.floor(q), pr, "pazar");
      return ok("Tezg\xE2ha koydunuz.");
    }
    case "eat": {
      if (me.meals >= 3) return no("Bug\xFCnk\xFC 3 \xF6\u011F\xFCn\xFCn\xFCz\xFC yediniz; toksunuz.");
      return eatMeal(w, me) ? ok(`Yemek yediniz (bug\xFCn ${me.meals}/3).`) : no("Yiyecek alacak paran\u0131z yok ya da pazarda yemek kalmad\u0131.");
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
      if (isKayzer(w, me) || me.soylu) return no("H\xFCk\xFCmdar\u0131n r\xFC\u015Fvete ihtiyac\u0131 yoktur; ferman yaz\u0131n.");
      if (!STATE_PROFS.includes(t.prof) && !t.meclis) return no("R\xFC\u015Fvet sadece memur, asker, bek\xE7i, kad\u0131 ya da Meclis \xFCyesine, bir \u015Fey kar\u015F\u0131l\u0131\u011F\u0131nda verilir.");
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
      const law = a.law ? { ...a.law, name: a.law.name ? filterProfanity(String(a.law.name)).slice(0, 50) : void 0 } : void 0;
      const r = propose(w, me, a.kind, num(a.value, 0, 5e4) ?? 0, String(a.target ?? ""), a.title ? filterProfanity(a.title) : void 0, law);
      return typeof r === "string" ? no(r) : ok("Teklifiniz Meclis g\xFCndeminde. 1 g\xFCn g\xF6r\xFC\u015Fme, 1 g\xFCn oylama.");
    }
    case "enactLaw": {
      if (!isKayzer(w, me)) return no("Kanunu sadece h\xFCk\xFCmdar ferman ile \xE7\u0131kar\u0131r; siz Meclis\u2019e teklif verin.");
      if (w.regime === "cumhuriyet" && ["yasak", "sokak", "hizmet", "sertCeza"].includes(a.law?.kind)) return no("Cumhuriyette yasak, soka\u011Fa \xE7\u0131kma, zorunlu hizmet ve a\u011F\u0131r ceza kanunlar\u0131n\u0131 sadece Meclis \xE7\u0131kar\u0131r.");
      const law = { ...a.law, name: a.law?.name ? filterProfanity(String(a.law.name)).slice(0, 50) : void 0 };
      const err = validateLaw(law);
      if (err) return no(err);
      return ok(enactLaw(w, law, me, "ferman"));
    }
    case "repealLaw": {
      if (!isKayzer(w, me)) return no("Kanunu h\xFCk\xFCmdar kald\u0131r\u0131r.");
      const r = repealLaw(w, a.lawId);
      return { ok: r.endsWith("kald\u0131r\u0131ld\u0131."), msg: r };
    }
    case "inspect": {
      if (me.prof !== "bekci" && me.prof !== "asker") return no("Arama yapmay\u0131 bek\xE7i ya da asker yapar.");
      const t = findPerson(w, a.personId);
      if (!t || t.id === me.id) return no("Ki\u015Fi yok.");
      return ok(inspectPerson(w, me, t));
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
      if (electionPhase(w).phase !== "aday") return no(`Adayl\u0131k d\xF6nemi de\u011Fil. ${electionPhase(w).label}.`);
      if (!w.election.candidates.includes(me.id)) w.election.candidates.push(me.id);
      return ok(`Adays\u0131n\u0131z. Se\xE7im ${w.election.nextDay}. g\xFCn.`);
    }
    case "vote": {
      if (!w.election.candidates.includes(a.candidateId)) return no("Bu ki\u015Fi aday de\u011Fil.");
      if (electionPhase(w).phase === "bekleme" || electionPhase(w).phase === "aday") return no(`Oy verme zaman\u0131 de\u011Fil. ${electionPhase(w).label}.`);
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
    case "setSpeed": {
      if (w.kayzerId !== me.id) return no("Oyun h\u0131z\u0131n\u0131 sadece h\xFCk\xFCmdar de\u011Fi\u015Ftirir.");
      if (![0.5, 1, 2].includes(a.speed)) return no("0.5x, 1x ya da 2x.");
      const f = Math.min(0.999, Math.max(0, (now - w.lastTickAt) / hourMs(w)));
      w.speed = a.speed;
      w.lastTickAt = now - f * hourMs(w);
      log(w, `Ferman: zaman ${a.speed}x h\u0131zla ak\u0131yor.`);
      return ok(`H\u0131z ${a.speed}x.`);
    }
    case "drinkWater":
      if (me.drinks >= 5) return no("Bug\xFCnk\xFC 5 suyunuzu i\xE7tiniz.");
      return drinkWater(w, me) ? ok(`Su i\xE7tiniz (bug\xFCn ${me.drinks}/5).`) : no("Su alacak paran\u0131z yok ya da kuyuda su kalmad\u0131.");
    case "pray":
      return ok(pray(w, me));
    case "drink": {
      const r = drinkAlcohol(w, me);
      return { ok: r.startsWith("Meyhanede bir"), msg: r };
    }
    case "doctor": {
      const r = seeDoctor(w, me, false);
      return { ok: r.includes("iyile\u015Ftirdi"), msg: r };
    }
    case "work": {
      if (me.lastAction.startsWith("fazla mesai")) return no("Bug\xFCn zaten fazla mesai yapt\u0131n\u0131z.");
      const spec = PRODUCES[me.prof];
      if (spec) {
        produce(w, me);
        me.health = clamp(me.health - 4);
        me.lastAction = `fazla mesai \xB7 ${me.lastAction}`;
        return ok(`Fazla mesai yapt\u0131n\u0131z: ${me.lastAction}`);
      }
      const pay = 4;
      if (transfer(w, "saray", me.id, pay, "yevmiye")) {
        me.incomeToday += pay;
        me.lastAction = "fazla mesai";
        me.health = clamp(me.health - 3);
        return ok("Yevmiyeli i\u015F yapt\u0131n\u0131z (+4 Dinar).");
      }
      return no("\u0130\u015F yok.");
    }
    case "nightOut": {
      me.nightOut = a.on;
      return ok(a.on ? "Gece d\u0131\u015Far\u0131das\u0131n\u0131z; dikkat, gece su\xE7 \xE7ok." : "Eve girdiniz.");
    }
    case "chatWith": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      const line = opinion(w, t);
      rel(t, me, 3, "sohbet ettik");
      rel(me, t, 3, "sohbet ettik");
      w.talks.push({ a: t.id, b: me.id, text: line.slice(0, 60), day: w.day, hour: w.hour });
      return ok(`${t.name}: \u201C${line}\u201D`);
    }
    case "insult": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      rel(t, me, -25, "bana hakaret etti");
      me.rep = clamp(me.rep - 2, -100, 100);
      return ok(`${t.name} size k\xFCst\xFC.`);
    }
    case "assault": {
      const t = findPerson(w, a.personId);
      if (!t || t.id === me.id || t.prof === "naip") return no("Ge\xE7ersiz.");
      me.honesty = clamp(me.honesty - 15);
      return ok(assault(w, me, t));
    }
    case "kill": {
      const t = findPerson(w, a.personId);
      if (!t || t.id === me.id || t.prof === "naip" || t.id === w.kayzerId) return no("Ge\xE7ersiz.");
      me.honesty = clamp(me.honesty - 40);
      return ok(murder(w, me, t));
    }
    case "offerBribe": {
      const ar = w.arrests.find((x) => x.id === a.arrestId && x.criminalId === me.id && x.status === "bekliyor");
      const amt = num(a.amount, 1, 1e3);
      if (!ar || amt === null) return no("Bekleyen bir tutuklaman\u0131z yok.");
      if (me.money < amt) return no("Paran\u0131z yetmiyor.");
      ar.offer = amt;
      const ca = findPerson(w, ar.catcherId);
      if (ca && fullAI(ca)) {
        const r = decideBribe(w, ar, chance(w, bribeAcceptChance(ca, amt)));
        return { ok: r.includes("sald\u0131"), msg: r };
      }
      return ok(`${ca?.name ?? "Bek\xE7i"} teklifinizi d\xFC\u015F\xFCn\xFCyor\u2026`);
    }
    case "answerBribe": {
      const ar = w.arrests.find((x) => x.id === a.arrestId && x.catcherId === me.id && x.status === "bekliyor");
      if (!ar) return no("Teklif yok.");
      return ok(decideBribe(w, ar, a.accept));
    }
    case "answerOffer": {
      const o = w.offers.find((x) => x.id === a.offerId && x.to === me.id);
      if (!o) return no("Teklif yok.");
      w.offers = w.offers.filter((x) => x !== o);
      const f = findPerson(w, o.from);
      if (!f) return no("Ki\u015Fi gitmi\u015F.");
      if (!a.accept) {
        rel(f, me, -2, "teklifimi geri \xE7evirdi");
        return ok("Geri \xE7evirdiniz.");
      }
      if (o.kind === "borc" && transfer(w, me.id, f.id, o.amount ?? 10, "iyilik")) {
        rel(f, me, 15, "zor g\xFCn\xFCmde yard\u0131m etti");
        me.rep = clamp(me.rep + 2, -100, 100);
        return ok(`${f.name} \xE7ok minnettar.`);
      }
      if (o.kind === "mal" && o.good && o.price) {
        const q = o.qty ?? 1;
        const g = o.good;
        const have = f.inv[g] + w.listings.filter((l) => l.sellerId === f.id && l.good === g).reduce((s2, l) => s2 + l.qty, 0);
        if (have < q) return no("Mal\u0131 kalmam\u0131\u015F.");
        if (!transfer(w, me.id, f.id, o.price * q, `${g} al\u0131m\u0131`)) return no("Paran\u0131z yetmiyor.");
        let need = q;
        const take = Math.min(f.inv[g], need);
        f.inv[g] -= take;
        need -= take;
        for (const l of w.listings.filter((l2) => l2.sellerId === f.id && l2.good === g)) {
          const t2 = Math.min(l.qty, need);
          l.qty -= t2;
          need -= t2;
        }
        me.inv[g] += q;
        f.taxDue += o.price * q * w.taxRate / 100;
        rel(f, me, 4, "al\u0131\u015Fveri\u015F yapt\u0131k");
        return ok("Pazarl\u0131k tamam.");
      }
      if (o.kind === "rusvet" && transfer(w, f.id, me.id, o.amount ?? 15, "r\xFC\u015Fvet")) {
        rel(f, me, 10, "g\xF6z yumdu");
        if (chance(w, 0.25)) {
          openCase(w, me.id, "rusvet", null, o.amount ?? 15, 55);
          return ok("R\xFC\u015Fveti ald\u0131n\u0131z\u2026 ama biri g\xF6rd\xFC!");
        }
        return ok("R\xFC\u015Fveti ald\u0131n\u0131z.");
      }
      return no("Olmad\u0131.");
    }
    case "poster": {
      if (electionPhase(w).phase !== "propaganda" && electionPhase(w).phase !== "aday") return no("Afi\u015F sadece adayl\u0131k ve propaganda d\xF6neminde as\u0131l\u0131r.");
      if (!w.election.candidates.includes(me.id)) return no("\xD6nce aday olun.");
      if (!transfer(w, me.id, "saray", 5, "afi\u015F harc\u0131")) return no("Afi\u015F 5 Dinar.");
      w.election.posters = w.election.posters ?? {};
      w.election.posters[me.id] = (w.election.posters[me.id] ?? 0) + 1;
      return ok("Afi\u015Fleriniz as\u0131ld\u0131.");
    }
    case "campaign": {
      if (!w.election.candidates.includes(me.id)) return no("\xD6nce aday olun.");
      const text = filterProfanity(String(a.text ?? "")).slice(0, 160);
      if (text.length < 4) return no("Konu\u015Fma k\u0131sa.");
      for (const p of w.people) if (chance(w, 0.25)) rel(p, me, Math.abs(p.republic - me.republic) < 25 ? 3 : -1, "se\xE7im konu\u015Fmas\u0131n\u0131 dinledim");
      w.chatOut.push({ fromPersonId: me.id, fromName: me.name, toPersonId: null, text: `\u{1F4E3} ${text}`, at: now });
      return ok("Meydanda konu\u015Ftunuz.");
    }
    case "sermon": {
      if (me.prof !== "imam" && me.prof !== "hoca") return no("Vaaz\u0131 imam ya da hoca verir.");
      if (me.lastAction === "vaaz") return no("Bug\xFCn vaaz verdiniz.");
      me.lastAction = "vaaz";
      return ok(sermon(w, me, a.topic));
    }
    case "directive": {
      if (!isKayzer(w, me)) return no("Y\xF6nlendirmeyi devlet yapar.");
      return ok(directive(w, a.topic));
    }
    case "granary": {
      if (!isKayzer(w, me)) return no("Ambar\u0131 devlet y\xF6netir.");
      const q = num(a.qty, 1, 500);
      if (q === null) return no("Ge\xE7ersiz.");
      return a.op === "buy" ? ok(`Ambara ${granaryBuy(w, q)} bu\u011Fday al\u0131nd\u0131 (sadece ucuz bu\u011Fday).`) : ok(`Ambardan ${granaryRelease(w, q)} bu\u011Fday sabit fiyatla sat\u0131\u015Fa \xE7\u0131kt\u0131.`);
    }
    case "priceCap": {
      if (!isKayzer(w, me)) return no("Narh\u0131 devlet koyar.");
      if (!GOODS.includes(a.good)) return no("Mal yok.");
      if (a.price === null) {
        delete w.priceCaps[a.good];
        return ok("Narh kald\u0131r\u0131ld\u0131.");
      }
      const v = num(a.price, 0.1, 500);
      if (v === null) return no("Ge\xE7ersiz.");
      w.priceCaps[a.good] = v;
      for (const l of w.listings) if (l.good === a.good && l.price > v) l.price = v;
      log(w, `Ferman: ${GOOD_LABEL[a.good]} i\xE7in narh (tavan fiyat) ${v} Dinar.`);
      return ok("Narh kondu. \xC7ok d\xFC\u015F\xFCk narh k\u0131tl\u0131k yarat\u0131r!");
    }
    case "defend": {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== "kapandi");
      if (!c || c.accusedId === me.id) return no("Dava yok.");
      c.defenders = c.defenders ?? [];
      if (c.defenders.includes(me.id)) return no("Zaten avukats\u0131n\u0131z.");
      c.defenders.push(me.id);
      c.evidence = Math.max(0, c.evidence - 12 - me.school / 3);
      const acc = findPerson(w, c.accusedId);
      if (acc && transfer(w, acc.id, me.id, Math.min(acc.money, 8), "avukatl\u0131k \xFCcreti")) me.incomeToday += 8;
      if (acc) rel(acc, me, 15, "beni mahkemede savundu");
      return ok("Savunmay\u0131 \xFCstlendiniz; delil zay\u0131flad\u0131.");
    }
    case "witness": {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== "kapandi");
      if (!c || c.accusedId === me.id) return no("Dava yok.");
      c.witnesses = c.witnesses ?? [];
      if (c.witnesses.some((x) => x.id === me.id)) return no("Zaten tan\u0131ks\u0131n\u0131z.");
      c.witnesses.push({ id: me.id, against: a.against });
      c.evidence = clamp(c.evidence + (a.against ? 15 : -10));
      const acc = findPerson(w, c.accusedId);
      if (acc) rel(acc, me, a.against ? -30 : 12, a.against ? "aleyhime tan\u0131kl\u0131k etti" : "lehime tan\u0131kl\u0131k etti");
      return ok("Tan\u0131kl\u0131\u011F\u0131n\u0131z tutana\u011Fa ge\xE7ti.");
    }
    case "smuggle": {
      me.smuggle = a.on;
      return ok(a.on ? "Sat\u0131\u015Flar\u0131n\u0131z\u0131 vergiden sakl\u0131yorsunuz (ka\xE7ak\xE7\u0131l\u0131k su\xE7tur!)." : "D\xFCr\xFCst ticarete d\xF6nd\xFCn\xFCz.");
    }
    case "tribute": {
      if (!isKayzer(w, me) || !w.threat) return no("Hara\xE7 isteyen yok.");
      if (a.pay) return ok(payTribute(w));
      log(w, `${headTitle(w)} harac\u0131 reddetti! Ordu s\u0131n\u0131ra y\xFCr\xFCyor.`);
      w.threat.deadline = w.day;
      return ok("Hara\xE7 reddedildi; sava\u015F yak\u0131nda.");
    }
    case "caravanBuy": {
      const q = num(a.qty, 1, 50);
      if (q === null) return no("Ge\xE7ersiz.");
      const got = buy(w, me.id, a.good, q);
      return got ? ok(`Kervandan/pazardan ${got} ${GOOD_LABEL[a.good]} ald\u0131n\u0131z.`) : no("Al\u0131namad\u0131.");
    }
    case "borrow": {
      const v = num(a.amount, 5, 150);
      if (v === null) return no("5\u2013150 Dinar.");
      const r = borrow(w, me, v);
      return { ok: r.includes("verdi"), msg: r };
    }
    case "repay":
      return ok(repay(w, me, a.loanId));
    case "festivalOpen": {
      if (!isKayzer(w, me)) return no("Festivali devlet d\xFCzenler.");
      const c = num(a.cost, 100, 5e3);
      if (c === null) return no("100\u20135000.");
      if (!spend(w, c) || !transfer(w, "saray", "dis", c, "festival masraf\u0131")) return no("B\xFCt\xE7e/hazine yetmiyor.");
      w.festivalUntil = w.day + 1;
      for (const p of w.people) {
        p.mood = clamp(p.mood + c / 100);
        p.loyalty = clamp(p.loyalty + c / 200);
      }
      log(w, `\u{1F3AA} FEST\u0130VAL! Festival Alan\u0131 yar\u0131n ak\u015Fama kadar a\xE7\u0131k; m\xFCzik, oyun, yemek!`);
      return ok("Festival ba\u015Flad\u0131.");
    }
    case "buildAt": {
      if (!isKayzer(w, me)) return no("\u0130n\u015Faat\u0131 devlet ba\u015Flat\u0131r.");
      const plot = w.buildings.find((b2) => b2.id === a.plotId && b2.kind === "arsa");
      if (!plot) return no("Bu arsa bo\u015F de\u011Fil.");
      if (w.projects.some((x) => !x.done)) return no("\xD6nce s\xFCren in\u015Faat bitmeli.");
      const K = { cesme: ["\xC7e\u015Fme", 800], hamam: ["Hamam", 1500], kutuphane: ["K\xFCt\xFCphane", 1200], han: ["Kervansaray", 2e3] };
      const k = K[a.kind];
      if (!k) return no("Bilinmeyen yap\u0131.");
      w.projects.push({ id: `pr${++w.idSeq}`, name: `${k[0]} in\u015Faat\u0131`, site: plot.id, plot: plot.id, kind: a.kind, cost: k[1], paid: 0, progress: 0, needed: Math.round(k[1] / 10), done: false });
      plot.name = `${k[0]} (in\u015Faatta)`;
      log(w, `Ferman: ${plot.id} arsas\u0131na ${k[0]} yap\u0131lacak. Ustalar \u015Fantiyeden yola \xE7\u0131k\u0131yor.`);
      return ok("\u0130n\u015Faat ba\u015Flad\u0131; \xF6denek ay\u0131r\u0131n.");
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
function drainChat(w) {
  const out = w.chatOut ?? [];
  w.chatOut = [];
  return out;
}
function heartbeat(w, playerId, now) {
  migrateWorld(w);
  const summary = touchPlayer(w, playerId, now);
  const hours = advanceWorld(w, now);
  const snapshotDue = now - w.lastSnapshotAt >= SNAPSHOT_EVERY_MS;
  if (snapshotDue) w.lastSnapshotAt = now;
  return { summary, hours, snapshotDue };
}
function act(w, playerId, a, now) {
  migrateWorld(w);
  advanceWorld(w, now);
  const r = applyAction(w, playerId, a, now);
  const q = questReward(w, playerId);
  if (q) r.msg = `${r.msg}
\u{1F3AF} ${q}`;
  return r;
}
function register(w, playerId, name, prof, founder, now, takeOverId) {
  migrateWorld(w);
  joinWorld(w, playerId, name, prof, founder, now, takeOverId);
}
function candidates(w) {
  migrateWorld(w);
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
  playerSaid(w, me, clean2, toPersonId, now);
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
  drainChat,
  filterProfanity,
  heartbeat,
  makeChat,
  migrateWorld,
  personOf,
  rateOk,
  register
};
