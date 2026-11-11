/*
 * 내 돈 쓰기: 독립한 뒤 모은 돈으로 스스로 고르는 일들 (claude/spend/SKILL.md).
 * 갈림길과 달리 플레이어가 원할 때 고른다. 한 가지는 한 해에 한 번, 모두 합쳐 한 해에 SPEND_PER_YEAR 번까지.
 *
 * cost 는 2024년 가치 만원. 실제로 드는 돈은 그해 실질임금 지수를 곱한다(엔진의 spendCost).
 * fx 의 수치는 이미 높은 수치일수록 덜 오른다(엔진의 spendOn). 돈(cash)은 fx 에 넣지 않는다.
 * 시대가 있는 문장에는 [문장, 시작 연도, 끝 연도] 를 붙인다.
 */
import type { Dated, StatKey } from './content';
import type { Life } from './engine';

export type SpendGroup = 'health' | 'travel' | 'grow' | 'people';
export const SPEND_GROUPS: Record<SpendGroup, string> = { health: '건강', travel: '여행', grow: '배움·취미', people: '사람' };
/** 한 해에 할 수 있는 횟수 */
export const SPEND_PER_YEAR = 3;

export interface SpendItem {
  id: string;
  group: SpendGroup;
  label: string;
  desc: string;
  /** 2024년 가치 만원 */
  cost: number;
  fx: Partial<Record<StatKey, number>>;
  texts: Dated[];
  /** 달력 연도 */
  from?: number; to?: number;
  ages?: [number, number];
  when?: (l: Life) => boolean;
  then?: (l: Life) => void;
}

/** 코로나19로 하늘길이 막힌 해 */
const bordersOpen = (l: Life) => l.year !== 2020 && l.year !== 2021;

