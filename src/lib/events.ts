/*
 * 해마다 일어나는 작은 사건과 갈림길.
 *
 * RANDOM_EVENTS  나이대(stage)별 사건. 한 번 일어난 사건은 같은 생에서 다시 나오지 않는다.
 * LIFE_EVENTS    어른(19세~)이면 나이대와 상관없이 나올 수 있는 사건. 결혼·자녀·일 같은 형편에 따라 고른다.
 * DILEMMAS       가끔 나오는 작은 갈림길. 고른 뒤 결과는 확률을 따른다.
 *
 * 필드: ages [최소, 최대] 나이 · from/to 달력 연도 · born [최소, 최대] 출생연도(세대) · when 형편 조건
 *       fx 수치 변화 (cash 는 만원, 2024년 가치)
 * 문장은 과거형 일기체로 담담하게. 시대가 있는 문장에는 from/to 를, 세대가 있는 문장에는 born 을 꼭 붙인다.
 * (예: 노년에 스마트폰을 처음 배우는 건 1965년생 이전 세대. claude/realism/SKILL.md)
 */
import type { Effect, Stage } from './content';
import type { Life } from './engine';

export interface RandomEvent {
  text: string;
  fx: Effect;
  when?: (life: Life) => boolean;
  ages?: [number, number];
  from?: number;
  to?: number;
  /** 이 출생연도 사이에 태어난 사람에게만 (세대가 있는 문장) */
  born?: [number, number];
}

/** 갈림길의 결과 하나: [확률 가중치, 문장, 변화] */
export type Outcome = [number, string, Effect];
export interface DilemmaOption {
  label: string;
  desc?: string;
  /** '운에 맡기기'일 때 이 선택지를 고를 가중치 */
  auto: number;
  outcomes: Outcome[];
}
export interface Dilemma {
  prompt: string;
  options: DilemmaOption[];
  when?: (life: Life) => boolean;
  ages: [number, number];
  from?: number;
  to?: number;
  born?: [number, number];
}

// ───────── 형편 조건 ─────────
const childAged = (min: number, max: number) => (s: Life) => s.children.some((c) => s.age - c.bornAge >= min && s.age - c.bornAge <= max);
const single = (s: Life) => !s.married;
const wed = (s: Life) => s.married && !!s.spouse?.alive;
const working = (s: Life) => !!s.job && s.job.type !== 'none';
const office = (s: Life) => !!s.job && ['large', 'public', 'sme', 'professional'].includes(s.job.type);
const selfEmployed = (s: Life) => s.job?.type === 'self';
const farming = (s: Life) => s.job?.type === 'farm';
const inCollege = (s: Life) => s.flags.collegeStart !== undefined && s.flags.gradAge !== undefined && s.age >= s.flags.collegeStart && s.age < s.flags.gradAge;
const wellOff = (s: Life) => s.quintile >= 4;
const hard = (s: Life) => s.quintile <= 2;
const rural = (s: Life) => s.residence.group === 'province';
const city = (s: Life) => s.residence.group !== 'province';
const parentsAlive = (s: Life) => !s.flags.parentsGone;
const renter = (s: Life) => !s.house && s.independent;
const male = (s: Life) => s.sex === 'M';
const and = (...fs: ((s: Life) => boolean)[]) => (s: Life) => fs.every((f) => f(s));

