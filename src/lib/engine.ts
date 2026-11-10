/*
 * 5000만분의 1 — 시뮬레이션 엔진
 *
 * React 나 DOM 에 의존하지 않는다. 화면(src/components)과 검증 스크립트(scripts/simulate.ts)가 함께 쓴다.
 *
 *   const life = createLife({ birthYear: 1975, seed });
 *   let y = life.start();            // 출생 (0세)
 *   while (!y.dead) {
 *     y = y.choice ? life.choose(i)  // 선택지가 있으면 고른 결과
 *                  : life.next();    // 없으면 한 해 진행
 *   }
 *   life.summary();
 *
 * 매 해의 확률은 그 '달력 연도'의 통계(timeline.ts)를 쓴다.
 * 금액은 모두 2024년 현재 가치(만원)이고, 그해의 실질임금·실질 집값 지수로 조정한다.
 */
import { KDATA as D, type EduTier, type JobType, type RegionGroup, type Sex } from './data';
import {
  CANCERS, DILEMMAS, DREAMS, INTEREST_CERTS, INTEREST_DREAMS, INTEREST_LATE_JOBS, INTEREST_TITLES, INTERESTS, JOB_TITLES, LIFE_EVENTS,
  MEETING_PLACES, MILITARY_BASES, RANDOM_EVENTS, TRAITS, type Dilemma, type RandomEvent,
  availableIn, stageOf, type Dated, type Effect, type InterestKey, type StatKey, type TraitKey,
} from './content';
import { PATHS, type PathChoice, type PathOption } from './paths';
import { childSexRatio, isRegionId, maleShare, nationalSexRatio, regionBirthWeights, sexRatio, type RegionId } from './births';
import { namesFor } from './names';
import { Rng } from './random';
import { josa, particle, won } from './text';
import {
  at, BACKGROUND_HAZARD, BIRTHS, CAREER_BREAK, COLLEGE_RATE, CURRENT_YEAR, FARM_SHARE, FEMALE_SCHOOL_GAP,
  FIRST_MARRIAGE_AGE, HIGH_SCHOOL_RATE, HISTORY, INFANT_MORTALITY, LIFE_EXPECTANCY, MARITAL_FERTILITY,
  EVER_MARRIED, MARRIAGE_SD, MIDDLE_SCHOOL_RATE, NATIONAL_PENSION_START, REAL_HOUSE, REAL_WAGE, TFR, UNEMPLOYMENT,
  WIFE_WORKS, alternativeServiceName, basicPension, depositRate, elementaryName, examName, INVEST_FROM, INVEST_FUTURE, investReturn, militaryMonths,
  tutoringBanned, vocationalSchoolName,
} from './timeline';

export { CURRENT_YEAR } from './timeline';

// ───────────────────────── 타입 ─────────────────────────
export type EntryKind = 'event' | 'milestone' | 'fact' | 'good' | 'bad' | 'death' | 'choice' | 'pick' | 'news';
export interface Entry { text: string; kind: EntryKind }
export interface ChoiceView { prompt: string; options: { label: string; desc: string }[] }
export interface Stats { health: number; happiness: number; ability: number; relation: number }
export interface FamilyView {
  parentsAlive: boolean;
  spouse: {
    name: string; age: number; status: 'married' | 'widowed' | 'divorced'; works: boolean;
    /** 학력 (고졸, 수도권 4년제 대학 …) */
    edu: string;
    /** 지금 하는 일 (은퇴, 전업주부 …) */
    job: string;
  } | null;
  children: { name: string; sex: Sex; age: number }[];
  grandchild: boolean;
}
// ───────── 돈 관리 (claude/money/SKILL.md) ─────────
export type Spend = 'frugal' | 'normal' | 'loose';
export type InvestKind = 'stock' | 'global' | 'crypto';
export const INVEST_KINDS: InvestKind[] = ['stock', 'global', 'crypto'];
/** alloc: 쓸 수 있는 돈을 어디에 둘지 (%, 합 100) */
export interface MoneyPlan { spend: Spend; alloc: Record<'deposit' | InvestKind, number> }
export const DEFAULT_PLAN: MoneyPlan = { spend: 'normal', alloc: { deposit: 100, stock: 0, global: 0, crypto: 0 } };
/** 가처분소득 가운데 쓰는 비율 */
export const SPEND_RATE: Record<Spend, number> = { frugal: 0.6, normal: 0.7, loose: 0.8 };
/** 같은 해에도 사람마다 다른 수익 (종목 차이) */
const INVEST_NOISE: Record<InvestKind, number> = { stock: 0.08, global: 0.03, crypto: 0.25 };

/** 금액은 모두 만원, 2024년 가치 */
export interface AssetView {
  netWorth: number;
  /** 쓸 수 있는 돈 전체(예금 + 투자). 빚이면 음수 */
  cash: number;
  deposit: number;
  invest: Record<InvestKind, number>;
  house: { price: number; debt: number } | null;
  income: { self: number; spouse: number; pension: number };
}
export interface Snapshot {
  name: string; age: number; year: number; birthYear: number; sex: Sex;
  region: string; residence: string; stats: Stats;
  netWorth: number | null; familyLabel: string;
  job: string | null; edu: string | null;
  married: boolean; children: number; house: boolean;
  family: FamilyView;
  /** 독립하기 전(부모님과 사는 동안)에는 null */
  assets: AssetView | null;
  /** 성향 -100~100 */
  traits: Record<TraitKey, number>;
  /** 가장 큰 관심 분야 이름 (아직 없으면 null) */
  interest: string | null;
  major: string | null;
  plan: MoneyPlan;
  /** 그해 고를 수 있는 투자 */
  investOpen: Record<InvestKind, boolean>;
  /** 지난해 실질 수익률 (들고 있던 것만) */
  lastReturn: Partial<Record<InvestKind, number>>;
}
/** 직접 고른 선택 하나 (결과 리포트의 '인생의 갈림길') */
export interface TurningPoint { age: number; year: number; prompt: string; label: string; kind: ChoiceKind }
export type ChoiceKind = 'core' | 'path' | 'dilemma';
export interface YearResult {
  age: number; year: number; entries: Entry[];
  choice: ChoiceView | null; dead: boolean; isChoiceResult: boolean; snapshot: Snapshot;
}
export interface Summary {
  seed: number; name: string; sex: Sex; region: string; family: string;
  age: number; cause: string; birthYear: number; deathYear: number;
  edu: string | null; lastWork: string | null;
  netWorth: number | null; netWorthText: string | null;
  children: number; married: boolean;
  lines: string[]; outliveText: string; outlivePercent: number;
  traits: Record<TraitKey, number>; interest: string | null; major: string | null;
  /** 스스로 고른 선택(운에 맡긴 것 제외) */
  turningPoints: TurningPoint[];
}
export interface LifeOptions { seed?: number; birthYear?: number }

interface Option { label: string; desc?: string; auto?: number; run: () => void }
/** base: 2024년 가치 기준 연봉(경력 반영). 실제 그해 연봉 = base × 그해 실질임금 지수 */
interface Job { type: JobType; title: string; base: number; since?: number; main: boolean }
/** incomeBase: 2024년 가치 연봉(만원), 일하지 않으면 0 */
interface Spouse { name: string; sex: Sex; age0: number; incomeBase: number; alive: boolean; edu: EduTier; job: string }
interface Child { sex: Sex; name: string; bornAge: number }
/** base: 2024년 가치 기준 집값. 실제 그해 집값 = base × 그해 실질 집값 지수 */
interface House { base: number; debt: number; loan: number; boughtAge: number }
interface Residence { name: string; group: RegionGroup; seoul: boolean }
interface Flags {
  tutoring?: boolean; allIn?: boolean; vocational?: boolean;
  score?: number; retake?: boolean; collegeStart?: number;
  gradAge?: number; jobSearchAge?: number; prepareUntil?: number;
  militaryStart?: number; militaryEnd?: number; militaryDone?: boolean; movedSeoul?: boolean;
  exerciseAsked?: boolean; exercise?: boolean; retired?: boolean; homemaker?: boolean;
  declinedMarriage?: number; divorced?: boolean; widowed?: boolean;
  parentHelpUsed?: boolean; parentsGone?: boolean; grandchild?: boolean;
  cancerAge?: number; welfare?: boolean; leftFarm?: boolean; lastDebtCall?: number;
  track?: 'science' | 'humanities' | 'arts'; retirePlan?: 'save' | 'work' | 'farm'; grandCareAsked?: boolean;
}

/**
 * 작은 사건은 거의 해마다 일어나므로(예전엔 두 해에 한 번) 수치 변화는 문장에 적힌 값의 60%만 반영한다.
 * 그래야 진학·취업·사망률 같은 통계 보정이 그대로 유지된다. 돈(cash)은 그대로.
 */
const EVENT_STAT_SCALE = 0.6;

const EDU_ORDER: EduTier[] = ['elementary', 'middle', 'highschool', 'college2', 'local4', 'capital4', 'top4'];
/** 배우자 직업: 학력 무리별 직업 비중 (추정: 학력별 취업 분포 근사) */
const SPOUSE_JOBS: Record<'low' | 'mid' | 'high', [Exclude<JobType, 'none'>, number][]> = {
  low: [['sme', 0.4], ['contract', 0.3], ['self', 0.2], ['farm', 0.15]],
  mid: [['sme', 0.4], ['large', 0.15], ['public', 0.18], ['contract', 0.15], ['self', 0.1], ['farm', 0.03]],
  high: [['large', 0.33], ['public', 0.25], ['sme', 0.2], ['professional', 0.08], ['contract', 0.07], ['self', 0.05]],
};
/** 배우자 연봉 배수 (기본 2,600~5,100만 원에 곱한다, 평균이 1 안팎이 되게 맞춤) */
const SPOUSE_PAY: Record<Exclude<JobType, 'none'>, number> = { large: 1.35, public: 1.05, professional: 1.8, sme: 0.9, contract: 0.7, self: 0.95, farm: 0.6 };
/** 4년제 대학을 나와야 하는 직업 이름 (배우자 직업을 고를 때 학력에 맞춘다) */
const NEEDS_DEGREE = /교사|연구원|엔지니어|기획자|재무|마케터|설계|공무원|공기업/;
const NATIVE_NUM = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const EDU_PHRASE: Record<EduTier, string> = {
  elementary: '초등학교를 마친', middle: '중학교를 나온', highschool: '고등학교를 나온', college2: '전문대를 나온',
  local4: '지방 대학을 나온', capital4: '수도권 대학을 나온', top4: '상위권 대학을 나온',
};

/** 결혼한 부부에게 n번째 아이를 가질 기회가 오는 해마다의 기본 확률 (그해 혼인 출산 배수를 곱한다, 모형 보정값) */
const CHILD_HAZARD = [0.32, 0.18, 0.035, 0.022];
/** 엄마 나이 33~34 / 35~36 / 37~38 / 39~40 / 41~42세의 배수. 32세까지는 1 (추정: 연령별 출산율 곡선의 모양) */
const AGE_FERTILITY = [1.05, 0.95, 0.65, 0.28, 0.1];

function scaleFx(fx: Effect, k: number): Effect {
  const out: Effect = { ...fx };
  for (const key of ['health', 'happiness', 'ability', 'relation'] as StatKey[]) {
    const v = fx[key];
    if (v) out[key] = Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * k));
  }
  return out;
}

// ───────────────────────── 사망률 ─────────────────────────
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const QM = D.mortality.quintileMultiplier;

const infantRate = (sex: Sex, year: number) => at(INFANT_MORTALITY, year) * (sex === 'M' ? 1.08 : 0.92);

function periodE0(sex: Sex, year: number, a: number): number {
  const b = D.mortality[sex].b;
  const lam = at(BACKGROUND_HAZARD, year);
  let total = 0;
  for (const m of QM) {
    let S = 1, e = 0;
    const q0 = infantRate(sex, year) * m;
    e += S * (1 - q0) + S * q0 * 0.1;
    S *= 1 - q0;
    for (let x = 1; x < 120 && S > 1e-9; x++) {
      const q = 1 - Math.exp(-(lam + a * Math.exp(b * x)) * m);
      e += S * (1 - q) + S * q * 0.5;
      S *= 1 - q;
    }
    total += e / QM.length;
  }
  return total;
}

