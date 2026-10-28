export type Good = 'ekmek' | 'su' | 'et' | 'balik' | 'kumas' | 'alet' | 'odun' | 'bugday' | 'yun' | 'elbise' | 'mobilya' | 'icki' | 'sut' | 'yumurta';
export const GOODS: Good[] = ['ekmek', 'su', 'et', 'balik', 'kumas', 'alet', 'odun', 'bugday', 'yun', 'elbise', 'mobilya', 'icki', 'sut', 'yumurta'];

export type Profession =
  | 'firinci' | 'sucu' | 'kasap' | 'balikci' | 'terzi' | 'demirci' | 'marangoz'
  | 'tuccar' | 'hekim' | 'hoca' | 'hamal' | 'insaatci' | 'kalemsor' | 'imam'
  | 'memur' | 'tahsildar' | 'bekci' | 'savci' | 'hakim' | 'asker' | 'kayzer' | 'naip' | 'hayvanci'
  | 'ciftci' | 'dokumaci' | 'mobilyaci' | 'barci';

export type Office = 'meclis';

export type BuildingKind =
  | 'saray' | 'mahkeme' | 'kisla' | 'cami' | 'meclis' | 'okul' | 'hekimhane' | 'liman'
  | 'kasap' | 'degirmen' | 'firin' | 'kuyu' | 'atolye' | 'pazar' | 'ev' | 'santiye' | 'zindan' | 'kahve'
  | 'bar' | 'festival' | 'ciftlik' | 'dokuma' | 'mobilyahane' | 'ambar' | 'arsa' | 'yapi' | 'hayvan';

export interface Building {
  id: string;
  name: string;
  kind: BuildingKind; ownerId?: string;
  x: number; y: number; w: number; h: number; // tiles
  door: { x: number; y: number };
  market?: boolean;
}

export interface Person {
  goal?: GoalId; goalsDone?: GoalId[];
  rank?: import('./realm').Rank | null; fief?: string | null; favor?: number; homeUntil?: number; sleeping?: boolean; renting?: string | null; energy?: number; look?: import('./look').Look; lookSet?: boolean; farm?: boolean; barn?: { ahir: number; kumes: number }; farmStock?: Partial<Record<Good, number>>; fedDay?: number; riding?: boolean; animals?: Record<import('./realm').Animal, number>;
  task?: import('./orders').Task; // v1.7: an order the NPC is carrying out
  orderedBy?: { by: string; crime: CrimeKind; victimId: string | null; day: number };
  id: string;
  name: string;
  prof: Profession;
  meclis: boolean;
  playerId: string | null; // controlled by a player account
  npc: boolean; // true if AI always controls
  home: string; // building id
  work: string; // building id
  money: number;
  inv: Record<Good, number>;
  hunger: number; // 0 full .. 100 starving
  thirst: number;
  mood: number; // 0..100
  loyalty: number; // to the Kayzer 0..100
  ambition: number; // 0..100
  honesty: number; // 0..100
  republic: number; // 0..100 personal republican sentiment
  health: number; // 0..100
  spouse: string | null;
  jailedDays: number;
  incomeToday: number;
  unemployedDays: number;
  thought: string;
  lastAction: string;
  relations: Record<string, number>; // -100..100, sparse
  hairColor: number; skin: number; shirt: number; // sprite seeds
  female: boolean;
  plotting: 'none' | 'coup' | 'revolution';
  faction: string | null; // Meclis faction (party)
  immune: boolean; // parliamentary immunity (members only)
  sidedWith: string | null; // soldiers: who they back in a coup
  born: number; // game day of birth (adults start with a past birthday)
  parents: string[]; // person/child ids
  soylu: boolean; // nobility (Kayzer's spouse, royal children)
  school: number; // days of schooling (children who grew up)
  exiledDays: number; // sürgün
  din: number; // dindarlık 0..100
  meals: number; drinks: number; // today
  wounded: boolean; // needs a doctor
  protectedUntil: number; // newcomer protection (game day)
  xp: number; // profession experience → çırak/kalfa/usta
  rep: number; // reputation -100..100 (gossip)
  relNote: Record<string, string>; // why we are friends/enemies
  titles: string[]; // achievements
  taxDue: number; smuggle: boolean;
  nightOut: boolean;
  bought?: Partial<Record<Good, number>>; // bought today – cannot be resold the same day
  walk?: import('./move').Walk; // player characters: current walk (real-time path)
}

