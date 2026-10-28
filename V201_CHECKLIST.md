# v2.0.1 checklist

Status: ✅ done and verified (how) · 🔧 in progress · ⬜ not started · ❌ not possible (reason).
Deploy only when every item is ✅ (or ❌ with a reason the user accepted).

## A. Test Botu reports 1–6 + early steering (raid / landing / controls)
| # | Item | Status | Verified by |
|---|------|--------|-------------|
| A1 | Visible Macar ships sail to the Liman, troops land, real-time combat | ✅ | mock UI run `scripts/play-combat-ui.mjs`; screenshots ships-sailing.png, ships-docked-troops-ashore.png, fight-1/2.png, after-war.png |
| A2 | Attacks force speed 0.25x; Kayzer-only 0.5x/2x | ✅ | tests/v201.test.ts (speed), UI run (speed back to 1 after war) |
| A3 | 8-slot hotbar + Çanta, joystick, separate Saldır / Etkileşim buttons | ✅ | play-controls.mjs; controls-landscape.png, controls-desktop.png |
| A4 | Free Kışla gear, weapons draw from hotbar | ✅ | v201 tests + UI run |
| A5 | Venedik ship / Halep caravan arrival texts, fire, salgın timings in the 20-min day | ✅ | v201 tests (landReal, disaster text) |
| A6 | Silent auto eating/drinking (report 5 #1): online players are never fed behind their back; offline auto-need posts a personal notice | ✅ | tests/v201.test.ts “food from the bag”, needs tests |
| A7 | Report 6 #4 not a bug: hint text made accurate; walking is real time, no hour jumps per action | ✅ | texts.ts / life.ts hint; tests (clock) |
| A8 | Tap-to-walk deleted entirely; taps select person (name+health label) / building (Etkileşim enters when in range); empty tap clears | ✅ | play-controls.mjs (empty tap doesn’t walk, person label, Pazar select). Kept: auto-walk of ‘Yap’ actions and “Yer bul → yürü ve aç” (no conflict with joystick) |
| A9 | Ev 10 collision / path end free | ✅ | test “path end free” |
| A10 | Mesaj input in landscape, ‘Su iç’ wrapping, kese history | 🔧 | to re-check in final UI run (see H) |

## B. Clock
| B1 | 1 game day = 20 real min at 1x; 06–22 = 60 s/hour, 22–06 = 30 s/hour; single constant (DAY_REAL_MIN) | ✅ | tests life/sim (hourLen) |
| B2 | Needs balanced: ~3 meals + 3 drinks a day suffice | ✅ | tests (needs), MEALS=3/WATERS=3 |
| B3 | 5-real-minute corpse rule stays real time | ✅ | unchanged real-ms constant |
| B4 | Hint + Neler yeni updated | ✅ | v2.ts WHATS_NEW, life.ts hint |

## C. Character creation / onboarding
| C1 | Gender required (Erkek/Kadın); appearance (no beard for women), title wording; marriage man–woman on every path; existing players choose once | ✅ | v201 tests (creation, proposals, wed) |
| C2 | Duplicate names blocked (case-insensitive, tr locale) | ✅ | v201 test |
| C3 | New chars: full su/enerji, 2 Ekmek + 1 Su | ✅ | v201 test |
| C4 | One-page controls screen with ‘Atla’; world paused for that player while open | ✅ | play-onboard.mjs; onboard-1/2.png |
| C5 | Soyadı, Köken (meslek+wage shown), Mizaç; age picker 16–60 (default 20); chosen once; existing players once without harmful retroactive change; no neighbourhood choice | ✅ sim / 🔧 UI | v201 tests; UI screenshot of the new form pending (H) |
| C6 | ‘Dilenci olarak başla’ hard-mode option | ⬜ | (career ladder, section J) |

## D. Age, surnames, death, inheritance
| D1 | 1 year = 5 game days (DAYS_PER_YEAR); ages shown in years; stages 0–6 / 7–15 / 16–64 / 65+ | ✅ | tests/age.test.ts; panels use ageText |
| D2 | Marriage from 16; genç school or çırak at half pay; no marriage/army for minors | ✅ | age tests; family.ts apprentice |
| D3 | Natural death 0 until 68, then (age−68)% per birthday, certain at 88 (constants) | ✅ | age tests (table, certain at 88) |
| D4 | Yaşlı: −20% walk, weaker in fights, more sickness, slower healing | ✅ | oldWalk (client+server), oldFight, oldSick (salgın), oldHeal |
| D5 | Fertility women 16–45, men decline after 60 | ✅ | age test |
| D6 | Wife takes husband’s soyadı, children the father’s | ✅ | age test |
| D7 | Migration of existing ages: nobody dies, no adult becomes a child, parents ≥16 years older | ✅ | age test (migration) |
| D8 | Demography: births + newcomers keep the city alive (1 year = 5 days) | ✅ | sim 400 days: pop 111 (was 4 before the fix) |
| D9 | Player death: account kept; funeral/vasiyet screen; continue as 16+ child or new character with same login | ✅ sim / 🔧 UI | age tests (continueAs, newCharacter); funeral modal written, UI run pending |
| D10 | Inheritance: money split equally among adult children, heir gets house/sandık/Çanta; no child → spouse; else hazine | ✅ | age + sim tests |
| D11 | Kayzer dies → heir / Maecenas; dead Kayzer’s player keeps admin panel | ✅ | age test |
| D12 | Funeral notice + Tarih Kitabı entry | ✅ | die() log + chronicle |

## E. Economy (report 7 + approved package)
| E1 | Out-of-stock goods show ‘Tükendi’ (no vanishing rows) | 🔧 | shelf() done; Pazar UI pending |
| E2 | Open Pazar panel refreshes prices live | ⬜ | |
| E3 | One price source: gazete = Pazar shelf price (devlet suyu cap included) | ✅ sim | econ test “one price source” |
| E4 | Panel close state fixed + buy confirmation (quantity + ‘Satın al’) | ⬜ | |
| E5 | NPC wallets really buy from stock; sales pay the seller; stock drives price (no random drift — none existed in the sim) | ✅ | existing buy()/settleMarket; econ tests |
| E6 | Chain buğday → değirmen un → fırın ekmek (+ odun/marangoz, yün→kumaş, odun→alet); fewer/sick/dead workers raise downstream prices | ✅ | life test (chain), econ test “without millers bread gets dearer” |
| E7 | Panayır every 5 days: caravans, rare goods, crowd, festive; arrivals cool prices | ✅ sim / 🔧 UI | econ test; festive visuals pending |
| E8 | Liman toptan cheaper than Çarşı (buy low, sell high); sipariş ilanları players can fulfil | ✅ sim / 🔧 UI | econ test (profit) |
| E9 | Kayzer tools: tax, ambar dağıtımı, narh (→ karaborsa/shortage), ithalat izni; high tax lowers mood | ✅ sim / 🔧 UI | econ tests; ai.ts tax mood (existing) |
| E10 | Wages track sustained bread prices, fall with unemployment | ✅ | econ test (wage index) |
| E11 | Seasons (winter dear), drought, plague (sick workers produce half), raid/war price effects | ✅ | econ test (season), sim runs |
| E12 | Poor NPCs: unhappy, complain, hungry, petition, migrate; Haberler/gazete report spikes | ✅ | econ test (poverty) |
| E13 | Stability over 20+ days: no runaway inflation, no deflation to 0, no mass starvation, money conserved | ✅ | econ test (3 seeds × 40 days), scripts/econ-sim.ts 220 days |
| E14 | Şehir Göstergesi at the Saray tabela (pop, işsiz, ekmek, memnuniyet, hazine; 5-day charts) | ✅ data / ⬜ UI | cityHist test |

## F. UI quality
| F1 | Replace ALL alert()/confirm()/prompt() with in-game modals/toasts; verify on APK | 🔧 | src/ui/modal.ts askConfirm/askText; grep of src shows 0 native dialogs left; APK check pending |
| F2 | Toast with reason for every change to money/hunger/thirst/energy/health/items (batched) | ⬜ | |
| F3 | Warning thresholds (hunger, thirst, health <30%, purse nearly empty), no duplicates/contradictions | ⬜ | |
| F4 | ‘Gir’ button near a building; Yer bul shows a direction arrow/trail | ⬜ | |
| F5 | Turkish suffix helper (vowel harmony + apostrophe) used everywhere; text overflow fixed | ⬜ | |

## J. Yükselme yolu (career ladder, final version)
| J1 | Main path Dilenci → İşçi → Çırak → Usta → Tüccar → Ev sahibi/Eşraf → Soylu → Kayzer’e danışman with requirements/rewards | ⬜ | |
| J2 | Asker path (Acemi er … Komutan), promotion/demotion rules, seferberlik | ⬜ | |
| J3 | Din-İlim path (talebe → hoca → kadı) | ⬜ | |
| J4 | İtibar separate stat; itibar < 0 = −1 rank; bankruptcy = Dilenci | ⬜ | |
| J5 | Rank before the name, clothing, NPC reactions; Ben tab ‘Sonraki hedefin’ with progress bars and 2–3 multi-day goals | ⬜ | |
| J6 | Existing players mapped to fair ranks (Kayzer stays Kayzer); tests | ⬜ | |

## K. İş bulma
| K1 | İş İlanı Tahtası at the Pazar (wage, hours, place, requirement); ‘Başvur’ hires at once if the requirement is met | ⬜ | |
| K2 | Etkileşim with a shop owner: ‘Bir iş var mı?’ → NPC checks itibar/rank → hires or explains (‘Önce çıraklık yap’) | ⬜ | |
| K3 | Usta/tüccar players post job notices and pay wages from their purse | ⬜ | |
| K4 | Gündelik work (liman hamallığı, tarla ırgatlığı) without requirement | ⬜ | |
| K5 | Köken = starting job; quit any time and pick another from the board; no-shows are fired and lose itibar; job hours in Ben tab | ⬜ | |

## L. İtibar
| L1 | 0–100, starts at 10, separate from money; existing players mapped from old reputation | ⬜ | |
| L2 | Gains: workday +1, quest +2–5, sadaka +1/5 D (max +3/day), tax on time +1, debt cleared +3, raid fight +5, rescue +5, thief caught +4, 10 honest trades +2, Cuma namazı/şenlik/Meclis dilekçesi +1 | ⬜ | |
| L3 | Losses: missed work −2, kavga −5, hırsızlık −10, cinayet −30, rüşvet −15, zindan −20, unpaid debt −5 | ⬜ | |
| L4 | Effects: high itibar → market discount; low → doors shut; itibar < 0 → −1 rank | ⬜ | |

## M. Cuma & Kışla
| M1 | Weekday name next to the clock (7-day cycle, independent of the 5-day year and Panayır) | ⬜ | |
| M2 | Cuma namazı: warning at 11:00, ezan notice at 13:00; anyone in the cami at any point 13:00–14:00 attends: +1 itibar once per Cuma + din; hoca’s vaaz tied to it | ⬜ | |
| M3 | Kışla Etkileşim window: Talim yap (1 h, energy, combat skill, counts toward acemi er talim, progress shown), Nöbet al (shift, wage + itibar, desertion rules), Teçhizat al (kislaKit), Rütbem (progress), Kayıt ol / Terhis | ⬜ | |

## N. Dindarlık
| N1 | Gains: Cuma namazı +3, daily namaz at the cami +1 (max 1/day), sadaka +1, oruç +5 (Ramazan, not eating 06–22), hoca lessons | ⬜ | |
| N2 | Losses: içki/meyhane −2, hırsızlık/cinayet −10, missing Cuma 2 weeks in a row −2 | ⬜ | |
| N3 | Din-ilim requirements: talebe 30, hoca 60, kadı 80 | ⬜ | |
| N4 | High din slows mood loss in famine/plague; şifa duası at the cami when no hekim (cooldown) | ⬜ | |
| N5 | Pious NPCs trust pious players (lend, give work); meyhaneci the opposite; low din: meyhane more fun but costs itibar among the pious | ⬜ | |
| N6 | Aşevi: one free soup per day at the cami for anyone hungry (pious first only when supplies are short) | ⬜ | |
| N7 | Ramazan once a year + Bayram (şenlik, ikram, hediye). 1 year = 5 days → Ramazan = 3rd day of each year (06–22 fast), Bayram = 4th day; Panayır stays on the 5th (day%5==0) — parent-approved | ⬜ | |
| N8 | Kayzer: pious more loyal; Kayzer gains standing by building a cami / attending Cuma; içki ban pleases the pious, angers others | ⬜ | |
| N9 | Visibility: din bar + ‘Neden değişti’ + note in Ben tab; trait word on NPC tap (‘Dindar’, ‘Meyhane müdavimi’) | ⬜ | |

## O. Children on the map
| O1 | Under-16s drawn shorter: bebek (0–6) ~55–60% of adult height, genç 65% at 7 → 100% at 16; kids’ heads proportionally a bit larger; label offset and tap area match; clothing/hair layers scale with the body; screenshot of a family with children | ⬜ | |

## P. Test Botu report 8 (Meclis)
| P1 | Passed genelgeler really act (ambar çağrısı → grain/bread price relief via ambar release; kuyu temizliği → water supply/health) or aren't shown as active | ⬜ | |
| P2 | Agenda dedupe; completed projects can't be re-passed; hazine checked before spending; NPCs don't propose unaffordable spending | ⬜ | |
| P3 | Gazete su price = live Pazar shelf price | ⬜ | |
| P4 | Open Meclis panel refreshes live (phase/day change); 'Oy ver' toast + vote shown immediately | ⬜ | |
| P5 | Election results: no '?' names, all seats filled | ⬜ | |
| P6 | Speeches generated from the member's actual vote stance, varied | ⬜ | |
| P7 | One ruler-name source: actual Kayzer; 'Naip Maecenas (vekil)' only while regent | ⬜ | |
| P8 | Typos + global dedupe/name-format helper ('oy verin!.', 'Bekçi Bekçi', 'Barcı Feride: Barcı Feride:', empty Muhbir names, triple propaganda line) | ⬜ | |
| P9 | 844x390: Menü tabs scrollable (Haberler, Ayarlar reachable); Meclis window scrolls/shows all rows | ⬜ | |
| P10 | 'Aday ol' button with requirements + fee; incumbents auto-run unless they withdraw; NPCs fill candidacies ≥ seat count; election calendar in Meclis panel + HUD news | ⬜ | |

## Q. Genelge catalogue & party discipline (user request)
| Q1 | ≥12 genelge kinds with real measurable effect, duration and hazine cost; gazete reports before→after numbers | ⬜ | |
| Q2 | NPC MPs propose genelgeler from city conditions (bread price → ambar, salgın → sağlık …), no duplicates, respecting the hazine ('Hazine yetersiz') | ⬜ | |
| Q3 | Party discipline: bloc voting on the party line (leader/majority); low-loyalty or personal-stake MPs may defect (logged); speeches match votes; party line shown in the panel | ⬜ | |
| Q4 | Kayzer-appointed extra seats kept by migrateMeclis16 | ⬜ | |

## R. Test Botu propaganda report (bug fixes)
| R1 | Election calendar highlights the current phase + countdown; tapping a phase explains its rules | ⬜ | |
| R2 | Candidate tools in the Meclis panel: Aday ol, Afiş as (5 D), meydan konuşması, candidate list; 'Kampanya' tab during aday/propaganda | ⬜ | |
| R3 | Results show voter count, turnout and 'ilk 16 aday sandalye kazanır' | ⬜ | |
| R4 | Seat chip label: Bağımsız for no party (no stale 'Ağa/Saltanat/Botu'); seat totals by party incl. Bağımsız add up | ⬜ | |
| R5 | Mobile: Meclis full-screen with scrolling (tabs Gündem / Geçmiş / Üyeler / Seçim / Kampanya) | ⬜ | |

## S. Propaganda package (user-approved)
| S1 | Vaat: candidates pick 1–3 vaatler from the genelge catalogue; voters weigh them by need; MPs who don't propose a promised genelge lose itibar and votes next time | ⬜ | |
| S2 | Kapı kapı 'Bana oy ver' (Etkileşim): chance from relation, itibar, vaat fit | ⬜ | |
| S3 | Miting at the Meydan once a day: affects everyone nearby; NPC candidates too; speech mentions vaatler | ⬜ | |
| S4 | İkram (pilav/şerbet) = small sympathy; money = seçim rüşveti → case + itibar −15 if caught | ⬜ | |
| S5 | Parti kampanyası: shared posters, endorsements, partisans lean to party candidates | ⬜ | |
| S6 | Kara propaganda: lowers target support; backfires if exposed | ⬜ | |
| S7 | Daily 'Seçim nabzı' in the gazete (leader, working vaat) | ⬜ | |
| S8 | Candidate cards (vaatler, party, posters) in the Kampanya tab | ⬜ | |

## T. Test Botu MP round 1
| T1 | Vote/proposal/speech confirmation toasts shown above the Meclis panel; inputs cleared after success | ⬜ | |
| T2 | No duplicate construction (active/recent project); NPC MPs vote no when the hazine can't afford it — verified by test | ⬜ | |
| T3 | Costs/requirements on buttons: Teklif ver fee (~4 D), Parti kur/Katıl fees + requirements | ⬜ | |
| T4 | Tally labels '12 evet · 1 hayır · 3 çekimser'; Turkish-character sweep of the Meclis UI | ⬜ | |
| T5 | Genelge proposals use the catalogue picker (no Kanun/Mal targets); help text updated (real effects) | ⬜ | |
| T6 | Mobile Meclis scrolls (wheel, scrollbar, touch); panel no longer closes when picking from the type list | ⬜ | |
| T7 | Comfortable real-time voting window + countdown to the count; Meclis actions instant (no game hour) | ⬜ | |

## U. Party package (user-approved)
| U1 | Parti programı: 3–4 goals per party linked to the genelge catalogue; MPs vote with the program; vaatler come from it | ⬜ | |
| U2 | Hükümet partisi / majority bloc: sets agenda, 1 priority proposal per week, Meclis başkanlığı | ⬜ | |
| U3 | Parti kasası: 1 D/day dues + donations; spent on posters, rallies, candidates' fees, poor members; money conserved | ⬜ | |
| U4 | Parti binası (Ocak) near the Pazar in party colour: membership, dues, meetings | ⬜ | |
| U5 | Mahalle support %; rises/falls with the effect of the party's passed genelgeler | ⬜ | |
| U6 | Proportional seats (D'Hondt, 16 seats); within-party order by personal votes; independents over the quota win; results UI explains it | ⬜ | |
| U7 | Koalisyon/ittifak when no party has 9 seats; allies vote together | ⬜ | |
| U8 | Disiplin: voting against the party lowers party standing; repeat → expelled; members can resign | ⬜ | |
| U9 | Kayzer AI approval leans to the party close to him; opposition soru önergesi + hazine audit (2nd-largest party, weekly) with the reply in the gazete | ⬜ | |
| U10 | Player benefits (itibar, job connections, election help); ranks üye / il başkanı / genel başkan; leadership re-elected each cycle; players can lead | ⬜ | |
| U11 | Visibility: colour badge by name, NPC trait word with party, same-party trade discount, rival arguments, party news + weekly support in the gazete, party chart on Şehir Göstergesi | ⬜ | |
| U12 | Live migration: existing seats kept until the day-94 election; multi-election stability sim | ⬜ | |

## V. Cumhuriyet İlanı (Anayasa değişikliği)
| V1 | Bill type proposable by any MP under imparatorluk; 2-day debate; gazete headline + notice to all players | ⬜ | |
| V2 | Needs ≥14 actual EVET votes of 16 seats (empty = not yes); no Kayzer veto | ✅ | tests/v201 “Cumhuriyet İlanı”: 14+ evet → kabul; “13 yes is not enough” → ret; no veto path (cumhuriyet skips onay) |
| V3 | Peaceful transition: cumhuriyet, Kayzer → Eski Kayzer citizen (keeps money/house), Başkan election scheduled, mood boost, smaller republic reset; chronicle + Tarih | ✅ | tests/v201 test 1: regime cumhuriyet, ex-Kayzer memur citizen (not soylu), Başkan election next day |
| V4 | Fail: gazete reports, proposer relation hit with the Kayzer, 10-day cooldown | ✅ | tests/v201 test 2: ret, relation drop, 10-day cooldown blocks re-proposal |
| V5 | Saltanat line = no; NPC MPs by ideology/republic; 'Anayasa' category with 14/16 warning; bill card progress bar to 14; tests (14 pass, 13 fail, no veto, transition) | ⬜ | |

| V6 | Personal-vote defection: no absolute party discipline on the anayasa vote; each MP (Saltanat too) votes by own republic value, mood and loyalty to the Kayzer; defections logged (no expulsion for a vicdan oyu); test: 14 reachable with Saltanat 3+ seats under low mood / high republic | ✅ | anayasaStance (republic, mood, loyalty) + conscienceVote; test: Saltanat 4 seats → ≥3 Saltanat evet, “vicdan oyu” logged, nobody expelled |

## W. İdeolojiler (3 eksen)
| W1 | Every party and person has 3 axes (yönetim Saltanat↔Cumhuriyet, ekonomi Esnaf↔Halk, din Muhafazakâr↔Serbest); genelgeler move them; NPCs join/switch/vote by axis distance; shown in the Partiler tab | ⬜ | |

## X. Meclis acil ekleri
| X1 | Bütçe Komisyonu: 3 MPs (2 majority bloc + 1 opposition); spending ≥200 D goes through it; 'Hazine karşılar mı?' report on the bill card; MPs vote with it | 🔧 | sim ✅ (komisyonMembers 2 bloc+1 opp, komisyonReview text, +1 debate day; test “Bütçe Komisyonu”); bill-card UI ⬜ |
| X2 | Hazine kilidi: unaffordable spending cannot be proposed unless labelled BORÇLANMA (dış borç, taksitle geri ödenir) | 🔧 | sim ✅ (hazine kilidi msg, validateBill/gBlock borc bypass, borrowFor +%10, repayDebt 25 D/day; test “hazine kilidi”); checkbox UI ⬜ |
| X3 | Halk dilekçesi: 20 imza (players + NPCs) → item directly on the Meclis agenda; sign via Etkileşim or at the Meclis; expires after 10 days | 🔧 | sim ✅ (openDilekce/signDilekce/askSign, 20 imza → gündem, 10-day expiry, NPCs start+sign; test; solo dilekce_imza 200+); Meclis list + Etkileşim UI ⬜ |
| X4 | Gerçek sandık: on election day players walk to the Meclis to vote; 'Oyunuz kaydedildi'; live turnout; secret ballot (no one sees who voted for whom) | 🔧 | sim ✅ (vote only on election day at the Meclis, 16+/not jailed, castBallot ✓ + shuffled ballots, turnout; NPC sandikHour; test “gerçek sandık”); sandık UI ⬜ |
| X5 | 'Oylama başladı, X saat kaldı' notice to all MPs + countdown on the bill card | 🔧 | sim ✅ (notifyVote → personal toast “Oylama başladı … saat kaldı”, hoursToCount; test); countdown on bill card UI ⬜ |
| X6 | Ara seçim fills empty seats at the next Meclis session | ✅ | byElection each meclisDay; test “ara seçim” (15 → 16 next session); solo ara_secim 16–22 |
| X7 | Expiry date of active genelgeler/kanunlar shown; new 'Kanunu/genelgeyi kaldır' proposal type | 🔧 | sim ✅ (kaldir kind, repealables with until, enact cancelG/repealLaw; test “kaldır”; NPCs repeal in solo); expiry list + proposal UI ⬜ |
| X8 | Rules in the Meclis help: yeter sayı (9 of 16 must vote for a valid decision, enforced) and voter eligibility (16+, not in zindan; dilenciler can vote) | 🔧 | quorum floor(seats/2)+1 enforced (test “yeter sayı” → ret “Yeter sayı yok”); voter rules enforced in vote action; help text UI ⬜ |

## Y. Meclis UI redesign
| Y1 | Full-screen Meclis with header (hazine, hükümet, başkan, next election), hemicycle seat map in party colours, tabs Gündem / Teklif Ver / Geçmiş / Üyeler / Partiler / Seçim-Kampanya; mobile layout scrolls | ⬜ | |

## Z. Tek oyunculu (single-player) NPC parity
| Z1 | Elections & campaigns by NPCs: candidacy, vaatler, kapı kapı, miting, ikram (rare seçim rüşveti), kara propaganda, party campaigns, voting at the sandık | ✅ | solo usage (seed 5): secim 6, kampanyali_secim 6, vaat, kapi_kapi 1400+, miting 100+, ikram 170+, kara_propaganda, secim_rusveti, sandik_oy 400+ — tests/solo.test.ts asserts ≥N |
| Z2 | Meclis by NPCs: catalogue proposals, Bütçe Komisyonu reports, starting/signing dilekçeler, repeal proposals, Cumhuriyet İlanı when ripe | ✅ | solo: teklif_genelge 50+, kabul_* 40+, komisyon_raporu 12+, dilekce_baslat/imza/gundem, teklif_kaldir/kabul_kaldir; Cumhuriyet via npcPropose when ≥13 conscience yes expected (not reached in stable seeds) |
| Z3 | Parties by NPCs: join/switch, dues, donations, rare founding, leadership elections, coalitions, discipline/expulsion | ✅ | solo: parti_degistir, parti_uye, bagis, parti_kur 2, lider_secimi, koalisyon, parti_ihrac, parti_hayir (fat kasa feeds the poorest) |
| Z4 | Careers by NPCs: İş İlanı posting/taking, 'Bir iş var mı?', ladder (çırak→usta→tüccar→soylu), lonca sınavı, asker ranks + talim, din-ilim | ✅ | solo: is_ilani, is_al, is_sor, cirak_oldu, terfi 100+, lonca_sinavi, talim 1300+, asker_terfi 6+, talebe/ders, ilim_terfi |
| Z5 | İtibar & din by NPCs: Cuma, namaz, sadaka, oruç, aşevi | ✅ | solo: cuma ~2000, namaz ~8700, sadaka 400+ (zekât for the rich), oruc ~2800, asevi 50+ |
| Z6 | Economy by NPCs: Liman/Pazar trade, sipariş ilanları, Panayır | ✅ | solo: liman_ticaret, siparis_ilani 100+, siparis_teslim, panayir 44 |
| Z7 | AI naip/Kayzer (no human Kayzer online) uses vergi, ambar, narh, ithalat sensibly | ✅ | naipPolicy: vergi steered by hazineTrend (8–16 %), ambar distribute/buy, ekmek narh on/off, ithalat; solo naip_* counts; treasury stays >400 in 8/8 seeds |
| Z8 | AI naip approves/rejects pending bills by the next Meclis session (hazine, mood, ideology); nothing waits forever | ✅ | meclisDay onay branch → aiApprove when the head is AI/offline (or after SANCTION_DAYS); test “AI naip answers…”; solo test asserts no bill stays in onay > 2 days |
| Z9 | NPCs start isyan / cemiyet activity organically when conditions are ripe | ✅ | cemiyet_kur/uye counted in solo (2–4 / 5–7); isyan starts organically in the famine seeds (10, 12) |
| Z10 | Solo sim test: 1 player + NPCs, 200+ days; per-feature NPC usage ≥ N; economy and politics stable; per-feature usage table in the report | ✅ | tests/solo.test.ts: seed 5 usage ≥N for 35 features + stability; seed 8 stability; sweep 5–12 → 6/8 stable required (actual: 6/8; seeds 10,12 hit a famine spiral → republic). Tables: /workspace/raid/v201/solo_usage.md, solo_seeds.md |
| Z11 | Rule-based only (no LLM credits) | ✅ | solo.ts/meclis.ts/party.ts: pure rules, no network/LLM calls |

## ST. Staging / copy world for Test Botu
| ST1 | A separate copy world (staging save) for Test Botu's idle test that never touches the live world; how to start/reset it documented | ⬜ | |

## v2.0.2 BACKLOG (do NOT build in v2.0.1)
- Bütçe oylaması (yıllık bütçe kalemleri)
- Devamsızlık: ödenek kesintisi ve vekâlet
- Erken seçim / Meclis’in feshi
- Nazırlar (bakanlar) ve nazırlara gensoru
- Veto aşma (nitelikli çoğunlukla)
- Seçim itirazı / yeniden sayım
- Sandık gözlemcisi / hile denetimi

## H. Release
| H1 | Full vitest + build | 🔧 | last full run: all pass (before UI work) |
| H2 | UI runs (onboarding/creation, controls, combat, funeral, Pazar, Göstergesi) with screenshots in /workspace/raid/v201/ | ⬜ | |
| H3 | Backup live world, deploy site + edge function | ⬜ | |
| H4 | Version v2.0.1 + Turkish ‘Neler yeni?’ | 🔧 | |
| H5 | APK v2.0.1 (code 21, same key) → release apk-v2.0.1; no system dialog on device | ⬜ | |
| H6 | Saves not broken (migrations: age, econ, profile) | ✅ sim | migration tests |
| H7 | Prepared (not triggered) live Macar landing script with ~3–4 min lead | ⬜ | |

## Sim regression fixes found during the solo work (v2.0.1)
| # | Item | Status | Verification |
|---|---|---|---|
| SR1 | genelgeDay was never called (genelgeler never expired) → now in endOfDay | ✅ | full suite 180/180 |
| SR2 | Tax-cut guard: aiApprove/NPCs only cut taxes from a stocked, growing hazine (npcFitG, vergi rule) | ✅ | life 220-day test treasury >2000 |
| SR3 | Food chain never empties: STAPLE_MIN (çiftçi 4, değirmenci 2, fırıncı 3, sucu 3), chain-aware job switching, NPC apprentices go to scarce trades, only trade-less NPCs look for day labour | ✅ | econ seeds 1–3, solo sweep |
| SR4 | Esnaf kredisi: broke millers/bakers get small hazine working capital, repaid in instalments (money conserved) | ✅ | money drift 0 in every run |
| SR5 | Money hoarding: fat party kasa runs a hayır sofrası for the poorest; rich NPCs give zekât | ✅ | solo parti_hayir 260, top-10 share fell |
| SR6 | Caravans: dear bread slows immigration, only famine (>3× bread) stops it | ✅ | solo population 98–111 in stable seeds |
| SR7 | Solo runner steps by game hours (raids slow the clock) | ✅ | scripts/solo.ts |
| SR8 | Known limit: 2 of 8 solo seeds (10, 12) still fall into a long famine (drought + chain) → isyan/cumhuriyet, population ~75–80 | ⚠️ | /workspace/raid/v201/solo_seeds.md |