const aCache = new Map<string, number>();
/** 그해 기대수명(기간 생명표)이 나오도록 Gompertz 계수 a 를 찾는다 */
function gompertzA(sex: Sex, year: number): number {
  const y = Math.round(year);
  const key = sex + y;
  const hit = aCache.get(key);
  if (hit !== undefined) return hit;
  const target = at(LIFE_EXPECTANCY[sex], y);
  let lo = Math.log(1e-9), hi = Math.log(1e-1);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (periodE0(sex, y, Math.exp(mid)) > target) lo = mid;
    else hi = mid;
  }
  const a = Math.exp((lo + hi) / 2);
  aCache.set(key, a);
  return a;
}

/** sex 인 사람이 year 년에 age 세일 때 그해 안에 숨질 확률 */
export function hazard(sex: Sex, age: number, year: number, mult: number): number {
  if (age === 0) return Math.min(0.5, infantRate(sex, year) * mult);
  const lam = at(BACKGROUND_HAZARD, year);
  return 1 - Math.exp(-(lam + gompertzA(sex, year) * Math.exp(D.mortality[sex].b * age)) * mult);
}

/** birthYear 년에 태어난 아이들 중 age 세보다 오래 사는 비율 (남녀·소득분위 평균, 해마다 그해 사망률 적용) */
export function cohortSurvival(birthYear: number, age: number): number {
  let total = 0;
  for (const sex of ['M', 'F'] as Sex[]) {
    const m = maleShare(nationalSexRatio(birthYear));
    const w = sex === 'M' ? m : 1 - m;
    for (const qm of QM) {
      let S = 1;
      for (let x = 0; x <= age; x++) S *= 1 - hazard(sex, x, birthYear + x, qm);
      total += (w * S) / QM.length;
    }
  }
  return total;
}

/** 표준정규분포 누적확률 */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

const eduName = (t: EduTier) => D.eduTiers[t].label.replace(' 졸업', '');
const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('ko-KR');
const pct = (r: number) => Math.round(r * 100);

// ───────────────────────── 인생 ─────────────────────────
export class Life {
  readonly seed: number;
  readonly birthYear: number;
  private r: Rng;
  age = 0;
  alive = true;
  pending: { prompt: string; options: Option[]; kind: ChoiceKind } | null = null;
  history: YearResult[] = [];
  /** 바로 다음 choose() 가 운에 맡긴 선택인지 */
  private autoPicking = false;
  private current: { entries: Entry[] } = { entries: [] };
  private shownFacts = new Set<string>();
  private usedEvents = new Set<string>();
  flags: Flags = {};

  region!: (typeof D.birthsByRegion)[number];
  residence!: Residence;
  sex!: Sex;
  quintile = 3;
  surname = '';
  name = '';
  dream = '';
  stats: Stats = { health: 66, happiness: 60, ability: 50, relation: 55 };

  cash = 0;
  independent = false;
  edu: EduTier | null = null;
  job: Job | null = null;
  careerYears: Partial<Record<JobType, number>> = {};
  pensionYears = 0;
  lastWork: string | null = null;
  married = false;
  spouse: Spouse | null = null;
  children: Child[] = [];
  house: House | null = null;
  pensionBase = 0;
  deathCause = '';
  /** 성향 -100~100 (claude/paths/SKILL.md) */
  traits: Record<TraitKey, number> = { bold: 0, social: 0, diligent: 0, thrift: 0 };
  /** 관심 분야 점수. 쌓이기만 한다 */
  interests: Record<InterestKey, number> = { science: 0, words: 0, art: 0, sport: 0, tech: 0, care: 0, biz: 0, nature: 0 };
  major: string | null = null;
  /** 고른 선택의 기록 */
  choiceLog: (TurningPoint & { auto: boolean })[] = [];
  /** 돈 관리 계획. cash 는 쓸 수 있는 돈 전체이고, 그 가운데 invest 만큼이 투자에 들어 있다 */
  plan: MoneyPlan = { spend: 'normal', alloc: { ...DEFAULT_PLAN.alloc } };
  invest: Record<InvestKind, number> = { stock: 0, global: 0, crypto: 0 };
  lastReturn: Partial<Record<InvestKind, number>> = {};

  constructor(opts: LifeOptions = {}) {
    this.seed = (opts.seed === undefined ? Math.floor(Math.random() * 2 ** 32) : opts.seed) >>> 0;
    this.birthYear = opts.birthYear ?? CURRENT_YEAR;
    this.r = new Rng(this.seed);
  }

  get year() { return this.birthYear + this.age; }
  get quintileInfo() { return D.incomeQuintiles[this.quintile - 1]; }
  get wage() { return at(REAL_WAGE, this.year); }
  houseIndex(year = this.year) { return at(this.residence.seoul ? REAL_HOUSE.seoul : REAL_HOUSE.other, year); }
  get housePrice() { return this.house ? this.house.base * this.houseIndex() : 0; }
  get netWorth() { return this.cash + (this.house ? this.housePrice - this.house.debt : 0); }
  /** 그해 실업률이 평소(3.5%)보다 얼마나 높은지 */
  get jobMarket() { return at(UNEMPLOYMENT, this.year) / 0.035; }
  private titles(list: Dated[]) { return availableIn(list, this.year); }

  // ───────── 기록 도우미 ─────────
  private log(text: string, kind: EntryKind = 'event') { this.current.entries.push({ text, kind }); }
  private fact(key: string) {
    if (this.shownFacts.has(key)) return;
    const text = this.factText(key);
    if (!text) return;
    this.shownFacts.add(key);
    this.log(text, 'fact');
  }
  private apply(fx: Effect = {}) {
    for (const k of ['health', 'happiness', 'ability', 'relation'] as StatKey[]) {
      const d = fx[k];
      if (d) this.stats[k] = clamp(this.stats[k] + d);
    }
    if (fx.cash) this.cash += fx.cash * this.wage;
  }
  private ask(prompt: string, options: Option[], kind: ChoiceKind = 'core') {
    this.pending = { prompt, options, kind };
    this.log(prompt, 'choice');
  }

  // ───────── 성향·관심 분야 (갈림길 paths.ts 가 쓴다) ─────────
  trait(k: TraitKey) { return this.traits[k]; }
  /** 가장 큰 관심 분야 (5점 이상일 때) */
  mainInterest(): InterestKey | null {
    const [k, v] = (Object.entries(this.interests) as [InterestKey, number][]).sort((a, b) => b[1] - a[1])[0];
    return v >= 5 ? k : null;
  }
  /** 관심 분야 상위 n개 (같으면 정해진 순서) */
  topInterests(n: number): InterestKey[] {
    return (Object.entries(this.interests) as [InterestKey, number][]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  }
  pickFrom<T>(list: readonly T[]): T { return this.r.pick(list); }
  /** 관심 분야에 맞는 꿈 하나 */
  interestDream(): string {
    const k = this.mainInterest();
    return k ? this.r.pick(this.titles(INTEREST_DREAMS[k])) : this.dream;
  }
  setDream(d: string) { this.dream = d; }
  certName(): string {
    const k = this.mainInterest();
    const list = k ? this.titles(INTEREST_CERTS[k]) : [];
    return list.length ? this.r.pick(list) : this.year >= 1997 ? '컴퓨터활용능력' : '정보처리기능사';
  }
  /** 연봉을 p만큼 올린다 (이직·대학원 등) */
  raise(p: number) { if (this.job && this.job.base > 0) this.job.base *= 1 + p; }
  /**
   * 돈 관리 계획을 바꾼다 (화면의 돈 관리 패널, 되살리기 동작 { p }).
   * 배분은 바로 다시 나눈다. 그해 결과를 돌려주지만 기록(history)에는 남기지 않는다.
   */
  setPlan(plan: MoneyPlan): YearResult {
    const a = plan.alloc;
    const clean = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0);
    const alloc = { deposit: 0, stock: clean(a.stock), global: clean(a.global), crypto: clean(a.crypto) };
    let rest = 100;
    for (const k of INVEST_KINDS) { alloc[k] = Math.min(alloc[k], rest); rest -= alloc[k]; }
    alloc.deposit = rest;
    this.plan = { spend: SPEND_RATE[plan.spend] ? plan.spend : 'normal', alloc };
    this.rebalance();
    return {
      age: this.age, year: this.year, entries: [],
      choice: this.pending ? { prompt: this.pending.prompt, options: this.pending.options.map((o) => ({ label: o.label, desc: o.desc ?? '' })) } : null,
      dead: !this.alive, isChoiceResult: true, snapshot: this.snapshot(),
    };
  }
  /** 예금에서 pct 만큼을 한 투자로 옮긴다 (갈림길용) */
  tiltPlan(kind: InvestKind, pct: number) {
    const alloc = { ...this.plan.alloc };
    const move = Math.min(alloc.deposit, pct);
    alloc.deposit -= move;
    alloc[kind] += move;
    this.plan = { ...this.plan, alloc };
    this.rebalance();
  }
  /** 투자를 모두 예금으로 (갈림길용) */
  safePlan() {
    this.plan = { ...this.plan, alloc: { ...DEFAULT_PLAN.alloc } };
    this.rebalance();
  }
  setSpend(s: Spend) { this.plan = { ...this.plan, spend: s }; }
  /** 투자에 들어 있는 비율 (0~1) */
  get riskShare() { return (this.plan.alloc.stock + this.plan.alloc.global + this.plan.alloc.crypto) / 100; }

  /** 쓸 수 있는 돈 전체를 계획대로 다시 나눈다. 아직 살 수 없는 투자 몫은 예금에 둔다 */
  private rebalance() {
    const liquid = this.cash;
    for (const k of INVEST_KINDS) this.invest[k] = liquid > 0 && this.year >= INVEST_FROM[k] ? (liquid * this.plan.alloc[k]) / 100 : 0;
  }

  /** 한 해 동안 돈이 불어나거나 줄어든다: 다시 나누고, 예금 이자와 투자 수익률을 곱한다 */
  private grow() {
    const y = this.year;
    if (this.cash <= 0) {
      for (const k of INVEST_KINDS) this.invest[k] = 0;
      this.lastReturn = {};
      this.cash *= 1.04; // 빚 이자
      return;
    }
    this.rebalance();
    let deposit = this.cash - this.invest.stock - this.invest.global - this.invest.crypto;
    deposit *= 1 + depositRate(y);
    this.lastReturn = {};
    const w = this.wage;
    for (const k of INVEST_KINDS) {
      const v = this.invest[k];
      if (v <= 0) continue;
      const [mean, sd] = INVEST_FUTURE[k];
      const base = investReturn(k, y) ?? Math.max(-0.85, this.r.normal(mean, sd));
      const r = Math.max(-0.9, base + this.r.normal(0, INVEST_NOISE[k]));
      this.invest[k] = v * (1 + r);
      this.lastReturn[k] = r;
      // 크게 오르내린 해는 기록에 남긴다
      if (v > 300 * w) {
        const name = k === 'stock' ? '주식' : k === 'global' ? '해외 주식' : '코인';
        if (r <= -0.25) this.log(`${josa(name, '이/가')} 크게 떨어졌다. 계좌를 보며 한숨을 쉬었다. (${Math.round(r * 100)}%)`, 'bad');
        else if (r >= 0.35) this.log(`${name} 값이 크게 올랐다. (+${Math.round(r * 100)}%)`, 'good');
      }
    }
    this.cash = deposit + this.invest.stock + this.invest.global + this.invest.crypto;
  }

  /** 갈림길에서 새 일을 시작한다 */
  beginJob(type: Exclude<JobType, 'none'>, main: boolean, titles?: Dated[]) { this.startJob(type, main, titles); }

  /** 성향 방향으로 '운에 맡기기' 가중치를 바꾼다 */
  private leanWeight(o: PathOption): number {
    let w = o.auto;
    for (const [k, v] of Object.entries(o.lean ?? {}) as [string, number][]) {
      const x = k in this.traits ? this.traits[k as TraitKey] / 40 : this.interests[k as InterestKey] / 6;
      w *= Math.exp(v * Math.max(-1.5, Math.min(1.5, x)));
    }
    return w;
  }

