/*
 * 통계 검증용 시뮬레이터
 *   npm run simulate            (1만 명)
 *   npx tsx scripts/simulate.ts 50000
 *
 * 모든 선택을 자동(가중치 랜덤)으로 해서 N명의 인생을 끝까지 돌린 뒤,
 * 게임 속 분포가 실제 통계(오른쪽 '목표')와 비슷한지 보여 줍니다.
 * data.js 나 engine.js 를 고친 뒤 꼭 돌려 보세요.
 */
import { createLife } from '../src/lib/engine';
import { KDATA as D } from '../src/lib/data';
import { won } from '../src/lib/text';

const N = Number(process.argv[2]) || 10000;
const acc = {
  deathAge: { M: [] as number[], F: [] as number[] }, edu: {} as Record<string, number>, eduCount: 0, college: 0,
  jobAt30: {} as Record<string, number>, jobAt30Count: 0, marriedBy50: { M: [0, 0], F: [0, 0] },
  childrenF45: [] as number[], house50: [0, 0], netWorth60: [] as number[], cancer: 0, health: [] as number[],
  firstMarriageAge: { M: [] as number[], F: [] as number[] },
  regions: {} as Record<string, number>, entriesPerLife: [] as number[], choicesPerLife: [] as number[],
};

for (let i = 0; i < N; i++) {
  const life = createLife(i + 1);
  let y = life.start();
  let entries = y.entries.length, choices = 0;
  let marriedAt: number | null = null;
  while (!y.dead) {
    if (y.choice) { y = life.choose(life.autoChoiceIndex()); choices++; entries += y.entries.length; continue; }
    y = life.next();
    entries += y.entries.length;
    const a = life.age;
    if (life.alive && life.married && marriedAt === null) marriedAt = a;
    if (a === 30 && life.alive && life.job) { const t = life.job.type; acc.jobAt30[t] = (acc.jobAt30[t] || 0) + 1; acc.jobAt30Count++; }
    if (a === 50 && life.alive) {
      acc.marriedBy50[life.sex][1]++; if (life.spouse) acc.marriedBy50[life.sex][0]++;
      acc.house50[1]++; if (life.house) acc.house50[0]++;
    }
    if (a === 45 && life.alive && life.sex === 'F') acc.childrenF45.push(life.children.length);
    if (a === 60 && life.alive) acc.netWorth60.push(life.netWorth);
    if (life.alive && a % 10 === 0) acc.health.push(life.stats.health);
  }
  acc.deathAge[life.sex].push(life.age);
  if (life.edu) { acc.edu[life.edu] = (acc.edu[life.edu] || 0) + 1; acc.eduCount++; if (life.edu !== 'highschool') acc.college++; }
  if (life.flags.cancerAge !== undefined) acc.cancer++;
  if (marriedAt !== null) acc.firstMarriageAge[life.sex].push(marriedAt);
  acc.regions[life.region.name] = (acc.regions[life.region.name] || 0) + 1;
  acc.entriesPerLife.push(entries); acc.choicesPerLife.push(choices);
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
const pct = (x: number) => (x * 100).toFixed(1) + '%';
const row = (label: string, got: string | number, target?: string) => console.log(label.padEnd(26, ' '), String(got).padEnd(14, ' '), target ? '목표 ' + target : '');

console.log(`\n=== ${N.toLocaleString()}명 시뮬레이션 ===\n`);
row('기대수명 남', mean(acc.deathAge.M).toFixed(1) + '세', D.mortality.M.e0 + '세');
row('기대수명 여', mean(acc.deathAge.F).toFixed(1) + '세', D.mortality.F.e0 + '세');
row('대학 진학률', pct(acc.college / acc.eduCount), pct(D.collegeEntryRate));
for (const k of Object.keys(D.eduTiers)) row('  ' + D.eduTiers[k as keyof typeof D.eduTiers].label, pct((acc.edu[k] || 0) / acc.eduCount));
console.log('30세 일자리 분포');
for (const [k, v] of Object.entries(acc.jobAt30).sort((a, b) => b[1] - a[1])) row('  ' + (D.jobs[k as keyof typeof D.jobs]?.label || k), pct(v / acc.jobAt30Count));
row('50세까지 결혼 경험 남', pct(acc.marriedBy50.M[0] / acc.marriedBy50.M[1]), pct(1 - D.marriage.neverMarriedAt50.M));
row('50세까지 결혼 경험 여', pct(acc.marriedBy50.F[0] / acc.marriedBy50.F[1]), pct(1 - D.marriage.neverMarriedAt50.F));
row('첫 결혼 나이 중앙값 남', median(acc.firstMarriageAge.M) + '세', '평균 ' + D.marriage.meanFirstAge.M + '세');
row('첫 결혼 나이 중앙값 여', median(acc.firstMarriageAge.F) + '세', '평균 ' + D.marriage.meanFirstAge.F + '세');
row('45세 여성 평균 자녀 수', mean(acc.childrenF45).toFixed(2) + '명', '합계출산율 ' + D.tfr);
row('50세 자가 보유', pct(acc.house50[0] / acc.house50[1]), '가구 ' + pct(D.homeOwnershipRate));
row('60세 순자산 중앙값', won(median(acc.netWorth60)));
row('암 진단 경험', pct(acc.cancer / N), '평생 ' + pct(D.cancerLifetimeRisk));
row('평균 건강 수치', mean(acc.health).toFixed(1), '65 안팎이어야 사망률 보정이 맞음');
row('한 생의 기록 수(평균)', mean(acc.entriesPerLife).toFixed(0) + '줄');
row('한 생의 선택 수(평균)', mean(acc.choicesPerLife).toFixed(1) + '번');
console.log('\n출생 지역 상위 5');
for (const [k, v] of Object.entries(acc.regions).sort((a, b) => b[1] - a[1]).slice(0, 5)) row('  ' + k, pct(v / N));
console.log('');
