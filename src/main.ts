import './ui/style.css';
import type { Action, Person, Profession, World } from './sim/types';
import { GOODS } from './sim/types';
import { GOOD_LABEL, MAP_H, MAP_W, PLAYER_PROFS, PROF_LABEL, ONLINE_WINDOW_MS } from './sim/constants';
import { findPerson } from './sim/world';
import { officeOf } from './sim/actions';
import { makeBackend } from './backend';
import type { Backend } from './backend/api';
import { MOCK_FOUNDER_EMAIL } from './backend/mock';
import { buildStatic, drawFrame, hitTest, placePeople, T, type Camera, type Placed } from './ui/map';
import { bar, fmt, h, select } from './ui/dom';
import { avatar, buildingPanel, familyPanel, isyanBar, personCard, type Ctx } from './ui/panels';
import { GUIDE, RULES } from './ui/texts';
import { feedPanel, hudChips, quickPanel } from './ui/life';
import type { Candidate, ChatMsg } from './server/core';
import { makeSprite } from './ui/sprites';

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
let msgs: ChatMsg[] = []; let seenMsgs = 0; let dmTarget: string | null = null;
let skew = 0; // server clock minus client clock, so the map animation never freezes on a wrong local clock
const gameNow = (): number => Date.now() + skew;

function me(): Person | null { const s = be.session(); if (!world || !s) return null; const pl = world.players[s.playerId]; return pl ? findPerson(world, pl.personId) ?? null : null; }
function toast(text: string): void { const t = h('div', { class: 'toast' }, text); app.append(t); setTimeout(() => t.remove(), 2600); }

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
      h('h1', { style: 'margin:0;color:#e8c14a' }, '👑 İmparatorluk'),
      h('div', { class: 'muted' }, 'Davetlilere açık, ortak ve hiç durmayan bir dünya.'),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: mode === 'giris' ? 'primary' : '', onclick: () => { mode = 'giris'; render(); } }, 'Giriş'), h('button', { class: mode === 'kayit' ? 'primary' : '', onclick: () => { mode = 'kayit'; render(); } }, 'Davetle kayıt')),
      ...(mode === 'kayit' ? [h('label', {}, 'Davet şifresi (kurucudan alın)'), access,
        h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: start_ === 'yeni' ? 'primary' : '', onclick: () => { start_ = 'yeni'; render(); } }, '🏠 Yeni vatandaş'), h('button', { class: start_ === 'devral' ? 'primary' : '', onclick: () => { start_ = 'devral'; render(); } }, '🧑 Var olan birini devral')),
        ...(start_ === 'yeni' ? [h('label', {}, 'Oyundaki adınız'), name, h('label', {}, 'Mesleğiniz'), prof, h('div', { class: 'muted' }, 'Boş bir evde, 40 Dinar ile başlarsınız; ilk 5 gün dokunulmazsınız. Sarraftan borç alabilirsiniz.')] : devralUi()),
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
  return { w: world!, me: me(), founder: !!be.session()?.founder, act: (a) => void doAct(a), dm: (id) => { dmTarget = id; openChat(); }, openPerson: (id) => openPersonSheet(id) };
}
async function doAct(a: Action): Promise<void> {
  const r = await be.act(a); toast(r.msg); await tick(); rerenderSheet();
}
function openSheet(render: () => HTMLElement): void {
  sheetRender = render; rerenderSheet(true);
}
function rerenderSheet(force = false): void {
  if (!sheetRender) return;
  if (!force && sheet && (sheet.contains(document.activeElement) && document.activeElement !== document.body)) return; // don't clobber typing
  const scroll = sheet?.scrollTop ?? 0;
  const s = h('div', { class: 'sheet' }, h('button', { class: 'close', onclick: closeSheet }, '✕'), sheetRender());
  if (sheet) sheet.replaceWith(s); else app.append(s);
  sheet = s; if (!force) s.scrollTop = scroll;
}
function closeSheet(): void { sheet?.remove(); sheet = null; sheetRender = null; selected = null; }
function openPersonSheet(id: string): void {
  selected = id;
  openSheet(() => { const p = findPerson(world!, id); return p ? personCard(ctx(), p) : h('div', {}, 'Kişi yok.'); });
}

function modal(content: HTMLElement, onClose?: () => void): void {
  const m = h('div', { class: 'modal' }); const close = (): void => { m.remove(); onClose?.(); };
  m.append(h('div', { class: 'box' }, content, h('div', { style: 'margin-top:12px;text-align:right' }, h('button', { class: 'primary', onclick: close }, 'Tamam'))));
  app.append(m);
}
function maecenas(text: string | HTMLElement): HTMLElement { return h('div', { class: 'maecenas' }, h('div', { class: 'who' }, '🏛'), h('div', {}, h('b', { style: 'color:#e8c14a' }, 'Maecenas'), typeof text === 'string' ? h('pre', { class: 'summary' }, text) : text)); }