  /** 생애 갈림길: 꼭 나와야 하는 것(chance 1)이 먼저, 나머지는 해마다 확률로 하나 */
  private pathChoice() {
    const fits = PATHS.filter((p) => !this.usedEvents.has(`path:${p.id}`) && this.eventFits(p));
    if (!fits.length) return;
    let p: PathChoice | undefined = fits.find((x) => (x.chance ?? 0.5) >= 1);
    // 나올 확률이 높은 갈림길(학창 시절 등)은 공통 문턱 없이 자기 확률로 바로 굴린다
    if (!p) p = fits.find((x) => (x.chance ?? 0.5) >= 0.6 && this.r.chance(x.chance!));
    if (!p) {
      if (!this.r.chance(0.45)) return;
      const c = this.r.weighted(fits.map((x) => [x, x.chance ?? 0.5] as [PathChoice, number]))[0];
      if (!this.r.chance(Math.min(1, (c.chance ?? 0.5) * 1.6))) return;
      p = c;
    }
    this.usedEvents.add(`path:${p.id}`);
    const prompt = typeof p.prompt === 'function' ? p.prompt(this) : p.prompt;
    const opts = p.options(this);
    this.ask(prompt, opts.map((o) => ({ label: o.label, desc: o.desc, auto: this.leanWeight(o), run: () => this.runPathOption(o) })), 'path');
  }

  private runPathOption(o: PathOption) {
    for (const [k, v] of Object.entries(o.shape?.traits ?? {}) as [TraitKey, number][]) this.traits[k] = Math.max(-100, Math.min(100, this.traits[k] + v));
    for (const [k, v] of Object.entries(o.shape?.interests ?? {}) as [InterestKey, number][]) this.interests[k] += v;
    const [, text, fx] = this.r.weighted(o.outcomes.map((x) => [x, x[0]] as [typeof x, number]))[0];
    const mood = (fx.happiness ?? 0) + (fx.health ?? 0) + (fx.cash ?? 0) / 500;
    this.log(text, mood <= -3 ? 'bad' : mood >= 4 ? 'good' : 'event');
    // 학창 시절은 역량을 반만 반영한다 (진학률 보정)
    this.apply(this.age < 19 && fx.ability ? { ...fx, ability: fx.ability * 0.5 } : fx);
    o.then?.(this);
  }

  /** 그해 통계로 만든 통계 카드 문장 */
  private factText(key: string): string | null {
    const y = this.year;
    const past = y < 2025;
    const was = (v: string) => (past ? `${josa(v, '이었다/였다')}.` : `${josa(v, '으로/로')} 전망된다.`);
    switch (key) {
      case 'birth':
        return past
          ? `${y}년 한 해 태어난 아이는 약 ${fmt(at(BIRTHS, y) / 10000, 0)}만 명, 합계출산율은 ${fmt(at(TFR, y), 2)}명이었다.`
          : `${y}년에 태어나는 아이는 약 ${fmt(at(BIRTHS, y) / 10000, 0)}만 명, 합계출산율은 ${fmt(at(TFR, y), 2)}명으로 추정된다.`;
      case 'sexRatio': {
        const nat = nationalSexRatio(y);
        const reg = sexRatio(y, this.region.id as RegionId);
        if (nat < 108 && Math.abs(reg - nat) < 4) return null;
        const where = Math.abs(reg - nat) >= 4 ? `${this.region.name}에서는 ${fmt(reg)}명` : null;
        return `${y}년에는 여자아이 100명이 태어날 때 남자아이가 ${fmt(nat)}명 태어났다${where ? `. ${where}이었다` : ''}.`;
      }
      case 'region':
        return y >= 2000 ? '출생아 셋 중 하나 가까이는 경기도에서 태어난다.' : null;
      case 'lifeExp':
        return `${y}년에 태어난 아이의 기대수명은 남자 ${fmt(at(LIFE_EXPECTANCY.M, y))}세, 여자 ${fmt(at(LIFE_EXPECTANCY.F, y))}세${past ? '였다' : '로 전망된다'}.`;
      case 'middleSchool':
        return `${y}년 중학교 진학률은 약 ${pct(at(MIDDLE_SCHOOL_RATE, y))}%였다.`;
      case 'highSchool':
        return `${y}년 고등학교 진학률은 약 ${pct(at(HIGH_SCHOOL_RATE, y))}%였다.`;
      case 'tutoring':
        if (y < 1980) return '이 시절 과외는 넉넉한 집 아이들의 몫이었다.';
        if (y < 2000) return '1980년 7·30 조치로 과외가 금지됐다. 금지는 2000년 헌법재판소 결정으로 풀렸다.';
        return '2024년 기준 초중고생 10명 중 8명이 사교육을 받고, 1인당 월평균 사교육비는 약 47만 원이다.';
      case 'college':
        return was(`${y + 1}년 고등학교 졸업자의 대학 진학률은 약 ${pct(at(COLLEGE_RATE, y + 1))}%`);
      case 'military':
        return `${y}년 입대한 육군 현역병의 복무기간은 ${militaryMonths(y)}개월이었다.`;
      case 'jobMarket': {
        const u = at(UNEMPLOYMENT, y);
        return past ? `${y}년 실업률은 ${fmt(u * 100)}%였다.` : null;
      }
      case 'farm':
        return y < 2000 ? `${y}년 취업자의 약 ${pct(at(FARM_SHARE, y))}%가 농림어업에 종사했다.` : null;
      case 'nonRegular':
        return y >= 2002 ? '임금근로자 10명 중 3~4명이 비정규직이다.' : null;
      case 'largeVsSme':
        return y >= 2010 ? '대기업 근로자의 월평균 소득은 중소기업의 두 배를 넘는다.' : null;
      case 'marriage':
        return was(`${y}년 평균 초혼 연령은 남성 ${fmt(at(FIRST_MARRIAGE_AGE.M, y))}세, 여성 ${fmt(at(FIRST_MARRIAGE_AGE.F, y))}세`);
      case 'child':
        return was(`${y}년 합계출산율은 ${fmt(at(TFR, y), 2)}명`);
      case 'careerBreak':
        return y < 2010 ? '이 시절 많은 여성이 결혼이나 출산과 함께 직장을 그만뒀다.' : '결혼·출산으로 일을 그만두는 경력단절 여성은 지금도 100만 명이 넘는다.';
      case 'house':
        return y >= 2015 ? '주택을 가진 가구는 전체의 약 56%다.' : null;
      case 'retire':
        return '가장 오래 다닌 직장을 그만두는 나이는 평균 50대 초반이다.';
      case 'pension':
        return y >= NATIONAL_PENSION_START ? '국민연금은 1988년에 시작됐다. 가입 기간이 짧을수록 받는 돈도 적다.' : null;
      case 'elderPoverty':
        return y >= 2010 ? '65세 이상 노인 열 명 중 네 명 가까이가 상대적 빈곤 상태다.' : null;
      case 'cancer':
        return '기대수명까지 산다면 셋 중 한 명 이상은 암을 겪는다.';
      case 'imf':
        return '1998년 실업률은 7%로 치솟았고, 실업자는 150만 명에 이르렀다.';
      default:
        return null;
    }
  }

  // ───────── 출생 ─────────
  start(): YearResult {
    this.current = { entries: [] };
    const r = this.r;
    // 그해 시도별 출생아 비중으로 태어날 곳을, 그해 그 시도의 출생성비로 성별을 정한다.
    const weights = regionBirthWeights(this.birthYear);
    this.region = r.weighted(D.birthsByRegion, (x) => (isRegionId(x.id) ? weights[x.id] : 0));
    this.residence = { name: this.region.name, group: this.region.group, seoul: this.region.id === 'seoul' };
    this.sex = r.chance(maleShare(sexRatio(this.birthYear, this.region.id as RegionId))) ? 'M' : 'F';
    this.quintile = 1 + Math.floor(r.rand() * 5);
    this.surname = r.weighted(D.surnames)[0];
    this.name = this.surname + r.pick(namesFor(this.sex, this.birthYear));
    const qShift = [-4, -2, 0, 2, 4][this.quintile - 1];
    this.stats = {
      health: clamp(r.normal(66, 9)),
      happiness: 60,
      ability: clamp(r.normal(50 + qShift, 14)),
      relation: clamp(r.normal(55, 12)),
    };
    this.dream = r.pick(this.titles(DREAMS));
    // 타고난 기질: 성향은 0 근처에서 조금씩 다르게 시작한다
    for (const k of Object.keys(this.traits) as TraitKey[]) this.traits[k] = Math.round(r.normal(0, 8));

    const sexWord = this.sex === 'M' ? '남자아이' : '여자아이';
    this.log(`${this.birthYear}년, ${this.region.name}의 ${this.quintileInfo.label} 집에서 ${sexWord}로 태어났다. 이름은 ${this.name}.`, 'milestone');
    this.fact('birth');
    this.fact('sexRatio');
    if (this.region.id === 'gyeonggi') this.fact('region');
    this.fact('lifeExp');

    if (r.chance(hazard(this.sex, 0, this.year, QM[this.quintile - 1]))) this.die();
    return this.finishYear();
  }

  // ───────── 한 해 진행 ─────────
  next(): YearResult {
    if (!this.alive) throw new Error('이미 끝난 삶입니다');
    if (this.pending) throw new Error('선택지에 먼저 답해야 합니다');
    this.age += 1;
    this.current = { entries: [] };

    if (this.checkDeath()) return this.finishYear();

    if (HISTORY[this.year] && this.age >= 5) this.log(HISTORY[this.year], 'news');
    if (this.year === 1998 && this.independent) this.fact('imf');
    this.milestones();
    if (!this.pending) this.lifeOpportunities();
    this.career();
    this.familyYear();
    // 생애 갈림길(성향·관심 분야), 없으면 가끔 작은 갈림길. 그 밖에 작은 사건이 거의 해마다 하나, 가끔 둘.
    if (!this.pending && this.age >= 7) this.pathChoice();
    if (!this.pending && this.age >= 7 && this.r.chance(0.12)) this.randomDilemma();
    if (!this.pending && this.r.chance(0.85)) this.randomEvent();
    if (!this.pending && this.r.chance(0.3)) this.randomEvent();
    this.economy();
    this.drift();
    return this.finishYear();
  }

  choose(index: number): YearResult {
    if (!this.pending) throw new Error('고를 선택지가 없습니다');
    const opt = this.pending.options[index];
    this.choiceLog.push({ age: this.age, year: this.year, prompt: this.pending.prompt, label: opt.label, kind: this.pending.kind, auto: this.autoPicking });
    this.autoPicking = false;
    this.pending = null;
    this.current = { entries: [] };
    this.log(`→ ${opt.label}`, 'pick');
    opt.run();
    return this.finishYear(true);
  }

  /** 자동 선택: 각 선택지의 auto 가중치대로 고른다 */
  autoChoiceIndex(): number {
    if (!this.pending) return -1;
    this.autoPicking = true;
    const opts = this.pending.options.map((o, i) => [i, o.auto ?? 1] as [number, number]);
    return this.r.weighted(opts)[0];
  }

  private finishYear(isChoiceResult = false): YearResult {
    const res: YearResult = {
      age: this.age,
      year: this.year,
      entries: this.current.entries,
      choice: this.pending
        ? { prompt: this.pending.prompt, options: this.pending.options.map((o) => ({ label: o.label, desc: o.desc ?? '' })) }
        : null,
      dead: !this.alive,
      isChoiceResult,
      snapshot: this.snapshot(),
    };
    this.history.push(res);
    return res;
  }

