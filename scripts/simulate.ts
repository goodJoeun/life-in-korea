/*
 * 통계 검증용 시뮬레이터
 *   npm run simulate                 지금(2026년) 태어난 1만 명
 *   npx tsx scripts/simulate.ts 1975 지정한 해에 태어난 1만 명
 *   npx tsx scripts/simulate.ts all  1960~2026년 코호트를 10년 단위로 한 번에 (각 5천 명)
 *
 * 모든 선택을 자동(가중치 랜덤)으로 해서 인생을 끝까지 돌린 뒤,
 * 게임 속 분포가 그 세대의 실제 통계와 비슷한지 보여 준다.
 * src/lib/timeline.ts, data.ts, engine.ts 를 고친 뒤에 꼭 돌려 보세요.
 */
import { createLife } from '../src/lib/engine';
import { KDATA as D } from '../src/lib/data';
import { won } from '../src/lib/text';
import { maleShare, nationalSexRatio, regionBirthWeights } from '../src/lib/births';
import { at, COLLEGE_RATE, HIGH_SCHOOL_RATE, LIFE_EXPECTANCY, MIDDLE_SCHOOL_RATE, FIRST_MARRIAGE_AGE, CURRENT_YEAR } from '../src/lib/timeline';

function run(birthYear: number, N: number) {
  const acc = {
    death: { M: [] as number[], F: [] as number[] }, edu: {} as Record<string, number>, eduCount: 0,
    middle: [0, 0], high: [0, 0], college: [0, 0],
    jobAt30: {} as Record<string, number>, jobAt30Count: 0,
    married50: { M: [0, 0], F: [0, 0] }, firstMarriage: { M: [] as number[], F: [] as number[] },
    kidsF45: [] as number[], house50: [0, 0], netWorth60: [] as number[], cancer: 0, health: [] as number[],
    regions: {} as Record<string, number>, male: 0, kidSex: [[0, 0], [0, 0], [0, 0]] as number[][], entries: [] as number[], choices: [] as number[],
  };
  for (let i = 0; i < N; i++) {
    const life = createLife({ seed: i + 1 + birthYear * 100000, birthYear });
    let y = life.start();
    let entries = y.entries.length, choices = 0;
    let marriedAt: number | null = null;
    while (!y.dead) {
      if (y.choice) { y = life.choose(life.autoChoiceIndex()); choices++; entries += y.entries.length; continue; }
      y = life.next();
      entries += y.entries.length;
      const a = life.age;
      if (!life.alive) break;
      if (life.married && marriedAt === null) marriedAt = a;
      if (a === 30 && life.job) { acc.jobAt30[life.job.type] = (acc.jobAt30[life.job.type] || 0) + 1; acc.jobAt30Count++; }
      if (a === 50) {
        acc.married50[life.sex][1]++; if (life.spouse) acc.married50[life.sex][0]++;
        acc.house50[1]++; if (life.house) acc.house50[0]++;
      }
      if (a === 45 && life.sex === 'F') acc.kidsF45.push(life.children.length);
      if (a === 60) acc.netWorth60.push(life.netWorth);
      if (a % 10 === 0) acc.health.push(life.stats.health);
      if (a === 25 && life.edu) {
        acc.middle[1]++; if (life.edu !== 'elementary') acc.middle[0]++;
        if (life.edu !== 'elementary') { acc.high[1]++; if (life.edu !== 'middle') acc.high[0]++; }
        if (life.edu !== 'elementary' && life.edu !== 'middle') { acc.college[1]++; if (life.edu !== 'highschool') acc.college[0]++; }
      }
    }
    acc.death[life.sex].push(life.age);
    if (life.edu) { acc.edu[life.edu] = (acc.edu[life.edu] || 0) + 1; acc.eduCount++; }
    if (life.flags.cancerAge !== undefined) acc.cancer++;
    if (marriedAt !== null) acc.firstMarriage[life.sex].push(marriedAt);
    acc.regions[life.region.id] = (acc.regions[life.region.id] || 0) + 1;
    if (life.sex === 'M') acc.male++;
    life.children.forEach((c, k) => { const o = Math.min(k, 2); acc.kidSex[o][c.sex === 'M' ? 0 : 1]++; });
    acc.entries.push(entries); acc.choices.push(choices);
  }
  return acc;
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] ?? 0; };
const pct = (x: number) => (x * 100).toFixed(1) + '%';
const ratio = ([a, b]: number[]) => pct(a / (b || 1));
const row = (label: string, got: string | number, target?: string) => console.log(label.padEnd(24, ' '), String(got).padEnd(16, ' '), target ? '참고 ' + target : '');

