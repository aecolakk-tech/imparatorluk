import { askConfirm, askText } from './ui/modal';
import { oldWalk, ageText } from './sim/age';
import { ek } from './sim/tr';
import { buildControls, type SlotItem } from './ui/controls';
import { foePos, liveFoes, MELEE_TILES, REACH_SLACK } from './sim/combatpos';
import { weaponInHand, bestWeapon } from './sim/arms';
import { hourMs } from './sim/tick';
import './ui/style.css';
import type { Action, Good, Person, Profession, World } from './sim/types';
import { GOODS } from './sim/types';
import { GOOD_LABEL, MAP_H, MAP_W, PLAYER_PROFS, PROF_LABEL } from './sim/constants';
import { findPerson } from './sim/world';
import { makeBackend } from './backend';
import type { Backend } from './backend/api';
import { MOCK_FOUNDER_EMAIL } from './backend/mock';
import { aim, markSwing } from './ui/v2';
import { tween, shownOr } from './ui/tween';
import { BOW_MAX } from './sim/combat';
import { buildStatic, drawFrame, hitTest, placePeople, T, tapFx, GOSTERGE, type Camera, type Placed } from './ui/map';
import { gostergeModal } from './ui/gosterge';
import type { PlacedAnimal } from './ui/animals';
import { bar, fmt, h, select } from './ui/dom';
import { ic, CREDITS, iconify, installIconify } from './ui/icons';
import { electionCard, avatar, buildingPanel, familyPanel, isyanBar, personCard, type Ctx } from './ui/panels';
import { GUIDE, RULES } from './ui/texts';
import { feedPanel, hudChips, quickPanel } from './ui/life';
import { rulerScreen } from './ui/ruler';
import type { Candidate, ChatMsg } from './server/core';
import { makeSprite, setRuler } from './ui/sprites';
import { SKIN_NAMES, HAIR_COLOR_NAMES, HAIR_STYLES_M, HAIR_STYLES_F, BEARDS, EYE_NAMES, BUILDS, HEIGHTS, CLOTH_NAMES, OUTFITS, HEADS, TERZI_PRICE, BERBER_PRICE, randomLook, lookFromSeeds, type Look } from './sim/look';
import { GOALS } from './sim/goals';
import { season, SEASON_LABEL, ANIMALS, ANIMAL_LABEL, ANIMAL_PRICE, ANIMAL_FEED, FARM_PRICE, BARN, RANKS_N, RANK_INFO, FIEFS, ORG_LABEL, ORG_GOAL, orgGoalProgress, ROLE_LABEL, type OrgRole, type OrgKind, type Rank } from './sim/realm';
import type { GoalId } from './sim/types';
import { weekday, isCuma, trait } from './sim/piety';
import { kidScale, kidHeight, lastKids, SPRITE_SCALE } from './ui/map';
import { rankLabel, displayName } from './sim/career';
import { yearsOf } from './sim/age';
import { DAY_REAL_MIN } from './sim/constants';
import { ambience, installClickSounds, isMuted, setMuted, sfx, musicOn, setMusic, setMusicMood, musicMood } from './ui/sound';
import { needTarget, myPos } from './sim/v16';
import { findPath, WALK_SPEED, walkEnd, doorSpot, distToBuilding, REACH, PERSON_REACH, type Pt } from './sim/move';
import { electionDates, electionPhase } from './sim/tick';
import { CRIME_LABEL } from './sim/ai';
import type { Corpse, CourtCase } from './sim/types';
import { avatar as av2 } from './ui/panels';
import { witnessCandidates, hLabel } from './sim/alibi';
import { inventoryBody, armsShop, personExtras, eventOptions, eventTitle, whatsNewModal, empireNameModal, VERSION, controlsModal } from './ui/v2';
import { AGE, ORIGIN, TEMPER, ageGroupOf, MIN_START_AGE, MAX_START_AGE, type Origin, type Temper } from './sim/profile';
import { DAYS_PER_YEAR, DEATH_START_AGE, DEATH_CERTAIN_AGE } from './sim/constants';

const app = document.getElementById('app')!;
const be: Backend = makeBackend();
let world: World | null = null;
let stat: HTMLCanvasElement | null = null;
const cam: Camera = { x: 22, y: 8, z: 2.5 };
let placed: Placed[] = [];
let selected: string | null = null;
let sheet: HTMLElement | null = null;
let sheetRender: (() => HTMLElement) | null = null;
let hudEl: HTMLElement; let dockEl: HTMLElement;
let msgs: ChatMsg[] = []; let seenMsgs = 0; let dmTarget: string | null = null; let pendingSay: string | null = null;
let skew = 0; // server clock minus client clock, so the map animation never freezes on a wrong local clock
const gameNow = (): number => Date.now() + skew;

function me(): Person | null { const s = be.session(); if (!world || !s) return null; const pl = world.players[s.playerId]; return pl ? findPerson(world, pl.personId) ?? null : null; }
/** v2.0.1: stacked in-game toasts (max 3 visible; the same text is never shown twice at once). */
function toast(text: string, ms = 2600): void {
  if (!text) return; const st = document.querySelector('.toast-stack') ?? (() => { const e = h('div', { class: 'toast-stack' }); app.append(e); return e; })();
  if ([...st.children].some((x) => x.textContent === text)) return;
  while (st.children.length >= 3) st.firstChild!.remove();
  const t = h('div', { class: 'toast' }, text); st.append(t); setTimeout(() => t.classList.add('out'), ms - 300); setTimeout(() => t.remove(), ms);
}
/** Floating action feedback over the map (e.g. +12 D, -5 D). */
function floatText(text: string, cls = ''): void { if (lowGfx) return; const el = h('div', { class: `float-text ${cls}` }, text); document.body.append(el); setTimeout(() => el.remove(), 1300); }

// ---------------- login ----------------
function loginScreen(): void {
  app.replaceChildren();
  let mode: 'giris' | 'kayit' = 'giris';
  let start_: 'yeni' | 'devral' = 'yeni'; let cands: Candidate[] = []; let pickId: string | null = null; let accessVal = '';
  const box = h('div', { class: 'box' });
  const render = (): void => {
    const email = h('input', { type: 'email', autocomplete: 'email' }); const pw = h('input', { type: 'password', autocomplete: mode === 'giris' ? 'current-password' : 'new-password' });
    const access = h('input', { type: 'password', value: accessVal }); access.addEventListener('input', () => { accessVal = access.value; }); const name = h('input', { maxlength: '24' });
    const prof = select(PLAYER_PROFS.map((p): [string, string] => [p, PROF_LABEL[p]]), 'hamal');
    const err = h('div', { style: 'color:#ff8a7a;min-height:20px;margin-top:6px' });
    const go = async (): Promise<void> => {
      err.textContent = '…';
      if (mode === 'kayit' && start_ === 'devral' && !pickId) { err.textContent = 'Önce devralacağınız vatandaşı seçin.'; return; }
      const e = mode === 'giris' ? await be.login(email.value, pw.value) : await be.register(access.value, email.value, pw.value, name.value, prof.value as Profession, start_ === 'devral' ? pickId : null);
      if (e) { err.textContent = e; return; }
      start();
    };
    box.replaceChildren(
      h('h1', { style: 'margin:0;color:#e8c14a' }, '👑 Medieval Empire'),
      h('div', { class: 'muted' }, 'Davetlilere açık, ortak ve hiç durmayan bir dünya.'),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: mode === 'giris' ? 'primary' : '', onclick: () => { mode = 'giris'; render(); } }, 'Giriş'), h('button', { class: mode === 'kayit' ? 'primary' : '', onclick: () => { mode = 'kayit'; render(); } }, 'Davetle kayıt')),
      ...(mode === 'kayit' ? [h('label', {}, 'Davet şifresi (kurucudan alın)'), access,
        h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: start_ === 'yeni' ? 'primary' : '', onclick: () => { start_ = 'yeni'; render(); } }, '🏠 Yeni vatandaş'), h('button', { class: start_ === 'devral' ? 'primary' : '', onclick: () => { start_ = 'devral'; render(); } }, '🧑 Var olan birini devral')),
        ...(start_ === 'yeni' ? [h('label', {}, 'Oyundaki adınız (benzersiz olmalı)'), name, h('div', { class: 'muted' }, 'Hesabı açınca karakter ekranında cinsiyet, soyadı, yaş grubu, köken (başlangıç mesleği, maaşı ve parası) ve mizacınızı seçersiniz. Boş bir evde başlarsınız; ilk 5 gün dokunulmazsınız.')] : devralUi()),
      ] : []),
      h('label', {}, 'E-posta (kimseye gösterilmez)'), email, h('label', {}, 'Hesap şifresi (en az 6)'), pw,
      h('div', { style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => void go() }, mode === 'giris' ? 'Giriş yap' : 'Hesap aç ve katıl')), err,
      be.mode === 'mock' ? h('div', { class: 'muted', style: 'margin-top:8px' }, `Yerel deneme modu (sunucusuz). Davet şifresi: “imparator”. İlk kayıt olan ya da ${MOCK_FOUNDER_EMAIL} kurucu (Kayzer) olur. Başka sekmede ikinci bir hesapla ortak dünyayı deneyebilirsiniz.`) : '',
    );
  };
  function devralUi(): HTMLElement[] {
    const load = async (): Promise<void> => { const r = await be.candidates(accessVal); if (typeof r === 'string') { toast(r); return; } cands = r; pickId = null; render(); };
    if (!cands.length) return [h('button', { style: 'margin-top:8px', onclick: () => void load() }, 'Devralınabilir vatandaşları göster'), h('div', { class: 'muted' }, 'Diğer oyuncuların karakterleri ve (kurucu izin vermedikçe) devlet görevlileri listede yoktur.')];
    const sel = select([['', `— ${cands.length} vatandaştan birini seçin —`], ...cands.map((c): [string, string] => [c.id, `${c.name} · ${c.office}`])], pickId ?? '');
    sel.addEventListener('change', () => { pickId = sel.value || null; render(); });
    const out: HTMLElement[] = [h('label', {}, 'Devralacağınız vatandaş'), sel];
    const c = cands.find((x) => x.id === pickId);
    if (c) {
      const fake = { id: c.id, ...c.sprite } as unknown as Person;
      const cv = h('canvas', { class: 'avatar', width: '16', height: '16' }); cv.getContext('2d')!.drawImage(makeSprite(fake)[0]!, 0, 0);
      out.push(h('div', { class: 'card' }, h('div', { class: 'row' }, cv, h('div', {}, h('b', {}, c.name), h('div', { class: 'muted' }, c.office))),
        h('div', {}, `💭 “${c.thought || '…'}”`),
        h('div', { class: 'muted' }, `Kese ${c.money} D · memnuniyet ${c.mood} · sadakat ${c.loyalty} · sağlık ${c.health} · cumhuriyetçilik ${c.republic}${c.spouse ? ` · eşi ${c.spouse}` : ''}`),
        h('div', { class: 'muted' }, 'Hesabı açınca bu kişinin parası, evi, mesleği ve ilişkileri sizin olur.')));
    }
    return out;
  }
  render();
  app.append(h('div', { class: 'login' }, box));
}

// ---------------- game ----------------
const canvas = h('canvas', { id: 'map' });
const ctx2d = canvas.getContext('2d')!;

function ctx(): Ctx {
  return { w: world!, me: me(), founder: !!be.session()?.founder, act: (a) => void doAct(a), dm: (id) => { dmTarget = id; openChat(); }, openPerson: (id) => openPersonSheet(id), openCitizens: () => openCitizens(), openLook: (mode) => openLook(mode), atSaray: atSaray(), say: (id, text) => { dmTarget = id; pendingSay = text; openChat(); } };
}
let pending: { a: Action; label: string; since: number; retarget: number } | null = null;
let walkTarget: Pt | null = null;
let lowGfx = localStorage.getItem('imp-lowgfx') === '1';
let localWalk: { walk: NonNullable<Person['walk']>; id: string } | null = null; // client-side prediction wins over older server copies
let followCam = true; let lastMoveSent = 0; let moveTimer: ReturnType<typeof setTimeout> | null = null; let moveTo: Pt | null = null;
function atSaray(): boolean { const w = world; const m = me(); const b = w?.buildings.find((x) => x.id === 'saray'); return !!(w && m && b && w.kayzerId === m.id && distToBuilding(b, myPos(w, m, gameNow())) <= REACH + 0.6); }
async function send(a: Action): Promise<void> {
  const before = me()?.money ?? 0; ownActAt = Date.now();
  if (moveTimer && a.t !== 'move' && moveTo) { clearTimeout(moveTimer); moveTimer = null; lastMoveSent = Date.now(); await be.act({ t: 'move', x: moveTo.x, y: moveTo.y }); } // v1.9.3: a throttled move must not land AFTER the action (it pulled you out of the house)
  const r = await be.act(a);
  if (r.msg) toast(r.msg);
  if (r.ok) { await tick(); const d = Math.round(((me()?.money ?? 0) - before) * 10) / 10; if (Math.abs(d) >= 0.5) floatText(`${d > 0 ? '+' : ''}${d} D`, `coin${d < 0 ? ' neg' : ''}`); else floatText('✓'); }
  if (!r.ok && r.msg) sfx('error'); else if (a.t === 'buy' || a.t === 'sell' || a.t === 'give' || a.t === 'borrow' || a.t === 'repay') sfx('coins'); else if (a.t === 'kill' && r.ok) sfx('death'); else if (a.t === 'report' && r.ok) sfx('bell');
  if (!r.ok) await tick(); rerenderSheet(false, true);
}
/** Do an action; if it has to be done somewhere else, walk there first (no teleporting). */
async function doAct(a: Action): Promise<void> {
  const m = me(); if (!world || !m) return send(a);
  const nt = needTarget(world, m, a, gameNow());
  if (nt.ok || !nt.to) { pending = null; return send(a); }
  walkTo(nt.to); pending = { a, label: nt.label ?? '', since: Date.now(), retarget: Date.now() };
  toast(`${nt.label === 'yanına' ? 'Yanına' : nt.label} yürüyorsunuz…`);
}
function walkTo(to: Pt, joy = false): void {
  const w = world; const m = me(); if (!w || !m) return;
  if (m.jailedDays > 0) { toast('Zindandasınız.'); return; }
  const now = gameNow(); const from = myPos(w, m, now);
  m.walk = { path: findPath(w, from, to), t0: now, speed: WALK_SPEED * (m.riding && (m.animals?.at ?? 0) > 0 ? 2 : 1) * oldWalk(w, m) }; // local prediction; the server computes the same path
  localWalk = { walk: m.walk, id: m.id }; followCam = true; if (!lowGfx && !joy) { tapFx.x = to.x; tapFx.y = to.y; tapFx.t = performance.now(); }
  const pl = Object.values(w.players).find((x) => x.personId === m.id); if (pl) pl.lastSeen = Date.now();
  walkTarget = joy ? null : m.walk.path[m.walk.path.length - 1] ?? to;
  // throttle server syncs: at most one move per 400 ms, the last target wins
  moveTo = to;
  const sendMove = (): void => { lastMoveSent = Date.now(); moveTimer = null; void be.act({ t: 'move', x: to.x, y: to.y }); };
  if (moveTimer) clearTimeout(moveTimer);
  const wait = 400 - (Date.now() - lastMoveSent); if (wait <= 0) sendMove(); else moveTimer = setTimeout(sendMove, wait);
}
function pendingStep(): void {
  if (!pending || !world) return; const m = me(); if (!m) return;
  const now = gameNow(); const nt = needTarget(world, m, pending.a, now);
  if (nt.ok) { const a = pending.a; pending = null; walkTarget = null; void send(a); return; }
  if (Date.now() - pending.since > 60_000) { pending = null; toast('Hedefe ulaşılamadı.'); return; }
  // following a person who moves: re-path when my walk has ended
  if (nt.to && m.walk && now > walkEnd(m.walk) && Date.now() - pending.retarget > 1500) { pending.retarget = Date.now(); walkTo(nt.to); }
}
function openSheet(render: () => HTMLElement): void {
  sheetRender = render; rerenderSheet(true);
}
function rerenderSheet(force = false, afterAct = false): void {
  if (!sheetRender) return;
  if (afterAct) { sheetPointer = false; const fa = document.activeElement as HTMLElement | null; if (fa && sheet?.contains(fa)) fa.blur(); } // v2.0.1: an action just finished → always show its result (Elinizde, offers, kese)
  const ae = document.activeElement as HTMLElement | null; // v2.0.1: only typing blocks a refresh (a tapped button kept focus and froze the panel)
  if (!force && sheet && ae && sheet.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) return;
  if (!force && sheetPointer) return;
  const scroll = sheet?.scrollTop ?? 0;
  const s = h('div', { class: 'sheet' }, h('button', { class: 'close icon', title: 'Kapat', onclick: closeSheet }, ic('close')), sheetRender());
  if (sheet) sheet.replaceWith(s); else { s.classList.add('enter'); app.append(s); requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('enter'))); }
  sheet = s; if (!force) s.scrollTop = scroll; document.body.classList.add('has-sheet');
  s.addEventListener('pointerdown', () => { sheetPointer = true; }); s.addEventListener('pointerup', () => { setTimeout(() => { sheetPointer = false; }, 250); }); s.addEventListener('pointercancel', () => { sheetPointer = false; });
  s.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 180); } }, true);
}
let sheetPointer = false;
window.addEventListener('pointerup', () => { setTimeout(() => { sheetPointer = false; }, 250); }); window.addEventListener('pointercancel', () => { sheetPointer = false; }); /* v2.0.1: a drag that ends outside the panel no longer freezes live prices */
function closeSheet(): void { document.body.classList.remove('has-sheet'); sheetPointer = false; if (heldNpc) { const id = heldNpc; heldNpc = null; const p = world ? findPerson(world, id) : null; if (p) p.hold = undefined; void be.act({ t: 'holdNpc', personId: id, on: false } as never); } const s = sheet; if (s) { s.classList.add('leave'); s.style.pointerEvents = 'none'; s.inert = true; setTimeout(() => s.remove(), lowGfx ? 0 : 200); } /* v2.0.1: a closing panel can't take taps (accidental buys) */ sheet = null; sheetRender = null; selected = null; }
function openPersonSheet(id: string): void {
  selected = id;
  openSheet(() => { const p = findPerson(world!, id); if (!p) return h('div', {}, 'Kişi yok.'); const card = personCard(ctx(), p); const x = personExtras(ctx(), p); if (x) card.prepend(x); return card; });
}