  snapshot(): Snapshot {
    const sp = this.spouse;
    const w = this.wage;
    const spouseIncome = this.married && sp?.alive && this.spouseAge() < 60 ? sp.incomeBase * w : 0;
    const pension = this.age >= 65 && this.alive ? (this.pensionBase * Math.max(1, w) + (this.quintile <= 3 ? basicPension(this.year) : 0)) * 12 : 0;
    return {
      name: this.name, age: this.age, year: this.year, birthYear: this.birthYear, sex: this.sex,
      region: this.region.name, residence: this.residence.name,
      stats: { ...this.stats },
      netWorth: this.independent ? Math.round(this.netWorth) : null,
      familyLabel: this.quintileInfo.label,
      job: this.job ? this.job.title : null,
      edu: this.edu ? D.eduTiers[this.edu].label : null,
      married: this.married, children: this.children.length, house: !!this.house,
      family: {
        parentsAlive: !this.flags.parentsGone,
        spouse: sp
          ? {
              name: sp.name, age: this.spouseAge(), status: this.married ? 'married' : sp.alive ? 'divorced' : 'widowed', works: spouseIncome > 0,
              edu: eduName(sp.edu), job: sp.incomeBase > 0 && this.spouseAge() >= 60 ? '은퇴' : sp.job,
            }
          : null,
        children: this.children.map((c) => ({ name: c.name, sex: c.sex, age: this.age - c.bornAge })),
        grandchild: !!this.flags.grandchild,
      },
      assets: this.independent
        ? {
            netWorth: Math.round(this.netWorth),
            cash: Math.round(this.cash),
            ...this.holdings(),
            house: this.house ? { price: Math.round(this.housePrice), debt: Math.round(this.house.debt) } : null,
            income: {
              self: Math.round(this.job && this.job.type !== 'none' ? this.job.base * w : 0),
              spouse: Math.round(spouseIncome),
              pension: Math.round(pension),
            },
          }
        : null,
      traits: { ...this.traits },
      interest: this.interestLabel(),
      major: this.major,
      plan: { spend: this.plan.spend, alloc: { ...this.plan.alloc } },
      investOpen: { stock: this.year >= INVEST_FROM.stock, global: this.year >= INVEST_FROM.global, crypto: this.year >= INVEST_FROM.crypto },
      lastReturn: { ...this.lastReturn },
    };
  }

  /** 지금 들고 있는 예금과 투자. 그해 중간에 돈을 써서 투자보다 쓸 돈이 적어졌으면 투자를 줄여 보여 준다 */
  private holdings(): { deposit: number; invest: Record<InvestKind, number> } {
    const total = this.invest.stock + this.invest.global + this.invest.crypto;
    const room = Math.max(0, this.cash);
    const k = total > room ? room / total : 1;
    const invest = { stock: Math.round(this.invest.stock * k), global: Math.round(this.invest.global * k), crypto: Math.round(this.invest.crypto * k) };
    return { deposit: Math.round(this.cash - invest.stock - invest.global - invest.crypto), invest };
  }

  private interestLabel(): string | null {
    const k = this.mainInterest();
    return k ? INTERESTS[k] : null;
  }

  // ───────── 사망 ─────────
  private checkDeath(): boolean {
    const qm = QM[this.quintile - 1];
    // 건강 수치가 평균(약 61~65)보다 낮을수록 위험률이 커진다
    const hm = clamp(1 + (61 - this.stats.health) / 80, 0.7, 1.7);
    if (this.r.chance(hazard(this.sex, this.age, this.year, qm * hm))) {
      this.die();
      return true;
    }
    return false;
  }

  private die() {
    this.alive = false;
    this.pending = null;
    let cause: string;
    if (this.flags.cancerAge !== undefined && this.age - this.flags.cancerAge <= 10 && this.r.chance(0.75)) cause = '암';
    else {
      const band = D.deathCauses.find((b) => this.age <= b.maxAge) ?? D.deathCauses[D.deathCauses.length - 1];
      cause = this.r.weighted(band.causes)[0];
      // 옛날 아이들은 감염병으로 많이 숨졌다
      if (this.age > 0 && this.age < 15 && this.year < 1985 && this.r.chance(0.5)) cause = this.r.pick(['폐렴', '홍역', '장염', '결핵']);
    }
    this.deathCause = cause;
    this.log(
      this.age === 0 ? `돌을 넘기지 못했다. ${josa(cause, '으로/로')} 세상을 떠났다.` : `${this.age}세, ${josa(cause, '으로/로')} 생을 마감했다.`,
      'death',
    );
  }

  // ───────── 정해진 시기의 사건 ─────────
  private milestones() {
    const a = this.age;
    const male = this.sex === 'M';
    const f = this.flags;
    if (a === 1) this.log('첫걸음을 뗐다.', 'milestone');
    if (a === 3 && this.year >= 1990) this.log('어린이집에 다니기 시작했다.', 'milestone');
    if (a === 5 && this.year < 1990 && this.quintile >= 4) this.log('유치원에 다녔다.', 'milestone');
    if (a === 7) {
      this.log(`${elementaryName(this.year)}에 입학했다.`, 'milestone');
      this.log(`장래희망은 ${josa(this.dream, '이었다/였다')}.`);
    }
    if (a === 10) this.askTutoring();
    if (a === 13) this.enterMiddleSchool();
    if (a === 16 && this.edu === null) this.enterHighSchool();
    if (a >= 16 && a <= 18 && f.allIn) this.apply({ ability: 3, happiness: -2 });
    if (a >= 11 && a <= 17 && f.tutoring) this.apply({ ability: this.quintile <= 2 ? 0.5 : 1 });
    if (a === 18 && this.edu === null) this.suneung();
    if (a === 19 && f.retake) this.suneungRetake();
    if (f.collegeStart === a && this.edu) {
      this.log(`대학에 입학했다. (${eduName(this.edu)})`, 'milestone');
      if ((this.edu === 'capital4' || this.edu === 'top4') && this.residence.group !== 'capital' && this.r.chance(0.65)) {
        this.residence = { name: '서울', group: 'capital', seoul: true };
        this.log('대학 때문에 서울로 올라왔다. 하숙집에서 첫 객지 생활을 시작했다.'.replace('하숙집', this.year >= 2000 ? '고시원' : '하숙집'));
        f.movedSeoul = true;
      }
    }
    if (male && a === (f.militaryStart ?? (f.retake ? 21 : 20)) && !f.militaryDone) this.military();
    if (male && !f.militaryDone && f.militaryEnd === a) {
      this.log('전역했다.', 'milestone');
      f.militaryDone = true;
      // 일하다 입대한 사람은 전역 후 다시 일자리를 찾는다
      if (!this.job && this.edu && (this.edu === 'elementary' || this.edu === 'middle') && f.jobSearchAge === undefined) f.jobSearchAge = a;
    }
    if (f.gradAge === a && this.edu) this.log(`${eduName(this.edu)}을 졸업했다.`, 'milestone');
    if (f.jobSearchAge === a) {
      f.jobSearchAge = undefined;
      this.jobSearch();
    }
    if (a === 35 && !f.exerciseAsked && !this.pending) this.askExercise();
    if (a === 45 && !this.pending) this.askCheckup();
    if (a === 65) this.startPension();
  }

  private askTutoring() {
    const poor = this.quintile <= 2;
    const y = this.year;
    const banned = tutoringBanned(y);
    const eraWeight = y < 1980 ? 0.35 : banned ? 0.25 : 1;
    const label = y < 1980 ? '과외 선생님을 붙인다' : banned ? '몰래 과외를 받는다' : '학원을 여러 곳 다닌다';
    const desc = banned ? '과외는 불법이었다' : poor ? '형편이 빠듯해 한두 곳이 한계다' : y < 1980 ? '집으로 대학생 선생님이 온다' : '영어, 수학, 논술까지';
    this.ask(banned ? '공부를 어떻게 할까?' : '학원을 어떻게 할까?', [
      {
        label, desc,
        auto: (poor ? 2 : 4) * eraWeight * (banned && this.quintile < 4 ? 0.3 : 1),
        run: () => {
          this.flags.tutoring = true;
          this.apply({ ability: poor ? 2 : 4, happiness: -5, relation: -1 });
          if (banned) this.log('밤마다 커튼을 치고 몰래 과외를 받았다.');
          else if (y < 1980) this.log('일주일에 두 번, 대학생 선생님이 집으로 왔다.');
          else this.log(poor ? '부모님이 무리해서 학원 두 곳을 보내 주셨다.' : '방과 후엔 학원 버스를 타고 다녔다.');
          this.fact('tutoring');
        },
      },
      {
        label: '실컷 놀며 자란다', desc: '골목과 친구들', auto: 1,
        run: () => {
          this.apply({ happiness: 6, relation: 5, health: 2 });
          this.log('해가 질 때까지 친구들과 뛰어놀았다.');
          this.fact('tutoring');
        },
      },
    ]);
  }

  /** 중학교 진학. 형편이 어려울수록 진학하지 못할 가능성이 크다 */
  private enterMiddleSchool() {
    const gap = this.sex === 'F' ? at(FEMALE_SCHOOL_GAP, this.year) : 1;
    const rate = at(MIDDLE_SCHOOL_RATE, this.year) * gap;
    const miss = (1 - rate) * [1.8, 1.3, 1.0, 0.6, 0.3][this.quintile - 1];
    if (this.r.chance(miss)) {
      this.edu = 'elementary';
      this.log('형편이 어려워 중학교에 가지 못했다.', 'bad');
      this.log(this.sex === 'F' ? '동생들을 돌보며 집안일을 도왔다.' : '집안일과 농사일을 거들었다.');
      this.fact('middleSchool');
      this.flags.jobSearchAge = 15;
      this.apply({ happiness: -6 });
      return;
    }
    this.log('중학교에 입학했다.', 'milestone');
  }

  private enterHighSchool() {
    const gap = this.sex === 'F' ? at(FEMALE_SCHOOL_GAP, this.year) : 1;
    const rate = at(HIGH_SCHOOL_RATE, this.year) * gap;
    const miss = (1 - rate) * [1.8, 1.3, 1.0, 0.6, 0.3][this.quintile - 1];
    if (this.r.chance(miss)) {
      this.edu = 'middle';
      this.log('중학교를 마치고 고등학교 대신 일터로 나갔다.', 'milestone');
      this.fact('highSchool');
      this.flags.jobSearchAge = 16;
      return;
    }
    this.askHighSchool();
  }

  private askHighSchool() {
    const voc = vocationalSchoolName(this.year);
    this.ask('고등학교 3년을 어떻게 보낼까?', [
      {
        label: '입시에 모든 걸 건다', desc: '성적은 오르지만 지친다', auto: 3,
        run: () => { this.flags.allIn = true; this.apply({ health: -3, happiness: -4 }); this.log('인문계 고등학교에 입학했다. 목표는 오직 대학이었다.'.replace('인문계', this.year >= 2000 ? '일반' : '인문계'), 'milestone'); },
      },
      {
        label: '공부와 생활의 균형을 찾는다', desc: '무리하지 않는다', auto: 5,
        run: () => { this.apply({ ability: 3, happiness: 2 }); this.log(`${this.year >= 2000 ? '일반고' : '인문계 고등학교'}에 입학했다.`, 'milestone'); },
      },
      {
        label: `${voc}에서 기술을 배운다`, desc: '졸업 후 바로 취업을 노린다', auto: this.year < 2000 ? 3 : 1.5,
        run: () => { this.flags.vocational = true; this.apply({ happiness: 3 }); this.log(`${voc}에 입학해 기술을 배우기 시작했다.`, 'milestone'); },
      },
    ]);
  }

  // 시험 점수(대략 평균 56, 표준편차 18)와 상위 몇 %인지
  private examScore(): number {
    const qBonus = [-6, -3, 0, 3, 7][this.quintile - 1];
    return this.stats.ability + this.r.normal(0, 10) + qBonus + (this.flags.vocational ? -8 : 0);
  }
  private topShare(score: number): number {
    return 1 - normCdf((score - 56) / 18); // 같은 해 태어난 아이들 중 나보다 점수가 높은 비율
  }
  /** 입학 연도의 대학진학률에 맞춰 갈 수 있는 학교를 정한다. null 이면 정원 밖 */
  private tierFor(score: number, entryYear: number): EduTier | null {
    // 진학률은 '고졸자 중' 비율이므로, 같은 해 태어난 전체 아이 기준으로 바꾼다 (고교 진학률이 낮던 시절 보정)
    const hs = at(MIDDLE_SCHOOL_RATE, this.birthYear + 13) * at(HIGH_SCHOOL_RATE, this.birthYear + 16);
    const R = Math.min(0.97, at(COLLEGE_RATE, entryYear) * hs * 1.12); // 1.12: 붙고도 안 가는 사람·재수 보정
    const top = this.topShare(score);
    const topCut = Math.min(0.05, R * 0.3);
    if (top < topCut) return 'top4';
    if (top < topCut + 0.29 * R) return 'capital4';
    if (top < topCut + 0.65 * R) return 'local4';
    if (top < R) return 'college2';
    return null;
  }

