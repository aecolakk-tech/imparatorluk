# İmparatorluk (v1)

Davetlilere açık, ortak ve hiç durmayan bir piksel şehir oyunu. Harita oyunun ta kendisi: binalara dokunarak iş yapılır, yürüyen herkese dokunup kartı açılır.

- 1 oyun günü = 10 gerçek dakika. Durdurma ve hız ayarı yok. Kimse çevrimiçi değilken dünya donar.
- Sunucu otoriterdir: istemci sadece niyet gönderir (`Action`), parayı ve durumu sadece sunucu hesaplar.
- Yapay zekâ tamamen kural tabanlıdır (LLM çağrısı yok, kredi harcamaz).

## Hızlı başlangıç (yerel, sunucusuz)

```bash
npm install
npm run dev:mock      # http://localhost:5173  (mock backend, localStorage)
npm test              # vitest: saat, ekonomi, yapay zekâ, sohbet güvenliği
npm run sim           # 200 oyun günü, 3 politika (makul / sadece naip / zalim)
npm run build         # tsc + vite build + edge function bundle
npm run smoke         # (dev:mock açıkken) headless Chrome ile duman testi
```
Mock modda davet şifresi `imparator`. İlk kayıt olan hesap (ya da `kurucu@imparatorluk.local`) kurucu Kayzer olur. İkinci bir sekmede başka hesapla aynı dünyayı paylaşabilirsiniz.

## Mimari

| Yer | Ne |
|---|---|
| `src/sim/` | Saf TypeScript simülasyon: dünya, ekonomi (defter, piyasa, vergi, maaş, bozulma), NPC yapay zekâsı, mahkeme, dilekçe, naip, seçim, darbe/devrim, gazete, yönetici işlemleri |
| `src/server/core.ts` | Otoriter sunucu giriş noktaları (heartbeat/act/register/chat/admin). Mock backend ve Edge Function aynı kodu çalıştırır |
| `src/backend/` | `MockBackend` (tarayıcıda) ve `SupabaseBackend` (Auth + Edge Function + messages) |
| `src/ui/` | Canvas2D piksel harita (16×16 sprite, 2–3× ölçek), paneller, sohbet, kurucu paneli |
| `supabase/migrations/` | Tablolar, RLS, `check_access`, `set_access_password`, `commit_world` (iyimser kilit), `snapshot_world` |
| `supabase/functions/game/` | Deno Edge Function; `core.js` = `npm run build:edge` çıktısı |

**Saat (tick):** `advanceWorld(w, now)` sadece `lastTickAt`'ten beri geçen tam oyun saatlerini işler, yani idempotenttir. Kimse çevrimiçi değilse (`lastSeen` < 60 sn) `frozen=true` olur. Biri girince saat *şimdiden* devam eder, birikmiş zamanı yetiştirmeye çalışmaz. Çevrimiçi oyuncuların 6 saniyelik heartbeat'i saati ilerletir. Eşzamanlı heartbeat'ler `commit_world(new_state, expected_version)` ile karşılaştır-ve-değiştir yapar, çakışan yeniden dener. Bu yüzden cron gerekmez.

**Yedek:** 3 gerçek günde bir `snapshot_world()` çalışır, son 8 yedek saklanır. Kurucu panelinden geri yüklenebilir ve oyuncu hesapları korunur.

## Yayına alma (Supabase + GitHub Pages veya Cloudflare Pages)

1. **Supabase projesi** açın (ücretsiz katman yeter). Supabase CLI ile:
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJE_REF>
   npx supabase db push                       # migrations/ uygulanır (davet şifresi: imparator)
   npx supabase secrets set FOUNDER_EMAIL=aencolak@gmail.com
   npm run build:edge
   npx supabase functions deploy game --no-verify-jwt   # fonksiyon token'ı kendisi doğrular
   ```
   Auth → Providers → Email açık olsun. Hesapları sunucu açtığı için "Confirm email" kapalı kalabilir. Auth → "Allow new users to sign up" kapatılmalı: kayıt sadece davet şifresini kontrol eden Edge Function üzerinden olur.
2. **Ön yüz:** `.env.local` dosyasına
   ```
   VITE_SUPABASE_URL=https://<PROJE_REF>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   yazıp `npm run build` çalıştırın. `dist/` klasörünü yayınlayın:
   - **Cloudflare Pages:** Build komutu `npm run build`, çıktı `dist`, ortam değişkenleri yukarıdaki iki değişken.
   - **GitHub Pages:** `vite.config.ts` içinde `base: './'` zaten ayarlı. `dist/` içeriğini `gh-pages` dalına itin ya da Pages Actions kullanın.
3. Kurucu `FOUNDER_EMAIL` ile kayıt olur ve Kayzer koltuğuna (hanedan) oturur. Hemen 🛠 panelinden davet şifresini değiştirin.

