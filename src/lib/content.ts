// 게임 문장 재료. 사건을 늘리고 싶으면 여기에 추가하면 된다.
import type { JobType } from './data';
import type { Life } from './engine';

export type StatKey = 'health' | 'happiness' | 'ability' | 'relation';
export type Effect = Partial<Record<StatKey | 'cash', number>>;
/** [문장, 효과, 조건(선택)] */
export type RandomEvent = [string, Effect, ((life: Life) => boolean)?];
export type Stage = 'child' | 'elementary' | 'middle' | 'high' | 'young' | 'middleAge' | 'senior' | 'elder';

export const DREAMS = ['운동선수', '의사', '교사', '크리에이터', '경찰관', '요리사', '과학자', '가수', '프로게이머', '웹툰 작가', '간호사', '공무원', '배우', '수의사', '프로그래머', '건축가'];

export const JOB_TITLES: Record<Exclude<JobType, 'none'> | 'late', string[]> = {
  large: ['반도체 엔지니어', '영업 관리자', '마케터', '전략 기획자', '연구원', '재무 담당자', '플랜트 엔지니어'],
  public: ['행정직 공무원', '초등학교 교사', '경찰관', '소방관', '공기업 사무직', '중학교 교사', '세무 공무원'],
  sme: ['생산직 사원', '사무직 사원', '디자이너', '웹 개발자', '영업 사원', '물류 관리자', '품질 관리자'],
  contract: ['물류센터 직원', '콜센터 상담원', '계약직 사무원', '매장 판매원', '배달 기사', '조리 보조', '학원 강사'],
  professional: ['의사', '변호사', '회계사', '약사', '변리사'],
  self: ['치킨집 사장', '카페 사장', '편의점 점주', '온라인 쇼핑몰 운영자', '미용실 원장', '분식집 사장'],
  late: ['아파트 경비원', '건물 청소원', '택배 기사', '요양보호사', '주차 관리원', '마을버스 기사'],
};

export const MILITARY_BASES = ['강원도 화천', '경기도 연천', '강원도 양구', '경기도 파주', '충남 논산', '강원도 인제'];
export const MEETING_PLACES = ['친구 소개로', '회사에서', '동호회에서', '소개팅으로', '앱으로', '대학 동기 모임에서'];
export const CANCERS = ['위암', '대장암', '폐암', '갑상선암', '유방암', '간암', '전립선암'];

