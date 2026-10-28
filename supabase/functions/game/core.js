// src/sim/tr.ts
var BACK = "a\u0131ou";
var FRONT = "ei\xF6\xFC";
var VOW = BACK + FRONT;
var HARD = "\xE7fhkps\u015Ft";
function ek(name, base) {
  const n2 = (name ?? "").trim();
  if (!n2) return n2;
  const low2 = n2.toLocaleLowerCase("tr");
  let lv = "a";
  for (let i = low2.length - 1; i >= 0; i--) if (VOW.includes(low2[i])) {
    lv = low2[i];
    break;
  }
  const endsV = VOW.includes(low2[low2.length - 1]);
  const hard = HARD.includes(low2[low2.length - 1]);
  const two = BACK.includes(lv) ? "a" : "e";
  const four = { a: "\u0131", \u0131: "\u0131", o: "u", u: "u", e: "i", i: "i", \u00F6: "\xFC", \u00FC: "\xFC" }[lv];
  let s;
  switch (base) {
    case "\u0131":
      s = (endsV ? "y" : "") + four;
      break;
    case "a":
      s = (endsV ? "y" : "") + two;
      break;
    case "\u0131n":
      s = (endsV ? "n" : "") + four + "n";
      break;
    case "dan":
      s = (hard ? "t" : "d") + two + "n";
      break;
    case "da":
      s = (hard ? "t" : "d") + two;
      break;
    case "la":
      s = (endsV ? "y" : "") + "l" + two;
      break;
  }
  return `${n2}\u2019${s}`;
}

// src/sim/types.ts
var GOODS = ["ekmek", "su", "et", "balik", "kumas", "alet", "odun", "bugday", "yun", "elbise", "mobilya", "icki", "sut", "yumurta"];

// src/sim/constants.ts
var DAY_MS = 6 * 60 * 1e3;
var HOUR_MS = DAY_MS / 24;
var ONLINE_WINDOW_MS = 60 * 1e3;
var MAX_CATCHUP_HOURS = 48;
var SNAPSHOT_EVERY_MS = 3 * 24 * 3600 * 1e3;
var INACTIVE_TO_NPC_MS = 21 * 24 * 3600 * 1e3;
var MAP_W = 100;
var MAP_H = 60;
var BASE_PRICE = { ekmek: 1.2, su: 0.5, et: 6, balik: 4, kumas: 8, alet: 20, odun: 2.5, bugday: 0.5, yun: 2, elbise: 18, mobilya: 40, icki: 3, sut: 1, yumurta: 0.6 };
var GOOD_LABEL = { ekmek: "Ekmek", su: "Su", et: "Et", balik: "Bal\u0131k", kumas: "Kuma\u015F", alet: "Alet", odun: "Odun", bugday: "Bu\u011Fday", yun: "Y\xFCn", elbise: "Elbise", mobilya: "Mobilya", icki: "\u0130\xE7ki", sut: "S\xFCt", yumurta: "Yumurta" };
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
  barci: { good: "icki", qty: 16, market: "bar", inputs: { bugday: 8 } },
  hayvanci: { good: "bugday", qty: 18, market: "gida" }
  // side job as a farmhand: never idle between animal sales
};
var DECAY = { ekmek: 0.35, su: 0.3, et: 0.3, balik: 0.4, kumas: 0.02, alet: 0.03, odun: 0.05, bugday: 0.12, yun: 0.02, elbise: 0.05, mobilya: 0.02, icki: 0.05, sut: 0.4, yumurta: 0.15 };
var STOCK_LIMIT = { ekmek: 120, su: 200, et: 40, balik: 40, kumas: 20, alet: 10, odun: 40, bugday: 150, yun: 30, elbise: 10, mobilya: 4, icki: 50, sut: 80, yumurta: 80 };
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
  hayvanci: "Hayvan T\xFCccar\u0131",
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
  return finish2();
  function finishPoor() {
    const b2 = findPerson(w, buyerAcc);
    if (b2) b2.inv[good] += got;
    return got;
  }
  function finish2() {
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
  const n2 = w.nature;
  if (!n2 || w.day < n2.start || w.day > n2.until) return 1;
  if (n2.kind === "kuraklik" && g === "bugday") return 0.35;
  if (n2.kind === "kuraklik" && g === "su") return 0.85;
  if (n2.kind === "bereket" && g === "bugday") return 1.4;
  if (n2.kind === "sel" && (g === "balik" || g === "bugday")) return 0.6;
  if (n2.kind === "balik" && g === "balik") return 1.6;
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
  const cost = Object.entries(inputs ?? {}).reduce((s, [ig, n2]) => s + w.prices[ig] * n2, 0) / Math.max(1, out);
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
    if (g === "ekmek" && natureMult(w, "bugday") < 1) {
      const wr = w.prices.bugday / BASE_PRICE.bugday;
      p *= 1.03;
      if (wr > 1.1) p *= 1 + Math.min(0.1, (wr - 1) * 0.08);
      p = Math.max(p, w.prices.bugday * 0.55);
    }
    const floor = ["kumas", "alet", "elbise", "mobilya", "yun", "odun", "icki"].includes(g) ? 0.75 : 0.6;
    w.prices[g] = Math.round(Math.max(BASE_PRICE[g] * floor, Math.min(BASE_PRICE[g] * 5, p)) * 100) / 100;
  }
  const lose = (q, rate) => {
    const x = q * rate;
    const n2 = Math.floor(x);
    return n2 + (rand(w) < x - n2 ? 1 : 0);
  };
  for (const l of w.listings) l.qty = Math.max(0, l.qty - lose(l.qty, DECAY[l.good]));
  w.listings = w.listings.filter((l) => l.qty > 0);
  for (const p of w.people) for (const g of GOODS) if (p.inv[g] > 0) p.inv[g] = Math.max(0, Math.floor(p.inv[g]) - lose(Math.floor(p.inv[g]), DECAY[g]));
  for (const l of w.listings) {
    const s = findPerson(w, l.sellerId);
    if (s && s.npc && (w.day + l.id.length + l.id.charCodeAt(l.id.length - 1)) % 2 === 0) l.price = sellerPrice(w, s, l.good);
  }
}

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
  maybeChronicle(w, text);
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

// src/sim/herdpos.ts
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function placeAnimals(w, now) {
  const out = [];
  const B = new Map(w.buildings.map((b2) => [b2.id, b2]));
  const pen = B.get("hayvan");
  const farm = B.get("ciftlik");
  for (const p of w.people) {
    const hd = p.animals;
    if (!hd) continue;
    const area = p.prof === "hayvanci" ? pen : p.farm ? farm : null;
    for (const kind of ["inek", "koyun", "tavuk", "at"]) {
      const n2 = Math.min(kind === "tavuk" ? 8 : 5, hd[kind] - (kind === "at" && p.riding ? 1 : 0));
      if (n2 <= 0) continue;
      for (let i = 0; i < n2; i++) {
        const h = hash(p.id + kind + i);
        let bx, by, bw, bh;
        if (area) {
          const sub = area === farm ? hash(p.id) % 6 : 0;
          bw = area === farm ? Math.min(4, area.w / 3) : area.w - 1.2;
          bh = area === farm ? Math.min(3.5, area.h / 2) : area.h - 1.2;
          bx = area.x + 0.6 + (area === farm ? sub % 3 * (area.w / 3) : 0);
          by = area.y + 0.8 + (area === farm ? Math.floor(sub / 3) * (area.h / 2) : 0);
        } else {
          const home = B.get(p.home);
          if (!home) continue;
          bx = home.door.x - 2.2;
          by = home.door.y + 0.3;
          bw = 2.6;
          bh = 0.8;
        }
        const P = 9e3 + h % 7e3;
        const ph = now / P + h % 997 / 997;
        const k = Math.floor(ph), f = ph - k;
        const spot = (j) => {
          const a = hash(p.id + kind + i + ":" + j);
          return [bx + a % 1e3 / 1e3 * bw, by + (a >>> 10) % 1e3 / 1e3 * bh];
        };
        const [ax, ay] = spot(k), [cx, cy] = spot(k + 1);
        const wf = kind === "tavuk" ? 0.25 : 0.4;
        const e = Math.min(1, f / wf);
        const s = e * e * (3 - 2 * e);
        out.push({ kind, x: ax + (cx - ax) * s, y: ay + (cy - ay) * s, dir: cx >= ax ? 1 : -1, moving: f < wf, owner: p.id });
      }
    }
  }
  return out;
}
var ANIMAL_REACH = 1.1;
function ownAnimals(w, p, kind, now) {
  return placeAnimals(w, now).filter((a) => a.owner === p.id && a.kind === kind);
}
function nearestOwnAnimal(w, p, kind, now, at) {
  return ownAnimals(w, p, kind, now).sort((a, b2) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b2.x - at.x, b2.y - at.y))[0];
}