  private suneung() {
    const score = this.examScore();
    this.flags.score = score;
    const exam = examName(this.year);
    if (this.flags.vocational) {
      this.log(`${vocationalSchoolName(this.year)} 3학년, 현장실습을 나갔다.`);
      const canCollege = this.tierFor(score + 8, this.year + 1) !== null;
      this.ask('졸업 후 진로를 정해야 한다.', [
        { label: '바로 취업한다', desc: '고졸 채용에 지원한다', auto: 6, run: () => this.skipCollege() },
        ...(canCollege ? [{ label: '전문대에 진학한다', desc: '2년 더 배운다', auto: 3, run: () => this.enterCollege('college2', 19) }] : []),
      ]);
      return;
    }
    const tier = this.tierFor(score, this.year + 1);
    this.log(`${josa(exam, '을/를')} 봤다. 성적은 상위 ${Math.max(1, Math.round(this.topShare(score) * 100))}% 정도였다.`, 'milestone');
    this.fact('college');
    const opts: Option[] = [];
    if (tier) opts.push({ label: '점수에 맞춰 진학한다', desc: eduName(tier), auto: tier === 'college2' ? 6 : 9, run: () => this.enterCollege(tier, 19) });
    if (tier !== 'top4') {
      opts.push({
        label: '재수한다', desc: '1년 더 공부해서 다시 본다', auto: tier ? 1.2 : 0.8,
        run: () => { this.flags.retake = true; this.apply({ happiness: -6 }); this.log(this.year >= 1990 ? '재수학원에 등록했다.' : '재수를 하며 독서실을 다녔다.'); },
      });
    }
    opts.push({ label: '대학 대신 일을 시작한다', desc: tier ? '고졸로 사회에 나간다' : '이번엔 붙을 곳이 없었다', auto: tier ? 0.6 : 5, run: () => this.skipCollege() });
    this.ask(tier ? '어떻게 할까?' : '원하는 대학에 붙지 못했다.', opts);
  }

  private suneungRetake() {
    const score = (this.flags.score ?? 50) + this.r.normal(3, 6);
    this.log(`두 번째 ${josa(examName(this.year), '을/를')} 봤다. 성적은 상위 ${Math.max(1, Math.round(this.topShare(score) * 100))}% 정도였다.`, 'milestone');
    const tier = this.tierFor(score, this.year + 1);
    if (tier) this.enterCollege(tier, 20);
    else {
      this.log('이번에도 대학 문턱을 넘지 못했다.', 'bad');
      this.skipCollege();
    }
  }

  private serviceYears(enlistYear: number) {
    return Math.ceil(militaryMonths(enlistYear) / 12);
  }

  private enterCollege(tier: EduTier, startAge: number) {
    this.edu = tier;
    this.flags.collegeStart = startAge;
    const extra = this.sex === 'M' ? this.serviceYears(this.birthYear + (this.flags.retake ? 21 : 20)) : 0;
    this.flags.gradAge = startAge + D.eduTiers[tier].years + extra;
    this.flags.jobSearchAge = this.flags.gradAge;
  }

  private skipCollege() {
    this.edu = 'highschool';
    this.flags.gradAge = undefined;
    this.log('고등학교를 졸업하고 사회에 나왔다.', 'milestone');
    if (this.sex === 'M') {
      const enlist = this.flags.retake ? 21 : 20;
      this.flags.jobSearchAge = enlist + this.serviceYears(this.birthYear + enlist);
      this.log('입대 전까지 아르바이트로 돈을 모으기로 했다.');
    } else {
      this.flags.jobSearchAge = this.age + 1;
    }
  }

  private military() {
    const roll = this.r.rand();
    const y = this.year;
    const altRate = y < 1993 ? 0.25 : D.military.alternativeRate;
    if (roll < D.military.exemptRate || this.stats.health < 35) {
      this.log('병역 판정 검사에서 면제 판정을 받았다.');
      this.flags.militaryDone = true;
      return;
    }
    // 일하다 입대하면 일을 쉰다
    if (this.job && this.job.type !== 'none' && (this.edu === 'elementary' || this.edu === 'middle')) {
      this.log('일을 그만두고 입대했다.');
      this.job = null;
    }
    const months = militaryMonths(y);
    if (roll < D.military.exemptRate + altRate) {
      this.log(`보충역 판정을 받아 ${josa(alternativeServiceName(y), '으로/로')} 복무를 시작했다.`, 'milestone');
    } else {
      this.log(`현역으로 입대했다. ${this.r.pick(MILITARY_BASES)}의 부대에서 ${months}개월을 보내야 한다.`, 'milestone');
      this.apply({ health: 2, happiness: -4, relation: 2 });
    }
    this.fact('military');
    this.flags.militaryEnd = this.age + Math.ceil(months / 12);
    // 일찍 일을 시작한 사람은 전역 뒤에 다시 구직
    if (this.edu === 'elementary' || this.edu === 'middle') this.flags.jobSearchAge = undefined;
  }

  private becomeIndependent() {
    if (this.independent) return;
    this.independent = true;
    const help = [0, 300, 1000, 2000, 5000][this.quintile - 1] * this.wage;
    this.cash = help * (0.5 + this.r.rand());
  }

  // ───────── 취업 ─────────
  private jobSearch() {
    const early = this.edu === 'elementary' || this.edu === 'middle';
    if (!early) this.becomeIndependent();
    this.fact(this.year < 1990 ? 'farm' : 'jobMarket');
    if (early) return this.assignJob(false);
    this.ask('취업 준비를 어떻게 할까?', [
      { label: '눈높이를 맞춰 바로 취업한다', desc: '지금 갈 수 있는 곳으로', auto: 7, run: () => this.assignJob(false) },
      {
        label: '1년 더 준비한다', desc: '공무원 시험이나 대기업 공채', auto: this.year < 1995 ? 1.5 : 3,
        run: () => {
          this.apply({ happiness: -4 });
          this.log(this.r.pick(this.year >= 1995
            ? ['노량진 학원가에서 1년을 보냈다.', '스터디 카페를 집처럼 드나들며 공채를 준비했다.', '자기소개서만 쉰 번 넘게 썼다.']
            : ['도서관에서 시험공부로 1년을 보냈다.', '고시원에 틀어박혀 공채를 준비했다.']));
          this.flags.prepareUntil = this.age + 1;
          this.job = { type: 'none', title: '취업 준비생', base: 0, since: this.age, main: false };
        },
      },
    ]);
  }

  private jobWeights(prepared: boolean): [JobType, number][] {
    type W = Record<'large' | 'public' | 'sme' | 'contract' | 'professional' | 'farm' | 'none', number>;
    const table: Record<EduTier, W> = {
      elementary: { large: 0.01, public: 0.0, sme: 0.42, contract: 0.35, professional: 0, farm: 0.25, none: 0.1 },
      middle: { large: 0.02, public: 0.01, sme: 0.45, contract: 0.38, professional: 0, farm: 0.15, none: 0.08 },
      highschool: { large: 0.04, public: 0.03, sme: 0.4, contract: 0.45, professional: 0, farm: 0.05, none: 0.08 },
      college2: { large: 0.06, public: 0.05, sme: 0.45, contract: 0.38, professional: 0, farm: 0.01, none: 0.06 },
      local4: { large: 0.1, public: 0.12, sme: 0.42, contract: 0.3, professional: 0.01, farm: 0.005, none: 0.05 },
      capital4: { large: 0.22, public: 0.14, sme: 0.36, contract: 0.22, professional: 0.02, farm: 0, none: 0.04 },
      top4: { large: 0.42, public: 0.14, sme: 0.15, contract: 0.1, professional: 0.16, farm: 0, none: 0.03 },
    };
    const w = { ...table[this.edu ?? 'highschool'] };
    const af = (this.stats.ability - 50) / 50;
    w.large *= 1 + af * 1.2;
    w.professional *= this.stats.ability > 70 ? 1 + af : 0.2;
    w.public *= 1 + af * 0.6;
    w.contract *= Math.max(0.2, 1 - af * 0.5);
    if (this.flags.vocational) { w.sme += 0.1; w.public += 0.03; w.contract -= 0.08; }
    if (prepared) { w.large *= 1.5; w.public *= 2.2; w.contract *= 0.6; w.none *= 0.7; }
    // 시대: 농업 비중, 외환위기 전에는 비정규직이 드물었다, 그해 실업률
    const regionFarm = this.residence.group === 'province' ? 1.6 : this.residence.group === 'metro' ? 0.4 : 0.25;
    w.farm *= (at(FARM_SHARE, this.year) / 0.052) * regionFarm;
    if (this.year < 1998) { w.sme += w.contract * 0.4; w.contract *= 0.6; }
    w.none *= this.jobMarket;
    return (Object.entries(w) as [JobType, number][]).map(([k, v]) => [k, Math.max(0, v)]);
  }

  private assignJob(prepared: boolean) {
    const [type] = this.r.weighted(this.jobWeights(prepared));
    if (type === 'none') {
      this.log(this.year >= 1998 && this.year <= 1999 ? '외환위기로 채용 문이 닫혔다. 어디에도 붙지 못했다.' : '이번에도 최종 합격 소식은 오지 않았다.', 'bad');
      this.job = { type: 'none', title: '구직 중', base: 0, since: this.age, main: false };
      this.apply({ happiness: -5 });
      return;
    }
    this.startJob(type, true);
  }

  private startJob(type: Exclude<JobType, 'none'>, main: boolean, titleList?: Dated[]) {
    const J = D.jobs[type];
    let options = this.titles(titleList ?? JOB_TITLES[type]);
    // 관심 분야에 맞는 직업 이름이 있으면 그쪽으로 (직업 종류는 그대로)
    const k = titleList ? null : this.mainInterest();
    const fav = k ? INTEREST_TITLES[k][type] : undefined;
    if (fav && this.r.chance(0.65)) {
      const degree = EDU_ORDER.indexOf(this.edu ?? 'highschool') >= EDU_ORDER.indexOf('local4');
      const fit = this.titles(fav).filter((t) => degree || !NEEDS_DEGREE.test(t));
      if (fit.length) options = fit;
    }
    const title = this.r.pick(options.length ? options : this.titles(JOB_TITLES.sme));
    const af = 1 + (this.stats.ability - 50) / 250;
    const eduPay = this.edu === 'elementary' ? 0.8 : this.edu === 'middle' ? 0.88 : 1;
    const base = J.startSalary * (0.85 + 0.3 * this.r.rand()) * af * eduPay;
    this.job = { type, title, base, since: this.age, main };
    this.lastWork = title;
    if (type === 'self') this.log(`${josa(title, '이/가')} 됐다.`, 'milestone');
    else if (type === 'farm') this.log(`${josa(title, '으로/로')} 살기 시작했다.`, 'milestone');
    else {
      const where = type === 'public' ? '' : ` (${J.label})`;
      this.log(`${josa(title, '으로/로')} 일을 시작했다${where}. 첫해 연봉은 지금 돈으로 약 ${won(base * this.wage)}.`, 'milestone');
    }
    if (type === 'contract') this.fact('nonRegular');
    if (type === 'large' || type === 'sme') this.fact('largeVsSme');
  }

  private askExercise() {
    this.flags.exerciseAsked = true;
    this.ask('요즘 몸이 예전 같지 않다.', [
      { label: '운동을 꾸준히 한다', desc: '퇴근 후 한 시간', auto: 4, run: () => { this.apply({ health: 8, happiness: 2 }); this.flags.exercise = true; this.log('주 3회 운동이 습관이 됐다.', 'good'); } },
      { label: '바빠서 나중으로 미룬다', auto: 5, run: () => { this.apply({ health: -3 }); this.log('운동은 늘 다음 달 계획이었다.'); } },
    ]);
  }

  private askCheckup() {
    this.log('건강검진에서 혈압과 혈당이 높게 나왔다.', 'bad');
    this.ask('어떻게 할까?', [
      { label: '생활 습관을 바꾼다', desc: '술을 줄이고 식단을 관리한다', auto: 5, run: () => { this.apply({ health: 7, happiness: -2 }); this.log('술자리를 줄이고 매일 저녁 걸었다.', 'good'); } },
      { label: '그냥 지금처럼 산다', auto: 4, run: () => { this.apply({ health: -5 }); this.log('약만 받아 왔다.'); } },
    ]);
  }

