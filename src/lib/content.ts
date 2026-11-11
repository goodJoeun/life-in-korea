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

// ───────── 성향과 관심 분야 (claude/paths/SKILL.md) ─────────
/** 성향 축. -100~100, 0에서 시작. 양수 쪽 이름 / 음수 쪽 이름 */
export type TraitKey = 'bold' | 'social' | 'diligent' | 'thrift';
export const TRAITS: Record<TraitKey, [string, string]> = {
  bold: ['도전적인', '신중한'],
  social: ['어울리기 좋아하는', '혼자가 편한'],
  diligent: ['성실한', '자유로운'],
  thrift: ['알뜰한', '씀씀이가 큰'],
};
/** 관심 분야. 0에서 시작해 쌓이기만 한다 */
export type InterestKey = 'science' | 'words' | 'art' | 'sport' | 'tech' | 'care' | 'biz' | 'nature';
export const INTERESTS: Record<InterestKey, string> = {
  science: '과학·수학', words: '글·말', art: '예술', sport: '운동', tech: '컴퓨터', care: '사람 돌보기', biz: '장사·돈', nature: '자연·농사',
};
/** 관심 분야에 맞는 장래희망 */
export const INTEREST_DREAMS: Record<InterestKey, Dated[]> = {
  science: ['과학자', '의사', '발명가', ['우주비행사', 1969]],
  words: ['작가', '기자', '아나운서', '선생님'],
  art: ['화가', '가수', '디자이너', ['웹툰 작가', 2008], ['아이돌', 1998]],
  sport: ['운동선수', '축구 선수', '야구 선수', '체육 선생님'],
  tech: [['프로그래머', 1985], ['게임 개발자', 1995], ['로봇 공학자', 1980], '전자제품 기술자'],
  care: ['간호사', '의사', '사회복지사', '수의사', '선생님'],
  biz: ['사장님', '은행원', ['CEO', 1995], '장사꾼'],
  nature: ['농부', '수의사', '동물원 사육사', '산림 공무원'],
};
/** 관심 분야에 맞는 직업 이름 (직업 종류는 그대로 두고 이름만 맞춘다) */
export const INTEREST_TITLES: Record<InterestKey, Partial<Record<JobType, Dated[]>>> = {
  science: { large: ['연구원', ['반도체 엔지니어', 1985], '품질 관리 엔지니어'], public: ['중학교 과학 교사', '기상청 연구원'], sme: ['품질 관리자', '생산 기술자'], professional: ['변리사', '의사'] },
  words: { large: ['홍보 담당자', '전략 기획자'], public: ['고등학교 국어 교사', '행정직 공무원'], sme: ['출판사 편집자', ['콘텐츠 기획자', 2005]], contract: ['학원 강사', ['프리랜서 작가', 1990]], professional: ['변호사'] },
  art: { large: [['제품 디자이너', 1985], '광고 기획자'], public: ['미술 교사'], sme: ['디자이너', ['영상 편집자', 2000]], contract: [['프리랜서 일러스트레이터', 1995], '공방 강사'], self: ['꽃집 사장', '공방 운영자', ['사진관 사장', undefined, 2010]] },
  sport: { public: ['체육 교사', '경찰관', '소방관'], sme: ['스포츠용품 영업 사원'], contract: ['헬스 트레이너', '수영 강사'], self: [['체육관 관장', 1980], ['필라테스 학원 원장', 2010]] },
  tech: { large: [['소프트웨어 개발자', 1990], ['반도체 엔지니어', 1985], ['데이터 분석가', 2012]], public: [['전산직 공무원', 1985]], sme: [['웹 개발자', 1998], ['앱 개발자', 2010], '전자 수리 기사'], contract: [['IT 유지보수 기사', 1995]], self: [['컴퓨터 수리점 사장', 1990], ['온라인 쇼핑몰 운영자', 2005]] },
  care: { public: ['초등학교 교사', '사회복지 공무원', '간호직 공무원'], sme: ['병원 간호사', '사회복지사'], contract: ['요양보호사', '보육교사'], professional: ['의사', '약사'] },
  biz: { large: ['영업 관리자', '재무 담당자', ['종합상사 직원', undefined, 2000]], public: ['세무 공무원'], sme: ['영업 사원', '회계 담당자'], self: ['슈퍼마켓 주인', ['편의점 점주', 1995], ['치킨집 사장', 1985]], professional: ['회계사', '세무사'] },
  nature: { public: ['농촌지도사', '산림 공무원'], sme: ['조경 기사', '농산물 유통업체 직원'], farm: ['과수원 농부', ['비닐하우스 농부', 1975], '축산 농가'], self: [['귀농 농부', 1995], '화원 사장'] },
};
/** 은퇴 뒤 관심 분야를 살린 일 */
export const INTEREST_LATE_JOBS: Record<InterestKey, Dated[]> = {
  science: ['과학관 해설사', '방과 후 과학 강사'], words: ['문화센터 강사', '도서관 사서 보조'], art: ['공방 강사', '문화센터 그림 강사'],
  sport: ['생활체육 지도사', '수영장 안전요원'], tech: [['노인 대상 컴퓨터 강사', 1995], '전자제품 수리 기사'], care: ['요양보호사', '아이 돌보미'],
  biz: ['상가 관리인', '중고 물품 판매'], nature: ['숲 해설가', '조경 관리원'],
};
/** 관심 분야별 자격증 이름 */
export const INTEREST_CERTS: Record<InterestKey, Dated[]> = {
  science: ['위험물산업기사', '품질경영기사'], words: [['한국사능력검정', 2006], '한자능력검정'], art: [['컬러리스트', 2000], '사진기능사'],
  sport: ['생활스포츠지도사', '수상인명구조원'], tech: ['정보처리기사', ['리눅스마스터', 2001]], care: ['사회복지사', '보육교사'],
  biz: [['전산회계', 1990], '주산', ['공인중개사', 1985]], nature: ['조경기능사', '산림기사'],
};
/** 대학 전공 (관심 분야에 맞는 것이 위에 나온다) */
export const MAJORS: Record<InterestKey, string[]> = {
  science: ['물리학과', '기계공학과', '화학공학과'],
  words: ['국어국문학과', '신문방송학과', '법학과'],
  art: ['시각디자인과', '음악과', '산업디자인과'],
  sport: ['체육교육과', '스포츠과학과'],
  tech: ['컴퓨터공학과', '전자공학과'],
  care: ['간호학과', '사회복지학과', '교육학과'],
  biz: ['경영학과', '경제학과', '회계학과'],
  nature: ['농학과', '생명과학과', '환경공학과'],
};

