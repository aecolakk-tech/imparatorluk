export const RULES: [string, string[]][] = [
  ['Dünya', [
    'Tek bir ortak dünya var, hiç sıfırlanmaz. 1 oyun günü = 10 gerçek dakika. Oyun durdurulamaz, hızlandırılamaz.',
    'Kimse çevrimiçi değilken dünya donar; biri girince kaldığı yerden devam eder.',
    'Siz yokken karakterinizi oyunun yapay zekâsı temkinli yönetir: çalışır, yer içer, ticaret yapar. Suç işlemez, mal satmaz, riskli karar almaz. Girdiğiniz an kontrol size geçer.',
    'Üç hafta hiç girmeyen oyuncunun karakteri tamamen bağımsız bir vatandaşa döner (geri gelince yine sizin olur).',
  ]],
  ['Kayzer ve Naip', [
    'Kayzer vergi, maaş, kanun, inşaat ve atamaları belirler, dilekçeleri cevaplar, af çıkarır.',
    'Kayzer çevrimdışıyken Maecenas naiplik yapar: maaşı öder, devlet ekmeğini dağıtır, küçük yardım ve iş dilekçelerini cevaplar. Yeni kanun çıkaramaz, vergi değiştiremez, büyük harcama yapamaz.',
    'Oyunun kurucusu her zaman Hanedan’dır; hanedan hakkı çocuklarına ve torunlarına da geçer. Tahtı kaybeden hanedan üyesi en az 3 sadık asker varsa ya da cumhuriyet isteği 60’ın altındaysa “Tahtı geri al” diyebilir (sürgündeyken bile).',
    'Kayzer çevrimdışıyken ya da pasifken eşi devleti yönetir: eş oyuncuysa fermanları kendisi verir, değilse Maecenas’ın yardımıyla oyunun yapay zekâsı yönetir.',
    'Feragat: Kayzer tahttan çekilirse taht veliahda (Kayzer seçebilir), yoksa en büyük yetişkin çocuğa geçer. Varis reşit değilse eş naip olarak tahta oturur, varis 60. gününde tahta çıkar. Çocuk yoksa taht eşe geçer.',
  ]],
  ['Darbe (Kışla)', [
    'Darbe için üçü birden gerekir: en az 6 asker sizin tarafınızda (Saray Koruması kanunu varsa 8), komplo fonunda 1500 Dinar, halk desteği (ortalama memnuniyet 40’ın altında ya da cumhuriyet isteği 50 ve üstü).',
    'Askerleri rüşvetle (en az 40 Dinar) kazanabilirsiniz; sadık askerler zor ikna olur. Rüşvet suçtur, yakalanabilirsiniz.',
    'Şartlar tutmadan sarayı basarsanız darbe başarısız olur: tutuklanırsınız (7 gün zindan) ve fonunuza el konur.',
  ]],
  ['Devrim', [
    'Ordu sadakati 25’in altına düşerse cumhuriyet isteği 50’de bile 5 gün sürerse halk ayaklanır.',
    'İsyan haritada canlı yaşanır: asiler Pazar’da toplanır, saat saat Kahvehane, Meclis, Mahkeme, Kışla ve en son Saray’ı işgal etmeye çalışır (🚩). Üstteki İSYAN çubuğu asi gücünü sadık askerlerle karşılaştırır. Sadakati düşen askerler asilere katılabilir; oyuncular “Asilere katıl” diyebilir.',
    'Hükümdar (yoksa naip, ya da hükümdar yokken bir asker oyuncu) askerlere emir verir: 🤝 Dağıt/pazarlık (hazineden taviz, vergi −2; ılımlılar evine döner), ⛓ Elebaşları tutukla (yeterli asker gerekir), ⚔️ Saldır (iki taraftan ölüler, herkesin memnuniyeti ve sadakati düşer).',
    'Cumhuriyet SADECE asiler kazanırsa ilan edilir: Saray düşerse ya da sadık asker kalmazsa. Asiler dağılırsa ya da 3 gün sonunda isyan söner.',
    'Asiler kazanırsa devrik Kayzer’in kaderini 1 gün içinde isyana katılan oyuncular oylar: Sürgün (20 gün), Zindan (15 gün) ya da Af (sıradan vatandaş). Oyuncu yoksa önderler karar verir: kan döküldüyse zindan, zalim bir saltanatsa sürgün, değilse af. Hanedan hakkı her durumda sürer.',
    'Oyuncu devrimi: cumhuriyet isteği 70 ve üstü, en az 4 asker (cumhuriyetçi askerler de sayılır), 800 Dinar fon.',
    'Halk ayaklanması: cumhuriyet isteği 5 gün üst üste 80’in üstünde kalırsa isyan başlar (aşağıya bakın).',
  ]],
  ['Evlilik ve Aile', [
    'Her yetişkin vatandaş (oyuncu ya da yapay) evlenme teklif edebilir; oyuncu teklifleri kabul/ret ile cevaplar. Düğün yapılır, eşler aynı evde yaşar. Kayzer’in eşi otomatik soylu olur ve Saray’a taşınır.',
    'Çocuk sadece bolluk varsa olur: hanede en az 300 Dinar birikim (her çocuk için +100), tok bir hane ve şehirde ekmek bolluğu. Bebek 5 gün sonra doğar; her çocuk günde 3 Dinar bakım ister.',
    'Çocuklar bebek → çocuk → genç → yetişkin (60. gün) olarak büyür, anne-babasının huyunu (dürüstlük, hırs, görünüş) alır. Okula giden çocuk (günde +1 Dinar) büyüyünce memur, hoca, hekim, kalemşör ya da tüccar olabilir.',
    'Çocuklar hastalanabilir: Hekime götürün (8 Dinar), yoksa 6 günde ölebilir. Anne-babası ölen çocuklara devlet (hazine) bakar.',
    'Yetişkin olan çocuk yeni bir vatandaştır; yeni oyuncular onu devralıp oynayabilir. Ölen kişinin malı eşine ve yetişkin çocuklarına kalır; mirasçısı yoksa hazineye geçer.',
    'Boşanmada birikim ve eşyalar ikiye bölünür; evden ayrılan taraf boş bir eve taşınır. Kayzer’den boşanan eş soyluluğunu kaybeder.',
    'Soy ağacı “Aile” panelindedir. Kayzer’in çocukları varistir; Kayzer veliaht atayabilir.',
  ]],
  ['Meclis', [
    '7 sandalye: 4 mahalle (Batı, Çarşı, Doğu, Liman) ve 3 meslek (Esnaf, Devlet Memurları, Emekçiler). Her 20 oyun gününde bir seçim yapılır; herkes kendi mahallesi ve meslek grubu için oy verir.',
    'Partiler: Saltanat Partisi, Cumhuriyet Hareketi, Esnaf Birliği, Halk Fırkası. Her partinin lideri ve görüşü vardır; NPC üyeler partilerine, çıkarlarına ve aldıkları rüşvete göre oy verir.',
    'Her üye teklif verebilir: vergi, narh, maaş, bütçe, kanun, inşaat, genel af, gensoru, soruşturma komisyonu, dokunulmazlığın kaldırılması, (cumhuriyette) Başkan’ın azli. 1 gün görüşme, 1 gün oylama; her üyenin evet/hayır/çekimser oyu kayda geçer.',
    'İmparatorlukta kabul edilen kararlar Kayzer’in onayına gider. Kayzer’in vetosu KESİNDİR, Meclis hiçbir çoğunlukla aşamaz. Her veto cumhuriyet isteğini +0,7 artırır, sadakati −1,5 düşürür. 3 gün içinde onaylanmayan karar düşer.',
    'Bütçe: Kayzer/Başkan’ın serbest harcamaları (bayram, bağış, inşaat ödeneği, büyük yardım) Meclis’in onayladığı bütçeyle sınırlıdır; onaylı bütçe yoksa 20 günde 600 Dinar.',
    'Gensoru kabul edilirse devlet görevlisi görevden alınır. Soruşturma komisyonu defterleri inceler, rüşveti ifşa eder ve delilleri mahkemeye yollar.',
    'Üyelerin maaşı ve dokunulmazlığı vardır; dokunulmazlık Meclis kararıyla kaldırılabilir. Üyeye verilen rüşvet kayda geçer ve basın ya da komisyon tarafından ifşa edilebilir.',
  ]],
  ['Cumhuriyet', [
    'Devrim ya da halk ayaklanması başarılı olursa Cumhuriyet ilan edilir; artık Kayzer yoktur.',
    'Ertesi gün ve sonra her 20 oyun gününde bir, oyuncuların ve vatandaşların oyuyla bir Başkan seçilir. Meclis binasından Başkan adayı olabilir, oy verebilirsiniz.',
    'Başkan, Kayzer’in devlet yetkilerini kullanır: vergi, maaş, atama, hazine, dilekçeler. Meclis kanunları çoğunlukla, onaya gerek olmadan çıkarır ve Başkan’ı 2/3 çoğunlukla azledebilir.',
    'Başkan çevrimdışıyken Maecenas naiplik yapar. Kurucunun hanedan hakkı cumhuriyette de geçerlidir.',
  ]],
  ['Cumhuriyet isteği', [
    'Cumhuriyet isteğini iki şey artırır: cumhuriyetçilerin halkı kışkırtması (propaganda, dedikodu) ve aşırı yoksulluk ile açlık.',
    'Halkı tok, işi ve adaleti yerinde olan bir imparatorlukta istek kendiliğinden azalır; sadece kararlı cumhuriyetçiler fikrinden dönmez.',
  ]],
  ['Adalet', [
    'Suçlar: hırsızlık, rüşvet, zimmet, isyan. Akış: Bekçi yakalar → Savcı dava açar ya da düşürür → Hâkim karar verir. Kayzer affedebilir.',
    'Suçlu bulunan çaldığını öder, para cezası alır ve zindana girer.',
  ]],
  ['Kullanım kuralları', [
    'Oyun sadece davetlilere açıktır; giriş şifresini başkasıyla paylaşmayın.',
    'Küfür, hakaret, spam yasaktır; sohbet filtrelidir ve hız sınırı vardır. Kurucu oyuncuları uzaklaştırabilir.',
    'E-posta adresiniz hiçbir oyuncuya gösterilmez. Gerçek kişisel bilgilerinizi sohbette paylaşmayın.',
    'Tek kişi, tek hesap. Hata görürseniz kurucuya bildirin; hatayı kullanmak yasaktır.',
  ]],
];

export const GUIDE: string[] = [
  'Hoş geldiniz! Ben Maecenas, sarayın danışmanıyım (cumhuriyet olsa da hâlâ buradayım). Size şehri kısaca göstereyim.',
  'Harita oyunun kendisi. Parmağınızla kaydırın, iki parmakla ya da tekerlekle yakınlaştırın.',
  'Bir binaya dokunun: pazarda alışveriş, sarayda dilekçe, mahkemede davalar, kışlada askerler, Meclis’te seçim.',
  'Yürüyen herhangi birine dokunun: kartında parasını, ihtiyaçlarını, ne düşündüğünü görürsünüz; para verebilir, mesaj atabilirsiniz.',
  'Karakteriniz her gün kendi mesleğinde otomatik çalışır ve kazandığıyla ekmek, su alır. Siz daha fazlasını yapabilirsiniz: ticaret, dilekçe, seçim… ya da darbe.',
  '📜 Gazete her günün özetini verir, 💬 Meydan’da herkesle konuşursunuz. Kurallar 📖 sayfasında. Hayırlı olsun!',
];