function modal(content: HTMLElement, onClose?: () => void): void {
  const m = h('div', { class: 'modal' }); const close = (): void => { m.remove(); onClose?.(); };
  m.append(h('div', { class: 'box' }, content, h('div', { style: 'margin-top:12px;text-align:right' }, h('button', { class: 'primary', onclick: close }, 'Tamam'))));
  app.append(m);
}
function maecenas(text: string | HTMLElement): HTMLElement { return h('div', { class: 'maecenas' }, h('div', { class: 'who' }, '🏛'), h('div', {}, h('b', { style: 'color:#e8c14a' }, 'Maecenas'), typeof text === 'string' ? h('pre', { class: 'summary' }, text) : text)); }

/** v2.0.1: the guide is ONE modal whose text changes in place; the footer (Geri / n of N / İleri) never moves. */
function guide(step = 0, done?: () => void): void {
  const body = h('div', { class: 'guide-body' }); const cnt = h('span', { class: 'muted' });
  const back = h('button', {}, '‹ Geri') as HTMLButtonElement; const next = h('button', { class: 'primary' }, 'İleri ›') as HTMLButtonElement;
  const el = h('div', { class: 'modal guide-modal' }, h('div', { class: 'box guide-box' }, body, h('div', { class: 'guide-foot' }, h('button', { onclick: () => finish() }, 'Geç'), cnt, back, next)));
  const show = (): void => { body.replaceChildren(maecenas(GUIDE[step]!)); body.scrollTop = 0; cnt.textContent = `${step + 1}/${GUIDE.length}`; back.disabled = step === 0; next.textContent = step === GUIDE.length - 1 ? 'Tamam' : 'İleri ›'; };
  const finish = (): void => { localStorage.setItem('imp-guide-done', '1'); el.remove(); done?.(); };
  back.onclick = () => { if (step > 0) { step--; show(); } };
  next.onclick = () => { if (step < GUIDE.length - 1) { step++; show(); } else finish(); };
  show(); app.append(el);
}
// v2.0.1: first-login queue – character → Neler yeni → guide → (then) events and need alerts, ONE modal at a time
let lookSaved = false; let onbOpen = false; let onbDoneSent = false;
function onboarding(): boolean {
  const w = world; const m = me(); const s = be.session();
  if (w && s && !m && w.players[s.playerId]?.dead) { if (!document.querySelector('.funeral-modal')) app.append(funeralModal(w, s.playerId)); return true; }
  if (!w || !m || !s) return false;
  if (lookOpen || onbOpen) return true;
  const next = (): void => { onbOpen = false; setTimeout(() => { onboarding(); }, 50); };
  if ((!m.lookSet || !m.genderSet || (!m.profile?.set && m.prof !== 'kayzer' && m.id !== w.kayzerId)) && !m.npc && !lookSaved) { openLook('ilk'); return true; }
  if (!localStorage.getItem('imp-controls-done')) { onbOpen = true; void be.act({ t: 'onboardPause' } as never); app.append(controlsModal(() => { localStorage.setItem('imp-controls-done', '1'); next(); })); return true; }
  if (!newsShown && w.whatsNew?.[s.playerId] !== VERSION) { newsShown = true; onbOpen = true; app.append(whatsNewModal(() => { void be.act({ t: 'seenNews', v: VERSION } as never); next(); })); return true; }
  if (!localStorage.getItem('imp-guide-done')) { onbOpen = true; guide(0, next); return true; }
  if (!onbDoneSent && (m.onboardUntil ?? 0) > 0) { onbDoneSent = true; void be.act({ t: 'onboardDone' } as never); }
  return false;
}
const anyModal = (): boolean => !!document.querySelector('.modal');
/** v2.0.1 funeral / vasiyet screen: continue as an adult child (who inherits house, sandık, Çanta) or create a new character. */
function funeralModal(w: World, pid: string): HTMLElement {
  const d = w.players[pid]!.dead!; const kids = d.heirs.map((id) => findPerson(w, id)).filter((x): x is Person => !!x && (!x.playerId || x.npc));
  const err = h('div', { style: 'color:#ff8a7a;min-height:18px' }); const name = h('input', { maxlength: '24', placeholder: 'Yeni karakterin adı' }) as HTMLInputElement;
  const done = (r: { ok: boolean; msg: string }): void => { if (!r.ok) { err.textContent = r.msg; return; } el.remove(); lookSaved = false; toast(r.msg); void tick().then(() => onboarding()); };
  const el = h('div', { class: 'modal funeral-modal' }, h('div', { class: 'box parchment' },
    h('h2', {}, '🕯 Vasiyet'), h('div', { class: 'msg' }, `${d.name} ${d.years} yaşında hayatını kaybetti. ${d.text}`),
    kids.length ? h('div', { class: 'stack' }, h('div', {}, 'Hangi çocuğunuzla devam edeceksiniz? Seçtiğiniz çocuk evi, sandığı ve çantayı alır; para yetişkin çocuklar arasında eşit bölündü.'),
      ...kids.map((k) => h('button', { class: 'primary', onclick: () => { void be.act({ t: 'continueAs', childId: k.id } as never).then(done); } }, `${k.female ? '👩' : '👨'} ${k.name} – ${ageText(w, k)}, ${PROF_LABEL[k.prof]}, ${Math.round(k.money)} D`)))
      : h('div', { class: 'stack' }, h('div', {}, '16 yaşını geçmiş çocuğunuz yok. Malınız eşinize (yoksa hazineye) kaldı. Aynı hesapla yeni bir karakter yaratın:'), name,
        h('button', { class: 'primary', onclick: () => { void be.act({ t: 'newCharacter', name: name.value } as never).then(done); } }, 'Yeni karakter oluştur')),
    err));
  return el;
}

const SEASON_IC: Record<string, string> = { ilkbahar: 'spring', yaz: 'summer', sonbahar: 'autumn', kis: 'winter' };
// ---------------- v1.9.7 character creator / Terzi / Berber ----------------
let lookOpen = false;
function openLook(mode: 'ilk' | 'terzi' | 'berber'): void {
  const m0 = me(); const w0 = world; if (!m0 || !w0 || lookOpen) return; lookOpen = true;
  let L: Look = { ...(m0.look ?? lookFromSeeds(m0)) };
  // v2.0.1 creation screen = identity sections (each one a self-contained block, so new fields slot in) + appearance
  const ruler = m0.prof === 'kayzer' || m0.id === w0.kayzerId;
  const needGender = mode === 'ilk' && !m0.genderSet; const needProfile = mode === 'ilk' && !m0.profile?.set && !ruler;
  const fresh = !!m0.profile?.fresh;
  let female: boolean | null = needGender ? (m0.spouse ? m0.female : null) : m0.female;
  const pr: { surname: string; age: number; origin: Origin | null; temper: Temper | null; hard: boolean } = { surname: '', age: 20, origin: null, temper: null, hard: false };
  type Row = [keyof Look, string, string[]];
  const rowsFor = (fem: boolean): Row[] => { const all: Row[] = [['skin', 'Ten rengi', SKIN_NAMES], ['hair', 'Saç modeli', fem ? HAIR_STYLES_F : HAIR_STYLES_M], ['hairColor', 'Saç rengi', HAIR_COLOR_NAMES], ...(fem ? [] : [['beard', 'Sakal / bıyık', BEARDS] as Row]), ['eye', 'Göz rengi', EYE_NAMES], ['build', 'Yapı', BUILDS], ['height', 'Boy', HEIGHTS], ['cloth', 'Kıyafet rengi', CLOTH_NAMES], ['outfit', 'Kıyafet', OUTFITS], ['head', 'Başlık', HEADS]];
    return all.filter(([k]) => mode === 'ilk' || (mode === 'terzi' ? ['cloth', 'outfit', 'head'].includes(k) : ['hair', 'hairColor', 'beard'].includes(k))); };
  const toggles: [keyof Look, string][] = mode === 'berber' ? [] : [['scarf', '🧣 Atkı'], ['belt', '🪢 Kuşak'], ['jewel', '💍 Takı']];
  const prev = h('canvas', { width: '16', height: '16', class: 'look-prev', style: 'width:112px;height:112px;image-rendering:pixelated;background:#3a5a2a;border-radius:10px' }) as HTMLCanvasElement;
  const fem = (): boolean => female ?? m0.female;
  let fr = 0; const draw = (): void => { const g = prev.getContext('2d')!; g.clearRect(0, 0, 16, 16); g.drawImage(makeSprite({ ...m0, female: fem(), id: m0.id + ':prev' + (fem() ? 'f' : 'm'), look: fem() ? { ...L, beard: 0 } : L })[fr]!, 0, 0); };
  const timer = setInterval(() => { if (!prev.isConnected) { clearInterval(timer); return; } fr = 1 - fr; draw(); }, 300);
  const idBox = h('div', { class: 'stack create-id' }); const body = h('div', { class: 'grow' }); const err = h('div', { style: 'color:#ff8a7a;min-height:18px' });
  const choice = <K extends string>(opts: [K, string][], cur: K | null, pick: (k: K) => void, dis?: (k: K) => boolean): HTMLElement => h('div', { class: 'row wrap choice' }, ...opts.map(([k, label]) => { const b = h('button', { class: `sm${cur === k ? ' primary' : ''}`, onclick: () => pick(k) }, label) as HTMLButtonElement; if (dis?.(k)) b.disabled = true; return b; }));
  const wageOf = (prof: Profession): string => { const xs = w0.people.filter((p) => p.prof === prof && !p.playerId); const frac = Math.max(0.25, w0.hour / 24); const avg = xs.length ? xs.reduce((a, p) => a + (p.incomeToday ?? 0), 0) / xs.length / frac : 0;
    return prof === 'tuccar' ? 'maaş yok, ticaretten kazanır (değişken)' : `günde yaklaşık ${Math.max(5, Math.round(avg || ({ ciftci: 12, marangoz: 18, hamal: 11 } as Record<string, number>)[prof] || 10))} D (şehirdeki ortalama ciro)`; };
  const sections: (() => HTMLElement | '')[] = [
    () => mode !== 'ilk' ? '' : h('div', {}, h('h3', {}, 'Cinsiyet *'), m0.spouse && needGender ? h('div', { class: 'muted' }, 'Evlisiniz: evlilik yalnız erkek ile kadın arasında olduğundan cinsiyetiniz eşinizinkinin karşıtıdır.') : '',
      needGender ? choice<'e' | 'k'>([['e', '👨 Erkek'], ['k', '👩 Kadın']], female === null ? null : female ? 'k' : 'e', (k) => { female = k === 'k'; if (female) L = { ...L, beard: 0 }; L = { ...L, hair: 0 }; paint(); draw(); }, (k) => !!m0.spouse && (k === 'k') !== m0.female) : h('div', { class: 'muted' }, m0.female ? '👩 Kadın' : '👨 Erkek')),
    () => !needProfile ? '' : h('div', {}, h('h3', {}, 'Soyadı / aile adı *'), (() => { const i = h('input', { maxlength: '16', value: pr.surname, placeholder: 'ör. Demirci, Karaca' }) as HTMLInputElement; i.addEventListener('input', () => { pr.surname = i.value; }); return i; })(), h('div', { class: 'muted' }, 'Adınızın sonuna eklenir; çocuklarınız, mirasınız ve Tarih Kitabı bu adı taşır.')),
    () => !needProfile ? '' : h('div', {}, h('h3', {}, `Yaş * (${MIN_START_AGE}–${MAX_START_AGE})`), (() => { const r = h('input', { type: 'range', min: String(MIN_START_AGE), max: String(MAX_START_AGE), step: '1', value: String(pr.age), style: 'width:100%' }) as HTMLInputElement; const n = h('b', {}, `${pr.age} yaşında`); const t = h('div', { class: 'muted' }, AGE[ageGroupOf(pr.age)].text);
      r.addEventListener('input', () => { pr.age = Number(r.value); n.textContent = `${pr.age} yaşında`; t.textContent = AGE[ageGroupOf(pr.age)].text; }); return h('div', {}, h('div', { class: 'row' }, h('button', { class: 'sm', onclick: () => { pr.age = Math.max(MIN_START_AGE, pr.age - 1); paint(); } }, '−'), r, h('button', { class: 'sm', onclick: () => { pr.age = Math.min(MAX_START_AGE, pr.age + 1); paint(); } }, '+')), n, t, h('div', { class: 'muted' }, `1 yaş = ${DAYS_PER_YEAR} oyun günü. 65’ten sonra yaşlılık başlar; ${DEATH_START_AGE} yaşından sonra her doğum gününde (yaş − ${DEATH_START_AGE})% ölüm şansı vardır, ${DEATH_CERTAIN_AGE}’de ömür biter.`)); })()),
    () => !needProfile ? '' : h('div', {}, h('h3', {}, 'Köken *'), choice((Object.keys(ORIGIN) as Origin[]).map((k) => [k, ORIGIN[k].label]), pr.origin, (k) => { pr.origin = k; paint(); }),
      pr.origin ? h('div', { class: 'muted' }, fresh ? `Başlangıç mesleği: ${PROF_LABEL[ORIGIN[pr.origin].prof]} – ${wageOf(ORIGIN[pr.origin].prof)}. Başlangıç parası: ${Math.max(5, ORIGIN[pr.origin].money + AGE[ageGroupOf(pr.age)].money)} D. Beceri: ${ORIGIN[pr.origin].skill}. ${ORIGIN[pr.origin].text}` : `Beceri: ${ORIGIN[pr.origin].skill}. (Var olan karakter: mesleğiniz ve paranız değişmez.)`) : ''),
    () => !needProfile ? '' : h('div', {}, h('h3', {}, 'Mizaç *'), choice((Object.keys(TEMPER) as Temper[]).map((k) => [k, TEMPER[k].label]), pr.temper, (k) => { pr.temper = k; paint(); }), pr.temper ? h('div', { class: 'muted' }, TEMPER[pr.temper].text) : ''),
    () => !needProfile || !fresh ? '' : h('div', {}, h('h3', {}, 'Zorluk'), choice([['normal', 'İşçi olarak başla'], ['hard', 'Dilenci olarak başla (zor)']] as [string, string][], pr.hard ? 'hard' : 'normal', (k) => { pr.hard = k === 'hard'; paint(); }),
      h('div', { class: 'muted' }, pr.hard ? 'Zor mod: işsiz, 2 D ile başlarsınız; camide ya da han ahırında yatar, sadaka ve aşevi ile yaşarsınız. 3 gün aç kalmadan 10 D biriktirince İşçi olursunuz.' : 'Kökeninizin mesleğinde İşçi olarak başlarsınız.')),
    // (future identity fields slot in here as one more () => block)
  ];
  const paint = (): void => {
    const keep = idBox.querySelector('input') === document.activeElement;
    idBox.replaceChildren(...sections.map((f) => f()).filter((x): x is HTMLElement => !!x));
    if (keep) (idBox.querySelector('input') as HTMLInputElement | null)?.focus();
    body.replaceChildren(...rowsFor(fem()).map(([k, label, names]) => { const v = Math.min(L[k] as number, names.length - 1); const set = (d: number): void => { L = { ...L, [k]: (v + d + names.length) % names.length }; paint(); draw(); };
      return h('div', { class: 'row look-row' }, h('span', { style: 'width:110px' }, label), h('button', { class: 'sm', onclick: () => set(-1) }, '‹'), h('b', { class: 'grow', style: 'text-align:center' }, `${names[v]} (${v + 1}/${names.length})`), h('button', { class: 'sm', onclick: () => set(1) }, '›')); }),
      toggles.length ? h('div', { class: 'row' }, ...toggles.map(([k, label]) => h('button', { class: `sm${L[k] ? ' primary' : ''}`, onclick: () => { L = { ...L, [k]: !L[k] }; paint(); draw(); } }, label))) : '');
  };
  paint(); draw();
  const price = mode === 'terzi' ? TERZI_PRICE : mode === 'berber' ? BERBER_PRICE : 0;
  const close = (): void => { lookOpen = false; el.remove(); };
  const save = (e: Event): void => {
    if (mode !== 'ilk') { close(); void doAct({ t: 'customize', look: L, where: mode }); return; }
    if (needGender && female === null) { err.textContent = 'Lütfen cinsiyet seçin (Erkek / Kadın).'; return; }
    if (needProfile && (!pr.surname.trim() || !pr.origin || !pr.temper)) { err.textContent = 'Lütfen soyadı, köken ve mizaç seçin.'; return; }
    const act = { t: 'customize', look: fem() ? { ...L, beard: 0 } : L, where: 'ilk', ...(needGender ? { female: !!female } : {}), ...(needProfile ? { profile: { surname: pr.surname.trim(), age: pr.age!, origin: pr.origin!, temper: pr.temper!, hard: pr.hard } } : {}) } as Action;
    const bt = e.currentTarget as HTMLButtonElement; bt.disabled = true; bt.textContent = 'Kaydediliyor…'; err.textContent = '';
    void be.act(act).then((r) => {
      if (!r.ok) { bt.disabled = false; bt.textContent = 'Kaydet'; err.textContent = r.msg || 'Kaydedilemedi.'; return; }
      lookSaved = true; const mm = me(); if (mm) { mm.lookSet = true; mm.genderSet = true; mm.female = fem(); mm.look = act.t === 'customize' ? act.look : L; }
      close(); toast(r.msg || 'Karakteriniz kaydedildi.'); void tick().then(() => onboarding());
    });
  };
  const el = h('div', { class: 'modal look-modal' }, h('div', { class: 'box', style: 'max-height:92vh;overflow:auto' },
    h('h2', {}, mode === 'ilk' ? (m0.lookSet ? '🪪 Karakterinizi tamamlayın' : '🎨 Karakterinizi oluşturun') : mode === 'terzi' ? `🧵 Terzi – yeni kıyafet (${price} D)` : `✂ Berber – saç ve sakal (${price} D)`),
    mode === 'ilk' && m0.lookSet ? h('div', { class: 'muted' }, 'v2.0.1: Her karakter bir kez cinsiyet' + (needProfile ? ', soyadı, yaş, köken ve mizaç' : '') + ' seçer. Paranız ve mesleğiniz değişmez.') : '',
    idBox,
    mode === 'ilk' ? h('h3', {}, 'Görünüm') : '',
    h('div', { class: 'row', style: 'align-items:flex-start;gap:12px' }, h('div', {}, prev, h('div', { class: 'muted', style: 'text-align:center' }, 'canlı önizleme')), body),
    err,
    h('div', { class: 'row' }, mode === 'ilk' ? h('button', { onclick: () => { L = randomLook(Math.random, fem()); paint(); draw(); } }, '🎲 Rastgele görünüm') : '',
      h('button', { class: 'primary', onclick: save }, mode === 'ilk' ? 'Kaydet' : `Öde ve değiştir (${price} D)`),
      mode === 'ilk' ? '' : h('button', { onclick: close }, 'Vazgeç')),
    mode === 'ilk' ? h('div', { class: 'muted' }, '* zorunlu. Bu seçimler ücretsiz ve bir kez yapılır. Sonra kıyafeti Terzi’de (Dokuma Tezgâhı), saç/sakalı Berber’de (Zanaat Atölyesi) para ile değiştirebilirsiniz.') : ''));
  app.append(el);
}
(window as unknown as { __openLook: typeof openLook }).__openLook = openLook;
function renderHud(): void {
  const w = world; if (!w) return; const m = me(); setRuler(w.kayzerId);
  const k = findPerson(w, w.kayzerId); const ruler = !!m && w.kayzerId === m.id;
  const chips = hudChips(ctx()); // [clock, meals, water, health, mood, din, ...events]
  const events = chips.slice(m ? 6 : 1);
  const night = w.hour < 6 || w.hour >= 21;
  const chip = (icon: string, text: string, tip: string, cls = ''): HTMLElement => h('span', { class: `stat${cls ? ' ' + cls : ''}`, title: tip, onclick: () => toast(tip) }, ic(icon), h('span', {}, text));
  hudEl.replaceChildren(
    h('div', { class: 'hud-l' },
      chip(night ? 'moon' : 'sun', `${weekday(w.day)} · Gün ${w.day} · ${String((w.hour + Math.max(0, Math.min(23, Math.floor((gameNow() - w.lastTickAt) / hourMs(w))))) % 24).padStart(2, '0')}:00${w.speed !== 1 ? ` · ${w.combat ? '🐢 ' : ''}${w.speed}x` : ''}`, `${weekday(w.day)}${isCuma(w.day) ? ' (Cuma namazı 13:00)' : ''} · 1 oyun günü = ${DAY_REAL_MIN} gerçek dakika (1x; gündüz 1 saat = 60 sn, gece 30 sn)${w.speed !== 1 ? ` · şu an ${w.speed}x${w.combat ? ' (saldırı sırasında otomatik yavaş)' : ''}` : ''}`, w.combat ? 'warn' : ''),
      chip(SEASON_IC[season(w)]!, SEASON_LABEL[season(w)].replace(/^\S+\s/, ''), 'Mevsim'),
      ...(m ? [
        meterI('heart', m.health, 'var(--red)', `❤️ Sağlık${m.wounded ? ' – yaralısınız, hekime gidin' : ' – hastalık/yara düşürür, hekim ve dinlenme iyileştirir'}`, m.health < 40 || m.wounded, 'hp'),
        meterI('bread', 100 - m.hunger, 'var(--gold)', `🍞 Tokluk ${Math.round(100 - m.hunger)}/100 (100 = tok, 0 = çok aç). Saatte ~4 azalır. Çanta’dan ya da Fırın/Pazar’da yiyin`, m.hunger >= 85, 'hunger'),
        meterI('water', 100 - m.thirst, 'var(--blue)', `💧 Su ${Math.round(100 - m.thirst)}/100 (100 = susuz değilsiniz, 0 = çok susuz). Saatte ~3,5 azalır. Çanta’dan ya da Kuyu/Pazar’da için`, m.thirst >= 85, 'thirst'),
        meterI('moon', m.energy ?? 80, '#b59cf0', `🌙 Enerji (uyku) ${Math.round(m.energy ?? 80)}/100 – dışarıda saatte 4 düşer; evinizde dinlenince/uyuyunca dolar. 15’in altında mutluluğunuz düşer.`, (m.energy ?? 80) < 15, 'energy'),
        h('span', { class: 'stat', title: 'Keseniz – dokunun: kese geçmişi', onclick: () => openPurse() }, ic('coin'), h('span', {}, `${m.money.toFixed(2)} D`)),
      ] : []),
      ruler ? chip('castle', fmt(w.treasury), 'Hazine') : '',
      ruler && w.regime === 'imparatorluk' ? chip('banner', String(Math.round(w.cumhuriyet)), 'Cumhuriyet isteği', w.cumhuriyet > 50 ? 'warn' : '') : '',
      !ruler ? chip('crown', w.regime === 'cumhuriyet' ? (k?.name ?? 'seçim') : (k?.name ?? 'Naip'), 'Devletin başı') : '',
      m?.infected ? h('span', { class: 'stat warn pulse', title: 'Salgına yakalandınız', onclick: () => { toast('🦠 Hastasınız! Her saat can kaybediyorsunuz ve yakınınızdakilere bulaştırırsınız. Hekimhane’ye gidip tedavi olun.'); const b = world?.buildings.find((x) => x.id === 'hekimhane'); if (b) { walkTo(doorSpot(b)); openSheet(() => bPanel(b)); } } }, '🦠 Hastasınız → Hekim') : '',
      m?.drawn ? h('span', { class: 'stat warn', title: 'Çekili silah', onclick: () => void send({ t: 'drawWeapon', kind: null }) }, `⚔ ${({ hancer: 'Hançer', kilic: 'Kılıç', yay: 'Yay' } as Record<string, string>)[m.drawn]} çekili (kınına koy)`) : '',
      w.empireName ? chip('crown', w.empireName, 'Devletin adı') : '',
      ...events.slice(0, 1)),
    h('div', { class: 'hud-r' },
      ruler ? h('span', { class: 'speed seg', title: 'Oyun hızı (Kayzer, her yerden)' }, ...[0.5, 1, 2].map((s) => h('button', { class: `mini${w.speed === s ? ' on' : ''}`, onclick: () => { void send({ t: 'setSpeed', speed: s }); } }, `${s === 0.5 ? '½' : s}x`))) : '',
      h('button', { class: `mini icon${musicOn() ? ' on' : ''}`, title: musicOn() ? 'Müziği kapat' : 'Müziği aç', onclick: () => { setMusic(!musicOn()); renderHud(); } }, ic('music')),
      h('button', { class: 'mini icon', title: isMuted() ? 'Sesi aç' : 'Sesi kapat', onclick: () => { setMuted(!isMuted()); renderHud(); } }, ic(isMuted() ? 'mute' : 'sound'))),
  );
  const ib = isyanBar(ctx()); if (ib) hudEl.append(ib);
  iconify(hudEl); if (!anyModal() && !lookOpen && !onbOpen) needAlerts(m);
}
function meterI(icon: string, v: number, color: string, tip: string, warn: boolean, key: string): HTMLElement {
  return h('span', { class: `stat meter${warn ? ' warn' : ''}${flashKey === key && performance.now() < flashUntil ? ' flash' : ''}`, title: tip, 'data-k': key, 'data-v': String(v), onclick: () => toast(tip) }, ic(icon), bar(shownOr(`hud-${key}`, v), color, `hud-${key}`));
}
// v2.0.1: warnings for tokluk, su, sağlık below 30 and a nearly empty purse – one popup per crossing (re-armed above 40), never two at once
let flashKey = ''; let flashUntil = 0; const alarmArmed: Record<string, boolean> = { hunger: true, thirst: true, health: true, money: true }; const alarmAt: Record<string, number> = { hunger: -1e9, thirst: -1e9, health: -1e9, money: -1e9 };
const ALARM_TITLE: Record<string, string> = { hunger: 'Tokluk düşük', thirst: 'Su düşük', health: 'Sağlık düşük', money: 'Kese boşalıyor' };
function needAlerts(m: ReturnType<typeof me>): void {
  if (!m) return; if (document.querySelector('.alert-pop')) return;
  const vals: [string, number, number, number, string, string][] = [
    ['hunger', 100 - m.hunger, 30, 40, 'bread', `Tokluk ${Math.round(100 - m.hunger)}/100 – açsınız, bir şeyler yiyin (Çanta ya da Pazar).`],
    ['thirst', 100 - m.thirst, 30, 40, 'water', `Su ${Math.round(100 - m.thirst)}/100 – susadınız, su için (Kuyu, Çanta).`],
    ['health', m.health, 30, 40, 'heart', `Sağlık ${Math.round(m.health)}/100 – hekime gidin ya da dinlenin${m.hunger > 70 || m.thirst > 70 ? '; önce yiyip için' : ''}.`],
    ['money', m.money, 3, 6, 'coin', `Kesede ${m.money.toFixed(2)} D kaldı – İş İlanı Tahtası’ndan iş bulun; aç kalırsanız cami aşevi ücretsiz çorba verir.`]];
  for (const [key, v, lo, re, icon, msg] of vals) {
    if (v > re) alarmArmed[key] = true;
    if (v < lo && alarmArmed[key] && performance.now() - alarmAt[key]! > 90_000) {
      alarmArmed[key] = false; alarmAt[key] = performance.now(); flashKey = key; flashUntil = performance.now() + 4000;
      alertPop(icon, msg, key); try { navigator.vibrate?.([180, 90, 180]); } catch { /* not supported */ }
      sfx('error'); setTimeout(renderHud, 4100); return; // one warning at a time
    }
  }
}
function alertPop(icon: string, text: string, key: string): void {
  document.querySelector('.alert-pop')?.remove();
  const el = h('div', { class: `alert-pop ${key}`, role: 'alert' }, h('span', { class: 'big' }, ic(icon)), h('div', { class: 'grow' }, h('b', {}, ALARM_TITLE[key] ?? ''), h('div', {}, text)),
    key === 'hunger' || key === 'thirst' ? h('button', { class: 'primary sm', onclick: () => { el.remove(); void send({ t: key === 'hunger' ? 'eat' : 'drinkWater' } as never); } }, key === 'hunger' ? 'Ye' : 'Su iç') : '', h('button', { class: 'sm', onclick: () => el.remove() }, ic('close')));
  document.body.append(el); setTimeout(() => el.classList.add('out'), 7000); setTimeout(() => el.remove(), 7600);
}