function guide(step = 0): void {
  if (step >= GUIDE.length) { localStorage.setItem('imp-guide-done', '1'); return; }
  modal(maecenas(`${GUIDE[step]!}\n\n(${step + 1}/${GUIDE.length})`), () => guide(step + 1));
}

function renderHud(): void {
  const w = world; if (!w) return; const m = me();
  const citizens = w.people.filter((p) => p.prof !== 'naip' && p.prof !== 'kayzer');
  const mood = citizens.reduce((s, p) => s + p.mood, 0) / Math.max(1, citizens.length);
  const k = findPerson(w, w.kayzerId);
  const now = Date.now();
  const online = Object.values(w.players).filter((p) => now - p.lastSeen < ONLINE_WINDOW_MS).length;
  const kOnline = k?.playerId ? now - (w.players[k.playerId]?.lastSeen ?? 0) < ONLINE_WINDOW_MS : false;
  const loy = citizens.reduce((s, p) => s + p.loyalty, 0) / Math.max(1, citizens.length);
  hudEl.replaceChildren(
    ...hudChips(ctx()),
    h('span', { class: 'stat', title: 'Hazine' }, `🏦 ${fmt(w.treasury)} D`),
    m ? h('span', { class: 'stat', title: 'Keseniz' }, `👛 ${fmt(m.money)} D`) : '',
    h('span', { class: 'stat', title: 'Şehrin ortalama mutluluğu (kişisel hayat)' }, '😊 ', bar(mood, '#5fae5a')),
    h('span', { class: 'stat', title: 'Şehrin devletten memnuniyeti' }, '👍 ', bar(loy, '#e8c14a')),
    w.regime === 'imparatorluk' ? h('span', { class: 'stat', title: 'Cumhuriyet isteği' }, '🗽 ', bar(w.cumhuriyet, '#5a8ad0'), ` ${Math.round(w.cumhuriyet)}`) : '',
    h('span', { class: 'stat' }, w.regime === 'cumhuriyet' ? (k ? (kOnline ? `🗽 Başkan ${k.name}` : `🗽 Başkan ${k.name} · Naip Maecenas`) : '🗽 Cumhuriyet · seçim bekleniyor') : k ? (kOnline ? `👑 ${k.name}` : findPerson(w, k.spouse) ? `👑 ${findPerson(w, k.spouse)!.name} yönetiyor (eş)` : '🏛 Naip Maecenas yönetiyor') : '🏛 Naip'),
    h('span', { class: 'stat' }, `🟢 ${online} çevrimiçi`),
    h('span', { class: 'grow' }),
    m ? h('span', { class: 'stat' }, `${m.name} · ${officeOf(w, m)}`) : '',
  );
  void now;
  const ib = isyanBar(ctx()); if (ib) hudEl.append(ib);
}

function renderDock(): void {
  const unread = msgs.length - seenMsgs;
  const pending = world && me() && world.kayzerId === me()!.id ? world.petitions.filter((p) => p.status === 'bekliyor').length : 0;
  dockEl.replaceChildren(
    h('button', { class: 'primary', title: 'Şu an yapabileceğiniz her şey', onclick: () => openSheet(() => quickPanel(ctx())) }, '⚡', h('span', { class: 'lbl' }, ' Ne yapabilirim?'), world && me() && (world.offers.some((o) => o.to === me()!.id) || world.arrests.some((a) => a.status === 'bekliyor' && (a.criminalId === me()!.id || a.catcherId === me()!.id))) ? h('span', { class: 'badge' }, '!') : ''),
    h('button', { onclick: () => { const m = me(); if (m) openPersonSheet(m.id); } }, '👤', h('span', { class: 'lbl' }, ' Ben')),
    h('button', { onclick: () => openSheet(() => buildingPanel(ctx(), world!.buildings.find((b) => b.id === 'saray')!)) }, '🏰', h('span', { class: 'lbl' }, ' Saray'), pending ? h('span', { class: 'badge' }, String(pending)) : ''),
    h('button', { onclick: () => openSheet(() => buildingPanel(ctx(), world!.buildings.find((b) => b.id === 'meclis')!)) }, '🏛', h('span', { class: 'lbl' }, ' Meclis')),
    h('button', { onclick: () => openSheet(() => familyPanel(ctx())) }, '👪', h('span', { class: 'lbl' }, ' Aile'), world && me() && world.proposals.some((x) => x.to === me()!.id) ? h('span', { class: 'badge' }, '!') : ''),
    h('button', { onclick: openGazette }, '📜', h('span', { class: 'lbl' }, ' Gazete')),
    h('button', { onclick: () => openSheet(() => feedPanel(ctx())) }, '📣', h('span', { class: 'lbl' }, ' Olaylar')),
    h('button', { onclick: () => { dmTarget = null; openChat(); } }, '💬', h('span', { class: 'lbl' }, ' Meydan'), unread > 0 ? h('span', { class: 'badge' }, String(unread)) : ''),
    h('button', { onclick: openRules }, '📖', h('span', { class: 'lbl' }, ' Kurallar')),
    h('button', { onclick: () => guide(0) }, '❓'),
    be.session()?.founder ? h('button', { onclick: openAdmin }, '🛠') : '',
    h('button', { onclick: () => { void be.logout().then(loginScreen); } }, '🚪'),
  );
}

