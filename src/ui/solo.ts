/**
 * v2.1.0 tek kişilik: start menu (Devam Et / Yeni Oyun / Kaydı içe aktar), Ayarlar → Kayıt section
 * (dışa/içe aktar, bulut yedeği), file export that also works inside the Android app, and the update check.
 */
import { h, select } from './dom';
import { askConfirm } from './modal';
import { PLAYER_PROFS, PROF_LABEL } from '../sim/constants';
import type { Profession } from '../sim/types';
import type { SoloBackend } from '../backend/solo';
import { exportName, fileText } from '../backend/save';
import { makeCloud, type CloudSave } from '../backend/cloud';
import { randomEmpireName } from '../sim/solostart';

type Toast = (t: string, ms?: number) => void;
const ago = (t: number): string => { const m = Math.round((Date.now() - t) / 60_000); return m < 1 ? 'az önce' : m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.round(m / 60)} saat önce` : new Date(t).toLocaleDateString('tr-TR'); };

/** The start screen. Calls onStart() once a game is loaded/created. */
export function soloMenu(app: HTMLElement, be: SoloBackend, onStart: () => void, toast: Toast): void {
  app.replaceChildren(); document.body.classList.add('on-login');
  const box = h('div', { class: 'box solo-menu' }); app.append(h('div', { class: 'login' }, box));
  const err = h('div', { style: 'color:#ff8a7a;min-height:20px;margin-top:6px' });
  const head = (): HTMLElement[] => [h('h1', { style: 'margin:0;color:#e8c14a' }, '👑 Medieval Empire'), h('div', { class: 'muted' }, 'Tek kişilik ortaçağ hayat ve strateji oyunu. İnternetsiz oynanır; dünya sadece oyun açıkken akar.')];
  const main = async (): Promise<void> => {
    const info = await be.saveInfo().catch(() => null);
    const imp = importButton(be, async () => { onStart(); }, (t) => { err.textContent = t; }, false);
    box.replaceChildren(...head(),
      info ? h('div', { style: 'margin-top:12px' }, h('button', { class: 'primary big', onclick: async () => { err.textContent = 'Yükleniyor…'; const s = await be.continueGame().catch(() => null); if (!s) { err.textContent = 'Kayıt açılamadı. Üç otomatik kaydın hiçbiri okunamadı; dışa aktardığınız bir dosyayı içe aktarabilirsiniz.'; return; } onStart(); } }, `▶ Devam Et`),
        h('div', { class: 'muted' }, `${info.name} · Gün ${info.day} · ${ago(info.savedAt)} kaydedildi`)) : '',
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: info ? '' : 'primary big', onclick: () => newGame(!!info) }, '🏠 Yeni Oyun'), imp, cloudLoadButton(be, onStart, toast)),
      err);
  };
  const newGame = (hasSave: boolean): void => {
    let start: 'halk' | 'kayzer' = 'halk';
    const name = h('input', { maxlength: '24', placeholder: 'ör. Ahmet Enes', autocomplete: 'off' });
    const prof = select(PLAYER_PROFS.map((p): [string, string] => [p, PROF_LABEL[p]]), 'hamal');
    const emp = h('input', { maxlength: '40', placeholder: 'ör. Anadolu Kayzerliği', autocomplete: 'off', class: 'empire-name' });
    const rnd = h('button', { onclick: () => { emp.value = randomEmpireName(Math.random, emp.value); } }, '🎲 Rastgele');
    const bHalk = h('button', { class: 'primary start-halk', onclick: () => setStart('halk') }, '🧑‍🌾 Halktan biri olarak başla');
    const bKayzer = h('button', { class: 'start-kayzer', onclick: () => setStart('kayzer') }, '👑 Kayzer olarak başla');
    const info = h('div', { class: 'muted' });
    const halkBox = h('div', {}, h('label', {}, 'Başlangıç işi'), prof);
    const kayzerBox = h('div', {}, h('label', {}, 'Devletinizin adı'), h('div', { class: 'row' }, emp, rnd));
    const setStart = (s0: 'halk' | 'kayzer'): void => {
      start = s0; bHalk.className = `start-halk${s0 === 'halk' ? ' primary' : ''}`; bKayzer.className = `start-kayzer${s0 === 'kayzer' ? ' primary' : ''}`;
      halkBox.style.display = s0 === 'halk' ? '' : 'none'; kayzerBox.style.display = s0 === 'kayzer' ? '' : 'none';
      info.textContent = s0 === 'halk'
        ? 'Tahtta rastgele bir Kayzer oturur (adil, zalim, cimri, cömert ya da dindar; yönetimi gerçekten buna göre değişir) ve devletin adı da rastgele seçilir. Tahta siz de çıkabilirsiniz: halkı örgütleyip isyanla, Kayzer ailesine evlenerek (eş/varis olarak) ya da cumhuriyet ilan edilirse Başkan seçilerek.'
        : 'Tahtta siz oturursunuz: vergi, genelge, narh, ithalat, ordu ve bütün Kayzer araçları sizde. Ama halk memnun değilse NPC’ler cemiyet kurup isyanla sizi devirebilir.';
      if (s0 === 'kayzer' && !emp.value) emp.value = randomEmpireName();
    };
    const go = async (): Promise<void> => {
      if (hasSave && !(await askConfirm('Yeni oyun başlarsa kayıtlı oyununuzun üzerine yazılır (son 3 otomatik kayıt da sırayla yenilenir). Saklamak isterseniz önce Ayarlar → Kayıt → “Kaydı dışa aktar” yapın.', 'Yeni oyuna başla'))) return;
      err.textContent = 'Dünya kuruluyor…'; await new Promise((r) => setTimeout(r, 30));
      const e = await be.newGame(name.value, prof.value as Profession, { start, empireName: emp.value }); if (e) { err.textContent = e; return; }
      onStart();
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') void go(); });
    box.replaceChildren(...head(), h('h2', {}, '🏠 Yeni Oyun'),
      h('label', {}, 'Adınız'), name,
      h('div', { class: 'row', style: 'margin-top:8px' }, bHalk, bKayzer), info, halkBox, kayzerBox,
      h('div', { class: 'muted' }, 'Sonraki ekranda cinsiyet, soyadı, yaş, köken ve görünüşünüzü seçersiniz. Şehirdeki herkes (Meclis, partiler, tüccarlar) yapay zekâyla yaşar.'),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { onclick: () => void main() }, '← Geri'), h('button', { class: 'primary', onclick: () => void go() }, 'Başla')), err);
    setStart('halk');
    setTimeout(() => name.focus(), 50);
  };
  // a reload after 'Yeni Oyun' / an import in game lands here directly
  let flag: string | null = null; try { flag = sessionStorage.getItem('imp-newgame') ? 'new' : sessionStorage.getItem('imp-continue') ? 'cont' : null; sessionStorage.removeItem('imp-newgame'); sessionStorage.removeItem('imp-continue'); } catch { /* */ }
  if (flag === 'new') newGame(false);
  else if (flag === 'cont') void be.continueGame().then((s) => (s ? onStart() : void main()), () => void main());
  else void main();
}

// ---------- files ----------
interface CapFs { writeFile(o: { path: string; data: string; directory: string; encoding?: string }): Promise<{ uri: string }> }
interface CapShare { share(o: { title?: string; url?: string; files?: string[]; dialogTitle?: string }): Promise<unknown> }
type CapG = { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean; Plugins?: Record<string, unknown>; registerPlugin?: (n: string) => unknown };
/** native plugins of the Android app (v2.1.0 APK ships Filesystem + Share; older APKs have none → text copy fallback) */
const cap = (): { Filesystem?: CapFs; Share?: CapShare } | null => {
  const c = (window as unknown as { Capacitor?: CapG }).Capacitor; if (!c?.isNativePlatform?.()) return null;
  const get = <T,>(n: string): T | undefined => (c.isPluginAvailable && !c.isPluginAvailable(n) ? undefined : ((c.Plugins?.[n] ?? c.registerPlugin?.(n)) as T | undefined));
  return { Filesystem: get<CapFs>('Filesystem'), Share: get<CapShare>('Share') };
};

/** Download the save as a .json file. In the Android app: write it with the Filesystem plugin and open the share sheet. */
export async function exportSave(be: SoloBackend, toast: Toast): Promise<void> {
  await be.saveNow(); const s = be.exportString(); if (!s) { toast('Kayıt yok.'); return; }
  const name = exportName(be.day());
  const p = cap();
  if (p?.Filesystem) {
    try {
      const r = await p.Filesystem.writeFile({ path: name, data: s, directory: 'CACHE', encoding: 'utf8' });
      if (p.Share) await p.Share.share({ title: name, url: r.uri, dialogTitle: 'Kaydı nereye kaydedeyim?' }).catch(() => undefined);
      else { await p.Filesystem.writeFile({ path: name, data: s, directory: 'DOCUMENTS', encoding: 'utf8' }); toast(`Belgeler klasörüne kaydedildi: ${name}`, 5000); }
      return;
    } catch (e) { console.warn('cap export', e); }
  }
  if (cap() || /wv\)/.test(navigator.userAgent)) { copyBox(s, name); return; } // old app without the file plugins: copy as text
  const url = URL.createObjectURL(new Blob([s], { type: 'application/json' }));
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
  toast(`İndirildi: ${name}`, 4000);
}
function copyBox(s: string, name: string): void {
  const ta = h('textarea', { readonly: true, style: 'width:100%;height:120px;font-size:11px' }); ta.value = s;
  const el = h('div', { class: 'modal app-dialog' }, h('div', { class: 'box parchment' }, h('h2', {}, 'Kaydı kopyala'), h('div', { class: 'msg' }, `Bu sürüm dosya kaydedemiyor. Metni kopyalayıp bir not/dosya olarak saklayın (${name}).`), ta,
    h('div', { class: 'row dialog-buttons' }, h('button', { onclick: () => el.remove() }, 'Kapat'), h('button', { class: 'primary', onclick: () => { ta.select(); void navigator.clipboard?.writeText(s).catch(() => document.execCommand('copy')); } }, 'Kopyala'))));
  document.body.append(el);
}
/** 'Kaydı içe aktar' button: pick a .json (or gzip) file, validate, confirm, load. */
export function importButton(be: SoloBackend, after: () => Promise<void> | void, say: Toast, confirmOverwrite = true): HTMLElement {
  const inp = h('input', { type: 'file', accept: '.json,.gz,application/json,application/gzip,text/plain', style: 'display:none' }) as HTMLInputElement;
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0]; inp.value = ''; if (!f) return;
    let text: string; try { text = await fileText(new Uint8Array(await f.arrayBuffer())); } catch { say('Dosya okunamadı.'); return; }
    if ((confirmOverwrite || (await be.saveInfo().catch(() => null))) && !(await askConfirm(`“${f.name}” yüklenecek ve şu anki oyunun yerine geçecek. Emin misiniz?`, 'Yükle'))) return;
    const e = await be.loadState(text); if (e) { say(e); return; }
    say('Kayıt yüklendi.'); await after();
  });
  return h('span', {}, inp, h('button', { onclick: () => inp.click() }, '📂 Kaydı içe aktar'));
}

// ---------- cloud ----------
let cloud: CloudSave | null | undefined;
const getCloud = (): CloudSave | null => (cloud === undefined ? (cloud = makeCloud()) : cloud);
function cloudLogin(onDone: () => void): void {
  const c = getCloud(); if (!c) return;
  const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'e-posta' }); const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'şifre (en az 6)' });
  const err = h('div', { style: 'color:#ff8a7a;min-height:18px' });
  const el = h('div', { class: 'modal app-dialog' }, h('div', { class: 'box parchment login-cloud' }, h('h2', {}, '☁ Bulut hesabı'),
    h('div', { class: 'msg' }, 'Yedeğiniz bu hesaba bağlanır; başka bir telefonda aynı hesapla yükleyebilirsiniz. Eski çok oyunculu hesabınız da çalışır.'), email, pw, err,
    h('div', { class: 'row dialog-buttons' }, h('button', { onclick: () => el.remove() }, 'Vazgeç'),
      h('button', { onclick: async () => { err.textContent = '…'; const e = await c.signUp(email.value, pw.value, 'https://aecolakk-tech.github.io/imparatorluk/'); err.textContent = e ?? ''; if (!e) { el.remove(); onDone(); } } }, 'Hesap aç'),
      h('button', { class: 'primary', onclick: async () => { err.textContent = '…'; const e = await c.signIn(email.value, pw.value); if (e) { err.textContent = e; return; } el.remove(); onDone(); } }, 'Giriş yap'))));
  document.body.append(el); setTimeout(() => email.focus(), 30);
}
function cloudLoadButton(be: SoloBackend, onStart: () => void, toast: Toast): HTMLElement | string {
  if (!getCloud()) return '';
  return h('button', { onclick: () => void cloudLoad(be, async () => onStart(), toast) }, '☁ Buluttan yükle');
}
async function cloudLoad(be: SoloBackend, after: () => Promise<void>, toast: Toast): Promise<void> {
  const c = getCloud(); if (!c) return;
  if (!(await c.user().catch(() => null))) { cloudLogin(() => void cloudLoad(be, after, toast)); return; }
  const i = await c.info(); if (typeof i === 'string') { toast(i, 4000); return; } if (!i) { toast('Bu hesapta bulut yedeği yok.', 4000); return; }
  if (!(await askConfirm(`Buluttaki yedek: ${i.name} · Gün ${i.day} · ${new Date(i.updated_at).toLocaleString('tr-TR')}. Şu anki oyunun yerine yüklensin mi?`, 'Yükle'))) return;
  const d = await c.download(); if (typeof d === 'string') { toast(d, 4000); return; }
  const e = await be.loadState(d.json); if (e) { toast(e, 4000); return; }
  toast('Buluttaki kayıt yüklendi.'); await after();
}
async function cloudUpload(be: SoloBackend, toast: Toast, refresh: () => void): Promise<void> {
  const c = getCloud(); if (!c) return;
  if (!(await c.user().catch(() => null))) { cloudLogin(() => void cloudUpload(be, toast, refresh)); return; }
  await be.saveNow(); const s = be.exportString(); if (!s) return;
  const st = be.st!; const nm = st.world.players[st.playerId]?.name ?? '';
  const i = await c.info();
  if (i && typeof i !== 'string' && !(await askConfirm(`Bulutta zaten bir yedek var (${i.name} · Gün ${i.day}). Üzerine yazılsın mı?`, 'Üzerine yaz'))) return;
  toast('Yedekleniyor…'); const e = await c.upload(s, st.world.day, nm, be.game); toast(e ?? `☁ Buluta yedeklendi (Gün ${st.world.day}).`, 4000); refresh();
}

/** Ayarlar → Kayıt */
export function saveSection(be: SoloBackend, toast: Toast, afterLoad: () => void, refresh: () => void, newGame: () => void): HTMLElement {
  const c = getCloud(); const who = h('span', { class: 'muted' });
  if (c) void c.user().then((u) => { who.textContent = u ? `Bulut hesabı: ${u}` : 'Bulut: giriş yapılmadı'; }).catch(() => undefined);
  return h('div', { class: 'stack save-set' }, h('h3', {}, '💾 Kayıt'),
    h('div', { class: 'muted' }, 'Oyun kendiliğinden kaydedilir (her oyun günü, her dakika ve uygulamadan çıkarken; son 3 kayıt saklanır).'),
    h('div', { class: 'row' }, h('button', { onclick: async () => { await be.saveNow(); toast('Kaydedildi.'); } }, '💾 Şimdi kaydet'), h('button', { onclick: () => void exportSave(be, toast) }, '⬇ Kaydı dışa aktar'), importButton(be, afterLoad, (t) => toast(t, 4000))),
    c ? h('div', { class: 'row' }, h('button', { onclick: () => void cloudUpload(be, toast, refresh) }, '☁ Buluta yedekle'), h('button', { onclick: () => void cloudLoad(be, async () => afterLoad(), toast) }, '☁ Buluttan yükle'), who,
      h('button', { class: 'mini', onclick: async () => { await c.signOut(); refresh(); } }, 'Buluttan çık')) : '',
    h('div', { class: 'row' }, h('button', { class: 'danger', onclick: newGame }, '🏠 Yeni Oyun'), h('button', { onclick: async () => { await be.saveNow(); location.reload(); } }, '↩ Ana menü')));
}

// ---------- updates (web + Android app load the same Pages build; the app keeps its origin, so saves stay) ----------
const newer = (a: string, b: string): boolean => { const p = (v: string) => v.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); } return false; };
export function updateNotice(version: string, toast: Toast): void {
  try { const last = localStorage.getItem('imp-ver'); if (last && last !== version) toast(`✨ Güncellendi: ${version}`, 5000); localStorage.setItem('imp-ver', version); } catch { /* private mode */ }
}
/** checks version.json (no cache); a newer build → reload now (menu) or offer it (in game, after saving) */
export async function checkUpdate(version: string, inGame: boolean, save: () => Promise<void>, toast: Toast): Promise<void> {
  if (!navigator.onLine || location.protocol !== 'https:') return;
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return;
    const v = String(((await r.json()) as { version?: string }).version ?? ''); if (!v || !newer(v, version)) return;
    if (!inGame) { if (sessionStorage.getItem('imp-upd') === v) return; sessionStorage.setItem('imp-upd', v); location.reload(); return; } // once per version (no reload loop on a stale cache)
    if (document.querySelector('.update-bar')) return;
    const el = h('div', { class: 'a2hs update-bar' }, `Yeni sürüm hazır: ${v}`, h('button', { class: 'primary', onclick: async () => { await save(); location.reload(); } }, 'Güncelle'), h('button', { onclick: () => el.remove() }, 'Sonra'));
    document.body.append(el); void toast;
  } catch { /* offline */ }
}
