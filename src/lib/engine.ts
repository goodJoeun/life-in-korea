/*
 * 5000만분의 1 — 시뮬레이션 엔진
 *
 * React 나 DOM 에 의존하지 않는다. 화면(src/components)과 검증 스크립트(scripts/simulate.ts)가 함께 쓴다.
 *
 *   const life = createLife(seed);
 *   let y = life.start();            // 출생 (0세)
 *   while (!y.dead) {
 *     y = y.choice ? life.choose(i)  // 선택지가 있으면 고른 결과
 *                  : life.next();    // 없으면 한 해 진행
 *   }
 *   life.summary();
 */
import { KDATA as D, FACTS, type EduTier, type JobType, type RegionGroup, type Sex } from './data';
import { CANCERS, DREAMS, JOB_TITLES, MEETING_PLACES, MILITARY_BASES, RANDOM_EVENTS, stageOf, type Effect, type StatKey } from './content';
import { Rng } from './random';
import { josa, particle, won } from './text';

export const START_YEAR = 2026;

// ───────────────────────── 타입 ─────────────────────────
export type EntryKind = 'event' | 'milestone' | 'fact' | 'good' | 'bad' | 'death' | 'choice' | 'pick';
export interface Entry { text: string; kind: EntryKind }
export interface ChoiceView { prompt: string; options: { label: string; desc: string }[] }
export interface Stats { health: number; happiness: number; ability: number; relation: number }
export interface Snapshot {
  name: string; age: number; year: number; sex: Sex;
  region: string; residence: string; stats: Stats;
  netWorth: number | null; familyLabel: string;
  job: string | null; edu: string | null;
  married: boolean; children: number; house: boolean;
}
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
}

interface Option { label: string; desc?: string; auto?: number; run: () => void }
interface Job { type: JobType; title: string; salary: number; since?: number; main: boolean }
interface Spouse { name: string; sex: Sex; age0: number; income: number; alive: boolean }
interface Child { sex: Sex; name: string; bornAge: number }
interface House { price: number; debt: number; loan: number; boughtAge: number }
interface Residence { name: string; group: RegionGroup; seoul: boolean }
interface Flags {
  tutoring?: boolean; allIn?: boolean; vocational?: boolean;
  score?: number; retake?: boolean; collegeStart?: number;
  gradAge?: number; jobSearchAge?: number; prepareUntil?: number;
  militaryEnd?: number; militaryDone?: boolean; movedSeoul?: boolean;
  exerciseAsked?: boolean; exercise?: boolean; retired?: boolean;
  declinedMarriage?: number; divorced?: boolean; widowed?: boolean;
  parentHelpUsed?: boolean; parentsGone?: boolean; grandchild?: boolean;
  cancerAge?: number; welfare?: boolean;
}

// ───────────────────────── 사망률 ─────────────────────────
export function hazard(sex: Sex, age: number, mult: number): number {
  const m = D.mortality[sex];
  if (age === 0) return m.infant * mult;
  return 1 - Math.exp(-(m.lambda + m.a * Math.exp(m.b * age)) * mult);
}