// ---------------- one menu with sections ----------------
type Section = 'canta' | 'yap' | 'hedef' | 'cemiyet' | 'soylu' | 'ben' | 'mesaj' | 'divan' | 'aile' | 'gazete' | 'ayar' | 'saray' | 'meclis' | 'tarih' | 'olay' | 'kural';
let section: Section = (localStorage.getItem('imp-sec') as Section) || 'yap';
function badges(): Partial<Record<Section, number>> {
  const w = world; const m = me(); if (!w || !m) return {};
  const unread = Math.max(0, msgs.length - seenMsgs);
  return { yap: w.offers.filter((o) => o.to === m.id).length + w.arrests.filter((a) => a.status === 'bekliyor' && (a.criminalId === m.id || a.catcherId === m.id)).length, mesaj: unread,
    divan: w.kayzerId === m.id ? w.petitions.filter((p) => p.status === 'bekliyor').length : 0, aile: w.proposals.filter((x) => x.to === m.id).length };
}
function renderDock(): void {
  const b = badges(); const total = Object.values(b).reduce((x, y) => x + (y ?? 0), 0);
  dockEl.replaceChildren(h('button', { class: 'menu-btn', title: 'Yer bul', onclick: () => openPlaces() }, '📍', h('span', {}, 'Yer bul')), h('button', { class: 'primary menu-btn', onclick: () => openMenu(section) }, ic('menu'), h('span', {}, 'Menü'), total ? h('span', { class: 'badge' }, String(total)) : ''));
}
function openMenu(sec: Section): void {
  section = sec; localStorage.setItem('imp-sec', sec); if (sec === 'mesaj') seenMsgs = msgs.length;
  selected = null;
  openSheet(() => {
    const w = world!; const m = me(); const ruler = !!m && w.kayzerId === m.id; const b = badges();
    const tabs: [Section, string, string][] = [['yap', 'bolt', 'Yap'], ['canta', 'bag', 'Çanta'], ['ben', 'person', 'Ben'], ['hedef', 'goal', 'Hedef'], ['cemiyet', 'candle', 'Cemiyet'], ...(ruler ? [['soylu', 'noble', 'Soylular'] as [Section, string, string], ['divan', w.regime === 'cumhuriyet' ? 'banner' : 'crown', w.regime === 'cumhuriyet' ? 'Makam' : 'Divan'] as [Section, string, string]] : []), ...(m?.meclis ? [['meclis', 'scales', 'Meclis'] as [Section, string, string]] : []), ['mesaj', 'talk', 'Mesaj'], ['aile', 'family', 'Aile'], ['gazete', 'scroll', 'Haberler'], ['ayar', 'cog', 'Ayarlar']];
    if (!tabs.some((t) => t[0] === section)) section = 'yap';
    const bar_ = h('div', { class: 'tabs' }, ...tabs.map(([id, icon, label]) => h('button', { class: `tab${section === id ? ' on' : ''}`, onclick: () => openMenu(id) }, ic(icon), h('span', {}, label), b[id] ? h('span', { class: 'badge' }, String(b[id])) : '')));
    let body: HTMLElement;
    switch (section) {
      case 'yap': { body = quickPanel(ctx()); const mm = me(); if (mm && (mm.inv.sut > 0 || mm.inv.yumurta > 0)) body.append(h('div', { class: 'row' }, mm.inv.sut > 0 ? h('button', { onclick: () => void send({ t: 'drinkMilk' }) }, ic('milk'), ` Süt iç (${mm.inv.sut})`) : '', mm.inv.yumurta > 0 ? h('button', { onclick: () => void send({ t: 'eatEgg' }) }, ic('egg'), ` Yumurta ye (${mm.inv.yumurta})`) : '')); if (mm && mm.home && mm.home.startsWith('ev')) body.append(h('div', { class: 'row' }, h('button', { onclick: () => void doAct({ t: 'goHome', sleep: true }) }, ic('moon'), ' Eve git, uyu'))); else if (mm && !mm.home) body.append(h('div', { class: 'card muted' }, 'Eviniz yok. Boş yeri olan bir eve dokunun: yer satın alın ya da kiralayın.'));
        if ((mm?.animals?.at ?? 0) > 0) body.append(mm!.riding ? h('div', { class: 'row' }, h('button', { onclick: () => void send({ t: 'ride', on: false }) }, ic('horse'), ' Attan in')) : h('div', { class: 'muted' }, 'Ata binmek için haritada atınıza (üstünde mavi işaret) dokunun.')); break; }
      case 'canta': body = inventoryBody(ctx()); break;
      case 'ben': body = m ? personCard(ctx(), m) : h('div', {}, '—'); break;
      case 'mesaj': body = chatBody(); break;
      case 'hedef': body = goalsBody(); break;
      case 'cemiyet': body = orgsBody(); break;
      case 'soylu': body = ruler ? noblesBody() : h('div', {}, '—'); break;
      case 'tarih': body = historyBody(); break;
      case 'divan': body = ruler ? rulerScreen(ctx()) : h('div', {}, '—'); break;
      case 'saray': body = bPanel(w.buildings.find((x) => x.id === 'saray')!); break;
      case 'meclis': body = buildingPanel(ctx(), w.buildings.find((x) => x.id === 'meclis')!); break;
      case 'aile': body = familyPanel(ctx()); break;
      case 'gazete': body = h('div', { class: 'stack' }, gazetteBody(), h('details', {}, h('summary', {}, 'Son olaylar'), feedPanel(ctx())), h('details', {}, h('summary', {}, 'Tarih Kitabı'), historyBody())); break;
      case 'olay': body = feedPanel(ctx()); break;
      case 'kural': body = h('div', {}, h('h2', {}, '📖 Kurallar ve kullanım'), ...RULES.flatMap(([t, ls]) => [h('details', {}, h('summary', {}, t), ...ls.map((l) => h('div', { class: 'msg' }, l)))])); break;
      default: body = h('div', { class: 'stack' }, h('h2', {}, 'Ayarlar'),
        h('div', { class: 'row' }, h('button', { onclick: () => { lowGfx = !lowGfx; localStorage.setItem('imp-lowgfx', lowGfx ? '1' : '0'); document.body.classList.toggle('low', lowGfx); dispatchEvent(new Event('resize')); rerenderSheet(true); } }, lowGfx ? 'Düşük grafik: AÇIK' : 'Düşük grafik: kapalı'), h('button', { onclick: () => { closeSheet(); guide(0); } }, 'Rehber')),
        be.session()?.founder ? h('button', { onclick: openAdmin }, 'Kurucu paneli') : '',
        h('div', { class: 'row' }, h('button', { onclick: () => app.append(whatsNewModal(() => undefined)) }, `✨ Neler yeni? (${VERSION})`), be.session()?.founder || world?.kayzerId === me()?.id ? h('button', { onclick: () => app.append(empireNameModal(nameSend, world?.empireName)) }, '👑 Devletin adını değiştir') : ''),
        h('h3', {}, 'Kurallar ve kullanım'), ...RULES.map(([t, ls]) => h('details', {}, h('summary', {}, t), ...ls.map((l) => h('div', { class: 'msg' }, l)))),
        h('h3', {}, 'Emeği geçenler'), h('div', { class: 'muted' }, CREDITS),
        h('div', {}, h('button', { class: 'danger', onclick: () => { void be.logout().then(loginScreen); } }, 'Çıkış')));
    }
    return h('div', {}, bar_, body);
  });
}