export interface Arrest { id: string; criminalId: string; catcherId: string; crime: CrimeKind; victimId: string | null; amount: number; day: number; hour: number; offer: number; status: 'bekliyor' | 'kabul' | 'ret'; at?: number; evidence?: number; eyewitnesses?: number; basis?: string; eyeIds?: string[]; complainantId?: string | null }
export type CrimeKind = 'hirsizlik' | 'rusvet' | 'zimmet' | 'isyan' | 'saldiri' | 'cinayet' | 'kacakcilik';
export interface Talk { a: string; b: string; text: string; day: number; hour: number; at?: number; lines?: string[]; ai?: boolean }
export interface Corpse { id: string; personId: string; name: string; look: { hairColor: number; skin: number; shirt: number; female: boolean; prof: Profession }; x: number; y: number; at: number; killerId: string | null; witnesses: string[]; stage: 'yerde' | 'ihbar' | 'inceleme' | 'kapandi'; reportedBy?: string; reportedAt?: number; bekciId?: string; bekciFrom?: { x: number; y: number }; note?: string }
export interface Escort { personId: string; bekciId: string; from: { x: number; y: number }; at: number }
export interface TrialMsg { who: 'hakim' | 'savci' | 'sanik' | 'tanik' | 'suclanan'; name: string; text: string; at: number }
export interface Trial { at: number; until: number; judgeId: string | null; prosecutorId: string | null; msgs: TrialMsg[]; persuasion: number; done: boolean; doneAt?: number; verdictText?: string; pending?: boolean; reasoning?: string; lastReason?: string; blamedId?: string | null }
export interface NpcMsg { fromPersonId: string; fromName: string; toPersonId: string | null; text: string; at: number }
export interface Offer { id: string; from: string; to: string; kind: 'mal' | 'borc' | 'is' | 'rusvet'; good?: Good; qty?: number; price?: number; amount?: number; arrestId?: string; day: number; text: string }
export interface Nature { kind: 'kuraklik' | 'salgin' | 'sel' | 'bereket' | 'balik'; start: number; until: number }
export interface Caravan { day: number; until: number; goods: Partial<Record<Good, number>>; name: string; earned?: number; spent?: number }
export interface Threat { name: string; demand: number; day: number; deadline: number; strength: number }

/** A minor (bebek/çocuk/genç). Becomes a full Person (same id) at ADULT_AGE game days. */
export interface Child {
  id: string; name: string; female: boolean; born: number; parents: string[];
  honesty: number; ambition: number; hairColor: number; skin: number; shirt: number;
  school: number; inSchool: boolean; sick: number; hunger: number; orphan: boolean; soylu: boolean;
}

export type Fate = 'surgun' | 'zindan' | 'af';
export interface Isyan {
  day: number; hour: number; leaderId: string | null; rebels: string[]; occupied: string[]; killed: number; soldiersLost: number;
  lastCmd: string; lastCmdHour: number; log: string[]; hours: number; concessions: number;
}
export interface Deposed { personId: string; until: number; killed: number; votes: Record<string, Fate>; voters: string[] }

export interface Listing { id: string; sellerId: string; good: Good; qty: number; price: number; market: string; }

export interface LedgerEntry { day: number; from: string; to: string; amount: number; reason: string; }

export type PetitionKind = 'yardim' | 'is' | 'vergi' | 'sikayet' | 'kanun' | 'gorev';
export interface Petition {
  id: string; fromId: string; kind: PetitionKind; text: string; day: number; expires: number;
  status: 'bekliyor' | 'kabul' | 'ret' | 'zamanasimi'; amount: number; payload?: string; answeredBy?: string;
}

export type CaseStage = 'savci' | 'hakim' | 'kapandi';
export interface CourtCase {
  id: string; accusedId: string; crime: CrimeKind; victimId: string | null;
  amount: number; evidence: number; stage: CaseStage; day: number; deadline: number;
  verdict?: 'suclu' | 'beraat' | 'dusuruldu' | 'af'; sentence?: string; trial?: Trial; bribed?: boolean; defenders?: string[]; witnesses?: { id: string; against: boolean }[]; called?: { id: string; at: number }[]; crimeH?: number; crimeX?: number; crimeY?: number; eyewitnesses?: number; basis?: string; eyeIds?: string[]; complainantId?: string | null;
}