/** 같은 해 태어난 아이들 중 age 세 이후까지 사는 비율 (남녀·소득분위 평균) */
export function cohortSurvival(age: number): number {
  let total = 0;
  for (const sex of ['M', 'F'] as Sex[]) {
    const w = sex === 'M' ? D.maleBirthShare : 1 - D.maleBirthShare;
    for (const qm of D.mortality.quintileMultiplier) {
      let S = 1;
      for (let x = 0; x <= age; x++) S *= 1 - hazard(sex, x, qm);
      total += (w * S) / D.mortality.quintileMultiplier.length;
    }
  }
  return total;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const eduName = (t: EduTier) => D.eduTiers[t].label.replace(' 졸업', '');

// ───────────────────────── 인생 ─────────────────────────
export class Life {
  readonly seed: number;
  private r: Rng;
  age = 0;
  alive = true;
  pending: { prompt: string; options: Option[] } | null = null;
  history: YearResult[] = [];
  private current: { entries: Entry[] } = { entries: [] };
  private shownFacts = new Set<string>();
  private usedEvents = new Set<string>();
  flags: Flags = {};

  // 출생 시 정해지는 것들 (start()에서 채움)
  region!: (typeof D.birthsByRegion)[number];
  residence!: Residence;
  sex!: Sex;
  quintile = 3;
  surname = '';
  name = '';
  dream = '';
  stats: Stats = { health: 66, happiness: 60, ability: 50, relation: 55 };

  // 살면서 바뀌는 것들
  cash = 0;
  independent = false;
  edu: EduTier | null = null;
  job: Job | null = null;
  careerYears: Partial<Record<JobType, number>> = {};
  lastWork: string | null = null;
  married = false;
  spouse: Spouse | null = null;
  children: Child[] = [];
  house: House | null = null;
  pensionMonthly = 0;
  deathCause = '';

  constructor(seed?: number) {
    this.seed = (seed === undefined ? Math.floor(Math.random() * 2 ** 32) : seed) >>> 0;
    this.r = new Rng(this.seed);
  }

  get year() { return START_YEAR + this.age; }
  get quintileInfo() { return D.incomeQuintiles[this.quintile - 1]; }
  get netWorth() { return this.cash + (this.house ? this.house.price - this.house.debt : 0); }

  // ───────── 기록 도우미 ─────────
  private log(text: string, kind: EntryKind = 'event') { this.current.entries.push({ text, kind }); }
  private fact(key: string) {
    if (this.shownFacts.has(key) || !FACTS[key]) return;
    this.shownFacts.add(key);
    this.log(FACTS[key], 'fact');
  }
  private apply(fx: Effect = {}) {
    for (const k of ['health', 'happiness', 'ability', 'relation'] as StatKey[]) {
      const d = fx[k];
      if (d) this.stats[k] = clamp(this.stats[k] + d);
    }
    if (fx.cash) this.cash += fx.cash;
  }
  private ask(prompt: string, options: Option[]) {
    this.pending = { prompt, options };
    this.log(prompt, 'choice');
  }

  // ───────── 출생 ─────────
  start(): YearResult {
    this.current = { entries: [] };
    const r = this.r;
    this.region = r.weighted(D.birthsByRegion, (x) => x.births);
    this.residence = { name: this.region.name, group: this.region.group, seoul: this.region.id === 'seoul' };
    this.sex = r.chance(D.maleBirthShare) ? 'M' : 'F';
    this.quintile = 1 + Math.floor(r.rand() * 5);
    this.surname = r.weighted(D.surnames)[0];
    this.name = this.surname + r.pick(D.givenNames[this.sex]);
    const qShift = [-4, -2, 0, 2, 4][this.quintile - 1];
    this.stats = {
      health: clamp(r.normal(66, 9)),
      happiness: 60,
      ability: clamp(r.normal(50 + qShift, 14)),
      relation: clamp(r.normal(55, 12)),
    };
    this.dream = r.pick(DREAMS);

    const sexWord = this.sex === 'M' ? '남자아이' : '여자아이';
    this.log(`${this.region.name}의 ${this.quintileInfo.label} 집에서 ${sexWord}로 태어났다. 이름은 ${this.name}.`, 'milestone');
    this.fact('birth');
    if (this.region.id === 'gyeonggi') this.fact('region');

    const mult = D.mortality.quintileMultiplier[this.quintile - 1];
    if (r.chance(hazard(this.sex, 0, mult))) this.die();
    return this.finishYear();
  }

  // ───────── 한 해 진행 ─────────
  next(): YearResult {
    if (!this.alive) throw new Error('이미 끝난 삶입니다');
    if (this.pending) throw new Error('선택지에 먼저 답해야 합니다');
    this.age += 1;
    this.current = { entries: [] };

    if (this.checkDeath()) return this.finishYear();

    this.milestones();
    if (!this.pending) this.lifeOpportunities();
    this.career();
    this.familyYear();
    if (!this.pending && this.r.chance(0.5)) this.randomEvent();
    this.economy();
    this.drift();
    return this.finishYear();
  }

  choose(index: number): YearResult {
    if (!this.pending) throw new Error('고를 선택지가 없습니다');
    const opt = this.pending.options[index];
    this.pending = null;
    this.current = { entries: [] };
    this.log(`→ ${opt.label}`, 'pick');
    opt.run();
    return this.finishYear(true);
  }

  /** 자동 선택: 각 선택지의 auto 가중치대로 고른다 */
  autoChoiceIndex(): number {
    if (!this.pending) return -1;
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
    return {
      name: this.name, age: this.age, year: this.year, sex: this.sex,
      region: this.region.name, residence: this.residence.name,
      stats: { ...this.stats },
      netWorth: this.independent ? Math.round(this.netWorth) : null,
      familyLabel: this.quintileInfo.label,
      job: this.job ? this.job.title : null,
      edu: this.edu ? D.eduTiers[this.edu].label : null,
      married: this.married, children: this.children.length, house: !!this.house,
    };
  }

  // ───────── 사망 ─────────
  private checkDeath(): boolean {
    const qm = D.mortality.quintileMultiplier[this.quintile - 1];
    // 건강 수치가 평균(약 61~65)보다 낮을수록 위험률이 커진다
    const hm = clamp(1 + (61 - this.stats.health) / 80, 0.7, 1.7);
    if (this.r.chance(hazard(this.sex, this.age, qm * hm))) {
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
    if (a === 3) this.log('어린이집에 다니기 시작했다.', 'milestone');
    if (a === 7) {
      this.log('초등학교에 입학했다.', 'milestone');
      this.log(`장래희망은 ${josa(this.dream, '이었다/였다')}.`);
    }
    if (a === 10) this.askTutoring();
    if (a === 13) this.log('중학교에 입학했다.', 'milestone');
    if (a === 16) this.askHighSchool();
    if (a >= 16 && a <= 18 && f.allIn) this.apply({ ability: 3, happiness: -2 });
    if (a >= 11 && a <= 17 && f.tutoring) this.apply({ ability: this.quintile <= 2 ? 0.5 : 1 });
    if (a === 18) this.suneung();
    if (a === 19 && f.retake) this.suneungRetake();
    if (f.collegeStart === a && this.edu) {
      this.log(`대학에 입학했다. (${eduName(this.edu)})`, 'milestone');
      if ((this.edu === 'capital4' || this.edu === 'top4') && this.residence.group !== 'capital' && this.r.chance(0.65)) {
        this.residence = { name: '서울', group: 'capital', seoul: true };
        this.log('대학 때문에 서울로 올라왔다. 고시원에서 첫 자취를 시작했다.');
        f.movedSeoul = true;
      }
    }
    if (male && a === (f.retake ? 21 : 20)) this.military();
    if (male && !f.militaryDone && f.militaryEnd === a) {
      this.log('전역했다.', 'milestone');
      f.militaryDone = true;
    }
    if (f.gradAge === a && this.edu) this.log(`${eduName(this.edu)}을 졸업했다.`, 'milestone');
    if (f.jobSearchAge === a) this.jobSearch();
    if (a === 35 && !f.exerciseAsked) this.askExercise();
    if (a === 45) this.askCheckup();
    if (a === 65) this.startPension();
  }

  private askTutoring() {
    const poor = this.quintile <= 2;
    this.ask('학원을 어떻게 할까?', [
      {
        label: '학원을 여러 곳 다닌다',
        desc: poor ? '형편이 빠듯해 한두 곳이 한계다' : '영어, 수학, 논술까지',
        auto: poor ? 2 : 4,
        run: () => {
          this.flags.tutoring = true;
          this.apply({ ability: poor ? 2 : 4, happiness: -5, relation: -1 });
          this.log(poor ? '부모님이 무리해서 학원 두 곳을 보내 주셨다.' : '방과 후엔 학원 버스를 타고 다녔다.');
          this.fact('tutoring');
        },
      },
      {
        label: '실컷 놀며 자란다',
        desc: '놀이터와 친구들',
        auto: 1,
        run: () => {
          this.apply({ happiness: 6, relation: 5, health: 2 });
          this.log('해가 질 때까지 친구들과 뛰어놀았다.');
          this.fact('tutoring');
        },
      },
    ]);
  }

  private askHighSchool() {
    this.ask('고등학교 3년을 어떻게 보낼까?', [
      {
        label: '입시에 모든 걸 건다', desc: '성적은 오르지만 지친다', auto: 3,
        run: () => { this.flags.allIn = true; this.apply({ health: -3, happiness: -4 }); this.log('일반고에 입학했다. 목표는 오직 대학이었다.', 'milestone'); },
      },
      {
        label: '공부와 생활의 균형을 찾는다', desc: '무리하지 않는다', auto: 5,
        run: () => { this.apply({ ability: 3, happiness: 2 }); this.log('일반고에 입학했다.', 'milestone'); },
      },
      {
        label: '특성화고에서 기술을 배운다', desc: '졸업 후 바로 취업을 노린다', auto: 1.5,
        run: () => { this.flags.vocational = true; this.apply({ happiness: 3 }); this.log('특성화고에 입학해 기술을 배우기 시작했다.', 'milestone'); },
      },
    ]);
  }

  // 수능 점수(대략 평균 56, 표준편차 18) → 진학 가능한 학교
  private examScore(): number {
    const qBonus = [-6, -3, 0, 3, 7][this.quintile - 1];
    return this.stats.ability + this.r.normal(0, 10) + qBonus + (this.flags.vocational ? -8 : 0);
  }
  private tierFor(score: number): EduTier {
    if (score >= 92) return 'top4';
    if (score >= 71) return 'capital4';
    if (score >= 53) return 'local4';
    return 'college2';
  }
  private percentile(score: number): number {
    const z = (score - 56) / 18; // 표준정규 CDF 근사
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) p = 1 - p;
    return Math.max(1, Math.round((1 - p) * 100));
  }

  private suneung() {
    const score = this.examScore();
    this.flags.score = score;
    const tier = this.tierFor(score);
    if (this.flags.vocational) {
      this.log('특성화고 3학년, 현장실습을 나갔다.');
      this.ask('졸업 후 진로를 정해야 한다.', [
        { label: '바로 취업한다', desc: '고졸 채용에 지원한다', auto: 6, run: () => this.skipCollege() },
        { label: '전문대에 진학한다', desc: '2년 더 배운다', auto: 3, run: () => this.enterCollege('college2', 19) },
      ]);
      return;
    }
    this.log(`수능을 봤다. 성적은 상위 ${this.percentile(score)}% 정도였다.`, 'milestone');
    this.fact('college');
    const low = tier === 'college2';
    const opts: Option[] = [{ label: '점수에 맞춰 진학한다', desc: eduName(tier), auto: low ? 5 : 9, run: () => this.enterCollege(tier, 19) }];
    if (tier !== 'top4') {
      opts.push({
        label: '재수한다', desc: '1년 더 공부해서 다시 본다', auto: low ? 0.6 : 1.2,
        run: () => { this.flags.retake = true; this.apply({ happiness: -6 }); this.log('재수학원에 등록했다.'); },
      });
    }
    opts.push({ label: '대학 대신 일을 시작한다', desc: '고졸로 사회에 나간다', auto: low ? 5.5 : 0.6, run: () => this.skipCollege() });
    this.ask('어떻게 할까?', opts);
  }

  private suneungRetake() {
    const score = (this.flags.score ?? 50) + this.r.normal(3, 6);
    this.log(`두 번째 수능을 봤다. 성적은 상위 ${this.percentile(score)}% 정도였다.`, 'milestone');
    this.enterCollege(this.tierFor(score), 20);
  }

  private enterCollege(tier: EduTier, startAge: number) {
    this.edu = tier;
    this.flags.collegeStart = startAge;
    if (startAge === this.age) {
      // 재수 후 같은 해 바로 입학하는 경우
      this.flags.collegeStart = undefined;
      this.log(`대학에 입학했다. (${eduName(tier)})`, 'milestone');
    }
    const extra = this.sex === 'M' ? 2 : 0; // 군 복무 기간
    this.flags.gradAge = startAge + D.eduTiers[tier].years + extra;
    this.flags.jobSearchAge = this.flags.gradAge;
  }

  private skipCollege() {
    this.edu = 'highschool';
    this.flags.gradAge = undefined;
    this.log('고등학교를 졸업하고 사회에 나왔다.', 'milestone');
    if (this.sex === 'M') {
      this.flags.jobSearchAge = 22;
      this.log('입대 전까지 아르바이트로 돈을 모으기로 했다.');
    } else {
      this.flags.jobSearchAge = this.age + 1;
    }
  }

  private military() {
    const roll = this.r.rand();
    if (roll < D.military.exemptRate || this.stats.health < 35) {
      this.log('병역 판정 검사에서 면제 판정을 받았다.');
      this.flags.militaryDone = true;
      return;
    }
    if (roll < D.military.exemptRate + D.military.alternativeRate) {
      this.log('보충역 판정을 받아 사회복무요원으로 복무를 시작했다.', 'milestone');
    } else {
      this.log(`현역으로 입대했다. ${this.r.pick(MILITARY_BASES)}의 부대로 배치됐다.`, 'milestone');
      this.apply({ health: 2, happiness: -4, relation: 2 });
    }
    this.fact('military');
    this.flags.militaryEnd = this.age + 1;
  }

  private becomeIndependent() {
    if (this.independent) return;
    this.independent = true;
    const help = [0, 300, 1000, 2000, 5000][this.quintile - 1];
    this.cash = help * (0.5 + this.r.rand());
  }

  // ───────── 취업 ─────────
  private jobSearch() {
    this.becomeIndependent();
    this.fact('youthJob');
    this.ask('취업 준비를 어떻게 할까?', [
      { label: '눈높이를 맞춰 바로 취업한다', desc: '지금 갈 수 있는 곳으로', auto: 7, run: () => this.assignJob(false) },
      {
        label: '1년 더 준비한다', desc: '공무원 시험이나 대기업 공채', auto: 3,
        run: () => {
          this.apply({ happiness: -4 });
          this.log(this.r.pick(['노량진 학원가에서 1년을 보냈다.', '스터디 카페를 집처럼 드나들며 공채를 준비했다.', '자기소개서만 쉰 번 넘게 썼다.']));
          this.flags.prepareUntil = this.age + 1;
          this.job = { type: 'none', title: '취업 준비생', salary: 0, since: this.age, main: false };
        },
      },
    ]);
  }

  private jobWeights(prepared: boolean): [JobType, number][] {
    const table: Record<EduTier, Partial<Record<JobType, number>>> = {
      highschool: { large: 0.04, public: 0.03, sme: 0.4, contract: 0.45, professional: 0, none: 0.08 },
      college2: { large: 0.06, public: 0.05, sme: 0.45, contract: 0.38, professional: 0, none: 0.06 },
      local4: { large: 0.1, public: 0.12, sme: 0.42, contract: 0.3, professional: 0.01, none: 0.05 },
      capital4: { large: 0.22, public: 0.14, sme: 0.36, contract: 0.22, professional: 0.02, none: 0.04 },
      top4: { large: 0.42, public: 0.14, sme: 0.15, contract: 0.1, professional: 0.16, none: 0.03 },
    };
    const w = { ...table[this.edu ?? 'highschool'] } as Record<'large' | 'public' | 'sme' | 'contract' | 'professional' | 'none', number>;
    const af = (this.stats.ability - 50) / 50;
    w.large *= 1 + af * 1.2;
    w.professional *= this.stats.ability > 70 ? 1 + af : 0.2;
    w.public *= 1 + af * 0.6;
    w.contract *= Math.max(0.2, 1 - af * 0.5);
    if (this.flags.vocational) { w.sme += 0.1; w.public += 0.03; w.contract -= 0.08; }
    if (prepared) { w.large *= 1.5; w.public *= 2.2; w.contract *= 0.6; w.none *= 0.7; }
    return (Object.entries(w) as [JobType, number][]).map(([k, v]) => [k, Math.max(0, v)]);
  }

  private assignJob(prepared: boolean) {
    const [type] = this.r.weighted(this.jobWeights(prepared));
    if (type === 'none') {
      this.log('이번에도 최종 합격 문자는 오지 않았다.', 'bad');
      this.job = { type: 'none', title: '취업 준비생', salary: 0, since: this.age, main: false };
      this.apply({ happiness: -5 });
      return;
    }
    this.startJob(type, true);
  }

  private startJob(type: Exclude<JobType, 'none'>, main: boolean, titleList?: string[]) {
    const J = D.jobs[type];
    const title = this.r.pick(titleList ?? JOB_TITLES[type]);
    const af = 1 + (this.stats.ability - 50) / 250;
    const salary = J.startSalary * (0.85 + 0.3 * this.r.rand()) * af;
    this.job = { type, title, salary, since: this.age, main };
    this.lastWork = title;
    if (type === 'self') this.log(`${josa(title, '이/가')} 됐다.`, 'milestone');
    else {
      const where = type === 'public' ? '' : ` (${J.label})`;
      this.log(`${josa(title, '으로/로')} 일을 시작했다${where}. 첫해 연봉은 약 ${won(salary)}.`, 'milestone');
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

  private startPension() {
    const career = (Object.entries(this.careerYears) as [JobType, number][]).sort((a, b) => b[1] - a[1])[0];
    const worked = Object.values(this.careerYears).reduce((s, x) => s + (x ?? 0), 0);
    const byType: Partial<Record<JobType, number>> = { public: 230, large: 110, professional: 120, sme: 65, contract: 45, self: 45 };
    let monthly = 33; // 기초연금 수준
    if (career && worked >= 10) monthly = career[0] === 'public' ? 230 : (byType[career[0]] ?? 45) + (this.quintile <= 3 ? 33 : 0);
    this.pensionMonthly = monthly;
    this.log(`연금을 받기 시작했다. 한 달에 약 ${won(monthly)}.`, 'milestone');
    this.fact('pension');
    if (monthly < 80 && this.netWorth < 30000) this.fact('elderPoverty');
  }

  // ───────── 매년 생길 수 있는 기회 ─────────
  private lifeOpportunities() {
    if (this.age < 22) return;
    if (!this.married && this.age <= 58 && this.marriageChance()) return this.askMarriage();
    if (this.married && this.childOpportunity()) return;
    this.houseOpportunity();
  }

  private marriageChance(): boolean {
    const s = this.sex;
    const mode = s === 'M' ? 33.5 : 31.5;
    const k = s === 'M' ? 0.14 : 0.19;
    let p = k * Math.exp(-((this.age - mode) ** 2) / (2 * 5.5 ** 2)) + (this.age >= 38 ? 0.012 : 0);
    const t: JobType = this.job ? this.job.type : 'none';
    const jobMod: Record<JobType, number> = s === 'M'
      ? { large: 1.4, public: 1.45, professional: 1.5, sme: 1.0, self: 0.9, contract: 0.65, none: 0.35 }
      : { large: 1.1, public: 1.2, professional: 1.1, sme: 1.0, self: 0.95, contract: 0.85, none: 0.75 };
    p *= jobMod[t];
    p *= 1 + (this.stats.relation - 55) / 100;
    if (this.flags.divorced) p *= 0.4;
    p *= Math.pow(0.8, this.flags.declinedMarriage ?? 0);
    if (!this.independent) p *= 0.3;
    return this.r.chance(p);
  }

  private askMarriage() {
    const r = this.r;
    const spouseSex: Sex = this.sex === 'M' ? 'F' : 'M';
    const diff = Math.round(r.normal(2.4, 2));
    const spouseAge = this.sex === 'M' ? this.age - diff : this.age + diff;
    const spouseName = r.weighted(D.surnames)[0] + r.pick(D.givenNames[spouseSex]);
    this.log(`${r.pick(MEETING_PLACES)} 만난 ${josa(spouseName, '과/와')} 진지한 사이가 됐다.`, 'good');
    this.ask('결혼 이야기가 나왔다.', [
      {
        label: '결혼한다', desc: `${spouseName}, ${spouseAge}세`, auto: 8.5,
        run: () => {
          this.married = true;
          const works = r.chance(this.sex === 'M' ? 0.62 : 0.85);
          this.spouse = { name: spouseName, sex: spouseSex, age0: spouseAge - this.age, income: works ? 2600 + r.rand() * 2500 : 0, alive: true };
          const help = this.flags.parentHelpUsed ? 0 : [0, 1000, 3000, 6000, 20000][this.quintile - 1] * (0.5 + r.rand());
          this.flags.parentHelpUsed = true;
          this.cash += help;
          this.apply({ happiness: 10, relation: 4 });
          this.log(`${josa(spouseName, '과/와')} 결혼했다.` + (help > 500 ? ` 부모님이 ${won(help)}을 보태 주셨다.` : ''), 'milestone');
          this.fact('marriage');
        },
      },
      {
        label: '아직은 아니다', desc: '혼자인 삶도 괜찮다', auto: 1.5,
        run: () => {
          this.flags.declinedMarriage = (this.flags.declinedMarriage ?? 0) + 1;
          this.apply({ happiness: -2 });
          this.log(`${spouseName}${particle(spouseName, '과/와')}는 결국 각자의 길을 가기로 했다.`);
        },
      },
    ]);
  }

  private spouseAge(): number {
    return this.spouse ? this.age + this.spouse.age0 : 0;
  }

  private childOpportunity(): boolean {
    if (!this.spouse || !this.spouse.alive) return false;
    const motherAge = this.sex === 'F' ? this.age : this.spouseAge();
    const n = this.children.length;
    if (motherAge > 42 || n >= 3) return false;
    if (n > 0 && this.age - this.children[n - 1].bornAge < 2) return false;
    let p = [0.27, 0.13, 0.03][n];
    if (motherAge >= 38) p *= 0.5;
    if (!this.r.chance(p)) return false;
    const ord = ['첫째', '둘째', '셋째'][n];
    this.ask(n === 0 ? '아이를 가질까?' : `${ord} 아이를 가질까?`, [
      { label: '아이를 갖는다', desc: n === 0 ? '부모가 된다' : '가족이 늘어난다', auto: [7.5, 5.5, 3.5][n], run: () => this.haveChild() },
      {
        label: '지금은 아니다', desc: n === 0 ? '둘만의 삶을 산다' : '지금으로 충분하다', auto: [2.5, 4.5, 6.5][n],
        run: () => { this.log(n === 0 ? '아직은 둘이서 지내기로 했다.' : '지금 가족으로 충분하다고 생각했다.'); this.fact('child'); },
      },
    ]);
    return true;
  }

  private haveChild() {
    if (!this.spouse) return;
    const sex: Sex = this.r.chance(D.maleBirthShare) ? 'M' : 'F';
    const fatherSurname = this.sex === 'M' ? this.surname : this.spouse.name[0];
    const child: Child = { sex, name: fatherSurname + this.r.pick(D.givenNames[sex]), bornAge: this.age };
    this.children.push(child);
    const ord = ['첫째', '둘째', '셋째'][this.children.length - 1];
    this.log(`${ord} ${sex === 'M' ? '아들' : '딸'} ${josa(child.name, '이/가')} 태어났다.`, 'milestone');
    this.apply({ happiness: 8, health: -2 });
    this.fact('child');
  }

  private housePrice(): number {
    if (this.residence.seoul) return D.housePrice.capitalSeoul;
    return D.housePrice[this.residence.group] ?? D.housePrice.province;
  }

  private houseOpportunity(): boolean {
    if (this.house || this.age < 28 || this.age > 68 || !this.independent) return false;
    const price = this.housePrice() * (0.7 + this.r.rand() * 0.6);
    // 형편이 넉넉한 집은 아직 결혼 자금을 받지 않았다면 집 살 때 도와준다
    const help = !this.flags.parentHelpUsed && this.quintile >= 4 ? [0, 0, 0, 5000, 18000][this.quintile - 1] : 0;
    if (this.cash + help < price * (1 - D.mortgageLTV) || !this.r.chance(0.4)) return false;
    this.ask(`${this.residence.name}에 마음에 드는 집이 나왔다. (${won(price)})`, [
      {
        label: '대출을 받아 집을 산다', desc: `대출 약 ${won(price * D.mortgageLTV)}`, auto: 7,
        run: () => {
          if (help) { this.cash += help; this.flags.parentHelpUsed = true; this.log(`부모님이 ${won(help)}을 보태 주셨다.`); }
          const down = Math.min(this.cash, price * 0.5);
          this.cash -= down;
          this.house = { price, debt: price - down, loan: price - down, boughtAge: this.age };
          this.apply({ happiness: 6 });
          this.log(`내 집을 마련했다. 대출은 ${won(this.house.debt)}.`, 'milestone');
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
    if (j.type !== 'none') this.careerYears[j.type] = (this.careerYears[j.type] ?? 0) + 1;

    if (j.type === 'none') {
      if (f.prepareUntil === a) { f.prepareUntil = undefined; this.assignJob(true); return; }
      if ((f.prepareUntil ?? 0) > a || f.retired) return;
      if (a < 50 && this.r.chance(0.45)) this.startJob(this.r.chance(0.4) ? 'sme' : 'contract', true);
      else if (a >= 50 && a < 68 && this.r.chance(0.25)) this.startJob('contract', false, JOB_TITLES.late);
      else if (a < 50) this.apply({ happiness: -3 });
      return;
    }

    // 연봉: 50세까지 경력에 따라 오름 (실질)
    const J = D.jobs[j.type];
    if (j.type === 'self') j.salary = J.startSalary * (0.4 + this.r.rand() * 1.3);
    else if (a < 50) j.salary *= 1 + J.growth;

    // 주된 일자리 퇴직
    if (j.main) {
      const retireNow =
        (j.type === 'public' && a >= 60) ||
        (j.type === 'professional' && a >= 63 && this.r.chance(0.15)) ||
        (['large', 'sme', 'contract'].includes(j.type) && a >= 49 && (this.r.chance(0.13) || a >= 60));
      if (retireNow) return this.mainRetire();
    } else if (a >= 65 && (this.r.chance(0.18) || a >= 75)) {
      this.log(`${j.title} 일을 그만두고 쉬기로 했다.`, 'milestone');
      this.job = { type: 'none', title: '은퇴', salary: 0, main: false };
      f.retired = true;
      return;
    }

    // 직장에서 생기는 일
    if (j.type === 'contract' && j.main && this.r.chance(0.05)) {
      j.type = 'sme';
      j.salary *= 1.1;
      this.log('계약직에서 정규직으로 전환됐다.', 'good');
      this.apply({ happiness: 5 });
    } else if (j.type === 'contract' && this.r.chance(0.07)) {
      this.log('계약이 갱신되지 않았다.', 'bad');
      this.loseJob();
    } else if (j.type === 'sme' && this.r.chance(0.025)) {
      this.log('회사가 어려워져 권고사직을 받았다.', 'bad');
      this.loseJob();
    } else if (j.type === 'large' && this.r.chance(a >= 45 ? 0.05 : 0.012)) {
      this.log('구조조정 명단에 이름이 올랐다. 희망퇴직을 신청했다.', 'bad');
      this.cash += j.salary * 1.5;
      this.loseJob();
    } else if (j.type === 'self' && this.r.chance(0.12)) {
      this.log('매출이 버티지 못해 가게를 접었다.', 'bad');
      this.cash -= 1500;
      this.loseJob();
    } else if (j.type === 'sme' && j.main && a < 40 && this.stats.ability > 62 && !this.pending && this.r.chance(0.05)) {
      this.ask('대기업에서 경력직 제안이 왔다.', [
        { label: '옮긴다', desc: '연봉은 오르지만 새로 시작이다', auto: 7, run: () => { this.startJob('large', true, [j.title]); this.apply({ happiness: 3 }); } },
        { label: '지금 회사에 남는다', desc: '익숙한 사람들과 함께', auto: 3, run: () => { this.log('남기로 했다. 팀장님이 밥을 샀다.'); this.apply({ relation: 3 }); } },
      ]);
    } else if (['large', 'sme', 'public'].includes(j.type) && a >= 30 && a <= 55 && this.r.chance(0.08)) {
      j.salary *= 1.08;
      this.log(this.r.pick(['승진했다.', '진급 발표에 이름이 있었다.', '팀장이 됐다.']), 'good');
      this.apply({ happiness: 4, ability: 1 });
    }
    if (j.type === 'contract') this.apply({ happiness: -0.5 });
  }

  private loseJob() {
    const retire = this.age >= 63;
    this.job = { type: 'none', title: retire ? '은퇴' : '구직 중', salary: 0, since: this.age, main: false };
    if (retire) this.flags.retired = true;
    this.apply({ happiness: retire ? -3 : -8 });
  }

  private mainRetire() {
    const j = this.job!;
    this.log(`오래 다닌 직장을 떠났다. (${j.title})`, 'milestone');
    this.fact('retire');
    this.cash += j.salary * (j.type === 'large' || j.type === 'public' ? 1.2 : 0.8); // 퇴직금
    this.job = { type: 'none', title: '은퇴', salary: 0, main: false };
    if (this.age >= 63 || this.pending) {
      this.flags.retired = true;
      return;
    }
    this.ask('이제 무엇을 할까?', [
      { label: '다시 일자리를 구한다', desc: '경비, 운전, 돌봄 같은 일', auto: 5, run: () => this.startJob('contract', false, JOB_TITLES.late) },
      {
        label: '모은 돈으로 가게를 연다', desc: '창업 비용 약 7천만 원', auto: 2,
        run: () => { this.cash -= 7000; this.startJob('self', false); },
      },
      { label: '일을 그만두고 쉰다', auto: 3, run: () => { this.flags.retired = true; this.apply({ happiness: 3 }); this.log('알람 없이 일어나는 아침이 낯설었다.'); } },
    ]);
  }

  // ───────── 가족과 건강 ─────────
  private familyYear() {
    const a = this.age;
    const r = this.r;
    const f = this.flags;
    // 배우자
    if (this.married && this.spouse) {
      const sa = this.spouseAge();
      if (sa >= 60) this.spouse.income = 0;
      if (r.chance(hazard(this.spouse.sex, sa, 1))) {
        this.log(`배우자 ${josa(this.spouse.name, '이/가')} 세상을 떠났다. (${sa}세)`, 'bad');
        this.spouse.alive = false;
        this.married = false;
        f.widowed = true;
        this.apply({ happiness: -20, health: -5 });
      } else if (r.chance(D.marriage.annualDivorceRate * (this.stats.happiness < 40 ? 2.5 : 1))) {
        this.log(`${josa(this.spouse.name, '과/와')} 이혼했다.`, 'bad');
        this.married = false;
        f.divorced = true;
        this.cash *= 0.6;
        this.apply({ happiness: -12 });
      }
    }
    // 부모님
    if (!f.parentsGone && a >= 48 && (r.chance(0.07) || a >= 72)) {
      f.parentsGone = true;
      const inherit = this.quintileInfo.wealth * 0.5 * (0.6 + r.rand() * 0.6);
      this.log('부모님이 돌아가셨다.' + (inherit > 3000 ? ` 남기신 재산 중 ${won(inherit)}을 물려받았다.` : ''), 'bad');
      if (inherit > 3000) this.cash += inherit;
      this.apply({ happiness: -10 });
    }
    // 손주
    if (this.children.length && !f.grandchild && a >= 55 && this.children[0].bornAge + 30 <= a && r.chance(0.12)) {
      f.grandchild = true;
      this.log('첫 손주가 태어났다.', 'good');
      this.apply({ happiness: 8 });
    }
    // 아이 성장
    for (const c of this.children) {
      const ca = a - c.bornAge;
      if (ca === 7) this.log(`${josa(c.name, '이/가')} 초등학교에 입학했다.`);
      if (ca === 19 && r.chance(0.7)) this.log(`${josa(c.name, '이/가')} 대학에 들어갔다.`);
      if (ca === 30 && r.chance(0.5)) this.log(`${josa(c.name, '이/가')} 결혼했다.`, 'good');
    }
    // 병 (암 발생률은 평생 약 37%에 맞춤)
    if (a >= 30 && f.cancerAge === undefined && r.chance(0.00085 * Math.exp(0.065 * (a - 30)))) {
      f.cancerAge = a;
      const kinds = CANCERS.filter((c) => !(c === '유방암' && this.sex === 'M') && !(c === '전립선암' && this.sex === 'F'));
      this.log(`${r.pick(kinds)} 진단을 받았다.`, 'bad');
      this.apply({ health: -22, happiness: -10 });
      this.cash -= 1200;
      this.fact('cancer');
    } else if (a >= 40 && r.chance(0.02)) {
      this.log(r.pick(['고혈압 진단을 받았다.', '당뇨 진단을 받았다.', '협심증으로 시술을 받았다.', '허리 수술을 받았다.']), 'bad');
      this.apply({ health: -6 });
    }
  }

  private randomEvent() {
    // 같은 사건은 한 생에 한 번만
    const pool = RANDOM_EVENTS[stageOf(this.age)].filter(
      ([text, fx, cond]) => !this.usedEvents.has(text) && (!cond || cond(this)) && !(fx.cash && !this.independent),
    );
    if (!pool.length) return;
    const [text, fx] = this.r.pick(pool);
    this.usedEvents.add(text);
    const mood = (fx.happiness ?? 0) + (fx.health ?? 0);
    this.log(text, mood < -3 ? 'bad' : (fx.happiness ?? 0) > 3 ? 'good' : 'event');
    this.apply(fx);
  }

  // ───────── 돈 (2024년 현재 가치, 만원) ─────────
  private economy() {
    if (!this.independent) return;
    let income = this.job && this.job.type !== 'none' ? this.job.salary : 0;
    if (this.married && this.spouse?.alive) income += this.spouse.income;
    if (this.pensionMonthly) income += this.pensionMonthly * 12;
    // 세금·사회보험 약 12%, 소비는 가처분소득의 66% + 자녀·주거비 (가계동향조사 흑자율 약 30% 근사)
    const disposable = income * (income > 2000 ? 0.88 : 1);
    let expenses = Math.max(this.married ? 2400 : 1500, disposable * 0.66);
    for (const c of this.children) if (this.age - c.bornAge < 25) expenses += 900;
    if (!this.house && this.age >= 25) expenses += this.residence.seoul ? 900 : 500; // 월세·전세 이자
    if (this.age >= 65) expenses *= 0.85;
    let payment = 0;
    if (this.house) {
      if (this.house.debt > 0) {
        const principal = Math.min(this.house.debt, this.house.loan / 30);
        payment = principal + this.house.debt * 0.04;
        this.house.debt -= principal;
      }
      this.house.price *= 1.01; // 실질 상승률
    }
    // 소득이 모자라면 생활비를 줄여서 버틴다
    const net = disposable - expenses - payment;
    this.cash += net >= 0 ? net : Math.max(net, -expenses * 0.5);
    this.cash *= this.cash > 0 ? 1.01 : 1.04; // 실질 수익률 / 대출 이자
    // 노후에 빚만 남으면 기초생활보장제도가 바닥을 받쳐 준다
    if (this.age >= 60 && !this.house && this.cash < -3000) {
      this.cash = -3000;
      if (!this.flags.welfare) {
        this.flags.welfare = true;
        this.log('기초생활보장 수급자가 됐다.', 'bad');
        this.fact('elderPoverty');
      }
    }
    if (this.cash < -5000 && this.r.chance(0.3)) {
      this.log('빚 독촉 전화가 이어졌다.', 'bad');
      this.apply({ happiness: -4 });
    }
  }

  private drift() {
    const s = this.stats;
    s.happiness += (60 - s.happiness) * 0.12;
    s.health += (66 - s.health) * 0.06;
    if (this.flags.exercise) s.health = clamp(s.health + 0.5);
    if (this.job && this.job.type === 'none' && !this.flags.retired && this.age >= 22) s.happiness = clamp(s.happiness - 2);
    s.relation += (55 - s.relation) * 0.03;
  }

  // ───────── 요약 ─────────
  summary(): Summary {
    const sexWord = this.sex === 'M' ? '남자아이' : '여자아이';
    const lines: string[] = [`${this.region.name}의 ${this.quintileInfo.label} 집에서 ${sexWord}로 태어났다.`];
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
      this.age === 0 ? `태어난 해에 ${josa(this.deathCause, '으로/로')} 세상을 떠났다.` : `${this.age}세에 ${josa(this.deathCause, '으로/로')} 세상을 떠났다.`,
    );
    const outlive = Math.round(cohortSurvival(this.age) * 100);
    return {
      seed: this.seed,
      name: this.name,
      sex: this.sex,
      region: this.region.name,
      family: this.quintileInfo.label,
      age: this.age,
      cause: this.deathCause,
      birthYear: START_YEAR,
      deathYear: this.year,
      edu: this.edu ? D.eduTiers[this.edu].label : null,
      lastWork: this.lastWork,
      netWorth: this.independent ? Math.round(this.netWorth) : null,
      netWorthText: this.independent ? won(this.netWorth) : null,
      children: this.children.length,
      married: !!this.spouse,
      lines,
      outliveText: `같은 해 태어난 약 ${Math.round(D.totalBirths / 10000)}만 명 중 ${outlive}%가 나보다 오래 산다.`,
      outlivePercent: outlive,
    };
  }
}

export function createLife(seed?: number): Life {
  return new Life(seed);
}