function bPanel(b: import('./sim/types').Building): HTMLElement {
  const box = buildingPanel(ctx(), b);
  if (b.id === 'saray' || b.id === 'okul') box.append(h('button', { onclick: () => openSheet(historyBody) }, '📖 Tarih Kitabı’nı oku'));
  if (b.id === 'ciftlik') box.append(farmBody());
  if (b.id === 'hayvan') box.append(animalMarketBody());
  { const x = armsShop(ctx(), b); if (x) box.prepend(x); }
  return box;
}
function historyBody(): HTMLElement {
  const w = world!; const box = h('div', {}, h('h2', {}, '📖 Tarih Kitabı'), h('div', { class: 'muted' }, 'Saltanatlara göre şehrin büyük olayları (kanunlar, savaşlar, isyanlar, evlilikler, ölümler, seçimler, unvanlar).'));
  const hist = w.history ?? []; if (!hist.length) { box.append(h('div', { class: 'muted' }, 'Henüz yazılmış bir şey yok.')); return box; }
  const reigns: string[] = []; for (const e of hist) if (!reigns.includes(e.reign)) reigns.push(e.reign);
  const icon: Record<string, string> = { kanun: '📜', isyan: '🔥', evlilik: '💍', olum: '⚰', secim: '🗳', savas: '⚔', dogum: '👶', doga: '🌾', unvan: '⚜', orgut: '🕯', entrika: '🕵', baslangic: '📖' };
  for (const r of [...reigns].reverse()) { const es = hist.filter((e) => e.reign === r); box.append(h('details', { open: r === reigns[reigns.length - 1] ? '' : null } as never, h('summary', {}, `👑 ${r} (gün ${es[0]!.day}–${es[es.length - 1]!.day}, ${es.length} olay)`), ...[...es].reverse().slice(0, 150).map((e) => h('div', { class: 'msg' }, `${icon[e.kind] ?? '•'} Gün ${e.day}: ${e.text}`)))); }
  return box;
}
function orgsBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', {}, h('h2', {}, '🕯 Gizli cemiyetler')); if (!m) return box;
  const mine = (w.orgs ?? []).find((o) => o.members.includes(m.id)); const ruler = w.kayzerId === m.id;
  box.append(h('div', { class: 'muted' }, 'Hırsızlar loncası, cumhuriyet cemiyeti ya da tarikat kurun veya katılın. Büyüdükçe ve gece toplandıkça şüphe artar: muhbirler, casuslar, baskınlar, ev aramaları ve sorgular sizi ele verebilir.'));
  if (mine) {
    const ld = mine.leaderId === m.id;
    box.append(h('div', { class: 'card' }, h('b', {}, `${ORG_LABEL[mine.kind]} – “${mine.name}”`), h('div', {}, `Lider: ${findPerson(w, mine.leaderId)?.name ?? '—'} · ${mine.members.length} üye · şüphe `, bar(mine.suspicion, '#c8483a'), ` ${Math.round(mine.suspicion)}${mine.known ? ' · ⚠️ Saray biliyor!' : ''}`),
      h('div', {}, `🎯 Hedef: ${ORG_GOAL[mine.kind]} `, bar(orgGoalProgress(w, mine), '#6fbf73'), ` %${Math.round(orgGoalProgress(w, mine))}${mine.kind === 'hirsiz' ? ` · kasa ${Math.round(mine.funds ?? 0)} D` : ''}`),
      h('h3', {}, 'Üyeler ve roller'),
      ...mine.members.map((id) => { const p = findPerson(w, id); if (!p) return ''; const r = mine.roles?.[id] ?? (id === mine.leaderId ? 'lider' : 'uye');
        const sel = ld && id !== m.id ? select((['yardimci', 'propagandaci', 'casus', 'uye'] as OrgRole[]).map((x): [string, string] => [x, ROLE_LABEL[x]])) : null; if (sel) { sel.value = r; sel.onchange = () => void send({ t: 'orgRole', personId: id, role: sel.value as OrgRole }); }
        return h('div', { class: 'row member' }, h('span', { class: 'grow', style: 'cursor:pointer', onclick: () => openPersonSheet(id) }, `${p.name} · ${PROF_LABEL[p.prof]}${p.jailedDays > 0 ? ' · zindanda' : ''}`), sel ?? h('span', { class: 'pill' }, ROLE_LABEL[r])); }),
      h('div', { class: 'muted' }, 'Yeni üye: birine 1 adım yaklaşın, kartından “Cemiyete davet et” deyin (yanına para da koyabilirsiniz). Üyeleriniz de tanıdıklarını kazanmaya çalışır.'),
      h('h3', {}, 'Eylemler'),
      h('div', { class: 'row' }, h('button', { onclick: () => void send({ t: 'orgAct', deed: 'propaganda' }) }, 'Propaganda (5 D)'),
        mine.kind === 'hirsiz' ? h('button', { onclick: () => void send({ t: 'orgAct', deed: 'hirsizlik' }) }, 'Zengini soy') : h('button', { onclick: () => void send({ t: 'orgAct', deed: 'sabotaj' }) }, 'Sabotaj'),
        mine.kind !== 'hirsiz' ? h('button', { class: 'danger', onclick: () => { void askConfirm('Ayaklanma başlatılsın mı? Geri dönüşü yok.').then((yes) => { if (yes) void send({ t: 'orgAct', deed: 'ayaklanma' }); }); } }, 'Ayaklanma') : '',
        ld ? h('button', { onclick: () => void send({ t: 'orgMeet' }) }, 'Gece toplantısı') : '', h('button', { class: 'danger', onclick: () => void send({ t: 'orgLeave' }) }, 'Ayrıl'))));
  } else if (!ruler) {
    const kind = select((Object.keys(ORG_LABEL) as OrgKind[]).map((k): [string, string] => [k, ORG_LABEL[k]])); const nm = h('input', { placeholder: 'Örgütün adı' });
    box.append(h('h3', {}, 'Kur'), h('div', { class: 'row' }, kind, nm, h('button', { class: 'primary', onclick: () => void send({ t: 'orgFound', kind: kind.value as OrgKind, name: nm.value }) }, 'Kur')));
    const heard = (w.orgs ?? []).filter((o) => o.members.some((id) => (findPerson(w, id)?.relations[m.id] ?? 0) > 10) || o.known);
    box.append(h('h3', {}, 'Fısıltıyla duyduklarınız'), ...(heard.length ? heard.map((o) => h('div', { class: 'card row' }, h('span', { class: 'grow' }, `${ORG_LABEL[o.kind]} – “${o.name}” (${o.members.length} üye)`), h('button', { onclick: () => void send({ t: 'orgJoin', orgId: o.id }) }, 'Katıl'))) : [h('div', { class: 'muted' }, 'Kimse size bir şey fısıldamadı. Dost edinin.')]));
  }
  if (ruler) {
    const known = (w.orgs ?? []).filter((o) => o.known);
    box.append(h('h3', {}, '🕵 Saray’ın bildikleri'), ...(known.length ? known.map((o) => h('div', { class: 'card' }, h('b', {}, `${ORG_LABEL[o.kind]} – “${o.name}”`), h('div', { class: 'muted' }, `Bilinen üyeler: ${o.knownMembers.map((id) => findPerson(w, id)?.name).filter(Boolean).join(', ') || '—'}`), h('button', { class: 'danger', onclick: () => void doAct({ t: 'raidOrg', orgId: o.id }) }, '⚔ Askerlerle baskın (emir)'))) : [h('div', { class: 'muted' }, 'Bilinen gizli örgüt yok. Casus atayın, muhbir ödülü koyun.')]));
  }
  return box;
}
function noblesBody(): HTMLElement {
  const w = world!; const box = h('div', {}, h('h2', {}, '⚜ Soylular, casuslar ve adalet'));
  const nobles = w.people.filter((p) => p.rank);
  box.append(h('div', { class: 'muted' }, RANKS_N.map((r) => `${r}: ${RANK_INFO[r].stipend} D/gün – ${RANK_INFO[r].duty}`).join(' · ')));
  box.append(h('h3', {}, 'Unvanlılar'), ...(nobles.length ? nobles.map((p) => h('div', { class: 'card row' }, h('span', { class: 'grow' }, `${p.rank} ${p.name}${p.fief ? ` · tımar: ${w.buildings.find((b) => b.id === p.fief)?.name}` : ''} · gözde `, bar(p.favor ?? 50, '#e8c14a'), ` · sadakat ${Math.round(p.loyalty)}`), h('button', { class: 'danger', onclick: () => void doAct({ t: 'stripTitle', personId: p.id }) }, 'Unvanı al'))) : [h('div', { class: 'muted' }, 'Henüz unvan verilmedi.')]));
  const cand = w.people.filter((p) => p.prof !== 'naip' && p.id !== w.kayzerId).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const who = select(cand.map((p): [string, string] => [p.id, `${p.name} (${PROF_LABEL[p.prof]})`])); const rk = select(RANKS_N.map((r): [string, string] => [r, r])); const ff = select([['', 'Tımar (Bey için)'], ...FIEFS.map((f): [string, string] => [f, w.buildings.find((b) => b.id === f)?.name ?? f])]);
  box.append(h('h3', {}, 'Unvan ver'), h('div', { class: 'row' }, who, rk, ff, h('button', { class: 'primary', onclick: () => void doAct({ t: 'grantTitle', personId: who.value, rank: rk.value as Rank, fief: ff.value || null }) }, 'Ver')));
  const spy = select(cand.filter((p) => !p.playerId || p.npc).map((p): [string, string] => [p.id, p.name])); const tgt = select(cand.map((p): [string, string] => [p.id, p.name]));
  box.append(h('h3', {}, '🕵 Casus ata (5 gün, 15 D)'), h('div', { class: 'row' }, spy, '→', tgt, h('button', { onclick: () => void doAct({ t: 'assignSpy', spyId: spy.value, targetId: tgt.value }) }, 'İzlet')),
    h('div', { class: 'muted' }, `Aktif casuslar: ${(w.spies ?? []).map((s) => `${findPerson(w, s.spyId)?.name} → ${findPerson(w, s.targetId)?.name}`).join(', ') || '—'}`));
  const wt = select(cand.map((p): [string, string] => [p.id, p.name]));
  box.append(h('h3', {}, '📜 Arama emri'), h('div', { class: 'row' }, wt, h('button', { onclick: () => void doAct({ t: 'warrant', personId: wt.value }) }, 'Emir çıkar'), h('button', { onclick: () => void doAct({ t: 'searchHouse', personId: wt.value }) }, '🔎 Evi ara (bekçilerle)')),
    h('div', { class: 'muted' }, `Bekleyen emirler: ${(w.warrants ?? []).map((id) => findPerson(w, id)?.name).join(', ') || '—'}`));
  const pay = h('input', { type: 'number', value: String(w.informantPay ?? 0), style: 'width:80px' });
  box.append(h('h3', {}, '🗝 Muhbir ödülü'), h('div', { class: 'row' }, pay, h('button', { onclick: () => void doAct({ t: 'informantPay', amount: Number(pay.value) }) }, 'İlan et')));
  return box;
}
function animalMarketBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', { class: 'stack' }, h('h3', {}, ic('cow'), ' Hayvan Pazarı')); if (!m) return box;
  const seller = w.people.find((p) => p.prof === 'hayvanci');
  box.append(h('div', { class: 'muted' }, `${seller ? `Tüccar: ${seller.name}. ` : ''}Hayvanlar ağılda; aldığınız hayvan çiftliğinize gider.`));
  box.append(h('table', { class: 'prices' }, ...ANIMALS.map((a) => h('tr', {}, h('td', {}, ic(ANIMAL_ICON[a]!), ' ', ANIMAL_LABEL[a]), h('td', {}, `${ANIMAL_PRICE[a]} D`), h('td', { class: 'muted' }, ANIMAL_INFO[a]), h('td', {}, h('button', { class: 'sm', onclick: () => void doAct({ t: 'buyAnimal', animal: a }) }, 'Satın al'))))));
  if (!m.farm) box.append(h('button', { class: 'primary', onclick: () => void doAct({ t: 'buyFarm' }) }, ic('farm'), ` Çiftlik arsası al (${FARM_PRICE} D)`));
  return box;
}
function farmBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', { class: 'stack' }, h('h3', {}, ic('farm'), ' Çiftliğiniz')); if (!m) return box;
  if (!m.farm) { box.append(h('div', { class: 'muted' }, 'Çiftliğiniz yok. Hayvan Pazarı’ndan bir arsa alın.')); return box; }
  const hd = m.animals ?? { inek: 0, koyun: 0, tavuk: 0, at: 0 }; const bn = m.barn ?? { ahir: 0, kumes: 0 };
  const feed = Math.ceil(ANIMALS.reduce((s, a) => s + hd[a] * ANIMAL_FEED[a], 0)); const st = m.farmStock ?? {};
  box.append(h('div', { class: 'chips' }, ...ANIMALS.map((a) => h('span', { class: 'chip' }, ic(ANIMAL_ICON[a]!), ` ${hd[a]}`)), h('span', { class: 'chip' }, `Ahır ${bn.ahir} · Kümes ${bn.kumes}`)));
  box.append(h('div', { class: 'row' }, h('button', { onclick: () => void doAct({ t: 'buildBarn', kind: 'ahir' }) }, `Ahır yap (${BARN.ahir.cost} D)`), h('button', { onclick: () => void doAct({ t: 'buildBarn', kind: 'kumes' }) }, `Kümes yap (${BARN.kumes.cost} D)`)));
  box.append(h('div', { class: 'row' }, h('button', { class: m.fedDay === w.day ? '' : 'primary', disabled: feed === 0 || m.fedDay === w.day, onclick: () => void doAct({ t: 'feedAnimals' }) }, m.fedDay === w.day ? 'Bugün beslendi' : `Yem ver (${feed} buğday)`),
    h('button', { onclick: () => void doAct({ t: 'collectFarm' }) }, `Topla (süt ${st.sut ?? 0} · yumurta ${st.yumurta ?? 0} · yün ${st.yun ?? 0})`)));
  const kill = ANIMALS.filter((a) => a !== 'at' && hd[a] > 0); if (kill.length) box.append(h('div', { class: 'row' }, ...kill.map((a) => h('button', { class: 'danger sm', onclick: () => { void askConfirm(`${ANIMAL_LABEL[a]} kesilsin mi?`).then((yes) => { if (yes) void doAct({ t: 'slaughter', animal: a }); }); } }, `${ANIMAL_LABEL[a]} kes`))));
  return box;
}
const ANIMAL_ICON: Record<string, string> = { inek: 'cow', koyun: 'sheep', tavuk: 'chicken', at: 'horse' };
const ANIMAL_INFO: Record<string, string> = { inek: '3 süt/gün · 8 et', koyun: 'yün · 4 et', tavuk: '1 yumurta/gün', at: 'binek: %50 hızlı' };
function goalsBody(): HTMLElement {
  const w = world!; const m = me(); const box = h('div', {}, h('h2', {}, '🎯 Hedefler ve görevler')); if (!m) return box;
  const ruler = w.kayzerId === m.id;
  if (!ruler) {
    if (m.goal) { const g = GOALS[m.goal]; const pr = Math.round(g.progress(w, m) * 100); box.append(h('div', { class: 'card' }, h('b', {}, g.label), h('div', { class: 'muted' }, g.desc), bar(pr, '#e8c14a'), h('small', {}, ` %${pr}`), h('div', { class: 'muted' }, `Ödül: “${g.title}” unvanı${g.reward ? ` + ${g.reward} Dinar` : ' + isyanda önderlik'}`))); }
    box.append(h('h3', {}, m.goal ? 'Hedefi değiştir' : 'Kişisel hedef seç'), h('div', { class: 'row' }, ...(Object.keys(GOALS) as GoalId[]).filter((g) => !(m.goalsDone ?? []).includes(g)).map((g) => h('button', { class: m.goal === g ? 'primary' : '', onclick: () => void send({ t: 'setGoal', goal: g }) }, GOALS[g].label))));
    if (m.goalsDone?.length) box.append(h('div', { class: 'muted' }, `Tamamlanan: ${m.goalsDone.map((g) => GOALS[g].title).join(', ')}`));
  }
  const ms = (w.missions ?? []).filter((x) => x.status === 'acik' || x.status === 'bildirildi');
  box.append(h('h3', {}, '👑 Kayzer’in görevleri'));
  if (!ms.length) box.append(h('div', { class: 'muted' }, 'Şu an açık görev yok.'));
  for (const x of ms) box.append(h('div', { class: 'card row' }, h('span', { class: 'grow' }, `“${x.text}” · ${x.reward} Dinar${x.to ? ` · ${findPerson(w, x.to)?.name ?? '?'} için` : ' · herkese açık'}${x.status === 'bildirildi' ? ` · ${findPerson(w, x.claimedBy)?.name ?? ''} bildirdi` : ''}`),
    ruler && x.status === 'bildirildi' ? h('span', {}, h('button', { class: 'primary', onclick: () => void send({ t: 'missionPay', id: x.id, pay: true }) }, '💰 Öde'), h('button', { onclick: () => void send({ t: 'missionPay', id: x.id, pay: false }) }, 'Reddet')) : '',
    !ruler && x.status === 'acik' && (!x.to || x.to === m.id) ? h('button', { onclick: () => void send({ t: 'missionClaim', id: x.id }) }, '✅ Tamamladım') : ''));
  if (ruler) {
    const t = h('input', { placeholder: 'Görev (ör. Limana 20 odun getir)' }); const r = h('input', { type: 'number', value: '50', style: 'width:80px' });
    const to = select([['', 'Herkese açık'], ...w.people.filter((p) => p.playerId && p.id !== m.id).map((p): [string, string] => [p.id, p.name])]);
    box.append(h('h3', {}, 'Yeni görev ver'), h('div', { class: 'row' }, t, r, to, h('button', { class: 'primary', onclick: () => void send({ t: 'missionCreate', text: t.value, reward: Number(r.value), to: to.value || null }) }, 'İlan et')));
  }
  return box;
}