export const RANDOM_EVENTS: Record<Stage, RandomEvent[]> = {
  // ───────── 0~6세 ─────────
  child: [
    { text: '감기를 달고 살았다.', fx: { health: -2 } },
    { text: '놀이터에서 단짝 친구가 생겼다.', fx: { relation: 4, happiness: 2 }, ages: [3, 6] },
    { text: '그림 그리기에 푹 빠졌다.', fx: { happiness: 3 }, ages: [3, 6] },
    { text: '할머니 댁에서 한 계절을 보냈다.', fx: { happiness: 2, relation: 2 }, ages: [2, 6] },
    { text: '가족이 이사를 했다.', fx: { relation: -1 } },
    { text: '밤마다 그림책을 읽어 달라고 졸랐다.', fx: { ability: 2 }, ages: [2, 6] },
    { text: '첫 단어로 "엄마"라고 말했다.', fx: { happiness: 2, relation: 2 }, ages: [1, 1] },
    { text: '밤새 열이 올라 부모님이 업고 병원으로 뛰었다.', fx: { health: -3, relation: 2 }, ages: [1, 4] },
    { text: '동네 개를 보고 울음을 터뜨렸다.', fx: { happiness: -1 }, ages: [2, 4] },
    { text: '숫자를 백까지 셀 수 있게 됐다.', fx: { ability: 3 }, ages: [4, 6] },
    { text: '한글을 혼자 깨쳤다.', fx: { ability: 3, happiness: 2 }, ages: [4, 6] },
    { text: '세발자전거를 선물 받았다.', fx: { happiness: 3, health: 1 }, ages: [2, 5] },
    { text: '두발자전거를 처음 탔다. 무릎이 성할 날이 없었다.', fx: { health: 1, happiness: 3 }, ages: [5, 6] },
    { text: '이가 처음 빠졌다. 지붕 위로 던졌다.', fx: { happiness: 2 }, ages: [6, 6], to: 2000 },
    { text: '이가 처음 빠졌다. 베개 밑에 넣고 잤다.', fx: { happiness: 2 }, ages: [6, 6], from: 2001 },
    { text: '동생이 태어나 사랑을 나눠야 했다.', fx: { happiness: -2, relation: 2 }, ages: [2, 6] },
    { text: '수두를 앓았다.', fx: { health: -2 }, ages: [2, 6] },
    { text: '명절에 친척 어른들께 세배하고 용돈을 받았다.', fx: { happiness: 3, relation: 1 }, ages: [3, 6] },
    { text: '시장에서 엄마 손을 놓쳐 한참을 울었다.', fx: { happiness: -2 }, ages: [3, 6] },
    { text: '바다를 처음 봤다.', fx: { happiness: 4 }, ages: [3, 6] },
    { text: '동네 아이들과 흑백 TV 앞에 모여 만화영화를 봤다.', fx: { happiness: 3, relation: 2 }, to: 1980 },
    { text: '집에 처음으로 컬러 TV가 들어왔다.', fx: { happiness: 3 }, from: 1981, to: 1988 },
    { text: '연탄 아궁이 옆에서 겨울을 났다.', fx: { health: -1 }, to: 1990 },
    { text: '골목에서 해 질 때까지 딱지치기를 했다.', fx: { happiness: 3, relation: 2 }, to: 1998, ages: [4, 6] },
    { text: '동네 공터에서 고무줄놀이를 하며 놀았다.', fx: { happiness: 3, relation: 2 }, to: 1995, ages: [4, 6] },
    { text: '뻥튀기 아저씨가 오는 날만 기다렸다.', fx: { happiness: 2 }, to: 1990 },
    { text: '불량식품을 사 먹다 배탈이 났다.', fx: { health: -1, happiness: 1 }, to: 2000, ages: [4, 6] },
    { text: '유치원 재롱잔치에서 춤을 췄다.', fx: { happiness: 3, relation: 1 }, from: 1985, ages: [5, 6] },
    { text: '비디오테이프가 늘어지도록 만화를 돌려 봤다.', fx: { happiness: 3 }, from: 1986, to: 2004 },
    { text: '키즈카페에서 생일 파티를 했다.', fx: { happiness: 3 }, from: 2008, ages: [3, 6] },
    { text: '유튜브로 동요를 들으며 자랐다.', fx: { happiness: 2 }, from: 2012 },
    { text: '마스크를 쓰고 어린이집에 다녔다.', fx: { relation: -1 }, from: 2020, to: 2022 },
    { text: '태블릿으로 그림을 그리며 놀았다.', fx: { happiness: 2 }, from: 2014 },
  ],

  // ───────── 7~12세 ─────────
  elementary: [
    { text: '받아쓰기에서 100점을 받았다.', fx: { ability: 2, happiness: 2 }, ages: [7, 8] },
    { text: '반장 선거에 나갔다.', fx: { relation: 3 } },
    { text: '태권도 학원에서 띠를 하나 올렸다.', fx: { health: 2 } },
    { text: '단짝과 크게 싸우고 일주일 동안 말을 안 했다.', fx: { relation: -3 } },
    { text: '수학이 어려워지기 시작했다.', fx: { ability: -1 }, ages: [9, 12] },
    { text: '학교 대회에서 상을 받았다.', fx: { ability: 2, happiness: 3 } },
    { text: '팔이 부러져 깁스를 했다.', fx: { health: -3 } },
    { text: '구구단을 다 외웠다.', fx: { ability: 2 }, ages: [7, 9] },
    { text: '운동회 날 이어달리기 대표로 뛰었다.', fx: { health: 2, happiness: 3, relation: 2 } },
    { text: '운동회 날 넘어져 꼴찌를 했다.', fx: { happiness: -2 } },
    { text: '소풍날 아침, 김밥을 싸 주시는 걸 옆에서 집어 먹었다.', fx: { happiness: 3, relation: 1 } },
    { text: '방학 숙제를 개학 전날 몰아서 했다.', fx: { happiness: -1 } },
    { text: '방학 일기를 날씨까지 지어내서 썼다.', fx: { ability: -1, happiness: 1 } },
    { text: '학교 앞 문방구에서 뽑기를 했다.', fx: { happiness: 2 } },
    { text: '전학을 가서 낯선 반에 들어갔다.', fx: { relation: -3, happiness: -2 } },
    { text: '전학 온 친구와 금방 친해졌다.', fx: { relation: 3 } },
    { text: '과학 상자로 무언가를 만들어 상을 받았다.', fx: { ability: 3 }, ages: [9, 12] },
    { text: '도서관에서 위인전 전집을 다 읽었다.', fx: { ability: 3 } },
    { text: '피아노 학원에 다녔다. 체르니 30번에서 그만뒀다.', fx: { ability: 1, happiness: -1 }, when: (s) => s.quintile >= 3 },
    { text: '집안일을 돕고 처음으로 용돈을 받았다.', fx: { happiness: 2, ability: 1 } },
    { text: '동생을 돌보느라 놀 시간이 없었다.', fx: { relation: 2, happiness: -2 }, when: hard },
    { text: '선생님께 칭찬을 듣고 하루 종일 들떴다.', fx: { happiness: 3 } },
    { text: '시력이 나빠져 안경을 쓰기 시작했다.', fx: { health: -1 }, ages: [8, 12] },
    { text: '키가 반에서 제일 작아 앞자리에 앉았다.', fx: { happiness: -1 } },
    { text: '보이스카우트·걸스카우트 야영에 다녀왔다.', fx: { relation: 2, health: 1 }, from: 1975, when: (s) => s.quintile >= 3 },
    { text: '친척 형의 헌 교과서를 물려받아 썼다.', fx: { relation: 1 }, to: 1995, when: hard },
    { text: '양은 도시락을 난로 위에 올려 데워 먹었다.', fx: { happiness: 2 }, to: 1990 },
    { text: '혼분식 검사 날, 도시락 뚜껑을 열고 보리밥을 보여 줬다.', fx: { happiness: -1 }, from: 1963, to: 1977 },
    { text: '쥐잡기 운동 숙제로 쥐꼬리를 가져갔다.', fx: { happiness: -1 }, from: 1965, to: 1975 },
    { text: '채변 봉투를 학교에 냈다.', fx: { happiness: -1 }, to: 1990 },
    { text: '반공 포스터 그리기 대회에 나갔다.', fx: { ability: 1 }, from: 1965, to: 1987 },
    { text: '국군 아저씨께 위문편지를 썼다.', fx: { relation: 1 }, to: 1995 },
    { text: '불주사를 맞고 울지 않으려고 이를 악물었다.', fx: { health: 1 }, to: 1985, ages: [7, 9] },
    { text: '오락실에서 몰래 게임을 하다 들켰다.', fx: { happiness: 3, relation: -1 }, from: 1980, to: 1999 },
    { text: '집에 전화기가 처음 놓였다.', fx: { happiness: 2 }, from: 1975, to: 1987 },
    { text: '컴퓨터 학원에서 처음 키보드를 만졌다.', fx: { ability: 2 }, from: 1985, to: 2002 },
    { text: '다마고치를 키우다 수업 시간에 압수당했다.', fx: { happiness: 2 }, from: 1997, to: 1999 },
    { text: '포켓몬 스티커를 모으려고 빵을 사 먹었다.', fx: { happiness: 3 }, from: 1999, to: 2001 },
    { text: '스타크래프트를 하느라 밤을 샜다.', fx: { happiness: 3, ability: -1 }, from: 1998, to: 2005, ages: [10, 12] },
    { text: '처음으로 휴대폰을 갖게 됐다.', fx: { happiness: 3 }, from: 2004, to: 2009, ages: [10, 12] },
    { text: '처음으로 스마트폰을 갖게 됐다.', fx: { happiness: 3, ability: -1 }, from: 2010, ages: [9, 12] },
    { text: '방과 후 돌봄교실에서 부모님을 기다렸다.', fx: { relation: 1 }, from: 2004, ages: [7, 9] },
    { text: '학원 버스를 타고 학원 세 곳을 돌았다.', fx: { ability: 2, happiness: -2 }, from: 2000, when: (s) => s.quintile >= 3 },
    { text: '코로나19로 1년 내내 온라인 수업을 들었다.', fx: { relation: -3, ability: -1 }, from: 2020, to: 2021 },
    { text: '마인크래프트로 친구들과 마을을 지었다.', fx: { happiness: 3, relation: 2 }, from: 2013, to: 2035 },
  ],

  // ───────── 13~15세 ─────────
  middle: [
    { text: '사춘기가 찾아왔다. 이유 없이 모든 게 짜증스러웠다.', fx: { happiness: -3 } },
    { text: '처음으로 누군가를 좋아하게 됐다.', fx: { happiness: 3, relation: 2 } },
    { text: '시험 기간마다 밤을 새웠다.', fx: { ability: 2, health: -2 } },
    { text: '친구 문제로 학교 가기가 싫었다.', fx: { happiness: -5, relation: -3 } },
    { text: '동아리 활동에서 진짜 친구들을 만났다.', fx: { relation: 4, happiness: 2 } },
    { text: '키가 한 해에 10센티미터나 컸다.', fx: { health: 2, happiness: 1 } },
    { text: '중간고사에서 반 등수가 크게 올랐다.', fx: { ability: 3, happiness: 3 } },
    { text: '기말고사를 망치고 성적표를 숨겼다.', fx: { happiness: -3, relation: -1 } },
    { text: '수련회에서 촛불을 켜 놓고 다 같이 울었다.', fx: { relation: 3 }, from: 1980 },
    { text: '선생님 별명을 지었다가 들켰다.', fx: { happiness: 1, relation: 1 } },
    { text: '용돈을 모아 처음으로 운동화를 샀다.', fx: { happiness: 3 } },
    { text: '얼굴에 여드름이 잔뜩 났다.', fx: { happiness: -2 } },
    { text: '목소리가 갈라지기 시작했다.', fx: { happiness: -1 }, when: male },
    { text: '집안 형편 때문에 학원을 그만뒀다.', fx: { happiness: -2, ability: -1 }, when: hard },
    { text: '만화방에서 하루 종일 만화책을 읽었다.', fx: { happiness: 3 }, to: 2010 },
    { text: '펜팔 친구와 편지를 주고받았다.', fx: { relation: 2, ability: 1 }, to: 1995 },
    { text: '학생주임에게 머리를 잘렸다.', fx: { happiness: -2 }, to: 2005 },
    { text: '숙제를 안 해 와서 손바닥을 맞았다.', fx: { happiness: -2 }, to: 2010 },
    { text: '교복 대신 사복을 입고 학교에 다녔다.', fx: { happiness: 2 }, from: 1983, to: 1985 },
    { text: '좋아하는 가수의 카세트테이프를 닳도록 들었다.', fx: { happiness: 4 }, to: 1997 },
    { text: '라디오 심야 방송에 사연을 보냈다.', fx: { happiness: 2 }, to: 2000 },
    { text: '삐삐를 갖고 싶어 부모님을 졸랐다.', fx: { happiness: 1 }, from: 1993, to: 1999 },
    { text: '좋아하는 아이돌이 생겼다.', fx: { happiness: 4 }, from: 1996 },
    { text: 'PC방에서 게임하느라 성적이 떨어졌다.', fx: { ability: -3, happiness: 3 }, from: 1998, to: 2040 },
    { text: '싸이월드 미니홈피를 꾸미는 데 용돈을 다 썼다.', fx: { happiness: 3 }, from: 2001, to: 2010 },
    { text: 'MP3 플레이어에 노래를 가득 채웠다.', fx: { happiness: 3 }, from: 2001, to: 2010 },
    { text: '단톡방에서 친구들과 밤늦게까지 떠들었다.', fx: { relation: 2, health: -1 }, from: 2011 },
    { text: '자유학기제 동안 진로 체험을 다녔다.', fx: { ability: 1, happiness: 2 }, from: 2016 },
    { text: '숏폼 영상을 보다 새벽 2시를 넘겼다.', fx: { health: -2, happiness: 1 }, from: 2019 },
  ],

  // ───────── 16~18세 ─────────
  high: [
    { text: '야간 자율학습이 끝나면 밤 10시였다.', fx: { ability: 2, health: -2, happiness: -2 } },
    { text: '모의고사 성적이 크게 올랐다.', fx: { ability: 3, happiness: 3 } },
    { text: '진로 고민으로 잠을 못 이루는 날이 많았다.', fx: { happiness: -3 } },
    { text: '수학여행에서 평생 갈 추억을 만들었다.', fx: { happiness: 4, relation: 3 } },
    { text: '성적 때문에 부모님과 자주 다퉜다.', fx: { happiness: -3, relation: -2 } },
    { text: '체육대회에서 반 전체가 한 몸처럼 응원했다.', fx: { relation: 3, happiness: 2 } },
    { text: '축제 무대에서 밴드 공연을 했다.', fx: { happiness: 4, relation: 2 } },
    { text: '매점 빵을 사려고 쉬는 시간마다 뛰었다.', fx: { happiness: 2 } },
    { text: '친한 친구가 전학을 갔다.', fx: { relation: -2, happiness: -2 } },
    { text: '독서실 책상에 엎드려 자는 날이 많았다.', fx: { health: -1, ability: 1 } },
    { text: '문제집을 한 권 끝까지 다 풀었다.', fx: { ability: 2, happiness: 1 } },
    { text: '장래 희망이 몇 번이나 바뀌었다.', fx: { happiness: -1 } },
    { text: '담임 선생님이 진심으로 내 편이 되어 주었다.', fx: { happiness: 3, relation: 2 } },
    { text: '스트레스로 위염이 생겼다.', fx: { health: -3 } },
    { text: '학교 앞 분식집 떡볶이로 버텼다.', fx: { happiness: 2 } },
    { text: '교련 시간에 운동장에서 제식 훈련을 받았다.', fx: { health: 1 }, from: 1969, to: 1996 },
    { text: '보충수업과 자율학습 때문에 방학이 없었다.', fx: { ability: 2, happiness: -2 }, from: 1975 },
    { text: '학력고사 날짜를 책상에 붙여 놓고 하루하루 지웠다.', fx: { ability: 1 }, from: 1982, to: 1993 },
    { text: '인터넷 강의를 배속으로 돌려 들었다.', fx: { ability: 2 }, from: 2004 },
    { text: '공장에 다니는 친구들이 부러우면서도 안쓰러웠다.', fx: { happiness: -1 }, to: 1985, when: (s) => s.quintile >= 3 },
  ],

  // ───────── 19~29세 ─────────
  young: [
    { text: '자취를 시작했다.', fx: { happiness: 2 }, when: single, ages: [19, 29] },
    { text: '연애를 시작했다.', fx: { happiness: 5, relation: 3 }, when: single },
    { text: '오래 만난 사람과 헤어졌다.', fx: { happiness: -6 }, when: single },
    { text: '자격증을 하나 땄다.', fx: { ability: 3 } },
    { text: '친구 결혼식에서 축가를 불렀다.', fx: { relation: 3 }, ages: [24, 29] },
    { text: '번아웃이 왔다. 아무것도 하기 싫었다.', fx: { happiness: -6, health: -2 }, when: working },
    { text: '헬스장에 등록하고 석 달 동안 꾸준히 다녔다.', fx: { health: 4 }, from: 1990 },
    { text: '운전면허를 땄다.', fx: { ability: 2, happiness: 2 }, from: 1980 },
    { text: '첫 차를 샀다. 중고였다.', fx: { happiness: 4, cash: -800 }, from: 1990, when: working, ages: [24, 29] },
    { text: '친구들과 밤새 술을 마시고 다음 날 하루를 버렸다.', fx: { happiness: 2, health: -2, relation: 2 } },
    { text: '첫 월급으로 부모님께 내복을 사 드렸다.', fx: { relation: 3, happiness: 3 }, when: working, to: 2005 },
    { text: '첫 월급으로 부모님께 용돈을 드렸다.', fx: { relation: 3, happiness: 3 }, when: working, from: 2006 },
    { text: '돈이 없어 라면으로 한 달을 버텼다.', fx: { health: -2, happiness: -2 }, when: (s) => s.independent && s.quintile <= 3 },
    { text: '고향 친구들과 점점 연락이 뜸해졌다.', fx: { relation: -2 } },
    { text: '혼자 여행을 떠났다.', fx: { happiness: 4 }, from: 1985 },
    { text: '책 한 권이 인생을 바꿔 놓은 것 같았다.', fx: { ability: 2, happiness: 2 } },
    { text: '사람에게 크게 실망한 일이 있었다.', fx: { relation: -3, happiness: -2 } },
    { text: '부모님과 크게 다투고 한동안 연락을 끊었다.', fx: { relation: -4, happiness: -3 }, when: parentsAlive },
    { text: '동창 결혼 소식을 듣고 괜히 마음이 싱숭생숭했다.', fx: { happiness: -1 }, when: single, ages: [26, 29] },
    { text: '소개팅에 나갔지만 두 번 만나고 끝났다.', fx: { happiness: -1 }, when: single },
    { text: '직장 선배에게 일을 제대로 배웠다.', fx: { ability: 3, relation: 2 }, when: office },
    { text: '실수로 큰 거래처를 놓쳐 크게 혼났다.', fx: { happiness: -4, ability: 1 }, when: office },
    { text: '회식 자리가 너무 잦았다.', fx: { health: -2, relation: 1 }, when: office, to: 2015 },
    { text: '주말 출근이 당연한 회사였다.', fx: { health: -2, happiness: -3 }, when: office, to: 2003 },
    { text: '주 5일제가 시작돼 토요일이 생겼다.', fx: { happiness: 4 }, when: working, from: 2004, to: 2006 },
    { text: '적금을 처음으로 만기까지 채웠다.', fx: { happiness: 3, cash: 300 }, when: working },
    { text: '전세 계약이 끝나 이삿짐을 쌌다.', fx: { happiness: -2, cash: -150 }, when: renter, from: 1980 },
    { text: '집주인이 보증금을 올려 달라고 했다.', fx: { happiness: -3, cash: -400 }, when: renter, from: 1985 },
    { text: '대학 MT에서 밤새 이야기를 나눴다.', fx: { relation: 4, happiness: 3 }, when: inCollege },
    { text: '학생회관 식당에서 매일 같은 메뉴를 먹었다.', fx: { happiness: 1 }, when: inCollege },
    { text: '전공 수업이 도무지 적성에 안 맞았다.', fx: { happiness: -3, ability: -1 }, when: inCollege },
    { text: '장학금을 받았다.', fx: { happiness: 4, ability: 2 }, when: inCollege },
    { text: '등록금 때문에 휴학하고 아르바이트를 했다.', fx: { happiness: -3, ability: 1 }, when: and(inCollege, hard) },
    { text: '과외 아르바이트로 생활비를 벌었다.', fx: { ability: 1, happiness: 1 }, when: inCollege, from: 1975 },
    { text: '학교 앞에서 최루탄 냄새를 맡으며 수업에 들어갔다.', fx: { happiness: -2, health: -1 }, when: inCollege, from: 1980, to: 1991 },
    { text: '미팅에 나가 짝을 정하려고 소지품을 골랐다.', fx: { happiness: 2, relation: 2 }, when: and(inCollege, single), to: 2000 },
    { text: '도서관 자리 맡기 전쟁에 매일 참전했다.', fx: { ability: 2 }, when: inCollege, from: 1995 },
    { text: '토익 점수를 올리려고 학원을 다녔다.', fx: { ability: 2, cash: -50 }, when: inCollege, from: 1995 },
    { text: '어학연수를 다녀왔다.', fx: { ability: 3, happiness: 3 }, when: and(inCollege, wellOff), from: 1995 },
    { text: '공장 기숙사에서 동료들과 함께 지냈다.', fx: { relation: 3, health: -1 }, when: (s) => s.job?.type === 'sme' && s.edu !== null && ['elementary', 'middle', 'highschool'].includes(s.edu), to: 1995 },
    { text: '야간 학교를 다니며 공부를 이어 갔다.', fx: { ability: 3, health: -2 }, when: (s) => working(s) && (s.edu === 'elementary' || s.edu === 'middle'), to: 1995 },
    { text: '고향에 계신 부모님께 다달이 돈을 부쳤다.', fx: { relation: 3, cash: -200 }, when: and(working, hard), to: 2000 },
    { text: '통금 시간에 쫓겨 친구 집에서 밤을 보냈다.', fx: { happiness: 2, relation: 2 }, to: 1981 },
    { text: '다방에서 친구들과 음악을 신청해 들었다.', fx: { happiness: 3, relation: 2 }, to: 1990 },
    { text: '버스 안내양에게 회수권을 내고 만원 버스에 매달렸다.', fx: { happiness: -1 }, to: 1988 },
    { text: '롤러장에서 밤늦게까지 놀았다.', fx: { happiness: 3 }, from: 1978, to: 1992 },
    { text: '노래방이 처음 생겨 친구들과 몰려갔다.', fx: { happiness: 3, relation: 2 }, from: 1991, to: 1994 },
    { text: 'PC통신 동호회에서 사람들을 만났다.', fx: { relation: 3 }, from: 1990, to: 2001 },
    { text: '공중전화 앞에 줄을 서서 삐삐 음성을 확인했다.', fx: { happiness: 1 }, from: 1993, to: 1999 },
    { text: '처음으로 휴대폰을 샀다.', fx: { happiness: 3, cash: -50 }, from: 1997, to: 2003 },
    { text: '월드컵 거리 응원에 나가 목이 쉬도록 소리쳤다.', fx: { happiness: 5, relation: 2 }, from: 2002, to: 2002 },
    { text: '첫 해외여행을 다녀왔다.', fx: { happiness: 5, cash: -150 }, from: 1989 },
    { text: '배낭 하나 메고 유럽을 돌았다.', fx: { happiness: 5, ability: 1, cash: -300 }, from: 1992 },
    { text: '주식 앱을 깔고 매일 들여다봤다.', fx: { happiness: -1 }, from: 2015, when: working },
    { text: '가상화폐에 넣은 돈이 반토막 났다.', fx: { happiness: -4, cash: -300 }, from: 2018, to: 2022, when: working },
    { text: '재택근무로 출퇴근 시간이 사라졌다.', fx: { happiness: 3 }, from: 2020, to: 2022, when: office },
    { text: '취업 준비가 길어져 부모님 얼굴 보기가 미안했다.', fx: { happiness: -4 }, when: (s) => !working(s) && s.age >= 25, from: 1998 },
    { text: '원룸 월세가 월급의 3분의 1이었다.', fx: { happiness: -2 }, when: and(renter, city), from: 2010 },
  ],

  // ───────── 30~54세 ─────────
  middleAge: [
    { text: '야근이 몇 달째 이어졌다.', fx: { health: -3, happiness: -3 }, when: working },
    { text: '오랜만에 동창회에 나갔다.', fx: { relation: 4, happiness: 2 } },
    { text: '부모님이 편찮으셔서 병원을 자주 오갔다.', fx: { happiness: -4 }, when: parentsAlive, ages: [40, 54] },
    { text: '회사에서 큰 프로젝트를 맡아 해냈다.', fx: { ability: 3, happiness: 3 }, when: office },
    { text: '승진에서 밀렸다.', fx: { happiness: -5 }, when: office, ages: [35, 54] },
    { text: '팀장이 됐다. 책임이 무거워졌다.', fx: { ability: 2, happiness: 1, health: -1 }, when: office, ages: [38, 50] },
    { text: '새로 온 상사와 사사건건 부딪쳤다.', fx: { happiness: -4 }, when: office },
    { text: '후배가 나보다 먼저 승진했다.', fx: { happiness: -3 }, when: office, ages: [40, 54] },
    { text: '허리 디스크로 한동안 고생했다.', fx: { health: -5 } },
    { text: '주말마다 등산을 다니기 시작했다.', fx: { health: 4, happiness: 2 } },
    { text: '흰머리가 하나둘 늘었다.', fx: { happiness: -1 }, ages: [38, 50] },
    { text: '술을 끊기로 했다. 석 달을 버텼다.', fx: { health: 2 } },
    { text: '건강검진에서 위에 용종이 발견돼 떼어 냈다.', fx: { health: -2 }, ages: [40, 54], from: 1995 },
    { text: '눈이 침침해져 안과에 다니기 시작했다.', fx: { health: -1 }, ages: [42, 54] },
    { text: '마라톤 10킬로미터를 완주했다.', fx: { health: 4, happiness: 3 }, from: 1995 },
    { text: '명절마다 고향 가는 길이 열 시간 넘게 걸렸다.', fx: { happiness: -2, relation: 1 }, to: 2005, when: city },
    { text: '명절에 친척들이 모여 앉아 결혼은 언제 하느냐고 물었다.', fx: { happiness: -3 }, when: single, ages: [30, 40] },
    { text: '김장 날 온 식구가 모여 배추 백 포기를 절였다.', fx: { relation: 3, health: -1 }, to: 2010 },
    { text: '이웃과 반찬을 나누며 지냈다.', fx: { relation: 2 }, to: 2000 },
    { text: '층간 소음 문제로 윗집과 얼굴을 붉혔다.', fx: { happiness: -3, relation: -1 }, from: 2000, when: city },
    { text: '집 근처에 대형마트가 생겼다.', fx: { happiness: 1 }, from: 1995, to: 2005 },
    { text: '계모임에서 곗돈을 탔다.', fx: { happiness: 3, cash: 500 }, to: 2000 },
    { text: '계주가 곗돈을 들고 사라졌다.', fx: { happiness: -5, cash: -700 }, to: 1997 },
    { text: '적립식 펀드에 가입했다.', fx: { happiness: 1 }, from: 2005, to: 2008 },
    { text: '들고 있던 펀드가 금융위기로 반토막 났다.', fx: { happiness: -5, cash: -800 }, from: 2008, to: 2009 },
    { text: '아이러브스쿨에서 초등학교 동창을 찾았다.', fx: { relation: 4, happiness: 3 }, from: 1999, to: 2002 },
    { text: '캠핑 장비를 사들이기 시작했다.', fx: { happiness: 3, cash: -200 }, from: 2010 },
    { text: '골프를 배우기 시작했다.', fx: { relation: 2, cash: -300 }, when: and(office, wellOff), from: 1990 },
    { text: '재택근무를 하며 가족과 부딪치는 시간이 늘었다.', fx: { relation: -1, happiness: 1 }, when: and(office, wed), from: 2020, to: 2022 },
    { text: '가게 매출이 줄어 밤잠을 설쳤다.', fx: { happiness: -4 }, when: selfEmployed },
    { text: '단골손님이 늘어 가게가 자리를 잡았다.', fx: { happiness: 4, cash: 500 }, when: selfEmployed },
    { text: '가게 임대료가 크게 올랐다.', fx: { happiness: -4, cash: -500 }, when: selfEmployed, from: 2000 },
    { text: '코로나19로 가게 문을 몇 달 닫았다.', fx: { happiness: -6, cash: -1000 }, when: selfEmployed, from: 2020, to: 2021 },
    { text: '태풍에 한 해 농사를 망쳤다.', fx: { happiness: -5, cash: -500 }, when: farming },
    { text: '풍년이었지만 값이 떨어져 남는 게 없었다.', fx: { happiness: -2 }, when: farming },
    { text: '새마을운동으로 마을 초가지붕을 슬레이트로 바꿨다.', fx: { relation: 2 }, when: rural, from: 1971, to: 1979 },
    { text: '경운기를 들여 일손을 덜었다.', fx: { health: 2, cash: -300 }, when: farming, from: 1970, to: 1995 },
    { text: '부부싸움이 잦아졌다.', fx: { happiness: -4, relation: -2 }, when: wed },
    { text: '배우자와 단둘이 여행을 다녀왔다.', fx: { happiness: 4, relation: 3 }, when: wed },
    { text: '결혼기념일을 잊어 한동안 냉랭했다.', fx: { relation: -2 }, when: wed },
    { text: '혼자 사는 생활이 익숙해졌다.', fx: { happiness: 1 }, when: single, ages: [38, 54] },
    { text: '주말마다 운동 동호회에 나갔다.', fx: { health: 3, relation: 3 }, from: 1995 },
    { text: '대출 이자가 올라 생활비를 줄였다.', fx: { happiness: -3 }, when: (s) => !!s.house && s.house.debt > 0 },
    { text: '집값이 올랐다는 뉴스에 마음이 복잡했다.', fx: { happiness: -2 }, when: renter, from: 2005 },
    { text: '이사 갈 집을 보러 주말마다 돌아다녔다.', fx: { happiness: -1 }, when: renter },
  ],

  // ───────── 55~69세 ─────────
  senior: [
    { text: '노안이 와서 돋보기를 맞췄다.', fx: { health: -1 } },
    { text: '등산 모임에 나가기 시작했다.', fx: { health: 3, relation: 3 } },
    { text: '친구의 부고를 들었다.', fx: { happiness: -4 } },
    { text: '무릎 수술을 받았다.', fx: { health: -5 }, ages: [60, 69] },
    { text: '처음으로 텃밭을 가꿨다.', fx: { happiness: 3, health: 2 } },
    { text: '자녀가 독립해 집이 조용해졌다.', fx: { happiness: -2 }, when: (s) => s.children.length > 0 },
    { text: '퇴근 후 시간이 남아 무엇을 할지 몰랐다.', fx: { happiness: -2 }, when: (s) => !!s.flags.retired },
    { text: '정년을 앞두고 동료들과 송별회를 했다.', fx: { relation: 2, happiness: 1 }, when: office, ages: [57, 62] },
    { text: '문화센터에서 서예를 배웠다.', fx: { happiness: 3, ability: 1 }, from: 1990 },
    { text: '노래교실에서 친구를 사귀었다.', fx: { relation: 3, happiness: 2 }, from: 1990 },
    { text: '자격증 공부를 다시 시작했다.', fx: { ability: 3 } },
    { text: '하루 만 보 걷기를 시작했다.', fx: { health: 3 }, from: 2005 },
    { text: '혈압약을 먹기 시작했다.', fx: { health: -1 } },
    { text: '어깨가 굳어 팔이 올라가지 않았다.', fx: { health: -2 } },
    { text: '이가 시원찮아 임플란트를 했다.', fx: { health: 1, cash: -300 }, from: 2005 },
    { text: '고향 마을에 다녀왔다. 아는 얼굴이 거의 없었다.', fx: { happiness: -1 } },
    { text: '초등학교 동창회에서 50년 만에 친구를 만났다.', fx: { relation: 4, happiness: 3 } },
    { text: '배우자와 산책하는 게 하루의 낙이 됐다.', fx: { happiness: 3, relation: 2 }, when: wed },
    { text: '배우자의 잔소리가 늘었다.', fx: { happiness: -1 }, when: wed },
    { text: '자녀의 결혼식을 치렀다.', fx: { happiness: 5, relation: 3, cash: -1500 }, when: childAged(26, 40) },
    { text: '자녀가 취업 준비로 힘들어하는 걸 지켜봤다.', fx: { happiness: -3 }, when: childAged(23, 32), from: 1998 },
    { text: '부모님 산소를 정리했다.', fx: { relation: 1 }, when: (s) => !!s.flags.parentsGone },
    { text: '트로트 경연 프로그램에 푹 빠졌다.', fx: { happiness: 3 }, from: 2019, to: 2035, born: [1930, 1975] },
    { text: '유튜브로 옛날 노래를 찾아 들었다.', fx: { happiness: 2 }, from: 2013, to: 2050 },
    { text: '스마트폰 단체 대화방에 아침마다 꽃 사진을 보냈다.', fx: { relation: 2 }, from: 2013, born: [1930, 1972] },
    { text: '젊을 때 즐기던 게임을 다시 켜 봤다. 손이 예전 같지 않았다.', fx: { happiness: 2 }, born: [1980, 2100], from: 2035 },
    { text: '휴대폰 속 수십 년 치 사진을 정리했다.', fx: { happiness: 2 }, born: [1985, 2100], from: 2040 },
    { text: '주말마다 손주를 봐 주었다.', fx: { happiness: 2, health: -2, relation: 2 }, when: (s) => !!s.flags.grandchild },
    { text: '가게를 접을지 오래 고민했다.', fx: { happiness: -3 }, when: selfEmployed },
    { text: '농사일이 해마다 힘에 부쳤다.', fx: { health: -3 }, when: farming },
    { text: '외국인 노동자에게 농사일을 맡기기 시작했다.', fx: { health: 1, cash: -200 }, when: farming, from: 2005 },
  ],

  // ───────── 70세~ ─────────
  elder: [
    { text: '경로당에 나가기 시작했다.', fx: { relation: 3 } },
    { text: '병원 가는 날이 늘었다.', fx: { health: -3 } },
    { text: '오랜 친구를 먼저 떠나보냈다.', fx: { happiness: -5 } },
    { text: '손주들이 놀러 와 하루 종일 집이 시끌벅적했다.', fx: { happiness: 6 }, when: (s) => !!s.flags.grandchild },
    { text: '혼자 지내는 시간이 길어졌다.', fx: { happiness: -4 }, when: single },
    { text: '동네 복지관에서 스마트폰 쓰는 법을 배웠다.', fx: { ability: 2, happiness: 2 }, from: 2012, to: 2040, born: [1900, 1965] },
    { text: '손주에게 새로 나온 기기 쓰는 법을 배웠다.', fx: { relation: 2, ability: 1 }, born: [1966, 2100], when: (s) => !!s.flags.grandchild },
    { text: '자식들이 매달 생활비를 보내 주었다.', fx: { happiness: 2 }, when: (s) => s.children.length > 0, to: 2010 },
    { text: '귀가 어두워져 보청기를 맞췄다.', fx: { health: -1, happiness: 1 }, ages: [75, 120] },
    { text: '계단 오르기가 힘들어졌다.', fx: { health: -2 }, ages: [75, 120] },
    { text: '빙판길에 넘어져 손목을 다쳤다.', fx: { health: -4 } },
    { text: '기억이 깜빡깜빡했다.', fx: { ability: -2 }, ages: [75, 120] },
    { text: '젊은 시절 사진을 꺼내 보며 하루를 보냈다.', fx: { happiness: 2 } },
    { text: '자서전을 쓰듯 지난 일을 공책에 적었다.', fx: { happiness: 3, ability: 1 } },
    { text: '노인대학에 다녔다.', fx: { relation: 3, ability: 1 }, from: 1990 },
    { text: '공원 벤치에서 또래 노인들과 장기를 뒀다.', fx: { relation: 2, happiness: 2 } },
    { text: '키오스크 앞에서 한참을 헤맸다.', fx: { happiness: -2 }, from: 2019, born: [1900, 1965] },
    { text: '새로 바뀐 은행 앱 화면이 낯설어 한참 들여다봤다.', fx: { happiness: -1 }, born: [1966, 2100], from: 2040 },
    { text: '자식들과 영상통화를 했다.', fx: { happiness: 3, relation: 2 }, from: 2012, when: (s) => s.children.length > 0 },
    { text: '생일에 온 가족이 모였다.', fx: { happiness: 5, relation: 3 }, when: (s) => s.children.length > 0 },
    { text: '명절에도 자식들이 바빠 오지 못했다.', fx: { happiness: -3 }, when: (s) => s.children.length > 0 },
    { text: '배우자와 함께한 세월을 돌아봤다.', fx: { happiness: 3, relation: 2 }, when: wed },
    { text: '먼저 간 배우자가 꿈에 나왔다.', fx: { happiness: -2 }, when: (s) => !!s.flags.widowed },
    { text: '동네 텃밭에서 상추를 길러 이웃과 나눴다.', fx: { relation: 2, health: 1 } },
    { text: '요양보호사가 일주일에 세 번 집에 왔다.', fx: { health: 2 }, ages: [80, 120], from: 2008 },
    { text: '증손주가 태어났다는 소식을 들었다.', fx: { happiness: 5 }, ages: [80, 120], when: (s) => !!s.flags.grandchild },
  ],
};

