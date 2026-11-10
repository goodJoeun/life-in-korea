/*
 * 가상 플레이어 1,000명 시뮬레이션 (claude/stats/SKILL.md)
 *   npx tsx scripts/stats.ts          → claude/stats/REFERENCE.md 를 다시 쓴다
 *   npx tsx scripts/stats.ts 400      유형별 인원 (기본 200)
 *
 * simulate.ts 가 '운에 맡기기'로 실제 통계와 맞추는 도구라면, 이것은 사람처럼 고르는 플레이어로
 * 선택과 돈 관리가 결과를 얼마나 바꾸는지, 어떤 갈림길이 얼마나 나오는지 본다.
 */
import { writeFileSync } from 'node:fs';
import { createLife, type Life, type MoneyPlan, type YearResult } from '../src/lib/engine';
import { won } from '../src/lib/text';
import { MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from '../src/lib/timeline';

type Persona = 'auto' | 'random' | 'stable' | 'bold' | 'study';
const PERSONA_NAME: Record<Persona, string> = { auto: '운에 맡기기', random: '무작위', stable: '안정형', bold: '도전형', study: '공부형' };
// 선택지 이름으로 성향을 읽는다. 맞는 것이 없으면 운에 맡긴다.
const PREFER: Record<'stable' | 'bold' | 'study', RegExp> = {
  // 안정형은 결혼·아이·집은 하고, 위험한 쪽만 피한다
  stable: /결혼한다|아이를 갖는다|집을 산다|남는다|거절|예금|적금|안정|그대로|꼭 필요한|아껴|생활 습관|꾸준히|모시고|저축|눈높이|쉰다|빠진다|정리해/,
  bold: /옮긴다|시작한다|따라간다|^간다|넣는다|산다|해 본다|떠난다|나도|가게|휴학|주식|코인|하고 싶은|되고 싶다|한다$/,
  study: /공부|과학|수학|학점|자격증|대학원|책|1년 더|학원|배운다|배워|준비한다|독서|도서관|문예|컴퓨터/,
};
const PLANS: Record<Persona, MoneyPlan | null> = {
  auto: null,
  random: null,
  stable: { spend: 'frugal', alloc: { deposit: 80, stock: 0, global: 20, crypto: 0 } },
  bold: { spend: 'normal', alloc: { deposit: 20, stock: 40, global: 20, crypto: 20 } },
  study: { spend: 'frugal', alloc: { deposit: 40, stock: 20, global: 40, crypto: 0 } },
};

function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

interface Rec {
  persona: Persona; birthYear: number; sex: string; age: number; edu: string | null; job30: string | null;
  married50: boolean | null; kids: number; house50: boolean | null; nw60: number | null; nwEnd: number | null;
  choices: number; mine: number; interest: string | null; traits: Record<string, number>; prompts: string[]; years: number;
}

function choose(life: Life, res: YearResult, p: Persona, rnd: () => number): number {
  const opts = res.choice!.options;
  if (p === 'auto') return life.autoChoiceIndex();
  if (p === 'random') return Math.floor(rnd() * opts.length);
  const re = PREFER[p];
  const hit = opts.findIndex((o) => re.test(o.label));
  return hit >= 0 ? hit : life.autoChoiceIndex();
}

function play(p: Persona, birthYear: number, seed: number): Rec {
  const rnd = lcg(seed);
  const life = createLife({ seed, birthYear });
  let res = life.start();
  let planned = false, choices = 0, mine = 0;
  let job30: string | null = null, married50: boolean | null = null, house50: boolean | null = null, nw60: number | null = null;
  const prompts: string[] = [];
  while (!res.dead) {
    if (life.independent && !planned) {
      planned = true;
      const plan = PLANS[p] ?? (p === 'random' ? { spend: (['frugal', 'normal', 'loose'] as const)[Math.floor(rnd() * 3)], alloc: (() => { const s = Math.floor(rnd() * 6) * 10, g = Math.floor(rnd() * 4) * 10, c = Math.floor(rnd() * 3) * 10; return { deposit: 100 - s - g - c, stock: s, global: g, crypto: c }; })() } : null);
      if (plan) res = life.setPlan(plan);
    }
    if (res.choice) {
      choices++;
      prompts.push(res.choice.prompt);
      const i = choose(life, res, p, rnd);
      if (p !== 'auto') mine++;
      res = life.choose(i);
      continue;
    }
    res = life.next();
    const a = life.age;
    if (a === 30) job30 = life.job?.type ?? 'none';
    if (a === 50) { married50 = !!life.spouse; house50 = !!life.house; }
    if (a === 60) nw60 = life.netWorth;
  }
  const s = life.summary();
  return {
    persona: p, birthYear, sex: life.sex, age: life.age, edu: life.edu, job30, married50, kids: life.children.length, house50, nw60,
    nwEnd: s.netWorth, choices, mine, interest: s.interest, traits: s.traits, prompts, years: life.age,
  };
}

// ───────── 돌리기 ─────────
const per = Number(process.argv[2]) || 200;
const personas: Persona[] = ['auto', 'random', 'stable', 'bold', 'study'];
const recs: Rec[] = [];
const t0 = Date.now();
for (const p of personas) {
  for (let i = 0; i < per; i++) {
    const by = MIN_BIRTH_YEAR + (i % (MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1));
    recs.push(play(p, by, 900000 + personas.indexOf(p) * 10000 + i));
  }
}
const sec = ((Date.now() - t0) / 1000).toFixed(1);

// ───────── 집계 ─────────
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}%` : '—');
const share = (rs: Rec[], f: (r: Rec) => boolean | null) => { const v = rs.map(f).filter((x) => x !== null); return pct(v.filter(Boolean).length, v.length); };
const fourYear = (e: string | null) => ['local4', 'capital4', 'top4'].includes(e ?? '');
const goodJob = (j: string | null) => ['large', 'public', 'professional'].includes(j ?? '');
const man = (v: number) => (Number.isFinite(v) ? won(v) : '—');

function row(label: string, rs: Rec[]) {
  const nw60 = rs.map((r) => r.nw60).filter((x): x is number => x !== null);
  const nwEnd = rs.map((r) => r.nwEnd).filter((x): x is number => x !== null);
  return `| ${label} | ${rs.length} | ${mean(rs.map((r) => r.age)).toFixed(1)}세 | ${share(rs, (r) => (r.age >= 25 ? fourYear(r.edu) : null))} | ${share(rs, (r) => (r.job30 === null ? null : goodJob(r.job30)))} | ${share(rs, (r) => r.married50)} | ${mean(rs.filter((r) => r.age >= 45).map((r) => r.kids)).toFixed(2)} | ${share(rs, (r) => r.house50)} | ${man(q(nw60, 0.1))} / **${man(q(nw60, 0.5))}** / ${man(q(nw60, 0.9))} | ${man(q(nwEnd, 0.5))} | ${mean(rs.map((r) => r.choices)).toFixed(1)} |`;
}

const head = '| 유형 | 인원 | 평균 수명 | 4년제 졸업 (25세+) | 30세 좋은 일자리¹ | 50세 결혼 | 자녀 (45세+) | 50세 자가 | 60세 순자산 하위10% / **중앙값** / 상위10% | 마지막 순자산 중앙값 | 한 생 선택 |\n|---|---|---|---|---|---|---|---|---|---|---|';
const byPersona = personas.map((p) => row(PERSONA_NAME[p], recs.filter((r) => r.persona === p))).join('\n');
const eras: [string, number, number][] = [['1960~1979년생', 1960, 1979], ['1980~1999년생', 1980, 1999], ['2000~2026년생', 2000, 2026]];
const byEra = eras.map(([l, a, b]) => row(l, recs.filter((r) => r.birthYear >= a && r.birthYear <= b))).join('\n');

// 갈림길 등장 (프롬프트 앞 16자로 묶는다)
const pc = new Map<string, number>();
for (const r of recs) for (const p of new Set(r.prompts.map((x) => x.slice(0, 16)))) pc.set(p, (pc.get(p) ?? 0) + 1);
const prompts = [...pc].sort((a, b) => b[1] - a[1]);
const promptRows = prompts.map(([k, v]) => `| ${k.replace(/\|/g, '/')}… | ${pct(v, recs.length)} |`).join('\n');

// 관심 분야와 성향
const ic = new Map<string, number>();
for (const r of recs) if (r.age >= 20) ic.set(r.interest ?? '(없음)', (ic.get(r.interest ?? '(없음)') ?? 0) + 1);
const adults = recs.filter((r) => r.age >= 20).length;
const interestRows = [...ic].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, adults)}`).join(' · ');
const traitRows = personas.map((p) => {
  const rs = recs.filter((r) => r.persona === p && r.age >= 30);
  const t = (k: string) => mean(rs.map((r) => r.traits[k])).toFixed(0);
  return `| ${PERSONA_NAME[p]} | ${t('bold')} | ${t('social')} | ${t('diligent')} | ${t('thrift')} |`;
}).join('\n');