function report(birthYear: number, N: number) {
  const acc = run(birthYear, N);
  console.log(`\n=== ${birthYear}년생 ${N.toLocaleString()}명 ===`);
  row('평균 수명 남', mean(acc.death.M).toFixed(1) + '세', `출생 연도 기대수명 ${at(LIFE_EXPECTANCY.M, birthYear).toFixed(1)}세(이후 개선분 미포함)`);
  row('평균 수명 여', mean(acc.death.F).toFixed(1) + '세', `출생 연도 기대수명 ${at(LIFE_EXPECTANCY.F, birthYear).toFixed(1)}세`);
  row('중학교 진학', ratio(acc.middle), pct(at(MIDDLE_SCHOOL_RATE, birthYear + 13)));
  row('고등학교 진학', ratio(acc.high), pct(at(HIGH_SCHOOL_RATE, birthYear + 16)));
  row('대학 진학(고졸자 중)', ratio(acc.college), pct(at(COLLEGE_RATE, birthYear + 19)));
  console.log('최종 학력');
  for (const k of Object.keys(D.eduTiers)) if (acc.edu[k]) row('  ' + D.eduTiers[k as keyof typeof D.eduTiers].label, pct(acc.edu[k] / acc.eduCount));
  console.log('30세 일');
  for (const [k, v] of Object.entries(acc.jobAt30).sort((a, b) => b[1] - a[1])) row('  ' + (D.jobs[k as keyof typeof D.jobs]?.label ?? k), pct(v / acc.jobAt30Count));
  row('50세까지 결혼 남', ratio(acc.married50.M));
  row('50세까지 결혼 여', ratio(acc.married50.F));
  row('첫 결혼 나이 중앙값 남', median(acc.firstMarriage.M) + '세', `그 무렵 평균 초혼 ${at(FIRST_MARRIAGE_AGE.M, birthYear + 30).toFixed(1)}세`);
  row('첫 결혼 나이 중앙값 여', median(acc.firstMarriage.F) + '세', `그 무렵 평균 초혼 ${at(FIRST_MARRIAGE_AGE.F, birthYear + 28).toFixed(1)}세`);
  row('45세 여성 평균 자녀', mean(acc.kidsF45).toFixed(2) + '명');
  row('50세 자가 보유', ratio(acc.house50));
  row('60세 순자산 중앙값', won(median(acc.netWorth60)));
  row('암 진단 경험', pct(acc.cancer / N));
  row('평균 건강 수치', mean(acc.health).toFixed(1));
  row('기록 수 / 선택 수', `${mean(acc.entries).toFixed(0)}줄 / ${mean(acc.choices).toFixed(1)}번`);
  const sr = acc.male / (N - acc.male) * 100;
  row('출생성비(남/여×100)', sr.toFixed(1), `${birthYear}년 공식 ${nationalSexRatio(birthYear).toFixed(1)} (남아 ${pct(maleShare(nationalSexRatio(birthYear)))})`);
  const ks = (o: number) => (acc.kidSex[o][0] / (acc.kidSex[o][1] || 1) * 100).toFixed(0);
  row('자녀 성비 첫/둘/셋째+', `${ks(0)} / ${ks(1)} / ${ks(2)}`, `셋째+ 표본 ${acc.kidSex[2][0] + acc.kidSex[2][1]}명`);
  const w = regionBirthWeights(birthYear);
  const name = (id: string) => D.birthsByRegion.find((x) => x.id === id)?.name ?? id;
  const top = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => `${name(k)} ${pct((acc.regions[k] || 0) / N)}(${pct(v)})`).join(', ');
  row('출생 지역 상위', top, '괄호 안이 실제 비중');
}

const arg = process.argv[2];
if (arg === 'all') {
  for (const y of [1960, 1970, 1980, 1990, 2000, 2010, CURRENT_YEAR]) report(y, 5000);
} else {
  report(Number(arg) || CURRENT_YEAR, Number(process.argv[3]) || 10000);
}
console.log('');