function gazetteBody(): HTMLElement {
  {
    const w = world!; const box = h('div', {}, h('h2', {}, `📜 ${w.empireName ?? 'İmparatorluk'} Gazetesi`), h('div', { class: 'muted' }, 'Kalemşörler ve Maecenas her gün yazar.'));
    for (const g of [...w.gazette].reverse().slice(0, 10)) box.append(h('div', { class: 'card' }, h('b', {}, `Gün ${g.day}: ${g.headline}`), ...g.lines.map((l) => h('div', { class: 'muted' }, l)), ...(g.meclis?.length ? [h('div', { class: 'muted', style: 'margin-top:4px' }, '🏛 Meclis:'), ...g.meclis.map((l) => h('div', { class: 'muted' }, `• ${l}`))] : [])));
    if (!w.gazette.length) box.append(h('div', { class: 'muted' }, 'İlk sayı gün sonunda çıkacak.'));
    box.append(h('h3', {}, 'Bugün olanlar'), ...w.events.slice(-12).reverse().map((e) => h('div', { class: 'msg' }, `${String(e.hour).padStart(2, '0')}:00 ${e.text}`)));
    return box;
  }
}
function openChat(): void { openMenu('mesaj'); }
function chatBody(): HTMLElement {
  const w = world!; const meP = me();
  const to = dmTarget ? findPerson(w, dmTarget) : null;
  const list = h('div', { class: 'msgs' });
  const shown = msgs.filter((m) => (to ? (m.toPersonId === to.id && m.fromPersonId === meP?.id) || (m.fromPersonId === to.id && m.toPersonId === meP?.id) : m.toPersonId === null));
  for (const m of shown.slice(-60)) { const npc = findPerson(w, m.fromPersonId); const mine = m.fromPersonId === meP?.id; list.append(h('div', { class: `msg${m.toPersonId ? ' dm' : ''}${mine ? ' mine' : ''}` }, h('b', { style: 'cursor:pointer', onclick: () => openPersonSheet(m.fromPersonId) }, m.fromName), npc && !npc.playerId ? h('span', { class: 'muted' }, ' (NPC)') : '', ': ', m.text)); }
  if (!shown.length) list.append(h('div', { class: 'muted' }, to ? `${to.name} ile henüz konuşmadınız. Bir şey yazın; kendi aklıyla cevap verir.` : 'Meydan sessiz.'));
  if (typing) list.append(h('div', { class: 'muted typing' }, `${to?.name ?? 'Biri'} yazıyor…`));
  const inp = h('input', { maxlength: '280', placeholder: to ? `${ek(to.name, 'a')} yazın… (örn. merhaba, nasılsın?)` : 'Meydanda herkese duyurun…', style: 'flex:1' });
  const sendMsg = async (): Promise<void> => {
    const text = inp.value; if (!text.trim()) return; inp.value = ''; typing = !!dmTarget;
    msgs.push({ id: `local-${Date.now()}`, fromPersonId: meP?.id ?? '', fromName: meP?.name ?? '', toPersonId: dmTarget, text, at: Date.now() }); rerenderSheet(true);
    const e = await be.chat(text, dmTarget); typing = false;
    if (e) { toast(e); sfx('error'); }
    msgs = await be.messages(); seenMsgs = msgs.length; if (msgs.at(-1)?.fromPersonId !== meP?.id) sfx('msg'); rerenderSheet(true);
    setTimeout(() => { const el = document.querySelector<HTMLInputElement>('.chat-input'); el?.focus(); }, 30);
  };
  inp.classList.add('chat-input');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') void sendMsg(); });
  if (pendingSay) { inp.value = pendingSay; pendingSay = null; setTimeout(() => void sendMsg(), 50); }
  const dms = [...new Set(msgs.filter((m) => m.toPersonId && (m.fromPersonId === meP?.id || m.toPersonId === meP?.id)).map((m) => (m.fromPersonId === meP?.id ? m.toPersonId! : m.fromPersonId)))];
  if (dmTarget && !dms.includes(dmTarget)) dms.unshift(dmTarget);
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
  return h('div', {}, h('div', { class: 'row' }, h('button', { class: to ? '' : 'primary', onclick: () => { dmTarget = null; rerenderSheet(true); } }, '🗣 Meydan (dedikodu)'), ...dms.slice(0, 8).map((id) => h('button', { class: dmTarget === id ? 'primary' : '', onclick: () => { dmTarget = id; rerenderSheet(true); } }, `✉️ ${findPerson(w, id)?.name ?? '?'}`))),
    list, h('div', { class: 'row' }, inp, h('button', { class: 'primary', onclick: () => void sendMsg() }, 'Gönder')),
    h('div', { class: 'muted' }, to ? 'Özel mesaj: yalnızca siz ve o görür.' : 'Meydan herkese açıktır; NPC’ler buraya sadece herkesin duymasını istedikleri dedikoduları yazar. Birine özel yazmak için kişiye dokunun → 💬 Konuş.'));
}
let typing = false;

function openAdmin(): void {
  openSheet(() => {
    const w = world!; const box = h('div', {}, h('h2', {}, '🛠 Kurucu paneli (gizli)'));
    const run = async (r: Parameters<Backend['admin']>[0]): Promise<void> => { toast(await be.admin(r)); await tick(); rerenderSheet(true); };
    const pw = h('input', { type: 'text', placeholder: 'yeni davet şifresi' });
    box.append(h('h3', {}, 'Davet şifresi'), h('div', { class: 'row' }, pw, h('button', { onclick: () => void run({ t: 'setPassword', password: pw.value }) }, 'Değiştir')));
    const pt = h('table', {}, h('tr', {}, h('th', {}, 'Oyuncu'), h('th', {}, 'Son görülme'), h('th', {}, '')));
    for (const p of Object.values(w.players)) pt.append(h('tr', {}, h('td', {}, `${p.name}${p.founder ? ' 👑' : ''}${p.banned ? ' (sürgün)' : ''}`), h('td', {}, new Date(p.lastSeen).toLocaleString('tr-TR')),
      h('td', {}, p.founder ? '' : h('button', { onclick: () => void run({ t: 'kick', playerId: p.playerId }) }, 'At'), ' ', p.founder ? '' : h('button', { class: 'danger', onclick: () => void run({ t: 'ban', playerId: p.playerId, banned: !p.banned }) }, p.banned ? 'Affet' : 'Sürgün et'))));
    box.append(h('h3', {}, 'Oyuncular'), pt);
    const tr = h('input', { type: 'number', value: String(Math.round(w.treasury)) });
    box.append(h('h3', {}, 'Değer düzelt'), h('div', { class: 'row' }, 'Hazine', tr, h('button', { onclick: () => void run({ t: 'setTreasury', amount: Number(tr.value) }) }, 'Ayarla')));
    const who = select(w.people.map((p): [string, string] => [p.id, p.name]));
    const field = select([['money', 'Para'], ['mood', 'Memnuniyet'], ['loyalty', 'Sadakat'], ['republic', 'Cumhuriyetçilik'], ['hunger', 'Açlık'], ['jailedDays', 'Zindan günü'], ['name', 'İsim']]);
    const val = h('input', { placeholder: 'değer' });
    box.append(h('div', { class: 'row' }, who, field, val, h('button', { onclick: () => void run({ t: 'editPerson', personId: who.value, field: field.value as 'money', value: field.value === 'name' ? val.value : Number(val.value) }) }, 'Kaydet')),
      h('div', { class: 'row' }, h('button', { onclick: () => void run({ t: 'allowStateTakeover', allow: !w.allowStateTakeover }) }, w.allowStateTakeover ? '🔓 Devlet görevlileri devralınabilir (kapat)' : '🔒 Devlet görevlileri devralınamaz (aç)')),
      h('div', { class: 'row' }, h('button', { onclick: () => void run({ t: 'releaseAll' }) }, 'Zindanı boşalt'), h('button', { onclick: () => void run({ t: 'resetCumhuriyet' }) }, 'Cumhuriyet isteğini sıfırla')));
    const snapBox = h('div', {}, h('div', { class: 'muted' }, 'yükleniyor…'));
    void be.snapshots().then((ss) => { snapBox.replaceChildren(...(ss.length ? ss.map((s) => h('div', { class: 'row card' }, `Gün ${s.day} · ${new Date(s.at).toLocaleString('tr-TR')}`, h('button', { class: 'danger', onclick: () => { void askConfirm('Dünya bu yedeğe dönecek. Emin misiniz?').then((yes) => { if (yes) void run({ t: 'restoreSnapshot', id: s.id }); }); } }, 'Geri yükle'))) : [h('div', { class: 'muted' }, 'Henüz yedek yok.')])); });
    box.append(h('h3', {}, '⚠️ Oyunu sıfırla'), h('div', { class: 'muted' }, 'Tüm dünya baştan kurulur; oyuncu hesapları kalır, karakterler yeniden doğar. Önce otomatik yedek alınır.'),
      h('button', { class: 'danger', onclick: async () => {
        if (!(await askConfirm('Oyunu sıfırlamak istediğinize emin misiniz? Bütün şehir, para, aileler ve olaylar silinecek.', 'Sıfırla'))) return;
        const t = await askText('Son onay: sıfırlamak için büyük harflerle SIFIRLA yazın', 'SIFIRLA', 'Son onay'); if (t !== 'SIFIRLA') { toast('İptal edildi.'); return; }
        void run({ t: 'resetWorld', confirm: t });
      } }, '🔄 Oyunu sıfırla'));
    box.append(h('h3', {}, 'Yedekler (3 günde bir otomatik, son 8)'), h('button', { onclick: () => void run({ t: 'snapshot' }) }, 'Şimdi yedek al'), snapBox);
    return box;
  });
}