  /** 65세: 연금. 국민연금은 1988년(자영업·농어민은 1995년)부터 가입한 해만큼 받는다 */
  private startPension() {
    const career = (Object.entries(this.careerYears) as [JobType, number][]).sort((a, b) => b[1] - a[1])[0];
    const full: Partial<Record<JobType, number>> = { public: 230, large: 110, professional: 120, sme: 65, contract: 45, self: 45, farm: 35 };
    let monthly = 0;
    if (career) {
      if (career[0] === 'public') monthly = full.public!;
      else monthly = (full[career[0]] ?? 45) * Math.min(1, this.pensionYears / 25);
    }
    this.pensionBase = monthly;
    const basic = this.quintile <= 3 && career?.[0] !== 'public' ? basicPension(this.year) : 0;
    const total = monthly + basic;
    if (total > 0) {
      this.log(`연금을 받기 시작했다. 한 달에 지금 돈으로 약 ${won(total)}.`, 'milestone');
      this.fact('pension');
    } else {
      this.log('받을 연금이 없었다. 노후는 스스로 꾸려야 했다.', 'bad');
    }
    if (total < 80 && this.netWorth < 30000) this.fact('elderPoverty');
  }

  // ───────── 매년 생길 수 있는 기회 ─────────
  private lifeOpportunities() {
    if (this.age < 18) return;
    if (!this.married && this.age <= 58 && this.marriageChance()) return this.askMarriage();
    if (this.married && this.childOpportunity()) return;
    this.houseOpportunity();
  }

  /**
   * 결혼 기회: 그해 평균 초혼 연령(μ)과 퍼짐(σ), 평생 혼인 비율로 만든 분포에서
   * '아직 미혼인 사람이 올해 결혼할 확률'을 구한 뒤, 직업·관계·이전 거절 등을 반영한다.
   */
  private marriageChance(): boolean {
    const s = this.sex;
    const y = this.year;
    const mu = at(FIRST_MARRIAGE_AGE[s], y) - 0.6; // 평균보다 중앙값이 조금 이르다
    const sd = at(MARRIAGE_SD, y);
    const ever = at(EVER_MARRIED[s], y);
    const F = (x: number) => ever * normCdf((x - mu) / sd);
    let p = (F(this.age + 1) - F(this.age)) / Math.max(0.02, 1 - F(this.age));
    p /= 0.82; // 결혼 제안을 거절하는 사람 보정
    const t: JobType = this.job ? this.job.type : 'none';
    const jobMod: Record<JobType, number> = s === 'M'
      ? { large: 1.3, public: 1.35, professional: 1.4, sme: 1.0, self: 0.9, farm: 0.9, contract: 0.7, none: 0.45 }
      : { large: 1.05, public: 1.1, professional: 1.05, sme: 1.0, self: 0.95, farm: 1.0, contract: 0.9, none: 0.9 };
    p *= this.flags.homemaker ? 1 : jobMod[t];
    p *= 1 + (this.stats.relation - 55) / 120;
    if (this.flags.divorced || this.flags.widowed) p = 0.04;
    p *= Math.pow(0.8, this.flags.declinedMarriage ?? 0);
    if (s === 'M' && this.flags.militaryEnd !== undefined && !this.flags.militaryDone) p = 0;
    return this.r.chance(Math.min(0.9, p));
  }

  private askMarriage() {
    const r = this.r;
    const spouseSex: Sex = this.sex === 'M' ? 'F' : 'M';
    const diff = Math.round(r.normal(this.year < 1995 ? 3.2 : 2.4, 2));
    const spouseAge = this.sex === 'M' ? this.age - diff : this.age + diff;
    const spouseName = r.weighted(D.surnames)[0] + r.pick(namesFor(spouseSex, this.year - spouseAge));
    const places = this.titles(MEETING_PLACES).filter((m) => !(m === '회사에서' && (!this.job || ['none', 'farm', 'self'].includes(this.job.type))) && !(m === '대학 동기 모임에서' && !['college2', 'local4', 'capital4', 'top4'].includes(this.edu ?? '')));
    const place = r.pick(places);
    const sp = this.spouseProfile(spouseSex, place === '대학 동기 모임에서');
    const gap = spouseAge - this.age;
    const rel = gap === 0 ? '동갑인' : `나보다 ${Math.abs(gap) <= 10 ? NATIVE_NUM[Math.abs(gap)] : Math.abs(gap)} 살 ${gap > 0 ? '많은' : '어린'}`;
    const intro = sp.incomeBase > 0
      ? `${rel} ${spouseAge}세, ${EDU_PHRASE[sp.edu]} ${josa(sp.job, '이었다/였다')}`
      : `${rel} ${spouseAge}세, ${EDU_PHRASE[sp.edu]} 사람이었다. 결혼하면 살림을 맡기로 했다`;
    const pay = sp.incomeBase > 0 ? ` · 연 ${won(Math.round((sp.incomeBase * this.wage) / 100) * 100)}` : '';
    this.log(`${place} 만난 ${josa(spouseName, '과/와')} 진지한 사이가 됐다. ${intro}.`, 'good');
    this.ask('결혼 이야기가 나왔다.', [
      {
        label: '결혼한다', desc: `${spouseName} · ${spouseAge}세 · ${eduName(sp.edu)} · ${sp.job}${pay}`, auto: 8.5,
        run: () => {
          this.married = true;
          this.spouse = { name: spouseName, sex: spouseSex, age0: spouseAge - this.age, alive: true, ...sp };
          const help = this.flags.parentHelpUsed ? 0 : [0, 1000, 3000, 6000, 20000][this.quintile - 1] * (0.5 + r.rand()) * this.wage;
          this.flags.parentHelpUsed = true;
          this.cash += help;
          this.independent = true;
          this.apply({ happiness: 10, relation: 4 });
          this.log(`${josa(spouseName, '과/와')} 결혼했다.` + (help > 500 ? ` 부모님이 지금 돈으로 ${won(help)}을 보태 주셨다.` : ''), 'milestone');
          this.fact('marriage');
          this.maybeCareerBreak('결혼과 함께 직장을 그만뒀다.', 1);
        },
      },
      {
        label: '아직은 아니다', desc: '혼자인 삶도 괜찮다', auto: this.year < 1995 ? 0.8 : 1.5,
        run: () => {
          this.flags.declinedMarriage = (this.flags.declinedMarriage ?? 0) + 1;
          this.apply({ happiness: -2 });
          this.log(`${spouseName}${particle(spouseName, '과/와')}는 결국 각자의 길을 가기로 했다.`);
        },
      },
    ]);
  }

  /**
   * 배우자의 학력·직업·연봉을 대략 정한다.
   * 학력은 나와 비슷한 쪽으로(동질혼 경향), 1995년 이전에는 남편 쪽 학력이 조금 높은 경향을 둔다. (추정)
   */
  private spouseProfile(spouseSex: Sex, college: boolean): { edu: EduTier; job: string; incomeBase: number } {
    const r = this.r;
    const mine = EDU_ORDER.indexOf(this.edu ?? 'highschool');
    const tilt = this.year < 1995 ? (spouseSex === 'M' ? 0.5 : -0.5) : 0;
    // 대학 동기 모임에서 만났으면 배우자도 대학을 나왔다
    const lo = college ? EDU_ORDER.indexOf('college2') : 0;
    const edu = EDU_ORDER[Math.max(lo, Math.min(EDU_ORDER.length - 1, Math.round(mine + tilt + r.normal(0, 1))))];
    const works = r.chance(spouseSex === 'F' ? at(WIFE_WORKS, this.year) : 0.95);
    if (!works) return { edu, job: spouseSex === 'F' ? '전업주부' : '구직 중', incomeBase: 0 };
    const group = EDU_ORDER.indexOf(edu) <= 2 ? 'low' : EDU_ORDER.indexOf(edu) <= 4 ? 'mid' : 'high';
    const farmOk = this.year < 2000 && this.residence.group === 'province';
    const type = r.weighted(SPOUSE_JOBS[group].map(([t, w]) => [t, t === 'farm' && !farmOk ? 0 : w] as [Exclude<JobType, 'none'>, number]))[0];
    const titles = this.titles(JOB_TITLES[type]);
    const fit = EDU_ORDER.indexOf(edu) >= EDU_ORDER.indexOf('local4') ? titles : titles.filter((t) => !NEEDS_DEGREE.test(t));
    const job = r.pick(fit.length ? fit : titles);
    return { edu, job, incomeBase: (2600 + r.rand() * 2500) * SPOUSE_PAY[type] };
  }

  /** 여성의 결혼·출산 퇴직(경력단절). 시대에 따라 확률이 다르다 */
  private maybeCareerBreak(text: string, weight: number) {
    if (this.sex !== 'F' || !this.job || this.job.type === 'none' || this.job.type === 'farm' || this.job.type === 'self') return;
    const protectedJob = this.job.type === 'public' || this.job.type === 'professional';
    if (!this.r.chance(at(CAREER_BREAK, this.year) * weight * (protectedJob ? 0.3 : 1))) return;
    this.log(text, 'bad');
    this.job = { type: 'none', title: '전업주부', base: 0, since: this.age, main: false };
    this.flags.homemaker = true;
    this.fact('careerBreak');
  }

  private spouseAge(): number {
    return this.spouse ? this.age + this.spouse.age0 : 0;
  }

  private childOpportunity(): boolean {
    if (!this.spouse || !this.spouse.alive) return false;
    const motherAge = this.sex === 'F' ? this.age : this.spouseAge();
    const n = this.children.length;
    const maxKids = this.year < 1985 ? 4 : 3;
    if (motherAge > 42 || n >= maxKids) return false;
    if (n > 0 && this.age - this.children[n - 1].bornAge < 2) return false;
    const fert = at(MARITAL_FERTILITY, this.year);
    // 엄마 나이에 따라 임신·출산 가능성이 35세 무렵부터 빠르게 준다 (추정: 연령별 출산율 곡선의 모양).
    // 대신 결혼 초·첫째 뒤 몇 해 안의 확률을 높여, 평생 낳는 자녀 수는 그대로 두고 늦은 출산만 줄인다.
    const ageMod = motherAge <= 32 ? 1 : motherAge <= 34 ? AGE_FERTILITY[0] : motherAge <= 36 ? AGE_FERTILITY[1] : motherAge <= 38 ? AGE_FERTILITY[2] : motherAge <= 40 ? AGE_FERTILITY[3] : AGE_FERTILITY[4];
    const p = Math.min(0.75, CHILD_HAZARD[n] * fert * ageMod);
    if (!this.r.chance(p)) return false;
    const ord = ['첫째', '둘째', '셋째', '넷째'][n];
    const yes = [7.5, 5.5, 3.5, 3][n] * Math.max(1, fert);
    this.ask(n === 0 ? '아이를 가질까?' : `${ord} 아이를 가질까?`, [
      { label: '아이를 갖는다', desc: n === 0 ? '부모가 된다' : '가족이 늘어난다', auto: yes, run: () => this.haveChild() },
      {
        label: '지금은 아니다', desc: n === 0 ? '둘만의 삶을 산다' : '지금으로 충분하다', auto: [2.5, 4.5, 6.5, 7][n],
        run: () => { this.log(n === 0 ? '아직은 둘이서 지내기로 했다.' : '지금 가족으로 충분하다고 생각했다.'); this.fact('child'); },
      },
    ]);
    return true;
  }

  private haveChild() {
    if (!this.spouse) return;
    // 그해 출산순위별 출생성비. 1990년대 셋째·넷째는 여아 100명당 남아가 200명을 넘었다.
    const home = D.birthsByRegion.find((x) => x.name === this.residence.name)?.id;
    const order = this.children.length + 1;
    const sex: Sex = this.r.chance(maleShare(childSexRatio(this.year, order, home && isRegionId(home) ? home : undefined))) ? 'M' : 'F';
    const fatherSurname = this.sex === 'M' ? this.surname : this.spouse.name[0];
    const child: Child = { sex, name: fatherSurname + this.r.pick(namesFor(sex, this.year)), bornAge: this.age };
    this.children.push(child);
    const ord = ['첫째', '둘째', '셋째', '넷째'][this.children.length - 1];
    this.log(`${ord} ${sex === 'M' ? '아들' : '딸'} ${josa(child.name, '이/가')} 태어났다.`, 'milestone');
    this.apply({ happiness: 8, health: -2 });
    this.fact('child');
    if (this.children.length === 1) this.maybeCareerBreak('아이를 낳고 일을 그만뒀다.', 0.6);
  }