export interface Law { id: string; name: string; desc: string; active: boolean; param?: number; paramLabel?: string; }

export interface Project { id: string; name: string; site: string; kind?: string; plot?: string; cost: number; paid: number; progress: number; needed: number; done: boolean; }

export interface Election { last?: { day: number; results: { id: string; votes: number; won: boolean }[] }; posters?: Record<string, number>; nextDay: number; candidates: string[]; votes: Record<string, string>; seats: number; baskanNextDay: number; baskanCandidates: string[]; baskanVotes: Record<string, string>; }

export interface Gazette { day: number; headline: string; lines: string[]; meclis?: string[]; }

export interface PlayerInfo {
  playerId: string; personId: string; name: string; founder: boolean; banned: boolean;
  lastSeen: number; // ms
  lastSeenDay: number; awayLog: string[]; awayMoney: number; quest?: number;
}

export type Ideology = 'saltanatci' | 'cumhuriyetci' | 'esnaf' | 'halkci';
export interface Faction { id: string; name: string; ideology: Ideology; leaderId: string | null; color: string; }
export interface Seat { id: string; label: string; kind: 'bolge' | 'meslek' | 'genel'; key: string; holder: string | null; }
export type BillKind = 'ozel' | 'vergi' | 'fiyat' | 'maas' | 'butce' | 'kanun' | 'insaat' | 'af' | 'gensoru' | 'sorusturma' | 'dokunulmazlik' | 'azil' | 'genelge';
export type VoteChoice = 'evet' | 'hayir' | 'cekimser';
export interface Bill {
  id: string; kind: BillKind; title: string; proposerId: string; value: number; target: string;
  day: number; debateUntil: number; voteUntil: number;
  status: 'tartisma' | 'oylama' | 'onay' | 'kabul' | 'ret' | 'veto' | 'zamanasimi';
  law?: import('./laws').LawSpec;
  votes: Record<string, VoteChoice>; speeches: { personId: string; text: string; day: number; ai?: boolean }[]; result?: string; fromKayzer?: boolean;
}
export interface MeclisState {
  seats: Seat[]; factions: Faction[]; bills: Bill[]; log: { day: number; text: string }[];
  bribes: { from: string; to: string; amount: number; day: number; exposed: boolean }[]; salary: number;
}
export interface Budget { limit: number; spent: number; until: number; approved: boolean; }

export interface Coup { leaderId: string; kind: 'coup' | 'revolution'; day: number; fund: number; }