// 어른이면 나이대와 상관없이 나올 수 있는 사건 (형편에 따라)
export const LIFE_EVENTS: RandomEvent[] = [
  // 아이 키우기
  { text: '아이가 첫걸음을 뗐다.', fx: { happiness: 4, relation: 2 }, when: childAged(1, 1) },
  { text: '아이가 밤마다 울어 몇 달째 잠을 못 잤다.', fx: { health: -3, happiness: -2 }, when: childAged(0, 1) },
  { text: '아이가 처음으로 "엄마", "아빠"를 불렀다.', fx: { happiness: 5 }, when: childAged(1, 2) },
  { text: '아이가 열이 펄펄 끓어 응급실에서 밤을 새웠다.', fx: { health: -2, happiness: -3 }, when: childAged(0, 5) },
  { text: '어린이집 자리가 나지 않아 애를 태웠다.', fx: { happiness: -3 }, when: childAged(1, 4), from: 2000 },
  { text: '맞벌이라 아이를 할머니 댁에 맡겼다.', fx: { relation: 1, happiness: -1 }, when: (s) => childAged(0, 6)(s) && working(s) && !!s.spouse?.incomeBase && parentsAlive(s) },
  { text: '아이 돌잔치를 했다.', fx: { happiness: 4, relation: 2, cash: -150 }, when: childAged(1, 1) },
  { text: '아이 손을 잡고 초등학교 입학식에 갔다.', fx: { happiness: 4 }, when: childAged(7, 7) },
  { text: '아이 학예회에서 눈물이 났다.', fx: { happiness: 3, relation: 2 }, when: childAged(7, 12) },
  { text: '아이가 학교에서 친구와 싸우고 와서 담임 선생님을 만났다.', fx: { happiness: -2 }, when: childAged(8, 14) },
  { text: '아이 사춘기가 시작됐다. 방문이 자주 닫혀 있었다.', fx: { happiness: -2, relation: -1 }, when: childAged(13, 16) },
  { text: '아이 성적표를 보고 한숨을 쉬었다.', fx: { happiness: -2 }, when: childAged(10, 18) },
  { text: '아이가 상장을 받아 왔다.', fx: { happiness: 4 }, when: childAged(8, 17) },
  { text: '아이 수능 날, 교문 앞에서 기도했다.', fx: { happiness: -1, relation: 2 }, when: childAged(18, 18), from: 1994 },
  { text: '아이가 대학에 합격했다.', fx: { happiness: 5 }, when: childAged(19, 19), from: 1975 },
  { text: '아이 등록금 고지서를 받고 한숨을 쉬었다.', fx: { happiness: -2, cash: -500 }, when: childAged(19, 23), from: 1990 },
  { text: '아들이 입대하는 날 훈련소 앞에서 손을 흔들었다.', fx: { happiness: -2, relation: 2 }, when: (s) => s.children.some((c) => c.sex === 'M' && s.age - c.bornAge >= 20 && s.age - c.bornAge <= 22) },
  { text: '아이가 첫 월급으로 선물을 사 왔다.', fx: { happiness: 6, relation: 3 }, when: childAged(24, 30) },
  { text: '다 큰 자식이 결혼은 안 하겠다고 했다.', fx: { happiness: -2 }, when: childAged(30, 40), from: 2005 },
  { text: '가족사진을 찍었다.', fx: { relation: 3, happiness: 2 }, when: (s) => s.children.length > 0 },
  { text: '아이와 함께 처음으로 놀이공원에 갔다.', fx: { happiness: 4, relation: 2 }, when: childAged(4, 10), from: 1976 },
  // 부모님
  { text: '부모님 환갑잔치를 치렀다.', fx: { relation: 3, cash: -200 }, when: parentsAlive, ages: [28, 40], to: 2005 },
  { text: '부모님 칠순 잔치 대신 가족 여행을 다녀왔다.', fx: { relation: 3, cash: -300 }, when: parentsAlive, ages: [38, 52], from: 2000 },
  { text: '부모님께 스마트폰 쓰는 법을 몇 번이고 알려 드렸다.', fx: { relation: 2 }, when: parentsAlive, from: 2012, to: 2035, ages: [30, 60], born: [1950, 1995] },
  { text: '명절에 고향 집에 내려가 부모님 얼굴을 뵀다.', fx: { relation: 2, happiness: 2 }, when: parentsAlive },
  { text: '부모님 집 수리비를 보탰다.', fx: { relation: 2, cash: -300 }, when: and(parentsAlive, working), ages: [35, 60] },
  // 그 밖의 어른 일
  { text: '친한 친구가 먼 도시로 이사 갔다.', fx: { relation: -2 } },
  { text: '오래된 친구와 크게 다투고 멀어졌다.', fx: { relation: -3, happiness: -2 } },
  { text: '이웃에게 큰 도움을 받았다.', fx: { relation: 3, happiness: 2 } },
  { text: '교통사고가 났지만 크게 다치지는 않았다.', fx: { health: -2, happiness: -2 }, from: 1975 },
  { text: '지갑을 잃어버렸다가 되찾았다.', fx: { happiness: 2 } },
  { text: '휴대폰을 잃어버렸다.', fx: { happiness: -2, cash: -80 }, from: 2000 },
  { text: '보이스피싱 문자에 하마터면 속을 뻔했다.', fx: { happiness: -1 }, from: 2010 },
  { text: '반려견을 가족으로 맞았다.', fx: { happiness: 4, relation: 1, cash: -100 }, from: 1995 },
  { text: '키우던 반려동물이 무지개다리를 건넜다.', fx: { happiness: -5 }, from: 2005, ages: [30, 90] },
  { text: '봉사활동을 꾸준히 다녔다.', fx: { relation: 3, happiness: 2 } },
  { text: '종교 모임에 나가기 시작했다.', fx: { relation: 3, happiness: 2 } },
  { text: '독감으로 일주일을 앓아누웠다.', fx: { health: -3 } },
  { text: '코로나19에 걸려 일주일을 앓았다.', fx: { health: -3 }, from: 2020, to: 2022 },
  { text: '건강을 위해 아침마다 걷기 시작했다.', fx: { health: 3 } },
  { text: '로또를 샀다가 번호 하나 차이로 떨어졌다.', fx: { happiness: -1 }, from: 2002 },
  { text: '복권에 당첨돼 몇십만 원을 받았다.', fx: { happiness: 3, cash: 50 }, from: 1990 },
];