  private houseBasePrice(): number {
    if (this.residence.seoul) return D.housePrice.capitalSeoul;
    return D.housePrice[this.residence.group] ?? D.housePrice.province;
  }

  private houseOpportunity(): boolean {
    if (this.house || this.age < 28 || this.age > 68 || !this.independent) return false;
    if (!this.flags.retired && (!this.job || this.job.type === 'none') && !(this.married && this.spouse?.incomeBase)) return false;
    // 2000년 전 지방 집은 지금보다 훨씬 쌌다(시골집·단독주택 위주)
    const ruralOld = this.residence.group === 'province' && this.year < 2000 ? 0.5 : 1;
    const base = this.houseBasePrice() * (0.7 + this.r.rand() * 0.6) * ruralOld;
    const price = base * this.houseIndex();
    // 2000년 이전에는 주택담보대출이 드물어 목돈이 더 필요했다
    // 대신 전세를 끼고 사는 경우가 많았다
    const downShare = this.year < 2000 ? 0.4 : 1 - D.mortgageLTV;
    const help = !this.flags.parentHelpUsed && this.quintile >= 4 ? [0, 0, 0, 5000, 18000][this.quintile - 1] * this.wage : 0;
    if (this.cash + help < price * downShare || !this.r.chance(0.4)) return false;
    this.ask(`${this.residence.name}에 마음에 드는 집이 나왔다. (지금 돈으로 ${won(price)})`, [
      {
        label: '대출을 받아 집을 산다', desc: `대출 약 ${won(price * (1 - downShare))}`, auto: 7,
        run: () => {
          if (help) { this.cash += help; this.flags.parentHelpUsed = true; this.log(`부모님이 지금 돈으로 ${won(help)}을 보태 주셨다.`); }
          const down = Math.min(this.cash, price * Math.max(downShare, 0.5));
          this.cash -= down;
          const debt = price - down;
          this.house = { base, debt, loan: debt, boughtAge: this.age };
          this.apply({ happiness: 6 });
          this.log(debt > 0 ? `내 집을 마련했다. 대출은 ${won(debt)}.` : '내 집을 마련했다.', 'milestone');
          this.fact('house');
        },
      },
      { label: '아직은 전·월세로 산다', desc: '목돈은 그대로 둔다', auto: 3, run: () => { this.log('계약 기간이 끝날 때마다 이사할 집을 알아봤다.'); this.fact('house'); } },
    ]);
    return true;
  }

  // ───────── 일 ─────────
  private career() {
    const j = this.job;
    if (!j) return;
    const a = this.age;
    const f = this.flags;
    const u = this.jobMarket;
    if (j.type !== 'none') {
      this.careerYears[j.type] = (this.careerYears[j.type] ?? 0) + 1;
      const covered = j.type === 'self' || j.type === 'farm' ? this.year >= 1995 : this.year >= NATIONAL_PENSION_START;
      if (covered || j.type === 'public') this.pensionYears += 1;
    }

    if (j.type === 'none') {
      if (f.prepareUntil === a) { f.prepareUntil = undefined; this.assignJob(true); return; }
      if ((f.prepareUntil ?? 0) > a || f.retired) return;
      if (f.homemaker) {
        // 경력단절 뒤 재취업: 막내가 학교에 들어간 뒤
        const youngest = this.children.length ? a - this.children[this.children.length - 1].bornAge : 99;
        if (youngest >= 7 && a < 58 && this.r.chance(0.08)) {
          f.homemaker = false;
          this.log('아이들이 크고 나서 다시 일을 시작했다.', 'good');
          this.startJob(this.r.chance(0.6) ? 'contract' : 'sme', false, this.r.chance(0.5) ? JOB_TITLES.contract : undefined);
        }
        return;
      }
      if (a < 50 && this.r.chance(0.45 / Math.sqrt(u))) this.startJob(this.r.chance(0.4) ? 'sme' : 'contract', true);
      else if (a >= 50 && a < 68 && this.r.chance(0.25 / Math.sqrt(u))) this.startJob('contract', false, JOB_TITLES.late);
      else if (a < 50) this.apply({ happiness: -3 });
      return;
    }

    // 연봉(2024년 가치 기준): 50세까지 경력에 따라 오름
    const J = D.jobs[j.type];
    if (j.type === 'self') j.base = J.startSalary * (0.4 + this.r.rand() * 1.3) / Math.sqrt(u);
    else if (a < 50) j.base *= 1 + J.growth;

    // 이농: 1990년대 전에는 젊은 농부들이 도시 공장으로 떠났다
    if (j.type === 'farm' && a < 40 && this.year < 1995 && !f.leftFarm && this.r.chance(0.06)) {
      f.leftFarm = true;
      this.residence = this.r.chance(0.6) ? { name: '서울', group: 'capital', seoul: true } : { name: '경기', group: 'capital', seoul: false };
      this.log(`농사를 접고 ${this.residence.name}으로 올라왔다.`.replace('서울으로', '서울로'), 'milestone');
      this.startJob(this.r.chance(0.6) ? 'sme' : 'contract', true);
      return;
    }

    // 주된 일자리 퇴직
    if (j.main) {
      const retireNow =
        (j.type === 'public' && a >= 60) ||
        (j.type === 'professional' && a >= 63 && this.r.chance(0.15)) ||
        (j.type === 'farm' && a >= 70 && this.r.chance(0.2)) ||
        (['large', 'sme', 'contract'].includes(j.type) && a >= 49 && (this.r.chance(0.13 * Math.sqrt(u)) || a >= 60));
      if (retireNow) return this.mainRetire();
    } else if (a >= 65 && (this.r.chance(0.18) || a >= 75)) {
      this.log(`${j.title} 일을 그만두고 쉬기로 했다.`, 'milestone');
      this.job = { type: 'none', title: '은퇴', base: 0, main: false };
      f.retired = true;
      return;
    }

    // 직장에서 생기는 일 (해고 확률은 그해 실업률에 비례)
    const crisis = this.year >= 1997 && this.year <= 1999;
    if (j.type === 'contract' && j.main && this.r.chance(0.05)) {
      j.type = 'sme';
      j.base *= 1.1;
      this.log(this.year >= 1998 ? '계약직에서 정규직으로 전환됐다.' : '임시직에서 정식 직원이 됐다.', 'good');
      this.apply({ happiness: 5 });
    } else if (j.type === 'contract' && this.r.chance(0.07 * u)) {
      this.log(this.year >= 1998 ? '계약이 갱신되지 않았다.' : '일감이 끊겨 일을 잃었다.', 'bad');
      this.loseJob();
    } else if (j.type === 'sme' && this.r.chance(0.025 * u * (crisis ? 1.5 : 1))) {
      this.log(crisis ? '외환위기로 회사가 부도났다.' : '회사가 어려워져 권고사직을 받았다.', 'bad');
      this.loseJob();
    } else if (j.type === 'large' && this.r.chance((a >= 45 ? 0.05 : 0.012) * u * (crisis ? 2 : 1))) {
      this.log(crisis ? 'IMF 구조조정 명단에 이름이 올랐다.' : '구조조정 명단에 이름이 올랐다. 희망퇴직을 신청했다.', 'bad');
      this.cash += j.base * this.wage * 1.5;
      this.loseJob();
    } else if (j.type === 'self' && this.r.chance(0.12 * Math.sqrt(u))) {
      this.log('매출이 버티지 못해 가게를 접었다.', 'bad');
      this.cash -= 1500 * this.wage;
      this.loseJob();
    } else if (j.type === 'sme' && j.main && a < 40 && this.stats.ability > 62 && !this.pending && this.r.chance(0.05)) {
      this.ask('대기업에서 경력직 제안이 왔다.', [
        { label: '옮긴다', desc: '연봉은 오르지만 새로 시작이다', auto: 7, run: () => { this.startJob('large', true, [j.title]); this.apply({ happiness: 3 }); } },
        { label: '지금 회사에 남는다', desc: '익숙한 사람들과 함께', auto: 3, run: () => { this.log('남기로 했다. 팀장님이 밥을 샀다.'); this.apply({ relation: 3 }); } },
      ]);
    } else if (['large', 'sme', 'public'].includes(j.type) && a >= 30 && a <= 55 && this.r.chance(0.08)) {
      j.base *= 1.08;
      this.log(this.r.pick(['승진했다.', '진급 발표에 이름이 있었다.', '팀장이 됐다.']), 'good');
      this.apply({ happiness: 4, ability: 1 });
    }
    if (j.type === 'contract') this.apply({ happiness: -0.5 });
  }

  private loseJob() {
    const retire = this.age >= 63;
    this.job = { type: 'none', title: retire ? '은퇴' : '구직 중', base: 0, since: this.age, main: false };
    if (retire) this.flags.retired = true;
    this.apply({ happiness: retire ? -3 : -8 });
  }

  private mainRetire() {
    const j = this.job!;
    this.log(j.type === 'farm' ? '평생 지은 농사를 그만뒀다.' : `오래 다닌 직장을 떠났다. (${j.title})`, 'milestone');
    if (j.type !== 'farm') this.fact('retire');
    this.cash += j.base * this.wage * (j.type === 'large' || j.type === 'public' ? 1.2 : j.type === 'farm' ? 0 : 0.8); // 퇴직금
    this.job = { type: 'none', title: '은퇴', base: 0, main: false };
    if (this.age >= 63 || this.pending) {
      this.flags.retired = true;
      return;
    }
    const plan = this.flags.retirePlan;
    const k = this.mainInterest();
    const opts: Option[] = [];
    if (plan === 'work' && k) {
      opts.push({ label: '배워 둔 일을 한다', desc: `${INTERESTS[k]} 쪽 일`, auto: 6, run: () => this.startJob('contract', false, INTEREST_LATE_JOBS[k]) });
    }
    if (plan === 'farm' || this.interests.nature >= 8) {
      opts.push({
        label: '시골로 내려가 농사를 짓는다', desc: '귀농', auto: plan === 'farm' ? 6 : 1.5,
        run: () => {
          this.residence = { name: this.residence.group === 'province' ? this.residence.name : '충남', group: 'province', seoul: false };
          this.log('짐을 싸서 시골로 내려갔다.', 'milestone');
          this.startJob('farm', false, INTEREST_TITLES.nature.farm);
        },
      });
    }
    opts.push(
      { label: '다시 일자리를 구한다', desc: '경비, 운전, 돌봄 같은 일', auto: plan ? 2 : 5, run: () => this.startJob('contract', false, JOB_TITLES.late) },
      {
        label: '모은 돈으로 가게를 연다', desc: '창업 비용 약 7천만 원', auto: 2 * (1 + Math.max(0, this.traits.bold) / 50),
        run: () => { this.cash -= 7000 * this.wage; this.startJob('self', false); },
      },
      { label: '일을 그만두고 쉰다', auto: plan === 'save' ? 6 : 3, run: () => { this.flags.retired = true; this.apply({ happiness: 3 }); this.log('알람 없이 일어나는 아침이 낯설었다.'); } },
    );
    this.ask('이제 무엇을 할까?', opts);
  }

