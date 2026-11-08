// 게임 문장 재료. 사건을 늘리고 싶으면 여기에 추가하면 된다.
// from/to 는 그 사건이 일어날 수 있는 달력 연도 범위 (예: 삐삐는 1993~1999년)
import type { JobType } from './data';
import type { Life } from './engine';

export type StatKey = 'health' | 'happiness' | 'ability' | 'relation';
export type Effect = Partial<Record<StatKey | 'cash', number>>;
export type Stage = 'child' | 'elementary' | 'middle' | 'high' | 'young' | 'middleAge' | 'senior' | 'elder';
/** 연도 제한이 있는 문장: [문장, 시작 연도, 끝 연도] */
export type Dated = string | [string, number?, number?];

export function availableIn(items: Dated[], year: number): string[] {
  return items
    .filter((x) => typeof x === 'string' || ((x[1] ?? -Infinity) <= year && year <= (x[2] ?? Infinity)))
    .map((x) => (typeof x === 'string' ? x : x[0]));
}

export const DREAMS: Dated[] = [
  '운동선수', '의사', '교사', '경찰관', '요리사', '과학자', '가수', '간호사', '공무원', '배우', '수의사', '건축가',
  ['대통령', undefined, 1995], ['군인', undefined, 1995], ['판사', undefined, 2005], ['조종사', undefined, 2005],
  ['프로그래머', 1985], ['프로게이머', 2000], ['크리에이터', 2015], ['웹툰 작가', 2008], ['아이돌', 1998],
];

export const JOB_TITLES: Record<Exclude<JobType, 'none'> | 'late', Dated[]> = {
  large: ['영업 관리자', '전략 기획자', '연구원', '재무 담당자', ['반도체 엔지니어', 1985], ['마케터', 1990], ['플랜트 엔지니어', 1975], ['종합상사 직원', undefined, 2000], ['조선소 설계 엔지니어', 1975]],
  public: ['행정직 공무원', '초등학교 교사', '경찰관', '소방관', '중학교 교사', '세무 공무원', ['공기업 사무직', 1980], ['우체국 집배원', undefined, 2010]],
  sme: ['생산직 사원', '사무직 사원', '영업 사원', '품질 관리자', ['디자이너', 1985], ['웹 개발자', 1998], ['물류 관리자', 1990], ['봉제 공장 직원', undefined, 1995], ['타자수', undefined, 1992]],
  contract: ['매장 판매원', '조리 보조', '학원 강사', ['물류센터 직원', 2000], ['콜센터 상담원', 1995], ['계약직 사무원', 1998], ['배달 기사', 2012], ['버스 안내양', undefined, 1988], ['공사장 인부', undefined]],
  professional: ['의사', '변호사', '회계사', '약사', '변리사'],
  self: ['분식집 사장', '미용실 원장', '슈퍼마켓 주인', ['치킨집 사장', 1985], ['카페 사장', 2000], ['편의점 점주', 1995], ['온라인 쇼핑몰 운영자', 2005], ['비디오 가게 사장', 1985, 2005], ['구멍가게 주인', undefined, 1995]],
  farm: ['벼농사를 짓는 농부', '과수원 농부', '어부', '축산 농가', ['비닐하우스 농부', 1975]],
  late: ['아파트 경비원', '건물 청소원', '요양보호사', '주차 관리원', ['택배 기사', 2000], ['마을버스 기사', 1990], ['노인 일자리 공공근로', 2004]],
};

export const MILITARY_BASES = ['강원도 화천', '경기도 연천', '강원도 양구', '경기도 파주', '충남 논산', '강원도 인제', '강원도 철원'];
export const MEETING_PLACES: Dated[] = [
  '친구 소개로', '회사에서', '동호회에서', '소개팅으로',
  ['중매로', undefined, 2000], ['맞선을 봐서', undefined, 2005], ['PC통신 채팅으로', 1992, 2002], ['앱으로', 2013], ['대학 동기 모임에서', 1985],
];
export const CANCERS = ['위암', '대장암', '폐암', '갑상선암', '유방암', '간암', '전립선암'];

// 단계별 무작위 사건. 같은 문장은 한 생에 한 번만 나온다.
// 해마다 일어나는 사건과 작은 갈림길은 events.ts 에 있다.
export { DILEMMAS, LIFE_EVENTS, RANDOM_EVENTS, type Dilemma, type RandomEvent } from './events';

export function stageOf(age: number): Stage {
  if (age <= 6) return 'child';
  if (age <= 12) return 'elementary';
  if (age <= 15) return 'middle';
  if (age <= 18) return 'high';
  if (age <= 29) return 'young';
  if (age <= 54) return 'middleAge';
  if (age <= 69) return 'senior';
  return 'elder';
}