function openGazette(): void {
  openSheet(() => {
    const w = world!; const box = h('div', {}, h('h2', {}, '📜 İmparatorluk Gazetesi'), h('div', { class: 'muted' }, 'Kalemşörler ve Maecenas her gün yazar.'));
    for (const g of [...w.gazette].reverse().slice(0, 10)) box.append(h('div', { class: 'card' }, h('b', {}, `Gün ${g.day}: ${g.headline}`), ...g.lines.map((l) => h('div', { class: 'muted' }, l)), ...(g.meclis?.length ? [h('div', { class: 'muted', style: 'margin-top:4px' }, '🏛 Meclis:'), ...g.meclis.map((l) => h('div', { class: 'muted' }, `• ${l}`))] : [])));
    if (!w.gazette.length) box.append(h('div', { class: 'muted' }, 'İlk sayı gün sonunda çıkacak.'));
    box.append(h('h3', {}, 'Bugün olanlar'), ...w.events.slice(-12).reverse().map((e) => h('div', { class: 'msg' }, `${String(e.hour).padStart(2, '0')}:00 ${e.text}`)));
    return box;
  });
}
function openRules(): void {
  openSheet(() => h('div', {}, h('h2', {}, '📖 Kurallar ve kullanım'), ...RULES.flatMap(([t, ls]) => [h('h3', {}, t), ...ls.map((l) => h('div', { class: 'msg' }, l))])));
}
function openChat(): void {
  seenMsgs = msgs.length;
  openSheet(() => {
    const w = world!; const meP = me();
    const to = dmTarget ? findPerson(w, dmTarget) : null;
    const list = h('div', { class: 'msgs' });
    const shown = msgs.filter((m) => (to ? (m.toPersonId === to.id && m.fromPersonId === meP?.id) || (m.fromPersonId === to.id && m.toPersonId === meP?.id) : m.toPersonId === null));
    for (const m of shown.slice(-60)) { const npc = findPerson(w, m.fromPersonId); list.append(h('div', { class: `msg${m.toPersonId ? ' dm' : ''}` }, h('b', { style: 'cursor:pointer', onclick: () => openPersonSheet(m.fromPersonId) }, m.fromName), npc && !npc.playerId ? h('span', { class: 'muted' }, ' (NPC)') : '', ': ', m.text)); }
    const inp = h('input', { maxlength: '280', placeholder: to ? `${to.name}'a özel mesaj…` : 'Meydanda herkese…', style: 'flex:1' });
    const send = async (): Promise<void> => { const e = await be.chat(inp.value, dmTarget); if (e) toast(e); else { inp.value = ''; msgs = await be.messages(); seenMsgs = msgs.length; rerenderSheet(true); } };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') void send(); });
    const dms = [...new Set(msgs.filter((m) => m.toPersonId).map((m) => (m.fromPersonId === meP?.id ? m.toPersonId! : m.fromPersonId)))];
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
    return h('div', {}, h('h2', {}, to ? `✉️ ${to.name}` : '💬', h('span', { class: 'lbl' }, ' Meydan')),
      h('div', { class: 'row' }, h('button', { class: to ? '' : 'primary', onclick: () => { dmTarget = null; rerenderSheet(true); } }, 'Meydan'), ...dms.map((id) => h('button', { class: dmTarget === id ? 'primary' : '', onclick: () => { dmTarget = id; rerenderSheet(true); } }, findPerson(w, id)?.name ?? '?'))),
      list, h('div', { class: 'row' }, inp, h('button', { class: 'primary', onclick: () => void send() }, 'Gönder')),
      h('div', { class: 'muted' }, 'NPC’ler de Meydan’da konuşur ve size cevap verir; birine özel yazmak için kartından ✉️ Mesaj. Küfür filtrelenir; 30 saniyede en fazla 5 mesaj.'));
  });
}

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
    void be.snapshots().then((ss) => { snapBox.replaceChildren(...(ss.length ? ss.map((s) => h('div', { class: 'row card' }, `Gün ${s.day} · ${new Date(s.at).toLocaleString('tr-TR')}`, h('button', { class: 'danger', onclick: () => { if (confirm('Dünya bu yedeğe dönecek. Emin misiniz?')) void run({ t: 'restoreSnapshot', id: s.id }); } }, 'Geri yükle'))) : [h('div', { class: 'muted' }, 'Henüz yedek yok.')])); });
    box.append(h('h3', {}, 'Yedekler (3 günde bir otomatik, son 8)'), h('button', { onclick: () => void run({ t: 'snapshot' }) }, 'Şimdi yedek al'), snapBox);
    return box;
  });
}