  // ───────── 가족과 건강 ─────────
  private familyYear() {
    const a = this.age;
    const r = this.r;
    const f = this.flags;
    if (this.married && this.spouse) {
      const sa = this.spouseAge();
      if (r.chance(hazard(this.spouse.sex, sa, this.year, 1))) {
        this.log(`배우자 ${josa(this.spouse.name, '이/가')} 세상을 떠났다. (${sa}세)`, 'bad');
        this.spouse.alive = false;
        this.married = false;
        f.widowed = true;
        this.apply({ happiness: -20, health: -5 });
      } else if (r.chance(D.marriage.annualDivorceRate * (this.year < 1995 ? 0.35 : 1) * (this.stats.happiness < 40 ? 2.5 : 1))) {
        this.log(`${josa(this.spouse.name, '과/와')} 이혼했다.`, 'bad');
        this.married = false;
        f.divorced = true;
        this.cash *= 0.6;
        this.apply({ happiness: -12 });
      }
    }
    if (!f.parentsGone && a >= 45 && (r.chance(this.year < 2000 ? 0.09 : 0.07) || a >= 72)) {
      f.parentsGone = true;
      const inherit = this.quintileInfo.wealth * 0.5 * (0.6 + r.rand() * 0.6) * this.wage;
      // 시골에 사는 맏이나 농사를 이어받은 자식은 집을 물려받곤 했다
      const takesHouse = !this.house && this.residence.group === 'province' && (this.job?.type === 'farm' || this.r.chance(0.3));
      if (takesHouse) {
        const base = this.houseBasePrice() * 0.5;
        this.house = { base, debt: 0, loan: 0, boughtAge: a };
        this.log('부모님이 돌아가셨다. 고향 집을 물려받았다.', 'bad');
      } else {
        this.log('부모님이 돌아가셨다.' + (inherit > 3000 ? ` 남기신 재산 중 지금 돈으로 ${won(inherit)}을 물려받았다.` : ''), 'bad');
        if (inherit > 3000) this.cash += inherit;
      }
      this.apply({ happiness: -10 });
    }
    if (this.children.length && !f.grandchild && a >= 50 && this.children[0].bornAge + 28 <= a && r.chance(0.12)) {
      f.grandchild = true;
      this.log('첫 손주가 태어났다.', 'good');
      this.apply({ happiness: 8 });
    }
    for (const c of this.children) {
      const ca = a - c.bornAge;
      const cy = this.year;
      if (ca === 7) this.log(`${josa(c.name, '이/가')} ${elementaryName(cy)}에 입학했다.`);
      if (ca === 19 && r.chance(at(COLLEGE_RATE, cy))) this.log(`${josa(c.name, '이/가')} 대학에 들어갔다.`);
      if (ca === Math.round(at(FIRST_MARRIAGE_AGE[c.sex], cy)) && r.chance(0.6)) this.log(`${josa(c.name, '이/가')} 결혼했다.`, 'good');
    }
    if (a >= 30 && f.cancerAge === undefined && r.chance(0.00085 * Math.exp(0.065 * (a - 30)))) {
      f.cancerAge = a;
      const kinds = CANCERS.filter((c) => !(c === '유방암' && this.sex === 'M') && !(c === '전립선암' && this.sex === 'F'));
      this.log(`${r.pick(kinds)} 진단을 받았다.`, 'bad');
      this.apply({ health: -22, happiness: -10 });
      this.cash -= 1200 * this.wage;
      this.fact('cancer');
    } else if (a >= 40 && r.chance(0.02)) {
      this.log(r.pick(['고혈압 진단을 받았다.', '당뇨 진단을 받았다.', '협심증으로 시술을 받았다.', '허리 수술을 받았다.']), 'bad');
      this.apply({ health: -6 });
    }
  }

  /** 사건이 지금 형편에 맞는지: 달력 연도(from/to), 나이(ages), 세대(born, 출생연도), 형편(when) */
  private eventFits(e: { ages?: [number, number]; from?: number; to?: number; born?: [number, number]; when?: (l: Life) => boolean }) {
    const y = this.year;
    return (e.from ?? -Infinity) <= y && y <= (e.to ?? Infinity)
      && (!e.ages || (e.ages[0] <= this.age && this.age <= e.ages[1]))
      && (!e.born || (e.born[0] <= this.birthYear && this.birthYear <= e.born[1]))
      && (!e.when || e.when(this));
  }

  private randomEvent() {
    let stage = stageOf(this.age);
    // 학교를 그만두고 일하는 10대에게는 학교 사건 대신 사회 초년생 사건
    if ((stage === 'middle' && this.edu === 'elementary') || (stage === 'high' && (this.edu === 'elementary' || this.edu === 'middle'))) stage = 'young';
    const candidates: RandomEvent[] = this.age >= 19 ? [...RANDOM_EVENTS[stage], ...LIFE_EVENTS] : RANDOM_EVENTS[stage];
    const pool = candidates.filter((e) => !this.usedEvents.has(e.text) && this.eventFits(e) && !(e.fx.cash && !this.independent));
    if (!pool.length) return;
    const e = this.r.pick(pool);
    this.usedEvents.add(e.text);
    const mood = (e.fx.happiness ?? 0) + (e.fx.health ?? 0);
    this.log(e.text, mood < -3 ? 'bad' : (e.fx.happiness ?? 0) > 3 ? 'good' : 'event');
    this.apply(scaleFx(e.fx, EVENT_STAT_SCALE));
  }

  /** 작은 갈림길: 고른 뒤 결과는 가중치대로 뽑는다. 같은 갈림길은 한 생에 한 번 */
  private randomDilemma() {
    const pool = DILEMMAS.filter((d: Dilemma) => !this.usedEvents.has(d.prompt) && this.eventFits(d)
      && !(d.options.some((o) => o.outcomes.some(([, , fx]) => fx.cash)) && !this.independent));
    if (!pool.length) return;
    const d = this.r.pick(pool);
    this.usedEvents.add(d.prompt);
    this.ask(d.prompt, d.options.map((o) => ({
      label: o.label, desc: o.desc, auto: o.auto,
      run: () => {
        const [, text, fx] = this.r.weighted(o.outcomes.map((x) => [x, x[0]] as [typeof x, number]))[0];
        const mood = (fx.happiness ?? 0) + (fx.health ?? 0) + (fx.cash ?? 0) / 500;
        this.log(text, mood <= -3 ? 'bad' : mood >= 4 ? 'good' : 'event');
        // 학창 시절 갈림길은 역량을 반만 반영한다 (진학률 보정)
        this.apply(this.age < 19 && fx.ability ? { ...fx, ability: fx.ability * 0.5 } : fx);
      },
    })), 'dilemma');
  }

  // ───────── 돈 (2024년 현재 가치, 만원) ─────────
  private economy() {
    if (!this.independent) {
      // 일찍 일을 시작한 사람은 스무 살쯤 독립한다
      if (this.age >= 20 && this.job && this.job.type !== 'none') this.becomeIndependent();
      else return;
    }
    const w = this.wage;
    let income = this.job && this.job.type !== 'none' ? this.job.base * w : 0;
    if (this.married && this.spouse?.alive && this.spouseAge() < 60) income += this.spouse.incomeBase * w;
    if (this.age >= 65) {
      const basic = this.quintile <= 3 ? basicPension(this.year) : 0;
      income += (this.pensionBase * Math.max(1, w) + basic) * 12; // 연금은 2024년 가치 기준, 이후 실질 소득 증가분 반영
    }
    // 세금·사회보험 약 12%, 소비는 가처분소득의 70% + 자녀·주거비 (가계동향조사 흑자율 약 30% 근사)
    // 최저 생활비는 그해 실질임금에 비례한다(외벌이가 흔하던 시절의 생활 수준)
    const disposable = income * (income > 2000 * w ? 0.88 : 1);
    let expenses = Math.max((this.married ? 1800 : 1200) * Math.max(0.3, w), disposable * SPEND_RATE[this.plan.spend]);
    // 아껴 쓰면 조금 답답하고, 넉넉히 쓰면 조금 즐겁다
    if (this.plan.spend === 'frugal') this.apply({ happiness: -0.6 });
    else if (this.plan.spend === 'loose') this.apply({ happiness: 0.6 });
    for (const c of this.children) if (this.age - c.bornAge < 25) expenses += 600 * w;
    if (!this.house && this.age >= 25) expenses += (this.residence.seoul ? 700 : 400) * w; // 월세·전세 이자
    if (this.age >= 65) expenses *= 0.85;
    let payment = 0;
    if (this.house && this.house.debt > 0) {
      const principal = Math.min(this.house.debt, this.house.loan / 30);
      payment = principal + this.house.debt * 0.04;
      this.house.debt -= principal;
    }
    const net = disposable - expenses - payment;
    this.cash += net >= 0 ? net : Math.max(net, -expenses * 0.5);
    this.grow(); // 예금 이자·투자 수익률 (2000년 전 예금 금리가 높았다)
    if (this.age >= 60 && !this.house && this.cash < -3000 * w) {
      this.cash = -3000 * w;
      if (!this.flags.welfare) {
        this.flags.welfare = true;
        this.log(this.year >= 2000 ? '기초생활보장 수급자가 됐다.' : '생활보호대상자가 됐다.', 'bad');
        this.fact('elderPoverty');
      }
    }
    // 빚이 집값의 절반을 넘으면 집을 팔아 정리한다
    if (this.house && this.cash < -0.5 * this.housePrice) {
      this.cash += this.housePrice - this.house.debt;
      this.house = null;
      this.log('빚을 감당하지 못해 집을 팔았다.', 'bad');
      this.apply({ happiness: -8 });
    }
    if (this.cash < -5000 * w && this.age - (this.flags.lastDebtCall ?? -99) >= 6 && this.r.chance(0.3)) {
      this.flags.lastDebtCall = this.age;
      this.log('빚 독촉 전화가 이어졌다.', 'bad');
      this.apply({ happiness: -4 });
    }
  }

  private drift() {
    const s = this.stats;
    s.happiness += (60 - s.happiness) * 0.12;
    s.health += (66 - s.health) * 0.06;
    if (this.flags.exercise) s.health = clamp(s.health + 0.5);
    if (this.job && this.job.type === 'none' && !this.flags.retired && !this.flags.homemaker && this.age >= 22) s.happiness = clamp(s.happiness - 2);
    s.relation += (55 - s.relation) * 0.03;
  }

  // ───────── 요약 ─────────
  summary(): Summary {
    const sexWord = this.sex === 'M' ? '남자아이' : '여자아이';
    const lines: string[] = [`${this.birthYear}년, ${this.region.name}의 ${this.quintileInfo.label} 집에서 ${sexWord}로 태어났다.`];
    if (this.age >= 7) {
      lines.push(this.lastWork ? `어릴 적 꿈은 ${this.dream}, 마지막 일은 ${this.lastWork}.` : `어릴 적 꿈은 ${josa(this.dream, '이었다/였다')}.`);
    }
    if (this.edu) lines.push(`최종 학력은 ${eduName(this.edu)}.`);
    if (this.spouse) {
      const kids = this.children.length ? `자녀 ${this.children.length}명을 두었다.` : '아이는 없었다.';
      lines.push(`${josa(this.spouse.name, '과/와')} 결혼해 ${kids}`);
    } else if (this.age >= 40) lines.push('평생 결혼하지 않았다.');
    if (this.age >= 30) lines.push(this.house ? '내 집에서 살았다.' : '끝내 집은 갖지 못했다.');
    lines.push(
      this.age === 0 ? `태어난 해에 ${josa(this.deathCause, '으로/로')} 세상을 떠났다.` : `${this.year}년, ${this.age}세에 ${josa(this.deathCause, '으로/로')} 세상을 떠났다.`,
    );
    const outlive = Math.round(cohortSurvival(this.birthYear, this.age) * 100);
    return {
      seed: this.seed,
      name: this.name,
      sex: this.sex,
      region: this.region.name,
      family: this.quintileInfo.label,
      age: this.age,
      cause: this.deathCause,
      birthYear: this.birthYear,
      deathYear: this.year,
      edu: this.edu ? D.eduTiers[this.edu].label : null,
      lastWork: this.lastWork,
      netWorth: this.independent ? Math.round(this.netWorth) : null,
      netWorthText: this.independent ? won(this.netWorth) : null,
      children: this.children.length,
      married: !!this.spouse,
      lines,
      outliveText: `${this.birthYear}년에 태어난 약 ${fmt(at(BIRTHS, this.birthYear) / 10000, 0)}만 명 중 ${outlive}%가 나보다 오래 산다.`,
      outlivePercent: outlive,
      traits: { ...this.traits },
      interest: this.interestLabel(),
      major: this.major,
      turningPoints: this.choiceLog.filter((c) => !c.auto).map(({ auto: _a, ...t }) => t),
    };
  }
}

export function createLife(opts: LifeOptions = {}): Life {
  return new Life(opts);
}

/** 시작 화면 미리보기용: 그해의 주요 통계 */
export function yearPreview(year: number) {
  return {
    births: at(BIRTHS, year),
    tfr: at(TFR, year),
    e0M: at(LIFE_EXPECTANCY.M, year),
    e0F: at(LIFE_EXPECTANCY.F, year),
    sexRatio: nationalSexRatio(year),
    college: at(COLLEGE_RATE, year + 19),
    estimated: year < 1970 || year > 2025,
  };
}