export type GoalId = 'tuccar' | 'meclisbaskani' | 'vezir' | 'asi';
export interface Mission { id: string; text: string; reward: number; to: string | null; by: string; day: number; status: 'acik' | 'bildirildi' | 'odendi' | 'iptal'; claimedBy?: string }
export interface World {
  cruelOrders?: number; missions?: Mission[];
  orgs?: import('./realm').Org[]; spies?: import('./realm').Spy[]; plots?: import('./realm').Plot[]; warrants?: string[]; history?: import('./realm').Chronicle[]; informantPay?: number;
  version: number;
  seed: number;
  rng: number;
  day: number;
  hour: number; // 0..23
  lastTickAt: number; // ms real time of the last processed game hour boundary
  frozen: boolean;
  treasury: number;
  taxRate: number; // percent of sales
  headTax: number; // dinar per adult per day
  salaries: Partial<Record<Profession, number>>;
  laws: Law[];
  people: Person[];
  buildings: Building[];
  listings: Listing[];
  prices: Record<Good, number>;
  market: { sold: Record<Good, number>; unmet: Record<Good, number> };
  ledger: LedgerEntry[];
  petitions: Petition[];
  cases: CourtCase[];
  projects: Project[];
  election: Election;
  gazette: Gazette[];
  events: { day: number; hour: number; text: string; personId?: string; x?: number; y?: number }[];
  todayEvents: string[];
  players: Record<string, PlayerInfo>;
  regime: 'imparatorluk' | 'cumhuriyet';
  meclis: MeclisState;
  budget: Budget;
  headAwayDays: number;
  children: Child[];
  proposals: { id: string; kind: 'evlilik' | 'cocuk'; from: string; to: string; day: number }[];
  pregnancies: { parents: string[]; due: number }[];
  veliaht: string | null; // designated heir (child id)
  exKayzerId?: string | null;
  disaster?: { id: number; kind: string; text: string; day: number } | null; // v1.9.6: shown to every online player as a popup // v1.9.6: a Kayzer who lost the throne by going to the zindan
  regentId: string | null; // rules for a minor heir
  regentFor: string | null;
  isyan: Isyan | null;
  deposed: Deposed | null;
  schema: number;
  speed: number; // 0.5 | 1 | 2 (Kayzer only)
  nature: Nature | null; nextDrought: number;
  festivalUntil: number; // game day (inclusive) the festival ground is open
  granary: number; // state wheat store (tahıl ambarı)
  priceCaps: Partial<Record<Good, number>>;
  arrests: Arrest[];
  chatOut: NpcMsg[];
  talks: Talk[];
  posLog?: Record<string, [number, number, number][]>; posAt?: number; crimeLog?: { criminalId: string; victimId: string | null; H: number; x: number; y: number }[]; // v1.9.8 alibi history
  corpses?: Corpse[]; crimeReports?: { criminalId: string; victimId: string; crime: CrimeKind; amount: number; at: number; eyes?: number; eyeIds?: string[] }[]; escorts?: Escort[];
  llm?: { day: string; n: number; talkAt: number; speechAt?: number };
  offers: Offer[];
  rumors: { day: number; text: string; about: string }[];
  caravan: Caravan | null; threat: Threat | null;
  bans: string[]; // custom bans (icki, kumar, gece)
  loans: { id: string; debtor: string; lender: string; amount: number; due: number; day: number }[];
  serverNow?: number;
  shortDays?: number;
  customLaws: import('./laws').CustomLaw[];
  serving?: string[];
  suspicion?: Record<string, number>;
  treasuryBook?: { day: number; items: Record<string, number> }[];
  priceHist?: Partial<Record<Good, number[]>>;
  outsideNet: number; // money that left to / came from the outside world (caravans, tribute) – keeps the books balanced
  allowStateTakeover: boolean;
  kayzerId: string | null; // head of state person id: Kayzer, or Başkan in the republic
  founderPersonId: string | null;
  hanedanId: string; // the founder dynasty person id placeholder
  cumhuriyet: number; // 0..100
  cumhuriyetDays: number; // days spent >= 85
  coup: Coup | null;
  stats: { day: number; treasury: number; mood: number; cumhuriyet: number; money: number; prices: Record<Good, number> }[];
  dailyIncome: number; dailyExpense: number;
  lastSnapshotAt: number;
  idSeq: number;
}