// ---------------- input: pan / zoom / tap ----------------
const pointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
let pinch: { d: number; z: number } | null = null;
function clampCam(): void {
  const vw = canvas.width / (cam.z * T), vh = canvas.height / (cam.z * T);
  cam.x = Math.max(-2, Math.min(MAP_W - vw + 2, cam.x)); cam.y = Math.max(-3, Math.min(MAP_H - vh + 2, cam.y));
}
function zoomAt(sx: number, sy: number, nz: number): void {
  const z0 = cam.z; nz = Math.max(1, Math.min(5, nz));
  const wx = cam.x + sx / (z0 * T), wy = cam.y + sy / (z0 * T);
  cam.z = nz; cam.x = wx - sx / (nz * T); cam.y = wy - sy / (nz * T); clampCam();
}
function setupInput(): void {
  const dpr = (): number => window.devicePixelRatio || 1;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) dragStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; else { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: cam.z }; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); zoomAt((a!.x + b!.x) / 2 * dpr(), (a!.y + b!.y) / 2 * dpr(), pinch.z * d / pinch.d); if (dragStart) dragStart.moved = true; return; }
    if (dragStart) { const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y; if (Math.abs(dx) + Math.abs(dy) > 6) dragStart.moved = true; cam.x = dragStart.cx - dx * dpr() / (cam.z * T); cam.y = dragStart.cy - dy * dpr() / (cam.z * T); clampCam(); }
  });
  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0 && dragStart) {
      if (!dragStart.moved && world) {
        const r = canvas.getBoundingClientRect(); const hit = hitTest(world, placed, cam, (e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr());
        if (hit.person) openPersonSheet(hit.person.id);
        else if (hit.building) { const b = hit.building; selected = null; openSheet(() => buildingPanel(ctx(), b)); }
        else closeSheet();
      }
      dragStart = null;
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt((e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr(), cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  const resize = (): void => { canvas.width = Math.round(innerWidth * dpr()); canvas.height = Math.round(innerHeight * dpr()); clampCam(); };
  addEventListener('resize', resize); resize();
}

function darkness(w: World): number {
  const t = w.hour; if (t >= 21 || t < 5) return 0.45; if (t >= 19) return (t - 19) / 2 * 0.45; if (t < 7) return (7 - t) / 2 * 0.45; return 0;
}

let lastHud = 0;
function frame(): void {
  if (world && stat) {
    const now = gameNow();
    placed = placePeople(world, now);
    drawFrame(ctx2d, stat, world, cam, placed, now, selected, me()?.id ?? null, darkness(world));
    if (now - lastHud > 1000) { lastHud = now; renderHud(); }
  }
  requestAnimationFrame(frame);
}

let ticking = false;
async function tick(): Promise<void> {
  if (ticking || !be.session()) return; ticking = true;
  try {
    const r = await be.heartbeat();
    const first = !world; world = r.world;
    if (world.serverNow) skew = world.serverNow - Date.now();
    if (first) { stat = buildStatic(world); const m = me(); const b = m ? world.buildings.find((x) => x.id === m.home) : undefined; if (b) { cam.x = b.x - canvas.width / (cam.z * T) / 2; cam.y = b.y - canvas.height / (cam.z * T) / 2; clampCam(); } }
    if (r.summary) modal(maecenas(r.summary));
    renderDock();
  } catch (e) { console.warn('heartbeat', e); } finally { ticking = false; }
}

async function start(): Promise<void> {
  app.replaceChildren(canvas); hudEl = h('div', { class: 'hud' }); dockEl = h('div', { class: 'dock' }); app.append(hudEl, dockEl);
  setupInput();
  await tick();
  if (!localStorage.getItem('imp-guide-done')) guide(0);
  setInterval(() => void tick(), be.mode === 'mock' ? 2500 : 6000);
  setInterval(() => { void be.messages().then((m) => { msgs = m; renderDock(); }); }, 5000);
  setInterval(() => rerenderSheet(), 4000);
  requestAnimationFrame(frame);
}

void be.restore().then((s) => (s ? start() : loginScreen()));
// expose for headless smoke tests
(window as unknown as { __imp: () => unknown }).__imp = () => ({ world, me: me()?.name, goods: GOODS.map((g) => GOOD_LABEL[g]), avatar: !!avatar, placed: placed.map((q) => [q.p.id, q.x, q.y, q.visible]) });