/** 대학원 연구 분야 (관심 분야마다 연도 제한 없는 것이 하나 이상 있어야 한다) */
export const RESEARCH_FIELDS: Record<InterestKey, Dated[]> = {
  science: ['고체물리', '유기화학', '수학', ['신소재', 1985], ['뇌과학', 2000]],
  words: ['한국 근현대사', '국어학', '언론학', '철학'],
  art: ['미술사', '음악 이론', '디자인 이론', ['영상 미학', 1995]],
  sport: ['운동생리학', '스포츠 심리학'],
  tech: ['통신 공학', '제어 공학', ['반도체', 1980], ['컴퓨터 구조', 1985], ['로봇 공학', 1995], ['인공지능', 2012]],
  care: ['교육학', '사회복지 정책', '간호학', '아동 발달'],
  biz: ['경제학', '경영 전략', '재무·금융'],
  nature: ['육종학', '생태학', '수의학', ['기후 변화', 2000]],
};
/** 예체능 종목: name 종목 · pro 그 길로 성공했을 때의 직업 · teach 가르치는 일 */
export interface Talent { name: string; pro: string; teach: string }
export const TALENTS: Record<'art' | 'sport', Talent[]> = {
  art: [
    { name: '피아노', pro: '피아니스트', teach: '피아노 학원 강사' },
    { name: '그림', pro: '화가', teach: '미술 학원 강사' },
    { name: '바이올린', pro: '바이올리니스트', teach: '음악 학원 강사' },
    { name: '무용', pro: '무용수', teach: '무용 학원 강사' },
    { name: '노래', pro: '가수', teach: '보컬 학원 강사' },
  ],
  sport: [
    { name: '축구', pro: '축구 선수', teach: '축구 교실 코치' },
    { name: '야구', pro: '야구 선수', teach: '야구 교실 코치' },
    { name: '수영', pro: '수영 선수', teach: '수영 강사' },
    { name: '태권도', pro: '태권도 선수', teach: '태권도장 사범' },
    { name: '육상', pro: '육상 선수', teach: '체육관 트레이너' },
    { name: '배구', pro: '배구 선수', teach: '방과 후 체육 강사' },
  ],
};
export const SINGING = 4; // TALENTS.art 에서 '노래'의 자리 (기획사 연습생)
/**
 * 고시·전문직 시험. pass 는 역량 60인 사람의 합격 확률 (추정: 응시자 대비 합격률을 바탕으로 한 모형값).
 * 사법시험은 2017년에 폐지됐고 법학전문대학원은 2009년에 문을 열었다. (공식)
 */
export interface Exam {
  name: string; label: string; desc: string; startText: string; title: string;
  from?: number; to?: number; years: number; cost: number; pass: number; auto: number;
  type: 'professional' | 'public'; titles: string[];
}
export const EXAMS: Exam[] = [
  { name: '사법시험', label: '사법시험', desc: '2년쯤 걸린다. 합격하면 법조인', startText: '고시원에 들어가 사법시험 공부를 시작했다.', title: '고시생', to: 2017, years: 2, cost: 1500, pass: 0.07, auto: 2, type: 'professional', titles: ['변호사', '판사', '검사'] },
  { name: '변호사시험', label: '로스쿨에 간다', desc: '3년. 학비가 많이 든다', startText: '법학전문대학원에 입학했다.', title: '로스쿨 학생', from: 2009, years: 3, cost: 4500, pass: 0.5, auto: 2, type: 'professional', titles: ['변호사'] },
  { name: '행정고시', label: '행정고시', desc: '2년쯤 걸린다. 합격하면 5급 공무원', startText: '고시원에 들어가 행정고시 공부를 시작했다.', title: '고시생', years: 2, cost: 1500, pass: 0.07, auto: 2, type: 'public', titles: ['5급 사무관'] },
  { name: '공인회계사 시험', label: '공인회계사 시험', desc: '2년쯤 걸린다', startText: '독서실에 자리를 잡고 공인회계사 시험공부를 시작했다.', title: '수험생', years: 2, cost: 1200, pass: 0.14, auto: 1.5, type: 'professional', titles: ['회계사'] },
];

// 단계별 무작위 사건. 같은 문장은 한 생에 한 번만 나온다.
// 해마다 일어나는 사건과 작은 갈림길은 events.ts 에 있다.
export { DILEMMAS, FAMILY_FORTUNE, LIFE_EVENTS, RANDOM_EVENTS, type Dilemma, type RandomEvent } from './events';

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