## v1.1 değişiklikleri
- Yeni dünyada saray hazinesi **10.000 Dinar** ile başlar.
- **Cumhuriyet isteği** sadece iki şeyle artar: kararlı cumhuriyetçilerin propagandası ve dedikodusu (en çok yoksul ve açlara işler), ve aşırı yoksulluk ile açlık. Vergi tek başına artırmaz. İyi yönetimde istek düşer; kararlı cumhuriyetçiler kendi eğilimini korur.
- **Meclis vetosu:** imparatorlukta Kayzer'in Meclis teklifine vetosu kesindir, aşılamaz. Her veto herkesin cumhuriyet eğilimini +0,7 artırır, sadakatini −1,5 düşürür.
- **Cumhuriyet:** devrim ya da ayaklanma başarılı olursa `regime = 'cumhuriyet'` olur. Ertesi gün, sonra her 20 günde bir **Başkan** seçilir. Başkan, Kayzer'in yetkilerini kullanır, kanun değişiklikleri ise Meclis oyuna gider. Başkan çevrimdışıyken Maecenas naiptir. Hanedan hakkı ve kurucu paneli her rejimde çalışır.
- **Yeni oyuncu:** ya boş evde yeni bir vatandaş olarak başlar ya da var olan bir NPC'yi listeden seçip kartını görerek devralır. Oyuncuların karakterleri, Naip ve Kayzer hiçbir zaman devralınamaz. Devlet görevlileri ve Meclis üyeleri ise ancak kurucu panelden izin verirse devralınabilir.

## v1.2: Derin Meclis
- `src/sim/meclis.ts` dosyasında: 7 sandalye (4 mahalle, 3 meslek), 4 parti (lider ve ideolojileriyle), 11 tasarı türü. Akış: 1 gün görüşme (kürsü konuşmaları) → 1 gün oylama (her üyenin evet/hayır/çekimser oyu kaydedilir; oyuncu üyeler kendi oyunu verir) → imparatorlukta Kayzer onayı (veto kesin, +0,7 cumhuriyet isteği / −1,5 sadakat, 3 gün içinde onaylanmayan karar düşer) → yürürlük.
- Bütçe Kayzer'in ya da Başkan'ın serbest harcamalarını sınırlar (onaysız bütçe 20 günde 600 Dinar). Gensoru görevliyi görevden alır. Soruşturma komisyonu defteri inceleyip mahkemeye delil gönderir. Üyelerin maaşı ve dokunulmazlığı var, dokunulmazlık kaldırılabilir. Üyelere verilen rüşvet kaydedilir ve basın ya da komisyon ifşa edebilir. Cumhuriyette kanun çoğunlukla çıkar, Başkan 2/3 çoğunlukla azledilir.
- Denge: hükümdar yoksa sadakat günde −0,5 erir ve propaganda sadakatsiz halka da işler. Ordu sadakati 25'in altındaysa cumhuriyet isteği 50'de 5 gün kalınca halk ayaklanır (normal eşik 80).

## Kurallar
Oyunun içindeki 📖 sayfasında: darbe (6 asker, Saray Koruması varsa 8 asker, 1500 Dinar ve halk desteği), oyuncu devrimi (cumhuriyet ≥ 70, 4 asker, 800 Dinar), halk devrimi (cumhuriyet 5 gün > 85 ve ordu sadakati ≤ 55), hanedan hakkı (3 sadık asker ya da cumhuriyet < 60), seçim (20 günde bir, 5 sandalye), adalet akışı.

## Bilinen sınırlar (v1)
Bilinen sınırlar için rapordaki "Eksikler" bölümüne bakın: dünya durumu tek JSON satırında tutuluyor ve istemciler bütün durumu okuyabiliyor (gizli komplo bilgisi dahil). Ölçek birkaç düzine oyuncuya göre tasarlandı. Mülk, miras, nesiller, komşu krallık ve savaş v2'ye kaldı.

## v1.3: İsyan, Evlilik ve Aile
- **İsyan** artık haritada canlı: asiler Pazar'da toplanır, binaları sırayla işgal eder (🚩), üstte İSYAN çubuğu (asi vs sadık güç). Hükümdar/naip/asker: Dağıt-pazarlık, Elebaşları tutukla, Saldır. Cumhuriyet sadece asiler Saray'ı alırsa ya da sadık asker kalmazsa ilan edilir. Devrik Kayzer'in kaderini (sürgün/zindan/af) isyancı oyuncular oylar, yoksa önderler kuralla seçer; hanedan hakkı sürer (`src/sim/isyan.ts`).
- **Evlilik ve aile** (`src/sim/family.ts`): teklif/kabul, düğün, ortak hane; Kayzer'in eşi soylu olur ve saraya taşınır, Kayzer yokken/pasifken eş yönetir. Bolluk eşiğinin üstünde çocuk, günlük bakım, bebek→çocuk→genç→yetişkin (60 gün), huy mirası, okul, hastalık/hekim, yetimlere devlet bakımı, miras, boşanmada mal paylaşımı, veliaht, feragat ve naiplik, hanedan hakkının çocuklara geçmesi, soy ağacı paneli. Yetişkin çocuklar yeni oyuncular tarafından devralınabilir.
- Canlı: https://aecolakk-tech.github.io/imparatorluk/ (GitHub Pages, `gh-pages` dalı: `npm run build` sonra `dist/` yayınlanır), sunucu: Supabase Edge Function `game`.