// ───────── 작은 갈림길 ─────────
export const DILEMMAS: Dilemma[] = [
  // 어린 시절
  {
    prompt: '전학 온 아이가 쉬는 시간에 혼자 앉아 있었다.', ages: [7, 15],
    options: [
      { label: '먼저 말을 건다', auto: 5, outcomes: [[7, '금방 단짝이 됐다.', { relation: 5, happiness: 3 }], [3, '어색하게 몇 마디 나누고 끝났다.', { relation: 1 }]] },
      { label: '모른 척한다', auto: 4, outcomes: [[1, '며칠 뒤 그 아이는 다른 친구들과 어울렸다.', { relation: -1 }]] },
    ],
  },
  {
    prompt: '문방구 앞 뽑기 기계에 용돈을 다 넣고 싶었다.', ages: [7, 11],
    options: [
      { label: '다 넣는다', auto: 4, outcomes: [[3, '원하던 장난감이 나왔다!', { happiness: 4 }], [7, '꽝만 잔뜩 나왔다.', { happiness: -2 }]] },
      { label: '돼지저금통에 넣는다', auto: 5, outcomes: [[1, '저금통이 묵직해질수록 뿌듯했다.', { ability: 1, happiness: 1 }]] },
    ],
  },
  {
    prompt: '친구가 학원을 빼먹고 놀러 가자고 했다.', ages: [9, 15], from: 1985,
    options: [
      { label: '따라간다', auto: 4, outcomes: [[5, '하루 종일 신나게 놀았다.', { happiness: 4, relation: 2 }], [5, '학원에서 집으로 전화가 왔다. 크게 혼났다.', { happiness: -3, relation: -1 }]] },
      { label: '학원에 간다', auto: 5, outcomes: [[1, '수업을 들으면서도 마음은 콩밭에 가 있었다.', { ability: 2, happiness: -1 }]] },
    ],
  },
  {
    prompt: '방과 후에 무엇을 배울지 고르라고 했다.', ages: [7, 10], when: (s) => s.quintile >= 2,
    options: [
      { label: '피아노', auto: 5, outcomes: [[1, '손가락이 건반 위를 제법 달렸다.', { ability: 2, happiness: 2 }]] },
      { label: '태권도', auto: 5, outcomes: [[1, '도장에서 소리를 지르며 뛰어다녔다.', { health: 3, happiness: 2 }]] },
      { label: '미술', auto: 3, outcomes: [[1, '스케치북이 금세 가득 찼다.', { happiness: 3, ability: 1 }]] },
    ],
  },
  {
    prompt: '시험 시간, 옆자리 친구가 답을 보여 주겠다고 신호를 보냈다.', ages: [12, 18],
    options: [
      { label: '고개를 돌린다', auto: 6, outcomes: [[1, '점수는 아쉬웠지만 마음은 편했다.', { ability: 1, happiness: 1 }]] },
      { label: '슬쩍 본다', auto: 2, outcomes: [[6, '점수는 올랐지만 찜찜했다.', { happiness: -1 }], [4, '감독 선생님에게 들켰다. 둘 다 0점 처리됐다.', { happiness: -5, relation: -3 }]] },
    ],
  },
  {
    prompt: '좋아하는 아이에게 마음을 전할까?', ages: [13, 18],
    options: [
      { label: '고백한다', auto: 4, outcomes: [[4, '그 아이도 같은 마음이었다.', { happiness: 6, relation: 3 }], [6, '"친구로 지내자"는 답이 돌아왔다.', { happiness: -4 }]] },
      { label: '마음에 묻는다', auto: 5, outcomes: [[1, '졸업할 때까지 멀리서 바라보기만 했다.', { happiness: -1 }]] },
    ],
  },
  {
    prompt: '친구들이 수업을 빼먹고 바다를 보러 가자고 했다.', ages: [16, 18], from: 1980,
    options: [
      { label: '간다', auto: 3, outcomes: [[5, '파도 소리를 들으며 처음으로 숨을 돌렸다.', { happiness: 5, relation: 3 }], [5, '돌아와서 부모님이 학교에 불려 왔다.', { happiness: 2, relation: -2 }]] },
      { label: '교실에 남는다', auto: 6, outcomes: [[1, '창밖을 보며 친구들 생각을 했다.', { ability: 1 }]] },
    ],
  },
  {
    prompt: '공부와 운동, 어느 쪽에 더 시간을 쓸까?', ages: [13, 17],
    options: [
      { label: '공부', auto: 5, outcomes: [[1, '책상 앞에 앉아 있는 시간이 늘었다.', { ability: 3, health: -1 }]] },
      { label: '운동', auto: 4, outcomes: [[1, '저녁마다 운동장을 뛰었다.', { health: 4, happiness: 2, ability: -1 }]] },
    ],
  },
  // 젊은 날
  {
    prompt: '주말 아르바이트 자리가 났다.', ages: [17, 28],
    options: [
      { label: '한다', auto: 5, outcomes: [[7, '번 돈으로 사고 싶던 것을 샀다.', { happiness: 3, health: -1 }], [3, '사장에게 월급을 떼였다.', { happiness: -3 }]] },
      { label: '쉰다', auto: 4, outcomes: [[1, '주말 내내 늦잠을 잤다.', { health: 1, happiness: 1 }]] },
    ],
  },
  {
    prompt: '오랜 친구가 급하다며 돈을 빌려 달라고 했다.', ages: [22, 70], when: (s) => s.independent && s.cash > 300,
    options: [
      { label: '빌려준다', auto: 5, outcomes: [[5, '몇 달 뒤 고맙다며 갚았다.', { relation: 3 }], [5, '그 뒤로 연락이 끊겼다.', { relation: -4, happiness: -4, cash: -500 }]] },
      { label: '거절한다', auto: 4, outcomes: [[1, '서운해하는 기색이 역력했다.', { relation: -2 }]] },
    ],
  },
  {
    prompt: '워킹홀리데이로 1년 동안 외국에 나가 볼까?', ages: [20, 29], from: 1995, when: single,
    options: [
      { label: '떠난다', auto: 3, outcomes: [[7, '낯선 나라에서 일하며 세상이 넓다는 걸 알았다.', { ability: 3, happiness: 5, relation: -1 }], [3, '외롭고 힘들어 반년 만에 돌아왔다.', { happiness: -2, ability: 1 }]] },
      { label: '남는다', auto: 6, outcomes: [[1, '하던 일을 계속했다.', { ability: 1 }]] },
    ],
  },
  {
    prompt: '친구가 같이 가게를 차려 보자고 했다.', ages: [25, 45], when: (s) => s.independent && working(s) && !selfEmployed(s),
    options: [
      { label: '같이 해 본다', auto: 2, outcomes: [[3, '가게가 제법 잘됐다. 짭짤한 부수입이 생겼다.', { cash: 1500, happiness: 4 }], [7, '1년 만에 문을 닫았다. 투자금을 날렸다.', { cash: -1500, happiness: -5, relation: -2 }]] },
      { label: '거절한다', auto: 7, outcomes: [[1, '지금 하는 일에 집중하기로 했다.', {}]] },
    ],
  },
  {
    prompt: '연락이 끊겼던 첫사랑에게서 연락이 왔다.', ages: [25, 45], when: single,
    options: [
      { label: '만나 본다', auto: 4, outcomes: [[3, '다시 설렜다.', { happiness: 5, relation: 2 }], [7, '추억은 추억으로 남겨 두는 게 나았다.', { happiness: -2 }]] },
      { label: '답하지 않는다', auto: 5, outcomes: [[1, '휴대폰을 한참 들여다보다 내려놓았다.', {}]] },
    ],
  },
  // 일
  {
    prompt: '다른 회사에서 연봉을 올려 주겠다며 이직을 제안했다.', ages: [28, 50], when: office,
    options: [
      { label: '옮긴다', auto: 4, outcomes: [[6, '새 회사에 금방 적응했다.', { cash: 800, ability: 2, happiness: 2 }], [4, '사람도 일도 맞지 않아 후회했다.', { happiness: -5, relation: -2 }]] },
      { label: '남는다', auto: 5, outcomes: [[1, '익숙한 자리에서 일을 이어 갔다.', { relation: 1 }]] },
    ],
  },
  {
    prompt: '회사가 지방 지사로 가면 승진시켜 주겠다고 했다.', ages: [32, 50], when: (s) => office(s) && s.job?.type !== 'professional',
    options: [
      { label: '내려간다', auto: 4, outcomes: [[1, '주말부부가 됐지만 직함이 바뀌었다.', { ability: 3, cash: 500, relation: -2, happiness: -1 }]] },
      { label: '남는다', auto: 5, outcomes: [[1, '승진은 다음으로 미뤄졌다.', { happiness: -2 }]] },
    ],
  },
  {
    prompt: '퇴근 후 대학원에 다녀 볼까?', ages: [27, 45], from: 1990, when: office,
    options: [
      { label: '다닌다', auto: 3, outcomes: [[1, '주경야독으로 학위를 땄다. 몸은 고됐다.', { ability: 4, health: -3, cash: -800 }]] },
      { label: '그만둔다', auto: 6, outcomes: [[1, '저녁 시간을 지켰다.', { happiness: 1 }]] },
    ],
  },
  {
    prompt: '부당한 지시를 받았다. 따르면 편하지만 찜찜했다.', ages: [25, 60], when: office,
    options: [
      { label: '문제를 제기한다', auto: 3, outcomes: [[5, '결국 지시가 바뀌었다.', { happiness: 3, ability: 1 }], [5, '그 뒤로 눈 밖에 났다.', { happiness: -4, relation: -2 }]] },
      { label: '시키는 대로 한다', auto: 6, outcomes: [[1, '한동안 잠을 설쳤다.', { happiness: -2 }]] },
    ],
  },
  // 가족
  {
    prompt: '연로하신 부모님을 모시고 살까?', ages: [40, 65], when: (s) => wed(s) && parentsAlive(s),
    options: [
      { label: '모신다', auto: 4, outcomes: [[6, '집이 북적였지만 마음은 놓였다.', { relation: 3, happiness: -1 }], [4, '배우자와 다투는 날이 늘었다.', { relation: -2, happiness: -3 }]] },
      { label: '가까이 모신다', auto: 5, outcomes: [[1, '근처로 집을 얻어 드리고 자주 들렀다.', { relation: 2, cash: -300 }]] },
    ],
  },
  {
    prompt: '아이가 해외로 유학을 가고 싶다고 했다.', ages: [38, 60], from: 1990, when: (s) => childAged(15, 22)(s) && s.quintile >= 3,
    options: [
      { label: '보낸다', auto: 3, outcomes: [[1, '공항에서 오래 손을 흔들었다. 송금이 매달 이어졌다.', { happiness: 2, cash: -3000 }]] },
      { label: '설득해 붙잡는다', auto: 5, outcomes: [[5, '아이도 결국 수긍했다.', { relation: 1 }], [5, '아이가 한동안 말을 하지 않았다.', { relation: -3 }]] },
    ],
  },
  {
    prompt: '다 큰 자식이 사업 자금을 도와 달라고 했다.', ages: [50, 80], when: (s) => childAged(27, 45)(s) && s.cash > 1000,
    options: [
      { label: '돕는다', auto: 5, outcomes: [[4, '사업이 자리를 잡았다.', { relation: 3, happiness: 3, cash: -1500 }], [6, '사업은 어려워졌고 돈은 돌아오지 않았다.', { relation: 1, happiness: -3, cash: -2000 }]] },
      { label: '거절한다', auto: 4, outcomes: [[1, '서운한 말이 오갔다.', { relation: -3 }]] },
    ],
  },
  {
    prompt: '강아지를 한 마리 데려올까?', ages: [10, 75], from: 1995,
    options: [
      { label: '데려온다', auto: 4, outcomes: [[1, '집에 웃음이 늘었다.', { happiness: 5, relation: 2 }]] },
      { label: '다음에', auto: 5, outcomes: [[1, '산책하는 남의 집 강아지를 오래 바라봤다.', {}]] },
    ],
  },
  {
    prompt: '배우자가 함께 운동을 다니자고 했다.', ages: [30, 75], when: wed,
    options: [
      { label: '같이 다닌다', auto: 5, outcomes: [[1, '저녁마다 나란히 걸었다.', { health: 3, relation: 3 }]] },
      { label: '혼자 쉬고 싶다', auto: 4, outcomes: [[1, '배우자 혼자 나갔다.', { relation: -1 }]] },
    ],
  },
  // 돈
  {
    prompt: '동창이 확실한 투자처가 있다며 연락해 왔다.', ages: [35, 70], when: (s) => s.cash > 1500,
    options: [
      { label: '돈을 넣는다', auto: 2, outcomes: [[2, '정말로 큰돈을 벌었다.', { cash: 2500, happiness: 5 }], [8, '투자 사기였다.', { cash: -2500, happiness: -7, relation: -2 }]] },
      { label: '거절한다', auto: 7, outcomes: [[1, '얼마 뒤 그 회사가 문을 닫았다는 소식을 들었다.', { happiness: 1 }]] },
    ],
  },
  {
    prompt: '아파트 청약에 넣어 볼까?', ages: [28, 55], from: 1988, when: renter,
    options: [
      { label: '넣는다', auto: 5, outcomes: [[1, '이번에도 떨어졌다. 경쟁률이 수십 대 일이었다.', { happiness: -1 }]] },
      { label: '그냥 둔다', auto: 4, outcomes: [[1, '청약 통장에 다달이 돈만 넣었다.', {}]] },
    ],
  },
  {
    prompt: '로또를 한 장 살까?', ages: [20, 90], from: 2002,
    options: [
      { label: '산다', auto: 5, outcomes: [[97, '토요일 저녁까지 설렜다. 꽝이었다.', { happiness: 1 }], [3, '5등에 당첨됐다. 다시 로또를 샀다.', { happiness: 2 }]] },
      { label: '안 산다', auto: 4, outcomes: [[1, '그 돈으로 붕어빵을 사 먹었다.', { happiness: 1 }]] },
    ],
  },
  // 나이 든 뒤
  {
    prompt: '퇴직금으로 가게를 차려 볼까?', ages: [52, 65], from: 1995, when: (s) => !!s.flags.retired && s.cash > 2000 && !selfEmployed(s),
    options: [
      { label: '차린다', auto: 3, outcomes: [[35, '동네 사랑방 같은 가게가 됐다.', { cash: 1500, happiness: 4, relation: 3 }], [65, '2년 만에 문을 닫았다. 퇴직금 절반이 사라졌다.', { cash: -3000, happiness: -6 }]] },
      { label: '그냥 쉰다', auto: 6, outcomes: [[1, '아침 산책으로 하루를 시작했다.', { health: 2 }]] },
    ],
  },
  {
    prompt: '도시를 떠나 시골로 내려가 살까?', ages: [55, 70], from: 1995, when: city,
    options: [
      { label: '내려간다', auto: 3, outcomes: [[6, '텃밭을 일구며 몸이 가벼워졌다.', { health: 4, happiness: 3, relation: -2 }], [4, '시골 생활이 생각보다 고됐다. 이웃과도 잘 어울리지 못했다.', { happiness: -3, relation: -2 }]] },
      { label: '남는다', auto: 6, outcomes: [[1, '익숙한 동네에서 지냈다.', {}]] },
    ],
  },
  {
    prompt: '동창들이 다 같이 해외여행을 가자고 했다.', ages: [55, 78], from: 1990,
    options: [
      { label: '간다', auto: 5, outcomes: [[1, '학생 때처럼 웃고 떠들었다.', { happiness: 5, relation: 3, cash: -300 }]] },
      { label: '빠진다', auto: 4, outcomes: [[1, '단톡방에 올라오는 사진만 봤다.', { relation: -1 }]] },
    ],
  },
  {
    prompt: '복지관 노래 교실에 나가 볼까?', ages: [65, 90], from: 1990,
    options: [
      { label: '나간다', auto: 5, outcomes: [[1, '일주일에 두 번, 목청껏 노래를 불렀다.', { happiness: 4, relation: 3 }]] },
      { label: '집에 있는다', auto: 4, outcomes: [[1, 'TV를 보며 하루를 보냈다.', { happiness: -1 }]] },
    ],
  },
  {
    prompt: '"아들이 사고를 쳤다"며 당장 돈을 보내라는 전화가 왔다.', ages: [60, 95], from: 2006, when: (s) => s.children.length > 0,
    options: [
      { label: '끊고 자식에게 전화한다', auto: 7, outcomes: [[1, '자식은 멀쩡히 회사에 있었다. 보이스피싱이었다.', { happiness: 1 }]] },
      { label: '돈을 보낸다', auto: 2, outcomes: [[1, '보이스피싱이었다. 돈은 돌아오지 않았다.', { cash: -1000, happiness: -7 }]] },
    ],
  },
  {
    prompt: '자식들이 요양원 이야기를 조심스레 꺼냈다.', ages: [80, 120], from: 2000,
    options: [
      { label: '들어간다', auto: 4, outcomes: [[1, '돌봐 주는 손길은 있었지만 집이 그리웠다.', { health: 3, happiness: -3 }]] },
      { label: '집에서 지낸다', auto: 5, outcomes: [[1, '조금 불편해도 내 집이 좋았다.', { happiness: 2, health: -2 }]] },
    ],
  },
  {
    prompt: '손주 대학 등록금을 보태 줄까?', ages: [65, 95], when: (s) => !!s.flags.grandchild && s.cash > 500,
    options: [
      { label: '보탠다', auto: 6, outcomes: [[1, '손주가 꾸벅 인사를 했다.', { relation: 4, happiness: 3, cash: -500 }]] },
      { label: '마음만 전한다', auto: 3, outcomes: [[1, '봉투에 짧은 편지를 넣었다.', { relation: 1 }]] },
    ],
  },
  {
    prompt: '헌혈 버스가 서 있었다.', ages: [16, 69], from: 1975,
    options: [
      { label: '헌혈한다', auto: 4, outcomes: [[1, '빵과 우유를 받아 들고 뿌듯해했다.', { happiness: 2 }]] },
      { label: '지나친다', auto: 5, outcomes: [[1, '바쁜 걸음을 재촉했다.', {}]] },
    ],
  },
];

