export type Good = 'ekmek' | 'su' | 'et' | 'balik' | 'kumas' | 'alet' | 'odun';
export const GOODS: Good[] = ['ekmek', 'su', 'et', 'balik', 'kumas', 'alet', 'odun'];

export type Profession =
  | 'firinci' | 'sucu' | 'kasap' | 'balikci' | 'terzi' | 'demirci' | 'marangoz'
  | 'tuccar' | 'hekim' | 'hoca' | 'hamal' | 'insaatci' | 'kalemsor' | 'imam'
  | 'memur' | 'tahsildar' | 'bekci' | 'savci' | 'hakim' | 'asker' | 'kayzer' | 'naip';

export type Office = 'meclis';

export type BuildingKind =
  | 'saray' | 'mahkeme' | 'kisla' | 'cami' | 'meclis' | 'okul' | 'hekimhane' | 'liman'
  | 'kasap' | 'degirmen' | 'firin' | 'kuyu' | 'atolye' | 'pazar' | 'ev' | 'santiye' | 'zindan' | 'kahve';

export interface Building {
  id: string;
  name: string;
  kind: BuildingKind;
  x: number; y: number; w: number; h: number; // tiles
  door: { x: number; y: number };
  market?: boolean;
}

export interface Person {
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
}

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
  id: string; accusedId: string; crime: 'hirsizlik' | 'rusvet' | 'zimmet' | 'isyan'; victimId: string | null;
  amount: number; evidence: number; stage: CaseStage; day: number; deadline: number;
  verdict?: 'suclu' | 'beraat' | 'dusuruldu' | 'af'; sentence?: string; bribed?: boolean;
}

export interface Law { id: string; name: string; desc: string; active: boolean; param?: number; paramLabel?: string; }

export interface Project { id: string; name: string; site: string; cost: number; paid: number; progress: number; needed: number; done: boolean; }

export interface Election { nextDay: number; candidates: string[]; votes: Record<string, string>; seats: number; baskanNextDay: number; baskanCandidates: string[]; baskanVotes: Record<string, string>; }

export interface Gazette { day: number; headline: string; lines: string[]; meclis?: string[]; }

export interface PlayerInfo {
  playerId: string; personId: string; name: string; founder: boolean; banned: boolean;
  lastSeen: number; // ms
  lastSeenDay: number; awayLog: string[]; awayMoney: number;
}

export type Ideology = 'saltanatci' | 'cumhuriyetci' | 'esnaf' | 'halkci';
export interface Faction { id: string; name: string; ideology: Ideology; leaderId: string | null; color: string; }
export interface Seat { id: string; label: string; kind: 'bolge' | 'meslek'; key: string; holder: string | null; }
export type BillKind = 'vergi' | 'fiyat' | 'maas' | 'butce' | 'kanun' | 'insaat' | 'af' | 'gensoru' | 'sorusturma' | 'dokunulmazlik' | 'azil';
export type VoteChoice = 'evet' | 'hayir' | 'cekimser';
export interface Bill {
  id: string; kind: BillKind; title: string; proposerId: string; value: number; target: string;
  day: number; debateUntil: number; voteUntil: number;
  status: 'tartisma' | 'oylama' | 'onay' | 'kabul' | 'ret' | 'veto' | 'zamanasimi';
  votes: Record<string, VoteChoice>; speeches: { personId: string; text: string; day: number }[]; result?: string;
}
export interface MeclisState {
  seats: Seat[]; factions: Faction[]; bills: Bill[]; log: { day: number; text: string }[];
  bribes: { from: string; to: string; amount: number; day: number; exposed: boolean }[]; salary: number;
}
export interface Budget { limit: number; spent: number; until: number; approved: boolean; }

export interface Coup { leaderId: string; kind: 'coup' | 'revolution'; day: number; fund: number; }

export interface World {
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
  regentId: string | null; // rules for a minor heir
  regentFor: string | null;
  isyan: Isyan | null;
  deposed: Deposed | null;
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
  | { t: 'propose'; kind: BillKind; value?: number; target?: string; title?: string }
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
  | { t: 'fateVote'; fate: Fate };

export interface ActionResult { ok: boolean; msg: string; }
