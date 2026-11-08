// 게임 문장 재료. 사건을 늘리고 싶으면 여기에 추가하면 된다.
// from/to 는 그 사건이 일어날 수 있는 달력 연도 범위 (예: 삐삐는 1993~1999년)
import type { JobType } from './data';
import type { Life } from './engine';

export type StatKey = 'health' | 'happiness' | 'ability' | 'relation';
export type Effect = Partial<Record<StatKey | 'cash', number>>;
export interface RandomEvent {
  text: string;
  fx: Effect;
  when?: (life: Life) => boolean;
  from?: number;
  to?: number;
}
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
export const RANDOM_EVENTS: Record<Stage, RandomEvent[]> = {
  child: [
    { text: '감기를 달고 살았다.', fx: { health: -2 } },
    { text: '놀이터에서 단짝 친구가 생겼다.', fx: { relation: 4, happiness: 2 } },
    { text: '그림 그리기에 푹 빠졌다.', fx: { happiness: 3 } },
    { text: '할머니 댁에서 한 계절을 보냈다.', fx: { happiness: 2, relation: 2 } },
    { text: '가족이 이사를 했다.', fx: { relation: -1 } },
    { text: '밤마다 그림책을 읽어 달라고 졸랐다.', fx: { ability: 2 } },
    { text: '동네 아이들과 흑백 TV 앞에 모여 만화영화를 봤다.', fx: { happiness: 3, relation: 2 }, to: 1980 },
    { text: '연탄 아궁이 옆에서 겨울을 났다.', fx: { health: -1 }, to: 1990 },
    { text: '골목에서 해 질 때까지 딱지치기를 했다.', fx: { happiness: 3, relation: 2 }, to: 1998 },
    { text: '키즈카페에서 생일 파티를 했다.', fx: { happiness: 3 }, from: 2008 },
    { text: '유튜브로 동요를 들으며 자랐다.', fx: { happiness: 2 }, from: 2012 },
  ],
  elementary: [
    { text: '받아쓰기에서 100점을 받았다.', fx: { ability: 2, happiness: 2 } },
    { text: '반장 선거에 나갔다.', fx: { relation: 3 } },
    { text: '태권도 학원에서 띠를 하나 올렸다.', fx: { health: 2 } },
    { text: '단짝과 크게 싸우고 일주일 동안 말을 안 했다.', fx: { relation: -3 } },
    { text: '수학이 어려워지기 시작했다.', fx: { ability: -1 } },
    { text: '학교 대회에서 상을 받았다.', fx: { ability: 2, happiness: 3 } },
    { text: '팔이 부러져 깁스를 했다.', fx: { health: -3 } },
    { text: '양은 도시락을 난로 위에 올려 데워 먹었다.', fx: { happiness: 2 }, to: 1990 },
    { text: '반공 포스터 그리기 대회에 나갔다.', fx: { ability: 1 }, from: 1965, to: 1987 },
    { text: '오락실에서 몰래 게임을 하다 들켰다.', fx: { happiness: 3, relation: -1 }, from: 1980, to: 1999 },
    { text: '컴퓨터 학원에서 처음 키보드를 만졌다.', fx: { ability: 2 }, from: 1985, to: 2002 },
    { text: '처음으로 휴대폰을 갖게 됐다.', fx: { happiness: 3 }, from: 2004, to: 2009 },
    { text: '처음으로 스마트폰을 갖게 됐다.', fx: { happiness: 3, ability: -1 }, from: 2010 },
    { text: '코로나19로 1년 내내 온라인 수업을 들었다.', fx: { relation: -3, ability: -1 }, from: 2020, to: 2021 },
  ],
  middle: [
    { text: '사춘기가 찾아왔다. 이유 없이 모든 게 짜증스러웠다.', fx: { happiness: -3 } },
    { text: '처음으로 누군가를 좋아하게 됐다.', fx: { happiness: 3, relation: 2 } },
    { text: '시험 기간마다 밤을 새웠다.', fx: { ability: 2, health: -2 } },
    { text: '친구 문제로 학교 가기가 싫었다.', fx: { happiness: -5, relation: -3 } },
    { text: '동아리 활동에서 진짜 친구들을 만났다.', fx: { relation: 4, happiness: 2 } },
    { text: '좋아하는 가수의 카세트테이프를 닳도록 들었다.', fx: { happiness: 4 }, to: 1997 },
    { text: '삐삐를 갖고 싶어 부모님을 졸랐다.', fx: { happiness: 1 }, from: 1993, to: 1999 },
    { text: '좋아하는 아이돌이 생겼다.', fx: { happiness: 4 }, from: 1996 },
    { text: 'PC방에서 게임하느라 성적이 떨어졌다.', fx: { ability: -3, happiness: 3 }, from: 1998 },
    { text: '싸이월드 미니홈피를 꾸미는 데 용돈을 다 썼다.', fx: { happiness: 3 }, from: 2001, to: 2010 },
  ],
  high: [
    { text: '야간 자율학습이 끝나면 밤 10시였다.', fx: { ability: 2, health: -2, happiness: -2 } },
    { text: '모의고사 성적이 크게 올랐다.', fx: { ability: 3, happiness: 3 } },
    { text: '진로 고민으로 잠을 못 이루는 날이 많았다.', fx: { happiness: -3 } },
    { text: '수학여행에서 평생 갈 추억을 만들었다.', fx: { happiness: 4, relation: 3 } },
    { text: '성적 때문에 부모님과 자주 다퉜다.', fx: { happiness: -3, relation: -2 } },
    { text: '교련 시간에 운동장에서 제식 훈련을 받았다.', fx: { health: 1 }, from: 1969, to: 1996 },
  ],
  young: [
    { text: '자취를 시작했다.', fx: { happiness: 2 }, when: (s) => !s.married },
    { text: '연애를 시작했다.', fx: { happiness: 5, relation: 3 }, when: (s) => !s.married },
    { text: '오래 만난 사람과 헤어졌다.', fx: { happiness: -6 }, when: (s) => !s.married },
    { text: '자격증을 하나 땄다.', fx: { ability: 3 } },
    { text: '친구 결혼식에서 축가를 불렀다.', fx: { relation: 3 } },
    { text: '번아웃이 왔다. 아무것도 하기 싫었다.', fx: { happiness: -6, health: -2 } },
    { text: '헬스장에 등록하고 석 달 동안 꾸준히 다녔다.', fx: { health: 4 } },
    { text: '첫 해외여행을 다녀왔다.', fx: { happiness: 5 }, from: 1989 },
    { text: '배낭 하나 메고 유럽을 돌았다.', fx: { happiness: 5, ability: 1 }, from: 1992 },
    { text: '다방에서 친구들과 음악을 신청해 들었다.', fx: { happiness: 3, relation: 2 }, to: 1990 },
    { text: 'PC통신 동호회에서 사람들을 만났다.', fx: { relation: 3 }, from: 1990, to: 2001 },
    { text: '공중전화 앞에 줄을 서서 삐삐 음성을 확인했다.', fx: { happiness: 1 }, from: 1993, to: 1999 },
  ],
  middleAge: [
    { text: '야근이 몇 달째 이어졌다.', fx: { health: -3, happiness: -3 } },
    { text: '오랜만에 동창회에 나갔다.', fx: { relation: 4, happiness: 2 } },
    { text: '부모님이 편찮으셔서 병원을 자주 오갔다.', fx: { happiness: -4 } },
    { text: '주식으로 꽤 손해를 봤다.', fx: { happiness: -4, cash: -800 }, from: 1985 },
    { text: '주식으로 쏠쏠한 수익을 냈다.', fx: { happiness: 4, cash: 900 }, from: 1985 },
    { text: '회사에서 큰 프로젝트를 맡아 해냈다.', fx: { ability: 3, happiness: 3 }, when: (s) => !!s.job && s.job.type !== 'none' },
    { text: '허리 디스크로 한동안 고생했다.', fx: { health: -5 } },
    { text: '주말마다 등산을 다니기 시작했다.', fx: { health: 4, happiness: 2 } },
    { text: '계모임에서 곗돈을 탔다.', fx: { happiness: 3, cash: 500 }, to: 2000 },
    { text: '자식 학원비 대느라 허리가 휘었다.', fx: { happiness: -3, cash: -600 }, when: (s) => s.children.length > 0, from: 1990 },
  ],
  senior: [
    { text: '노안이 와서 돋보기를 맞췄다.', fx: { health: -1 } },
    { text: '등산 모임에 나가기 시작했다.', fx: { health: 3, relation: 3 } },
    { text: '친구의 부고를 들었다.', fx: { happiness: -4 } },
    { text: '무릎 수술을 받았다.', fx: { health: -5 } },
    { text: '처음으로 텃밭을 가꿨다.', fx: { happiness: 3, health: 2 } },
    { text: '자녀가 독립해 집이 조용해졌다.', fx: { happiness: -2 }, when: (s) => s.children.length > 0 },
  ],
  elder: [
    { text: '경로당에 나가기 시작했다.', fx: { relation: 3 } },
    { text: '병원 가는 날이 늘었다.', fx: { health: -3 } },
    { text: '오랜 친구를 먼저 떠나보냈다.', fx: { happiness: -5 } },
    { text: '손주들이 놀러 와 하루 종일 집이 시끌벅적했다.', fx: { happiness: 6 }, when: (s) => !!s.flags.grandchild },
    { text: '혼자 지내는 시간이 길어졌다.', fx: { happiness: -4 }, when: (s) => !s.married },
    { text: '동네 복지관에서 스마트폰 쓰는 법을 배웠다.', fx: { ability: 2, happiness: 2 }, from: 2012 },
    { text: '자식들이 매달 생활비를 보내 주었다.', fx: { happiness: 2 }, when: (s) => s.children.length > 0, to: 2010 },
  ],
};

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