export type Action =
  | { t: 'buy'; good: Good; qty: number }
  | { t: 'sell'; good: Good; qty: number; price: number }
  | { t: 'eat' }
  | { t: 'askida'; qty: number }
  | { t: 'petition'; kind: PetitionKind; text: string; amount?: number; payload?: string }
  | { t: 'answer'; petitionId: string; accept: boolean }
  | { t: 'setTax'; rate: number }
  | { t: 'setHeadTax'; amount: number }
  | { t: 'setSalary'; prof: Profession; amount: number }
  | { t: 'toggleLaw'; lawId: string; active: boolean; param?: number }
  | { t: 'startProject'; name: string; cost: number }
  | { t: 'fundProject'; projectId: string; amount: number }
  | { t: 'appoint'; personId: string; prof: Profession }
  | { t: 'pardon'; caseId: string }
  | { t: 'caseDecision'; caseId: string; decision: 'kovustur' | 'dusur' | 'suclu' | 'beraat' }
  | { t: 'arrest'; personId: string }
  | { t: 'steal'; personId: string }
  | { t: 'bribe'; personId: string; amount: number }
  | { t: 'give'; personId: string; amount: number }
  | { t: 'runForMeclis' }
  | { t: 'vote'; candidateId: string }
  | { t: 'runForBaskan' }
  | { t: 'propose'; kind: BillKind; value?: number; target?: string; title?: string; law?: import('./laws').LawSpec }
  | { t: 'enactLaw'; law: import('./laws').LawSpec } | { t: 'repealLaw'; lawId: string } | { t: 'inspect'; personId: string }
  | { t: 'castVote'; billId: string; choice: VoteChoice }
  | { t: 'speak'; billId: string; text: string }
  | { t: 'sanction'; billId: string; approve: boolean }
  | { t: 'joinFaction'; factionId: string }
  | { t: 'voteBaskan'; candidateId: string }
  | { t: 'plot'; kind: 'coup' | 'revolution' | 'none' }
  | { t: 'fundPlot'; amount: number }
  | { t: 'seize' }
  | { t: 'restore' }
  | { t: 'festival'; cost: number }
  | { t: 'marry'; personId: string }
  | { t: 'answerProposal'; proposalId: string; accept: boolean }
  | { t: 'divorce' }
  | { t: 'haveChild' }
  | { t: 'school'; childId: string; on: boolean }
  | { t: 'cure'; childId: string }
  | { t: 'veliaht'; childId: string | null }
  | { t: 'abdicate' }
  | { t: 'isyanCmd'; cmd: 'dagit' | 'tutukla' | 'saldir' }
  | { t: 'joinRebels' }
  | { t: 'fateVote'; fate: Fate }
  | { t: 'setSpeed'; speed: number }
  | { t: 'setGoal'; goal: GoalId }
  | { t: 'buyHome'; houseId: string } | { t: 'rentHome'; houseId: string } | { t: 'goHome'; sleep?: boolean } | { t: 'leaveHome' } | { t: 'foundFaction'; name: string }
  | { t: 'drinkMilk' } | { t: 'eatEgg' } | { t: 'buyFarm' } | { t: 'buildBarn'; kind: 'ahir' | 'kumes' } | { t: 'feedAnimals' } | { t: 'collectFarm' } | { t: 'ride'; on: boolean } | { t: 'buyAnimal'; animal: import('./realm').Animal; n?: number } | { t: 'slaughter'; animal: import('./realm').Animal }
  | { t: 'grantTitle'; personId: string; rank: import('./realm').Rank; fief?: string | null } | { t: 'stripTitle'; personId: string }
  | { t: 'orgFound'; kind: import('./realm').OrgKind; name: string } | { t: 'orgJoin'; orgId: string } | { t: 'orgLeave' } | { t: 'orgMeet' } | { t: 'orgRole'; personId: string; role: import('./realm').OrgRole } | { t: 'orgAct'; deed: import('./realm').OrgDeed }
  | { t: 'assignSpy'; spyId: string; targetId: string } | { t: 'warrant'; personId: string } | { t: 'searchHouse'; personId: string } | { t: 'raidOrg'; orgId: string } | { t: 'informantPay'; amount: number }
  | { t: 'missionCreate'; text: string; reward: number; to: string | null }
  | { t: 'missionClaim'; id: string }
  | { t: 'missionPay'; id: string; pay: boolean }
  | { t: 'drinkWater' } | { t: 'pray' } | { t: 'drink' } | { t: 'doctor' } | { t: 'work' } | { t: 'nightOut'; on: boolean }
  | { t: 'assault'; personId: string } | { t: 'kill'; personId: string } | { t: 'insult'; personId: string } | { t: 'chatWith'; personId: string }
  | { t: 'offerBribe'; arrestId: string; amount: number } | { t: 'answerBribe'; arrestId: string; accept: boolean }
  | { t: 'answerOffer'; offerId: string; accept: boolean }
  | { t: 'poster' } | { t: 'campaign'; text: string }
  | { t: 'sermon'; topic: 'namaz' | 'icki' | 'sabir' }
  | { t: 'directive'; topic: 'namaz' | 'icki' | 'laik' }
  | { t: 'granary'; op: 'buy' | 'release'; qty: number }
  | { t: 'priceCap'; good: Good; price: number | null }
  | { t: 'defend'; caseId: string } | { t: 'witness'; caseId: string; against: boolean; text?: string } | { t: 'callWitness'; caseId: string; personId: string } | { t: 'customize'; look: import('./look').Look; where: 'ilk' | 'terzi' | 'berber' }
  | { t: 'smuggle'; on: boolean }
  | { t: 'borrow'; amount: number } | { t: 'repay'; loanId: string } | { t: 'festivalOpen'; cost: number } | { t: 'buildAt'; plotId: string; kind: string }
  | { t: 'move'; x: number; y: number } | { t: 'report'; corpseId: string } | { t: 'defense'; caseId: string; text: string } | { t: 'restCase'; caseId: string }
  | { t: 'tribute'; pay: boolean } | { t: 'caravanBuy'; good: Good; qty: number };

export interface ActionResult { ok: boolean; msg: string; }