// ---------------- input: pan / zoom / tap ----------------
const pointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
let pinch: { d: number; z: number } | null = null;
/** Limited view: never more than ~30 tiles across (≈16 on a phone). */
function minZoom(): number { const tiles = innerWidth < 700 ? 16 : 30; return Math.max(1, canvas.width / (T * tiles)); }
function clampCam(): void {
  if (cam.z < minZoom()) cam.z = minZoom();
  const vw = canvas.width / (cam.z * T), vh = canvas.height / (cam.z * T);
  const top = ((hudEl?.offsetHeight ?? 48) * (lowGfx ? 1 : Math.min(2, window.devicePixelRatio || 1))) / (cam.z * T) + 2.2; // room above the top row so the info bar never hides buildings
  cam.x = Math.max(-2, Math.min(MAP_W - vw + 2, cam.x)); cam.y = Math.max(-top, Math.min(MAP_H - vh + 2, cam.y));
}
function zoomAt(sx: number, sy: number, nz: number): void {
  const z0 = cam.z; nz = Math.max(minZoom(), Math.min(6, nz));
  const wx = cam.x + sx / (z0 * T), wy = cam.y + sy / (z0 * T);
  cam.z = nz; cam.x = wx - sx / (nz * T); cam.y = wy - sy / (nz * T); clampCam();
}
function setupInput(): void {
  const dpr = (): number => (lowGfx ? 1 : Math.min(2, window.devicePixelRatio || 1)); // v1.9.3: cap at 2× – 3× phones pushed 2.25× the pixels for no visible gain
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) dragStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; else { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: cam.z }; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); zoomAt((a!.x + b!.x) / 2 * dpr(), (a!.y + b!.y) / 2 * dpr(), pinch.z * d / pinch.d); if (dragStart) dragStart.moved = true; return; }
    if (dragStart) { const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y; if (Math.abs(dx) + Math.abs(dy) > 6) { dragStart.moved = true; followCam = false; } cam.x = dragStart.cx - dx * dpr() / (cam.z * T); cam.y = dragStart.cy - dy * dpr() / (cam.z * T); clampCam(); }
  });
  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0 && dragStart) {
      if (!dragStart.moved && world) {
        const r = canvas.getBoundingClientRect(); const hit = hitTest(world, placed, cam, (e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr(), me()?.id ?? null);
        const tx = (e.clientX - r.left) * dpr() / (cam.z * T) + cam.x, ty = (e.clientY - r.top) * dpr() / (cam.z * T) + cam.y;
        // v2.0.1: a tap never opens a random panel. Foe → attack/approach; person → name + health label; building → walk, open on arrival
        const foe = nearestFoeAt(tx, ty);
        const bAt = world.buildings.find((b) => tx >= b.x && tx <= b.x + b.w && ty >= b.y - (b.kind === 'pazar' ? 1.4 : 0.6) && ty <= b.y + b.h);
        if (foe) tapFoe(foe);
        else if (hit.animal) tapAnimal(hit.animal);
        else if (hit.corpse) openCorpse(hit.corpse.id);
        else if (hit.gosterge) { sfx('tap'); if (nearGosterge()) openGosterge(); else toast('📊 Şehir Göstergesi – Saray’ın yanındaki tabelaya yürüyün, sonra “Etkileşim” (E).'); }
        else if (hit.sign && !bAt) openElectionSign();
        else if (bAt && bAt.kind === 'pazar' && ty >= bAt.y - 0.6) { selB = bAt.id; selPerson = null; sfx('tap'); const q = myPlaced(); toast(q && distToBuilding(bAt, q) <= REACH + 1 ? `🏠 ${bAt.name} seçildi – açmak için “Etkileşim” (E).` : `🏠 ${bAt.name} seçildi – joystick ile yanına gidin, sonra “Etkileşim” (E).`); ctl?.refresh(); } // a tap on a market stall/roof selects the market, not the seller standing in it
        else if (hit.kid) { selPerson = hit.kid.id; selUntil = performance.now() + 4000; sfx('tap'); }
        else if (hit.person && hit.person.id !== me()?.id) { selPerson = hit.person.id; selUntil = performance.now() + 4000; sfx('tap'); }
        else if (hit.person) { const mm = me(); if (mm?.riding && (mm.animals?.at ?? 0) > 0) { sfx('step'); void send({ t: 'ride', on: false }); } }
        else if (hit.building || bAt) { const b = (hit.building ?? bAt)!; selB = b.id; sfx('tap'); const q = myPlaced(); toast(q && distToBuilding(b, q) <= REACH ? `🏠 ${b.name} seçildi – girmek için “Etkileşim” (E).` : `🏠 ${b.name} seçildi – joystick ile kapısına gidin, sonra “Etkileşim” (E).`); ctl?.refresh(); }
        else { selB = null; selPerson = null; ctl?.refresh(); } // v2.0.1: tapping the map never walks – movement is joystick / WASD only
      }
      dragStart = null;
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt((e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr(), cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  const resize = (): void => { canvas.width = Math.round(innerWidth * dpr()); canvas.height = Math.round(innerHeight * dpr()); const want = canvas.width / (T * (innerWidth < 700 ? 12 : 22)); if (cam.z < want) cam.z = want; clampCam(); };
  addEventListener('resize', resize); resize();
}

let insideEl: HTMLElement | null = null;
/** v1.9.3: while you are inside your house the street dims and a banner offers 'Evden çık'. */
function insideBanner(): void {
  const m = me(); const inside = !!m && (m.homeUntil ?? 0) > gameNow();
  document.body.classList.toggle('inside-home', inside);
  if (!inside) { insideEl?.remove(); insideEl = null; return; }
  const b = world?.buildings.find((x) => x.id === m!.home); const txt = `${m!.sleeping ? 'Evinizde uyuyorsunuz' : 'Evinizdesiniz'} (${b?.name ?? 'ev'}) · burada kimse size dokunamaz`;
  if (insideEl && insideEl.dataset.t === txt) return; insideEl?.remove();
  insideEl = h('div', { class: 'inside-ov' }, ic(m!.sleeping ? 'moon' : 'house'), h('span', {}, txt), h('button', { class: 'primary', onclick: () => void send({ t: 'leaveHome' }) }, 'Evden çık')); insideEl.dataset.t = txt; app.append(insideEl);
}
/** v1.9.3: tap your own animal – a horse: mount it; a cow/sheep/chicken: offer to slaughter it for meat. */
function tapAnimal(a: PlacedAnimal): void {
  const m = me(); if (!m) return; sfx('step');
  if (a.kind === 'at') { if (m.riding) { void send({ t: 'ride', on: false }); return; } toast('Atınıza biniyorsunuz…'); void doAct({ t: 'ride', on: true }); return; }
  const lbl: Record<string, string> = { inek: 'İnek', koyun: 'Koyun', tavuk: 'Tavuk' }; const meat: Record<string, string> = { inek: 'bol et', koyun: 'et ve 2 yün', tavuk: 'biraz et' };
  openSheet(() => h('div', { class: 'stack' }, h('h3', {}, ic(a.kind === 'inek' ? 'cow' : a.kind === 'koyun' ? 'sheep' : 'chicken'), ` ${lbl[a.kind]} (sizin)`), h('div', { class: 'muted' }, `Keserseniz ${meat[a.kind]} alırsınız; hayvan gider.`),
    h('div', { class: 'row' }, h('button', { class: 'danger', onclick: () => { void askConfirm(`${lbl[a.kind]} kesilsin mi?`).then((yes) => { if (yes) { closeSheet(); void doAct({ t: 'slaughter', animal: a.kind }); } }); } }, 'Kes'), h('button', { onclick: () => closeSheet() }, 'Vazgeç'))));
}
function darkness(w: World): number {
  const t = w.hour; if (t >= 21 || t < 5) return 0.45; if (t >= 19) return (t - 19) / 2 * 0.45; if (t < 7) return (7 - t) / 2 * 0.45; return 0;
}

const profAcc = { n: 0, sum: 0, max: 0 };
let lastHud = 0; let lastFrame = performance.now();
/** v1.9 NPC smoothing: the schedule/path target is computed from (server) time every frame; what we DRAW follows it
 * with a time-based critically-damped chase, so snapshot corrections, schedule switches and overrides never snap. */
const shown = new Map<string, { x: number; y: number; vx: number; vy: number; dir: number; t: number }>();
function smoothPeople(list: Placed[], mine: string | null): Placed[] {
  const t = performance.now();
  for (const q of list) {
    if (q.p.id === mine) continue; // own character: local prediction already
    const s = shown.get(q.p.id);
    if (!s || !q.visible || t - s.t > 1500 || Math.hypot(q.x - s.x, q.y - s.y) > 8) { shown.set(q.p.id, { x: q.x, y: q.y, vx: 0, vy: 0, dir: q.dir, t }); continue; }
    const dt = Math.min(0.1, (t - s.t) / 1000); s.t = t;
    const w0 = 7; // spring stiffness (critically damped)
    const ax = w0 * w0 * (q.x - s.x) - 2 * w0 * s.vx, ay = w0 * w0 * (q.y - s.y) - 2 * w0 * s.vy;
    s.vx += ax * dt; s.vy += ay * dt;
    const vmax = 5.5, v = Math.hypot(s.vx, s.vy); if (v > vmax) { s.vx *= vmax / v; s.vy *= vmax / v; } // v1.9.3: a schedule switch becomes a brisk walk, never a hop
    s.x += s.vx * dt; s.y += s.vy * dt;
    const sp = Math.hypot(s.vx, s.vy); if (sp > 0.25 && Math.abs(s.vx) > 0.15) s.dir = s.vx > 0 ? 1 : -1;
    q.x = s.x; q.y = s.y; q.moving = q.moving || sp > 0.4; if (sp > 0.25) q.dir = s.dir;
  }
  return list;
}

// ---------------- v2.0.1: combat taps, labels, controls, notices ----------------
let selB: string | null = null; let selPerson: string | null = null; let selUntil = 0; let heldNpc: string | null = null; let pendingB: string | null = null; let labelEl: HTMLElement | null = null;
let ctl: ReturnType<typeof buildControls> | null = null; let joyVec = { x: 0, y: 0 }; let joyTimer: ReturnType<typeof setInterval> | null = null;
function nearestFoeAt(tx: number, ty: number): string | null {
  const w = world; if (!w?.combat) return null; let best: string | null = null; let bd = 1.3;
  for (const f of liveFoes(w)) { const p = foePos(f, gameNow()); const d = Math.hypot(p.x - tx, p.y - (ty + 0.4)); if (d < bd) { bd = d; best = f.id; } }
  return best;
}
function myPlaced(): Placed | undefined { const m = me(); return m ? placed.find((q) => q.p.id === m.id) : undefined; }
function foeRange(): number { const m = me(); return m && weaponInHand(m) === 'yay' ? 7 : MELEE_TILES + REACH_SLACK; }
function tapFoe(id: string): void {
  const w = world; const m = me(); const f = w?.combat?.foes.find((x) => x.id === id); if (!w || !m || !f) return;
  if (!weaponInHand(m)) { toast(bestWeapon(m) ? '⚔ Önce alttaki hızlı çubuktan silahınızı seçin (kınından çekin).' : '⚔ Silahınız yok – Demirci’den (Zanaat Atölyesi) alın ya da evinize kaçın.'); return; }
  const q = myPlaced(); const fp = foePos(f, gameNow());
  if (q && weaponInHand(m) !== 'yay' && Math.hypot(q.x - fp.x, q.y - fp.y) > foeRange()) { markSwing(m.id); sfx('swing'); return; } // v2.0.2: a swing out of reach just misses
  if (q && Math.hypot(q.x - fp.x, q.y - fp.y) > foeRange() + 0.2) { toast(`🎯 Düşman menzil dışında (${Math.round(Math.hypot(q.x - fp.x, q.y - fp.y))} kare) – joystick ile yaklaşın, sonra Saldır.`); return; }
  void send({ t: 'attack', foeId: id } as never);
}
let lastAtkPress = 0; let aimStart = 0;
function ctlAttack(): void {
  const w = world; const m = me(); if (!w || !m) return;
  const q = myPlaced(); if (!q) return; const now = gameNow(); const wp = weaponInHand(m);
  if (!wp) { toast(bestWeapon(m) ? '⚔ Önce alttaki hızlı çubuktan silahınızı seçin (kınından çekin).' : '⚔ Silahınız yok – Demirci’den (Zanaat Atölyesi) alın.'); return; }
  const live = w.combat ? liveFoes(w).filter((f) => now >= f.walk.t0) : [];
  if (wp === 'yay') { // v2.0.2: hold to draw the bow – the longer you hold, the farther the arrow; release to shoot
    if (((m.arms as Record<string, number> | undefined)?.ok ?? 0) <= 0) { toast('🏹 Okunuz kalmadı – Demirci’den ok alın.'); return; }
    aimStart = performance.now(); aim.on = true; aim.fx = q.x; aim.fy = q.y; updateAim(); return;
  }
  // v2.0.2: kılıç/hançer swing freely at any time; only a foe within reach (0.5 m between bodies) is struck, otherwise it is a visible whiff
  if (performance.now() - lastAtkPress < 1000) return; lastAtkPress = performance.now(); // one swing per second (server rule: 1.1 s)
  markSwing(m.id); sfx('swing');
  const f = [...live].map((x) => ({ x, d: Math.hypot(foePos(x, now).x - q.x, foePos(x, now).y - q.y) })).sort((a, b) => a.d - b.d)[0];
  if (f && f.d <= MELEE_TILES + REACH_SLACK) void send({ t: 'attack', foeId: f.x.id } as never);
}
/** Bow aim: direction = joystick (while aiming the joystick only turns the aim), else the nearest foe, else facing; distance grows with the hold. */
function updateAim(): void {
  if (!aim.on) return; const w = world; const q = myPlaced(); if (!w || !q) { aim.on = false; return; }
  const now = gameNow(); const live = w.combat ? liveFoes(w).filter((f) => now >= f.walk.t0) : [];
  let dx = joyVec.x, dy = joyVec.y;
  if (!dx && !dy) { const f = [...live].sort((a, b) => Math.hypot(foePos(a, now).x - q.x, foePos(a, now).y - q.y) - Math.hypot(foePos(b, now).x - q.x, foePos(b, now).y - q.y))[0]; if (f) { const p = foePos(f, now); dx = p.x - q.x; dy = p.y - q.y; } else dx = q.dir < 0 ? -1 : 1; }
  const n = Math.hypot(dx, dy) || 1; const dist = 1.5 + (BOW_MAX - 1.5) * Math.min(1, (performance.now() - aimStart) / 1600);
  aim.fx = q.x; aim.fy = q.y; aim.x = q.x + dx / n * dist; aim.y = q.y + dy / n * dist;
  aim.lock = live.some((f) => Math.hypot(foePos(f, now).x - aim.x, foePos(f, now).y - aim.y) <= aim.r);
}
function ctlAttackEnd(): void {
  if (!aim.on) return; updateAim(); aim.on = false; const m = me(); if (!m) return;
  if (performance.now() - aimStart < 120) { toast('🏹 Saldır’ı basılı tutun: nişan çizgisi uzar (menzil), bırakınca ok atılır. Yönü joystick ile çevirin.'); return; }
  markSwing(m.id); sfx('bow'); void send({ t: 'attack', foeId: '', aimX: Math.round(aim.x * 100) / 100, aimY: Math.round(aim.y * 100) / 100 } as never);
}
function nearPeople(): Placed[] { const q = myPlaced(); const m = me(); if (!q || !m) return []; return placed.filter((x) => x.visible && x.p.id !== m.id && Math.hypot(x.x - q.x, x.y - q.y) <= PERSON_REACH); }
function interactTarget(): { kind: 'person'; id: string; label: string } | { kind: 'building'; id: string; label: string } | { kind: 'none'; label: string } {
  const w0 = world; const q0 = myPlaced(); const sb = selB && w0 ? w0.buildings.find((x) => x.id === selB) : undefined;
  if (nearGosterge()) return { kind: 'building', id: '__gosterge', label: 'Şehir Göstergesi' };
  if (sb && q0 && distToBuilding(sb, q0) <= REACH + 1) return { kind: 'building', id: sb.id, label: sb.name }; // a tapped (selected) building wins when in reach
  const near = nearPeople();
  if (near.length === 1) return { kind: 'person', id: near[0]!.p.id, label: near[0]!.p.name.split(' ')[0]! };
  if (near.length > 1) { const s = near.find((x) => x.p.id === selPerson); return s ? { kind: 'person', id: s.p.id, label: s.p.name.split(' ')[0]! } : { kind: 'none', label: 'Kişiye dokunun' }; }
  const w = world; const q = myPlaced(); if (w && q) { const b = w.buildings.filter((x) => distToBuilding(x, q) <= 1.2).sort((a, c) => distToBuilding(a, q) - distToBuilding(c, q))[0]; if (b) return { kind: 'building', id: b.id, label: b.name }; }
  return { kind: 'none', label: 'Yakında kimse yok' };
}
/** v2.0.1 Şehir Göstergesi: open when standing within ~1 m of the board next to the Saray. */
function nearGosterge(): boolean { const q = myPlaced(); return !!q && Math.hypot(q.x - (GOSTERGE.x + 0.7), q.y - (GOSTERGE.y + 0.3)) <= 1.4; }
function openGosterge(): void { const w = world; if (!w || document.querySelector('.gosterge-modal')) return; const el = gostergeModal(w, () => el.remove()); app.append(el); }
function ctlInteract(): void {
  const t = interactTarget(); const w = world; if (!w) return;
  if (t.kind === 'none') { toast(t.label === 'Kişiye dokunun' ? 'Yakında birden fazla kişi var: önce konuşmak istediğinize dokunun.' : 'Etkileşim için birinin hemen yanında (1 kare) ya da bir binanın kapısında olun.'); return; }
  if (t.kind === 'building' && t.id === '__gosterge') { openGosterge(); return; }
  if (t.kind === 'building') { const b = w.buildings.find((x) => x.id === t.id); if (b) openSheet(() => bPanel(b)); return; }
  openInteraction(t.id);
}
function openInteraction(id: string): void {
  const w = world; const p = w ? findPerson(w, id) : null; if (!w || !p) return;
  const q = placed.find((x) => x.p.id === id); if (q && (!p.playerId || p.npc)) { p.hold = { by: me()?.id ?? '', x: q.x, y: q.y, until: gameNow() + 90_000 }; heldNpc = id; void be.act({ t: 'holdNpc', personId: id, on: true } as never); }
  openPersonSheet(id); if (heldNpc) heldNpc = id;
}
function useSlot(k: SlotItem): void {
  const m = me(); if (!m) return; const n = (m.arms as Record<string, number> | undefined)?.[k] ?? (m.inv as Record<string, number>)[k] ?? 0;
  if (['kilic', 'hancer', 'yay'].includes(k)) { if (!n) { toast('Bu silah üzerinizde değil (sandıkta olabilir).'); return; } void send({ t: 'drawWeapon', kind: m.drawn === k ? null : k } as never); return; }
  if (k === 'kalkan') { toast(n ? '🛡 Kalkan taşıdığınız sürece her darbe daha az acıtır (seçmeye gerek yok).' : 'Kalkanınız yok.'); return; }
  if (k === 'ok') { toast(`➶ ${n} ok – yay seçiliyken her atış 1 ok harcar.`); return; }
  if (!n) { toast(`Çantada ${GOOD_LABEL[k as never] ?? k} yok – Fırın/Kuyu/Pazar’dan “Çantaya al”.`); return; }
  void send({ t: 'useItem', good: k } as never);
}
function ctlMove(dx: number, dy: number): void {
  joyVec = { x: dx, y: dy }; if (aim.on) { if (joyTimer) { clearInterval(joyTimer); joyTimer = null; } return; } // aiming: the stick turns the bow, no walking
  const stepMove = (): void => { const w = world; const m = me(); if (!w || !m) return; if (!joyVec.x && !joyVec.y) return; const p = myPos(w, m, gameNow()); walkTo({ x: Math.max(0.5, Math.min(MAP_W - 0.5, p.x + joyVec.x * 2.4)), y: Math.max(0.5, Math.min(MAP_H - 0.5, p.y + joyVec.y * 2.4)) }, true); pendingB = null; };
  if (dx || dy) { if (!joyTimer) { stepMove(); joyTimer = setInterval(stepMove, 220); } }
  else if (joyTimer) { clearInterval(joyTimer); joyTimer = null; const w = world; const m = me(); if (w && m) { const p = myPos(w, m, gameNow()); walkTo(p, true); } }
}
function goBuilding(id: string): void {
  const w = world; const b = w?.buildings.find((x) => x.id === id); const m = me(); if (!w || !b || !m) return;
  if (distToBuilding(b, myPos(w, m, gameNow())) <= REACH) { openSheet(() => bPanel(b)); return; }
  pendingB = id; walkTo(doorSpot(b)); toast(`🚶 ${b.name} yoluna çıktınız – varınca açılacak.`);
}
function frameExtras(): void {
  const w = world; const m = me(); if (!w || !m) return;
  if (pendingB) { const b = w.buildings.find((x) => x.id === pendingB); const q = myPlaced(); if (!b) pendingB = null; else if (q && distToBuilding(b, q) <= REACH) { pendingB = null; openSheet(() => bPanel(b)); } }
  // name + health label above a tapped person
  if (selPerson && performance.now() < selUntil) {
    const q = placed.find((x) => x.p.id === selPerson); const r = canvas.getBoundingClientRect(); const k = cam.z * T / (lowGfx ? 1 : Math.min(2, window.devicePixelRatio || 1));
    const kid = q ? undefined : lastKids.find((x) => x.id === selPerson);
    const spr = k * SPRITE_SCALE; // adult sprite height in CSS px
    if (q) { const kh = kidHeight(kidScale(yearsOf(w, q.p))); const tr = trait(q.p); const rk = q.p.npc === false || q.p.playerId ? rankLabel(w, q.p) : ''; if (!labelEl) { labelEl = h('div', { class: 'person-label' }); app.append(labelEl); } labelEl.replaceChildren(h('b', {}, displayName(w, q.p)), (tr || rk) ? h('div', { class: 'trait' }, [rk, tr].filter(Boolean).join(' · ')) : '', h('div', { class: 'hp' }, h('i', { style: `width:${Math.max(0, Math.min(100, tween(`lbl-${q.p.id}`, q.p.health, 350)))}%` }))); labelEl.style.left = `${r.left + (q.x - cam.x) * k}px`; labelEl.style.top = `${r.top + (q.y - cam.y) * k - 34 + spr * (1 - kh)}px`; }
    else if (kid) { const kh = kidHeight(kid.s); if (!labelEl) { labelEl = h('div', { class: 'person-label' }); app.append(labelEl); } labelEl.replaceChildren(h('b', {}, kid.name), h('div', { class: 'trait' }, `${kid.years} yaşında${kid.sick ? ' · hasta' : ''}`)); labelEl.style.left = `${r.left + (kid.x - cam.x) * k}px`; labelEl.style.top = `${r.top + (kid.y - cam.y) * k - 34 + spr * (1 - kh)}px`; }
  } else if (labelEl) { labelEl.remove(); labelEl = null; }
  if (heldNpc && sheet && performance.now() % 30000 < 40) void be.act({ t: 'holdNpc', personId: heldNpc, on: true } as never);
  updateAim(); ctl?.refresh(); hudBars();
}
/** v2.0.2: HUD meters glide every frame (HP after a hit, tokluk/su/enerji drifting between hourly updates). */
function hudBars(): void {
  for (const el of hudEl?.querySelectorAll<HTMLElement>('.meter[data-k]') ?? []) {
    const k = el.dataset.k!; const v = Number(el.dataset.v); if (!Number.isFinite(v)) continue; const i = el.querySelector<HTMLElement>('.bar i'); if (!i) continue;
    const s = tween(`hud-${k}`, v, k === 'hp' ? 450 : 900, k !== 'hp'); i.style.width = `${Math.max(0, Math.min(100, s))}%`;
  }
}
function setupControls(): void {
  ctl = buildControls(app, { me: () => me(), useSlot, move: ctlMove, attack: ctlAttack, attackEnd: ctlAttackEnd, interact: ctlInteract,
    canAttack: () => { const m = me(); const on = !!m && !!weaponInHand(m); return { on, label: on ? (m && weaponInHand(m) === 'yay' ? 'Basılı tut: nişan al, bırak: at' : 'Kılıcı/hançeri savur') : 'Önce hızlı çubuktan bir silah seçin' }; },
    canInteract: () => { const t = interactTarget(); return { on: t.kind !== 'none', label: t.label }; } });
}
// combat feedback + money / weapon notices (every state update)
let hitSeen = 0; let ledgerSig = new Set<string>(); let ledgerInit = false; let lastDrawn: string | null | undefined; let ownActAt = 0;
function stateNotices(): void {
  const w = world; const m = me(); if (!w || !m) return; const now = gameNow();
  const hits = w.combat?.hits ?? []; const logEl = document.querySelector('.combat-log') ?? (() => { const e = h('div', { class: 'combat-log' }); app.append(e); return e; })();
  for (const hi of hits) { if (hi.at <= hitSeen) continue; if (now - hi.at > 15_000) continue;
    if (hi.to === m.id) { const t = hi.k === 'rob' ? `💰 ${hi.by} kesenizden ${hi.dmg} D aldı!` : hi.k === 'block' ? `🛡 ${hi.by} size ${hi.w} ile vurdu – kalkan kısmen tuttu (−${hi.dmg})` : `🩸 ${hi.by} size ${hi.w} ile vurdu (−${hi.dmg})`; logEl.append(h('div', {}, t)); setTimeout(() => logEl.firstChild?.remove(), 3600); app.append(h('div', { class: 'hurt-flash' })); setTimeout(() => document.querySelector('.hurt-flash')?.remove(), 600); canvas.classList.remove('shake'); void canvas.offsetWidth; canvas.classList.add('shake'); sfx(hi.k === 'block' ? 'clang' : 'hit'); try { navigator.vibrate?.(120); } catch { /* */ } }
    else if (hi.from === m.id || hi.by === m.name) { // v2.0.2: clear feedback for your own blows
      const f = w.combat?.foes.find((x) => x.id === hi.to); const hp = f ? ` · düşman canı ${Math.max(0, f.hp)}/${f.max}` : '';
      const t = hi.k === 'kill' ? `⚔ ${hi.toName} yere serildi! (+5 D ödül)` : hi.k === 'miss' ? `💨 ${hi.w} ıskaladı` : `💥 ${hi.w} ile vurdunuz: −${hi.dmg}${hp}`;
      logEl.append(h('div', { class: hi.k === 'miss' ? 'miss' : 'mine' }, t)); setTimeout(() => logEl.firstChild?.remove(), 3600);
      if (hi.k === 'kill') sfx('death'); else if (hi.k !== 'miss') { setTimeout(() => sfx('hit'), hi.arrow ? 380 : 0); canvas.classList.remove('shake-s'); void canvas.offsetWidth; canvas.classList.add('shake-s'); try { navigator.vibrate?.(40); } catch { /* */ } }
    }
  }
  hitSeen = Math.max(hitSeen, ...hits.map((x) => x.at), 0);
  // every money loss gets a visible reason (unless it was the action you just did)
  const mine = w.ledger.filter((l) => l.from === m.id || l.to === m.id); const sigOf = (l: typeof mine[number], i: number): string => `${l.day}|${l.from}|${l.to}|${l.amount}|${l.reason}|${i}`;
  const counts = new Map<string, number>(); const cur = new Set<string>(); const fresh: typeof mine = [];
  for (const l of mine) { const base = `${l.day}|${l.from}|${l.to}|${l.amount}|${l.reason}`; const n = (counts.get(base) ?? 0) + 1; counts.set(base, n); const sg = sigOf(l, n); cur.add(sg); if (ledgerInit && !ledgerSig.has(sg)) fresh.push(l); }
  ledgerSig = cur; if (!ledgerInit) ledgerInit = true;
  else if (Date.now() - ownActAt > 2500) for (const l of fresh.slice(-3)) toast(l.from === m.id ? `💸 −${l.amount.toFixed(2)} D: ${l.reason}` : `💰 +${l.amount.toFixed(2)} D: ${l.reason}`);
  if (lastDrawn !== undefined && lastDrawn && !m.drawn && Date.now() - ownActAt > 2500) toast(`⚔ ${({ hancer: 'Hançeriniz', kilic: 'Kılıcınız', yay: 'Yayınız' } as Record<string, string>)[lastDrawn] ?? 'Silahınız'} artık elinizde değil – ${((m.arms as Record<string, number> | undefined)?.[lastDrawn] ?? 0) > 0 ? 'kınına girdi (ok bitti ya da sandığa kondu)' : 'elinizden alındı (bekçi araması ya da soygun – bildirimlere bakın)'}.`);
  lastDrawn = m.drawn ?? null;
}
// v2.0.1: personal notices (itibar, din, iş, terfi …) reach an online player as toasts
let liveSeen = -1;
function liveNotices(first: boolean): void {
  const w = world; const pl = w?.players[be.session()?.playerId ?? '']; if (!pl) return; const n = pl.liveN ?? 0;
  if (first || liveSeen < 0) { liveSeen = n; return; }
  for (const x of (pl.live ?? []).filter((y) => y.n > liveSeen).slice(-3)) toast(x.t, 4200); liveSeen = n;
}
// v2.0.1 F2: every change to tokluk, su, enerji, sağlık or the Çanta gets a toast with its reason, batched (money has its own ledger toasts)
type Snap = { hunger: number; thirst: number; energy: number; health: number; inv: Record<string, number> };
let snap: Snap | null = null; let acc: Record<string, number> = {}; let accAt = 0;
function statToasts(first: boolean): void {
  const m = me(); if (!m) return; const cur: Snap = { hunger: m.hunger, thirst: m.thirst, energy: m.energy ?? 80, health: m.health, inv: { ...m.inv } as Record<string, number> };
  if (first || !snap) { snap = cur; accAt = Date.now(); return; }
  const mine = Date.now() - ownActAt < 2500; const prev = snap; snap = cur; if (mine) { acc = {}; accAt = Date.now(); return; } // the action's own reply already explains it
  for (const k of ['hunger', 'thirst', 'energy', 'health'] as const) acc[k] = (acc[k] ?? 0) + (cur[k] - prev[k]);
  const items: string[] = [];
  for (const g of new Set([...Object.keys(cur.inv), ...Object.keys(prev.inv)])) { const d = (cur.inv[g] ?? 0) - (prev.inv[g] ?? 0); if (d) items.push(`${d > 0 ? '+' : ''}${d} ${GOOD_LABEL[g as Good] ?? g}`); }
  const parts: string[] = []; const big = (k: string, lim: number): boolean => Math.abs(acc[k] ?? 0) >= lim;
  const flush = Date.now() - accAt > 45_000;
  const why = (k: string, d: number): string => { if (k === 'health') return d < 0 ? ((world?.combat?.hits ?? []).some((x) => x.to === m.id && gameNow() - x.at < 15_000) ? 'savaşta yara aldınız' : m.hunger > 85 ? 'açlık' : m.thirst > 85 ? 'susuzluk' : m.infected ? 'hastalık' : m.wounded ? 'yara' : 'yorgunluk') : 'dinlenip iyileştiniz'; if (k === 'energy') return d < 0 ? (m.walk ? 'yürüyüş' : 'çalışma ve zaman') : (m.sleeping ? 'uyku' : 'dinlenme'); return d > 0 ? 'zaman geçti' : 'yiyip içtiniz'; };
  const lbl: Record<string, string> = { hunger: '🍞 Tokluk', thirst: '💧 Su', energy: '⚡ Enerji', health: '❤️ Sağlık' };
  for (const k of ['hunger', 'thirst', 'energy', 'health']) { if (!(big(k, k === 'health' ? 3 : 8) || (flush && big(k, 1)))) continue; const d = acc[k]!; const shown = k === 'hunger' || k === 'thirst' ? -d : d; parts.push(`${lbl[k]} ${shown > 0 ? '+' : ''}${Math.round(shown)} (${why(k, d)})`); acc[k] = 0; }
  if (items.length) parts.push(`🎒 Çanta ${items.join(', ')}`);
  if (flush) accAt = Date.now();
  if (parts.length) toast(parts.join(' · '), 3600);
}
function openPurse(): void {
  openSheet(() => { const w = world!; const m = me(); if (!m) return h('div', {}, '—');
    const rows = w.ledger.filter((l) => l.from === m.id || l.to === m.id).slice(-40).reverse();
    return h('div', { class: 'stack' }, h('h2', {}, `💰 Kese: ${m.money.toFixed(2)} D`), h('div', { class: 'muted' }, 'Son para hareketleriniz (en yeni üstte). Her gelir ve giderin sebebi burada.'),
      ...rows.map((l) => h('div', { class: 'card row' }, h('b', { style: `color:${l.to === m.id ? '#7c7' : '#e77'};min-width:80px` }, `${l.to === m.id ? '+' : '−'}${l.amount.toFixed(2)} D`), h('span', { class: 'grow' }, l.reason), h('span', { class: 'muted' }, `Gün ${l.day}`))),
      rows.length ? '' : h('div', { class: 'muted' }, 'Henüz hareket yok.')); });
}
function openPlaces(): void {
  const groups: [string, string[]][] = [['Yiyecek ve su', ['firin', 'kuyu', 'gida', 'pazar', 'kasaphane', 'liman']], ['Alışveriş ve zanaat', ['zanaat', 'yeni', 'atolye', 'dokuma', 'mobilyahane', 'hayvan']], ['Devlet', ['saray', 'meclis', 'mahkeme', 'zindan', 'kisla']], ['Diğer', ['cami', 'okul', 'hekimhane', 'kahve', 'bar', 'festival', 'ambar', 'santiye', 'ciftlik']]];
  const extra: Record<string, string> = { atolye: ' (Demirci, Terzi)', firin: ' (ekmek)', kuyu: ' (su)', hekimhane: ' (tedavi)' };
  openSheet(() => { const w = world!; const m = me(); return h('div', { class: 'stack place-list' }, h('h2', {}, '📍 Yer bul'), h('div', { class: 'muted' }, 'Bir yere basın: karakteriniz oraya yürür (yürüme gerçek zamanlı, saat yakmaz), varınca paneli açılır. Haritada da her dükkânın adı yazar.'),
    ...groups.map(([g, ids]) => h('div', {}, h('h3', {}, g), ...ids.map((id) => w.buildings.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b).map((b) => h('button', { onclick: () => { closeSheet(); goBuilding(b.id); } }, `${b.name}${extra[b.id] ?? ''}`)))),
    m?.home ? h('div', {}, h('h3', {}, 'Ev'), h('button', { onclick: () => { closeSheet(); goBuilding(m.home); } }, `🏠 Evim (${w.buildings.find((b) => b.id === m.home)?.name ?? m.home})`)) : ''); });
}
function frame(): void {
  try { frameInner(); } catch (e) { frameErr(e); }
  requestAnimationFrame(frame);
}
let frameErrN = 0; function frameErr(e: unknown): void { frameErrN += 1; if (frameErrN < 5) console.error('frame', e); }
function frameInner(): void {
  // v1.9.3: no 30 fps cap in low-graphics mode (it halved smoothness); low mode = 1× pixels
  const prof0 = performance.now();
  if (world && stat) {
    const now = gameNow();
    const meP0 = me(); placed = smoothPeople(placePeople(world, now), meP0?.id ?? null);
    const meP = meP0; const mq = meP ? placed.find((q) => q.p.id === meP.id) : undefined;
    const dt = Math.min(0.1, (performance.now() - lastFrame) / 1000); lastFrame = performance.now();
    if (mq && followCam && !dragStart) { const vw = canvas.width / (cam.z * T), vh = canvas.height / (cam.z * T); const tx = mq.x - vw / 2, ty = mq.y - vh / 2 - 0.5; const k = Math.min(1, dt * 6); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; clampCam(); }
    drawFrame(ctx2d, stat, world, cam, placed, now, selected, me()?.id ?? null, lowGfx ? 0 : darkness(world), walkTarget);
    pendingStep();
    if (walkTarget) { const m = me(); if (m?.walk && now > walkEnd(m.walk) + 300 && !pending) walkTarget = null; }
    if (now - lastHud > 1000) { lastHud = now; renderHud(); soundscape(); insideBanner(); }
    frameExtras();
  }
  const pc = performance.now() - prof0; profAcc.n += 1; profAcc.sum += pc; if (pc > profAcc.max) profAcc.max = pc;
}

let ticking = false; let tickAt = 0;
/** v2.0.2: a heartbeat can never hang the client (the live battle froze when one request never returned: the world stopped updating). */
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), ms))]);
async function tick(): Promise<void> {
  if ((ticking && performance.now() - tickAt < 20_000) || !be.session()) return; ticking = true; tickAt = performance.now();
  try {
    const r = await withTimeout(be.heartbeat(), 15_000); ((window as unknown as { __hb?: number[] }).__hb ??= []).push(Math.round(performance.now()));
    const first = !world; world = r.world;
    if (world.serverNow) { const ns = world.serverNow - Date.now(); skew = first || Math.abs(ns - skew) > 3000 ? ns : skew + (ns - skew) * 0.15; } // smooth clock: no jumps
    const mm = me(); if (localWalk && mm && mm.id === localWalk.id && gameNow() < walkEnd(localWalk.walk) + 15_000) mm.walk = localWalk.walk;
    if (first) { stat = buildStatic(world); const m = me(); const b = m ? world.buildings.find((x) => x.id === m.home) : undefined; if (b) { cam.x = b.x - canvas.width / (cam.z * T) / 2; cam.y = b.y - canvas.height / (cam.z * T) / 2; clampCam(); } }
    if (r.summary) modal(maecenas(r.summary));
    renderDock(); stateNotices(); liveNotices(first); statToasts(first); if (sheet && !sheetPointer) rerenderSheet(); const onb = onboarding(); events(first, onb); trialPopup(); if (!onb) { disasterPopup(); v2Popups(); }
  } catch (e) { console.warn('heartbeat', e); } finally { ticking = false; }
}

