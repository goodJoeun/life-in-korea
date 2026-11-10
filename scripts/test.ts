/*
 * 엔진 스모크 테스트 (npm test). claude/testing/SKILL.md 참고.
 *   npx tsx scripts/test.ts          기본 (출생연도 1960~2026 × 플레이 방식 4 × 씨앗 2)
 *   npx tsx scripts/test.ts 5        씨앗 수를 늘려 더 많이
 *
 * 확인하는 것: 예외 없이 끝까지 사는지, 되살리기가 같은 생을 만드는지, 기록 문장이 시대·세대에 맞는지,
 * 수치가 범위 안인지, 조사 실패·undefined 같은 흔적이 없는지.
 */
import { createLife, type Life, type YearResult } from '../src/lib/engine';
import { applyAction, replayLife, type LifeAction } from '../src/lib/replay';
import { MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from '../src/lib/timeline';

// ───────── 시대 규칙 (claude/realism/SKILL.md 의 표와 같게 유지) ─────────
interface EraRule { has: string | RegExp; ok: (year: number, birthYear: number, age: number) => boolean; why: string }
export const ERA_RULES: EraRule[] = [
  { has: /(?<!부모님께 )스마트폰 쓰는 법/, ok: (_y, b) => b <= 1965, why: '스마트폰을 노년에 처음 배우는 건 1965년생 이전' },
  { has: '키오스크 앞에서', ok: (_y, b) => b <= 1965, why: '키오스크에서 헤매는 건 1965년생 이전' },
  { has: '부모님께 스마트폰', ok: (y, b) => b <= 1995 && y <= 2035, why: '부모님께 스마트폰을 알려 드리는 건 1995년생 이전, 2035년까지' },
  { has: '이혼했다', ok: (_y, _b, age) => age < 90, why: '90세 넘어 이혼은 없다' },
  { has: '삐삐', ok: (y) => y >= 1993 && y <= 1999, why: '삐삐는 1993~1999년' },
  { has: 'PC통신', ok: (y) => y >= 1990 && y <= 2002, why: 'PC통신은 1990~2002년' },
  { has: '비디오 가게', ok: (y) => y <= 2005, why: '비디오 가게는 2005년까지' },
  { has: '처음으로 스마트폰', ok: (y) => y >= 2009, why: '스마트폰은 2009년부터' },
  { has: /국민학교(?!의 이름이)/, ok: (y) => y <= 1995, why: '국민학교는 1995년까지' },
];
const BROKEN = /undefined|NaN|\[object|[가-힣A-Za-z0-9]\((가|를|는|와|로|이|을|은|과|으로)\)/;

// ───────── 플레이 방식 ─────────
type Picker = (life: Life, res: YearResult, rnd: () => number) => LifeAction;
const PICKERS: Record<string, Picker> = {
  auto: () => 'a',
  random: (_l, res, rnd) => Math.floor(rnd() * res.choice!.options.length),
  first: () => 0,
  last: (_l, res) => res.choice!.options.length - 1,
};

function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

// 같은 종류의 문제는 묶어서 횟수와 첫 예시만 보여 준다
const failures = new Map<string, { count: number; example: string }>();
const fail = (kind: string, msg: string) => {
  const f = failures.get(kind);
  if (f) f.count++;
  else failures.set(kind, { count: 1, example: msg });
};

function checkResult(where: string, life: Life, res: YearResult) {
  for (const e of res.entries) {
    if (BROKEN.test(e.text)) fail(`깨진 문장: ${e.text.slice(0, 30)}`, `${where} ${e.text}`);
    for (const r of ERA_RULES) {
      const hit = typeof r.has === 'string' ? e.text.includes(r.has) : r.has.test(e.text);
      if (hit && !r.ok(res.year, life.birthYear, res.age)) fail(`시대: ${r.why}`, `${where} ${res.year}년 ${res.age}세 "${e.text}"`);
    }
  }
  const s = res.snapshot.stats;
  for (const [k, v] of Object.entries(s)) if (!(v >= 0 && v <= 100)) fail(`수치 범위 밖: ${k}`, `${where} ${k}=${v}`);
  if (res.snapshot.netWorth !== null && !Number.isFinite(res.snapshot.netWorth)) fail('순자산이 유한하지 않음', where);
}

function playOne(birthYear: number, seed: number, pickerName: string) {
  const where = `[${birthYear}년생 ${pickerName} #${seed}]`;
  const rnd = lcg(seed * 7919 + birthYear);
  const life = createLife({ seed, birthYear });
  const actions: LifeAction[] = [];
  let res = life.start();
  checkResult(where, life, res);
  let guard = 0;
  while (!res.dead) {
    if (++guard > 400) { fail('끝나지 않음 (동작 400번 넘음)', where); return; }
    // 무작위 플레이어는 가끔 돈 관리 계획을 바꾼다 (되살리기에 { p } 동작이 섞이게)
    if (pickerName === 'random' && life.independent && rnd() < 0.05) {
      const st = Math.floor(rnd() * 6) * 10, gl = Math.floor(rnd() * 4) * 10, cr = Math.floor(rnd() * 3) * 10;
      const plan = { spend: (['frugal', 'normal', 'loose'] as const)[Math.floor(rnd() * 3)], alloc: { deposit: 100 - st - gl - cr, stock: st, global: gl, crypto: cr } };
      const pr = applyAction(life, { p: plan });
      if (!pr) { fail('계획 바꾸기 실패', where); return; }
      actions.push({ p: plan });
      checkResult(where, life, pr);
      const as = pr.snapshot.assets;
      if (as && Math.abs(as.deposit + as.invest.stock + as.invest.global + as.invest.crypto - as.cash) > 2) fail('예금+투자 ≠ 쓸 수 있는 돈', `${where} ${JSON.stringify(as)}`);
    }
    const a: LifeAction = res.choice ? PICKERS[pickerName](life, res, rnd) : 'n';
    const next = applyAction(life, a);
    if (!next) { fail('적용할 수 없는 동작', `${where} ${JSON.stringify(a)}`); return; }
    actions.push(a);
    res = next;
    checkResult(where, life, res);
  }
  if (life.age > 130) fail('130세 넘게 삶', `${where} ${life.age}세`);
  // 되살리기: 같은 동작으로 같은 생이 나와야 한다
  const again = replayLife(seed, birthYear, actions);
  if (again.actions.length !== actions.length) fail('되살리기가 중간에 멈춤', `${where} ${again.actions.length}/${actions.length}`);
  else if (JSON.stringify(again.life.summary()) !== JSON.stringify(life.summary())) fail('되살리기 결과가 다름', where);
}

const seeds = Number(process.argv[2]) || 2;
const t0 = Date.now();
let lives = 0;
for (let by = MIN_BIRTH_YEAR; by <= MAX_BIRTH_YEAR; by++) {
  for (const p of Object.keys(PICKERS)) {
    for (let k = 1; k <= seeds; k++) {
      try {
        playOne(by, by * 100 + k, p);
      } catch (e) {
        fail(`예외: ${(e as Error).message}`, `[${by}년생 ${p} #${k}] ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
      }
      lives++;
    }
  }
}
const sec = ((Date.now() - t0) / 1000).toFixed(1);
if (failures.size) {
  console.log(`✗ ${lives}개 생 중 문제 ${failures.size}종류 (${sec}초)`);
  for (const [kind, f] of failures) console.log(`  ${kind}  ×${f.count}\n      예: ${f.example}`);
  process.exit(1);
}
console.log(`✓ ${lives}개 생 통과 (${sec}초)`);