## v1.4 – Yaşayan şehir
- 1 gün = 5 dk; Kayzer hızı 0,5x/1x/2x yapar. HUD: saat, öğün/su, sağlık, mutluluk, dindarlık, aktif olaylar, seçim takvimi; ⚡ “Ne yapabilirim?” paneli, 📣 olay/dedikodu panosu, görev rehberi.
- İhtiyaçlar (3 öğün, 5 su; eksikse −10 sağlık), hekim (sağlık <30 / yara), dindarlık (namaz, içki, vaaz, devlet yönlendirmesi), meyhane, festival alanı.
- Üretim zincirleri (çiftçi → fırıncı/barcı, kasap yünü → dokumacı → terzi, marangoz → mobilyacı/demirci), çırak/kalfa/usta, arz-talep fiyatları (günde ±%8), stok sınırı ve karaborsa, tahsildar, kaçakçılık, sarraf ve haciz, tahıl ambarı, narh, kervanlar, sınır tehditleri, miras/servet vergisi.
- Suç: hırsızlık, saldırı, cinayet; yakalayana rüşvet penceresi; kadı, avukat, tanık; zindandakiler zindanın içinde görünür.
- NPC sohbeti: Meydan’da konuşur, DM’lere cevap verir, oyunculara teklif getirir; haritada konuşma balonları.
- Cinsiyet herkes için; evlilik sadece kadın-erkek. Seçimde adaylık → propaganda (afiş, konuşma) → oylama.
- Kuraklık her 180 günde 14 gün; salgın, sel, bereket. Daha büyük harita (100×60), arsalara inşaat.
- Kayıtlı dünyalar `migrateWorld` ile şema 2’ye taşınır (kimse silinmez).

## v1.6
- Gerçek yürüyüş: haritaya dokun → karakter A* ile yürür; bina/kişi etkileşimleri sadece yakındayken.
- Sade arayüz: tek "☰ Menü", sade bina pencereleri, her zaman görünen kompakt HUD; büyük sprite'lar.
- NPC'lerle yapay zekâ sohbeti (Gemini flash-lite, sunucu sırrı `NPC_LLM_API_KEY`; dakika/gün limiti, önbellek, kurallı yedek cevap).
- NPC'ler birbirine yürüyüp konuşuyor; Meydan sadece dedikodu.
- Web Audio sesleri (kuşlar, cırcır böcekleri, tıklama, ölüm, para, kapı, çan, kalabalık, davul, zindan kapısı) + sessiz düğmesi.
- Cinayet akışı: ceset (5 dk) → ihbar → bekçi → savcı → canlı duruşma (YZ kadı) → karar → zindana götürme / para cezası.
- İsyan tetikleyicisi düzeltildi (çoğunluk cumhuriyetçi ise 3 günde isyan); seçimler 40 günde bir, Meydan'da tabela, aşama pencereleri; asker/bekçi aday olamaz.
- Denge: kuraklıkta ekmek pahalanır, hasta NPC'ler hekime gider, zanaat fiyatlarına taban, kanun önizlemesi 1. günde de sayı verir.

## v1.7 / v1.8
- Sohbetten eyleme: NPC'lere verilen emirler (git, takip et, saldır, öldür, tutukla, çal, ver, sat, al, çalış, oy ver, dedikodu, rüşvet, koru, ayrıl) oyun kurallarıyla kabul/ret edilir ve NPC gidip yapar. Asker/memurlar Kayzer'e itaat eder; zalim emirler sadakati düşürür, firara yol açar.
- Yakalanan oyuncu: gözaltı → mahkeme (hâkim, savcı, savunma) → hüküm.
- Takip kamerası, müzik, hız kontrolü, vatandaş defteri, hedefler/görevler, düşük grafik, tüm tıklamalara ses.
- Soylular (Vezir/Paşa/Bey/Ağa, tımar), entrikalar, gizli cemiyetler (muhbir, casus, arama emri, baskın, sorgu), mevsimler, hayvanlar ve çiftlik, sürekli açlık/susuzluk, Tarih Kitabı, bekçi devriyeleri.
- PWA: ana ekrana eklenebilir (manifest, simgeler, yalnızca statik dosyaları önbelleğe alan service worker).