// 단계별 무작위 사건. 같은 문장은 한 생에 한 번만 나온다.
export const RANDOM_EVENTS: Record<Stage, RandomEvent[]> = {
  child: [
    ['감기를 달고 살았다.', { health: -2 }],
    ['놀이터에서 단짝 친구가 생겼다.', { relation: 4, happiness: 2 }],
    ['그림 그리기에 푹 빠졌다.', { happiness: 3 }],
    ['할머니 댁에서 한 계절을 보냈다.', { happiness: 2, relation: 2 }],
    ['가족이 이사를 했다.', { relation: -1 }],
    ['밤마다 그림책을 읽어 달라고 졸랐다.', { ability: 2 }],
  ],
  elementary: [
    ['받아쓰기에서 100점을 받았다.', { ability: 2, happiness: 2 }],
    ['반장 선거에 나갔다.', { relation: 3 }],
    ['태권도 학원에서 띠를 하나 올렸다.', { health: 2 }],
    ['처음으로 스마트폰을 갖게 됐다.', { happiness: 3, ability: -1 }],
    ['단짝과 크게 싸우고 일주일 동안 말을 안 했다.', { relation: -3 }],
    ['수학이 어려워지기 시작했다.', { ability: -1 }],
    ['학교 대회에서 상을 받았다.', { ability: 2, happiness: 3 }],
    ['팔이 부러져 깁스를 했다.', { health: -3 }],
  ],
  middle: [
    ['사춘기가 찾아왔다. 이유 없이 모든 게 짜증스러웠다.', { happiness: -3 }],
    ['게임에 빠져 성적이 떨어졌다.', { ability: -3, happiness: 3 }],
    ['좋아하는 아이돌이 생겼다.', { happiness: 4 }],
    ['처음으로 누군가를 좋아하게 됐다.', { happiness: 3, relation: 2 }],
    ['시험 기간마다 밤을 새웠다.', { ability: 2, health: -2 }],
    ['친구 문제로 학교 가기가 싫었다.', { happiness: -5, relation: -3 }],
    ['동아리 활동에서 진짜 친구들을 만났다.', { relation: 4, happiness: 2 }],
  ],
  high: [
    ['야간 자율학습이 끝나면 밤 10시였다.', { ability: 2, health: -2, happiness: -2 }],
    ['모의고사 성적이 크게 올랐다.', { ability: 3, happiness: 3 }],
    ['진로 고민으로 잠을 못 이루는 날이 많았다.', { happiness: -3 }],
    ['수학여행에서 평생 갈 추억을 만들었다.', { happiness: 4, relation: 3 }],
    ['성적 때문에 부모님과 자주 다퉜다.', { happiness: -3, relation: -2 }],
  ],
  young: [
    ['첫 해외여행을 다녀왔다.', { happiness: 5 }],
    ['자취를 시작했다.', { happiness: 2 }],
    ['연애를 시작했다.', { happiness: 5, relation: 3 }],
    ['오래 만난 사람과 헤어졌다.', { happiness: -6 }],
    ['자격증을 하나 땄다.', { ability: 3 }],
    ['친구 결혼식에서 축가를 불렀다.', { relation: 3 }],
    ['번아웃이 왔다. 아무것도 하기 싫었다.', { happiness: -6, health: -2 }],
    ['헬스장에 등록하고 석 달 동안 꾸준히 다녔다.', { health: 4 }],
  ],
  middleAge: [
    ['야근이 몇 달째 이어졌다.', { health: -3, happiness: -3 }],
    ['오랜만에 동창회에 나갔다.', { relation: 4, happiness: 2 }],
    ['부모님이 편찮으셔서 병원을 자주 오갔다.', { happiness: -4 }],
    ['주식으로 꽤 손해를 봤다.', { happiness: -4, cash: -800 }],
    ['주식으로 쏠쏠한 수익을 냈다.', { happiness: 4, cash: 900 }],
    ['회사에서 큰 프로젝트를 맡아 해냈다.', { ability: 3, happiness: 3 }, (s) => !!s.job && s.job.type !== 'none'],
    ['허리 디스크로 한동안 고생했다.', { health: -5 }],
    ['주말마다 등산을 다니기 시작했다.', { health: 4, happiness: 2 }],
  ],
  senior: [
    ['노안이 와서 돋보기를 맞췄다.', { health: -1 }],
    ['등산 모임에 나가기 시작했다.', { health: 3, relation: 3 }],
    ['친구의 부고를 들었다.', { happiness: -4 }],
    ['무릎 수술을 받았다.', { health: -5 }],
    ['처음으로 텃밭을 가꿨다.', { happiness: 3, health: 2 }],
    ['자녀가 독립해 집이 조용해졌다.', { happiness: -2 }, (s) => s.children.length > 0],
  ],
  elder: [
    ['경로당에 나가기 시작했다.', { relation: 3 }],
    ['병원 가는 날이 늘었다.', { health: -3 }],
    ['오랜 친구를 먼저 떠나보냈다.', { happiness: -5 }],
    ['손주들이 놀러 와 하루 종일 집이 시끌벅적했다.', { happiness: 6 }, (s) => !!s.flags.grandchild],
    ['혼자 지내는 시간이 길어졌다.', { happiness: -4 }, (s) => !s.married],
    ['동네 복지관에서 스마트폰 쓰는 법을 배웠다.', { ability: 2, happiness: 2 }],
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