export const SPENDS: SpendItem[] = [
  // ───────── 건강 ─────────
  {
    // (추정) 큰 병원에 종합검진 센터가 자리 잡은 때를 1980년 무렵으로 본다
    id: 'checkup', group: 'health', label: '종합 건강검진을 받는다', desc: '큰 병을 일찍 찾을 수 있다', cost: 40, from: 1980, ages: [30, 120],
    fx: { health: 2 },
    texts: [
      '큰 병원에서 종합 건강검진을 받았다. 결과지를 한참 들여다봤다.',
      '건강검진을 받았다. 의사는 술을 줄이라고 했다.',
      ['수면 내시경까지 넣어 건강검진을 받았다. 깨어 보니 다 끝나 있었다.', 2000],
    ],
    then: (l) => { l.flags.checkup = l.age; },
  },
  {
    id: 'gym-old', group: 'health', label: '체육관에 다닌다', desc: '한 해 동안 꾸준히', cost: 50, to: 1989,
    fx: { health: 2.5, happiness: 1 },
    texts: [
      '동네 체육관에 등록해 저녁마다 땀을 흘렸다.',
      '새벽마다 수영장에 다녔다. 물에서 나오면 하루가 가벼웠다.',
      ['에어로빅 교실에 등록했다. 음악에 맞춰 뛰다 보면 한 시간이 금방 갔다.', 1982],
    ],
  },
  {
    id: 'gym', group: 'health', label: '헬스장에 다닌다', desc: '한 해 동안 꾸준히', cost: 80, from: 1990,
    fx: { health: 2.5, happiness: 1 },
    texts: [
      '헬스장 1년 회원권을 끊었다. 이번에는 빠지지 않고 다녔다.',
      '수영장 새벽반에 등록했다. 물에서 나오면 하루가 가벼웠다.',
      ['요가원에 다녔다. 숨 쉬는 법부터 다시 배웠다.', 2003],
      ['필라테스 수업을 끊었다. 안 쓰던 근육이 며칠을 쑤셨다.', 2010],
    ],
  },
  {
    id: 'tonic', group: 'health', label: '보약을 지어 먹는다', desc: '몸을 챙긴다', cost: 60,
    fx: { health: 1.2 },
    texts: [
      '한의원에서 보약을 한 재 지어 먹었다. 쓴맛에 얼굴을 찡그렸다.',
      ['홍삼과 영양제를 챙겨 먹기 시작했다. 식탁 한쪽에 약통이 늘었다.', 1995],
    ],
  },

  // ───────── 여행 ─────────
  {
    id: 'trip', group: 'travel', label: '국내 여행을 간다', desc: '며칠 쉬다 온다', cost: 60,
    fx: { happiness: 4, relation: 1 },
    texts: [
      '동해 바다를 보러 갔다. 새벽에 일어나 해 뜨는 것을 봤다.',
      '경주로 여행을 갔다. 불국사와 석굴암을 천천히 둘러봤다.',
      '온천으로 여행을 갔다. 뜨거운 물에 몸을 담그니 피로가 풀렸다.',
      ['제주도로 여행을 갔다. 비행기 창밖으로 한라산이 보였다.', 1975],
      ['기차를 타고 부산에 다녀왔다. 자갈치시장에서 회를 먹었다.', undefined, 2003],
      ['KTX를 타고 부산에 다녀왔다. 자갈치시장에서 회를 먹었다.', 2004],
    ],
  },
  {
    // (공식) 해외여행 전면 자유화: 1989년 1월 1일
    id: 'abroad', group: 'travel', label: '해외여행을 간다', desc: '낯선 나라를 본다', cost: 300, from: 1989, when: bordersOpen,
    fx: { happiness: 7, ability: 1 },
    texts: [
      '일본으로 여행을 다녀왔다. 낯선 간판들 사이를 종일 걸었다.',
      '동남아 패키지여행을 다녀왔다. 가이드의 깃발을 따라 사흘을 다녔다.',
      ['유럽 여행을 다녀왔다. 사진으로만 보던 거리를 걸었다.', 1993],
      ['저비용 항공을 타고 다낭에 다녀왔다. 바닷가에서 아무것도 하지 않았다.', 2015],
    ],
    then: (l) => {
      if (!l.flags.passport) { l.flags.passport = true; l.note('여권에 첫 도장이 찍혔다.'); }
    },
  },
  {
    id: 'voyage', group: 'travel', label: '긴 여행을 떠난다', desc: '한 달쯤 멀리 다녀온다', cost: 1200, from: 1995,
    fx: { happiness: 10, ability: 2, health: -1 },
    texts: [
      ['한 달 동안 유럽을 돌았다. 돌아와서도 한동안 그 거리들이 눈에 밟혔다.', 1995, 2019],
      ['한 달 동안 유럽을 돌았다. 돌아와서도 한동안 그 거리들이 눈에 밟혔다.', 2022],
      ['크루즈를 타고 지중해를 돌았다. 매일 아침 다른 항구에서 눈을 떴다.', 2005, 2019],
      ['남미까지 다녀왔다. 소금사막에서 쏟아지는 별을 봤다.', 2008, 2019],
      ['남미까지 다녀왔다. 소금사막에서 쏟아지는 별을 봤다.', 2022],
      ['제주에서 한 달을 살았다. 날마다 다른 오름에 올랐다.', 2015],
      ['지리산 자락에서 한 달을 지냈다. 아침마다 산길을 걸었다.', 1995, 2014],
      ['강원도 바닷가 마을에서 한 달을 지냈다. 파도 소리에 잠들었다.', 2020, 2021],
    ],
  },

  // ───────── 배움·취미 ─────────
  {
    id: 'class', group: 'grow', label: '취미를 배운다', desc: '일과 상관없는 것을 해 본다', cost: 50,
    fx: { happiness: 3, relation: 1 },
    texts: [
      '서예 학원에 다녔다. 먹 가는 소리가 좋았다.',
      '기타를 배웠다. 손끝에 굳은살이 생겼다.',
      '사진기를 사서 주말마다 사진을 찍으러 다녔다.',
      ['문화센터에서 수채화를 배웠다. 물 조절이 가장 어려웠다.', 1985],
      ['주말마다 산악회를 따라 산에 올랐다. 장비 값이 꽤 들었다.', 1990],
      ['공방에서 도자기를 빚었다. 삐뚤어진 그릇이 마음에 들었다.', 2012],
    ],
  },
  {
    id: 'study', group: 'grow', label: '자기계발에 돈을 쓴다', desc: '학원, 자격증, 책', cost: 120, ages: [19, 64],
    fx: { ability: 2, happiness: -1 },
    texts: [
      '저녁마다 영어 학원에 다녔다. 졸음과 싸우며 받아 적었다.',
      '자격증 학원에 등록했다. 주말이 통째로 사라졌다.',
      ['컴퓨터 학원에 다녔다. 자판을 보지 않고 치는 연습부터 했다.', 1988, 2005],
      ['온라인 강의를 결제해 밤마다 들었다.', 2010],
    ],
  },
  {
    id: 'culture', group: 'grow', label: '공연과 영화를 보러 다닌다', desc: '가볍게 기분을 바꾼다', cost: 20,
    fx: { happiness: 2 },
    texts: [
      '극장에서 영화를 봤다. 불이 켜질 때까지 자리에 앉아 있었다.',
      ['야구장에 가서 목청껏 응원했다.', 1982],
      ['좋아하는 가수의 콘서트에 갔다. 목이 쉬도록 따라 불렀다.', 1985],
      ['뮤지컬을 보러 갔다. 표값이 아깝지 않았다.', 2001],
    ],
  },
  {
    id: 'splurge', group: 'grow', label: '갖고 싶던 것을 산다', desc: '오래 벼르던 물건', cost: 200,
    fx: { happiness: 4 },
    texts: [
      '오래 벼르던 시계를 샀다. 한동안 소매를 걷고 다녔다.',
      ['컬러 텔레비전을 들였다. 온 식구가 그 앞에 모였다.', 1980, 1990],
      ['전축을 들여놓았다. 밤마다 음반을 한 장씩 들었다.', undefined, 1992],
      ['명품 가방을 샀다. 상자째로 한참 바라봤다.', 1995],
      ['큰 화면 텔레비전으로 바꿨다. 거실이 달라 보였다.', 2005],
    ],
    then: (l) => { l.traits.thrift = Math.max(-100, l.traits.thrift - 3); },
  },

  // ───────── 사람 ─────────
  {
    id: 'parents', group: 'people', label: '부모님께 효도한다', desc: '용돈과 선물', cost: 100, when: (l) => !l.flags.parentsGone,
    fx: { relation: 3, happiness: 2 },
    texts: [
      '부모님께 용돈을 넉넉히 드렸다. 한사코 사양하시다 받으셨다.',
      '부모님을 모시고 온천에 다녀왔다.',
      ['부모님 댁 텔레비전을 새것으로 바꿔 드렸다.', 1980],
      ['부모님을 모시고 제주도에 다녀왔다. 사진을 많이 찍어 드렸다.', 1985],
      ['부모님 댁에 안마의자를 놓아 드렸다.', 2010],
    ],
  },
  {
    id: 'treat', group: 'people', label: '주변 사람들에게 한턱낸다', desc: '밥을 사고 선물을 돌린다', cost: 30,
    fx: { relation: 3, happiness: 1 },
    texts: [
      '친구들을 불러 저녁을 샀다. 계산서를 먼저 집었다.',
      '오랜만에 옛 친구들을 만나 밥을 샀다.',
      '신세 진 사람들에게 선물을 돌렸다.',
    ],
  },
  {
    id: 'family', group: 'people', label: '가족과 나들이를 간다', desc: '함께 시간을 보낸다', cost: 50, when: (l) => l.married || l.children.length > 0,
    fx: { happiness: 3, relation: 2 },
    texts: [
      '온 가족이 갈빗집에서 외식을 했다.',
      '가족사진을 찍으러 사진관에 갔다.',
      ['가족과 놀이공원에 갔다. 줄 서는 시간이 더 길었다.', 1976],
      ['가족과 캠핑을 갔다. 텐트 치는 데만 한 시간이 걸렸다.', 2010],
    ],
  },
  {
    id: 'donate', group: 'people', label: '기부한다', desc: '어려운 이웃을 돕는다', cost: 100,
    fx: { happiness: 3, relation: 1 },
    texts: [
      '연말에 이웃 돕기 성금을 냈다.',
      '동네 복지관에 쌀을 보냈다.',
      ['어린이 후원 단체에 정기 후원을 시작했다. 가끔 편지가 왔다.', 1995],
    ],
  },
];