async function start(): Promise<void> {
  app.replaceChildren(canvas); hudEl = h('div', { class: 'hud' }); dockEl = h('div', { class: 'dock' }); app.append(hudEl, dockEl); installClickSounds(app);
  setupInput(); setupControls(); addEventListener('imp-refresh', () => { rerenderSheet(true); ctl?.refresh(); });
  await tick();
  setInterval(() => void tick(), be.mode === 'mock' && !location.search.includes('poll6') ? 2500 : 6000);
  setInterval(() => { void be.messages().then((m) => { msgs = m; renderDock(); }); }, 5000);
  setInterval(() => rerenderSheet(), 4000);
  requestAnimationFrame(frame);
}

// ---------------- the Kayzer's citizen register (only at the Saray) ----------------
let citSort: string = 'name'; let citDir = 1; let citFilter = ''; let citProf = '';
function openCitizens(): void {
  openSheet(() => {
    const w = world!; const box = h('div', {}, h('h2', {}, '📋 Vatandaş defteri'));
    if (!atSaray()) { box.append(h('div', { class: 'muted' }, 'Defter Saray’da durur. Saray’a yürüyün.')); return box; }
    const now = gameNow(); const pos = new Map(placed.map((q) => [q.p.id, q]));
    const where = (p: Person): string => { if (p.jailedDays > 0) return 'Zindan/gözaltı'; const q = pos.get(p.id); if (!q || !q.visible) return 'Evinde'; const b = w.buildings.map((x) => ({ x, d: distToBuilding(x, q) })).sort((a, c) => a.d - c.d)[0]; return b && b.d < 4 ? b.x.name : 'Sokakta'; };
    const cols: [string, string, (p: Person) => number | string][] = [['name', 'İsim', (p) => p.name], ['prof', 'Meslek', (p) => PROF_LABEL[p.prof]], ['health', '❤️', (p) => p.health], ['mood', '😊', (p) => p.mood], ['loyalty', '🤝', (p) => p.loyalty], ['din', '🕌', (p) => p.din], ['republic', '🗽', (p) => p.republic], ['money', '👛', (p) => p.money], ['where', '📍', where]];
    const q = h('input', { placeholder: 'İsim ara…', value: citFilter }); q.addEventListener('input', () => { citFilter = q.value; rerenderSheet(true); setTimeout(() => { const i = sheet?.querySelector('input'); if (i) { (i as HTMLInputElement).focus(); (i as HTMLInputElement).setSelectionRange(citFilter.length, citFilter.length); } }, 0); });
    const pf = select([['', 'Tüm meslekler'], ...[...new Set(w.people.map((p) => p.prof))].map((p): [string, string] => [p, PROF_LABEL[p]])]); pf.value = citProf; pf.addEventListener('change', () => { citProf = pf.value; rerenderSheet(true); });
    let list = w.people.filter((p) => p.prof !== 'naip' && (!citFilter || p.name.toLocaleLowerCase('tr').includes(citFilter.toLocaleLowerCase('tr'))) && (!citProf || p.prof === citProf));
    const col = cols.find((c) => c[0] === citSort)!; list = list.sort((a, b) => { const x = col[2](a), y = col[2](b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr')) * citDir; });
    const avg = (f: (p: Person) => number): number => Math.round(list.reduce((s, p) => s + f(p), 0) / Math.max(1, list.length));
    box.append(h('div', { class: 'row' }, q, pf), h('div', { class: 'muted' }, `${list.length} kişi · ort. sağlık ${avg((p) => p.health)} · mutluluk ${avg((p) => p.mood)} · sadakat ${avg((p) => p.loyalty)} · cumhuriyetçilik ${avg((p) => p.republic)}`));
    const MEAN: Record<string, string> = { health: '❤️ Sağlık (0–100): düşükse hasta/yaralı, hekime gitmeli.', mood: '😊 Mutluluk (0–100): açlık, yoksulluk, vergi düşürür.', loyalty: '🤝 Sadakat (0–100): tahta ve devlete bağlılık; düşükse emir dinlemez, isyana yatkın.', din: '🕌 Dindarlık (0–100): camiye gitme, vaaz ve tarikat etkisi.', republic: '🗽 Cumhuriyetçilik (0–100): 70 ve üstü olanlar isyana katılır; halkın %50’si 70+ olursa isyan başlar.', money: '👛 Kesesindeki para (Dinar).', where: '📍 Şu an nerede: bina, sokak, ev ya da zindan.', name: 'İsim · 🎮 = gerçek oyuncu.', prof: 'Meslek.' };
    box.append(h('div', { class: 'row legend', style: 'flex-wrap:wrap;gap:4px' }, ...Object.entries(MEAN).filter(([k]) => k !== 'name' && k !== 'prof').map(([, txt]) => h('button', { class: 'sm', title: txt, onclick: () => toast(txt) }, `${txt.split(' ')[0]} ${txt.split(' ')[1]?.replace(/:$/, '') ?? ''}`)), h('span', { class: 'muted' }, '🎮 gerçek oyuncu · simgeye dokunun: açıklama')));
    const t = h('table', { class: 'citizens' }, h('tr', {}, ...cols.map(([k, l]) => h('th', { style: 'cursor:pointer', title: MEAN[k] ?? '', onclick: () => { toast(MEAN[k] ?? l); if (citSort === k) citDir = -citDir; else { citSort = k; citDir = k === 'name' || k === 'prof' || k === 'where' ? 1 : -1; } rerenderSheet(true); } }, `${l}${citSort === k ? (citDir > 0 ? ' ▲' : ' ▼') : ''}`))));
    for (const p of list) t.append(h('tr', { style: 'cursor:pointer', onclick: () => openPersonSheet(p.id) }, h('td', {}, `${p.name}${p.playerId && !p.npc ? ' 🎮' : ''}`), h('td', {}, PROF_LABEL[p.prof]),
      ...(['health', 'mood', 'loyalty', 'din', 'republic'] as const).map((k) => h('td', { title: MEAN[k], onclick: (e: Event) => { e.stopPropagation(); toast(`${p.name}: ${MEAN[k]!.split(':')[0]} ${Math.round(p[k])}. ${MEAN[k]!.split(':').slice(1).join(':').trim()}`); } }, bar(p[k], k === 'health' ? '#c8483a' : k === 'republic' ? '#4a7fd4' : k === 'loyalty' ? '#e8c14a' : k === 'din' ? '#8a6fd1' : '#5fae5a'), h('small', {}, ` ${Math.round(p[k])}`))),
      h('td', {}, fmt(p.money)), h('td', {}, where(p))));
    void now; box.append(h('div', { style: 'overflow:auto;max-height:60vh' }, t)); return box;
  });
}

// ---------------- corpses, election notices, trials, sounds ----------------
function openCorpse(id: string): void {
  openSheet(() => {
    const w = world!; const co = (w.corpses ?? []).find((c) => c.id === id); if (!co) return h('div', {}, 'Ceset kaldırıldı.');
    const left = Math.max(0, Math.round((co.at + 5 * 60_000 - gameNow()) / 1000));
    const st = co.stage === 'yerde' ? 'Kimse ihbar etmedi.' : co.stage === 'ihbar' ? `${findPerson(w, co.bekciId)?.name ?? 'Bekçi'} olay yerine geliyor.` : co.note ?? 'İnceleniyor.';
    return h('div', {}, h('h2', {}, `💀 ${co.name}`), h('div', { class: 'card' }, `Kanlar içinde yerde yatıyor. ${st}`), h('div', { class: 'muted' }, `Ceset ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} sonra kaldırılacak.`),
      co.stage === 'yerde' ? h('button', { class: 'primary', onclick: () => void doAct({ t: 'report', corpseId: co.id }) }, '☎ Bekçiye ihbar et') : '');
  });
}
function electionInfo(w: World): HTMLElement {
  const d = electionDates(w); const ph = electionPhase(w);
  const row = (k: string, label: string, days: string): HTMLElement => h('tr', { class: ph.phase === k ? 'on' : '' }, h('td', {}, label), h('td', {}, days));
  return h('div', {}, h('h2', {}, '🗳 Meclis Seçim Tabelası'), h('div', { class: 'muted' }, `Bugün ${w.day}. gün. ${ph.label}.`),
    h('table', { class: 'sign' }, row('aday', '1. Adaylık', `${Math.max(1, d.adayFrom)}–${d.adayTo}. gün (Meclis’e gidip aday olun)`), row('propaganda', '2. Propaganda', `${d.propFrom}–${d.propTo}. gün (afiş, meydan konuşması)`), row('oylama', '3. Seçim', `${d.vote}. gün (Meclis ya da Meydan’daki sandık)`)),
    h('div', { class: 'muted' }, `Askerler ve bekçiler aday olamaz. ${w.meclis.seats.length} sandalye. Adaylar: ${w.election.candidates.map((id) => findPerson(w, id)?.name).filter(Boolean).join(', ') || 'henüz yok'}.`));
}
function openElectionSign(): void { openSheet(() => h('div', { class: 'stack' }, electionInfo(world!), electionCard(ctx()))); }
let lastCorpses = new Set<string>(); let lastJail = 0; let lastIsyan = false;
function events(first: boolean, onb = false): void {
  const w = world; const m = me(); if (!w) return;
  // election phase notifications (once per phase)
  const ph = electionPhase(w).phase; const key = `${w.election.nextDay}:${ph}`;
  if (onb) { /* shown after onboarding */ } else if (!first && localStorage.getItem('imp-phase') !== key && ph !== 'bekleme') {
    const msg = ph === 'aday' ? 'Meclis seçimi için ADAYLIK açıldı! Aday olmak isteyen Meclis’e gitsin.' : ph === 'propaganda' ? 'PROPAGANDA dönemi başladı: adaylar afiş asıyor, meydanda konuşuyor.' : 'BUGÜN SEÇİM GÜNÜ! Sandık Meclis’te ve Meydan’da.';
    modal(h('div', {}, h('h2', {}, '🔔 Meclis'), h('p', {}, msg), electionInfo(w))); sfx('bell');
  }
  if (!onb) localStorage.setItem('imp-phase', key);
  const cs = new Set((w.corpses ?? []).map((c) => c.id));
  if (!first) for (const id of cs) if (!lastCorpses.has(id)) { sfx('death'); const co = w.corpses!.find((c) => c.id === id)!; toast(`💀 ${co.name} öldürüldü!`); }
  lastCorpses = cs;
  if (m) { if (m.jailedDays > 0 && lastJail === 0 && !first) sfx('prison'); lastJail = m.jailedDays; }
  if (!!w.isyan !== lastIsyan && !first && w.isyan) sfx('drums'); lastIsyan = !!w.isyan;
}
function soundscape(): void {
  const w = world; if (!w) return;
  setMusicMood(w.hour >= 19 || w.hour < 6 ? 'gece' : 'gun');
  if (w.isyan) ambience('isyan'); else if ((w.festivalUntil ?? 0) >= w.day && w.hour >= 12 && w.hour < 22) ambience('festival');
  else if (w.hour >= 5 && w.hour < 10) ambience('sabah'); else if (w.hour >= 19 && w.hour < 23) ambience('aksam'); else if (w.hour >= 23 || w.hour < 5) ambience('gece'); else ambience('gun');
}
let trialEl: HTMLElement | null = null; const trialSeen = new Set<string>((localStorage.getItem('imp-trial-seen') ?? '').split(',').filter(Boolean));
const tKey = (id: string): string => `${world?.seed ?? 0}:${id}`; // case ids restart after a reset
const markSeen = (id: string): void => { trialSeen.add(tKey(id)); localStorage.setItem('imp-trial-seen', [...trialSeen].slice(-60).join(',')); };
/** v1.9.6: eyewitnesses, the summoned and volunteers speak in the trial chat. */
function witnessBox(c: CourtCase, blamed: boolean): HTMLElement {
  const wi = h('input', { maxlength: '300', placeholder: blamed ? 'Suçlamaya cevap verin…' : 'Ne gördünüz? Tanıklığınızı yazın…', style: 'flex:1' });
  const go = (against: boolean): void => { void send({ t: 'witness', caseId: c.id, against, text: wi.value }).then(() => trialPopup()); wi.value = ''; };
  return h('div', {}, h('div', { class: 'muted' }, blamed ? '❗ Sanık sizi suçladı; mahkemeye çağrıldınız.' : (c.called ?? []).some((x) => x.id === me()?.id) ? '📣 Sanık sizi tanık olarak çağırdı: olay saatinde onu gördünüz mü? Doğruyu söyleyin.' : '👁 Tanıklık yap: sözünüz kararı etkiler.'), h('div', { class: 'row' }, wi),
    h('div', { class: 'row' }, h('button', { class: 'danger', onclick: () => go(true) }, blamed ? 'Sanık yaptı' : 'Aleyhte tanıklık'), h('button', { class: 'primary', onclick: () => go(false) }, blamed ? 'Bilmiyorum, ben yapmadım' : 'Lehte tanıklık')));
}
/** v1.9.8: the defendant picks alibi witnesses; those near him around the crime time come first. */
function openWitnessPicker(c: CourtCase): void {
  const w = world; if (!w) return;
  if ((c.called ?? []).length >= 3) { toast('En fazla 3 tanık çağırabilirsiniz.'); return; }
  const all = witnessCandidates(w, c); const q = h('input', { placeholder: 'İsim ara…', style: 'flex:1' });
  const list = h('div', { class: 'wit-list' });
  const draw = (): void => {
    const t = q.value.toLocaleLowerCase('tr').trim();
    const rows = all.filter((x) => (t ? x.name.toLocaleLowerCase('tr').includes(t) : true)).slice(0, t ? 40 : 25);
    list.replaceChildren(...rows.map((x) => { const p = findPerson(w, x.id); return h('div', { class: 'card row', style: 'align-items:center;gap:8px' }, p ? av2(p, 36) : '', h('div', { style: 'flex:1' }, h('b', {}, x.name), p ? ` · ${PROF_LABEL[p.prof] ?? ''}` : '', h('div', { class: 'muted' }, x.near ? `📍 ${x.hint}` : 'Olay saatine yakın yanınızda görülmedi')), h('button', { class: x.near ? 'primary' : '', onclick: () => { el.remove(); void send({ t: 'callWitness', caseId: c.id, personId: x.id }).then(() => trialPopup()); } }, 'Çağır')); }));
  };
  q.addEventListener('input', draw); draw();
  const el = h('div', { class: 'modal' }, h('div', { class: 'box' }, h('h2', {}, '👥 Tanık çağır'), h('div', { class: 'muted' }, `Olay saati: ${c.crimeH != null ? hLabel(w, c.crimeH) : 'bilinmiyor'}. Tanık, kayıtlı konumlara göre doğruyu söyler: olay saatinde yanınızdaysa lehinize konuşur, değilse “yanımda değildi” der.`), h('div', { class: 'row' }, q), list, h('button', { onclick: () => el.remove() }, 'Kapat')));
  el.style.zIndex = '60'; app.append(el);
}
let disasterSeen = Number(localStorage.getItem('imp-disaster-seen') ?? '0'); let disasterFirst = true;
/** v1.9.6: a disaster pops up for every online player, with vibration. */
function disasterPopup(): void {
  const w = world; if (!w) return;
  const list = (w.notices?.length ? w.notices : w.disaster ? [w.disaster] : []);
  if (disasterFirst) { disasterFirst = false; for (const d of list) if (w.day - d.day > 1) disasterSeen = Math.max(disasterSeen, d.id); }
  const fresh = list.filter((d) => d.id > disasterSeen).slice(-3); if (!fresh.length) return;
  disasterSeen = Math.max(...fresh.map((d) => d.id)); localStorage.setItem('imp-disaster-seen', String(disasterSeen));
  try { navigator.vibrate?.([300, 120, 300, 120, 300]); } catch { /* no vibration */ }
  sfx('drums');
  const m = me(); const ruler = !!m && w.kayzerId === m.id;
  for (const d of fresh) {
    const close = (): void => el.remove();
    const opts = eventOptions(d.kind, { w, me: m, ruler, act: (a) => void doAct(a), goTo: (bid) => { const b = w.buildings.find((x) => x.id === bid); if (b) { walkTo(doorSpot(b)); openSheet(() => bPanel(b)); } } }, close);
    const el = h('div', { class: 'modal disaster' }, h('div', { class: 'box' }, h('h2', {}, eventTitle(d.kind)), h('div', { class: 'card warn' }, h('b', {}, d.text)), ...opts, h('button', { class: opts.length ? '' : 'primary', onclick: close }, 'Anladım')));
    app.append(el);
  }
}
let newsShown = false; let namePrompted = false;
/** v2.0: “Neler yeni?” once per player (server-tracked), and the Kayzer names the empire. */
function v2Popups(): void {
  const w = world; const m = me(); const s = be.session(); if (!w || !m || !s) return;
  if (anyModal()) return;
  if (!namePrompted && !w.empireName && w.kayzerId === m.id && !document.querySelector('.whatsnew')) { namePrompted = true; app.append(empireNameModal(nameSend)); }
}
async function nameSend(name: string): Promise<string | null> { const r = await be.act({ t: 'nameEmpire', name } as never); if (!r.ok) return r.msg; await tick(); return null; }
function trialPopup(): void {
  const w = world; const m = me(); if (!w || !m) return;
  const c: CourtCase | undefined = w.cases.find((x) => x.trial && (x.accusedId === m.id || x.trial.judgeId === m.id || x.trial.prosecutorId === m.id || x.trial.blamedId === m.id || (x.eyeIds ?? []).includes(m.id) || (x.witnesses ?? []).some((v) => v.id === m.id) || (x.called ?? []).some((v) => v.id === m.id)) && (!x.trial.done || (!trialSeen.has(tKey(x.id)) && x.stage !== 'kapandi' ? true : !trialSeen.has(tKey(x.id)) && gameNow() - (x.trial.doneAt ?? 0) < 120_000)) && !(x.trial.done && x.verdict === 'dusuruldu' && x.sentence?.startsWith('Aynı olay')));
  if (!c?.trial) { trialEl?.remove(); trialEl = null; return; }
  if (trialEl?.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') { const n = trialEl.querySelectorAll('.msg').length; if (n === c.trial.msgs.length) return; }
  const tr = c.trial; const role = (id: string | null, label: string): HTMLElement => { const p = findPerson(w, id); return h('div', { class: 'role' }, p ? av2(p, 56) : h('div', { class: 'avatar' }), h('b', {}, label), h('div', { class: 'muted' }, p?.name ?? '—')); };
  const acc = findPerson(w, c.accusedId);
  const left = Math.max(0, Math.round((tr.until - gameNow()) / 1000));
  const list = h('div', { class: 'msgs' }, ...tr.msgs.map((x) => h('div', { class: `msg ${x.who}` }, h('b', {}, `${x.who === 'hakim' ? '⚖ ' : x.who === 'savci' ? '📜 ' : x.who === 'tanik' ? '👁 ' : x.who === 'suclanan' ? '❗ ' : '🙋 '}${x.name}`), ': ', x.text)));
  if (tr.pending) list.append(h('div', { class: 'muted typing' }, 'Kadı düşünüyor…'));
  const inp = h('input', { maxlength: '300', placeholder: 'Kendinizi savunun… (tanık, mazeret, pişmanlık)', style: 'flex:1' });
  const go = async (): Promise<void> => { const t = inp.value; if (!t.trim()) return; inp.value = ''; await send({ t: 'defense', caseId: c.id, text: t }); trialPopup(); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') void go(); });
  const box = h('div', { class: 'box trial' }, h('h2', {}, `⚖ Duruşma: ${CRIME_LABEL[c.crime]} – ${acc?.name ?? ''}`),
    h('div', { class: 'roles' }, role(tr.judgeId, 'Kadı'), role(tr.prosecutorId, 'Savcı'), role(c.accusedId, 'Sanık')), list,
    tr.done ? h('div', { class: 'card verdict' }, h('b', {}, tr.verdictText ?? 'Karar verildi.'), h('div', { style: 'margin-top:8px' }, h('button', { class: 'primary', onclick: () => { markSeen(c.id); trialEl?.remove(); trialEl = null; } }, 'Tamam')))
      : c.accusedId === m.id ? h('div', {}, h('div', { class: 'row' }, inp, h('button', { class: 'primary', onclick: () => void go() }, 'Savun')), h('div', { class: 'row' }, h('span', { class: 'muted' }, `Kalan süre ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · en fazla 5 söz`), h('button', { onclick: () => openWitnessPicker(c) }, `👥 Tanık çağır (${3 - (c.called ?? []).length})`), h('button', { onclick: () => void send({ t: 'restCase', caseId: c.id }) }, 'Savunmam bitti, karar verilsin')))
        : tr.judgeId === m.id || tr.prosecutorId === m.id ? h('div', { class: 'muted' }, 'Duruşmayı izliyorsunuz.') : witnessBox(c, tr.blamedId === m.id));
  const wasDone = trialEl?.dataset.done === '1';
  const el = h('div', { class: 'modal trial-modal' }, box); el.dataset.done = tr.done ? '1' : '0';
  if (trialEl) trialEl.replaceWith(el); else { app.append(el); sfx('gavel'); }
  trialEl = el; if (tr.done && !wasDone) sfx('gavel');
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
}
void ({} as Corpse);

installIconify();
void be.restore().then((s) => (s ? start() : loginScreen()));
// expose for headless smoke tests
(window as unknown as { __imp: () => unknown }).__imp = () => ({ profile: () => ({ frameCpuAvgMs: +(profAcc.sum / Math.max(1, profAcc.n)).toFixed(2), frameCpuMaxMs: +profAcc.max.toFixed(1) }), mood: musicMood, mute: setMuted, sel: () => ({ b: selB, p: selPerson }), look: (x: number, y: number) => { followCam = false; cam.x = x - canvas.width / (cam.z * T) / 2; cam.y = y - canvas.height / (cam.z * T) / 2; }, act: doAct, openB: (id: string) => { const b = world!.buildings.find((x) => x.id === id); if (b) openSheet(() => bPanel(b)); }, menu: openMenu, admin: openAdmin, world, me: me()?.name, goods: GOODS.map((g) => GOOD_LABEL[g]), avatar: !!avatar, placed: placed.map((q) => [q.p.id, q.x, q.y, q.visible]), toScreen: (x: number, y: number) => { const r = canvas.getBoundingClientRect(); return [r.left + (x - cam.x) * cam.z * T / (lowGfx ? 1 : Math.min(2, window.devicePixelRatio || 1)), r.top + (y - cam.y) * cam.z * T / (lowGfx ? 1 : Math.min(2, window.devicePixelRatio || 1))]; } });

// ---- v1.9 landscape: rotate overlay (phones in portrait) + low-graphics class ----
document.body.classList.toggle('low', lowGfx);
document.body.append(h('div', { class: 'rotate-ov' }, ic('phone'), h('b', {}, 'Telefonu yatay çevirin'), h('div', { class: 'muted' }, 'Medieval Empire yatay ekranda oynanır.')));
try { void (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {}); } catch { /* only in fullscreen / installed PWA */ }
// ---- v1.8 PWA: service worker (static only) + "Ana ekrana ekle" hint ----
if ('serviceWorker' in navigator && location.protocol === 'https:') void navigator.serviceWorker.register('./sw.js').catch(() => {});
let installEvt: (Event & { prompt?: () => void }) | null = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; showInstallHint(); });
function showInstallHint(): void { if ((window as unknown as { Capacitor?: unknown }).Capacitor || /wv\)/.test(navigator.userAgent)) return; // inside the Android app
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone;
  if (standalone || localStorage.getItem('imp-a2hs') === '1' || document.querySelector('.a2hs')) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); if (!ios && !installEvt) return;
  const close = (): void => { localStorage.setItem('imp-a2hs', '1'); el.remove(); };
  const el = h('div', { class: 'a2hs' }, ios ? 'Tam ekran için: Safari’de Paylaş → “Ana Ekrana Ekle”.' : 'Oyunu ana ekrana ekleyip tam ekran oynayabilirsiniz.',
    !ios && installEvt ? h('button', { class: 'primary', onclick: () => { installEvt?.prompt?.(); close(); } }, 'Ana ekrana ekle') : '', h('button', { onclick: close }, '✕'));
  document.body.append(el); setTimeout(close, 15000);
}
setTimeout(showInstallHint, 8000);