// 플레이 시간 (1년 15초, 선택 하나에 평균 8초 생각한다고 보고)
const minutes = recs.map((r) => (r.years * 15 + r.choices * 8) / 60);
const md = `# 1,000명 시뮬레이션 통계 (참조용)

\`npx tsx scripts/stats.ts\` 가 만든 파일. 고치지 말고 다시 돌린다. 방법은 [SKILL.md](SKILL.md).

- 유형별 ${per}명 × 5유형 = ${recs.length}명, 출생연도 ${MIN_BIRTH_YEAR}~${MAX_BIRTH_YEAR}년 고르게. 계산 ${sec}초.
- 금액은 2024년 가치. ¹좋은 일자리 = 대기업·공무원·전문직.
- 유형: 운에 맡기기(autoChoiceIndex, 기본 계획) · 무작위(선택·계획 무작위) · 안정형(안정 쪽 선택, 아껴 쓰기 + 예금 80%·해외 20%)
  · 도전형(도전 쪽 선택, 보통 + 주식 40%·해외 20%·코인 20%) · 공부형(공부 쪽 선택, 아껴 쓰기 + 주식 20%·해외 40%)

## 유형별

${head}
${byPersona}

## 세대별 (다섯 유형 모두)

${head}
${byEra}

## 한 생의 플레이 시간 (1년 15초 '보통' 기준, 선택 하나에 8초)

중앙값 **${q(minutes, 0.5).toFixed(0)}분** · 하위 10% ${q(minutes, 0.1).toFixed(0)}분 · 상위 10% ${q(minutes, 0.9).toFixed(0)}분 (일찍 세상을 떠난 생 포함)

## 성향 (30세 이상, 평균, -100~100)

| 유형 | 도전 | 어울림 | 성실 | 절약 |
|---|---|---|---|---|
${traitRows}

## 가장 큰 관심 분야 (20세 이상)

${interestRows}

## 선택이 나온 비율 (한 생에 한 번이라도)

| 선택 (앞 16자) | 생 비율 |
|---|---|
${promptRows}
`;
writeFileSync(new URL('../claude/stats/REFERENCE.md', import.meta.url), md);
console.log(md);