// src/sim/goals.ts
var GOALS = {
  tuccar: { title: "Zengin T\xFCccar", label: "\u{1F4B0} Zengin t\xFCccar ol", desc: "Kesende 2.000 Dinar biriktir.", reward: 150, progress: (_w, p) => Math.min(1, p.money / 2e3) },
  meclisbaskani: {
    title: "Meclis Ba\u015Fkan\u0131",
    label: "\u{1F3DB} Meclis ba\u015Fkan\u0131 ol",
    desc: "Meclis\u2019e gir ve 8 vekilden itibar kazan (itibar 40+, 8 dost).",
    reward: 200,
    progress: (w, p) => (p.meclis ? 0.4 : 0) + Math.min(0.3, Math.max(0, p.rep) / 40 * 0.3) + Math.min(0.3, w.people.filter((x) => x.meclis && (x.relations[p.id] ?? 0) > 30).length / 8 * 0.3)
  },
  vezir: {
    title: "Vezir",
    label: "\u{1F4DC} Vezir ol",
    desc: "Kayzer\u2019in en g\xFCvendi\u011Fi ki\u015Fi ol: Kayzer\u2019le ili\u015Fki 60+, sadakat 80+, itibar 20+.",
    reward: 250,
    progress: (w, p) => {
      const k = findPerson(w, w.kayzerId);
      if (!k || k.id === p.id) return 0;
      const r = Math.max(k.relations[p.id] ?? 0, p.relations[k.id] ?? 0);
      return Math.min(1, Math.max(0, r) / 60 * 0.5 + p.loyalty / 80 * 0.3 + Math.max(0, p.rep) / 20 * 0.2) * (r >= 60 && p.loyalty >= 80 && p.rep >= 20 ? 1 : 0.99);
    }
  },
  asi: {
    title: "Gizli \u0130syan Lideri",
    label: "\u{1F5FD} Gizli isyan lideri ol",
    desc: "Gizlice 10 cumhuriyet\xE7iyi (70+) kendine ba\u011Fla (ili\u015Fki 30+). Yakalanma!",
    reward: 0,
    progress: (w, p) => Math.min(1, w.people.filter((x) => x.id !== p.id && x.republic >= 70 && (x.relations[p.id] ?? 0) > 30).length / 10)
  }
};
function setGoal(p, g) {
  if (!GOALS[g]) return "B\xF6yle bir hedef yok.";
  p.goal = g;
  return `Yeni hedefiniz: ${GOALS[g].label}. ${GOALS[g].desc}`;
}
function goalsDay(w) {
  for (const p of w.people) {
    if (!p.playerId || !p.goal) continue;
    const g = GOALS[p.goal];
    if (g.progress(w, p) < 1) continue;
    p.goalsDone = [...p.goalsDone ?? [], p.goal];
    if (!p.titles.includes(g.title)) p.titles.push(g.title);
    if (g.reward > 0 && transfer(w, "saray", p.id, g.reward, `hedef \xF6d\xFCl\xFC: ${g.title}`)) {
    }
    if (p.goal === "asi") {
      p.plotting = "revolution";
      personal(w, p.playerId, "\u{1F5FD} Art\u0131k gizli isyan liderisiniz! Bir isyan ba\u015Flarsa \xF6nder siz olursunuz.");
    } else log(w, `\u{1F3C5} ${p.name} \u201C${g.title}\u201D oldu!${g.reward ? ` (${g.reward} Dinar \xF6d\xFCl)` : ""}`, p.id);
    p.goal = void 0;
  }
}
function missionCreate(w, k, text, reward, to) {
  if (k.id !== w.kayzerId) return "Sadece Kayzer g\xF6rev verir.";
  const t = text.trim().slice(0, 200);
  if (t.length < 4) return "G\xF6revi yaz\u0131n.";
  const r = Math.max(0, Math.min(5e3, Math.round(reward)));
  if (r > w.treasury) return "Hazine bu \xF6d\xFCl\xFC kar\u015F\u0131layamaz.";
  const m = { id: nextId(w, "M"), text: t, reward: r, to, by: k.id, day: w.day, status: "acik" };
  (w.missions ??= []).push(m);
  if (w.missions.length > 40) w.missions.splice(0, w.missions.length - 40);
  const tp = findPerson(w, to);
  if (tp?.playerId) personal(w, tp.playerId, `\u{1F451} Kayzer size g\xF6rev verdi: \u201C${t}\u201D \u2013 \xF6d\xFCl ${r} Dinar.`);
  log(w, `\u{1F451} Kayzer g\xF6rev ilan etti: \u201C${t}\u201D (\xF6d\xFCl ${r} Dinar${tp ? `, ${tp.name} i\xE7in` : ", herkese a\xE7\u0131k"}).`, k.id);
  return "G\xF6rev ilan edildi.";
}
function missionClaim(w, p, id) {
  const m = w.missions?.find((x) => x.id === id);
  if (!m || m.status !== "acik") return "G\xF6rev a\xE7\u0131k de\u011Fil.";
  if (m.to && m.to !== p.id) return "Bu g\xF6rev size verilmedi.";
  m.status = "bildirildi";
  m.claimedBy = p.id;
  const k = findPerson(w, m.by);
  if (k?.playerId) personal(w, k.playerId, `\u{1F4DC} ${p.name} \u201C${m.text}\u201D g\xF6revini tamamlad\u0131\u011F\u0131n\u0131 bildirdi. Divan\u2019dan \xF6deyin ya da reddedin.`);
  return "Kayzer\u2019e bildirdiniz; onaylarsa \xF6d\xFCl\xFC al\u0131rs\u0131n\u0131z.";
}
function missionPay(w, k, id, pay) {
  if (k.id !== w.kayzerId) return "Sadece Kayzer.";
  const m = w.missions?.find((x) => x.id === id);
  if (!m || m.status !== "bildirildi") return "Bekleyen bildirim yok.";
  const p = findPerson(w, m.claimedBy);
  if (!p) {
    m.status = "iptal";
    return "Ki\u015Fi yok.";
  }
  if (!pay) {
    m.status = "acik";
    m.claimedBy = void 0;
    if (p.playerId) personal(w, p.playerId, `\u274C Kayzer \u201C${m.text}\u201D g\xF6revini tamamlanm\u0131\u015F saymad\u0131.`);
    return "Reddedildi; g\xF6rev yine a\xE7\u0131k.";
  }
  if (!transfer(w, "saray", p.id, m.reward, `g\xF6rev \xF6d\xFCl\xFC: ${m.text.slice(0, 30)}`)) return "Hazine yetmiyor.";
  m.status = "odendi";
  p.loyalty = Math.min(100, p.loyalty + 5);
  p.rep = Math.min(100, p.rep + 3);
  k.relations[p.id] = Math.min(100, (k.relations[p.id] ?? 0) + 10);
  log(w, `\u{1F451} ${p.name}, Kayzer\u2019in g\xF6revini tamamlad\u0131 ve ${m.reward} Dinar \xF6d\xFCl ald\u0131.`, p.id);
  return "\xD6d\xFCl verildi.";
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
  if (from.female === to.female) return "Evlilik sadece bir erkek ile bir kad\u0131n aras\u0131nda olur.";
  if (!adultFree(w, from)) return "Zaten evlisiniz.";
  if (!adultFree(w, to)) return `${to.name} evli ya da evlenemez.`;
  if (from.parents.some((x) => to.parents.includes(x)) || from.parents.includes(to.id) || to.parents.includes(from.id)) return "Akrabalar evlenemez.";
  if (w.proposals.some((x) => x.kind === "evlilik" && x.from === from.id)) return "Bekleyen bir teklifiniz var.";
  if (playerDecides(to)) {
    w.proposals.push({ id: nextId(w, "E"), kind: "evlilik", from: from.id, to: to.id, day: w.day });
    log(w, `${from.name}, ${ek(to.name, "a")} evlenme teklif etti.`, to.id);
    return `Teklif ${ek(to.name, "a")} iletildi; cevab\u0131n\u0131 bekleyin.`;
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
      if (from) log(w, `${me.name}, ${ek(from.name, "\u0131n")} evlenme teklifini reddetti.`, from.id);
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
    if (other.home !== "saray") {
      if (host.home.startsWith("ev") && freeSpots(w, host.home) <= 0) {
        const to = houses(w).find((x) => freeSpots(w, x.id) >= 2);
        if (to) {
          host.home = to.id;
          other.home = to.id;
        }
      } else other.home = host.home;
    }
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
  const houses2 = w.buildings.filter((b2) => b2.kind === "ev");
  const counts = /* @__PURE__ */ new Map();
  for (const x of w.people) counts.set(x.home, (counts.get(x.home) ?? 0) + 1);
  return [...houses2].sort((a, b2) => (counts.get(a.id) ?? 0) - (counts.get(b2.id) ?? 0))[0]?.id ?? "ev1";
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
  const ok3 = transfer(w, payer.id, baker?.id ?? "saray", CHILD_UPKEEP, "\xE7ocuk bak\u0131m\u0131");
  if (ok3 && c.inSchool) {
    const hoca = w.people.find((p) => p.prof === "hoca" && p.jailedDays === 0);
    transfer(w, payer.id, hoca?.id ?? "saray", fee - CHILD_UPKEEP, "okul \xFCcreti");
  }
  return ok3;
}
function cureChild(w, c, payer) {
  if (c.sick <= 0) return "\xC7ocuk hasta de\u011Fil.";
  const healer = w.people.find((p) => p.prof === "hekim" && p.jailedDays === 0);
  if (!healer) return "\u015Eehirde hekim yok!";
  if (!transfer(w, payer?.id ?? "saray", healer.id, CURE_FEE, "\xE7ocuk tedavisi")) return "Hekim paras\u0131 yetmiyor.";
  c.sick = 0;
  healer.incomeToday += CURE_FEE;
  log(w, `${healer.name}, ${ek(c.name, "\u0131")} iyile\u015Ftirdi.`, payer?.id);
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
function dethroneForJail(w, k) {
  if (w.kayzerId !== k.id || w.regime !== "imparatorluk") return null;
  const heir = heirOf(w, k);
  const sp = findPerson(w, k.spouse);
  const mae = w.people.find((p) => p.prof === "naip");
  let text;
  if (heir?.adult && findPerson(w, heir.id)) {
    const h = findPerson(w, heir.id);
    w.kayzerId = h.id;
    h.prof = "kayzer";
    h.work = "saray";
    h.home = "saray";
    h.soylu = true;
    h.jailedDays = 0;
    w.veliaht = null;
    text = `${k.name} zindana girdi\u011Fi i\xE7in taht\u0131 kaybetti. Varisi ${h.name} yeni Kayzer!`;
  } else if (heir && (sp?.jailedDays === 0 ? sp : mae)) {
    const reg = sp && sp.jailedDays === 0 ? sp : mae;
    w.kayzerId = reg.id;
    if (reg.prof !== "naip") {
      reg.prof = "kayzer";
      reg.work = "saray";
    }
    w.regentId = reg.id;
    w.regentFor = heir.id;
    text = `${k.name} zindana girdi\u011Fi i\xE7in taht\u0131 kaybetti. Veliaht ${nameOf(w, heir.id)} re\u015Fit olana dek ${reg.name} naip olarak tahtta.`;
  } else if (mae) {
    w.kayzerId = mae.id;
    text = `${k.name} zindana girdi\u011Fi i\xE7in taht\u0131 kaybetti. Varisi olmad\u0131\u011F\u0131ndan tahta ${mae.name} \xE7\u0131kt\u0131.`;
  } else return null;
  k.soylu = false;
  k.home = emptiestHouse(w);
  k.work = "pazar";
  k.sidedWith = null;
  w.exKayzerId = k.id;
  w.coup = null;
  log(w, `\u{1F451} ${text}`, k.id);
  chronicle(w, "taht", text);
  if (k.playerId) personal(w, k.playerId, "Zindana girdi\u011Finiz i\xE7in Kayzerlikten d\xFC\u015Ft\xFCn\xFCz. Taht\u0131 ancak bir isyana \xF6nderlik edip kazanarak ya da (cumhuriyette) Ba\u015Fkan se\xE7ilerek geri alabilirsiniz. Kurucu paneli sizde kal\u0131r.");
  return text;
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
var REBEL_MIN = 70;
var REBEL_SHARE = 0.5;
var populace = (w) => w.people.filter((p) => p.prof !== "naip" && p.id !== w.kayzerId && !(p.prof === "kayzer" && p.id !== w.exKayzerId) && !p.soylu);
function republicShare(w) {
  const a = populace(w);
  return a.filter((p) => p.republic >= REBEL_MIN).length / Math.max(1, a.length);
}
var discontent = (w, p) => p.prof !== "naip" && p.id !== w.kayzerId && p.jailedDays === 0 && p.exiledDays === 0 && !p.soylu && p.republic >= REBEL_MIN;
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
  const rebels = w.people.filter((p) => discontent(w, p));
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
  const claim = findPerson(w, i.leaderId);
  if (claim && claim.id === w.exKayzerId) {
    restoreClaimant(w, claim, old);
    return;
  }
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
function restoreClaimant(w, k, old) {
  const i = w.isyan;
  ilog(w, `Asiler Saray'\u0131 ald\u0131! ${old?.name ?? "Tahttaki"} indirildi; ${k.name} yeniden Kayzer!`, k.id);
  w.isyan = null;
  w.kayzerId = k.id;
  w.exKayzerId = null;
  w.regentId = null;
  w.regentFor = null;
  w.coup = null;
  k.prof = "kayzer";
  k.work = "saray";
  k.home = "saray";
  k.soylu = true;
  k.jailedDays = 0;
  k.exiledDays = 0;
  k.plotting = "none";
  if (old && old.id !== k.id && old.prof === "kayzer") {
    old.prof = "memur";
    old.work = "saray";
    old.home = emptiestHouse(w);
    old.soylu = false;
  }
  for (const p of w.people) {
    if (p.prof === "asker") p.loyalty = 60;
    if (i.rebels.includes(p.id)) {
      p.mood = clamp(p.mood + 10);
      p.loyalty = clamp(p.loyalty + 15);
    }
  }
  w.cumhuriyetDays = 0;
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
function opinion(w, p) {
  const bread = marketPrice(w, "ekmek");
  const opts = [];
  if (p.hunger > 70) opts.push("Bug\xFCn do\u011Fru d\xFCr\xFCst bir \u015Fey yemedim, karn\u0131m zil \xE7al\u0131yor.");
  if (p.thirst > 70) opts.push("Susuzluktan dudaklar\u0131m \xE7atlad\u0131, su da pahal\u0131.");
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
function addressOf(w, from) {
  if (from.id === w.kayzerId) return w.regime === "cumhuriyet" ? "Ba\u015Fkan\u0131m" : "\u0130mparatorum";
  if (from.soylu) return "efendim";
  if (["hakim", "savci"].includes(from.prof)) return `${PROF_LABEL[from.prof]} efendi`;
  if (["bekci", "asker", "memur", "tahsildar"].includes(from.prof)) return `${PROF_LABEL[from.prof].toLocaleLowerCase("tr")} efendi`;
  const first = from.name.split(" ").find((x) => !Object.values(PROF_LABEL).includes(x)) ?? from.name.split(" ")[0];
  return first;
}
function moodLine(p) {
  if (p.health < 40) return "hastay\u0131m, halim yok";
  if (p.hunger > 70) return "karn\u0131m a\xE7, idare ediyoruz";
  if (p.mood > 70) return "\xE7ok \u015F\xFCk\xFCr, keyfim yerinde";
  if (p.mood > 45) return "iyidir, idare ediyoruz";
  return "pek iyi de\u011Filim, i\u015Fler k\xF6t\xFC";
}
function gossipLine(w, npc) {
  const r = [...w.rumors ?? []].reverse().find((x) => x.about !== npc.id && w.day - x.day <= 4);
  if (r) return `Duydun mu? ${r.text}`;
  const e = [...w.events].reverse().find((x) => /evlendi|soyuldu|CİNAYET|yakaladı|doğdu|rüşvet|aday|kervan/.test(x.text) && w.day - x.day <= 2);
  return e ? `Duydun mu? ${e.text}` : null;
}
function replyTo(w, npc, from, text) {
  const t = text.toLocaleLowerCase("tr");
  const r = npc.relations[from.id] ?? 0;
  const cold = r < -30;
  const warm = r > 30;
  const ad = addressOf(w, from);
  const ruler = from.id === w.kayzerId;
  if (/\*{3,}/.test(text) || /aptal|salak|şerefsiz|defol|gerizekal|mal mısın/.test(t)) {
    rel(npc, from, ruler ? -4 : -12, "bana hakaret etti");
    return ruler ? pick(w, [`Esta\u011Ffurullah ${ad}, kalbimi k\u0131rd\u0131n\u0131z\u2026`, `Haddim de\u011Fil ${ad}, ama bu s\xF6z a\u011F\u0131r oldu.`]) : pick(w, ["A\u011Fz\u0131n\u0131 topla!", "Sana yak\u0131\u015Fmad\u0131 bu s\xF6z.", "Bunu unutmayaca\u011F\u0131m."]);
  }
  rel(npc, from, 2, "sohbet ettik");
  const parts = [];
  const greet = /merhaba|selam|^sa\b|\bsa\b|günaydın|iyi akşam|iyi günler|hayırlı/.test(t);
  const how = /nasılsın|naber|ne haber|nabıyon|napıyon|naptın|ne yapıyorsun|ne yapıyon|nasıl gidiyor|keyif|iyi misin|ne var ne yok/.test(t);
  if (greet) parts.push(cold ? "Selam." : `${pick(w, GREET)} ${ad}!`);
  if (how) parts.push(cold ? "\u0130dare ediyoruz, sana ne?" : `${moodLine(npc).replace(/^./, (c) => c.toLocaleUpperCase("tr"))} ${ad}. ${npc.lastAction && npc.lastAction !== "-" ? `Bug\xFCn ${npc.lastAction.replace(/^fazla mesai · /, "")}.` : `${PROF_LABEL[npc.prof]}l\u0131k yap\u0131yorum.`}`);
  const g = Object.keys(GOOD_LABEL).find((x) => t.includes(GOOD_LABEL[x].toLocaleLowerCase("tr")));
  if (g || /fiyat|kaç para|pahalı|ucuz|kaça/.test(t)) {
    const gg = g ?? "ekmek";
    const mine = PRODUCES[npc.prof]?.good === gg;
    const pr = marketPrice(w, gg);
    parts.push(`${GOOD_LABEL[gg]} \u015Fimdi ${pr.toFixed(2)} Dinar${pr > BASE_PRICE[gg] * 1.4 ? ", \xE7ok pahaland\u0131" : pr < BASE_PRICE[gg] * 0.8 ? ", ucuz say\u0131l\u0131r" : ""}.${mine ? ` Ben de sat\u0131yorum; ${warm ? "sana indirim yapar\u0131m." : "tezg\xE2h\u0131ma bak."}` : ""}`);
  }
  if (/sağlık|hasta|hekim|yaralı|ağrı/.test(t)) parts.push(npc.health > 70 ? "Sa\u011Fl\u0131\u011F\u0131m yerinde, \xE7ok \u015F\xFCk\xFCr." : npc.health > 40 ? "Biraz halsizim ama ayaktay\u0131m." : "\xC7ok hastay\u0131m, hekime param yetmiyor.");
  if (/\biş\b|işler|çalış|kazan|para/.test(t) && !/para ver|ödünç/.test(t)) parts.push(PRODUCES[npc.prof] ? `${PROF_LABEL[npc.prof]}l\u0131ktan bug\xFCn ${Math.round(npc.incomeToday)} Dinar kazand\u0131m. ${npc.money < 20 ? "Kesem bo\u015F say\u0131l\u0131r." : "Fena de\u011Fil."}` : `${PROF_LABEL[npc.prof]} olarak \xE7al\u0131\u015F\u0131yorum. ${npc.money < 20 ? "Maa\u015F az, ge\xE7inmek zor." : "Ge\xE7inip gidiyoruz."}`);
  if (/dedikodu|ne oldu|haber var|duydun|olay/.test(t)) parts.push(gossipLine(w, npc) ?? "Valla bug\xFCn ortal\u0131k sakin, bir \u015Fey duymad\u0131m.");
  if (/vergi|kayzer|imparator|saray|başkan|cumhuriyet|meclis|seçim|siyaset|devlet|hükümet/.test(t)) {
    if (ruler) parts.push(npc.loyalty > 60 ? `Allah sizi ba\u015F\u0131m\u0131zdan eksik etmesin ${ad}. Vergi %${w.taxRate}; ${w.taxRate > 14 ? "biraz a\u011F\u0131r geliyor halka." : "halk memnun."}` : `A\xE7\u0131k konu\u015Fay\u0131m m\u0131 ${ad}? Halk dertli; ${w.taxRate > 12 ? "vergiler a\u011F\u0131r," : ""} ${marketPrice(w, "ekmek") > BASE_PRICE.ekmek * 1.3 ? "ekmek pahal\u0131." : "saraydan ilgi bekliyor."}`);
    else parts.push(npc.republic > 60 ? "A\xE7\u0131k konu\u015Fay\u0131m: bu saltanat b\xF6yle gitmez. Meclis halk\u0131n sesi olmal\u0131." : npc.loyalty > 70 ? "Devletimize laf ettirmem; Kayzer ne yaparsa do\u011Fru yapar." : `Vergi %${w.taxRate}. ${w.taxRate > 14 ? "Fazla bence." : "Fena de\u011Fil."}`);
  }
  if (/namaz|cami|din|allah|hoca|vaaz|dua/.test(t)) parts.push(npc.din > 60 ? "Elhamd\xFClillah. \xD6\u011Fle namaz\u0131nda camide bulu\u015Fal\u0131m." : npc.din < 30 ? "Ben pek camiye gitmem, kusura bakma." : "Cumalar\u0131 giderim, in\u015Fallah.");
  if (/içki|meyhane|bar|şarap|rakı|içelim/.test(t)) parts.push(npc.din > 60 ? "T\xF6vbe! Ben i\xE7ki i\xE7mem." : "Ak\u015Fam meyhanede g\xF6r\xFC\u015Felim, bir kadeh benden!");
  if (/borç|para ver|yardım|ödünç/.test(t)) parts.push(ruler ? `Esta\u011Ffurullah ${ad}, benim size verece\u011Fim ne olabilir? Hazine sizin.` : warm && npc.money > 60 ? "Sen iyi adams\u0131n; 10 Dinar verebilirim, sonra konu\u015Furuz." : npc.money < 20 ? "Kendi kesem bo\u015F, kusura bakma." : "Para i\u015Fine kar\u0131\u015Fmam, sarrafa git.");
  if (/teşekkür|sağ ol|eyvallah|sağol/.test(t)) {
    rel(npc, from, 3, "kibar biri");
    parts.push(`Rica ederim ${ad}, her zaman.`);
  }
  if (/evlen|sevgili|aşk|güzelsin|yakışıklı/.test(t)) parts.push(npc.spouse ? "Ben evliyim, haddini bil!" : npc.female === from.female ? "Hay\u0131rd\u0131r? \xD6yle \u015Feylerden anlamam." : warm ? "Hmm\u2026 Ailemle konu\u015Fman laz\u0131m." : "Seni pek tan\u0131m\u0131yorum.");
  if (/adın|kimsin|tanış/.test(t)) parts.push(`Ben ${npc.name}, ${PROF_LABEL[npc.prof].toLocaleLowerCase("tr")}. ${findPerson(w, npc.spouse) ? `E\u015Fim ${findPerson(w, npc.spouse).name}.` : "Bek\xE2r\u0131m."}`);
  if (/hava|yağmur|kurak|sıcak/.test(t)) parts.push(w.nature?.kind === "kuraklik" ? "Kurakl\u0131k var, tarlalar kurudu." : w.nature?.kind === "sel" ? "Sel sular\u0131 evleri bast\u0131." : "Hava g\xFCzel, \u015F\xFCk\xFCr.");
  if (/yemek|aç|karnın|ekmek/.test(t) && !g) parts.push(npc.hunger < 60 ? "Bug\xFCn karn\u0131m tok." : "Bug\xFCn do\u011Fru d\xFCr\xFCst yemedim.");
  if (/görüşürüz|hoşça|allaha ısmarladık|bay bay|iyi geceler/.test(t)) parts.push(`G\xFCle g\xFCle ${ad}, yolun a\xE7\u0131k olsun.`);
  if (/\?$/.test(text.trim()) && parts.length <= (greet ? 1 : 0)) parts.push(pick(w, ["Vallahi bilemedim.", "Onu bir d\xFC\u015F\xFCneyim.", "Bunu sarayda sormak laz\u0131m."]) + " " + opinion(w, npc));
  if (!parts.length) return cold ? "Seninle konu\u015Facak bir \u015Feyim yok." : `${opinion(w, npc)}`;
  if (parts.length === 1 && greet && !cold) parts.push(opinion(w, npc));
  return parts.join(" ").slice(0, 280);
}
function chatHour(w, now, online) {
  if (w.hour < 7 || w.hour > 22) return;
  const awake = w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.exiledDays === 0 && p.prof !== "naip");
  w.talks = (w.talks ?? []).filter((x) => !x.at || now - x.at < 12e4 || w.day - x.day < 1).slice(-24);
  for (let i = 0; i < 4 && awake.length > 1; i += 1) {
    const a = pick(w, awake);
    const near = awake.filter((b3) => b3 !== a && (b3.work === a.work || b3.home === a.home));
    const b2 = near.length ? pick(w, near) : pick(w, awake);
    if (a === b2) continue;
    const line = opinion(w, a);
    const agree = Math.abs(a.republic - b2.republic) < 25 && Math.abs(a.din - b2.din) < 30;
    const answer = agree ? `${pick(w, ["Hakl\u0131s\u0131n.", "Aynen \xF6yle.", "Do\u011Fru s\xF6ylersin."])} ${opinion(w, b2)}` : `${pick(w, ["Kat\u0131lm\u0131yorum.", "Abartma bence.", "\xD6yle deme."])} ${opinion(w, b2)}`;
    w.talks.push({ a: a.id, b: b2.id, text: line.slice(0, 80), lines: [line, answer], day: w.day, hour: w.hour, at: now + i * 9e3 });
    rel(a, b2, agree ? 2 : -1, agree ? "sohbetimiz tatl\u0131" : "fikirlerimiz uyu\u015Fmuyor");
    rel(b2, a, agree ? 2 : -1, agree ? "sohbetimiz tatl\u0131" : "fikirlerimiz uyu\u015Fmuyor");
  }
  if (chance(w, 0.35)) {
    const a = pick(w, awake);
    const gsp = gossipLine(w, a);
    if (gsp) say(w, a, null, `\u{1F5E3} ${gsp.replace(/^Duydun mu\? /, pick(w, ["Duydunuz mu? ", "Ahali, haberiniz var m\u0131? ", "Kula\u011F\u0131ma geldi: "]))}`, now);
  }
  for (const p of w.people.filter((x) => x.playerId && online(x))) {
    if (!chance(w, 0.12)) continue;
    const friends = awake.filter((x) => (x.relations[p.id] ?? 0) > 10);
    const n2 = friends.length && chance(w, 0.6) ? pick(w, friends) : pick(w, awake);
    approach(w, n2, p, now);
  }
}
function approach(w, n2, p, now) {
  const kind = pick(w, ["sohbet", "sohbet", "rica", "mal", "davet", "rusvet"]);
  if (kind === "rica" && n2.money < 20) {
    w.offers.push({ id: nextId(w, "O"), from: n2.id, to: p.id, kind: "borc", amount: 10, day: w.day, text: `${n2.name} 10 Dinar bor\xE7 istiyor` });
    say(w, n2, p.id, `${p.name.split(" ")[0]}, ay\u0131pt\u0131r s\xF6ylemesi kesem bo\u015F. 10 Dinar verir misin? Geri \xF6derim, bu iyili\u011Fi unutmam. (Aile/Teklifler)`, now);
    return;
  }
  const g = PRODUCES[n2.prof]?.good;
  if (kind === "mal" && g && n2.inv[g] + w.listings.filter((l) => l.sellerId === n2.id && l.good === g).reduce((s, l) => s + l.qty, 0) > 2) {
    const price = Math.round(marketPrice(w, g) * 0.9 * 100) / 100;
    w.offers.push({ id: nextId(w, "O"), from: n2.id, to: p.id, kind: "mal", good: g, qty: 3, price, day: w.day, text: `${n2.name}: 3 ${GOOD_LABEL[g]}, tanesi ${price}` });
    say(w, n2, p.id, `Sana \xF6zel: 3 ${GOOD_LABEL[g]} tanesi ${price} Dinar, pazardan ucuz. \u0130ster misin? (Teklifler)`, now);
    return;
  }
  if (kind === "rusvet" && ["bekci", "tahsildar", "savci", "hakim", "memur"].includes(p.prof) && n2.honesty < 45 && n2.money > 40) {
    w.offers.push({ id: nextId(w, "O"), from: n2.id, to: p.id, kind: "rusvet", amount: 15, day: w.day, text: `${n2.name} 15 Dinar kar\u015F\u0131l\u0131\u011F\u0131 g\xF6z yumman\u0131z\u0131 istiyor` });
    say(w, n2, p.id, `Psst\u2026 ${PROF_LABEL[p.prof]} efendi, 15 Dinar'\u0131m var; benim i\u015Flere biraz g\xF6z yumsan? (Teklifler)`, now);
    return;
  }
  if (kind === "davet") {
    say(w, n2, p.id, n2.din > 55 ? "\xD6\u011Fle namaz\u0131nda camide bulu\u015Fal\u0131m m\u0131?" : "Ak\u015Fam meyhanede bir kadeh i\xE7elim mi? Benden!", now);
    return;
  }
  say(w, n2, p.id, `${pick(w, GREET)}! ${opinion(w, n2)}`, now);
  void clamp;
}
function playerSaid(w, from, text, toPersonId, now, defer = false) {
  const out = [];
  const emit = (npc, to, line, delay, outcome) => {
    out.push({ npc, fallback: line, outcome });
    if (!defer) say(w, npc, to, line, now + delay);
  };
  if (toPersonId) {
    const npc = findPerson(w, toPersonId);
    if (!npc || npc.playerId) return out;
    const ord = npc.prof !== "naip" || from.id === w.kayzerId ? parseIntent(w, npc, from, text) : null;
    if (ord) {
      const r = handleOrder(w, from, npc, ord, text, now);
      emit(npc, from.id, r.reply, 1200, `${r.d.ok ? "KABUL ETT\u0130N ve \u015Fimdi yapmaya gidiyorsun" : "REDDETT\u0130N (" + r.d.code + ")"}: ${orderLabel(w, r.o)}`);
      return out;
    }
    if (npc.prof === "naip") emit(npc, from.id, from.id === w.kayzerId ? `${/nab|nası|naber|merhaba|selam/i.test(text) ? "\u0130yiyim " + addressOf(w, from) + ", sa\u011F olun. " : ""}Buyurun ${addressOf(w, from)}, emrinizdeyim. Devlet i\u015Fleri yolunda; dilek\xE7eler Saray\u2019da bekliyor.` : "Devlet i\u015Flerinde size yard\u0131mc\u0131 olmak g\xF6revimdir. Dilek\xE7elerinizi Saray\u2019a yaz\u0131n.", 1200);
    else if (npc.jailedDays > 0) emit(npc, from.id, `Zindanday\u0131m ${addressOf(w, from)}\u2026 ${replyTo(w, npc, from, text)}`, 1200);
    else emit(npc, from.id, replyTo(w, npc, from, text), 1200);
    return out;
  }
  const t = text.toLocaleLowerCase("tr");
  const named = w.people.filter((p) => !p.playerId && p.prof !== "naip" && p.name.split(" ").some((x) => x.length > 2 && t.includes(x.toLocaleLowerCase("tr"))));
  const bystanders = w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.prof !== "naip");
  const responders = named.length ? named.slice(0, 2) : chance(w, 0.8) && bystanders.length ? [pick(w, bystanders)] : [];
  responders.forEach((npc, i) => emit(npc, null, `@${from.name.split(" ").slice(-1)[0]} ${replyTo(w, npc, from, text)}`, 1500 * (i + 1)));
  return out;
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
      log(w, `HAC\u0130Z: ${s.name}, borcunu \xF6demeyen ${ek(d.name, "\u0131n")} ${seized} e\u015Fyas\u0131na el koydu.`, d.id);
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
  const houses2 = w.buildings.filter((b2) => b2.kind === "ev");
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
    if (!ids.has(p.home)) p.home = houses2[i++ % houses2.length].id;
    if (!ids.has(p.work)) p.work = WORKPLACE[p.prof];
    p.inv.su = Math.max(p.inv.su, 3);
    p.inv.ekmek = Math.max(p.inv.ekmek, 2);
  }
  const TARGET = { ciftci: 5, firinci: 5, sucu: 8, dokumaci: 3, mobilyaci: 2, barci: 2, kasap: 4, balikci: 6, terzi: 3, demirci: 3, marangoz: 4, hamal: 6, insaatci: 8 };
  const count = (pr) => w.people.filter((x) => x.prof === pr).length;
  const titled = (p) => / /.test(p.name) && Object.values(PROF_LABEL).some((l) => p.name.startsWith(l + " "));
  for (const [need, n2] of Object.entries(TARGET)) {
    while (count(need) < n2) {
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
      if (s.home === p.home && s.home !== "saray") s.home = houses2[randInt(w, 0, houses2.length - 1)].id;
      log(w, `${p.name} ile ${ek(s.name, "\u0131n")} evlili\u011Fi ge\xE7ersiz say\u0131ld\u0131 (evlilik bir kad\u0131n ile bir erkek aras\u0131nda olur).`);
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
  if ((w.schema ?? 1) >= 3) return migrate10(migrate4(w));
  const any = w;
  for (const [k, v] of Object.entries({ customLaws: [], suspicion: {}, treasuryBook: [], priceHist: {}, serving: [] })) if (any[k] === void 0) any[k] = v;
  if (w.granary < 800) w.granary = 800;
  w.schema = 3;
  return migrate10(migrate4(w));
}

// src/sim/hooks.ts
var startIsyanHook = { fn: () => {
} };

// src/sim/tick.ts
var hourMs = (w) => HOUR_MS / (w.speed > 0 ? w.speed : 1);
var ELECTION_EVERY = 40;
function electionDates(w) {
  const n2 = w.election.nextDay;
  return { adayFrom: n2 - 11, adayTo: n2 - 7, propFrom: n2 - 6, propTo: n2 - 1, vote: n2 };
}
function electionPhase(w) {
  const n2 = w.election.nextDay;
  const d = w.day;
  const s = electionDates(w);
  if (d >= s.adayFrom && d <= s.adayTo) return { phase: "aday", label: `Meclis: adayl\u0131k a\xE7\u0131k (${s.adayTo}. g\xFCne kadar), se\xE7im ${n2}. g\xFCn` };
  if (d >= s.propFrom && d <= s.propTo) return { phase: "propaganda", label: `Meclis: propaganda d\xF6nemi (${s.propTo}. g\xFCne kadar), se\xE7im ${n2}. g\xFCn` };
  if (d === n2) return { phase: "oylama", label: "Meclis: BUG\xDCN SE\xC7\u0130M \u2014 oy verin!" };
  return { phase: "bekleme", label: `Meclis se\xE7imi ${n2}. g\xFCn (adayl\u0131k ${s.adayFrom}. g\xFCn a\xE7\u0131l\u0131r)` };
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
  needsDrain(w, (p) => eatMeal(w, p), (p) => drinkWater(w, p));
  lifeHour(w);
  energyHour(w, w.serverNow ?? w.lastTickAt);
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
    for (const p of w.people) if (fullAI(p) && p.ambition > 60 && p.jailedDays === 0 && p.prof !== "naip" && p.prof !== "asker" && p.prof !== "bekci" && p.id !== w.kayzerId && !e.candidates.includes(p.id) && chance(w, 0.25) && e.candidates.length < 14) {
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
  let n2 = lawParam(w, "devletekmegi", 12);
  const needy = [...w.people].filter((p) => p.prof !== "naip" && p.prof !== "kayzer").sort((a, b2) => a.money - a.hunger - (b2.money - b2.hunger));
  for (const p of needy) {
    if (n2 <= 0 || p.money > 30) break;
    const before = w.treasury;
    const got = buy(w, "saray", "ekmek", 1, 6);
    if (!got) break;
    p.inv.ekmek += 1;
    n2 -= 1;
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
      if (!fullAI(a) && !(hakim?.playerId && !hakim.npc)) {
        if (!c.trial) startTrial(w, c, now);
        continue;
      }
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
    if (a.id === w.kayzerId) dethroneForJail(w, a);
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
  goalsDay(w);
  housingDay(w);
  seasonDay(w);
  hayvanciDay(w);
  animalsDay(w);
  nobilityDay(w);
  intrigueDay(w);
  orgsDay(w);
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
  const adults2 = w.people.filter((p) => p.prof !== "naip" && p.prof !== "kayzer" && !p.soylu);
  const share = adults2.filter((p) => p.republic >= 70).length / Math.max(1, adults2.length);
  const loy = adults2.reduce((s, p) => s + p.loyalty, 0) / Math.max(1, adults2.length);
  void share;
  void loy;
  void armyLoyalty;
  const hot = republicShare(w) >= REBEL_SHARE;
  if (hot) w.cumhuriyetDays += 1;
  else w.cumhuriyetDays = 0;
  if (hot && w.kayzerId && w.regime === "imparatorluk" && !w.isyan) {
    w.cumhuriyetDays = 0;
    startIsyan(w);
  }
}
function election(w) {
  baskanElection(w);
  const e = w.election;
  if (w.day < e.nextDay) return;
  meclisElection(w, e.candidates, e.votes, fullAI);
  w.election = { ...e, nextDay: w.day + ELECTION_EVERY, candidates: [], votes: {}, posters: {} };
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
startIsyanHook.fn = startIsyan;

// src/sim/move.ts
var WALK_SPEED = 3.6;
var REACH = 2.2;
var PERSON_REACH = 1.3;
var rules = { reach: true };
var OPEN = /* @__PURE__ */ new Set(["pazar", "kahve", "festival", "ciftlik", "arsa", "santiye", "liman", "yapi"]);
var gridKey = "";
var grid = new Uint8Array(0);
function walkGrid(w) {
  const key = `${w.buildings.length}:${w.buildings.map((b2) => b2.kind[0]).join("")}`;
  if (key === gridKey) return grid;
  const g = new Uint8Array(MAP_W * MAP_H).fill(1);
  for (let y = 48; y < MAP_H; y += 1) for (let x = 0; x < MAP_W; x += 1) g[y * MAP_W + x] = 0;
  for (const b2 of w.buildings) {
    if (OPEN.has(b2.kind)) {
      if (b2.kind === "liman") for (let y = b2.y; y < Math.min(MAP_H, b2.y + b2.h + 3); y += 1) for (let x = b2.x; x < b2.x + b2.w; x += 1) g[y * MAP_W + x] = 1;
      continue;
    }
    for (let y = b2.y; y < b2.y + b2.h; y += 1) for (let x = b2.x; x < b2.x + b2.w; x += 1) if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y * MAP_W + x] = 0;
  }
  gridKey = key;
  grid = g;
  return g;
}
var ok = (g, x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && g[y * MAP_W + x] === 1;
function nearestFree(g, x, y) {
  const cx = Math.max(0, Math.min(MAP_W - 1, Math.floor(x))), cy = Math.max(0, Math.min(MAP_H - 1, Math.floor(y)));
  if (ok(g, cx, cy)) return { x: cx, y: cy };
  for (let r = 1; r < 20; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (ok(g, cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
  }
  return { x: cx, y: cy };
}
function findPath(w, from, to) {
  const g = walkGrid(w);
  const s = nearestFree(g, from.x, from.y), t = nearestFree(g, to.x, to.y);
  const N = MAP_W * MAP_H;
  const idx = (x, y) => y * MAP_W + x;
  const gs = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open = [];
  const f = new Float32Array(N).fill(Infinity);
  const hh = (i) => {
    const x = i % MAP_W, y = i / MAP_W | 0;
    const dx = Math.abs(x - t.x), dy = Math.abs(y - t.y);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const si = idx(s.x, s.y), ti = idx(t.x, t.y);
  gs[si] = 0;
  f[si] = hh(si);
  open.push(si);
  let iter = 0;
  while (open.length && iter++ < 2e4) {
    let bi = 0;
    for (let k = 1; k < open.length; k += 1) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === ti) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % MAP_W, cy = cur / MAP_W | 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!ok(g, nx, ny)) continue;
      if (dx && dy && (!ok(g, cx + dx, cy) || !ok(g, cx, cy + dy))) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const ng = gs[cur] + (dx && dy ? 1.414 : 1);
      if (ng < gs[ni]) {
        gs[ni] = ng;
        came[ni] = cur;
        f[ni] = ng + hh(ni);
        open.push(ni);
      }
    }
  }
  if (came[ti] === -1 && ti !== si) return [from, to];
  const raw = [];
  for (let i = ti; i !== -1; i = came[i]) {
    raw.push({ x: i % MAP_W + 0.5, y: (i / MAP_W | 0) + 0.5 });
    if (i === si) break;
  }
  raw.reverse();
  const clear = (a, b2) => {
    const d = Math.hypot(b2.x - a.x, b2.y - a.y);
    const n2 = Math.ceil(d * 3);
    for (let k = 0; k <= n2; k += 1) {
      const x = a.x + (b2.x - a.x) * k / n2, y = a.y + (b2.y - a.y) * k / n2;
      if (!ok(g, Math.floor(x), Math.floor(y)) || !ok(g, Math.floor(x + 0.3), Math.floor(y)) || !ok(g, Math.floor(x - 0.3), Math.floor(y))) return false;
    }
    return true;
  };
  const out = [{ x: from.x, y: from.y }];
  let anchor = out[0];
  for (let i = 1; i < raw.length; i += 1) {
    if (!clear(anchor, raw[i])) {
      out.push(raw[i - 1]);
      anchor = raw[i - 1];
    }
  }
  const end = ok(g, Math.floor(to.x), Math.floor(to.y)) ? to : raw[raw.length - 1] ?? to;
  out.push(end);
  return out;
}
function pathLength(p) {
  let d = 0;
  for (let i = 1; i < p.length; i += 1) d += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  return d;
}
function walkPos(wk, now) {
  let t = Math.max(0, (now - wk.t0) / 1e3) * wk.speed;
  for (let i = 1; i < wk.path.length; i += 1) {
    const a = wk.path[i - 1], b2 = wk.path[i];
    const d = Math.hypot(b2.x - a.x, b2.y - a.y);
    if (t <= d) {
      const k = d ? t / d : 1;
      return { pt: { x: a.x + (b2.x - a.x) * k, y: a.y + (b2.y - a.y) * k }, moving: true, dir: b2.x < a.x ? -1 : 1 };
    }
    t -= d;
  }
  return { pt: wk.path[wk.path.length - 1], moving: false, dir: 1 };
}
function walkEnd(wk) {
  return wk.t0 + pathLength(wk.path) / wk.speed * 1e3;
}
function distToBuilding(b2, p) {
  const ext = b2.kind === "liman" ? 3 : 0;
  const dx = Math.max(b2.x - p.x, 0, p.x - (b2.x + b2.w));
  const dy = Math.max(b2.y - p.y, 0, p.y - (b2.y + b2.h + ext));
  return Math.hypot(dx, dy);
}
function doorSpot(b2) {
  return OPEN.has(b2.kind) && b2.kind !== "liman" ? { x: b2.x + b2.w / 2, y: b2.y + b2.h / 2 } : { x: b2.door.x + 0.5, y: b2.door.y + 0.6 };
}
var MARKET_IDS = (w) => w.buildings.filter((b2) => b2.market).map((b2) => b2.id);
var RULER = ["answer", "setTax", "setHeadTax", "setSalary", "toggleLaw", "startProject", "appoint", "pardon", "enactLaw", "repealLaw", "sanction", "directive", "granary", "priceCap", "tribute", "festivalOpen", "festival", "buildAt", "veliaht", "abdicate", "petition"];
function actionNeed(w, me, a) {
  const B = (ids, label) => ({ kind: "building", ids: ids.filter((id) => w.buildings.some((b2) => b2.id === id)), label });
  switch (a.t) {
    case "buy":
    case "sell":
      return B(MARKET_IDS(w), "bir pazara");
    case "caravanBuy":
      return B([...MARKET_IDS(w), "liman"], "pazara ya da limana");
    case "eat":
      return B([...MARKET_IDS(w), "firin", "kasaphane", "bar", me.home], "evinize, f\u0131r\u0131na ya da bir pazara");
    case "askida":
      return B(["firin"], "F\u0131r\u0131n\u2019a");
    case "buyHome":
    case "rentHome":
      return B([a.houseId], "eve");
    case "goHome":
      return me.home ? B([me.home], "evinize") : null;
    case "buyFarm":
    case "buyAnimal":
      return B(["hayvan"], "Hayvan Pazar\u0131\u2019na");
    case "slaughter":
      return { kind: "animal", animal: a.animal };
    case "ride":
      return a.on ? { kind: "animal", animal: "at" } : null;
    case "buildBarn":
    case "feedAnimals":
    case "collectFarm":
      return B(["ciftlik"], "\xE7iftli\u011Finize (Bu\u011Fday Tarlalar\u0131)");
    case "grantTitle":
    case "stripTitle":
    case "assignSpy":
    case "warrant":
    case "raidOrg":
    case "informantPay":
      return B(["saray"], "Saray\u2019a");
    case "searchHouse": {
      const t = w.people.find((p) => p.id === a.personId);
      return t ? B([t.home], "\u015F\xFCphelinin evine") : null;
    }
    case "drinkWater":
      return B(["kuyu", "gida", "pazar", me.home], "kuyuya, evinize ya da pazara");
    case "pray":
    case "sermon":
      return B(["cami"], "Cami\u2019ye");
    case "drink":
      return B(["bar"], "Meyhane\u2019ye");
    case "doctor":
    case "cure":
      return B(["hekimhane"], "Hekimhane\u2019ye");
    case "school":
      return B(["okul"], "Okul\u2019a");
    case "work":
      return B([me.work, "santiye"], "i\u015F yerinize");
    case "witness": {
      const c = w.cases.find((x) => x.id === a.caseId);
      if (c?.trial && !c.trial.done && ((c.eyeIds ?? []).includes(me.id) || c.trial.blamedId === me.id || (c.called ?? []).some((x) => x.id === me.id))) return null;
      return B(["mahkeme"], "Mahkeme\u2019ye");
    }
    // summoned / eyewitness speak from the popup
    case "caseDecision":
    case "defend":
      return B(["mahkeme"], "Mahkeme\u2019ye");
    case "customize":
      return a.where === "terzi" ? B(["dokuma"], "Terzi\u2019ye (Dokuma Tezg\xE2h\u0131)") : a.where === "berber" ? B(["atolye"], "Berber\u2019e (Zanaat At\xF6lyesi)") : null;
    case "runForMeclis":
    case "castVote":
    case "speak":
    case "propose":
    case "joinFaction":
    case "vote":
    case "runForBaskan":
    case "voteBaskan":
      return B(["meclis", "pazar"], "Meclis\u2019e ya da Meydan\u2019daki sand\u0131\u011Fa");
    case "poster":
    case "campaign":
      return B(["pazar"], "Meydan\u2019a (Pazar)");
    case "plot":
    case "fundPlot":
      return B(["kisla", "bar"], "K\u0131\u015Fla\u2019ya ya da Meyhane\u2019ye");
    case "seize":
      return B(["saray"], "Saray\u2019a");
    case "borrow":
    case "repay":
      return B(["pazar", "kahve"], "Pazar\u2019daki sarrafa");
    case "steal":
    case "assault":
    case "kill":
    case "insult":
    case "give":
    case "bribe":
    case "arrest":
    case "inspect":
    case "marry":
      if (a.t === "give" && a.personId === me.id) return null;
      return { kind: "person", id: a.personId };
    case "report":
      return { kind: "person", id: `corpse:${a.corpseId}` };
    default:
      break;
  }
  if (RULER.includes(a.t)) return B(["saray"], "Saray\u2019a");
  return null;
}

// src/sim/place.ts
var TALK_MS = 45e3;
var ESCORT_MS = 18e3;
var PLAYER_POS_MS = 15 * 6e4;
function hash2(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function nearestRoad(y) {
  return ROADS_Y.reduce((a, r) => Math.abs(r - y) < Math.abs(a - y) ? r : a, ROADS_Y[0]);
}
function route(a, b2) {
  const ry = nearestRoad(a.y);
  const ry2 = nearestRoad(b2.y);
  const rx = ROADS_X.reduce((acc, r) => Math.abs(r - b2.x) < Math.abs(acc - b2.x) ? r : acc, ROADS_X[0]);
  if (ry === ry2) return [a, { x: a.x, y: ry + 0.5 }, { x: b2.x, y: ry + 0.5 }, b2];
  return [a, { x: a.x, y: ry + 0.5 }, { x: rx + 0.5, y: ry + 0.5 }, { x: rx + 0.5, y: ry2 + 0.5 }, { x: b2.x, y: ry2 + 0.5 }, b2];
}
function along(path, f) {
  let total = 0;
  const seg = [];
  for (let i = 1; i < path.length; i += 1) {
    const d = Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
    seg.push(d);
    total += d;
  }
  let t = f * total;
  for (let i = 1; i < path.length; i += 1) {
    const d = seg[i - 1];
    if (t <= d || i === path.length - 1) {
      const k = d ? Math.min(1, t / d) : 1;
      const p0 = path[i - 1], p1 = path[i];
      return { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k };
    }
    t -= d;
  }
  return path[path.length - 1];
}
var MARKETS = ["pazar", "gida", "zanaat", "yeni", "kahve"];
var dayPlan = /* @__PURE__ */ new Map();
var NPC_SPEED = 2.4;
function playerWalking(w, p, now) {
  if (!p.walk) return false;
  if (p.task) return true;
  if (!p.playerId) return false;
  const pl = w.players[p.playerId];
  return !!pl && now - pl.lastSeen < PLAYER_POS_MS;
}
function scheduled(w, p, now, ctx) {
  const { t, night, B, door, site, festOpen } = ctx;
  const h = hash2(p.id);
  const market = p.prof === "memur" || p.prof === "tahsildar" ? "kahve" : MARKETS[h % 4];
  let work = p.work;
  if (p.prof === "insaatci" && site) work = site;
  if (festOpen && t >= 12 && t < 20 && h % 3 === 0) work = "festival";
  const home = p.home;
  const off = h % 60 / 60;
  const s1 = 5.5 + off, s3 = 17 + off, s5 = 20.5 + off, s6 = 22 + off;
  let pos;
  let moving = false;
  let visible = true;
  const wanderX = Math.sin(now / 2300 + h) * 0.9 + Math.sin(now / 5100 + h * 3) * 0.6;
  const wanderY = Math.cos(now / 3100 + h * 2) * 0.35;
  const walking = Math.abs(Math.cos(now / 2300 + h)) > 0.35;
  if (p.prof === "asker") {
    const at = h % 3 === 0 ? "saray" : "kisla";
    pos = door(B.has(at) ? at : "saray", p, 2.4);
    pos.x += wanderX * 0.3;
    moving = false;
    visible = at === "saray" || !night || h % 2 === 0;
  } else if (p.prof === "bekci" && bekciShift(p) === "gece" === night) {
    const k = (now / 5e4 + h % 10 / 10) % 1;
    const route2 = night ? [{ x: 6, y: 29.5 }, { x: 80, y: 29.5 }, { x: 80, y: 35.5 }, { x: 6, y: 35.5 }, { x: 6, y: 29.5 }] : [{ x: 30, y: 20.5 }, { x: 80, y: 20.5 }, { x: 80, y: 29.5 }, { x: 30, y: 29.5 }, { x: 30, y: 20.5 }];
    pos = along(route2, k);
    moving = true;
  } else if (p.prof === "bekci" && false) {
    const k = (now / 5e4 + h % 10 / 10) % 1;
    pos = along([{ x: 6, y: 29.5 }, { x: 80, y: 29.5 }, { x: 80, y: 35.5 }, { x: 6, y: 35.5 }, { x: 6, y: 29.5 }], k);
    moving = true;
  } else if (p.nightOut && night) {
    const k = (now / 6e4 + h % 10 / 10) % 1;
    const bb = B.get("bar");
    pos = along([{ x: bb.door.x, y: bb.door.y + 0.5 }, { x: bb.door.x, y: 20.5 }, { x: 44, y: 20.5 }, { x: 44, y: 29.5 }, { x: bb.door.x, y: 29.5 }, { x: bb.door.x, y: bb.door.y + 0.5 }], k);
    moving = true;
  } else {
    const dh = hash2(p.id + ":" + w.day);
    const fk = `${w.seed}:${p.id}:${w.day}`;
    let plan0 = dayPlan.get(fk);
    if (!plan0) {
      const friend = Object.entries(p.relations).filter(([id, r]) => r > 25 && id !== p.id).sort((a, b2) => b2[1] - a[1])[dh % 3]?.[0];
      const fHome = (friend ? w.people.find((x) => x.id === friend)?.home : void 0) ?? "";
      plan0 = { pious: p.din > 68 && dh % 3 === 0, eve: p.din > 70 && dh % 2 === 0 ? "cami" : p.din < 35 && dh % 3 === 0 && B.has("bar") ? "bar" : fHome && fHome !== home && dh % 4 === 1 ? fHome : market };
      if (dayPlan.size > 4e3) dayPlan.clear();
      dayPlan.set(fk, plan0);
    }
    const eve = plan0.eve;
    const lunch = plan0.pious ? "cami" : market;
    const workP = door(work, p);
    const lunchCands = (plan0.pious ? ["cami"] : ["kahve", market, "kuyu", "gida", "pazar"]).filter((id) => B.has(id));
    const lunchP = lunchCands.map((id) => door(id, p, 2.2)).sort((x, y) => Math.abs(x.x - workP.x) + Math.abs(x.y - workP.y) - Math.abs(y.x - workP.x) - Math.abs(y.y - workP.y))[dh % 2 && lunchCands.length > 1 ? 1 : 0] ?? door(lunch, p, 2.2);
    const L1 = 11.8 + off * 0.6, L3 = L1 + 1.3;
    const plan = [[s1, workP, 1.2], [L1, lunchP, 0.9], [L3, workP, 1.2], [s3, door(eve, p, 2.2), eve === market ? 1.8 : 0.8], [s5, door(home, p), 0]];
    const hs = hourMs(w) / 1e3;
    let cur = door(home, p);
    let free = 0;
    let rad = 0;
    let arrived = true;
    visible = t >= s1 && t < s6;
    const idle = (at, r) => {
      const st = stroll(p, now, r);
      pos = { x: at.x + st.dx, y: at.y + st.dy };
      moving = st.moving;
    };
    pos = cur;
    for (const [start, dest, r] of plan) {
      if (t < start) break;
      const t0 = Math.max(start, free);
      if (t < t0) {
        break;
      }
      let from = cur;
      if (rad > 0) {
        const st = stroll(p, now - (t - t0) * hs * 1e3, rad);
        from = { x: cur.x + st.dx, y: cur.y + st.dy };
      }
      const path = route(from, dest);
      let len = 0;
      for (let i = 1; i < path.length; i += 1) len += Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
      const walked = (t - t0) * hs * NPC_SPEED;
      if (walked < len) {
        pos = along(path, walked / len);
        moving = true;
        arrived = false;
        rad = -1;
        break;
      }
      cur = dest;
      free = t0 + len / NPC_SPEED / hs;
      rad = r;
      arrived = true;
    }
    if (rad >= 0) {
      if (rad > 0) idle(cur, rad);
      else pos = cur;
    }
    if (!arrived) visible = true;
    void lunch;
    void wanderY;
    void walking;
  }
  if (p.id === w.kayzerId || p.prof === "naip" || p.soylu && p.home === "saray") {
    pos = door("saray", p, 2);
    pos.x += wanderX * 0.7;
    moving = walking;
    visible = !night || !!p.nightOut;
  }
  return { p, x: pos.x, y: pos.y, moving, visible, dir: 1 };
}
function stroll(p, now, r) {
  const h = hash2(p.id);
  const P = 14e3 + h % 9e3;
  const ph = now / P + h % 1e3 / 1e3;
  const k = Math.floor(ph);
  const f = ph - k;
  const spot = (i) => {
    const a2 = hash2(p.id + "#" + i);
    return { x: (a2 % 1e3 / 1e3 - 0.5) * 2 * r, y: ((a2 >> 10) % 1e3 / 1e3 - 0.5) * r * 0.9 };
  };
  const a = spot(k), b2 = spot(k + 1);
  const walkF = 0.3 + h % 20 / 100;
  if (f < walkF) {
    const e = f / walkF;
    const s = e * e * (3 - 2 * e);
    return { dx: a.x + (b2.x - a.x) * s, dy: a.y + (b2.y - a.y) * s, moving: true };
  }
  return { dx: b2.x, dy: b2.y, moving: false };
}
function separate(list) {
  const grid2 = /* @__PURE__ */ new Map();
  const MIN = 0.62;
  list = list.filter((q) => !q.moving);
  for (const q of list) {
    if (!q.visible) continue;
    const key = `${Math.floor(q.x)},${Math.floor(q.y)}`;
    const g = grid2.get(key);
    if (g) g.push(q);
    else grid2.set(key, [q]);
  }
  for (const q of list) {
    if (!q.visible || q.talking) continue;
    const cx = Math.floor(q.x), cy = Math.floor(q.y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const o of grid2.get(`${gx},${gy}`) ?? []) {
      if (o === q || o.p.id < q.p.id) continue;
      const dx = o.x - q.x, dy = o.y - q.y;
      const d = Math.hypot(dx, dy);
      if (d >= MIN) continue;
      const push = (MIN - d) / 2;
      const ux = d > 1e-3 ? dx / d : hash2(q.p.id) % 2 ? 1 : -1, uy = d > 1e-3 ? dy / d : 0.3;
      if (!o.talking) {
        o.x += ux * push;
        o.y += uy * push * 0.6;
      }
      q.x -= ux * push;
      q.y -= uy * push * 0.6;
    }
  }
}
function mkCtx(w, now) {
  const frac = w.frozen ? 0 : Math.max(0, Math.min(3, (now - w.lastTickAt) / hourMs(w)));
  const t = (w.hour + frac) % 24;
  const B = new Map(w.buildings.map((b2) => [b2.id, b2]));
  const door = (id, p, spread = 1.6) => {
    const b2 = B.get(id) ?? B.get("pazar");
    const h = hash2(p.id + id);
    const isBig = ["pazar", "kahve", "santiye", "kisla", "liman", "ciftlik", "festival", "arsa", "yapi"].includes(b2.kind);
    if (b2.kind === "ciftlik" || b2.kind === "arsa" || b2.kind === "festival") return { x: b2.x + 0.8 + h % 100 / 100 * (b2.w - 1.6), y: b2.y + 1 + (h >> 8) % 100 / 100 * (b2.h - 1.2) };
    if (isBig) return { x: b2.x + 0.5 + h % 100 / 100 * (b2.w - 1), y: b2.y + b2.h + 0.3 + (h >> 8) % 100 / 100 * spread };
    return { x: b2.door.x + 0.5 + (h % 100 / 100 - 0.5) * spread * 2, y: b2.door.y + 0.5 + (h >> 8) % 100 / 100 * spread * 0.6 };
  };
  return { t, night: t < 6 || t >= 21.5, B, door, site: w.projects.find((x) => !x.done && x.plot && x.paid >= 6)?.plot, festOpen: (w.festivalUntil ?? 0) >= w.day };
}
function schedulePos(w, p, now) {
  const q = scheduled(w, p, now, mkCtx(w, now));
  return { x: q.x, y: q.y };
}
function placePeople(w, now) {
  const c = mkCtx(w, now);
  const zindan = c.B.get("zindan");
  const jailed = w.people.filter((p) => p.jailedDays > 0);
  const out = /* @__PURE__ */ new Map();
  for (const p of w.people) {
    let q;
    if (p.jailedDays > 0 && inCustody(w, p) && c.B.get("mahkeme")) {
      const m = c.B.get("mahkeme");
      q = { p, x: m.door.x + 1.6 + hash2(p.id) % 3 * 0.5, y: m.door.y + 1.1, moving: false, visible: true, dir: -1 };
    } else if (p.jailedDays > 0 && zindan) {
      const i = jailed.indexOf(p);
      const cols = Math.max(1, zindan.w - 1);
      q = { p, x: zindan.x + 0.8 + i % cols, y: zindan.y + zindan.h - 0.6 - Math.floor(i / cols) * 0.5, moving: false, visible: true, dir: 1 };
    } else if (p.playerId && (p.homeUntil ?? 0) > now && c.B.get(p.home)) {
      const hb = c.B.get(p.home);
      q = { p, x: hb.door.x + 0.5, y: hb.door.y + 0.4, moving: false, visible: false, dir: 1 };
    } else if (playerWalking(w, p, now)) {
      const r = walkPos(p.walk, now);
      q = { p, x: r.pt.x, y: r.pt.y, moving: r.moving, visible: true, dir: r.dir };
    } else q = scheduled(w, p, now, c);
    if (p.exiledDays > 0) q.visible = false;
    if (w.isyan && !playerWalking(w, p, now)) {
      if (w.isyan.rebels.includes(p.id)) {
        const at = w.isyan.occupied[w.isyan.occupied.length - 1] ?? "pazar";
        const d = c.door(at, p, 3);
        q.x = d.x + Math.sin(now / 2300 + hash2(p.id)) * 2;
        q.y = d.y;
        q.visible = true;
        q.moving = true;
      } else if (p.prof === "asker") {
        const d = c.door("saray", p, 3);
        q.x = d.x;
        q.y = d.y + 1;
        q.visible = true;
        q.moving = false;
      }
    }
    out.set(p.id, q);
  }
  for (const tk of w.talks ?? []) {
    if (!tk.at || now - tk.at > TALK_MS || now < tk.at) continue;
    const a = out.get(tk.a), b2 = out.get(tk.b);
    if (!a || !b2 || a.p.jailedDays || b2.p.jailedDays) continue;
    if (playerWalking(w, a.p, now) || playerWalking(w, b2.p, now)) continue;
    const k = Math.min(1, (now - tk.at) / 6e3);
    const tx = a.x + 0.95, ty = a.y;
    b2.x = b2.x + (tx - b2.x) * k;
    b2.y = b2.y + (ty - b2.y) * k;
    b2.moving = k < 1;
    b2.visible = true;
    b2.dir = -1;
    a.moving = false;
    a.visible = true;
    a.talking = true;
    b2.talking = k >= 1;
  }
  for (const co of w.corpses ?? []) {
    if (!co.bekciId || !co.reportedAt || !co.bekciFrom || co.stage !== "ihbar" && co.stage !== "inceleme") continue;
    const q = out.get(co.bekciId);
    if (!q || playerWalking(w, q.p, now)) continue;
    const d = Math.hypot(co.x - co.bekciFrom.x, co.y - co.bekciFrom.y);
    const dur = Math.max(4e3, d / 3 * 1e3);
    const k = Math.min(1, (now - co.reportedAt) / dur);
    q.x = co.bekciFrom.x + (co.x + 0.8 - co.bekciFrom.x) * k;
    q.y = co.bekciFrom.y + (co.y - co.bekciFrom.y) * k;
    q.moving = k < 1;
    q.visible = true;
  }
  for (const e of w.escorts ?? []) {
    if (now - e.at > ESCORT_MS || !zindan) continue;
    const k = Math.min(1, (now - e.at) / ESCORT_MS);
    const to = { x: zindan.door.x + 0.5, y: zindan.door.y + 0.6 };
    const x = e.from.x + (to.x - e.from.x) * k, y = e.from.y + (to.y - e.from.y) * k;
    const c1 = out.get(e.personId), b1 = out.get(e.bekciId);
    if (c1) {
      c1.x = x;
      c1.y = y;
      c1.moving = k < 1;
      c1.visible = true;
    }
    if (b1) {
      b1.x = x + 0.8;
      b1.y = y;
      b1.moving = k < 1;
      b1.visible = true;
    }
  }
  const mh = c.B.get("mahkeme");
  if (mh) for (const cs of w.cases) {
    if (!cs.trial || cs.trial.done) continue;
    const put = (id, dx) => {
      const q = id ? out.get(id) : void 0;
      if (q && !playerWalking(w, q.p, now)) {
        q.x = mh.door.x + 0.5 + dx;
        q.y = mh.door.y + 0.8;
        q.visible = true;
        q.moving = false;
      }
    };
    put(cs.accusedId, 0);
    put(cs.trial.judgeId, -1.2);
    put(cs.trial.prosecutorId, 1.2);
  }
  const all = [...out.values()];
  separate(all.filter((q) => !q.p.playerId && !playerWalking(w, q.p, now)));
  return all;
}
function inCustody(w, p) {
  return w.arrests.some((a) => a.criminalId === p.id && a.status === "bekliyor") || w.cases.some((c) => c.accusedId === p.id && c.stage !== "kapandi");
}
function placeOf(w, id, now) {
  return placePeople(w, now).find((q) => q.p.id === id);
}

// src/sim/alibi.ts
var POS_EVERY = 0.25;
var POS_KEEP_H = 36;
var NEAR_R = 3;
var MAX_CALLS = 3;
function gameH(w, ms) {
  return w.day * 24 + w.hour + Math.max(0, Math.min(0.999, (ms - w.lastTickAt) / hourMs(w)));
}
function hLabel(w, H) {
  const d = Math.floor(H / 24);
  const hr = Math.floor(H - d * 24);
  const mn = Math.floor((H - Math.floor(H)) * 4) * 15;
  return `${d === w.day ? "" : d === w.day - 1 ? "d\xFCn " : `${d}. g\xFCn `}${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}
function samplePositions(w, now) {
  const H = gameH(w, now);
  if (H - (w.posAt ?? -99) < POS_EVERY) return;
  w.posAt = H;
  const log2 = w.posLog ??= {};
  const alive = new Set(w.people.map((p) => p.id));
  for (const q of placePeople(w, now)) {
    const arr = log2[q.p.id] ??= [];
    const last = arr[arr.length - 1];
    const x = Math.round(q.x), y = Math.round(q.y);
    if (!last || Math.hypot(last[1] - x, last[2] - y) >= 2 || H - last[0] >= 2) arr.push([Math.round(H * 100) / 100, x, y]);
    while (arr.length > 2 && arr[1][0] < H - POS_KEEP_H) arr.shift();
  }
  for (const id of Object.keys(log2)) if (!alive.has(id)) delete log2[id];
}
function posAt(w, id, H) {
  const arr = w.posLog?.[id];
  if (!arr?.length) return null;
  let best = null;
  for (const s of arr) {
    if (s[0] <= H + 0.01) best = s;
    else break;
  }
  return best ? { x: best[1], y: best[2] } : null;
}
function placeName(w, pt) {
  const b2 = w.buildings.find((b3) => pt.x >= b3.x - 0.5 && pt.x <= b3.x + b3.w + 0.5 && pt.y >= b3.y - 0.5 && pt.y <= b3.y + b3.h + 1);
  return b2 ? b2.name : "sokakta";
}
function recordCrime(w, criminalId, victimId, now, x, y) {
  w.crimeLog = [...w.crimeLog ?? [], { criminalId, victimId, H: Math.round(gameH(w, now) * 100) / 100, x: Math.round(x), y: Math.round(y) }].slice(-30);
}
function crimeTime(w, c) {
  if (c.crimeH != null) return;
  const e = [...w.crimeLog ?? []].reverse().find((x) => x.criminalId === c.accusedId && (!c.victimId || x.victimId === c.victimId)) ?? [...w.crimeLog ?? []].reverse().find((x) => x.criminalId === c.accusedId);
  if (e) {
    c.crimeH = e.H;
    c.crimeX = e.x;
    c.crimeY = e.y;
  }
}
function together(w, a, b2, H0, H1) {
  const ts = /* @__PURE__ */ new Set([H0]);
  for (const id of [a, b2]) for (const s of w.posLog?.[id] ?? []) if (s[0] >= H0 && s[0] <= H1) ts.add(s[0]);
  const out = [];
  for (const t of [...ts].sort((x, y) => x - y)) {
    const pa = posAt(w, a, t), pb = posAt(w, b2, t);
    if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) <= NEAR_R) out.push(t);
  }
  return out;
}
function alibiTestimony(w, c, wit) {
  const a = findPerson(w, c.accusedId);
  const an = a?.name ?? "san\u0131k";
  const H = c.crimeH;
  if ((c.eyeIds ?? []).includes(wit.id)) return { text: `Ben olay\u0131 g\xF6rd\xFCm. ${an} oradayd\u0131 ve yapt\u0131.`, favor: false };
  if (H == null) return { text: `Olay\u0131n ne zaman oldu\u011Funu bilmiyorum; ${an} hakk\u0131nda bir \u015Fey s\xF6yleyemem.`, favor: null };
  const crimeL = hLabel(w, H);
  const at = together(w, c.accusedId, wit.id, H - 0.5, H + 0.5);
  if (at.length) {
    const pl = placeName(w, posAt(w, wit.id, at[0]));
    return { text: `Olay saatinde (${crimeL}) ${an} benim yan\u0131mdayd\u0131, ${pl === "sokakta" ? "sokakta" : ek(pl, "da")}. Su\xE7u ben g\xF6rmedim; o saatte yan\u0131mda olan biri orada olamaz.`, favor: true };
  }
  const after = together(w, c.accusedId, wit.id, H + 0.01, H + 4);
  if (after.length) {
    const t = after[0];
    const pl = placeName(w, posAt(w, wit.id, t));
    return { text: `${an} olay saatinde (${crimeL}) yan\u0131mda de\u011Fildi. Yan\u0131ma ancak ${hLabel(w, t)} civar\u0131 geldi (${pl}). Ondan \xF6ncesini bilmem.`, favor: false };
  }
  const before = together(w, c.accusedId, wit.id, H - 3, H - 0.5);
  if (before.length) {
    const t = before[before.length - 1];
    return { text: `${an} ${hLabel(w, t)} civar\u0131 yan\u0131mdayd\u0131 ama sonra ayr\u0131ld\u0131; olay saatinde (${crimeL}) nerede oldu\u011Funu bilmiyorum.`, favor: null };
  }
  return { text: `O saatlerde (${crimeL}) ${an} ile hi\xE7 kar\u015F\u0131la\u015Fmad\u0131m. Lehine bir \u015Fey s\xF6yleyemem.`, favor: false };
}
function callWitness(w, c, me, witId, now) {
  const tr = c.trial;
  if (!tr || tr.done) return "\u015Eu an g\xF6r\xFClen bir dava yok.";
  if (c.accusedId !== me.id) return "Tan\u0131\u011F\u0131 sadece san\u0131k \xE7a\u011F\u0131r\u0131r.";
  if ((c.called ?? []).length >= MAX_CALLS) return `En fazla ${MAX_CALLS} tan\u0131k \xE7a\u011F\u0131rabilirsiniz.`;
  const wit = findPerson(w, witId);
  if (!wit || wit.id === me.id || wit.prof === "naip") return "B\xF6yle biri yok.";
  if ((c.called ?? []).some((x) => x.id === wit.id)) return "Bu ki\u015Fi zaten \xE7a\u011Fr\u0131ld\u0131.";
  crimeTime(w, c);
  (c.called ??= []).push({ id: wit.id, at: now });
  const judge = findPerson(w, tr.judgeId)?.name ?? "Kad\u0131";
  tr.msgs.push({ who: "hakim", name: judge, text: `San\u0131\u011F\u0131n tan\u0131\u011F\u0131 ${wit.name} mahkemeye \xE7a\u011Fr\u0131ls\u0131n.`, at: now });
  if (wit.playerId && !wit.npc) {
    personal(w, wit.playerId, `\u2696 ${me.name} davas\u0131nda sizi tan\u0131k olarak \xE7a\u011F\u0131rd\u0131. Duru\u015Fma ekran\u0131ndan tan\u0131kl\u0131k edin.`, now);
    return null;
  }
  if (!fullAI(wit) && wit.playerId) return null;
  const t = alibiTestimony(w, c, wit);
  tr.msgs.push({ who: "tanik", name: wit.name, text: t.text, at: now + 1 });
  if (t.favor !== null) {
    (c.witnesses ??= []).push({ id: wit.id, against: !t.favor });
    rel(me, wit, t.favor ? 10 : -5, t.favor ? "lehime tan\u0131kl\u0131k etti" : "aleyhime tan\u0131kl\u0131k etti");
  }
  if (t.favor === true) tr.persuasion = Math.min(12, tr.persuasion + 3);
  if (t.favor === false) tr.persuasion = Math.max(-12, tr.persuasion - 1);
  return null;
}

// src/sim/v16.ts
var CORPSE_MS = 5 * 6e4;
var TRIAL_MS = 15e4;
var CUSTODY_MS = 6e4;
function makeCorpse(w, v, killer, now) {
  const q = placeOf(w, v.id, now);
  const x = q?.x ?? 32, y = q?.y ?? 28;
  if (killer) recordCrime(w, killer.id, v.id, now, x, y);
  const witnesses = placePeople(w, now).filter((o) => o.visible && o.p.id !== v.id && o.p.id !== killer?.id && Math.hypot(o.x - x, o.y - y) <= WITNESS_R).map((o) => o.p.id).slice(0, 6);
  const co = { id: nextId(w, "C"), personId: v.id, name: v.name, look: { hairColor: v.hairColor, skin: v.skin, shirt: v.shirt, female: v.female, prof: v.prof }, x, y, at: now, killerId: killer?.id ?? null, witnesses, stage: "yerde" };
  w.corpses = [...w.corpses ?? [], co].slice(-12);
  return co;
}
function reportCorpse(w, co, by, now) {
  if (co.stage !== "yerde") return "Bu ceset zaten ihbar edildi; bek\xE7i yolda.";
  const placed = placePeople(w, now);
  const bekcis = placed.filter((q) => q.p.prof === "bekci" && q.p.jailedDays === 0 && !playerWalking(w, q.p, now) && q.p.id !== co.killerId);
  const bq = bekcis.sort((a, b2) => Math.hypot(a.x - co.x, a.y - co.y) - Math.hypot(b2.x - co.x, b2.y - co.y))[0];
  co.reportedBy = by.id;
  co.reportedAt = now;
  co.stage = "ihbar";
  if (bq) {
    co.bekciId = bq.p.id;
    co.bekciFrom = { x: bq.x, y: bq.y };
  }
  log(w, `\u260E ${by.name}, ${ek(co.name, "\u0131n")} cesedini ihbar etti. ${bq ? `Bek\xE7i ${bq.p.name.replace(/^Bekçi /, "")} olay yerine ko\u015Fuyor.` : "Ama g\xF6revde bek\xE7i yok!"}`, by.id, now);
  return bq ? `\u0130hbar ettiniz. ${bq.p.name} olay yerine geliyor.` : "\u0130hbar ettiniz ama \u015Fu an g\xF6revde bek\xE7i yok.";
}
function investigate(w, co, now) {
  co.stage = "inceleme";
  const bekci = findPerson(w, co.bekciId);
  const savci = w.people.find((p2) => p2.prof === "savci" && p2.jailedDays === 0);
  const killer = findPerson(w, co.killerId);
  const p = killer ? clamp(0.45 + 0.15 * co.witnesses.length, 0, 0.95) : 0;
  if (killer && rand(w) < p) {
    const e = co.witnesses.length;
    arrest(w, killer, "cinayet", co.personId, 0, bekci ?? void 0, { evidence: Math.min(92, 35 + e * 15), eyewitnesses: e, eyeIds: co.witnesses, complainantId: co.reportedBy ?? null, basis: e ? `ceset incelemesi + ${e} g\xF6rg\xFC tan\u0131\u011F\u0131 (2 m i\xE7inde)` : "ceset incelemesi, g\xF6rg\xFC tan\u0131\u011F\u0131 yok (dolayl\u0131 delil)" });
    co.note = `${bekci?.name ?? "Bek\xE7i"} olay yerini inceledi${co.witnesses.length ? `, ${co.witnesses.length} tan\u0131k dinledi` : ""} ve ${savci?.name ?? "savc\u0131ya"} bildirdi. \u015E\xFCpheli: ${killer.name}.`;
  } else co.note = `${bekci?.name ?? "Bek\xE7i"} olay yerini inceledi, ${savci?.name ?? "savc\u0131ya"} bildirdi; katil \u015Fimdilik bulunamad\u0131.`;
  log(w, `\u{1F50E} ${co.note}`, co.killerId ?? void 0, now);
}
function realtime(w, now) {
  samplePositions(w, now);
  runTasks(w, now);
  processReports(w, now);
  for (const a of w.arrests) {
    if (a.status !== "bekliyor") continue;
    const cr = findPerson(w, a.criminalId);
    if (!cr?.playerId || cr.npc) continue;
    if (now - (a.at ?? now) < CUSTODY_MS) continue;
    const ca = findPerson(w, a.catcherId);
    decideBribe(w, a, !!ca && a.offer > 0 && fullAI(ca) && rand(w) < bribeAcceptChance(ca, a.offer));
  }
  for (const c of w.cases) {
    if (c.stage === "kapandi" || c.trial) continue;
    const acc = findPerson(w, c.accusedId);
    if (!acc?.playerId || acc.npc) continue;
    const hakim = w.people.find((p) => p.prof === "hakim" && p.jailedDays === 0);
    if (hakim?.playerId && !hakim.npc) continue;
    if (c.stage === "savci") {
      if (c.evidence < 35) {
        c.stage = "kapandi";
        c.verdict = "dusuruldu";
        acc.jailedDays = 0;
        log(w, `Delil yetersiz: ${acc.name} serbest b\u0131rak\u0131ld\u0131.`, acc.id, now);
        continue;
      }
      c.stage = "hakim";
    }
    if (c.stage === "hakim") startTrial(w, c, now);
  }
  for (const co of w.corpses ?? []) {
    if (co.stage === "yerde") {
      const delay = 2e4 + parseInt(co.id.replace(/\D/g, ""), 10) % 5 * 6e3;
      if (now - co.at > delay) {
        const reporter = findPerson(w, co.witnesses.find((id) => {
          const p = findPerson(w, id);
          return p && fullAI(p);
        })) ?? pick(w, w.people.filter((p) => fullAI(p) && p.jailedDays === 0 && p.prof !== "naip"));
        if (reporter) reportCorpse(w, co, reporter, now);
      }
    } else if (co.stage === "ihbar" && co.reportedAt) {
      const d = co.bekciFrom ? Math.hypot(co.x - co.bekciFrom.x, co.y - co.bekciFrom.y) : 0;
      if (now >= co.reportedAt + Math.max(4e3, d / 3 * 1e3) + 3e3) investigate(w, co, now);
    }
  }
  w.corpses = (w.corpses ?? []).filter((c) => now - c.at < CORPSE_MS);
  w.escorts = (w.escorts ?? []).filter((e) => now - e.at < ESCORT_MS * 2);
  for (const c of w.cases) if (c.trial && !c.trial.done && (now > c.trial.until || c.trial.msgs.filter((m) => m.who === "sanik").length >= 5 && !c.trial.pending)) finishTrial(w, c, now);
}
function startTrial(w, c, now) {
  const a = findPerson(w, c.accusedId);
  if (!a) return;
  crimeTime(w, c);
  const judge = w.people.find((p) => p.prof === "hakim" && p.jailedDays === 0) ?? null;
  const pros = w.people.find((p) => p.prof === "savci" && p.jailedDays === 0) ?? null;
  const victim = findPerson(w, c.victimId)?.name ?? w.corpses?.find((x) => x.personId === c.victimId)?.name;
  c.trial = { at: now, until: now + TRIAL_MS, judgeId: judge?.id ?? null, prosecutorId: pros?.id ?? null, persuasion: 0, done: false, msgs: [
    { who: "savci", name: pros?.name ?? "Savc\u0131", text: `Say\u0131n Kad\u0131, san\u0131k ${a.name} ${CRIME_LABEL[c.crime].toLocaleLowerCase("tr")} ile itham ediliyor${victim ? `; ma\u011Fdur ${victim}` : ""}. Deliller ${c.evidence >= 70 ? "g\xFC\xE7l\xFC" : c.evidence >= 45 ? "yeterli" : "zay\u0131f"}${c.witnesses?.length ? `, ${c.witnesses.length} tan\u0131k var` : ""}. Cezaland\u0131r\u0131lmas\u0131n\u0131 talep ediyorum.`, at: now },
    { who: "hakim", name: judge?.name ?? "Kad\u0131", text: openingStatement(w, c, a), at: now + 500 },
    ...eyeTestimony(w, c, a, now + 700),
    { who: "hakim", name: judge?.name ?? "Kad\u0131", text: `San\u0131k ${a.name}, s\xF6z sizde. Ba\u015Fkas\u0131n\u0131 su\xE7luyorsan\u0131z ad\u0131n\u0131 s\xF6yleyin; mahkemeye \xE7a\u011Fr\u0131l\u0131r. Lehinize tan\u0131k \xE7a\u011F\u0131rabilirsiniz (\u201CTan\u0131k \xE7a\u011F\u0131r\u201D). Kendinizi savunun; ${Math.round(TRIAL_MS / 6e4 * 10) / 10} dakikan\u0131z var.`, at: now + 1e3 }
  ] };
  c.deadline = w.day + 2;
  log(w, `\u2696 ${ek(a.name, "\u0131n")} ${CRIME_LABEL[c.crime].toLocaleLowerCase("tr")} davas\u0131 g\xF6r\xFCl\xFCyor. Kad\u0131: ${judge?.name ?? "\u2014"}, Savc\u0131: ${pros?.name ?? "\u2014"}.`, a.id, now);
}
function openingStatement(w, c, a) {
  const victim = findPerson(w, c.victimId)?.name ?? w.corpses?.find((x) => x.personId === c.victimId)?.name;
  const comp = findPerson(w, c.complainantId)?.name;
  const eyes = (c.eyeIds ?? []).map((id) => findPerson(w, id)?.name).filter(Boolean);
  return `${a.name}, ${CRIME_LABEL[c.crime].toLocaleLowerCase("tr")} ile yarg\u0131lan\u0131yorsunuz${victim ? ` (ma\u011Fdur: ${victim})` : ""}. Deliller: ${c.basis ?? "savc\u0131l\u0131k iddias\u0131"}; delil g\xFCc\xFC ${Math.round(c.evidence)}/100${eyes.length ? `; olay\u0131 2 m i\xE7inden g\xF6renler: ${eyes.join(", ")}` : "; g\xF6rg\xFC tan\u0131\u011F\u0131 yok"}. \u015Eik\xE2yet eden: ${comp ?? "savc\u0131l\u0131k (resen)"}.`;
}
function eyeTestimony(w, c, a, at) {
  const out = [];
  for (const id of (c.eyeIds ?? []).slice(0, 3)) {
    const p = findPerson(w, id);
    if (!p || p.id === a.id || !fullAI(p) || p.jailedDays > 0) continue;
    const against = (p.relations[a.id] ?? 0) < 40 || p.honesty > 60;
    (c.witnesses ??= []).push({ id: p.id, against });
    out.push({ who: "tanik", name: p.name, text: against ? `Kendi g\xF6z\xFCmle g\xF6rd\xFCm, ${a.name} yapt\u0131. Yemin ederim.` : `Oradayd\u0131m ama tam g\xF6remedim; ${a.name} iyi bir insand\u0131r.`, at: at + out.length * 100 });
  }
  return out;
}
function judgeRule(w, c, text) {
  const t = text.toLocaleLowerCase("tr");
  let s = 0;
  if (/\*{3,}|aptal|salak|şerefsiz|defol/.test(t)) s -= 4;
  if (/masum|suçsuz|yapmadım|ben değil|iftira|alakam yok/.test(t)) s += 1;
  if (/tanık|şahit|kanıt|delil|yoktum|evdeydim|oradaydım|gördü|ispat/.test(t)) s += 2;
  if (/özür|pişman|affet|merhamet|bir daha/.test(t)) s += 1;
  if (/rüşvet|para vereyim|hallederiz/.test(t)) s -= 3;
  if (/nefsi müdafaa|kendimi savun|saldırdı bana|tehdit/.test(t)) s += 2;
  if (text.length > 80) s += 1;
  if (text.length < 8) s -= 1;
  s = Math.max(-4, Math.min(3, s));
  const reply = s <= -3 ? pick(w, ["Mahkemede edebinizi tak\u0131n\u0131n! Bu s\xF6z aleyhinize kaydedildi.", "Kad\u0131ya r\xFC\u015Fvet mi teklif ediyorsunuz? Tutana\u011Fa ge\xE7ti."]) : s <= 0 ? pick(w, ["Bu bir savunma de\u011Fil. Delilleri \xE7\xFCr\xFCtecek bir \u015Fey s\xF6yleyin.", "\u0130nand\u0131r\u0131c\u0131 bulmad\u0131m. Ba\u015Fka bir diyece\u011Finiz var m\u0131?"]) : s === 1 ? pick(w, ["Not ettim. Ama s\xF6zle olmaz; tan\u0131\u011F\u0131n\u0131z, deliliniz var m\u0131?", "Peki. Savc\u0131 ne diyor bu konuda?"]) : pick(w, ["Bu \xF6nemli bir nokta, dikkate al\u0131yorum.", "Hmm\u2026 Bu, delilleri zay\u0131flat\u0131yor. Devam edin."]);
  void c;
  return { reply, score: s };
}
function addDefense(_w, c, me, text, now) {
  const tr = c.trial;
  if (!tr || tr.done) return "\u015Eu an g\xF6r\xFClen bir davan\u0131z yok.";
  if (c.accusedId !== me.id) return "Sadece san\u0131k savunma yapar.";
  if (tr.pending) return "Kad\u0131 bir \xF6nceki s\xF6z\xFCn\xFCz\xFC d\xFC\u015F\xFCn\xFCyor\u2026";
  tr.msgs.push({ who: "sanik", name: me.name, text: text.slice(0, 300), at: now });
  tr.pending = true;
  if (!tr.blamedId) summonBlamed(_w, c, me, text, now);
  return null;
}
function summonBlamed(w, c, me, text, now) {
  const tr = c.trial;
  const t = text.toLocaleLowerCase("tr");
  if (!/yaptı|öldürdü|suçlu|o vurdu|katil|çaldı|saldırdı|o idi|oydu/.test(t)) return;
  const skip = /* @__PURE__ */ new Set([me.id, tr.judgeId, tr.prosecutorId, c.victimId]);
  const hit = w.people.filter((p) => !skip.has(p.id) && p.prof !== "naip").find((p) => {
    const n2 = p.name.toLocaleLowerCase("tr");
    const last = n2.split(" ").slice(-1)[0];
    return t.includes(n2) || last.length >= 4 && new RegExp(`(^|[^a-z\xE7\u011F\u0131\xF6\u015F\xFC])${last}`).test(t);
  });
  if (!hit) return;
  tr.blamedId = hit.id;
  const atScene = (c.eyeIds ?? []).includes(hit.id);
  tr.msgs.push({ who: "hakim", name: findPerson(w, tr.judgeId)?.name ?? "Kad\u0131", text: `${hit.name} mahkemeye \xE7a\u011Fr\u0131ls\u0131n! Su\xE7lama ciddi.`, at: now + 1 });
  if (hit.playerId && !hit.npc) personal(w, hit.playerId, `\u2696 ${me.name} davas\u0131nda sizi su\xE7lad\u0131; mahkemeye \xE7a\u011Fr\u0131ld\u0131n\u0131z (duru\u015Fma ekran\u0131ndan cevap verin).`, now);
  else tr.msgs.push({ who: "suclanan", name: hit.name, text: atScene ? hit.honesty < 40 ? "Oradayd\u0131m\u2026 ama elim kimseye kalkmad\u0131, yemin ederim!" : "Oradayd\u0131m, her \u015Feyi g\xF6rd\xFCm; ben yapmad\u0131m." : "Ben o s\u0131rada ba\u015Fka yerdeydim, bu bir iftira!", at: now + 2 });
}
function judgeAnswer(w, c, reply, score, now, reason) {
  const tr = c.trial;
  if (!tr || tr.done) return;
  if (reason) tr.lastReason = reason.slice(0, 200);
  tr.pending = false;
  tr.persuasion = clamp(tr.persuasion + score, -12, 12);
  tr.msgs.push({ who: "hakim", name: findPerson(w, tr.judgeId)?.name ?? "Kad\u0131", text: reply.slice(0, 300), at: now });
  if (tr.msgs.filter((m) => m.who === "sanik").length >= 5) finishTrial(w, c, now);
}
function finishTrial(w, c, now) {
  const tr = c.trial;
  if (!tr || tr.done) return;
  tr.done = true;
  tr.doneAt = now;
  tr.pending = false;
  for (const o of w.cases) if (o !== c && o.accusedId === c.accusedId && o.stage !== "kapandi" && (o.crime === c.crime || o.victimId && o.victimId === c.victimId)) {
    o.stage = "kapandi";
    o.verdict = "dusuruldu";
    o.sentence = "Ayn\u0131 olay i\xE7in g\xF6r\xFClen davayla birle\u015Ftirildi.";
    if (o.trial) {
      o.trial.done = true;
      o.trial.doneAt = now;
    }
  }
  const a = findPerson(w, c.accusedId);
  if (!a) return;
  const judge = findPerson(w, tr.judgeId);
  const eyes = c.eyewitnesses ?? 0;
  const courtAgainst = (c.witnesses ?? []).filter((x) => x.against).length;
  const courtFor = (c.witnesses ?? []).filter((x) => !x.against).length;
  const pGuilty = (c.evidence * ((judge?.honesty ?? 70) / 75) + Math.min(24, eyes * 8) + courtAgainst * 6 - courtFor * 6 - tr.persuasion * 7) / 100;
  const floor = eyes >= 2 ? Math.max(0.2, 0.7 - Math.max(0, tr.persuasion - 4) * 0.07) : 0.03;
  const p = clamp(Math.max(pGuilty, floor), 0.03, 0.97);
  const blamed = findPerson(w, tr.blamedId);
  const blameSticks = !!blamed && (c.eyeIds ?? []).includes(blamed.id) && tr.persuasion >= 4 && blamed.honesty < 60;
  const roll = rand(w);
  const guilty = !blameSticks && roll < p;
  const strength2 = tr.persuasion >= 6 ? "g\xFC\xE7l\xFC" : tr.persuasion >= 2 ? "k\u0131smen ikna edici" : tr.persuasion >= 0 ? "zay\u0131f" : "aleyhine";
  tr.reasoning = `Gerek\xE7e: ${c.basis ?? "savc\u0131l\u0131k iddias\u0131"}; delil g\xFCc\xFC ${Math.round(c.evidence)}/100${eyes ? `, ${eyes} g\xF6rg\xFC tan\u0131\u011F\u0131` : ", g\xF6rg\xFC tan\u0131\u011F\u0131 yok"}${courtAgainst ? `, ${courtAgainst} aleyhte tan\u0131k` : ""}; savunma ${strength2} (ikna ${tr.persuasion}). Su\xE7luluk ihtimali %${Math.round(p * 100)}.${blamed ? blameSticks ? ` Su\xE7 ${ek(blamed.name, "a")} y\xF6neldi: olay yerindeydi ve savunma ikna edici.` : ` ${blamed.name} su\xE7land\u0131 ama aleyhine delil bulunmad\u0131.` : ""}${tr.lastReason ? ` Kad\u0131n\u0131n notu: ${tr.lastReason}` : ""}`;
  const fromQ = placeOf(w, a.id, now);
  verdict(w, c.id, guilty, now);
  if (guilty && tr.persuasion >= 4 && c.crime !== "cinayet" && c.crime !== "isyan") {
    a.jailedDays = 0;
    c.sentence = `${c.sentence?.replace(/^\d+ gün zindan, /, "") ?? ""} (zindan yerine para cezas\u0131 \u2013 savunma ikna edici bulundu)`;
  }
  tr.verdictText = `${guilty ? `SU\xC7LU. H\xFCk\xFCm: ${c.sentence}.` : "BERAAT. San\u0131k serbest."} ${tr.reasoning}`;
  tr.msgs.push({ who: "hakim", name: judge?.name ?? "Kad\u0131", text: `Karar: ${tr.verdictText}${guilty && a.jailedDays > 0 ? " Bek\xE7i, mahk\xFBmu zindana g\xF6t\xFCr!" : ""}`, at: now });
  if (guilty && a.jailedDays > 0) {
    const bekci = w.people.find((p2) => p2.prof === "bekci" && p2.jailedDays === 0 && p2.id !== a.id);
    const m = w.buildings.find((b2) => b2.id === "mahkeme");
    if (bekci) w.escorts = [...w.escorts ?? [], { personId: a.id, bekciId: bekci.id, from: m ? { x: m.door.x + 0.5, y: m.door.y + 0.6 } : { x: fromQ?.x ?? 20, y: fromQ?.y ?? 12 }, at: now }];
  }
  if (blameSticks && blamed) {
    openCase(w, blamed.id, c.crime, c.victimId, c.amount, 60);
    const nc = w.cases.at(-1);
    if (nc && nc.accusedId === blamed.id && nc.stage !== "kapandi") {
      nc.basis = `${a.name} davas\u0131nda su\xE7land\u0131; olay yerindeydi`;
      nc.eyeIds = (c.eyeIds ?? []).filter((x) => x !== blamed.id);
      nc.complainantId = a.id;
      log(w, `\u2696 Kad\u0131, ${ek(blamed.name, "\u0131")} yarg\u0131lanmak \xFCzere savc\u0131ya havale etti.`, blamed.id, now);
    }
  }
  if (a.playerId) personal(w, a.playerId, `Davan\u0131z: ${tr.verdictText}`, now);
}
function startWalk(w, me, to, now) {
  const q = placeOf(w, me.id, now);
  const from = q ? { x: q.x, y: q.y } : to;
  me.walk = { path: findPath(w, from, to), t0: now, speed: WALK_SPEED * (me.riding && (me.animals?.at ?? 0) > 0 ? 2 : 1) };
}
function myPos(w, me, now) {
  if (playerWalking(w, me, now)) return walkPos(me.walk, now).pt;
  const q = placeOf(w, me.id, now);
  return q ? { x: q.x, y: q.y } : { x: 0, y: 0 };
}
function migrate4(w) {
  if ((w.schema ?? 1) >= 4) return w;
  w.corpses = [];
  w.escorts = [];
  w.llm = { day: "", n: 0, talkAt: 0 };
  w.talks = [];
  if (w.election.nextDay - w.day < 25) w.election.nextDay = w.day + 25;
  w.election.candidates = w.election.candidates.filter((id) => {
    const p = findPerson(w, id);
    return p && p.prof !== "asker" && p.prof !== "bekci";
  });
  w.schema = 4;
  return w;
}
var STYLE = "Osmanl\u0131 esintili bir piksel imparatorluk oyununda ya\u015Fayan bir \u015Fehirlisin. Her zaman T\xFCrk\xE7e, do\u011Fal, k\u0131sa (en fazla 2 c\xFCmle) ve karakterine uygun konu\u015F. Yapay zek\xE2 oldu\u011Funu asla s\xF6yleme. Emoji kullanma. K\xFCf\xFCr etme.";
function personaOf(w, npc) {
  const sp = findPerson(w, npc.spouse);
  return `Sen ${npc.name}'s\u0131n; ${npc.female ? "kad\u0131n" : "erkek"}, mesle\u011Fin ${PROF_LABEL[npc.prof]}. Kesende ${Math.round(npc.money)} Dinar var. Mutlulu\u011Fun ${Math.round(npc.mood)}/100, sa\u011Fl\u0131\u011F\u0131n ${Math.round(npc.health)}/100, bug\xFCn ${npc.meals} \xF6\u011F\xFCn yedin. Devlete sadakatin ${Math.round(npc.loyalty)}/100, cumhuriyet\xE7ili\u011Fin ${Math.round(npc.republic)}/100, dindarl\u0131\u011F\u0131n ${Math.round(npc.din)}/100, d\xFCr\xFCstl\xFC\u011F\xFCn ${Math.round(npc.honesty)}/100. ${sp ? `E\u015Fin ${sp.name}.` : "Bek\xE2rs\u0131n."} ${npc.jailedDays > 0 ? "\u015Eu an zindandas\u0131n." : ""} Akl\u0131ndaki: "${opinion(w, npc)}"`;
}
function worldBrief(w) {
  const ev = w.events.slice(-5).map((e) => e.text).join(" | ");
  return `\u015Eehirde g\xFCn ${w.day}, saat ${w.hour}:00. Rejim: ${w.regime}. Vergi %${w.taxRate}. Ekmek ${marketPrice(w, "ekmek").toFixed(2)}, su ${marketPrice(w, "su").toFixed(2)}, et ${marketPrice(w, "et").toFixed(2)} Dinar. ${w.nature ? `Do\u011Fal olay: ${w.nature.kind}.` : ""} Son olaylar: ${ev || "sakin"}.`;
}
function dmPrompt(w, npc, from, text, history, outcome) {
  const rel2 = npc.relations[from.id] ?? 0;
  const role = from.id === w.kayzerId ? w.regime === "cumhuriyet" ? "\u015Fehrin Ba\u015Fkan\u0131" : '\u0130mparator (Kayzer) \u2013 ona sayg\u0131yla "\u0130mparatorum" diye hitap et' : `${PROF_LABEL[from.prof]} ${from.soylu ? "(soylu)" : ""}`;
  return {
    system: `${STYLE}
${personaOf(w, npc)}
${worldBrief(w)}`,
    user: `Sana yazan: ${from.name}, ${role}. Ona hitab\u0131n: "${addressOf(w, from)}". Onunla ili\u015Fkin: ${rel2 > 30 ? "dost" : rel2 < -30 ? "d\xFC\u015Fman, so\u011Fuk davran" : "tan\u0131d\u0131k"}.
${history.length ? `\xD6nceki konu\u015Fma:
${history.map((h) => `${h.from}: ${h.text}`).join("\n")}
` : ""}${from.name}: ${text}
${outcome ? `Bu bir istek/emir. Oyun kurallar\u0131 karar verdi: ${outcome}. Cevab\u0131n bu sonuca KES\u0130NL\u0130KLE uygun olsun (reddettiysen karakterine uygun reddet, kabul ettiysen kabul et). Sadece kendi cevab\u0131n\u0131 yaz.` : `E\u011Fer mesaj senden bir \u015Fey yapman\u0131 istiyorsa (bir yere git, takip et, sald\u0131r, \xF6ld\xFCr, tutukla, \xE7al, ver, sat, sat\u0131n al, \xE7al\u0131\u015F, oy ver, dedikodu yay, r\xFC\u015Fvet g\xF6t\xFCr, koru, git/ayr\u0131l, gizli cemiyete kat\u0131l) bunu action olarak \xE7\u0131kar. Kabul edip etmemene OYUN karar verir; o y\xFCzden iki cevap yaz. SADECE JSON d\xF6nd\xFCr: {"action": null veya {"type": "go|follow|attack|kill|arrest|steal|give|sell|buy|work|vote|gossip|bribe|guard|leave|join", "target": "ki\u015Fi ad\u0131 veya 'ben'", "place": "yer ad\u0131", "item": "mal", "amount": 1, "text": "dedikodu metni"}, "reply": "istek yoksa cevab\u0131n", "reply_yes": "kabul edersen cevab\u0131n", "reply_no": "reddedersen cevab\u0131n"}`}`,
    json: !outcome
  };
}
function talksPrompt(w, pairs) {
  return {
    system: `${STYLE}
${worldBrief(w)}`,
    user: `A\u015Fa\u011F\u0131daki \u015Fehirliler sokakta kar\u015F\u0131la\u015F\u0131p k\u0131sa sohbet ediyor. Her \xE7ift i\xE7in iki sat\u0131r yaz: \xF6nce A konu\u015Fur, sonra B cevap verir. Her sat\u0131r en fazla 70 karakter, karakterlerin durumuna uygun.
${pairs.map((p, i) => `${i + 1}. A: ${p.a.name} (${PROF_LABEL[p.a.prof]}, mutluluk ${Math.round(p.a.mood)}, sadakat ${Math.round(p.a.loyalty)}, cumhuriyet\xE7ilik ${Math.round(p.a.republic)}, akl\u0131ndaki: "${opinion(w, p.a)}") \u2014 B: ${p.b.name} (${PROF_LABEL[p.b.prof]}, mutluluk ${Math.round(p.b.mood)}, dindarl\u0131k ${Math.round(p.b.din)})`).join("\n")}
Ayr\u0131ca meydanda herkese ba\u011F\u0131racak bir dedikodu c\xFCmlesi yaz (son olaylardan). JSON d\xF6nd\xFCr: {"talks":[["A sat\u0131r\u0131","B sat\u0131r\u0131"],...],"gossip":"..."}`
  };
}
function judgePrompt(w, c) {
  const tr = c.trial;
  const judge = findPerson(w, tr.judgeId);
  const a = findPerson(w, c.accusedId);
  return {
    system: `${STYLE}
Sen ${judge?.name ?? "\u015Fehrin kad\u0131s\u0131"}s\u0131n, adil ama sert bir kad\u0131 (h\xE2kim). D\xFCr\xFCstl\xFC\u011F\xFCn ${Math.round(judge?.honesty ?? 70)}/100. San\u0131\u011F\u0131n savunmas\u0131n\u0131 dinleyip k\u0131sa cevap verirsin ve ne kadar ikna oldu\u011Funu puanlars\u0131n.`,
    user: `Dava: ${CRIME_LABEL[c.crime]}. San\u0131k: ${a?.name}. Delil g\xFCc\xFC ${Math.round(c.evidence)}/100. Delilin kayna\u011F\u0131: ${c.basis ?? "savc\u0131l\u0131k iddias\u0131"}. Olay\u0131 2 m i\xE7inden g\xF6ren g\xF6rg\xFC tan\u0131\u011F\u0131: ${c.eyewitnesses ?? 0}. Mahkemeye gelen tan\u0131k: ${c.witnesses?.length ?? 0}.
Duru\u015Fma:
${tr.msgs.map((m) => `${m.name} (${m.who}): ${m.text}`).join("\n")}
San\u0131\u011F\u0131n son s\xF6z\xFCne kad\u0131 olarak cevap ver. Adil ol: g\xF6rg\xFC tan\u0131\u011F\u0131 yoksa ve delil dolayl\u0131ysa, tutarl\u0131 bir mazeret (nerede/kiminle oldu\u011Fu), delillerle \xE7eli\u015Fmeyen makul bir a\xE7\u0131klama ya da nefsi m\xFCdafaa san\u0131\u011F\u0131 aklayabilir \u2192 y\xFCksek puan ver. Savunma delillerle ya da tan\u0131klarla \xE7eli\u015Fiyorsa, kendi i\xE7inde tutars\u0131zsa, hakaret ya da r\xFC\u015Fvet i\xE7eriyorsa d\xFC\u015F\xFCk puan ver. JSON d\xF6nd\xFCr: {"cevap":"kad\u0131n\u0131n k\u0131sa cevab\u0131","ikna":-4..4 aras\u0131 tam say\u0131,"gerekce":"tek c\xFCmle: neden bu puan"}`
  };
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
    const neighbours = w.people.filter((n2) => n2.home === p.home || (n2.relations[p.id] ?? 0) < -30);
    const tipsters = neighbours.filter((n2) => n2.id !== p.id && (n2.relations[p.id] ?? 0) < 0 && n2.honesty > 40);
    if (tipsters.length && chance(w, 0.5)) {
      s += 15 * Math.min(3, tipsters.length);
      if (chance(w, 0.4)) w.rumors.push({ day: w.day, text: `${ek(p.name, "\u0131n")} mahzeni ${GOOD_LABEL[ex[0][0]]} dolu diyorlar\u2026`, about: p.id });
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
    return `${ek(t.name, "\u0131n")} evinde fazla mal \xE7\u0131kmad\u0131.`;
  }
  if (b2.honesty < 35 && b2.loyalty < 50 && t.money > 20 && !t.playerId && chance(w, 0.6)) {
    const amt = Math.round(Math.min(t.money * 0.3, 15 + ex.length * 10));
    if (transfer(w, t.id, b2.id, amt, "karaborsa r\xFC\u015Fveti")) {
      if (chance(w, 0.3)) w.rumors.push({ day: w.day, text: `Bek\xE7i ${b2.name} stok\xE7u ${ek(t.name, "dan")} r\xFC\u015Fvet alm\u0131\u015F!`, about: b2.id });
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
  log(w, `\u{1F6A8} Bek\xE7i ${b2.name}, ${ek(t.name, "\u0131n")} karaborsa sto\u011Funa el koydu: ${parts.join(", ")} (ceza ${Math.round(fine)} D).`, t.id);
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
  if (p.inv.yumurta > 0) prefs.unshift("yumurta");
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
  return false;
}
function drinkWater(w, p) {
  if (p.prof === "naip" || p.jailedDays > 0) {
    p.drinks += 1;
    p.thirst = clamp(p.thirst - 35);
    return true;
  }
  if (palace(w, p) && transfer(w, "saray", "dis", 0.3, "saray mutfa\u011F\u0131")) {
    p.drinks += 1;
    p.thirst = clamp(p.thirst - 35);
    return true;
  }
  if (p.inv.su <= 0) buy(w, p.id, "su", 2, Math.max(0, p.money * 0.5));
  if (p.inv.su > 0) {
    p.inv.su -= 1;
    p.drinks += 1;
    p.thirst = clamp(p.thirst - 35);
    return true;
  }
  return false;
}
function needsEndOfDay(w, p) {
  if (p.prof === "naip") {
    p.meals = 0;
    p.drinks = 0;
    return;
  }
  const fresh = w.day <= 1 || (p.protectedUntil ?? 0) > w.day + 4;
  const ok3 = fresh || p.hunger < 85 && p.thirst < 85;
  if (!ok3) {
    p.health = clamp(p.health - 4);
    p.mood = clamp(p.mood - 3);
  } else if (p.health >= 30 && !p.wounded) p.health = clamp(p.health + 3);
  if ((p.health < 30 || p.wounded) && ok3) p.health = clamp(p.health - 1);
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
    for (const p of w.people) if (p.npc && !needsHelp(p) && p.health < 58 && p.money > DOCTOR_FEE * 2.5 && active2(p)) seeDoctor(w, p, false);
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
function disaster(w, kind, text) {
  w.disaster = { id: (w.disaster?.id ?? 0) + 1, kind, text, day: w.day };
  log(w, `\u26A0 ${text}`);
}
function nature(w) {
  const n2 = w.nature;
  if (n2 && w.day > n2.until) {
    log(w, `${n2.kind === "kuraklik" ? "Kurakl\u0131k" : n2.kind === "salgin" ? "Salg\u0131n" : n2.kind === "sel" ? "Sel" : n2.kind === "bereket" ? "Bereket" : "Bal\u0131k bollu\u011Fu"} sona erdi.`);
    w.nature = null;
  }
  if (!w.nature && w.day >= w.nextDrought) {
    w.nature = { kind: "kuraklik", start: w.day, until: w.day + 13 };
    w.nextDrought = w.day + 180;
    disaster(w, "kuraklik", NATURE_TEXT.kuraklik);
  } else if (!w.nature && chance(w, 0.02)) {
    const kind = pick(w, ["salgin", "sel", "bereket", "balik"]);
    w.nature = { kind, start: w.day, until: w.day + (kind === "bereket" ? 7 : kind === "salgin" ? 5 : 3) };
    if (kind === "salgin" || kind === "sel") disaster(w, kind, NATURE_TEXT[kind]);
    else log(w, NATURE_TEXT[kind]);
  }
  {
    const adults2 = w.people.filter((p) => p.prof !== "naip");
    const starving = adults2.filter((p) => p.hunger >= 70).length / Math.max(1, adults2.length);
    if (starving >= 0.35 && (w.disaster?.kind !== "kitlik" || w.day - w.disaster.day >= 5)) disaster(w, "kitlik", `KITLIK! Halk\u0131n %${Math.round(starving * 100)}\u2019i a\xE7. Ekmek bulmak zorla\u015Ft\u0131; ambar ve f\u0131r\u0131nlar kritik.`);
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
    const gl = Object.keys(goods).map((g) => GOOD_LABEL[g]).join(", ");
    disaster(w, "kervan", `${w.caravan.name} limana geldi (${w.caravan.until}. g\xFCne dek)! Sat\u0131yor: ${gl} \u2013 piyasan\u0131n \xFCst\xFCnde fiyatla ama bol. Her sat\u0131\u015Ftan hazineye g\xFCmr\xFCk girer. Kervan ayr\u0131ca pazardaki ucuz el i\u015Fi ve tah\u0131l\u0131n\u0131z\u0131 nakit al\u0131r: satacak mal\u0131n\u0131z varsa pazara koyun. Ayr\u0131l\u0131nca sat\u0131lmayan mal\u0131 geri g\xF6t\xFCr\xFCr.`);
  }
  if (!w.threat && w.day > 15 && chance(w, 0.025)) {
    const strength2 = 6 + Math.round(rand(w) * 10);
    w.threat = { name: pick(w, ["Da\u011F a\u015Firetleri", "Korsanlar", "Kom\u015Fu bey", "E\u015Fk\u0131ya \xE7etesi"]), demand: 150 + strength2 * 25, day: w.day, deadline: w.day + 2, strength: strength2 };
    disaster(w, "tehdit", `SINIRDA TEHL\u0130KE: ${w.threat.name} (g\xFC\xE7 ~${strength2}) ${w.threat.demand} Dinar hara\xE7 istiyor! \xD6denmezse ${w.threat.deadline}. g\xFCn sald\u0131racaklar. Ordumuzun g\xFCc\xFC \u015Fu an ~${armyPower(w).toFixed(1)} (asker + yar\u0131m g\xFC\xE7le bek\xE7iler). Kayzer harac\u0131 \xF6derse askerlerin sadakati d\xFC\u015Fer; sava\u015F\u0131l\u0131p kazan\u0131l\u0131rsa ganimet hazineye girer, kaybedilirse hazine ya\u011Fmalan\u0131r ve askerler \xF6l\xFCr.`);
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
  return w.people.filter((p) => (p.prof === "asker" || p.prof === "bekci") && active2(p)).reduce((s, p) => s + (0.5 + p.loyalty / 100 + (p.inv.alet > 0 ? 0.2 : 0)) * (p.prof === "bekci" ? 0.5 : 1), 0);
}
function payTribute(w) {
  const t = w.threat;
  if (!t) return "Hara\xE7 isteyen yok.";
  if (!transfer(w, "saray", "dis", t.demand, "hara\xE7")) return "Hazine haraca yetmiyor!";
  for (const p of w.people) if (p.prof === "asker") p.loyalty = clamp(p.loyalty - 3);
  log(w, `${ek(t.name, "a")} ${t.demand} Dinar hara\xE7 \xF6dendi. Ordu bu a\u015Fa\u011F\u0131lanmadan ho\u015Fnut de\u011Fil.`);
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
    disaster(w, "zafer", `ZAFER! Ordu ${t.name} sald\u0131r\u0131s\u0131n\u0131 p\xFCsk\xFCrtt\xFC; ${loot} Dinar ganimet hazineye girdi. Askerlerin sadakati +6, herkesin morali +2.`);
  } else {
    const loss = Math.min(w.treasury, t.demand * 1.5);
    transfer(w, "saray", "dis", loss, "ya\u011Fma");
    const dead = w.people.filter((p) => p.prof === "asker" && !p.playerId).slice(0, 2);
    for (const p of dead) die(w, p, `Asker ${p.name} s\u0131n\u0131rda \u015Fehit d\xFC\u015Ft\xFC.`);
    for (const p of w.people) {
      p.mood = clamp(p.mood - 5);
      p.loyalty = clamp(p.loyalty - 4);
    }
    disaster(w, "yenilgi", `YEN\u0130LG\u0130! ${t.name} \u015Fehri ya\u011Fmalad\u0131: hazineden ${Math.round(loss)} Dinar gitti, ${dead.length} asker \u015Fehit d\xFC\u015Ft\xFC. Herkesin morali \u22125, sadakati \u22124.`);
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
function bekciShift(p) {
  let h = 0;
  for (const ch of p.id) h = h * 31 + ch.charCodeAt(0) >>> 0;
  return h % 2 ? "gece" : "gunduz";
}
var isProtected = (w, p) => p.protectedUntil >= w.day || p.id === w.kayzerId || p.prof === "naip";
function catcher(w, night) {
  const pool = w.people.filter((x) => x.prof === "bekci" && active2(x) && (night ? bekciShift(x) === "gece" : bekciShift(x) === "gunduz"));
  const power = Math.min(0.85, 0.12 + pool.length * 0.12 + (night ? 0 : 0.1));
  return pool.length && chance(w, power) ? pick(w, pool) : void 0;
}
function arrest(w, criminal, crime, victimId, amount, by, proof) {
  const c = by ?? catcher(w, w.hour >= 21 || w.hour < 6) ?? w.people.find((x) => x.prof === "bekci" && active2(x));
  if (!c) return null;
  const a = { id: nextId(w, "A"), criminalId: criminal.id, catcherId: c.id, crime, victimId, amount, day: w.day, hour: w.hour, offer: 0, status: "bekliyor", at: w.serverNow ?? w.lastTickAt, ...proof ?? {} };
  w.arrests.push(a);
  criminal.jailedDays = Math.max(criminal.jailedDays, 1);
  if (criminal.orderedBy && chance(w, 0.65)) revealOrder(w, criminal);
  interrogate(w, criminal);
  if (criminal.task) {
    criminal.task.status = "basarisiz";
    criminal.task.note = "Yakaland\u0131m.";
    criminal.task.doneAt = w.serverNow ?? w.lastTickAt;
  }
  log(w, `${c.name}, ${ek(criminal.name, "\u0131")} yakalad\u0131 (${CRIME_TEXT[crime]}). Sabah/ak\u015Fam ya h\xE2kime gidecek ya da\u2026`, criminal.id);
  if (criminal.playerId) personal(w, criminal.playerId, "Yakaland\u0131n\u0131z! G\xF6zalt\u0131ndas\u0131n\u0131z (Mahkeme nezarethanesi). 1 dakika i\xE7inde bek\xE7iye r\xFC\u015Fvet teklif edebilirsiniz; sonra savc\u0131 dava a\xE7ar ve duru\u015Fman\u0131z g\xF6r\xFCl\xFCr.");
  return a;
}
var WITNESS_R = 2;
var REPORT_MS = 6e4;
function crimeSeen(w, criminal, victim, crime, amount) {
  const now = w.serverNow ?? w.lastTickAt;
  const placed = placePeople(w, now);
  const cq = placed.find((q) => q.p.id === criminal.id);
  const near = cq ? placed.filter((q) => q.visible && q.p.id !== criminal.id && q.p.id !== victim?.id && Math.hypot(q.x - cq.x, q.y - cq.y) <= WITNESS_R) : [];
  if (cq) recordCrime(w, criminal.id, victim?.id ?? null, now, cq.x, cq.y);
  const bekci = near.find((q) => q.p.prof === "bekci" && q.p.jailedDays === 0 && q.p.id !== criminal.id);
  const eyes = near.length;
  if (bekci) return arrest(w, criminal, crime, victim?.id ?? null, amount, bekci.p, { evidence: Math.min(95, 80 + eyes * 3), eyewitnesses: eyes, eyeIds: near.map((q) => q.p.id), complainantId: bekci.p.id, basis: `su\xE7\xFCst\xFC: bek\xE7i 2 m i\xE7inde g\xF6rd\xFC${eyes > 1 ? `, ${eyes - 1} g\xF6rg\xFC tan\u0131\u011F\u0131 daha` : ""}` });
  const reporter = victim && findPerson(w, victim.id) && victim.health > 0 ? victim : near.find((q) => fullAI(q.p))?.p;
  if (reporter && victim) {
    w.crimeReports = [...w.crimeReports ?? [], { criminalId: criminal.id, victimId: victim.id, crime, amount, at: now, eyes, eyeIds: near.map((q) => q.p.id) }].slice(-20);
    log(w, `\u260E ${reporter.name}, ${ek(criminal.name, "\u0131")} bek\xE7iye \u015Fik\xE2yet etmeye gidiyor.`, reporter.id);
  }
  return null;
}
function processReports(w, now) {
  const left = [];
  for (const r of w.crimeReports ?? []) {
    if (now - r.at < REPORT_MS) {
      left.push(r);
      continue;
    }
    const cr = findPerson(w, r.criminalId);
    if (!cr || cr.jailedDays > 0) continue;
    const by = w.people.find((x) => x.prof === "bekci" && x.jailedDays === 0 && x.id !== cr.id);
    if (by) {
      log(w, `${by.name} \u015Fik\xE2yeti ald\u0131 ve savc\u0131ya bildirdi.`, by.id);
      const e = r.eyes ?? 0;
      arrest(w, cr, r.crime, r.victimId, r.amount, by, { evidence: Math.min(85, 45 + e * 12), eyewitnesses: e, eyeIds: r.eyeIds ?? [], complainantId: r.victimId, basis: e ? `ma\u011Fdurun \u015Fik\xE2yeti + ${e} g\xF6rg\xFC tan\u0131\u011F\u0131` : "yaln\u0131zca ma\u011Fdurun \u015Fik\xE2yeti (s\xF6z s\xF6ze kar\u015F\u0131)" });
    }
  }
  w.crimeReports = left;
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
    if (chance(w, 0.2)) rumor(w, `${ca.name} yakalad\u0131\u011F\u0131 ${ek(cr.name, "\u0131")} r\xFC\u015Fvetle salm\u0131\u015F!`, ca.id, -10);
    return `${ca.name} ${a.offer} Dinar'\u0131 ald\u0131 ve ${ek(cr.name, "\u0131")} sald\u0131.`;
  }
  a.status = "ret";
  openCase(w, cr.id, a.crime, a.victimId, a.amount, a.evidence ?? (a.crime === "cinayet" ? 60 : 55));
  {
    const nc = w.cases.filter((x) => x.accusedId === cr.id && x.crime === a.crime && x.stage !== "kapandi").at(-1);
    if (nc) {
      nc.eyewitnesses = a.eyewitnesses ?? 0;
      nc.basis = a.basis ?? "bek\xE7i tutana\u011F\u0131";
      nc.eyeIds = a.eyeIds ?? [];
      nc.complainantId = a.complainantId ?? a.catcherId;
    }
  }
  rel(cr, ca, -15, "beni tutuklad\u0131");
  if (a.offer > 0) {
    openCase(w, cr.id, "rusvet", null, a.offer, 80);
    ca.rep = clamp(ca.rep + 3, -100, 100);
    rumor(w, `${ca.name} r\xFC\u015Fveti reddetti, ${ek(cr.name, "\u0131")} kad\u0131ya teslim etti.`, ca.id, 5);
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
  if (isProtected(w, victim) || atHomeSafe(w, victim)) return 0;
  const amt = Math.min(Math.round(victim.money * 0.15), 30);
  if (amt <= 0) return 0;
  transfer(w, victim.id, thief.id, amt, "h\u0131rs\u0131zl\u0131k");
  victim.mood = clamp(victim.mood - 10);
  rel(victim, thief, -50, "beni soydu");
  thief.lastAction = "h\u0131rs\u0131zl\u0131k";
  log(w, `${victim.name} soyuldu (${amt} Dinar).`, victim.id);
  crimeSeen(w, thief, victim, "hirsizlik", amt);
  return amt;
}
function assault(w, a, v) {
  if (isProtected(w, v)) return `${v.name} \u015Fehre yeni geldi; ona dokunulmaz (koruma s\xFCresi).`;
  if (atHomeSafe(w, v)) return `${v.name} evinde; kap\u0131 kilitli, d\u0131\u015Far\u0131dan ula\u015Famazs\u0131n\u0131z.`;
  v.health = clamp(v.health - 35);
  v.wounded = true;
  v.mood = clamp(v.mood - 10);
  rel(v, a, -60, "beni d\xF6vd\xFC");
  for (const x of w.people) if (x.relations[v.id] && (x.relations[v.id] ?? 0) > 40) rel(x, a, -20, `${ek(v.name, "\u0131")} d\xF6vd\xFC`);
  log(w, `${a.name}, ${ek(v.name, "a")} sald\u0131rd\u0131 ve yaralad\u0131! Yaral\u0131 hekime gitmeli.`, v.id);
  crimeSeen(w, a, v, "saldiri", 0);
  return `${ek(v.name, "\u0131")} yaralad\u0131n\u0131z.`;
}
function murder(w, a, v) {
  if (isProtected(w, v)) return `${ek(v.name, "a")} dokunulmaz.`;
  if (atHomeSafe(w, v)) return `${v.name} evinde; kap\u0131 kilitli, d\u0131\u015Far\u0131dan ula\u015Famazs\u0131n\u0131z.`;
  if (v.playerId || v.prof === "asker" && chance(w, 0.7)) {
    v.health = 5;
    v.wounded = true;
    log(w, `${a.name}, ${ek(v.name, "\u0131")} \xF6ld\xFCrmeye kalkt\u0131; a\u011F\u0131r yaral\u0131 kurtuldu!`, v.id);
    crimeSeen(w, a, v, "cinayet", 0);
    return `${v.name} a\u011F\u0131r yaral\u0131 kurtuldu.`;
  }
  const co = makeCorpse(w, v, a, w.serverNow ?? w.lastTickAt);
  for (const x of w.people) if ((x.relations[v.id] ?? 0) > 20 && co.witnesses.includes(x.id)) rel(x, a, -70, `${ek(v.name, "\u0131")} \xF6ld\xFCrd\xFC`);
  die(w, v, `C\u0130NAYET! ${v.name} \xF6ld\xFCr\xFCld\xFC. Cesedi yerde yat\u0131yor\u2026`);
  return co.witnesses.length ? `${v.name} yere y\u0131\u011F\u0131ld\u0131\u2026 ${co.witnesses.length} ki\u015Fi g\xF6rd\xFC!` : `${v.name} yere y\u0131\u011F\u0131ld\u0131. Kimse g\xF6rmedi\u2026 \u015Fimdilik.`;
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
  { text: "Karn\u0131n\u0131z\u0131 doyurun (\u26A1 Yap \u2192 Ye)", done: (_w, p) => p.meals >= 1 },
  { text: "Su i\xE7in (susuzluk \xE7ubu\u011Fu bo\u015Falmas\u0131n)", done: (_w, p) => p.drinks >= 1 },
  { text: "Pazardan bir \u015Fey al\u0131n (Pazar binas\u0131na dokunun)", done: (w, p) => w.ledger.some((l) => l.from === p.id && l.reason.endsWith("al\u0131m\u0131")) },
  { text: "Camide namaz k\u0131l\u0131n ya da meyhanede bir kadeh i\xE7in", done: (_w, p) => p.lastAction.includes("namaz") || p.lastAction.includes("i\xE7ti") },
  { text: "Bir vatanda\u015Fla sohbet edin (birine dokunun \u2192 Sohbet)", done: (_w, p) => Object.values(p.relNote).some((x) => x.includes("sohbet")) },
  { text: "Saraya bir dilek\xE7e yaz\u0131n (Saray binas\u0131)", done: (w, p) => w.petitions.some((x) => x.fromId === p.id) },
  { text: "Meclis se\xE7iminde aday olun ya da oy verin (Meclis binas\u0131)", done: (w, p) => w.election.candidates.includes(p.id) || !!w.election.votes[p.id] || p.meclis },
  { text: "Hayvan Pazar\u0131\u2019na gidin (Bu\u011Fday Tarlalar\u0131\u2019n\u0131n bat\u0131s\u0131ndaki \xE7itli a\u011F\u0131l) ve bir tavuk ya da arsa al\u0131n", done: (_w, p) => !!p.farm || ["inek", "koyun", "tavuk", "at"].some((a) => (p.animals?.[a] ?? 0) > 0) }
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
      h.lastAction = `${ek(s.name, "\u0131n")} mallar\u0131n\u0131 ta\u015F\u0131yor`;
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
  if (p.hunger > 50 && p.inv.ekmek === 0 && lawOn(w, "askida")) {
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
  const hungry = p.hunger > 70 || p.thirst > 70;
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
  if (p.money < 8 && p.hunger > 60 && p.honesty < 55 && chance(w, (60 - p.honesty) / 200)) {
    const victims = w.people.filter((v) => v.money > 80 && v.id !== p.id && v.prof !== "kayzer" && v.prof !== "naip");
    if (victims.length) steal(w, p, pick(w, victims));
  }
  if (p.prof === "tuccar" && p.honesty < 30 && p.money > 200 && chance(w, 0.12)) {
    const t = w.people.find((x) => x.prof === "tahsildar" && x.honesty < 50 && x.jailedDays === 0);
    if (t) {
      transfer(w, p.id, t.id, 20, "r\xFC\u015Fvet");
      log(w, `${p.name}, ${ek(t.name, "a")} r\xFC\u015Fvet verdi diye f\u0131s\u0131ldan\u0131yor.`, p.id);
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
      if (receptive && chance(w, 0.3)) log(w, `${p.name}, ${ek(t.name, "a")} cumhuriyet propagandas\u0131 yapt\u0131.`, p.id);
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
var SEAT_COUNT = 16;
var SEATS = Array.from({ length: SEAT_COUNT }, (_, i) => ({ id: `mv${i + 1}`, label: `Milletvekili ${i + 1}`, kind: "genel", key: "genel" }));
var MP_ALLOWANCE = 4;
var DEBATE_DAYS = 1;
var VOTE_DAYS = 1;
var SANCTION_DAYS = 3;
var DEFAULT_BUDGET = 600;
function initMeclis() {
  return { seats: SEATS.map((s) => ({ ...s, holder: null })), factions: FACTIONS.map((f) => ({ ...f })), bills: [], log: [], bribes: [], salary: 6 };
}
function profGroup(p) {
  if (PRODUCES[p.prof] || p.prof === "tuccar" || p.prof === "hekim") return "esnaf";
  if (STATE_PROFS.includes(p.prof)) return "devlet";
  if (p.prof === "hamal" || p.prof === "insaatci" || p.prof === "kalemsor") return "emekci";
  return null;
}
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
var canRun = (w, p) => p.jailedDays === 0 && p.prof !== "naip" && p.prof !== "kayzer" && p.prof !== "asker" && p.prof !== "bekci" && p.id !== w.kayzerId;
function meclisElection(w, playerCandidates, playerVotes, npcAI) {
  let cands = [...new Set(playerCandidates)].filter((id) => {
    const p = findPerson(w, id);
    return p && canRun(w, p);
  });
  if (cands.length < SEAT_COUNT + 4) {
    const extra = w.people.filter((p) => npcAI(p) && canRun(w, p) && !cands.includes(p.id)).sort((a, b2) => b2.ambition + b2.money / 20 - (a.ambition + a.money / 20)).slice(0, SEAT_COUNT + 4 - cands.length);
    cands.push(...extra.map((p) => p.id));
  }
  const tally2 = {};
  for (const c of cands) tally2[c] = 0;
  for (const v of w.people.filter((p) => p.prof !== "naip" && p.jailedDays === 0)) {
    const pv = playerVotes[v.id];
    if (pv && tally2[pv] !== void 0) {
      tally2[pv] += 1;
      continue;
    }
    if (cands.includes(v.id) && !v.playerId) {
      tally2[v.id] = (tally2[v.id] ?? 0) + 1;
      continue;
    }
    if (v.playerId && !v.npc) continue;
    let best = "";
    let bs = -Infinity;
    for (const c of cands) {
      const cp = findPerson(w, c);
      const sc = (v.relations[c] ?? 0) * 0.6 - Math.abs(v.republic - cp.republic) * 0.5 - Math.abs(v.loyalty - cp.loyalty) * 0.25 - Math.abs(v.din - cp.din) * 0.15 + (w.election.posters?.[c] ?? 0) * 3 + (v.faction && v.faction === cp.faction ? 8 : 0) + (rand(w) - 0.5) * 12;
      if (sc > bs) {
        bs = sc;
        best = c;
      }
    }
    if (best) tally2[best] = (tally2[best] ?? 0) + 1;
  }
  const ranked = Object.entries(tally2).sort((a, b2) => b2[1] - a[1] || (findPerson(w, b2[0])?.ambition ?? 0) - (findPerson(w, a[0])?.ambition ?? 0));
  const winners = ranked.slice(0, SEAT_COUNT).filter(([, n2]) => n2 > 0).map(([id]) => id);
  w.meclis.seats = SEATS.map((s, i) => ({ ...s, holder: winners[i] ?? null }));
  w.election.last = { day: w.day, results: ranked.slice(0, 40).map(([id, n2]) => ({ id, votes: n2, won: winners.includes(id) })) };
  for (const p of w.people) {
    const was = p.meclis;
    p.meclis = winners.includes(p.id);
    if (p.meclis && !was) {
      p.immune = true;
      if (!p.faction) p.faction = naturalFaction(p);
      if (p.playerId) log(w, `\u{1F5F3} ${p.name} milletvekili se\xE7ildi! Meclis b\xF6l\xFCm\xFC a\xE7\u0131ld\u0131.`, p.id);
    }
    if (!p.meclis) p.immune = false;
  }
  electLeaders(w);
  mlog(w, `Se\xE7im sonu\xE7lar\u0131 (${SEAT_COUNT} sandalye): ${winners.map((id) => `${findPerson(w, id)?.name} (${tally2[id]})`).join(", ")}.`);
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
      return p && (STATE_PROFS.includes(p.prof) || !!p.rank) && p.id !== w.kayzerId ? null : "Gensoru devlet g\xF6revlileri ve vezir/pa\u015Fa gibi unvanl\u0131lar i\xE7in.";
    }
    case "sorusturma":
      return findPerson(w, target) && target !== w.kayzerId ? null : "Ge\xE7ersiz ki\u015Fi.";
    case "dokunulmazlik": {
      const p = findPerson(w, target);
      return p?.meclis && p.immune ? null : "Bu ki\u015Finin dokunulmazl\u0131\u011F\u0131 yok.";
    }
    case "azil":
      return w.regime === "cumhuriyet" && w.kayzerId ? null : "Azil sadece cumhuriyette, Ba\u015Fkan i\xE7in.";
    case "genelge":
      return null;
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
    case "genelge":
      return "Meclis genelgesi";
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
    case "genelge":
      s = (f === "halkci" ? 0.3 : 0.1) + (p.relations[b2.proposerId] ?? 0) / 150;
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
  evet: ["Bu teklif halk\u0131n yarar\u0131nad\u0131r, destekliyoruz!", "\u015Eehir bunu bekliyor; evet diyece\u011Fiz.", "Pazarda, limanda konu\u015Ftu\u011Fum herkes bunu istiyor.", "Bu ad\u0131m\u0131 atmazsak tarih bizi affetmez."],
  hayir: ["Bu teklif hazineyi de halk\u0131 da yorar, kar\u015F\u0131y\u0131z!", "B\xF6yle bir karar \u015Fehre zarar verir.", "Bunun bedelini yine esnaf \xF6der; hay\u0131r!", "Aceleye getirilmi\u015F bir teklif, reddediyoruz."],
  cekimser: ["Teklifin baz\u0131 y\xF6nleri iyi, baz\u0131lar\u0131 de\u011Fil; d\xFC\u015F\xFCnmeliyiz.", "Daha fazla g\xF6r\xFC\u015Fme gerekiyor.", "Ne tam kar\u015F\u0131y\u0131m ne tam destek\xE7i."]
};
var IDEO_LINE = { saltanatci: "Kayzer\u2019e ve d\xFCzene sadakat \xF6nce gelir.", cumhuriyetci: "Halk\u0131n iradesi her \u015Feyin \xFCst\xFCndedir.", esnaf: "\xC7ar\u015F\u0131n\u0131n bereketi \u015Fehrin bereketidir.", halkci: "Fakir fukaran\u0131n sofras\u0131n\u0131 d\xFC\u015F\xFCnmeliyiz." };
function npcSpeech(w, p, b2, v) {
  const f = w.meclis.factions.find((x) => x.id === p.faction)?.ideology ?? "halkci";
  return `\u201C${b2.title}\u201D hakk\u0131nda: ${pick(w, SPEECH[v])} ${IDEO_LINE[f] ?? ""}`.trim();
}
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
        const old = t.rank ? `${t.rank} unvan\u0131 ve ${PROF_LABEL[t.prof]}` : PROF_LABEL[t.prof];
        t.rank = null;
        t.fief = null;
        t.prof = STATE_PROFS.includes(t.prof) ? "hamal" : t.prof;
        t.work = WORKPLACE.hamal;
        t.mood = clamp(t.mood - 20);
        mlog(w, `Gensoru kabul edildi: ${t.name} ${old} g\xF6revinden al\u0131nd\u0131.`, t.id);
      }
      break;
    }
    case "sorusturma":
      investigate2(w, b2.target);
      break;
    case "dokunulmazlik": {
      const t = findPerson(w, b2.target);
      if (t) {
        t.immune = false;
        mlog(w, `${ek(t.name, "\u0131n")} dokunulmazl\u0131\u011F\u0131 kald\u0131r\u0131ld\u0131.`, t.id);
      }
      break;
    }
    case "genelge": {
      for (const x of w.people) x.mood = clamp(x.mood + 1);
      log(w, `\u{1F4DC} Meclis genelgesi yay\u0131mland\u0131: \u201C${b2.title}\u201D.`);
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
function investigate2(w, targetId) {
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
var headIsPlayer = (w) => {
  const k = findPerson(w, w.kayzerId);
  return !!k?.playerId && !k.npc;
};
function meclisDay(w, playerDecides, headOnline) {
  const ms = members(w);
  for (const p of ms) if (w.meclis.salary > 0 && p.jailedDays === 0) transfer(w, "saray", p.id, w.meclis.salary, "meclis maa\u015F\u0131");
  for (const p of ms) if (p.jailedDays === 0 && w.treasury >= MP_ALLOWANCE) transfer(w, "saray", p.id, MP_ALLOWANCE, "milletvekili \xF6dene\u011Fi");
  for (const p of ms) if (!playerDecides(p) && chance(w, 0.12)) npcPropose(w, p);
  for (const b2 of w.meclis.bills) {
    if (b2.status === "tartisma") {
      for (const p of ms) if (!playerDecides(p) && !b2.speeches.some((s) => s.personId === p.id) && chance(w, 0.5)) {
        const v = npcVote(w, p, b2);
        b2.speeches.push({ personId: p.id, text: npcSpeech(w, p, b2, v), day: w.day });
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
      const needsSanction = w.regime === "imparatorluk" && b2.kind !== "sorusturma" && b2.kind !== "dokunulmazlik" && b2.kind !== "genelge" && !!w.kayzerId && !b2.fromKayzer;
      if (needsSanction) {
        b2.status = "onay";
        b2.voteUntil = w.day + SANCTION_DAYS;
        mlog(w, `\u201C${b2.title}\u201D Kayzer'in onay\u0131n\u0131 bekliyor.`);
      } else enact(w, b2);
    } else if (b2.status === "onay" && (!headIsPlayer(w) || !headOnline && w.day >= b2.voteUntil)) {
      const approve = b2.kind === "af" ? chance(w, 0.3) : b2.kind === "vergi" ? b2.value >= w.taxRate - 4 || w.treasury > 1500 : true;
      sanction(w, b2, approve);
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
  const recent = (k) => w.meclis.bills.some((b2) => b2.kind === k && (["tartisma", "oylama", "onay"].includes(b2.status) || w.day - b2.day < 5));
  const budgetRejected = w.meclis.bills.filter((b2) => b2.kind === "butce" && b2.status === "ret").length;
  if (!w.budget.approved && f !== "cumhuriyetci" && !recent("butce")) r = propose(w, p, "butce", Math.round(Math.min(budgetRejected ? 1400 : 3e3, Math.max(800, w.treasury * 0.2)) / 100) * 100, "");
  else if (!recent("vergi") && f === "esnaf" && w.taxRate > 12) r = propose(w, p, "vergi", w.taxRate - 2, "");
  else if (!recent("sorusturma") && f === "cumhuriyetci" && corrupt[0] && findPerson(w, corrupt[0])?.id !== w.kayzerId) r = propose(w, p, "sorusturma", 0, corrupt[0]);
  else if (!recent("azil") && f === "cumhuriyetci" && w.regime === "cumhuriyet" && avgMood < 35 && w.kayzerId && findPerson(w, w.kayzerId)?.faction !== p.faction) r = propose(w, p, "azil", 0, "");
  else if (!recent("gensoru") && f === "cumhuriyetci" && off[0]) r = propose(w, p, "gensoru", 0, off[0].id);
  else if (!recent("af") && f === "halkci" && w.people.filter((x) => x.jailedDays > 0).length > 4) r = propose(w, p, "af", 0, "");
  else if (!recent("insaat") && f === "halkci" && !w.projects.some((x) => !x.done) && w.treasury > 1500) r = propose(w, p, "insaat", 800, "");
  else if (!recent("fiyat") && f === "halkci" && w.prices.ekmek > 4.5) r = propose(w, p, "fiyat", Math.round(BASE_PRICE.ekmek * 1.2 * 10) / 10, "ekmek");
  else if (!recent("maas") && f === "saltanatci" && (w.salaries.asker ?? 0) < 12) r = propose(w, p, "maas", 12, "asker");
  else if (!recent("genelge") && chance(w, 0.3)) r = propose(w, p, "genelge", 0, "", pick(w, ["Kuyular\u0131n temizli\u011Fi i\xE7in \xE7a\u011Fr\u0131", "Pazarda d\xFCr\xFCst tart\u0131 \xE7a\u011Fr\u0131s\u0131", "Yetimlere yard\u0131m \xE7a\u011Fr\u0131s\u0131", "Gece asayi\u015Fi i\xE7in bek\xE7ilere te\u015Fekk\xFCr", "K\u0131tl\u0131\u011Fa kar\u015F\u0131 ambar \xE7a\u011Fr\u0131s\u0131"]));
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
function kayzerBill(w, k, kind, value, target) {
  const err = validateBill(w, kind, value, target);
  if (err) return err;
  if (w.meclis.bills.some((b2) => b2.fromKayzer && b2.kind === kind && (b2.status === "tartisma" || b2.status === "oylama"))) return "Bu konuda Meclis\u2019te bekleyen bir teklifiniz var.";
  const bill = { id: nextId(w, "B"), kind, value, target, title: `Saray teklifi: ${billTitle(w, kind, value, target)}`, proposerId: k.id, day: w.day, debateUntil: w.day + DEBATE_DAYS, voteUntil: w.day + DEBATE_DAYS + VOTE_DAYS, status: "tartisma", votes: {}, speeches: [], fromKayzer: true };
  w.meclis.bills.push(bill);
  mlog(w, `Saray \u201C${bill.title}\u201D teklifini Meclis\u2019e sevk etti.`, k.id);
  return bill;
}
function foundFaction(w, p, name) {
  if (!p.meclis) return "Parti kurmak i\xE7in milletvekili olmal\u0131s\u0131n\u0131z.";
  const n2 = name.trim().slice(0, 30);
  if (n2.length < 3) return "Parti ad\u0131 en az 3 harf.";
  if (w.meclis.factions.length >= 8) return "\xC7ok fazla parti var.";
  const id = `f${w.idSeq++}`;
  w.meclis.factions.push({ id, name: n2, ideology: p.republic > 55 ? "cumhuriyetci" : p.loyalty > 70 ? "saltanatci" : profGroup(p) === "esnaf" ? "esnaf" : "halkci", leaderId: p.id, color: ["#2a9d8f", "#e76f51", "#8ab17d", "#b56576"][w.meclis.factions.length % 4] });
  p.faction = id;
  mlog(w, `${p.name} yeni bir parti kurdu: ${n2}.`, p.id);
  return `${n2} kuruldu; lideri sizsiniz.`;
}
function migrateMeclis16(w) {
  if (w.meclis.seats.length === SEAT_COUNT && w.meclis.seats[0]?.kind === "genel") return;
  const holders = w.meclis.seats.map((s) => s.holder).filter((x) => !!x);
  const never = !w.election.last && w.day < 10;
  w.meclis.seats = SEATS.map((s, i) => ({ ...s, holder: never ? null : holders[i] ?? null }));
  if (never) {
    for (const p of w.people) if (p.meclis) {
      p.meclis = false;
      p.immune = false;
    }
    w.election.nextDay = w.day + 10;
    w.election.candidates = [];
    w.election.votes = {};
    w.meclis.log.push({ day: w.day, text: `Atanm\u0131\u015F Meclis da\u011F\u0131t\u0131ld\u0131. \u0130lk Meclis se\xE7imi ${w.election.nextDay}. g\xFCn: adayl\u0131k \u015Fimdi a\xE7\u0131k.` });
  }
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
    b("hayvan", "Hayvan Pazar\u0131", "hayvan", 70, 36, 8, 4),
    b("arsa1", "Arsa (bo\u015F)", "arsa", 82, 3, 8, 6),
    b("arsa2", "Arsa (bo\u015F)", "arsa", 93, 3, 6, 6),
    b("arsa3", "Arsa (bo\u015F)", "arsa", 93, 22, 6, 5),
    b("arsa4", "Arsa (bo\u015F)", "arsa", 46, 37, 8, 5)
  ];
  const occupied = (x, y, w, h) => list.some((o) => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y) || ROADS_Y.some((ry) => ry >= y && ry < y + h + 1) || ROADS_X.some((rx) => rx >= x && rx < x + w);
  let n2 = 0;
  for (let y = 30; y <= 46; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3) && x + 3 < MAP_W && y + 3 < MAP_H - 6 && n2 < 70) {
        n2 += 1;
        list.push(b(`ev${n2}`, `Ev ${n2}`, "ev", x, y, 3, 3));
      }
    }
  }
  for (let y = 14; y <= 26; y += 5) {
    for (let x = 1; x <= MAP_W - 5; x += 4) {
      if (!occupied(x, y, 3, 3) && n2 < 90) {
        n2 += 1;
        list.push(b(`ev${n2}`, `Ev ${n2}`, "ev", x, y, 3, 3));
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
  hayvanci: "hayvan",
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
    election: { nextDay: 10, candidates: [], votes: {}, seats: 16, baskanNextDay: 0, baskanCandidates: [], baskanVotes: {} },
    gazette: [],
    events: [],
    todayEvents: [],
    players: {},
    regime: "imparatorluk",
    meclis: initMeclis(),
    budget: { limit: DEFAULT_BUDGET, spent: 0, until: 20, approved: false },
    schema: 4,
    corpses: [],
    escorts: [],
    llm: { day: "", n: 0, talkAt: 0 },
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
  const houses2 = w.buildings.filter((x) => x.kind === "ev");
  let hi = 0;
  const nextHome = () => {
    const h = houses2[hi % houses2.length];
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
  for (const s of w.meclis.seats) s.holder = null;
  for (const p of w.people) {
    p.meclis = false;
    p.immune = false;
  }
  log(w, "\u0130mparatorluk kuruldu. \u0130lk Meclis se\xE7imi 10. g\xFCn: adayl\u0131k \u015Fimdi a\xE7\u0131k (3. g\xFCne kadar), ard\u0131ndan propaganda.");
  w.todayEvents = [];
  return migrate10(w);
}
function findPerson(w, id) {
  if (!id) return void 0;
  return w.people.find((p) => p.id === id);
}

// src/sim/housing.ts
var HOUSE_CAP = 5;
var SPOT_PRICE = 150;
var RENT_PER_DAY = 4;
var houses = (w) => w.buildings.filter((b2) => b2.kind === "ev");
var residents = (w, id) => w.people.filter((p) => p.home === id);
var freeSpots = (w, id) => HOUSE_CAP - residents(w, id).length;
var ownerOf = (w, id) => {
  const b2 = w.buildings.find((x) => x.id === id);
  return findPerson(w, b2?.ownerId) ?? residents(w, id)[0];
};
var homeless = (p) => !p.home || p.home === "sokak";
function atHomeSafe(w, p, now = w.serverNow ?? w.lastTickAt) {
  if (homeless(p) || p.jailedDays > 0) return false;
  if (p.playerId && !p.npc) return (p.homeUntil ?? 0) > now;
  return (w.hour >= 22 || w.hour < 5) && !p.nightOut && !["bekci", "asker", "naip"].includes(p.prof) && !p.task;
}
function moveIn(w, p, id, how) {
  const b2 = w.buildings.find((x) => x.id === id && x.kind === "ev");
  if (!b2) return "B\xF6yle bir ev yok.";
  if (p.home === id) return "Zaten burada oturuyorsunuz.";
  if (freeSpots(w, id) <= 0) return `Bu ev dolu (${HOUSE_CAP}/${HOUSE_CAP}).`;
  const owner = ownerOf(w, id);
  const to = owner && owner.id !== p.id ? owner.id : "saray";
  const cost = how === "satin" ? SPOT_PRICE : RENT_PER_DAY;
  if (!transfer(w, p.id, to, cost, how === "satin" ? "ev pay\u0131" : "kira")) return `${how === "satin" ? "Ev pay\u0131" : "\u0130lk g\xFCn\xFCn kiras\u0131"} ${cost} Dinar; paran\u0131z yetmiyor.`;
  if (!b2.ownerId && owner) b2.ownerId = owner.id;
  p.home = id;
  p.renting = how === "kira" ? id : null;
  const sp = findPerson(w, p.spouse);
  if (sp && sp.home !== id && freeSpots(w, id) > 0) sp.home = id;
  if (owner?.playerId && owner.id !== p.id) personal(w, owner.playerId, `\u{1F3E0} ${p.name} evinize ${how === "satin" ? `${SPOT_PRICE} Dinar\u2019a yer sat\u0131n ald\u0131` : `kirac\u0131 olarak ta\u015F\u0131nd\u0131 (${RENT_PER_DAY} D/g\xFCn)`}.`);
  return how === "satin" ? `${b2.name}\u2019de yer sat\u0131n ald\u0131n\u0131z (${SPOT_PRICE} D, ${ek(owner?.name ?? "Saray", "a")}). Geceleri evinizde uyuyabilirsiniz.` : `${ek(b2.name, "a")} kirac\u0131 olarak ta\u015F\u0131nd\u0131n\u0131z (${RENT_PER_DAY} D/g\xFCn, ${ek(owner?.name ?? "Saray", "a")}).`;
}
function housingDay(w) {
  for (const p of w.people) {
    if (!p.renting || p.home !== p.renting) continue;
    const owner = ownerOf(w, p.home);
    if (!transfer(w, p.id, owner && owner.id !== p.id ? owner.id : "saray", RENT_PER_DAY, "kira")) {
      const h = p.home;
      p.home = "";
      p.renting = null;
      p.homeUntil = 0;
      if (p.playerId) personal(w, p.playerId, `Kiray\u0131 \xF6deyemediniz; ${w.buildings.find((b2) => b2.id === h)?.name ?? "ev"}den \xE7\u0131kar\u0131ld\u0131n\u0131z.`);
    }
  }
}
function goInside(w, p, sleep, now, hourMs2) {
  if (homeless(p)) return "Eviniz yok. Bo\u015F yeri olan bir eve dokunup yer sat\u0131n al\u0131n ya da kiralay\u0131n.";
  const hoursToMorning = (7 - w.hour + 24) % 24 || 8;
  const h = sleep ? Math.min(10, Math.max(2, hoursToMorning)) : 2;
  p.homeUntil = now + h * hourMs2;
  p.sleeping = sleep;
  delete p.walk;
  return sleep ? `\u0130yi geceler. ${h} saat uyuyacaks\u0131n\u0131z; enerji ve sa\u011Fl\u0131k yenilenir. Evdeyken kimse size dokunamaz.` : "Evinizdesiniz (2 saat dinlenme). Evdeyken kimse size dokunamaz.";
}
function leaveHome(p) {
  p.homeUntil = 0;
  p.sleeping = false;
}
function energyHour(w, now) {
  for (const p of w.people) {
    if (p.jailedDays > 0 && (w.hour === 8 || w.hour === 18)) {
      p.hunger = Math.min(p.hunger, 25);
      p.thirst = Math.min(p.thirst, 20);
    }
    if (!p.playerId || p.npc) {
      p.energy = 80;
      continue;
    }
    if (p.jailedDays > 0) {
      p.energy = clamp((p.energy ?? 80) + 3);
      continue;
    }
    const inside = (p.homeUntil ?? 0) > now;
    if (inside) {
      p.energy = clamp((p.energy ?? 80) + (p.sleeping ? 14 : 6));
      p.health = clamp(p.health + (p.sleeping ? 1.5 : 0.5));
    } else {
      p.energy = clamp((p.energy ?? 80) - 4);
      if ((p.energy ?? 0) < 15) p.mood = clamp(p.mood - 1);
    }
    if (!inside && p.sleeping) {
      p.sleeping = false;
      if (p.playerId) personal(w, p.playerId, "G\xFCnayd\u0131n! Dinlenmi\u015F uyand\u0131n\u0131z.");
    }
  }
}
function rehouse(w) {
  const hs = houses(w);
  if (!hs.length) return;
  let moved = 0;
  for (const b2 of hs) {
    const rs = residents(w, b2.id);
    if (!b2.ownerId && rs[0]) b2.ownerId = rs[0].id;
    if (rs.length <= HOUSE_CAP) continue;
    const keep = /* @__PURE__ */ new Set();
    for (const p of rs) {
      if (keep.size >= HOUSE_CAP) break;
      if (keep.has(p.id)) continue;
      const sp = rs.find((x) => x.id === p.spouse);
      if (sp && keep.size + 2 > HOUSE_CAP) continue;
      keep.add(p.id);
      if (sp) keep.add(sp.id);
    }
    for (const p of rs) if (!keep.has(p.id)) {
      moved++;
      const to = hs.find((x) => freeSpots(w, x.id) >= (p.spouse && rs.some((y) => y.id === p.spouse && !keep.has(y.id)) ? 2 : 1));
      if (to) {
        p.home = to.id;
        const sp = rs.find((y) => y.id === p.spouse && !keep.has(y.id));
        if (sp) {
          sp.home = to.id;
          keep.add(sp.id);
        }
      } else p.home = "";
      keep.add(p.id);
    }
  }
  if (moved) log(w, `\u{1F3E0} Evlere en fazla 5 ki\u015Fi s\u0131\u011Far: ${moved} ki\u015Fi bo\u015F evlere ta\u015F\u0131nd\u0131.`);
}

// src/sim/realm.ts
var SEASON_DAYS = 30;
var SEASON_LABEL = { ilkbahar: "\u{1F338} \u0130lkbahar", yaz: "\u2600\uFE0F Yaz", sonbahar: "\u{1F342} Sonbahar", kis: "\u2744\uFE0F K\u0131\u015F" };
function season(w) {
  return ["ilkbahar", "yaz", "sonbahar", "kis"][Math.floor(Math.max(0, w.day - 1) / SEASON_DAYS) % 4];
}
var HUNGER_PER_H = 4;
var THIRST_PER_H = 4.5;
function needsDrain(w, eat, drink) {
  const s = season(w);
  const night = w.hour < 6 || w.hour >= 23;
  for (const p of w.people) {
    if (p.prof === "naip") {
      p.hunger = 0;
      p.thirst = 0;
      continue;
    }
    p.hunger = clamp(p.hunger + HUNGER_PER_H * (night ? 0.5 : 1));
    p.thirst = clamp(p.thirst + THIRST_PER_H * (night ? 0.5 : 1) * (s === "yaz" ? 1.25 : 1));
    const autoT = p.playerId && !p.npc ? 80 : 50;
    if (p.thirst >= autoT) {
      if (p.inv.sut > 0 && chance(w, 0.4)) {
        p.inv.sut -= 1;
        p.thirst = clamp(p.thirst - 30);
        p.hunger = clamp(p.hunger - 10);
        p.drinks += 1;
      } else drink(p);
    }
    if (p.hunger >= autoT + 5) {
      if (p.inv.yumurta > 0 && chance(w, 0.4)) {
        p.inv.yumurta -= 1;
        p.hunger = clamp(p.hunger - 22);
        p.meals += 1;
      } else eat(p);
    }
    if (p.hunger >= 100) {
      p.health = clamp(p.health - 2.5);
      p.mood = clamp(p.mood - 0.5);
    }
    if (p.thirst >= 100) {
      p.health = clamp(p.health - 3.5);
      p.mood = clamp(p.mood - 0.5);
    }
    if (p.health < 5) p.health = 5;
  }
}
function drinkMilk(p) {
  if (p.inv.sut <= 0) return "S\xFCt\xFCn\xFCz yok.";
  p.inv.sut -= 1;
  p.thirst = clamp(p.thirst - 30);
  p.hunger = clamp(p.hunger - 10);
  p.drinks += 1;
  return "S\xFCt i\xE7tiniz (susuzluk \u221230, a\xE7l\u0131k \u221210).";
}
function eatEgg(p) {
  if (p.inv.yumurta <= 0) return "Yumurtan\u0131z yok.";
  p.inv.yumurta -= 1;
  p.hunger = clamp(p.hunger - 22);
  p.meals += 1;
  return "Yumurta yediniz (a\xE7l\u0131k \u221222).";
}
function seasonDay(w) {
  const s = season(w);
  if (w.day % SEASON_DAYS === 1 && w.day > 1) log(w, `${SEASON_LABEL[s]} geldi. ${s === "kis" ? "Odun stoklay\u0131n; so\u011Fuk hastal\u0131k getirir." : s === "yaz" ? "S\u0131caklar ba\u015Flad\u0131; daha \xE7ok su gerekecek." : s === "sonbahar" ? "Yapraklar d\xF6k\xFCl\xFCyor; k\u0131\u015Fa haz\u0131rlan\u0131n." : "\xC7i\xE7ekler a\xE7t\u0131; tarlalar bereketli."}`);
  if (s !== "kis") return;
  for (const p of w.people) {
    if (p.prof === "naip" || p.jailedDays > 0 || p.soylu && p.home === "saray" || p.id === w.kayzerId) continue;
    if (p.inv.odun <= 0 && p.money > 3) buy(w, p.id, "odun", 1, p.money * 0.3);
    if (p.inv.odun > 0) {
      p.inv.odun -= 1;
      continue;
    }
    p.health = clamp(p.health - 4);
    p.mood = clamp(p.mood - 2);
    if (chance(w, 0.15)) {
      p.health = clamp(p.health - 12);
      if (p.playerId) personal(w, p.playerId, "\u{1F927} Evde odun yok, \xFC\u015F\xFCtt\xFCn\xFCz! Hekime gidin, odun al\u0131n.");
    }
  }
}
var ANIMALS = ["inek", "koyun", "tavuk", "at"];
var ANIMAL_LABEL = { inek: "\u0130nek", koyun: "Koyun", tavuk: "Tavuk", at: "At" };
var ANIMAL_PRICE = { inek: 120, koyun: 45, tavuk: 6, at: 150 };
var ANIMAL_FEED = { inek: 2, koyun: 1, tavuk: 0.2, at: 2 };
var ANIMAL_MEAT = { inek: 8, koyun: 4, tavuk: 1, at: 0 };
var FARM_PRICE = 250;
var needsFarm = (a) => a === "inek" || a === "koyun";
var herd = (p) => p.animals ??= { inek: 0, koyun: 0, tavuk: 0, at: 0 };
var hasHorse = (p) => (p.animals?.at ?? 0) > 0;
var BARN = { ahir: { cost: 120, cap: 6, label: "Ah\u0131r", odun: 6 }, kumes: { cost: 50, cap: 15, label: "K\xFCmes", odun: 2 } };
function barnRoom(p, a) {
  const b2 = p.barn ?? { ahir: 0, kumes: 0 };
  const hd = herd(p);
  if (a === "tavuk") return b2.kumes * BARN.kumes.cap - hd.tavuk;
  if (a === "at" && !p.farm) return hd.at > 0 ? 0 : 1;
  return b2.ahir * BARN.ahir.cap - hd.inek - hd.koyun - hd.at;
}
function buildBarn(w, p, kind) {
  if (!p.farm) return "\xD6nce Hayvan Pazar\u0131\u2019ndan bir \xE7iftlik arsas\u0131 al\u0131n.";
  const B = BARN[kind];
  if (!B) return "B\xF6yle yap\u0131 yok.";
  const b2 = p.barn ??= { ahir: 0, kumes: 0 };
  if (b2[kind] >= 3) return `En fazla 3 ${B.label}.`;
  if (!transfer(w, p.id, "saray", B.cost, `${B.label} yap\u0131m\u0131`)) return `${B.label} ${B.cost} Dinar.`;
  b2[kind] += 1;
  return `${B.label} yap\u0131ld\u0131! (${kind === "ahir" ? `inek/koyun/at i\xE7in ${B.cap}` : `${B.cap} tavuk`} yer)`;
}
function feedAnimals(w, p) {
  const hd = herd(p);
  const need = Math.ceil(ANIMALS.reduce((s, a) => s + hd[a] * ANIMAL_FEED[a], 0));
  if (need <= 0) return "Hayvan\u0131n\u0131z yok.";
  if (p.fedDay === w.day) return "Hayvanlar\u0131n\u0131z bug\xFCn zaten doydu.";
  if (p.inv.bugday < need) buy(w, p.id, "bugday", need - p.inv.bugday, p.money);
  if (p.inv.bugday < need && (w.granary ?? 0) > 0) {
    const q = Math.min(need - p.inv.bugday, Math.floor(w.granary));
    const cost = Math.round(q * (w.prices.bugday ?? 1) * 1.1 * 100) / 100;
    if (q > 0 && transfer(w, p.id, "saray", cost, "ambardan yem")) {
      w.granary -= q;
      p.inv.bugday += q;
    }
  }
  if (p.inv.bugday < need) return `${need} bu\u011Fday yem gerekiyor; alamad\u0131n\u0131z.`;
  p.inv.bugday -= need;
  p.fedDay = w.day;
  return `Hayvanlar ${need} bu\u011Fdayla beslendi. Yar\u0131n s\xFCt/yumurta/y\xFCn toplayabilirsiniz.`;
}
function collectFarm(p) {
  const st = p.farmStock ?? {};
  const got = Object.entries(st).filter(([, q]) => (q ?? 0) > 0);
  if (!got.length) return "Toplanacak \xFCr\xFCn yok. Hayvanlar\u0131 her g\xFCn besleyin.";
  for (const [g, q] of got) p.inv[g] += q;
  p.farmStock = {};
  return `Topland\u0131: ${got.map(([g, q]) => `${q} ${{ sut: "s\xFCt", yumurta: "yumurta", yun: "y\xFCn" }[g] ?? g}`).join(", ")}.`;
}
function buyFarm(w, p) {
  if (p.farm) return "Zaten bir \xE7iftli\u011Finiz var.";
  if (!transfer(w, p.id, "saray", FARM_PRICE, "arsa / \xE7iftlik tapusu")) return `\xC7iftlik arsas\u0131 ${FARM_PRICE} Dinar.`;
  p.farm = true;
  p.barn ??= { ahir: 0, kumes: 0 };
  log(w, `\u{1F3E1} ${p.name} bir arsa al\u0131p \xE7iftlik kurdu.`, p.id);
  return "\xC7iftlik arsan\u0131z haz\u0131r (Bu\u011Fday Tarlalar\u0131\u2019n\u0131n yan\u0131nda). \u015Eimdi ah\u0131r ya da k\xFCmes yap\u0131n, sonra hayvan al\u0131n.";
}
function buyAnimal(w, p, a, n2 = 1) {
  if (!ANIMALS.includes(a)) return "B\xF6yle hayvan yok.";
  if (needsFarm(a) && !p.farm) return `${ANIMAL_LABEL[a]} i\xE7in \xF6nce bir \xE7iftlik arsas\u0131 almal\u0131s\u0131n\u0131z.`;
  if (p.prof !== "hayvanci") {
    const room = barnRoom(p, a);
    if (room < n2) return a === "tavuk" ? `K\xFCmesinizde yer yok (${room}). \xC7iftli\u011Finize k\xFCmes yap\u0131n.` : a === "at" && !p.farm ? "\xC7iftliksiz yaln\u0131zca bir at besleyebilirsiniz (handa)." : `Ah\u0131r\u0131n\u0131zda yer yok (${room}). \xC7iftli\u011Finize ah\u0131r yap\u0131n.`;
  }
  const seller = w.people.find((x) => x.prof === "hayvanci" && x.jailedDays === 0 && x.id !== p.id);
  const cost = ANIMAL_PRICE[a] * n2;
  if (!transfer(w, p.id, seller?.id ?? "saray", cost, `${a} al\u0131m\u0131`)) return `${n2} ${ANIMAL_LABEL[a]} ${cost} Dinar; paran\u0131z yetmiyor.`;
  if (seller) {
    seller.incomeToday += cost * 0.4;
    transfer(w, seller.id, "dis", cost * 0.55, "hayvan tedariki");
  }
  herd(p)[a] += n2;
  return `${n2} ${ANIMAL_LABEL[a]} ald\u0131n\u0131z${seller ? ` (${seller.name})` : ""}. G\xFCnl\xFCk yem: ${Math.round(ANIMAL_FEED[a] * n2 * 10) / 10} bu\u011Fday.`;
}
function slaughter(w, p, a) {
  const hd = herd(p);
  if (hd[a] <= 0) return "O hayvandan yok.";
  if (!ANIMAL_MEAT[a]) return "At kesilmez!";
  hd[a] -= 1;
  p.inv.et += ANIMAL_MEAT[a];
  if (a === "koyun") p.inv.yun += 2;
  void w;
  return `${ANIMAL_LABEL[a]} kesildi: ${ANIMAL_MEAT[a]} et${a === "koyun" ? " + 2 y\xFCn" : ""}.`;
}
function animalsDay(w) {
  for (const p of w.people) {
    const hd = p.animals;
    if (!hd) continue;
    const feed = ANIMALS.reduce((s, a) => s + hd[a] * ANIMAL_FEED[a], 0);
    if (feed <= 0) continue;
    const need = Math.ceil(feed);
    const human = !!p.playerId && !p.npc;
    let fed;
    if (human) fed = p.fedDay === w.day;
    else {
      if (p.inv.bugday < need) buy(w, p.id, "bugday", need - p.inv.bugday, p.money * 0.5);
      fed = p.inv.bugday >= need;
      p.inv.bugday = Math.max(0, p.inv.bugday - need);
    }
    if (!fed) {
      for (const a of ANIMALS) if (hd[a] > 0 && chance(w, human ? 0.04 : 0.08)) {
        hd[a] -= 1;
        if (p.playerId) personal(w, p.playerId, `${ANIMAL_LABEL[a]} a\xE7l\u0131ktan \xF6ld\xFC! Yem (bu\u011Fday) al\u0131n.`);
      }
      continue;
    }
    const out = { sut: hd.inek * 3, yun: Math.floor(hd.koyun * 0.5 + (w.day % 2 ? 0.5 : 0)) * 1, yumurta: hd.tavuk };
    for (const [g, q] of Object.entries(out)) {
      if (!q) continue;
      if (p.npc || !p.playerId) addListing(w, p, g, q, sellerPrice(w, p, g), "gida");
      else {
        const st = p.farmStock ??= {};
        st[g] = Math.min(60, (st[g] ?? 0) + q);
      }
    }
  }
}
function hayvanciDay(w) {
  for (const p of w.people.filter((x) => x.prof === "hayvanci" && x.npc !== false && !x.playerId)) {
    p.farm = true;
    const hd = herd(p);
    if (hd.inek < 3) hd.inek += 1;
    if (hd.tavuk < 10) hd.tavuk += 3;
    if (hd.koyun < 4) hd.koyun += 1;
    if (hd.at < 2) hd.at += 1;
  }
}
var RANKS_N = ["Vezir", "Pa\u015Fa", "Bey", "A\u011Fa"];
var RANK_INFO = {
  Vezir: { stipend: 20, duty: "Divan\u2019\u0131 y\xF6netir: dilek\xE7eler h\u0131zlan\u0131r, hazine g\xFCnde %0,5 faiz kazan\u0131r.", max: 1 },
  Pa\u015Fa: { stipend: 15, duty: "Orduya komuta eder: sad\u0131k Pa\u015Fa askerin moralini y\xFCkseltir, sadakatsiz Pa\u015Fa d\xFC\u015F\xFCr\xFCr.", max: 2 },
  Bey: { stipend: 10, duty: "T\u0131mar\u0131n\u0131n (dirlik) vergisini toplar: oradaki \xE7al\u0131\u015Fanlar\u0131n gelirinin %5\u2019i hazineye, %2\u2019si kendine.", max: 4 },
  A\u011Fa: { stipend: 6, duty: "Mahallede asayi\u015Fi sa\u011Flar: su\xE7lar azal\u0131r, bek\xE7iye yard\u0131m eder.", max: 6 }
};
var FIEFS = ["ciftlik", "liman", "gida", "zanaat", "atolye", "dokuma", "mobilyahane", "kasaphane", "firin"];
function grantTitle(w, k, p, rank, fief) {
  if (k.id !== w.kayzerId) return "Sadece Kayzer unvan verir.";
  if (!RANKS_N.includes(rank)) return "B\xF6yle unvan yok.";
  if (p.id === k.id || p.prof === "naip") return "Olmaz.";
  const holders = w.people.filter((x) => x.rank === rank && x.id !== p.id);
  if (holders.length >= RANK_INFO[rank].max) return `En fazla ${RANK_INFO[rank].max} ${rank} olabilir. \xD6nce birinin unvan\u0131n\u0131 al\u0131n.`;
  const old = p.rank;
  p.rank = rank;
  p.fief = rank === "Bey" ? fief && FIEFS.includes(fief) ? fief : FIEFS.find((f) => !w.people.some((x) => x.fief === f)) ?? "ciftlik" : null;
  p.favor = clamp((p.favor ?? 50) + 20);
  p.loyalty = clamp(p.loyalty + 15);
  rel(p, k, 20, `bana ${rank} unvan\u0131 verdi`);
  for (const r of w.people.filter((x) => x.rank && x.id !== p.id)) rel(r, p, -8, `${rank} oldu, g\xF6zdele\u015Fti`);
  const t = `\u{1F451} ${k.name}, ${ek(p.name, "a")} ${old ? `${old} iken ` : ""}${rank} unvan\u0131 verdi${p.fief ? ` (t\u0131mar: ${w.buildings.find((b2) => b2.id === p.fief)?.name})` : ""}.`;
  log(w, t, p.id);
  chronicle(w, "unvan", t);
  return t;
}
function stripTitle(w, k, p) {
  if (k.id !== w.kayzerId) return "Sadece Kayzer.";
  if (!p.rank) return "Unvan\u0131 yok.";
  const r = p.rank;
  p.rank = null;
  p.fief = null;
  p.favor = clamp((p.favor ?? 50) - 35);
  p.loyalty = clamp(p.loyalty - 25);
  rel(p, k, -40, `${r} unvan\u0131m\u0131 ald\u0131`);
  if (p.ambition > 60 && chance(w, 0.5)) p.plotting = "coup";
  const t = `\u2694 ${ek(p.name, "\u0131n")} ${r} unvan\u0131 geri al\u0131nd\u0131.`;
  log(w, t, p.id);
  chronicle(w, "unvan", t);
  return t;
}
function nobilityDay(w) {
  const k = findPerson(w, w.kayzerId);
  for (const p of w.people.filter((x) => x.rank)) {
    const info = RANK_INFO[p.rank];
    transfer(w, "saray", p.id, info.stipend, `${p.rank} maa\u015F\u0131`);
    p.favor = clamp((p.favor ?? 50) + (k ? ((k.relations[p.id] ?? 0) - (p.favor ?? 50) + 50) * 0.02 : 0) - 0.3);
    if (p.rank === "Pa\u015Fa") for (const s of w.people.filter((x) => x.prof === "asker")) s.loyalty = clamp(s.loyalty + (p.loyalty >= 50 ? 0.4 : -0.6));
    if (p.rank === "Bey" && p.fief) {
      const workers = w.people.filter((x) => x.work === p.fief && x.id !== p.id);
      for (const x of workers) {
        const tax = x.incomeToday * 0.07;
        if (tax > 0.05 && transfer(w, x.id, "saray", tax * 5 / 7, "t\u0131mar vergisi")) transfer(w, x.id, p.id, tax * 2 / 7, "bey pay\u0131");
      }
    }
    if (p.rank === "Vezir" && w.treasury > 0 && p.loyalty >= 50) transfer(w, "dis", "saray", Math.min(50, w.treasury * 5e-3), "vezirin d\u0131\u015F ticaret geliri");
    for (const r of w.people.filter((x) => x.rank && x.id !== p.id && chance(w, 0.3))) rel(p, r, -1, "saray rekabeti");
  }
}
function intrigueDay(w) {
  const plots = w.plots ??= [];
  const nobles = w.people.filter((x) => x.rank && (x.npc || !x.playerId) && x.jailedDays === 0);
  for (const p of nobles) {
    const rivals = nobles.filter((r) => r.id !== p.id && (p.relations[r.id] ?? 0) < -20);
    if (!(p.ambition > 60 || p.loyalty < 40) || !chance(w, 0.06)) continue;
    const kind = p.loyalty < 30 && p.ambition > 70 && chance(w, 0.35) ? "darbe" : rivals.length && chance(w, 0.25) ? "zehir" : "iftira";
    const target = kind === "darbe" ? w.kayzerId : rivals.length ? pick(w, rivals).id : nobles.find((r) => r.id !== p.id)?.id;
    if (!target) continue;
    plots.push({ id: nextId(w, "X"), kind, by: p.id, target, day: w.day });
  }
  for (const pl of plots.filter((x) => !x.done && !x.exposed && w.day - x.day >= 2)) {
    pl.done = true;
    const by = findPerson(w, pl.by);
    const t = findPerson(w, pl.target);
    if (!by || !t) continue;
    if (pl.kind === "iftira") {
      rumor(w, `${t.name} hakk\u0131nda Saray\u2019da \xE7irkin bir s\xF6ylenti dola\u015F\u0131yor\u2026`, t.id, -15);
      t.favor = clamp((t.favor ?? 50) - 10);
      const k = findPerson(w, w.kayzerId);
      if (k) rel(k, t, -10, "iftiraya inand\u0131");
    } else if (pl.kind === "zehir") {
      t.health = clamp(t.health - 45);
      if (chance(w, 0.25) && t.id !== w.kayzerId && !t.playerId) {
        const txt = `\u2620 ${t.name} zehirlenerek \xF6ld\xFC! Saray\u2019da f\u0131s\u0131lt\u0131lar\u2026`;
        chronicle(w, "olum", txt);
        die(w, t, txt);
      } else log(w, `\u{1F922} ${t.name} a\u011F\u0131r hastaland\u0131 \u2013 zehir mi?`, t.id);
    } else if (pl.kind === "darbe") {
      by.plotting = "coup";
      w.coup = w.coup ?? { leaderId: by.id, kind: "coup", day: w.day, fund: 0 };
      log(w, `\u{1F5E1} Saray\u2019da gizli bir darbe haz\u0131rl\u0131\u011F\u0131 var\u2026`);
    }
  }
  w.plots = plots.filter((x) => w.day - x.day < 20);
}
var ORG_LABEL = { hirsiz: "\u{1F5DD} H\u0131rs\u0131zlar Loncas\u0131", cumhuriyet: "\u{1F5FD} Cumhuriyet Cemiyeti", tarikat: "\u{1F4FF} Tarikat" };
var ROLE_LABEL = { lider: "Lider", yardimci: "Yard\u0131mc\u0131", propagandaci: "Propagandac\u0131", casus: "G\xF6zc\xFC", uye: "\xDCye" };
function joinScore(w, p, o, by, pay = 0) {
  void w;
  const ideo = o.kind === "hirsiz" ? (60 - p.honesty) * 0.8 + (p.money < 40 ? 15 : 0) : o.kind === "cumhuriyet" ? (p.republic - 45) * 0.9 - (p.loyalty - 50) * 0.3 : (p.din - 55) * 0.9;
  const rel2 = (p.relations[by.id] ?? 0) * 0.4;
  const money = Math.min(30, pay / 4);
  const risk = o.suspicion * 0.3 + (o.known ? 15 : 0) + (STATE.includes(p.prof) ? 35 : 0) + (p.honesty > 75 && o.kind !== "tarikat" ? 10 : 0);
  return 40 + ideo + rel2 + money - risk;
}
var orgOf = (w, pid) => (w.orgs ?? []).find((o) => o.members.includes(pid));
var CRIME_OF = { hirsiz: "hirsizlik", cumhuriyet: "isyan", tarikat: "isyan" };
function reveal(w, o, ids, how) {
  const fresh = ids.filter((id) => !o.knownMembers.includes(id));
  o.knownMembers.push(...fresh);
  const was = o.known;
  o.known = true;
  o.suspicion = clamp(o.suspicion + 10);
  const kp = findPerson(w, w.kayzerId)?.playerId;
  const txt = `\u{1F575} ${how}: \u201C${o.name}\u201D (${ORG_LABEL[o.kind]})${fresh.length ? ` \u2013 \xFCyeler: ${fresh.map((id) => findPerson(w, id)?.name).filter(Boolean).join(", ")}` : ""}.`;
  if (kp) personal(w, kp, txt);
  log(w, was ? txt : `\u{1F575} Gizli bir \xF6rg\xFCt ortaya \xE7\u0131kt\u0131: ${o.name}!`);
  if (!was) chronicle(w, "orgut", `Gizli \xF6rg\xFCt \u201C${o.name}\u201D de\u015Fifre oldu.`);
}
function orgFound(w, p, kind, name) {
  if (!ORG_LABEL[kind]) return "B\xF6yle bir \xF6rg\xFCt t\xFCr\xFC yok.";
  if (orgOf(w, p.id)) return "Zaten bir \xF6rg\xFCttesiniz.";
  if (p.id === w.kayzerId) return "Kayzer gizli \xF6rg\xFCt kuramaz.";
  const o = { id: nextId(w, "O"), kind, name: name.trim().slice(0, 30) || ORG_LABEL[kind], leaderId: p.id, members: [p.id], suspicion: 5, known: false, knownMembers: [], founded: w.day, roles: { [p.id]: "lider" }, funds: 0 };
  (w.orgs ??= []).push(o);
  return `\u201C${o.name}\u201D kuruldu. Liderisiniz. Gece toplant\u0131lar\u0131 g\xFC\xE7 verir ama bek\xE7i bask\u0131n\u0131 riski ta\u015F\u0131r.`;
}
function orgJoin(w, p, id) {
  const o = (w.orgs ?? []).find((x) => x.id === id);
  if (!o) return "\xD6rg\xFCt yok.";
  if (orgOf(w, p.id)) return "Zaten bir \xF6rg\xFCttesiniz.";
  if (p.id === w.kayzerId) return "Olmaz.";
  o.members.push(p.id);
  (o.roles ??= {})[p.id] = "uye";
  o.suspicion = clamp(o.suspicion + 1.5);
  const l = findPerson(w, o.leaderId);
  if (l) rel(l, p, 10, "\xF6rg\xFCt\xFCm\xFCze kat\u0131ld\u0131");
  return `\u201C${o.name}\u201D \xF6rg\xFCt\xFCne kat\u0131ld\u0131n\u0131z.`;
}
function orgLeave(w, p) {
  const o = orgOf(w, p.id);
  if (!o) return "\xD6rg\xFCtte de\u011Filsiniz.";
  o.members = o.members.filter((x) => x !== p.id);
  if (o.leaderId === p.id) {
    o.leaderId = o.members.find((x) => o.roles?.[x] === "yardimci") ?? o.members[0] ?? "";
    if (o.roles && o.leaderId) o.roles[o.leaderId] = "lider";
  }
  if (!o.members.length) w.orgs = w.orgs.filter((x) => x !== o);
  return "\xD6rg\xFCtten ayr\u0131ld\u0131n\u0131z.";
}
function orgInvite(w, by, p, pay = 0) {
  const o = orgOf(w, by.id);
  if (!o) return { ok: false, code: "yok", text: "\xD6nce bir cemiyet kurun ya da birine kat\u0131l\u0131n." };
  if (orgOf(w, p.id)) return { ok: false, code: "zaten", text: `${p.name} zaten bir \xF6rg\xFCtte.` };
  if (p.id === w.kayzerId || p.prof === "naip") return { ok: false, code: "kayzer", text: "Saray\u2019dan birini davet etmek intihar olur." };
  if (p.playerId && !p.npc) return { ok: false, code: "oyuncu", text: "Oyunculara mesajla teklif edin; kendileri kat\u0131l\u0131r." };
  if (pay > 0 && by.money < pay) return { ok: false, code: "para", text: "O kadar paran\u0131z yok." };
  const s = joinScore(w, p, o, by, pay);
  if (s >= 50) {
    if (pay > 0) transfer(w, by.id, p.id, pay, "cemiyet daveti");
    orgJoin(w, p, o.id);
    rel(p, by, 6, "beni cemiyete ald\u0131");
    return { ok: true, code: "ok", text: `${p.name} \u201C${o.name}\u201D cemiyetine kat\u0131ld\u0131.` };
  }
  if ((p.honesty > 65 || p.loyalty > 75) && chance(w, 0.25)) {
    reveal(w, o, [by.id], `${p.name} davet edildi\u011Fi cemiyeti bek\xE7ilere bildirdi`);
    return { ok: false, code: "ihbar", text: `${p.name} reddetti ve sizi ihbar etti!` };
  }
  rel(p, by, -3, "beni gizli bir i\u015Fe \xE7a\u011F\u0131rd\u0131");
  return { ok: false, code: s < 25 ? "asla" : "istemem", text: `${p.name} teklifi reddetti.` };
}
function orgRole(w, by, pid, role) {
  const o = orgOf(w, by.id);
  if (!o || o.leaderId !== by.id) return "Rolleri lider da\u011F\u0131t\u0131r.";
  if (!o.members.includes(pid) || pid === by.id || role === "lider") return "Ge\xE7ersiz.";
  (o.roles ??= {})[pid] = role;
  return `${findPerson(w, pid)?.name} art\u0131k ${ROLE_LABEL[role]}.`;
}
function orgAct(w, by, deed) {
  const o = orgOf(w, by.id);
  if (!o) return "\xD6rg\xFCtte de\u011Filsiniz.";
  const role = o.roles?.[by.id] ?? (o.leaderId === by.id ? "lider" : "uye");
  if (deed !== "propaganda" && role !== "lider" && role !== "yardimci") return "Bunu lider ya da yard\u0131mc\u0131 emreder.";
  if (o.actedDay === w.day && deed !== "propaganda") return "Bug\xFCn zaten bir eylem yapt\u0131n\u0131z; dikkat \xE7ekmeyin.";
  const helpers = o.members.map((id) => findPerson(w, id)).filter((p) => p && p.jailedDays === 0);
  const prop = helpers.filter((p) => o.roles?.[p.id] === "propagandaci").length;
  if (deed === "propaganda") {
    if (!transfer(w, by.id, "saray", 5, "bildiri bas\u0131m\u0131")) return "Bildiri i\xE7in 5 Dinar gerekir.";
    const reach = 6 + prop * 4 + (role === "propagandaci" ? 4 : 0);
    const ppl = w.people.filter((p) => !STATE.includes(p.prof)).sort(() => Math.random() - 0.5).slice(0, reach);
    for (const p of ppl) {
      if (o.kind === "cumhuriyet") p.republic = clamp(p.republic + 3);
      else if (o.kind === "tarikat") p.din = clamp(p.din + 3);
      else p.honesty = clamp(p.honesty - 1);
    }
    if (o.kind === "cumhuriyet") w.cumhuriyet = clamp(w.cumhuriyet + 0.8);
    o.suspicion = clamp(o.suspicion + 4);
    return `Gece duvarlara bildiriler as\u0131ld\u0131 (${ppl.length} ki\u015Fi okudu). \u015E\xFCphe artt\u0131.`;
  }
  if (deed !== "ayaklanma") o.actedDay = w.day;
  if (deed === "hirsizlik") {
    if (o.kind !== "hirsiz") return "Soygun h\u0131rs\u0131zlar loncas\u0131n\u0131n i\u015Fidir.";
    const v = [...w.people].filter((p) => p.money > 120 && !o.members.includes(p.id)).sort((a, b2) => b2.money - a.money)[0];
    if (!v) return "Soyacak zengin yok.";
    const amt = Math.round(Math.min(v.money * 0.15, 25 + helpers.length * 8));
    transfer(w, v.id, by.id, amt, "lonca soygunu");
    o.funds = (o.funds ?? 0) + amt;
    o.suspicion = clamp(o.suspicion + 8);
    rumor(w, `${ek(v.name, "\u0131n")} evi soyuldu! G\xF6lgeler mi?`, v.id, 0);
    if (chance(w, 0.12 + o.suspicion / 300)) {
      const c = pick(w, helpers);
      if (c) arrest(w, c, "hirsizlik", v.id, amt);
      return `Soygun yap\u0131ld\u0131 (${amt} Dinar) ama ${c?.name ?? "biri"} yakaland\u0131!`;
    }
    return `${v.name} soyuldu: ${amt} Dinar lonca kasas\u0131na.`;
  }
  if (deed === "sabotaj") {
    if (o.kind === "hirsiz") return "Lonca siyasete kar\u0131\u015Fmaz.";
    for (const p of w.people) if (p.prof === "asker") p.loyalty = clamp(p.loyalty - 3);
    w.treasury = Math.max(0, w.treasury);
    const proj = (w.projects ?? []).find((x) => !x.done);
    if (proj) proj.progress = Math.max(0, proj.progress - 2);
    o.suspicion = clamp(o.suspicion + 12);
    w.disaster = { id: (w.disaster?.id ?? 0) + 1, kind: "yangin", text: "YANGIN! K\u0131\u015Fla\u2019n\u0131n ambar\u0131 ate\u015Fe verildi; askerlerin morali d\xFC\u015Ft\xFC.", day: w.day };
    log(w, "\u{1F4A5} Gece K\u0131\u015Fla\u2019n\u0131n ambar\u0131 ate\u015Fe verildi! Faili me\xE7hul.");
    if (chance(w, 0.2 + o.suspicion / 250)) reveal(w, o, [by.id], "Sabotajc\u0131lar g\xF6r\xFCld\xFC");
    return "Sabotaj ba\u015Far\u0131l\u0131: askerlerin morali d\xFC\u015Ft\xFC" + (proj ? ", \u015Fantiye gecikti." : ".");
  }
  if (o.kind === "hirsiz") return "Lonca ayaklanmaz.";
  const claimant = by.id === w.exKayzerId && w.regime === "imparatorluk";
  if (w.regime !== "imparatorluk" || !w.kayzerId) return "Ayaklanacak bir taht yok.";
  const sh = republicShare(w);
  if (sh < REBEL_SHARE) return `Halk hen\xFCz haz\u0131r de\u011Fil: halk\u0131n %${Math.round(sh * 100)}'i cumhuriyet\xE7ilikte 70+ (en az %50 gerekir).`;
  if (w.isyan) return "Zaten isyan var.";
  void claimant;
  if (claimant && by.jailedDays > 0) {
    by.jailedDays = 0;
    log(w, `\u26D3 Asiler zindan\u0131 bast\u0131 ve ${ek(by.name, "\u0131")} kurtard\u0131!`, by.id);
  }
  startIsyanHook.fn(w);
  const iz = w.isyan;
  if (iz) {
    o.actedDay = w.day;
    iz.leaderId = by.id;
    if (!iz.rebels.includes(by.id)) iz.rebels.push(by.id);
    for (const id of o.members) {
      const p = findPerson(w, id);
      if (p && p.republic >= REBEL_MIN && p.jailedDays === 0 && !iz.rebels.includes(id)) iz.rebels.push(id);
    }
    chronicle(w, "isyan", `\u201C${o.name}\u201D ayaklanmay\u0131 ba\u015Flatt\u0131.`);
    return "\u{1F525} AYAKLANMA BA\u015ELADI! Saray\u2019a y\xFCr\xFCy\xFCn.";
  }
  return "Ayaklanma ba\u015Flat\u0131lamad\u0131.";
}
function orgMeet(w, p) {
  const o = orgOf(w, p.id);
  if (!o) return "\xD6rg\xFCtte de\u011Filsiniz.";
  if (o.leaderId !== p.id) return "Toplant\u0131y\u0131 lider \xE7a\u011F\u0131r\u0131r.";
  o.meetTonight = true;
  return "Bu gece gizli toplant\u0131 var. Dikkat: bek\xE7iler bask\u0131n yapabilir.";
}
function assignSpy(w, k, spy, target) {
  if (k.id !== w.kayzerId) return "Sadece Kayzer casus atar.";
  if (spy.playerId && !spy.npc) return "Oyunculara casusluk emri DM ile verilir.";
  if (!transfer(w, "saray", spy.id, 15, "casus \xFCcreti")) return "Hazine yetmiyor.";
  (w.spies ??= []).push({ spyId: spy.id, targetId: target.id, until: w.day + 5 });
  return `${spy.name}, 5 g\xFCn boyunca ${ek(target.name, "\u0131")} gizlice izleyecek (15 Dinar).`;
}
function issueWarrant(w, by, target) {
  if (by.id !== w.kayzerId && by.prof !== "hakim") return "Arama emrini Kayzer ya da Kad\u0131 verir.";
  const ws = w.warrants ??= [];
  if (!ws.includes(target.id)) ws.push(target.id);
  return `${target.name} i\xE7in arama emri \xE7\u0131kar\u0131ld\u0131. Bek\xE7iler evini arayabilir.`;
}
function searchHouse(w, by, target) {
  if (!["bekci", "asker"].includes(by.prof) && by.id !== w.kayzerId) return "Evi bek\xE7i arar.";
  if (!(w.warrants ?? []).includes(target.id)) return "Arama emri (Kayzer ya da Kad\u0131) olmadan ev aranamaz!";
  w.warrants = w.warrants.filter((x) => x !== target.id);
  const o = orgOf(w, target.id);
  const pl = (w.plots ?? []).find((x) => x.by === target.id && !x.done);
  if (!o && !pl) {
    rel(target, by, -15, "evimi arad\u0131, bir \u015Fey bulamad\u0131");
    return `${ek(target.name, "\u0131n")} evi arand\u0131: hi\xE7bir \u015Fey bulunamad\u0131.`;
  }
  if (pl) {
    pl.exposed = true;
    arrest(w, target, pl.kind === "darbe" ? "isyan" : "saldiri", pl.target, 0);
  }
  if (o) {
    reveal(w, o, [target.id, ...chance(w, 0.6) ? o.members.filter((x) => x !== target.id).slice(0, 2) : []], `${ek(target.name, "\u0131n")} evinde mektuplar bulundu`);
    arrest(w, target, CRIME_OF[o.kind], null, 0);
  }
  return `${ek(target.name, "\u0131n")} evinde ${o ? "gizli \xF6rg\xFCt mektuplar\u0131" : ""}${o && pl ? " ve " : ""}${pl ? "bir komplo plan\u0131" : ""} bulundu! Tutukland\u0131.`;
}
function raidOrg(w, k, id) {
  if (k.id !== w.kayzerId) return "Sadece Kayzer bask\u0131n emreder.";
  const o = (w.orgs ?? []).find((x) => x.id === id);
  if (!o?.known) return "Bilinen bir \xF6rg\xFCt de\u011Fil.";
  const caught = o.knownMembers.map((x) => findPerson(w, x)).filter((p) => !!p && p.jailedDays === 0);
  for (const p of caught) arrest(w, p, CRIME_OF[o.kind], null, 0);
  o.suspicion = clamp(o.suspicion + 15);
  if (o.kind === "cumhuriyet") {
    for (const p of w.people) if (p.republic > 50) p.republic = clamp(p.republic + 2);
  }
  const t = `\u2694 Askerler Kayzer\u2019in emriyle \u201C${o.name}\u201D \xFCyelerine bask\u0131n yapt\u0131: ${caught.length} ki\u015Fi tutukland\u0131.`;
  log(w, t);
  chronicle(w, "orgut", t);
  return t;
}
function interrogate(w, p) {
  const o = orgOf(w, p.id);
  if (!o || !chance(w, p.honesty > 60 ? 0.6 : 0.4)) return;
  const others = o.members.filter((x) => x !== p.id && !o.knownMembers.includes(x));
  reveal(w, o, [p.id, ...others.slice(0, 2)], `Sorguda ${p.name} konu\u015Ftu`);
}
function orgsDay(w) {
  const orgs = w.orgs ??= [];
  const fits = (p, k) => k === "hirsiz" ? p.honesty < 30 : k === "cumhuriyet" ? p.republic > 65 : p.din > 78;
  for (const k of ["hirsiz", "cumhuriyet", "tarikat"]) if (!orgs.some((o) => o.kind === k)) {
    const f = w.people.find((p) => !p.playerId && fits(p, k) && !orgOf(w, p.id) && p.ambition > 55 && p.jailedDays === 0);
    if (f && chance(w, 0.15)) orgFound(w, f, k, { hirsiz: "G\xF6lgeler", cumhuriyet: "H\xFCrriyet Oca\u011F\u0131", tarikat: "Nur Halkas\u0131" }[k]);
  }
  for (const o of orgs) {
    const rec = findPerson(w, pick(w, o.members) ?? "");
    if (!rec || rec.playerId || !chance(w, 0.35 / (1 + o.members.length / 5))) continue;
    const cand = w.people.filter((p) => !p.playerId && !orgOf(w, p.id) && p.jailedDays === 0 && p.id !== w.kayzerId && !STATE.includes(p.prof) && (rec.relations[p.id] ?? 0) > 5);
    const t = [...cand].sort((a, b2) => joinScore(w, b2, o, rec) - joinScore(w, a, o, rec))[0];
    if (t && joinScore(w, t, o, rec) >= 55) {
      orgJoin(w, t, o.id);
      const lp = findPerson(w, o.leaderId)?.playerId;
      if (lp) personal(w, lp, `\u{1F56F} ${rec.name}, ${ek(t.name, "\u0131")} \u201C${o.name}\u201D cemiyetine kazand\u0131.`);
    }
  }
  for (const o of orgs) {
    o.members = o.members.filter((id) => findPerson(w, id));
    if (!findPerson(w, o.leaderId)) o.leaderId = o.members[0] ?? "";
    for (const id of o.members) {
      const p = findPerson(w, id);
      if (o.kind === "cumhuriyet") p.republic = clamp(p.republic + 0.25);
      if (o.kind === "tarikat") p.din = clamp(p.din + 0.5);
      if (o.kind === "hirsiz" && p.money < 30 && chance(w, 0.05)) {
        const v = pick(w, w.people.filter((x) => x.money > 80 && x.id !== p.id));
        if (v) transfer(w, v.id, p.id, Math.min(15, v.money * 0.1), "lonca h\u0131rs\u0131zl\u0131\u011F\u0131");
        o.suspicion += 2;
      }
    }
    if (!w.people.some((p) => p.playerId && o.members.includes(p.id)) && chance(w, 0.25)) o.meetTonight = true;
    const look = o.members.filter((id) => o.roles?.[id] === "casus").length;
    o.suspicion = clamp(o.suspicion + o.members.length * 0.35 + (o.meetTonight ? 4 : 0) - 1 - look * 0.8);
    if (o.suspicion >= 60 && !o.known) reveal(w, o, [], "S\xF6ylentiler yay\u0131ld\u0131");
    for (const id of o.members) {
      const p = findPerson(w, id);
      if (!p || p.playerId) continue;
      const why = p.honesty > 70 && chance(w, 0.04) ? "vicdan\u0131 rahat etmeyen bir muhbir" : o.known && chance(w, 0.04) ? "korkan bir \xFCye" : (w.informantPay ?? 0) > 0 && p.honesty < 45 && chance(w, 0.03) ? "parayla konu\u015Fan bir muhbir" : null;
      if (why) {
        if (why.startsWith("parayla")) transfer(w, "saray", p.id, w.informantPay ?? 10, "muhbir \xF6d\xFCl\xFC");
        reveal(w, o, [o.leaderId, ...o.members.filter((x) => x !== p.id).slice(0, 2)], `Muhbir (${why})`);
        break;
      }
    }
    if (o.meetTonight) {
      o.meetTonight = false;
      const bekcis = w.people.filter((x) => x.prof === "bekci" && x.jailedDays === 0).length;
      if (chance(w, Math.min(0.7, o.suspicion / 160 + bekcis * 0.03))) {
        const caught = o.members.map((x) => findPerson(w, x)).filter((p) => !!p && chance(w, 0.6)).slice(0, 5);
        reveal(w, o, caught.map((p) => p.id), "Bek\xE7iler gece toplant\u0131s\u0131n\u0131 bast\u0131");
        for (const p of caught) arrest(w, p, CRIME_OF[o.kind], null, 0);
      } else for (const id of o.members) {
        const p = findPerson(w, id);
        if (p) {
          p.mood = clamp(p.mood + 1);
          if (o.kind === "cumhuriyet") p.republic = clamp(p.republic + 1.5);
        }
      }
    }
  }
  w.orgs = orgs.filter((o) => o.members.length);
  for (const s of w.spies ??= []) {
    const spy = findPerson(w, s.spyId);
    const t = findPerson(w, s.targetId);
    if (!spy || !t || spy.jailedDays > 0) continue;
    const o = orgOf(w, t.id);
    const pl = (w.plots ?? []).find((x) => x.by === t.id && !x.done && !x.exposed);
    if (pl && chance(w, 0.55)) {
      pl.exposed = true;
      const kp = findPerson(w, w.kayzerId)?.playerId;
      const txt = `\u{1F575} Casus ${spy.name}: ${t.name} bir ${pl.kind === "zehir" ? "zehirleme" : pl.kind === "darbe" ? "DARBE" : "iftira"} plan\u0131 yap\u0131yor! (hedef: ${findPerson(w, pl.target)?.name ?? "?"})`;
      if (kp) personal(w, kp, txt);
      log(w, `\u{1F575} Saray\u2019da bir komplo a\xE7\u0131\u011Fa \xE7\u0131kt\u0131!`);
      chronicle(w, "entrika", txt);
    }
    if (o && chance(w, 0.45)) reveal(w, o, [t.id], `Casus ${spy.name} gece ${ek(t.name, "\u0131")} izledi`);
    if (chance(w, 0.08)) {
      rel(t, spy, -40, "beni gizlice izliyordu");
      s.until = w.day;
      log(w, `\u{1F440} ${t.name}, ${ek(spy.name, "\u0131n")} kendisini izledi\u011Fini fark etti!`, t.id);
    }
  }
  w.spies = w.spies.filter((s) => s.until > w.day);
}
var STATE = ["asker", "bekci", "memur", "tahsildar", "savci", "hakim", "naip", "kayzer"];
function reignName(w) {
  const k = findPerson(w, w.kayzerId);
  return w.regime === "cumhuriyet" ? `Cumhuriyet${k ? ` (Ba\u015Fkan ${k.name})` : ""}` : k ? `${k.name} saltanat\u0131` : "Naiplik d\xF6nemi";
}
function chronicle(w, kind, text) {
  const h = w.history ??= [];
  const t = text.replace(/^[^\p{L}\d“"]+/u, "").slice(0, 220);
  const last = h[h.length - 1];
  if (last && (last.text === t || last.day === w.day && last.text.slice(0, 14) === t.slice(0, 14))) {
    if (last.day === w.day) last.text = t;
    return;
  }
  h.push({ day: w.day, reign: reignName(w), kind, text: t });
  if (h.length > 600) h.splice(0, h.length - 600);
}
var MAJOR = [[/kanun|ferman|yasa(k|sı)|tasarı.*kabul/i, "kanun"], [/İSYAN|ayaklandı|isyan (bastırıldı|kazandı)|CUMHURİYET/i, "isyan"], [/evlendi/i, "evlilik"], [/öldü|öldürüldü|CİNAYET|vefat/i, "olum"], [/seçim|seçildi|Meclis’e girdi/i, "secim"], [/savaş|sınırda|sınır baskını|darbe|tahta (çıktı|geçti)|tahtı/i, "savas"], [/doğdu|bebek/i, "dogum"], [/KURAKLIK|SALGIN|SEL|BEREKET/, "doga"], [/unvan|Vezir|Paşa|Bey\b|Ağa\b/, "unvan"]];
function maybeChronicle(w, text) {
  if (/oylamaya açıldı|teklif verdi|→ RET|günlük bütçe|propaganda|protesto/.test(text)) return;
  for (const [r, k] of MAJOR) if (r.test(text)) {
    chronicle(w, k, text);
    return;
  }
}
function seedAnimals(w) {
  let sel = w.people.find((p) => p.prof === "hayvanci");
  if (!sel) {
    sel = w.people.find((p) => !p.playerId && p.prof === "hamal") ?? w.people.find((p) => !p.playerId && p.prof === "ciftci");
    if (sel) {
      sel.prof = "hayvanci";
      log(w, `${sel.name} art\u0131k hayvan t\xFCccar\u0131: Hayvan Pazar\u0131'nda inek, koyun, tavuk ve at sat\u0131yor.`, sel.id);
    }
  }
  if (sel) {
    sel.work = "hayvan";
    sel.farm = true;
    const hd = herd(sel);
    hd.inek = Math.max(hd.inek, 3);
    hd.koyun = Math.max(hd.koyun, 4);
    hd.tavuk = Math.max(hd.tavuk, 8);
    hd.at = Math.max(hd.at, 2);
  }
  const farmers = w.people.filter((p) => !p.playerId && p.prof === "ciftci");
  const herds = [{ inek: 2, koyun: 3, tavuk: 6, at: 0 }, { inek: 1, koyun: 4, tavuk: 0, at: 1 }, { inek: 3, koyun: 0, tavuk: 8, at: 0 }, { inek: 0, koyun: 3, tavuk: 5, at: 0 }];
  farmers.slice(0, 4).forEach((p, i) => {
    const hd = herd(p);
    if (ANIMALS.some((a) => hd[a] > 0)) return;
    Object.assign(hd, herds[i]);
    p.farm = true;
    p.barn = { ahir: Math.ceil((hd.inek + hd.koyun + hd.at) / 6), kumes: hd.tavuk ? 1 : 0 };
    p.inv.bugday = Math.max(p.inv.bugday, 20);
  });
}
function placeHayvan(w) {
  if (!w.buildings.some((b2) => b2.id === "hayvan")) {
    const free = (x2, y2) => x2 >= 1 && y2 >= 1 && x2 + 8 < 99 && y2 + 7 <= 48 && !w.buildings.some((o) => o.id !== "hayvan" && x2 < o.x + o.w + 1 && x2 + 9 > o.x && y2 < o.y + o.h + 2 && y2 + 7 > o.y) && ![13, 20, 29, 35, 44].some((ry) => ry >= y2 && ry < y2 + 6) && ![6, 17, 29, 44, 56, 68, 80, 92].some((rx) => rx >= x2 && rx < x2 + 8);
    let spot = null;
    for (let r = 0; r < 40 && !spot; r++) for (let dx = -r; dx <= r && !spot; dx++) for (const dy of [-r, r, ...Array.from({ length: 2 * r - 1 }, (_, i) => i - r + 1)]) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      if (free(70 + dx, 37 + dy)) {
        spot = [70 + dx, 37 + dy];
        break;
      }
    }
    const [x, y] = spot ?? [70, 37];
    w.buildings.push({ id: "hayvan", name: "Hayvan Pazar\u0131", kind: "hayvan", x, y, w: 8, h: 5, door: { x: x + 4, y: y + 5 }, market: false });
  }
}
var PEN = { x: 70, y: 36, w: 8, h: 4 };
function fixPen(w) {
  const hv = w.buildings.find((b2) => b2.id === "hayvan");
  if (!hv) return;
  if (hv.x === PEN.x && hv.y === PEN.y && hv.h === PEN.h) hv.door = { x: PEN.x + 4, y: PEN.y };
  const clash = (x, y, ww, hh) => w.buildings.some((o) => o !== hv && x < o.x + o.w && x + ww > o.x && y < o.y + o.h && y + hh > o.y);
  if (!clash(hv.x, hv.y, hv.w, hv.h) && hv.y + hv.h + 1 <= 48) return;
  if (!clash(PEN.x, PEN.y, PEN.w, PEN.h)) {
    Object.assign(hv, PEN);
    hv.door = { x: PEN.x + 4, y: PEN.y };
    return;
  }
  for (let y = 1; y < 44; y++) for (let x = 1; x < 92; x++) if (!clash(x, y, 8, 4) && ![13, 20, 29, 35, 44].some((r) => r >= y && r < y + 4) && ![6, 17, 29, 44, 56, 68, 80, 92].some((r) => r >= x && r < x + 8)) {
    Object.assign(hv, { x, y, w: 8, h: 4 });
    hv.door = { x: x + 4, y };
    return;
  }
}
function migrate10(w) {
  w = migrate9(w);
  if ((w.schema ?? 1) >= 10) return w;
  fixPen(w);
  w.election.seats = w.meclis.seats.length;
  for (const p of w.people) if (p.prof === "hayvanci" && /^(Hamal|Çiftçi) /.test(p.name)) p.name = p.name.replace(/^\S+ /, "Hayvanc\u0131 ");
  for (const p of w.people) p.name = p.name.replace(/^(Kayzer )(Kayzer )+/, "Kayzer ");
  w.schema = 10;
  return w;
}
function migrate9(w) {
  w = migrate8(w);
  if ((w.schema ?? 1) >= 9) return w;
  const hv = w.buildings.find((b2) => b2.id === "hayvan");
  if (hv && hv.y + hv.h + 2 > 48) {
    w.buildings = w.buildings.filter((b2) => b2 !== hv);
    placeHayvan(w);
  }
  w.schema = 9;
  return w;
}
function migrate8(w) {
  w = migrate7(w);
  if ((w.schema ?? 1) >= 8) return w;
  seedAnimals(w);
  w.schema = 8;
  return w;
}
function migrate7(w) {
  w = migrate6(w);
  if ((w.schema ?? 1) >= 7) return w;
  migrateMeclis16(w);
  rehouse(w);
  for (const p of w.people) if (p.playerId && p.energy === void 0) p.energy = 80;
  w.schema = 7;
  return w;
}
function migrate6(w) {
  w = migrate5(w);
  if ((w.schema ?? 1) >= 6) return w;
  placeHayvan(w);
  for (const p of w.people) {
    if (p.prof === "hayvanci") p.work = "hayvan";
    if (p.farm && !p.barn) {
      const hd = herd(p);
      p.barn = { ahir: Math.ceil((hd.inek + hd.koyun + hd.at) / BARN.ahir.cap), kumes: Math.ceil(hd.tavuk / BARN.kumes.cap) };
    }
  }
  w.schema = 6;
  return w;
}
function migrate5(w) {
  if ((w.schema ?? 1) >= 5) return w;
  for (const g of GOODS) {
    if (w.prices[g] === void 0) w.prices[g] = { sut: 1, yumurta: 0.6 }[g] ?? 1;
    if (w.market.sold[g] === void 0) w.market.sold[g] = 0;
    if (w.market.unmet[g] === void 0) w.market.unmet[g] = 0;
  }
  for (const p of w.people) {
    for (const g of GOODS) if (p.inv[g] === void 0) p.inv[g] = 0;
    p.hunger = Math.min(p.hunger ?? 0, 40);
    p.thirst = Math.min(p.thirst ?? 0, 40);
  }
  w.orgs ??= [];
  w.spies ??= [];
  w.plots ??= [];
  w.warrants ??= [];
  w.history ??= [];
  if (!w.people.some((p) => p.prof === "hayvanci")) {
    const h = w.people.find((p) => !p.playerId && p.prof === "hamal");
    if (h) {
      h.prof = "hayvanci";
      h.work = "ciftlik";
      h.farm = true;
      h.animals = { inek: 3, koyun: 4, tavuk: 10, at: 1 };
      log(w, `\u{1F404} ${h.name} art\u0131k hayvan t\xFCccar\u0131: inek, koyun, tavuk ve at sat\u0131yor (Bu\u011Fday Tarlalar\u0131).`);
    }
  }
  chronicle(w, "baslangic", `G\xFCn ${w.day}: Tarih Kitab\u0131 yaz\u0131lmaya ba\u015Fland\u0131 (${reignName(w)}).`);
  w.schema = 5;
  return w;
}

// src/sim/orders.ts
var ORDER_TYPES = ["go", "follow", "attack", "kill", "arrest", "steal", "give", "sell", "buy", "work", "vote", "gossip", "bribe", "guard", "leave", "join"];
var STATE_FORCES = ["asker", "bekci", "memur", "tahsildar", "savci", "hakim", "naip"];
var HARM = { kill: 90, attack: 55, steal: 45, bribe: 30, gossip: 15, arrest: 15 };
var TASK_MS = { follow: 18e4, guard: 3e5 };
var low = (s) => s.toLocaleLowerCase("tr");
var say2 = (w, from, to, text, at) => {
  w.chatOut.push({ fromPersonId: from.id, fromName: from.name, toPersonId: to, text: text.slice(0, 280), at });
  if (w.chatOut.length > 60) w.chatOut.splice(0, w.chatOut.length - 60);
};
var isRuler = (w, p) => !!w.kayzerId && p.id === w.kayzerId;
var rebel = (w, p) => !!w.isyan?.rebels.includes(p.id);
var hitab = (w, from) => isRuler(w, from) ? w.regime === "cumhuriyet" ? "Ba\u015Fkan\u0131m" : "\u0130mparatorum" : from.soylu ? "efendim" : from.name.split(" ").slice(-1)[0];
function orderLabel(w, o) {
  const t = findPerson(w, o.targetId)?.name ?? "";
  const pl = w.buildings.find((b2) => b2.id === o.place)?.name ?? "";
  const it = o.item ? GOOD_LABEL[o.item] : "";
  const n2 = o.amount ?? 1;
  switch (o.type) {
    case "go":
      return `${pl || t || "bir yere"} gidiyor`;
    case "follow":
      return `${t} ki\u015Fisini takip ediyor`;
    case "attack":
      return `${t} ki\u015Fisine sald\u0131rmaya gidiyor`;
    case "kill":
      return `${t} ki\u015Fisini \xF6ld\xFCrmeye gidiyor`;
    case "arrest":
      return `${t} ki\u015Fisini tutuklamaya gidiyor`;
    case "steal":
      return `${t} ki\u015Fisinden \xE7almaya gidiyor`;
    case "give":
      return `${t}'a ${n2} ${it} g\xF6t\xFCr\xFCyor`;
    case "sell":
      return `${t}'a ${n2} ${it} sat\u0131yor`;
    case "buy":
      return `Pazardan ${n2} ${it} almaya gidiyor`;
    case "work":
      return `${pl || "i\u015Fyerinde"} \xE7al\u0131\u015Fmaya gidiyor`;
    case "vote":
      return `${t}'a oy vermeye gidiyor`;
    case "gossip":
      return `${t} hakk\u0131nda dedikodu yaymaya gidiyor`;
    case "bribe":
      return `${t}'a r\xFC\u015Fvet g\xF6t\xFCr\xFCyor`;
    case "guard":
      return `${t} ki\u015Fisini koruyor`;
    case "leave":
      return "evine gidiyor";
    case "join":
      return "cemiyete kat\u0131ld\u0131";
  }
}
var PROF_WORDS = [[/asker/, "asker"], [/bekçi/, "bekci"], [/fırıncı/, "firinci"], [/sucu/, "sucu"], [/kasap/, "kasap"], [/balıkçı/, "balikci"], [/terzi/, "terzi"], [/demirci/, "demirci"], [/marangoz/, "marangoz"], [/tüccar/, "tuccar"], [/hekim|doktor/, "hekim"], [/hoca/, "hoca"], [/hamal/, "hamal"], [/inşaatçı/, "insaatci"], [/imam/, "imam"], [/memur/, "memur"], [/tahsildar/, "tahsildar"], [/savcı/, "savci"], [/kadı|hakim|hâkim/, "hakim"], [/çiftçi/, "ciftci"], [/dokumacı/, "dokumaci"], [/mobilyacı/, "mobilyaci"], [/barcı|meyhaneci/, "barci"]];
var GOOD_WORDS = [[/ekmek/, "ekmek"], [/\bsu(yu|dan)?\b/, "su"], [/\bet(i)?\b/, "et"], [/balık/, "balik"], [/kumaş/, "kumas"], [/alet/, "alet"], [/odun/, "odun"], [/buğday/, "bugday"], [/yün/, "yun"], [/elbise/, "elbise"], [/mobilya/, "mobilya"], [/içki|şarap|rakı/, "icki"]];
var PLACE_WORDS = [[/pazar/, "pazar"], [/saray/, "saray"], [/cami/, "cami"], [/meyhane|bar\b/, "bar"], [/kışla/, "kisla"], [/liman/, "liman"], [/zindan/, "zindan"], [/mahkeme/, "mahkeme"], [/kuyu/, "kuyu"], [/meydan/, "pazar"], [/kahve/, "kahve"], [/meclis/, "meclis"], [/çiftlik|tarla/, "ciftlik"], [/şantiye|inşaat/, "santiye"]];
function parseOffer(text) {
  const m = low(text).match(/(\d+)\s*(dinar|altın|akçe|para|lira)/);
  return m ? Math.min(5e3, Number(m[1])) : 0;
}
function parseIntent(w, npc, from, text) {
  const t = low(text);
  const has = (r) => r.test(t);
  let type = null;
  if (has(/cemiyet|örgüt|loncamıza|loncaya|tarikat|aramıza katıl|bize katıl|davet ediyorum|üye ol/) && !has(/öldür|döv/)) type = "join";
  else if (has(/öldür|gebert|katlet|canını al|işini bitir|temizle\b/)) type = "kill";
  else if (has(/tutukla|yakala|zindana at|içeri at|tevkif|hapse at/)) type = "arrest";
  else if (has(/döv|saldır|yarala|dayak at|pataka|\bvur\b|tokat/)) type = "attack";
  else if (has(/\bçal\b|çalsana|çalıp|\bsoy\b|soysana|aşır|yürüt/)) type = "steal";
  else if (has(/rüşvet/)) type = "bribe";
  else if (has(/oy ver|oyunu ver|oy at|oyla|seç onu/)) type = "vote";
  else if (has(/dedikodu|söylenti|yay(ıl)?\b|herkese söyle|kötüle|iftira/)) type = "gossip";
  else if (has(/takip|peşimden|arkamdan gel|benimle gel|izle\b|peşine düş/)) type = "follow";
  else if (has(/koru|nöbet tut|bekçilik et|muhafız/)) type = "guard";
  else if (has(/satın al|\bal\b|alsana|alıp getir|al gel/) && GOOD_WORDS.some(([r]) => r.test(t))) type = "buy";
  else if (has(/\bsat\b|satsana|satar mısın|satabilir/)) type = "sell";
  else if (has(/\bver\b|versene|verir misin|getir|ver bana/) && GOOD_WORDS.some(([r]) => r.test(t))) type = "give";
  else if (has(/çalış|işe git|işine dön|işbaşı/)) type = "work";
  else if (has(/defol|uzaklaş|çekil|evine git|evine dön|bırak beni|git başımdan|kaybol/)) type = "leave";
  else if (has(/\bgit\b|gitsene|\bgel\b|gelsene|yanıma gel|buraya gel|yürü/)) type = "go";
  if (!type) return null;
  let target = w.people.find((p) => p.id !== npc.id && p.name.split(" ").some((x) => x.length > 2 && !PROF_LABEL[p.prof]?.startsWith(x) && t.includes(low(x))));
  if (!target) {
    for (const [r, prof] of PROF_WORDS) if (r.test(t)) {
      const c = w.people.filter((p) => p.prof === prof && p.id !== npc.id && p.id !== from.id && p.jailedDays === 0);
      if (c.length) {
        const me = placeOf(w, npc.id, w.serverNow ?? w.lastTickAt);
        target = me ? c.sort((a, b2) => dist(w, a, me) - dist(w, b2, me))[0] : c[0];
        break;
      }
    }
  }
  if (!target && has(/\bbeni\b|\bbana\b|yanıma|peşimden|arkamdan|benimle/)) target = from;
  const place = PLACE_WORDS.find(([r]) => r.test(t))?.[1] ?? null;
  const item = GOOD_WORDS.find(([r]) => r.test(t))?.[1] ?? null;
  const num = t.match(/(\d+)\s*(tane|adet|kilo|ekmek|su|et|balık|kumaş|alet|odun|buğday|yün|elbise|mobilya|içki)/);
  const amount = num ? Math.min(20, Number(num[1])) : 1;
  const o = { type, targetId: target?.id ?? null, place, item, amount, text: type === "gossip" ? text.slice(0, 160) : void 0 };
  if (["give", "sell"].includes(type) && !o.targetId) o.targetId = from.id;
  if (type === "go" && !place && !o.targetId) o.targetId = from.id;
  return o;
}
function dist(w, a, at) {
  const q = placeOf(w, a.id, w.serverNow ?? w.lastTickAt);
  return q ? Math.hypot(q.x - at.x, q.y - at.y) : 99;
}
function sanitizeOrder(w, npc, from, raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const type = String(r.type ?? "");
  if (!ORDER_TYPES.includes(type)) return null;
  const tname = r.target == null ? "" : low(String(r.target));
  let target = tname ? w.people.find((p) => p.id === r.target || low(p.name) === tname) ?? w.people.find((p) => p.id !== npc.id && tname.length > 2 && low(p.name).includes(tname)) : void 0;
  if (!target && /^(ben|beni|bana|me|sender|oyuncu)$/.test(tname)) target = from;
  if (!target && tname) {
    const pw = PROF_WORDS.find(([re]) => re.test(tname));
    if (pw) target = w.people.find((p) => p.prof === pw[1] && p.id !== npc.id && p.id !== from.id && p.jailedDays === 0);
  }
  const item = GOODS.includes(String(r.item)) ? String(r.item) : GOOD_WORDS.find(([re]) => re.test(low(String(r.item ?? ""))))?.[1] ?? null;
  const pr = low(String(r.place ?? ""));
  const place = w.buildings.find((b2) => b2.id === pr || low(b2.name) === pr)?.id ?? PLACE_WORDS.find(([re]) => re.test(pr))?.[1] ?? null;
  return { type, targetId: target?.id ?? (["give", "sell"].includes(type) || type === "go" && !place ? from.id : null), place, item, amount: clamp(Math.round(Number(r.amount) || 1), 1, 20), text: type === "gossip" ? String(r.text ?? "").slice(0, 160) || void 0 : void 0 };
}
function decideOrder(w, npc, from, o, offer = 0) {
  const t = findPerson(w, o.targetId);
  const no2 = (code, why) => ({ ok: false, code, why });
  const yes = (why = "") => ({ ok: true, code: "ok", why });
  if (npc.playerId && !npc.npc) return no2("oyuncu", "oyuncu");
  if (npc.jailedDays > 0) return no2("zindan", "zindanday\u0131m");
  if (npc.prof === "naip" && HARM[o.type]) return no2("naip", "naip");
  const needsTarget = ["follow", "attack", "kill", "arrest", "steal", "give", "sell", "vote", "gossip", "bribe", "guard"].includes(o.type);
  if (needsTarget && !t) return no2("kim", "kimi kastetti\u011Finizi anlamad\u0131m");
  if (t && t.id === npc.id && o.type !== "go") return no2("kendim", "kendime bunu yapamam");
  if ((o.type === "kill" || o.type === "attack" || o.type === "steal" || o.type === "arrest") && t) {
    if (t.id === w.kayzerId) return no2("kayzer", "Kayzer\u2019e el kald\u0131rmak");
    if (isProtected(w, t)) return no2("koruma", "koruma");
    if (t.id === npc.spouse || t.parents?.includes(npc.id) || npc.parents?.includes(t.id)) return no2("aile", "aile");
  }
  if (o.type === "arrest" && !["bekci", "asker"].includes(npc.prof)) return no2("yetki", "yetki");
  if ((o.type === "give" || o.type === "sell") && (!o.item || npc.inv[o.item] < (o.amount ?? 1))) return no2("yok", "yok");
  if (o.type === "buy" && !o.item) return no2("kim", "ne alaca\u011F\u0131m\u0131 anlamad\u0131m");
  const cost = o.item ? marketPrice(w, o.item) * (o.amount ?? 1) : 0;
  if (o.type === "sell" && from.money < cost) return no2("para", "para");
  if (o.type === "buy" && from.money < cost && npc.money < cost) return no2("para", "para");
  if (o.type === "vote" && t && !w.election.candidates.includes(t.id) && !w.election.baskanCandidates.includes(t.id)) return no2("aday", "aday");
  if (o.type === "bribe" && offer <= 0) return no2("para", "r\xFC\u015Fvet i\xE7in para");
  if (isRuler(w, from) && STATE_FORCES.includes(npc.prof) && npc.prof !== "naip") return rebel(w, npc) ? no2("isyan", "isyan") : yes("emir");
  const harm = HARM[o.type] ?? 0;
  const relFrom = npc.relations[from.id] ?? 0;
  const relT = t ? npc.relations[t.id] ?? 0 : 0;
  const authority = isRuler(w, from) ? 30 * (npc.loyalty / 100) + 10 : from.soylu ? 10 : 0;
  const fear = (isRuler(w, from) ? 15 : 0) + (from.prof === "asker" || from.prof === "bekci" ? 10 : 0) + (from.rep < -30 ? 10 : 0);
  const moral = harm * (npc.honesty * 0.6 + npc.din * 0.4) / 100 + (harm >= 50 ? harm * 0.35 : 0);
  const greed = (100 - npc.honesty) / 100;
  const pay = offer > 0 ? Math.min(45, offer / Math.max(5, cost || harm / 2 || 5) * 12 * (0.6 + greed)) : 0;
  const hate = harm && t ? clamp(-relT * 0.35, -15, 35) : 0;
  const base = harm ? 20 : o.type === "buy" || o.type === "sell" ? 75 : 70;
  const score = base + authority + fear + relFrom * 0.25 + pay + hate - moral;
  if (score >= 50) return yes();
  return no2(harm ? "ahlak" : relFrom < -30 ? "kin" : "istemem", "ret");
}
function orderReply(w, npc, from, o, d) {
  const a = hitab(w, from);
  const t = findPerson(w, o.targetId);
  const tn = t ? t.id === from.id ? "size" : t.name : "";
  const it = o.item ? GOOD_LABEL[o.item] : "";
  if (d.ok) {
    const st = STATE_FORCES.includes(npc.prof) && isRuler(w, from);
    const lead = st ? `Emredersiniz ${a}!` : ["Peki " + a + ",", "Olur " + a + ",", "Tamam " + a + ",", "Ba\u015F \xFCst\xFCne " + a + ","][npc.id.length % 4];
    const what = {
      join: "cemiyetinize kat\u0131l\u0131yorum.",
      go: `hemen ${((bn) => bn ? ek(bn, "a") : null)(w.buildings.find((b2) => b2.id === o.place)?.name) ?? (t?.id === from.id ? "yan\u0131n\u0131za" : `${tn} yan\u0131na`)} geliyorum.`,
      follow: `${t?.id === from.id ? "pe\u015Finizden" : tn + " pe\u015Finden"} ayr\u0131lmam.`,
      attack: `${tn}'a gereken dersi verece\u011Fim.`,
      kill: `${tn}\u2026 i\u015F bu g\xFCn bitecek. Kimse bilmeyecek.`,
      arrest: `${tn} \u015Fimdi zindan\u0131 boylar.`,
      steal: `${tn}'\u0131n kesesi hafifleyecek, kimseye \xE7akt\u0131rmam.`,
      give: `${o.amount} ${it} getiriyorum.`,
      sell: `${o.amount} ${it}, ${Math.round(marketPrice(w, o.item) * (o.amount ?? 1))} Dinar. Geliyorum.`,
      buy: `pazardan ${o.amount} ${it} al\u0131p getiririm.`,
      work: `i\u015Fba\u015F\u0131 yap\u0131yorum.`,
      vote: `oyum ${tn}'a.`,
      gossip: `${tn} hakk\u0131nda s\xF6ylenece\u011Fi herkes duyacak.`,
      bribe: `paray\u0131 ${tn}'a sessizce ula\u015Ft\u0131r\u0131r\u0131m.`,
      guard: `${t?.id === from.id ? "sizi" : tn + "'\u0131"} can\u0131m pahas\u0131na korurum.`,
      leave: `gidiyorum, rahats\u0131z etmem.`
    };
    return `${lead} ${what[o.type]}`;
  }
  switch (d.code) {
    case "kim":
      return `Kusura bakmay\u0131n ${a}, ${d.why}. Kimi ya da neyi kastediyorsunuz?`;
    case "kayzer":
      return `T\xF6vbe ${a}! \u0130mparator\u2019a el kald\u0131rmak m\u0131? Bunu duymam\u0131\u015F olay\u0131m.`;
    case "koruma":
      return `${tn} \u015Fehre yeni geldi, ${a}; ona dokunmak olmaz.`;
    case "aile":
      return `O benim kan\u0131m, ${a}. Asla!`;
    case "yetki":
      return `Benim tutuklama yetkim yok ${a}; bek\xE7iye ya da askere s\xF6yleyin.`;
    case "yok":
      return `Elimde o kadar ${it || "mal"} yok ${a}.`;
    case "para":
      return o.type === "bribe" ? `R\xFC\u015Fvet havadan olmaz ${a}; ne kadar vereceksiniz?` : `Paran\u0131z yetmiyor ${a}; bu ${Math.round(o.item ? marketPrice(w, o.item) * (o.amount ?? 1) : 0)} Dinar eder.`;
    case "aday":
      return `${tn} aday de\u011Fil ki ${a}; ona oy verilmez.`;
    case "zindan":
      return `Zindanday\u0131m ${a}, elim kolum ba\u011Fl\u0131.`;
    case "isyan":
      return `Art\u0131k senin askerin de\u011Filim! Halk\u0131n yan\u0131nday\u0131m.`;
    case "naip":
      return `Naip olarak b\xF6yle i\u015Flere bula\u015Famam ${a}.`;
    case "kendim":
      return `Kendime mi ${a}? Olmaz.`;
    case "ahlak":
      return npc.din > 60 ? `Bu g\xFCnah\u0131 i\u015Fleyemem ${a}; Allah\u2019tan korkar\u0131m.` : `Ben katil/h\u0131rs\u0131z de\u011Filim ${a}. Ba\u015Fkas\u0131n\u0131 bulun.`;
    case "kin":
      return `Sana iyilik yapacak son ki\u015Fi benim.`;
    default:
      return `\u015Eu an olmaz ${a}, i\u015Fim ba\u015F\u0131mdan a\u015Fk\u0131n.`;
  }
}
function cruel(w, o) {
  if (!["kill", "attack", "steal"].includes(o.type) && !(o.type === "arrest")) return false;
  const t = findPerson(w, o.targetId);
  if (!t) return false;
  const guilty = w.cases.some((c) => c.accusedId === t.id && c.stage !== "kapandi") || t.rep < -20 || !!w.isyan?.rebels.includes(t.id);
  return !guilty && (o.type !== "arrest" || t.rep > 10);
}
function stateCrimeSeen(w, npc, tk, victimName, witnesses) {
  const by = findPerson(w, tk.byId);
  if (!by || by.id !== w.kayzerId || !cruel(w, tk) && !w.people.every((p) => p.id !== tk.targetId)) return;
  if (witnesses <= 0) return;
  rumor(w, `${witnesses} ki\u015Fi g\xF6rd\xFC: ${npc.name}, ${victimName}'a Saray'\u0131n emriyle sald\u0131rd\u0131!`, by.id, -10);
  for (const p of w.people) if (p.prof !== "naip" && p.id !== by.id) {
    p.loyalty = clamp(p.loyalty - 3);
    p.republic = clamp(p.republic + 2.5);
  }
  log(w, `\u{1F440} Tan\u0131klar konu\u015Fuyor: ${victimName} olay\u0131n\u0131n arkas\u0131nda Saray varm\u0131\u015F.`, by.id);
}
function targetPt(w, o, now, npc) {
  if (o.type === "leave") {
    const b2 = w.buildings.find((x) => x.id === npc.home);
    return b2 ? doorSpot(b2) : null;
  }
  if (o.type === "buy") {
    const b2 = w.buildings.find((x) => x.id === (o.place ?? "pazar")) ?? w.buildings.find((x) => x.id === "pazar");
    return b2 ? doorSpot(b2) : null;
  }
  if (o.type === "work") {
    const b2 = w.buildings.find((x) => x.id === (o.place ?? npc.work));
    return b2 ? doorSpot(b2) : null;
  }
  if (o.type === "vote" || o.type === "gossip") {
    const b2 = w.buildings.find((x) => x.id === "pazar");
    return b2 ? doorSpot(b2) : null;
  }
  if (o.targetId) {
    const q = placeOf(w, o.targetId, now);
    if (q) return { x: q.x + 0.8, y: q.y };
  }
  if (o.place) {
    const b2 = w.buildings.find((x) => x.id === o.place);
    if (b2) return doorSpot(b2);
  }
  return null;
}
function walkFrom(w, npc, to, now) {
  const cur = npc.walk && npc.task ? walkPos(npc.walk, now).pt : (() => {
    const q = placeOf(w, npc.id, now);
    return q ? { x: q.x, y: q.y } : to;
  })();
  npc.walk = { path: findPath(w, cur, to), t0: now, speed: WALK_SPEED * 0.8 };
}
function assignTask(w, npc, from, o, now, offer = 0) {
  if (offer > 0 && transfer(w, from.id, npc.id, offer, o.type === "bribe" ? "r\xFC\u015Fvet emaneti" : "i\u015F \xFCcreti")) rel(npc, from, 3, "bana para verdi");
  const to = targetPt(w, o, now, npc);
  npc.task = { ...o, byId: from.id, at: now, status: "yolda", label: orderLabel(w, o), until: now + (TASK_MS[o.type] ?? 24e4), tries: 0, pay: offer };
  if (to) walkFrom(w, npc, to, now);
}
function handleOrder(w, from, npc, o, text, now) {
  const offer = parseOffer(text);
  if (isRuler(w, from) && STATE_FORCES.includes(npc.prof) && npc.prof !== "naip" && cruel(w, o) && npc.loyalty < 20 && !rebel(w, npc)) {
    const joins = !!w.isyan || w.cumhuriyet > 45;
    npc.prof = "hamal";
    npc.work = "liman";
    npc.loyalty = clamp(npc.loyalty - 20);
    npc.republic = clamp(npc.republic + 25);
    if (joins) {
      npc.plotting = "revolution";
      if (w.isyan && !w.isyan.rebels.includes(npc.id)) w.isyan.rebels.push(npc.id);
    }
    log(w, `\u{1F3C3} ${npc.name} zalim emre dayanamad\u0131 ve ${joins ? "k\u0131\u015Fladan ka\xE7\u0131p cumhuriyet\xE7ilere kat\u0131ld\u0131" : "ordudan firar etti"}!`, npc.id, now);
    rumor(w, `${npc.name}: \u201CKayzer bize masumlar\u0131 \xF6ld\xFCrt\xFCyor!\u201D deyip ka\xE7t\u0131.`, from.id, -12);
    return { reply: joins ? "Art\u0131k yeter! Masum kan\u0131 d\xF6kmeyece\u011Fim. Halk\u0131n yan\u0131nday\u0131m!" : "Bu kadar\u0131 fazla\u2026 K\u0131l\u0131c\u0131m\u0131 b\u0131rak\u0131yorum. Beni bir daha k\u0131\u015Flada g\xF6remezsiniz.", d: { ok: false, code: "firar", why: "firar" }, o };
  }
  if (o.type === "join") {
    const r = orgInvite(w, from, npc, offer);
    const a = hitab(w, from);
    const reply = r.ok ? offer > 0 ? `${offer} Dinar m\u0131? Pek\xE2l\xE2 ${a}, s\u0131rr\u0131n\u0131z s\u0131rr\u0131md\u0131r. Ben de var\u0131m.` : `Uzun zamand\u0131r b\xF6yle bir \u015Fey bekliyordum, ${a}. Say\u0131n beni!` : r.code === "ihbar" ? "Ne?! B\xF6yle i\u015Flere bula\u015Fmam. Bunu bek\xE7iler duyacak!" : r.code === "zaten" ? "Benim zaten ba\u011Fl\u0131 oldu\u011Fum biri var\u2026 daha fazlas\u0131n\u0131 sormay\u0131n." : r.code === "yok" ? "Hangi cemiyet? Ortada bir \u015Fey yok ki." : r.code === "asla" ? "Asla. Ba\u015F\u0131m\u0131 belaya sokmam, bir daha da a\xE7may\u0131n bu konuyu." : r.code === "para" ? "\xD6nce kesenizi doldurun." : `\u015Eimdilik olmaz ${a}. Risk b\xFCy\xFCk\u2026 belki ileride, belki bir bedeli olursa.`;
    return { reply, d: { ok: r.ok, code: r.code, why: r.text }, o };
  }
  const d = decideOrder(w, npc, from, o, offer);
  if (d.ok) assignTask(w, npc, from, o, now, o.type === "sell" || o.type === "buy" ? 0 : offer);
  if (d.ok && isRuler(w, from) && cruel(w, o)) {
    npc.loyalty = clamp(npc.loyalty - 14);
    npc.mood = clamp(npc.mood - 8);
    w.cruelOrders = (w.cruelOrders ?? 0) + 1;
    for (const s of w.people) if (s.prof === "asker" && s.id !== npc.id) s.loyalty = clamp(s.loyalty - 3);
  } else if (HARM[o.type] && HARM[o.type] >= 50) rel(npc, from, -6, "bana k\xF6t\xFC bir i\u015F teklif etti");
  return { reply: orderReply(w, npc, from, o, d), d, o };
}
function finish(w, npc, ok3, note, now) {
  const tk = npc.task;
  tk.status = ok3 ? "bitti" : "basarisiz";
  tk.note = note;
  tk.doneAt = now;
  const by = findPerson(w, tk.byId);
  if (by && by.id !== npc.id) say2(w, npc, by.id, `${ok3 ? "\u2705" : "\u274C"} ${note}`, now + 500);
}
function execute(w, npc, now) {
  const tk = npc.task;
  const t = findPerson(w, tk.targetId);
  const by = findPerson(w, tk.byId);
  const n2 = tk.amount ?? 1;
  const it = tk.item ? GOOD_LABEL[tk.item] : "";
  w.serverNow = now;
  switch (tk.type) {
    case "go":
      return finish(w, npc, true, "Geldim.", now);
    case "leave":
      return finish(w, npc, true, "Evime geldim.", now);
    case "kill": {
      if (!t) return finish(w, npc, false, "Hedef ortada yok.", now);
      npc.orderedBy = tk.byId ? { by: tk.byId, crime: "cinayet", victimId: t.id, day: w.day } : void 0;
      const wasCruel = cruel(w, tk);
      const r = murder(w, npc, t);
      npc.lastAction = "emirle cinayet";
      const co = (w.corpses ?? []).find((c) => c.personId === t.id);
      if (wasCruel) stateCrimeSeen(w, npc, tk, t.name, co?.witnesses.length ?? 1);
      return finish(w, npc, !w.people.includes(t), r, now);
    }
    case "attack": {
      if (!t) return finish(w, npc, false, "Hedef ortada yok.", now);
      npc.orderedBy = { by: tk.byId, crime: "saldiri", victimId: t.id, day: w.day };
      const wc = cruel(w, tk);
      const res = assault(w, npc, t);
      if (wc) stateCrimeSeen(w, npc, tk, t.name, 1 + t.id.length % 3);
      return finish(w, npc, true, res, now);
    }
    case "steal": {
      if (!t) return finish(w, npc, false, "Hedef ortada yok.", now);
      npc.orderedBy = { by: tk.byId, crime: "hirsizlik", victimId: t.id, day: w.day };
      const a = steal(w, npc, t);
      if (a > 0 && by && by.id !== npc.id) transfer(w, npc.id, by.id, Math.floor(a / 2), "\xE7al\u0131nt\u0131 pay\u0131");
      return finish(w, npc, a > 0, a > 0 ? `${ek(t.name, "dan")} ${a} Dinar \xE7ald\u0131m; yar\u0131s\u0131 sizin.` : `${ek(t.name, "\u0131n")} kesesi bo\u015Ftu.`, now);
    }
    case "arrest": {
      if (!t) return finish(w, npc, false, "Hedef ortada yok.", now);
      const open = w.cases.find((c) => c.accusedId === t.id && c.stage !== "kapandi");
      const r = arrest(w, t, open?.crime ?? "isyan", null, 0, npc);
      return finish(w, npc, !!r, r ? `${t.name} tutukland\u0131.` : "Tutuklayamad\u0131m.", now);
    }
    case "give": {
      if (!t || !tk.item || npc.inv[tk.item] < n2) return finish(w, npc, false, `Elimde ${it} kalmad\u0131.`, now);
      npc.inv[tk.item] -= n2;
      t.inv[tk.item] += n2;
      rel(t, npc, 4, "bana hediye getirdi");
      return finish(w, npc, true, `${ek(t.name, "a")} ${n2} ${it} verdim.`, now);
    }
    case "sell": {
      if (!t || !tk.item || npc.inv[tk.item] < n2) return finish(w, npc, false, `${it} kalmad\u0131.`, now);
      const price = Math.round(marketPrice(w, tk.item) * n2 * 100) / 100;
      if (!transfer(w, t.id, npc.id, price, `${it} sat\u0131\u015F\u0131`)) return finish(w, npc, false, "Paran\u0131z yetmedi.", now);
      npc.inv[tk.item] -= n2;
      t.inv[tk.item] += n2;
      npc.incomeToday += price;
      return finish(w, npc, true, `${n2} ${it} teslim; ${price} Dinar ald\u0131m.`, now);
    }
    case "buy": {
      if (!tk.item) return finish(w, npc, false, "Ne alaca\u011F\u0131m\u0131 bilmiyorum.", now);
      const price = marketPrice(w, tk.item) * n2 * 1.2;
      if (by && by.id !== npc.id) transfer(w, by.id, npc.id, Math.min(by.money, price), "al\u0131\u015Fveri\u015F paras\u0131");
      const got = buy(w, npc.id, tk.item, n2);
      if (got > 0 && by && by.id !== npc.id) {
        npc.inv[tk.item] -= got;
        by.inv[tk.item] += got;
      }
      return finish(w, npc, got > 0, got > 0 ? `${got} ${it} ald\u0131m, size teslim ettim.` : `Pazarda ${it} bulamad\u0131m.`, now);
    }
    case "work": {
      produce(w, npc);
      npc.lastAction = "emirle \xE7al\u0131\u015Ft\u0131";
      return finish(w, npc, true, "\xC7al\u0131\u015Ft\u0131m, mal pazarda.", now);
    }
    case "vote": {
      if (!t) return finish(w, npc, false, "Aday yok.", now);
      const e = w.election;
      if (e.baskanCandidates.includes(t.id)) e.baskanVotes[npc.id] = t.id;
      else if (e.candidates.includes(t.id)) e.votes[npc.id] = t.id;
      else return finish(w, npc, false, `${t.name} aday de\u011Fil.`, now);
      return finish(w, npc, true, `Oyumu ${ek(t.name, "a")} verdim.`, now);
    }
    case "gossip": {
      if (!t) return finish(w, npc, false, "Kimin hakk\u0131nda?", now);
      const line = tk.text && tk.text.length > 8 ? tk.text : `${t.name} hakk\u0131nda k\xF6t\xFC \u015Feyler duydum\u2026`;
      rumor(w, `${npc.name}: ${line}`, t.id, -8);
      w.chatOut.push({ fromPersonId: npc.id, fromName: npc.name, toPersonId: null, text: `\u{1F5E3} ${t.name} diyorlar ki\u2026 ${line.replace(/^.*?(dedikodu|yay)\w*\s*/i, "")}`.slice(0, 200), at: now });
      return finish(w, npc, true, "Dedikoduyu Meydan\u2019da yayd\u0131m.", now);
    }
    case "bribe": {
      if (!t) return finish(w, npc, false, "Kime?", now);
      const amt = Math.min(npc.money, tk.pay ?? 0);
      if (amt <= 0 || !transfer(w, npc.id, t.id, amt, "r\xFC\u015Fvet")) return finish(w, npc, false, "Para yok.", now);
      if (by) rel(t, by, 15, "bana r\xFC\u015Fvet g\xF6nderdi");
      if (t.honesty > 75) {
        rumor(w, `${t.name} g\xF6nderilen r\xFC\u015Fveti geri \xE7evirdi ve herkese anlatt\u0131!`, by?.id ?? t.id, -10);
      }
      return finish(w, npc, true, `${amt} Dinar'\u0131 ${ek(t.name, "a")} ula\u015Ft\u0131rd\u0131m.`, now);
    }
    case "follow":
    case "guard":
      return;
  }
}
function runTasks(w, now) {
  for (const npc of w.people) {
    const tk = npc.task;
    if (!tk) continue;
    if (npc.jailedDays > 0 && tk.status === "yolda") {
      finish(w, npc, false, "Yakaland\u0131m, g\xF6revi yapamad\u0131m.", now);
    }
    if (tk.status === "donus") {
      if (!npc.walk || now >= walkEnd(npc.walk) || now - (tk.doneAt ?? now) > 12e4) {
        delete npc.task;
        delete npc.walk;
      }
      continue;
    }
    if (tk.status !== "yolda") {
      if (now - (tk.doneAt ?? now) > 6e3) {
        if (npc.playerId && !npc.npc) {
          delete npc.task;
          continue;
        }
        const from = npc.walk ? walkPos(npc.walk, now).pt : placeOf(w, npc.id, now) ?? { x: 0, y: 0 };
        let to = schedulePos(w, npc, now);
        const eta = (Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) / (WALK_SPEED * 0.8) * 1e3;
        to = schedulePos(w, npc, now + eta);
        tk.status = "donus";
        npc.walk = { path: findPath(w, from, to), t0: now, speed: WALK_SPEED * 0.8 };
      }
      continue;
    }
    if (now > tk.until) {
      if (tk.type === "follow" || tk.type === "guard") finish(w, npc, true, tk.type === "follow" ? "Takibi bitirdim." : "N\xF6betim bitti.", now);
      else finish(w, npc, false, "Vaktinde yapamad\u0131m.", now);
      continue;
    }
    if (!npc.walk) {
      const to = targetPt(w, tk, now, npc);
      if (to) walkFrom(w, npc, to, now);
      else {
        finish(w, npc, false, "Yeri bulamad\u0131m.", now);
        continue;
      }
    }
    const moving = tk.type === "follow" || tk.type === "guard" || !!(tk.targetId && ["attack", "kill", "steal", "arrest", "give", "sell", "bribe", "go"].includes(tk.type));
    const end = walkEnd(npc.walk);
    if (moving && tk.targetId) {
      const tq = placeOf(w, tk.targetId, now);
      const me = walkPos(npc.walk, now).pt;
      if (!tq) {
        finish(w, npc, false, "Hedefi kaybettim.", now);
        continue;
      }
      const d = Math.hypot(tq.x - me.x, tq.y - me.y);
      if (tk.type === "follow" || tk.type === "guard") {
        if (now - (tk.repath ?? 0) > 6e3 && d > 1.6) {
          tk.repath = now;
          walkFrom(w, npc, { x: tq.x + 0.9, y: tq.y }, now);
        }
        continue;
      }
      if (now >= end) {
        if (d <= PERSON_REACH) execute(w, npc, now);
        else if ((tk.tries ?? 0) < 6) {
          tk.tries = (tk.tries ?? 0) + 1;
          walkFrom(w, npc, { x: tq.x + 0.8, y: tq.y }, now);
        } else finish(w, npc, false, "Hedefe yeti\u015Femedim.", now);
      } else if (now - (tk.repath ?? tk.at) > 8e3) {
        tk.repath = now;
        const last = npc.walk.path[npc.walk.path.length - 1];
        if (Math.hypot(last.x - tq.x, last.y - tq.y) > 2.5) walkFrom(w, npc, { x: tq.x + 0.8, y: tq.y }, now);
      }
      continue;
    }
    if (now >= end) execute(w, npc, now);
  }
}
function revealOrder(w, criminal) {
  const o = criminal.orderedBy;
  if (!o) return;
  delete criminal.orderedBy;
  const by = findPerson(w, o.by);
  if (!by || by.id === criminal.id) return;
  const victim = findPerson(w, o.victimId)?.name ?? w.corpses?.find((c) => c.personId === o.victimId)?.name ?? "birini";
  if (by.id === w.kayzerId) {
    const heavy = o.crime === "cinayet" ? 1 : 0.4;
    rumor(w, `${criminal.name} itiraf etti: \u201C${victim}'\u0131 bana ${w.regime === "cumhuriyet" ? "Ba\u015Fkan" : "\u0130mparator"} ${by.name} emretti!\u201D`, by.id, -25 * heavy);
    for (const p of w.people) if (p.id !== by.id && p.prof !== "naip") {
      p.loyalty = clamp(p.loyalty - 10 * heavy);
      p.republic = clamp(p.republic + 8 * heavy);
      p.mood = clamp(p.mood - 3 * heavy);
    }
    log(w, `\u{1F4E2} SKANDAL: ${criminal.name}, ${victim} olay\u0131n\u0131 ${ek(by.name, "\u0131n")} emriyle yapt\u0131\u011F\u0131n\u0131 s\xF6yledi! Halk\u0131n sadakati sars\u0131ld\u0131, cumhuriyet\xE7iler g\xFC\xE7leniyor.`, by.id);
  } else {
    rumor(w, `${criminal.name}: \u201C${victim} i\u015Fini bana ${by.name} yapt\u0131rd\u0131!\u201D`, by.id, -15);
    log(w, `\u{1F5E3} ${criminal.name}, ${victim} olay\u0131n\u0131n azmettiricisi olarak ${ek(by.name, "\u0131")} g\xF6sterdi.`, by.id);
    if (o.crime === "cinayet" || o.crime === "saldiri") {
      by.jailedDays = Math.max(by.jailedDays, 0);
      openCase(w, by.id, o.crime, o.victimId, 0, 55);
    }
  }
}

// src/sim/look.ts
var SKIN_TONES = ["#f6d7bd", "#f1c9a5", "#e8b88f", "#e0ac7e", "#d39a6a", "#c68a5a", "#a8714a", "#8d5a3b", "#6e4329", "#4f2f1c"];
var HAIR_COLORS = ["#151515", "#2b1a10", "#3d2314", "#4a2c17", "#6b3a1e", "#7a4a22", "#9a5a2a", "#b07a3b", "#c8a060", "#e0c890", "#a83224", "#6b6b6b", "#b8b8b8", "#efefef"];
var BEARDS = ["Yok", "B\u0131y\u0131k", "Pala b\u0131y\u0131k", "Ke\xE7i sakal\u0131", "K\u0131sa sakal", "G\xFCr sakal"];
var EYES = ["#1a1410", "#3b2414", "#5a3a1a", "#3a6a3a", "#3a5a8a", "#6a6a6a"];
var BUILDS = ["\u0130nce", "Orta", "\u0130ri"];
var HEIGHTS = ["K\u0131sa", "Uzun"];
var CLOTHS = ["#b8492f", "#3f6fb0", "#4f8a3a", "#b08a2f", "#7a4fa0", "#a0603a", "#2f8a86", "#8a2f55", "#d8d0c0", "#2a2a2a", "#c86a1a", "#1f4a6a", "#6a7a2a", "#a02a2a", "#d0a0b0", "#4a3a2a", "#e0c040"];
var OUTFITS = ["G\xF6mlek", "Entari", "Yelek", "Kaftan", "\u0130\u015F \xF6nl\xFC\u011F\xFC", "C\xFCppe"];
var HEADS = ["Yok", "Fes", "Sar\u0131k", "Kalpak", "Ba\u015F\xF6rt\xFCs\xFC", "Has\u0131r \u015Fapka", "Takke"];
var TERZI_PRICE = 15;
var BERBER_PRICE = 8;
var n = (v, max) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max ? v : null;
function cleanLook(x) {
  if (!x || typeof x !== "object") return null;
  const o = { skin: n(x.skin, SKIN_TONES.length), hair: n(x.hair, 12), hairColor: n(x.hairColor, HAIR_COLORS.length), beard: n(x.beard, BEARDS.length), eye: n(x.eye, EYES.length), build: n(x.build, BUILDS.length), height: n(x.height, HEIGHTS.length), cloth: n(x.cloth, CLOTHS.length), outfit: n(x.outfit, OUTFITS.length), head: n(x.head, HEADS.length) };
  if (Object.values(o).some((v) => v === null)) return null;
  return { ...o, scarf: !!x.scarf, belt: !!x.belt, jewel: !!x.jewel };
}
function lookFromSeeds(p) {
  return { skin: [1, 3, 5, 7][p.skin % 4], hair: 0, hairColor: [1, 3, 5, 7, 0, 11, 8, 2][p.hairColor % 8], beard: !p.female && p.hairColor % 3 === 0 ? 1 : 0, eye: 1, build: 1, height: 1, cloth: p.shirt % 8, outfit: 0, head: 0, scarf: false, belt: false, jewel: false };
}

// src/sim/actions.ts
var ok2 = (msg) => ({ ok: true, msg });
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
    p.name = `Kayzer ${clean(name).replace(/^(Kayzer\s+)+/i, "")}`;
    w.founderPersonId = p.id;
  } else {
    const safeProf = PLAYER_PROFS.includes(prof) ? prof : "hamal";
    const houses2 = w.buildings.filter((b2) => b2.kind === "ev");
    const counts = /* @__PURE__ */ new Map();
    for (const x of w.people) counts.set(x.home, (counts.get(x.home) ?? 0) + 1);
    const best = [...houses2].sort((a, b2) => (counts.get(a.id) ?? 0) - (counts.get(b2.id) ?? 0))[0];
    const home = best && (counts.get(best.id) ?? 0) < 5 ? best.id : "";
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
  if ((me.homeUntil ?? 0) > now && !["goHome", "setSpeed", "setGoal", "petition", "answerProposal", "defense", "callWitness", "restCase"].includes(a.t)) leaveHome(me);
  const jailedOk = ["petition", "eat", "divorce", "answerProposal", "defense", "callWitness", "restCase", "offerBribe", "setSpeed", "setGoal"];
  const cellRising = a.t === "orgAct" && a.deed === "ayaklanma" || a.t === "customize" && a.where === "ilk";
  if (me.jailedDays > 0 && !jailedOk.includes(a.t) && !cellRising) return no("Zindandas\u0131n\u0131z; \u015Fimdilik sadece dilek\xE7e yazabilirsiniz.");
  const exileOk = [...jailedOk, "restore", "buy", "sell", "marry", "haveChild", "school", "cure"];
  if (me.exiledDays > 0 && !exileOk.includes(a.t)) return no(`S\xFCrg\xFCndesiniz (${me.exiledDays} g\xFCn kald\u0131).`);
  const need = rules.reach ? actionNeed(w, me, a) : null;
  if (need) {
    const pos = myPos(w, me, now);
    if (need.kind === "building" && need.ids.length && !need.ids.some((id) => {
      const b2 = w.buildings.find((x) => x.id === id);
      return b2 && distToBuilding(b2, pos) <= REACH + 0.6;
    })) return no(`Bunun i\xE7in \xF6nce ${need.label} y\xFCr\xFCmelisiniz.`);
    if (need.kind === "animal") {
      const an = nearestOwnAnimal(w, me, need.animal, now, pos);
      if (an && Math.hypot(an.x - pos.x, an.y - pos.y) > ANIMAL_REACH + 0.9) return no("\xD6nce hayvan\u0131n\u0131z\u0131n yan\u0131na y\xFCr\xFCmelisiniz.");
    }
    if (need.kind === "person") {
      const tp = need.id.startsWith("corpse:") ? w.corpses?.find((c) => `corpse:${c.id}` === need.id) : placeOf(w, need.id, now);
      if (tp && Math.hypot(tp.x - pos.x, tp.y - pos.y) > PERSON_REACH + 0.9) return no("\xD6nce yan\u0131na y\xFCr\xFCmelisiniz (\xE7ok uzaktas\u0131n\u0131z).");
    }
  }
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
      return got ? ok2(`${got} ${GOOD_LABEL[a.good]} ald\u0131n\u0131z.`) : no("Pazarda yok ya da paran\u0131z yetmiyor.");
    }
    case "sell": {
      const q = num(a.qty, 1, 500);
      const pr = num(a.price, 0.1, 1e3);
      if (q === null || pr === null || !GOODS.includes(a.good) || me.inv[a.good] < q) return no("Elinizde o kadar mal yok.");
      if (me.inv[a.good] - (me.bought?.[a.good] ?? 0) < q) return no("Bug\xFCn ald\u0131\u011F\u0131n\u0131z mal\u0131 ayn\u0131 g\xFCn yeniden satamazs\u0131n\u0131z (karaborsa \xF6nlemi).");
      me.inv[a.good] -= Math.floor(q);
      addListing(w, me, a.good, Math.floor(q), pr, "pazar");
      return ok2("Tezg\xE2ha koydunuz.");
    }
    case "eat": {
      if (me.hunger < 15) return no("Karn\u0131n\u0131z tok.");
      return eatMeal(w, me) ? ok2(`Yemek yediniz (a\xE7l\u0131k ${Math.round(me.hunger)}/100).`) : no("Yiyecek alacak paran\u0131z yok ya da pazarda yemek kalmad\u0131.");
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
      return ok2(`${got} ekmek ask\u0131ya kondu.`);
    }
    case "petition": {
      const text = filterProfanity(String(a.text ?? "")).slice(0, 200);
      if (text.length < 4) return no("Dilek\xE7e \xE7ok k\u0131sa.");
      const pet = openPetition(w, me, a.kind, text, Math.min(num(a.amount, 0, 500) ?? 0, 500), a.payload);
      return pet ? ok2("Dilek\xE7eniz saraya ula\u015Ft\u0131.") : no("Zaten bekleyen bir dilek\xE7eniz var.");
    }
    case "answer": {
      if (!isKayzer(w, me)) return no(`Sadece ${headTitle(w)} cevaplayabilir.`);
      const pet = w.petitions.find((x) => x.id === a.petitionId);
      if (!pet) return no("Dilek\xE7e yok.");
      return answerPetition(w, pet, a.accept, "kayzer", now) ? ok2("Ferman yaz\u0131ld\u0131.") : no("Bu dilek\xE7e uygulanamad\u0131 (hazine yetmiyor olabilir).");
    }
    case "setTax": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const r = num(a.rate, 0, 40);
      if (r === null) return no("0\u201340 aras\u0131.");
      if (w.regime === "imparatorluk" && members(w).length >= 5 && Math.round(r) !== w.taxRate) {
        const b2 = kayzerBill(w, me, "vergi", Math.round(r), "");
        return typeof b2 === "string" ? no(b2) : ok2(`Vergi de\u011Fi\u015Fikli\u011Fi Meclis\u2019e sevk edildi (%${Math.round(r)}). Meclis kabul ederse y\xFCr\xFCrl\xFC\u011Fe girer.`);
      }
      w.taxRate = Math.round(r);
      log(w, `Ferman: sat\u0131\u015F vergisi %${w.taxRate}.`);
      return ok2("Vergi de\u011Fi\u015Fti.");
    }
    case "setHeadTax": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const r = num(a.amount, 0, 10);
      if (r === null) return no("0\u201310 aras\u0131.");
      w.headTax = r;
      log(w, `Ferman: ba\u015F vergisi ${r} Dinar.`);
      return ok2("Ba\u015F vergisi de\u011Fi\u015Fti.");
    }
    case "setSalary": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const r = num(a.amount, 0, 60);
      if (r === null || !STATE_PROFS.includes(a.prof)) return no("Ge\xE7ersiz.");
      w.salaries[a.prof] = r;
      log(w, `Ferman: ${PROF_LABEL[a.prof]} maa\u015F\u0131 ${r} Dinar.`);
      return ok2("Maa\u015F de\u011Fi\u015Fti.");
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
      return ok2("Kanun g\xFCncellendi.");
    }
    case "startProject": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const c = num(a.cost, 100, 2e4);
      if (c === null) return no("Maliyet 100\u201320000.");
      if (w.projects.some((p) => !p.done)) return no("\xD6nce s\xFCren in\u015Faat bitmeli.");
      w.projects.push({ id: `pr${++w.idSeq}`, name: a.name.slice(0, 40) || "Yeni in\u015Faat", site: "santiye", cost: c, paid: 0, progress: 0, needed: Math.round(c / 10), done: false });
      log(w, `Ferman: ${a.name} in\u015Faat\u0131 ba\u015Fl\u0131yor.`);
      return ok2("\u0130n\u015Faat ba\u015Flad\u0131; \xF6denek ay\u0131r\u0131n.");
    }
    case "fundProject": {
      const pr = w.projects.find((p) => p.id === a.projectId && !p.done);
      const amt = num(a.amount, 1, 5e4);
      if (!pr || amt === null) return no("Ge\xE7ersiz.");
      const from = isKayzer(w, me) ? "saray" : me.id;
      if (from === "saray" && !spend(w, amt)) return no(`Meclis b\xFCt\xE7esi yetmiyor (kalan ${Math.round(budgetLeft(w))} Dinar).`);
      return transfer(w, from, `proje:${pr.id}`, amt, "proje \xF6dene\u011Fi") ? ok2(`${amt} Dinar \xF6denek ayr\u0131ld\u0131.`) : no("Para yetmiyor.");
    }
    case "appoint": {
      if (!isKayzer(w, me)) return no("Yetkiniz yok.");
      const t = findPerson(w, a.personId);
      if (!t || t.prof === "naip" || t.id === me.id || !PROF_LABEL[a.prof] || a.prof === "kayzer" || a.prof === "naip") return no("Ge\xE7ersiz atama.");
      t.prof = a.prof;
      t.work = WORKPLACE[a.prof];
      t.loyalty = clamp(t.loyalty + 10);
      log(w, `Ferman: ${t.name} ${PROF_LABEL[a.prof]} oldu.`, t.id);
      return ok2("Atand\u0131.");
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
      return ok2("Affedildi.");
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
          return ok2("Dava h\xE2kime g\xF6nderildi.");
        }
        if (a.decision === "dusur") {
          c.stage = "kapandi";
          c.verdict = "dusuruldu";
          if (acc) acc.jailedDays = 0;
          return ok2("Dava d\xFC\u015F\xFCr\xFCld\xFC.");
        }
      } else if (c.stage === "hakim") {
        if (me.prof !== "hakim") return no("Bu dava h\xE2kimde.");
        if (a.decision === "suclu" || a.decision === "beraat") {
          verdict(w, c.id, a.decision === "suclu", now);
          return ok2("Karar verildi.");
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
      log(w, `${me.name}, ${ek(t.name, "\u0131")} tutuklad\u0131.`, t.id);
      return ok2(recent ? "Tutukland\u0131, deliller g\xFC\xE7l\xFC." : "Tutukland\u0131 ama delil zay\u0131f.");
    }
    case "steal": {
      const t = findPerson(w, a.personId);
      if (!t || t.id === me.id || t.prof === "naip" || t.id === w.kayzerId) return no("Ge\xE7ersiz.");
      if (atHomeSafe(w, t, now)) return no(`${t.name} evinde; kap\u0131 kilitli.`);
      me.honesty = clamp(me.honesty - 10);
      const got = steal(w, me, t);
      return got ? ok2(`${got} Dinar \xE7ald\u0131n\u0131z\u2026`) : no("Kesesi bo\u015F \xE7\u0131kt\u0131.");
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
        log(w, `${me.name}, ${ek(t.name, "a")} r\xFC\u015Fvet verirken yakaland\u0131!`, me.id);
        return ok2("R\xFC\u015Fveti verdiniz\u2026 ama bek\xE7i g\xF6rd\xFC!");
      }
      return ok2(t.sidedWith === me.id ? `${t.name} art\u0131k sizin yan\u0131n\u0131zda.` : "R\xFC\u015Fveti ald\u0131; ne d\xFC\u015F\xFCnd\xFC\u011F\xFC belli de\u011Fil.");
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
      return ok2(`${ek(t.name, "a")} ${amt} Dinar verildi.`);
    }
    case "propose": {
      const law = a.law ? { ...a.law, name: a.law.name ? filterProfanity(String(a.law.name)).slice(0, 50) : void 0 } : void 0;
      const r = propose(w, me, a.kind, num(a.value, 0, 5e4) ?? 0, String(a.target ?? ""), a.title ? filterProfanity(a.title) : void 0, law);
      return typeof r === "string" ? no(r) : ok2("Teklifiniz Meclis g\xFCndeminde. 1 g\xFCn g\xF6r\xFC\u015Fme, 1 g\xFCn oylama.");
    }
    case "enactLaw": {
      if (!isKayzer(w, me)) return no("Kanunu sadece h\xFCk\xFCmdar ferman ile \xE7\u0131kar\u0131r; siz Meclis\u2019e teklif verin.");
      if (w.regime === "cumhuriyet" && ["yasak", "sokak", "hizmet", "sertCeza"].includes(a.law?.kind)) return no("Cumhuriyette yasak, soka\u011Fa \xE7\u0131kma, zorunlu hizmet ve a\u011F\u0131r ceza kanunlar\u0131n\u0131 sadece Meclis \xE7\u0131kar\u0131r.");
      const law = { ...a.law, name: a.law?.name ? filterProfanity(String(a.law.name)).slice(0, 50) : void 0 };
      const err = validateLaw(law);
      if (err) return no(err);
      return ok2(enactLaw(w, law, me, "ferman"));
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
      return ok2(inspectPerson(w, me, t));
    }
    case "castVote": {
      const b2 = w.meclis.bills.find((x) => x.id === a.billId);
      if (!me.meclis) return no("Sadece Meclis \xFCyeleri oy verir.");
      if (!b2 || b2.status !== "oylama" && b2.status !== "tartisma") return no("Bu teklif oylamada de\u011Fil.");
      if (!["evet", "hayir", "cekimser"].includes(a.choice)) return no("Ge\xE7ersiz oy.");
      b2.votes[me.id] = a.choice;
      return ok2(`Oyunuz kaydedildi: ${a.choice}.`);
    }
    case "speak": {
      const b2 = w.meclis.bills.find((x) => x.id === a.billId);
      if (!me.meclis || !b2) return no("Sadece Meclis \xFCyeleri konu\u015Fur.");
      const text = filterProfanity(String(a.text ?? "")).slice(0, 200);
      if (text.length < 3) return no("Konu\u015Fma \xE7ok k\u0131sa.");
      if (b2.speeches.filter((s) => s.personId === me.id).length >= 3) return no("Bu teklif i\xE7in s\xF6z hakk\u0131n\u0131z bitti.");
      b2.speeches.push({ personId: me.id, text, day: w.day });
      return ok2("K\xFCrs\xFCden konu\u015Ftunuz.");
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
      return ok2(`${w.meclis.factions.find((f) => f.id === a.factionId).name} \xFCyesisiniz.`);
    }
    case "runForBaskan": {
      if (w.regime !== "cumhuriyet") return no("Ba\u015Fkanl\u0131k se\xE7imi sadece cumhuriyette yap\u0131l\u0131r.");
      if (!w.election.baskanCandidates.includes(me.id)) w.election.baskanCandidates.push(me.id);
      return ok2(`Ba\u015Fkan aday\u0131s\u0131n\u0131z. Se\xE7im ${w.election.baskanNextDay}. g\xFCn.`);
    }
    case "voteBaskan": {
      if (w.regime !== "cumhuriyet" || !findPerson(w, a.candidateId)) return no("Ge\xE7ersiz.");
      w.election.baskanVotes[me.id] = a.candidateId;
      return ok2("Oyunuz sand\u0131kta.");
    }
    case "runForMeclis": {
      if (me.id === w.kayzerId && w.regime === "imparatorluk") return no("Kayzer aday olamaz.");
      if (me.prof === "asker" || me.prof === "bekci") return no("Askerler ve bek\xE7iler Meclis\u2019e aday olamaz.");
      if (electionPhase(w).phase !== "aday") return no(`Adayl\u0131k d\xF6nemi de\u011Fil. ${electionPhase(w).label}.`);
      if (!w.election.candidates.includes(me.id)) w.election.candidates.push(me.id);
      return ok2(`Adays\u0131n\u0131z. Se\xE7im ${w.election.nextDay}. g\xFCn.`);
    }
    case "vote": {
      if (!w.election.candidates.includes(a.candidateId)) return no("Bu ki\u015Fi aday de\u011Fil.");
      if (electionPhase(w).phase === "bekleme" || electionPhase(w).phase === "aday") return no(`Oy verme zaman\u0131 de\u011Fil. ${electionPhase(w).label}.`);
      w.election.votes[me.id] = a.candidateId;
      return ok2("Oyunuz sand\u0131kta.");
    }
    case "plot": {
      if (me.id === w.kayzerId) return no(`Zaten ${headTitle(w)}siniz.`);
      if (a.kind === "none") {
        me.plotting = "none";
        return ok2("Komplodan vazge\xE7tiniz.");
      }
      if (w.coup && w.coup.leaderId !== me.id) return no("Ba\u015Fka bir komplo s\xFCr\xFCyor.");
      me.plotting = a.kind;
      w.coup = w.coup ?? { leaderId: me.id, kind: a.kind, day: w.day, fund: 0 };
      w.coup.kind = a.kind;
      return ok2(a.kind === "coup" ? "Darbe haz\u0131rl\u0131\u011F\u0131 ba\u015Flad\u0131. Kurallar: en az 6 asker (Saray Korumas\u0131 varsa 8), 1500 Dinar fon, halk deste\u011Fi (memnuniyet < 40 ya da cumhuriyet \u2265 50)." : "Devrim haz\u0131rl\u0131\u011F\u0131 ba\u015Flad\u0131. Kurallar: cumhuriyet \u2265 70, en az 4 asker, 800 Dinar fon.");
    }
    case "fundPlot": {
      if (!w.coup || w.coup.leaderId !== me.id) return no("\xD6nce komplo ba\u015Flat\u0131n.");
      const amt = num(a.amount, 1, 1e5);
      if (amt === null) return no("Ge\xE7ersiz.");
      return transfer(w, me.id, "fon", amt, "komplo fonu") ? ok2(`Fon: ${w.coup.fund} Dinar`) : no("Para yetmiyor.");
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
      return ok2(r);
    }
    case "divorce": {
      const r = divorce(w, me);
      return me.spouse ? no(r) : ok2(r);
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
      return ok2(a.on ? `${c.name} okula ba\u015Flad\u0131 (g\xFCnde 1 Dinar).` : `${c.name} okuldan al\u0131nd\u0131.`);
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
      return ok2("Veliaht belirlendi.");
    }
    case "abdicate": {
      if (w.kayzerId !== me.id || w.regime !== "imparatorluk") return no("Sadece Kayzer feragat edebilir.");
      const r = succeed(w, me);
      if (!r) return no("Taht\u0131 devredecek e\u015Finiz ya da \xE7ocu\u011Funuz yok.");
      log(w, r, w.kayzerId ?? void 0);
      return ok2(r);
    }
    case "isyanCmd": {
      if (!w.isyan) return no("Ortada isyan yok.");
      const head = isKayzer(w, me);
      const commander = me.prof === "asker" && !w.people.some((p) => p.playerId && canRule(w, p, now, ONLINE_WINDOW_MS) && now - (w.players[p.playerId]?.lastSeen ?? 0) < ONLINE_WINDOW_MS);
      if (!head && !commander) return no("Askerlere sadece h\xFCk\xFCmdar (ya da o yokken bir komutan) emir verir.");
      if (!["dagit", "tutukla", "saldir"].includes(a.cmd)) return no("Ge\xE7ersiz emir.");
      return ok2(command(w, a.cmd, me.name));
    }
    case "joinRebels": {
      if (!w.isyan) return no("Ortada isyan yok.");
      if (me.id === w.kayzerId || me.soylu) return no("Siz saray\u0131n taraf\u0131ndas\u0131n\u0131z.");
      if (!w.isyan.rebels.includes(me.id)) w.isyan.rebels.push(me.id);
      me.republic = clamp(me.republic + 20);
      return ok2("Asilere kat\u0131ld\u0131n\u0131z!");
    }
    case "setGoal":
      return ok2(setGoal(me, a.goal));
    case "buyHome":
    case "rentHome": {
      const r = moveIn(w, me, a.houseId, a.t === "buyHome" ? "satin" : "kira");
      return /satın aldınız|taşındınız/.test(r) ? ok2(r) : no(r);
    }
    case "goHome": {
      const r = goInside(w, me, !!a.sleep, now, hourMs(w));
      return r.startsWith("Eviniz yok") ? no(r) : ok2(r);
    }
    case "leaveHome":
      leaveHome(me);
      return ok2("D\u0131\u015Far\u0131 \xE7\u0131kt\u0131n\u0131z.");
    case "foundFaction": {
      const r = foundFaction(w, me, String(a.name ?? ""));
      return r.includes("kuruldu") ? ok2(r) : no(r);
    }
    case "drinkMilk": {
      const r = drinkMilk(me);
      return r.startsWith("S\xFCt i\xE7tiniz") ? ok2(r) : no(r);
    }
    case "eatEgg": {
      const r = eatEgg(me);
      return r.startsWith("Yumurta") ? ok2(r) : no(r);
    }
    case "buildBarn": {
      const r = buildBarn(w, me, a.kind);
      return r.includes("yap\u0131ld\u0131") ? ok2(r) : no(r);
    }
    case "feedAnimals": {
      const r = feedAnimals(w, me);
      return r.includes("beslendi") ? ok2(r) : no(r);
    }
    case "collectFarm": {
      const r = collectFarm(me);
      return r.startsWith("Topland\u0131") ? ok2(r) : no(r);
    }
    case "ride": {
      if (a.on && !hasHorse(me)) return no("At\u0131n\u0131z yok. Hayvan Pazar\u0131\u2019ndan al\u0131n.");
      me.riding = !!a.on;
      return ok2(a.on ? "At\u0131n\u0131za bindiniz: iki kat h\u0131zl\u0131s\u0131n\u0131z." : "Attan indiniz.");
    }
    case "buyFarm": {
      const r = buyFarm(w, me);
      return r.includes("arsan\u0131z haz\u0131r") ? ok2(r) : no(r);
    }
    case "buyAnimal": {
      const r = buyAnimal(w, me, a.animal, Math.max(1, Math.min(10, Math.round(a.n ?? 1))));
      return / aldınız/.test(r) ? ok2(r) : no(r);
    }
    case "slaughter": {
      const r = slaughter(w, me, a.animal);
      return r.includes("kesildi") ? ok2(r) : no(r);
    }
    case "grantTitle": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      const r = grantTitle(w, me, t, a.rank, a.fief);
      return r.startsWith("\u{1F451}") ? ok2(r) : no(r);
    }
    case "stripTitle": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      const r = stripTitle(w, me, t);
      return r.startsWith("\u2694") ? ok2(r) : no(r);
    }
    case "orgFound": {
      const r = orgFound(w, me, a.kind, String(a.name ?? ""));
      return r.includes("kuruldu") ? ok2(r) : no(r);
    }
    case "orgJoin": {
      const r = orgJoin(w, me, a.orgId);
      return r.includes("kat\u0131ld\u0131n\u0131z") ? ok2(r) : no(r);
    }
    case "orgLeave": {
      const r = orgLeave(w, me);
      return r.startsWith("\xD6rg\xFCtte de\u011Fil") ? no(r) : ok2(r);
    }
    case "orgRole": {
      const r = orgRole(w, me, a.personId, a.role);
      return r.includes("art\u0131k") ? ok2(r) : no(r);
    }
    case "orgAct": {
      const r = orgAct(w, me, a.deed);
      return /asıldı|soyuldu|yapıldı|başarılı|BAŞLADI/.test(r) ? ok2(r) : no(r);
    }
    case "orgMeet": {
      const r = orgMeet(w, me);
      return r.startsWith("Bu gece") ? ok2(r) : no(r);
    }
    case "assignSpy": {
      const s = findPerson(w, a.spyId), t = findPerson(w, a.targetId);
      if (!s || !t) return no("Ki\u015Fi yok.");
      const r = assignSpy(w, me, s, t);
      return r.includes("izleyecek") ? ok2(r) : no(r);
    }
    case "warrant": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      const r = issueWarrant(w, me, t);
      return r.includes("\xE7\u0131kar\u0131ld\u0131") ? ok2(r) : no(r);
    }
    case "searchHouse": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      const r = searchHouse(w, me, t);
      return r.includes("arand\u0131") || r.includes("bulundu") ? ok2(r) : no(r);
    }
    case "raidOrg": {
      const r = raidOrg(w, me, a.orgId);
      return r.startsWith("\u2694") ? ok2(r) : no(r);
    }
    case "informantPay": {
      if (me.id !== w.kayzerId) return no("Sadece Kayzer.");
      w.informantPay = Math.max(0, Math.min(200, Math.round(a.amount)));
      return ok2(w.informantPay ? `Muhbirlere ${w.informantPay} Dinar \xF6d\xFCl ilan edildi.` : "Muhbir \xF6d\xFCl\xFC kald\u0131r\u0131ld\u0131.");
    }
    case "missionCreate": {
      const r = missionCreate(w, me, String(a.text ?? ""), Number(a.reward) || 0, a.to ?? null);
      return r === "G\xF6rev ilan edildi." ? ok2(r) : no(r);
    }
    case "missionClaim":
      return ok2(missionClaim(w, me, a.id));
    case "missionPay":
      return ok2(missionPay(w, me, a.id, !!a.pay));
    case "setSpeed": {
      if (w.kayzerId !== me.id) return no("Oyun h\u0131z\u0131n\u0131 sadece h\xFCk\xFCmdar de\u011Fi\u015Ftirir.");
      if (![0.5, 1, 2].includes(a.speed)) return no("0.5x, 1x ya da 2x.");
      const f = Math.min(0.999, Math.max(0, (now - w.lastTickAt) / hourMs(w)));
      w.speed = a.speed;
      w.lastTickAt = now - f * hourMs(w);
      log(w, `Ferman: zaman ${a.speed}x h\u0131zla ak\u0131yor.`);
      return ok2(`H\u0131z ${a.speed}x.`);
    }
    case "drinkWater":
      if (me.thirst < 15) return no("Susamad\u0131n\u0131z.");
      return drinkWater(w, me) ? ok2(`Su i\xE7tiniz (susuzluk ${Math.round(me.thirst)}/100).`) : no("Su alacak paran\u0131z yok ya da kuyuda su kalmad\u0131.");
    case "pray":
      return ok2(pray(w, me));
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
        return ok2(`Fazla mesai yapt\u0131n\u0131z: ${me.lastAction}`);
      }
      const pay = 4;
      if (transfer(w, "saray", me.id, pay, "yevmiye")) {
        me.incomeToday += pay;
        me.lastAction = "fazla mesai";
        me.health = clamp(me.health - 3);
        return ok2("Yevmiyeli i\u015F yapt\u0131n\u0131z (+4 Dinar).");
      }
      return no("\u0130\u015F yok.");
    }
    case "nightOut": {
      me.nightOut = a.on;
      return ok2(a.on ? "Gece d\u0131\u015Far\u0131das\u0131n\u0131z; dikkat, gece su\xE7 \xE7ok." : "Eve girdiniz.");
    }
    case "chatWith": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      void opinion;
      return ok2(`${t.name} ile konu\u015Fmak i\xE7in \u2709\uFE0F Mesaj yaz\u0131n.`);
    }
    case "move": {
      const x = num(a.x, -1, MAP_W + 1), y = num(a.y, -1, MAP_H + 1);
      if (x === null || y === null) return no("Ge\xE7ersiz yer.");
      if (me.jailedDays > 0) return no("Zindandas\u0131n\u0131z.");
      startWalk(w, me, { x, y }, now);
      return { ok: true, msg: "" };
    }
    case "report": {
      const co = w.corpses?.find((c) => c.id === a.corpseId);
      if (!co) return no("Ceset kald\u0131r\u0131lm\u0131\u015F.");
      if (co.killerId === me.id) {
        me.honesty = clamp(me.honesty + 2);
      }
      return ok2(reportCorpse(w, co, me, now));
    }
    case "defense": {
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c) return no("Dava yok.");
      const text = filterProfanity(String(a.text ?? "")).slice(0, 300);
      if (text.length < 2) return no("Bir \u015Fey yaz\u0131n.");
      const e = addDefense(w, c, me, text, now);
      return e ? no(e) : ok2("");
    }
    case "restCase": {
      const c = w.cases.find((x) => x.id === a.caseId && x.accusedId === me.id && x.trial && !x.trial.done);
      if (!c) return no("G\xF6r\xFClen davan\u0131z yok.");
      finishTrial(w, c, now);
      return ok2(c.trial.verdictText ?? "Karar verildi.");
    }
    case "insult": {
      const t = findPerson(w, a.personId);
      if (!t) return no("Ki\u015Fi yok.");
      rel(t, me, -25, "bana hakaret etti");
      me.rep = clamp(me.rep - 2, -100, 100);
      return ok2(`${t.name} size k\xFCst\xFC.`);
    }
    case "assault": {
      const t = findPerson(w, a.personId);
      if (!t || t.id === me.id || t.prof === "naip") return no("Ge\xE7ersiz.");
      me.honesty = clamp(me.honesty - 15);
      return ok2(assault(w, me, t));
    }
    case "kill": {
      const t = findPerson(w, a.personId);
      if (!t || t.id === me.id || t.prof === "naip" || t.id === w.kayzerId) return no("Ge\xE7ersiz.");
      me.honesty = clamp(me.honesty - 40);
      return ok2(murder(w, me, t));
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
      return ok2(`${ca?.name ?? "Bek\xE7i"} teklifinizi d\xFC\u015F\xFCn\xFCyor\u2026`);
    }
    case "answerBribe": {
      const ar = w.arrests.find((x) => x.id === a.arrestId && x.catcherId === me.id && x.status === "bekliyor");
      if (!ar) return no("Teklif yok.");
      return ok2(decideBribe(w, ar, a.accept));
    }
    case "answerOffer": {
      const o = w.offers.find((x) => x.id === a.offerId && x.to === me.id);
      if (!o) return no("Teklif yok.");
      w.offers = w.offers.filter((x) => x !== o);
      const f = findPerson(w, o.from);
      if (!f) return no("Ki\u015Fi gitmi\u015F.");
      if (!a.accept) {
        rel(f, me, -2, "teklifimi geri \xE7evirdi");
        return ok2("Geri \xE7evirdiniz.");
      }
      if (o.kind === "borc" && transfer(w, me.id, f.id, o.amount ?? 10, "iyilik")) {
        rel(f, me, 15, "zor g\xFCn\xFCmde yard\u0131m etti");
        me.rep = clamp(me.rep + 2, -100, 100);
        return ok2(`${f.name} \xE7ok minnettar.`);
      }
      if (o.kind === "mal" && o.good && o.price) {
        const q = o.qty ?? 1;
        const g = o.good;
        const have = f.inv[g] + w.listings.filter((l) => l.sellerId === f.id && l.good === g).reduce((s2, l) => s2 + l.qty, 0);
        if (have < q) return no("Mal\u0131 kalmam\u0131\u015F.");
        if (!transfer(w, me.id, f.id, o.price * q, `${g} al\u0131m\u0131`)) return no("Paran\u0131z yetmiyor.");
        let need2 = q;
        const take = Math.min(f.inv[g], need2);
        f.inv[g] -= take;
        need2 -= take;
        for (const l of w.listings.filter((l2) => l2.sellerId === f.id && l2.good === g)) {
          const t2 = Math.min(l.qty, need2);
          l.qty -= t2;
          need2 -= t2;
        }
        me.inv[g] += q;
        f.taxDue += o.price * q * w.taxRate / 100;
        rel(f, me, 4, "al\u0131\u015Fveri\u015F yapt\u0131k");
        return ok2("Pazarl\u0131k tamam.");
      }
      if (o.kind === "rusvet" && transfer(w, f.id, me.id, o.amount ?? 15, "r\xFC\u015Fvet")) {
        rel(f, me, 10, "g\xF6z yumdu");
        if (chance(w, 0.25)) {
          openCase(w, me.id, "rusvet", null, o.amount ?? 15, 55);
          return ok2("R\xFC\u015Fveti ald\u0131n\u0131z\u2026 ama biri g\xF6rd\xFC!");
        }
        return ok2("R\xFC\u015Fveti ald\u0131n\u0131z.");
      }
      return no("Olmad\u0131.");
    }
    case "poster": {
      if (electionPhase(w).phase !== "propaganda" && electionPhase(w).phase !== "aday") return no("Afi\u015F sadece adayl\u0131k ve propaganda d\xF6neminde as\u0131l\u0131r.");
      if (!w.election.candidates.includes(me.id)) return no("\xD6nce aday olun.");
      if (!transfer(w, me.id, "saray", 5, "afi\u015F harc\u0131")) return no("Afi\u015F 5 Dinar.");
      w.election.posters = w.election.posters ?? {};
      w.election.posters[me.id] = (w.election.posters[me.id] ?? 0) + 1;
      return ok2("Afi\u015Fleriniz as\u0131ld\u0131.");
    }
    case "campaign": {
      if (!w.election.candidates.includes(me.id)) return no("\xD6nce aday olun.");
      const text = filterProfanity(String(a.text ?? "")).slice(0, 160);
      if (text.length < 4) return no("Konu\u015Fma k\u0131sa.");
      for (const p of w.people) if (chance(w, 0.25)) rel(p, me, Math.abs(p.republic - me.republic) < 25 ? 3 : -1, "se\xE7im konu\u015Fmas\u0131n\u0131 dinledim");
      w.chatOut.push({ fromPersonId: me.id, fromName: me.name, toPersonId: null, text: `\u{1F4E3} ${text}`, at: now });
      return ok2("Meydanda konu\u015Ftunuz.");
    }
    case "sermon": {
      if (me.prof !== "imam" && me.prof !== "hoca") return no("Vaaz\u0131 imam ya da hoca verir.");
      if (me.lastAction === "vaaz") return no("Bug\xFCn vaaz verdiniz.");
      me.lastAction = "vaaz";
      return ok2(sermon(w, me, a.topic));
    }
    case "directive": {
      if (!isKayzer(w, me)) return no("Y\xF6nlendirmeyi devlet yapar.");
      return ok2(directive(w, a.topic));
    }
    case "granary": {
      if (!isKayzer(w, me)) return no("Ambar\u0131 devlet y\xF6netir.");
      const q = num(a.qty, 1, 500);
      if (q === null) return no("Ge\xE7ersiz.");
      return a.op === "buy" ? ok2(`Ambara ${granaryBuy(w, q)} bu\u011Fday al\u0131nd\u0131 (sadece ucuz bu\u011Fday).`) : ok2(`Ambardan ${granaryRelease(w, q)} bu\u011Fday sabit fiyatla sat\u0131\u015Fa \xE7\u0131kt\u0131.`);
    }
    case "priceCap": {
      if (!isKayzer(w, me)) return no("Narh\u0131 devlet koyar.");
      if (!GOODS.includes(a.good)) return no("Mal yok.");
      if (a.price === null) {
        delete w.priceCaps[a.good];
        return ok2("Narh kald\u0131r\u0131ld\u0131.");
      }
      const v = num(a.price, 0.1, 500);
      if (v === null) return no("Ge\xE7ersiz.");
      w.priceCaps[a.good] = v;
      for (const l of w.listings) if (l.good === a.good && l.price > v) l.price = v;
      log(w, `Ferman: ${GOOD_LABEL[a.good]} i\xE7in narh (tavan fiyat) ${v} Dinar.`);
      return ok2("Narh kondu. \xC7ok d\xFC\u015F\xFCk narh k\u0131tl\u0131k yarat\u0131r!");
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
      return ok2("Savunmay\u0131 \xFCstlendiniz; delil zay\u0131flad\u0131.");
    }
    case "customize": {
      const L = cleanLook(a.look);
      if (!L) return no("Ge\xE7ersiz g\xF6r\xFCn\xFCm.");
      const cur = me.look ?? lookFromSeeds(me);
      if (!me.lookSet || a.where === "ilk") {
        if (me.lookSet) return no("\u0130lk g\xF6r\xFCn\xFCm zaten se\xE7ildi; Terzi ya da Berber\u2019e gidin.");
        me.look = L;
        me.lookSet = true;
        return ok2("G\xF6r\xFCn\xFCm\xFCn\xFCz kaydedildi.");
      }
      if (a.where === "terzi") {
        const nl2 = { ...cur, cloth: L.cloth, outfit: L.outfit, head: L.head, scarf: L.scarf, belt: L.belt, jewel: L.jewel };
        const tailor = w.people.find((p) => p.prof === "dokumaci" && p.jailedDays === 0 && p.id !== me.id);
        if (!transfer(w, me.id, tailor?.id ?? "saray", TERZI_PRICE, "terzi (yeni k\u0131yafet)")) return no(`Terzi ${TERZI_PRICE} Dinar ister.`);
        if (tailor) tailor.incomeToday += TERZI_PRICE;
        me.look = nl2;
        return ok2(`Yeni k\u0131yafetiniz haz\u0131r (${TERZI_PRICE} D).`);
      }
      const nl = { ...cur, hair: L.hair, hairColor: L.hairColor, beard: L.beard };
      if (!transfer(w, me.id, "saray", BERBER_PRICE, "berber")) return no(`Berber ${BERBER_PRICE} Dinar ister.`);
      me.look = nl;
      return ok2(`Berber i\u015Fini bitirdi (${BERBER_PRICE} D).`);
    }
    case "callWitness": {
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c) return no("Dava yok.");
      const e = callWitness(w, c, me, String(a.personId), now);
      return e ? no(e) : ok2("Tan\u0131k \xE7a\u011Fr\u0131ld\u0131.");
    }
    case "witness": {
      const c = w.cases.find((x) => x.id === a.caseId && x.stage !== "kapandi");
      if (!c || c.accusedId === me.id) return no("Dava yok.");
      c.witnesses = c.witnesses ?? [];
      if (c.witnesses.some((x) => x.id === me.id)) return no("Zaten tan\u0131ks\u0131n\u0131z.");
      c.witnesses.push({ id: me.id, against: a.against });
      if (!c.trial) c.evidence = clamp(c.evidence + (a.against ? 15 : -10));
      const acc = findPerson(w, c.accusedId);
      if (c.trial && !c.trial.done) c.trial.msgs.push({ who: me.id === c.trial.blamedId ? "suclanan" : "tanik", name: me.name, text: (String(a.text ?? "").trim() || (a.against ? "Aleyhte tan\u0131kl\u0131k ediyorum." : "Lehte tan\u0131kl\u0131k ediyorum.")).slice(0, 300), at: now });
      if (acc) rel(acc, me, a.against ? -30 : 12, a.against ? "aleyhime tan\u0131kl\u0131k etti" : "lehime tan\u0131kl\u0131k etti");
      return ok2("Tan\u0131kl\u0131\u011F\u0131n\u0131z tutana\u011Fa ge\xE7ti.");
    }
    case "smuggle": {
      me.smuggle = a.on;
      return ok2(a.on ? "Sat\u0131\u015Flar\u0131n\u0131z\u0131 vergiden sakl\u0131yorsunuz (ka\xE7ak\xE7\u0131l\u0131k su\xE7tur!)." : "D\xFCr\xFCst ticarete d\xF6nd\xFCn\xFCz.");
    }
    case "tribute": {
      if (!isKayzer(w, me) || !w.threat) return no("Hara\xE7 isteyen yok.");
      if (a.pay) return ok2(payTribute(w));
      log(w, `${headTitle(w)} harac\u0131 reddetti! Ordu s\u0131n\u0131ra y\xFCr\xFCyor.`);
      w.threat.deadline = w.day;
      return ok2("Hara\xE7 reddedildi; sava\u015F yak\u0131nda.");
    }
    case "caravanBuy": {
      const q = num(a.qty, 1, 50);
      if (q === null) return no("Ge\xE7ersiz.");
      const got = buy(w, me.id, a.good, q);
      return got ? ok2(`Kervandan/pazardan ${got} ${GOOD_LABEL[a.good]} ald\u0131n\u0131z.`) : no("Al\u0131namad\u0131.");
    }
    case "borrow": {
      const v = num(a.amount, 5, 150);
      if (v === null) return no("5\u2013150 Dinar.");
      const r = borrow(w, me, v);
      return { ok: r.includes("verdi"), msg: r };
    }
    case "repay":
      return ok2(repay(w, me, a.loanId));
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
      return ok2("Festival ba\u015Flad\u0131.");
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
      return ok2("\u0130n\u015Faat ba\u015Flad\u0131; \xF6denek ay\u0131r\u0131n.");
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
      return ok2("Bayram!");
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
  return ok2("Taht art\u0131k sizin.");
}
function restore(w, me, founder) {
  if (!founder) return no("Hanedan hakk\u0131 sadece kurucuya ve soyundan gelenlere aittir.");
  if (w.kayzerId === me.id) return no("Zaten tahttas\u0131n\u0131z efendim.");
  if (w.exKayzerId === me.id) return no("Zindana girdi\u011Finiz i\xE7in taht\u0131 kaybettiniz. Geri alman\u0131n yolu: Cemiyet \u2192 Ayaklanma ile bir isyana \xF6nderlik edip kazanmak, ya da cumhuriyette Ba\u015Fkan se\xE7ilmek.");
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
  return ok2("Taht\u0131n\u0131za geri d\xF6nd\xFCn\xFCz efendim.");
}
var BAD = ["amk", "aq", "mk", "o\xE7", "orospu", "pi\xE7", "sik", "yarrak", "g\xF6t", "pezevenk", "kahpe", "ibne", "fuck", "shit", "bitch"];
function filterProfanity(s) {
  return s.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const lw = word.toLocaleLowerCase("tr");
    return BAD.some((b2) => lw === b2 || b2.length >= 4 && lw.startsWith(b2)) ? "*".repeat(word.length) : word;
  });
}
function rateOk(times, now, n2 = 5, windowMs = 3e4) {
  while (times.length && now - (times[0] ?? 0) > windowMs) times.shift();
  if (times.length >= n2) return false;
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
  realtime(w, now);
  const snapshotDue = now - w.lastSnapshotAt >= SNAPSHOT_EVERY_MS;
  if (snapshotDue) w.lastSnapshotAt = now;
  return { summary, hours, snapshotDue };
}
function act(w, playerId, a, now, deferJudge = false) {
  migrateWorld(w);
  advanceWorld(w, now);
  realtime(w, now);
  const r = applyAction(w, playerId, a, now);
  if (a.t === "defense" && r.ok && !deferJudge) {
    const c = w.cases.find((x) => x.id === a.caseId);
    const last = c?.trial?.msgs.at(-1);
    if (c && last) {
      const j = judgeRule(w, c, last.text);
      judgeAnswer(w, c, j.reply, j.score, now + 800);
    }
  }
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
function makeChat(w, playerId, text, toPersonId, times, now, defer = false, history) {
  const me = personOf(w, playerId);
  if (!me) return "Karakter yok.";
  if (w.players[playerId]?.banned) return "S\xFCrg\xFCndesiniz.";
  const clean2 = filterProfanity(text.replace(/[<>]/g, "").trim()).slice(0, 280);
  if (!clean2) return "Bo\u015F mesaj.";
  if (!rateOk(times, now)) return "\xC7ok h\u0131zl\u0131 yaz\u0131yorsunuz; biraz bekleyin.";
  if (toPersonId && !w.people.some((p) => p.id === toPersonId)) return "Al\u0131c\u0131 yok.";
  const replies = playerSaid(w, me, clean2, toPersonId, now, defer);
  const msg = { id: `${now}-${Math.round(Math.random() * 1e6)}`, fromPersonId: me.id, fromName: me.name, toPersonId, text: clean2, at: now };
  if (defer) msg.replies = replies.map((r) => ({ npcId: r.npc.id, npcName: r.npc.name, to: toPersonId ? me.id : null, fallback: r.fallback, prompt: dmPrompt(w, r.npc, me, clean2, toPersonId ? history ?? [] : [], toPersonId ? r.outcome : "Meydanda konu\u015Fuyorsun"), order: !!r.outcome }));
  return msg;
}
function llmOrder(w, playerId, npcId, raw, text, now) {
  const me = personOf(w, playerId);
  const npc = findPerson(w, npcId);
  if (!me || !npc) return null;
  const o = sanitizeOrder(w, npc, me, raw);
  if (!o) return null;
  const r = handleOrder(w, me, npc, o, text, now);
  return { ok: r.d.ok, reply: r.reply };
}
function talkBatch(w, now) {
  const idx = [];
  (w.talks ?? []).forEach((t, i) => {
    if (!t.ai && t.at && t.at > now - 2e4) idx.push(i);
  });
  const pick3 = idx.slice(-3);
  if (!pick3.length) return null;
  const pairs = pick3.map((i) => ({ a: findPerson(w, w.talks[i].a), b: findPerson(w, w.talks[i].b) })).filter((p) => p.a && p.b);
  if (pairs.length !== pick3.length) return null;
  return { idx: pick3, prompt: talksPrompt(w, pairs) };
}
function applyTalks(w, idx, out, now) {
  idx.forEach((i, k) => {
    const t = w.talks[i];
    const l = out.talks?.[k];
    if (t && Array.isArray(l) && l.length >= 2 && typeof l[0] === "string") {
      t.lines = [String(l[0]).slice(0, 90), String(l[1]).slice(0, 90)];
      t.text = t.lines[0];
      t.ai = true;
    }
  });
  if (typeof out.gossip === "string" && out.gossip.length > 5) {
    const ppl = w.people.filter((p) => !p.playerId && p.prof !== "naip" && p.jailedDays === 0);
    const a = ppl[Math.floor(Math.random() * ppl.length)];
    if (a) w.chatOut.push({ fromPersonId: a.id, fromName: a.name, toPersonId: null, text: `\u{1F5E3} ${out.gossip.slice(0, 200)}`, at: now });
  }
}
function speechBatch(w) {
  const refs = [];
  const lines = [];
  for (const b2 of w.meclis.bills) {
    if (b2.status !== "tartisma" && b2.status !== "oylama") continue;
    b2.speeches.forEach((s, i) => {
      const p = findPerson(w, s.personId);
      if (refs.length < 3 && !s.ai && p && !p.playerId) {
        refs.push([b2.id, i]);
        const f = w.meclis.factions.find((x) => x.id === p.faction);
        lines.push(`${refs.length}. ${p.name} (${PROF_LABEL[p.prof]}, ${f?.name ?? "ba\u011F\u0131ms\u0131z"}) \u2013 teklif: \u201C${b2.title}\u201D \u2013 tavr\u0131: ${/hayır|karşıyız|reddediyoruz/.test(s.text) ? "KAR\u015EI" : /destekliyoruz|evet/.test(s.text) ? "DESTEK" : "\xC7EK\u0130MSER"}`);
      }
    });
  }
  if (!refs.length) return null;
  return { refs, prompt: { system: "Orta\xE7a\u011F-Osmanl\u0131 esintili bir \u015Fehir oyununda Meclis milletvekillerinin k\xFCrs\xFC konu\u015Fmalar\u0131n\u0131 yaz\u0131yorsun. T\xFCrk\xE7e, her biri en fazla 2 k\u0131sa c\xFCmle, karakterine ve tavr\u0131na uygun, ad veya modern kavram uydurma.", user: `${lines.join("\n")}
SADECE JSON d\xF6nd\xFCr: {"konusmalar": ["1. konu\u015Fma", "2. konu\u015Fma", ...]}` } };
}
function applySpeeches(w, refs, out) {
  refs.forEach(([bid, i], k) => {
    const b2 = w.meclis.bills.find((x) => x.id === bid);
    const s = b2?.speeches[i];
    const t = out?.konusmalar?.[k];
    if (s && typeof t === "string" && t.length > 8) {
      s.text = t.slice(0, 220);
      s.ai = true;
    }
  });
}
function judgeRequest(w, caseId) {
  const c = w.cases.find((x) => x.id === caseId);
  return c?.trial?.pending ? judgePrompt(w, c) : null;
}
function judgeReply(w, caseId, out, now) {
  const c = w.cases.find((x) => x.id === caseId);
  if (!c?.trial?.pending) return;
  const last = c.trial.msgs.at(-1)?.text ?? "";
  const rule = judgeRule(w, c, last);
  const score = typeof out?.ikna === "number" && Number.isFinite(out.ikna) ? Math.max(-4, Math.min(4, Math.round(out.ikna))) : rule.score;
  judgeAnswer(w, c, out?.cevap ? String(out.cevap) : rule.reply, score, now, out?.gerekce ? String(out.gerekce) : void 0);
}
function llmBudget(w, today, perDay) {
  w.llm = w.llm ?? { day: "", n: 0, talkAt: 0 };
  if (w.llm.day !== today) {
    w.llm.day = today;
    w.llm.n = 0;
  }
  return w.llm.n < perDay;
}
function llmSpend(w, today, n2 = 1) {
  w.llm = w.llm ?? { day: today, n: 0, talkAt: 0 };
  if (w.llm.day !== today) {
    w.llm.day = today;
    w.llm.n = 0;
  }
  w.llm.n += n2;
}
function admin(w, op) {
  return applyAdmin(w, op);
}
function resetWorld(w, now) {
  const old = w.players;
  const oldPeople = w.people;
  const nw = createWorld(Math.floor(Math.random() * 1e9), now);
  const ids = {};
  const list = Object.values(old).sort((a, b2) => Number(b2.founder) - Number(a.founder));
  for (const pl of list) {
    const p = oldPeople.find((x) => x.id === pl.personId);
    const prof = pl.founder ? "kayzer" : p && PLAYER_PROFS.includes(p.prof) ? p.prof : "hamal";
    const np = joinWorld(nw, pl.playerId, pl.name, prof, !!pl.founder, now);
    ids[pl.playerId] = np.id;
    if (nw.players[pl.playerId]) nw.players[pl.playerId].banned = pl.banned;
  }
  for (const k of Object.keys(w)) delete w[k];
  Object.assign(w, nw);
  return ids;
}
export {
  act,
  admin,
  applySpeeches,
  applyTalks,
  candidates,
  createWorld,
  drainChat,
  filterProfanity,
  heartbeat,
  judgeReply,
  judgeRequest,
  llmBudget,
  llmOrder,
  llmSpend,
  makeChat,
  migrateWorld,
  personOf,
  rateOk,
  register,
  resetWorld,
  speechBatch,
  talkBatch
};
