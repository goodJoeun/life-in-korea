/*
 * 5000만분의 1 — 생애 갈림길 (claude/paths/SKILL.md)
 *
 * 플레이어가 고른 것이 성향(traits)과 관심 분야(interests)로 쌓이고, 그에 맞춰 다음 선택지가 열린다.
 * 결과는 여전히 확률을 따른다(outcomes 가중치).
 *
 * 필드: ages 나이 · from/to 달력 연도 · bornFrom/bornTo 출생연도 · when 형편 조건 · chance 조건이 맞는 해에 나올 확률(1이면 꼭)
 * 선택지: shape 고르면 바뀌는 성향·관심 · lean 성향에 따라 '운에 맡기기' 가중치가 바뀌는 방향 · then 엔진 상태 바꾸기
 * 문장은 과거형 일기체. 시대가 있는 문장은 eraText 나 from/to 로. 수치 효과는 작게 (통계 보정).
 */
import { MAJORS, type Effect, type InterestKey, type TraitKey } from './content';
import type { Life } from './engine';
import { josa } from './text';

export type Outcome = [number, string, Effect];
export interface PathOption {
  label: string;
  desc?: string;
  /** 운에 맡길 때 기본 가중치 */
  auto: number;
  /** 성향이 이 방향일수록 운에 맡길 때 더 자주 고른다 (예: { bold: 1 } 은 도전적일수록) */
  lean?: Partial<Record<TraitKey | InterestKey, number>>;
  shape?: { traits?: Partial<Record<TraitKey, number>>; interests?: Partial<Record<InterestKey, number>> };
  outcomes: Outcome[];
  then?: (l: Life) => void;
}
export interface PathChoice {
  id: string;
  ages: [number, number];
  chance?: number;
  from?: number;
  to?: number;
  bornFrom?: number;
  bornTo?: number;
  when?: (l: Life) => boolean;
  prompt: string | ((l: Life) => string);
  options: (l: Life) => PathOption[];
}

// ───────── 도우미 ─────────
/** 연도에 따라 다른 말: [[이 해까지, 문장], …, 그 뒤 문장] */
function eraText(year: number, list: [number, string][], last: string): string {
  for (const [until, t] of list) if (year <= until) return t;
  return last;
}
const working = (l: Life) => !!l.job && l.job.type !== 'none';
const office = (l: Life) => !!l.job && ['large', 'public', 'sme'].includes(l.job.type);
const inSchool = (l: Life) => l.edu === null;
const inCollege = (l: Life) => l.flags.collegeStart !== undefined && l.flags.gradAge !== undefined && l.age >= l.flags.collegeStart && l.age < l.flags.gradAge;
const childAged = (min: number, max: number) => (l: Life) => l.children.some((c) => l.age - c.bornAge >= min && l.age - c.bornAge <= max);
const fourYear = (l: Life) => ['local4', 'capital4', 'top4'].includes(l.edu ?? '');

// ───────── 갈림길 ─────────
export const PATHS: PathChoice[] = [
  // ── 어린 시절: 관심 분야의 씨앗 ──
  {
    id: 'school-love', ages: [8, 8], chance: 1, when: inSchool,
    prompt: '학교에서 가장 기다려지는 시간은?',
    options: () => [
      { label: '수학·과학 시간', auto: 2, lean: { science: 1 }, shape: { interests: { science: 4 }, traits: { diligent: 5 } }, outcomes: [[1, '구구단을 반에서 제일 먼저 외웠다.', { ability: 2 }], [1, '과학 실험 시간이면 눈이 반짝였다.', { happiness: 2 }]] },
      { label: '국어 시간과 책 읽기', auto: 2, lean: { words: 1 }, shape: { interests: { words: 4 } }, outcomes: [[1, '도서실에서 동화책을 한 아름씩 빌려 읽었다.', { ability: 2 }], [1, '일기장에 쓴 글을 선생님이 칭찬해 주셨다.', { happiness: 3 }]] },
      { label: '미술·음악 시간', auto: 2, lean: { art: 1 }, shape: { interests: { art: 4 } }, outcomes: [[1, '크레파스로 그린 그림이 교실 뒤에 붙었다.', { happiness: 3 }], [1, '리코더를 불 때가 제일 즐거웠다.', { happiness: 2 }]] },
      { label: '체육 시간', auto: 2, lean: { sport: 1 }, shape: { interests: { sport: 4 }, traits: { bold: 5 } }, outcomes: [[1, '쉬는 시간마다 운동장으로 뛰어나갔다.', { health: 3 }], [1, '이어달리기 반 대표로 뽑혔다.', { happiness: 3, health: 1 }]] },
      { label: '친구들과 노는 쉬는 시간', auto: 2, lean: { social: 1 }, shape: { interests: { care: 2 }, traits: { social: 12 } }, outcomes: [[1, '반에서 모르는 친구가 없었다.', { relation: 4 }], [1, '친구들 사이 다툼을 잘 말렸다.', { relation: 3 }]] },
    ],
  },
  {
    id: 'after-school', ages: [9, 9], chance: 0.9, when: inSchool,
    prompt: '학교가 끝나면 주로 무엇을 할까?',
    options: (l) => {
      const y = l.year;
      const opts: PathOption[] = [
        { label: '해 질 때까지 동네 친구들과 논다', auto: 3, lean: { social: 1 }, shape: { traits: { social: 10, diligent: -4 }, interests: { sport: 2 } }, outcomes: [[1, eraText(y, [[1990, '골목에서 해 질 녘까지 술래잡기를 했다.'], [2010, '놀이터에서 친구들과 얼음땡을 했다.']], '학원 사이 빈 시간에 친구들과 놀이터에서 뛰었다.'), { happiness: 3, relation: 2 }]] },
        { label: '책을 끼고 산다', auto: 2, lean: { words: 1, diligent: 1 }, shape: { interests: { words: 3 }, traits: { diligent: 6, social: -4 } }, outcomes: [[1, eraText(y, [[1985, '만화방과 동네 서점을 오가며 책을 읽었다.']], '도서관에서 책을 빌려 읽는 게 낙이었다.'), { ability: 2 }]] },
        { label: '무언가를 만들고 뜯어본다', auto: 2, lean: { science: 1, tech: 1 }, shape: { interests: { science: 2, tech: 2 } }, outcomes: [[1, eraText(y, [[1985, '고장 난 라디오를 뜯어 보다 혼이 났다.'], [2005, '과학상자로 움직이는 자동차를 만들었다.']], '블록 코딩으로 작은 게임을 만들었다.'), { ability: 2, happiness: 2 }]] },
        { label: '집안일을 돕는다', auto: l.quintile <= 2 ? 3 : 1, lean: { thrift: 1 }, shape: { traits: { thrift: 8, diligent: 4 }, interests: { care: 2 } }, outcomes: [[1, l.residence.group === 'province' && y < 1995 ? '학교가 끝나면 논밭에 나가 일손을 거들었다.' : '동생을 돌보고 저녁상을 차렸다.', { relation: 2, happiness: -1 }]] },
      ];
      opts.push({ label: '곤충과 식물을 기른다', auto: 1.5, lean: { nature: 1 }, shape: { interests: { nature: 4 }, traits: { diligent: 3 } }, outcomes: [[1, y < 1990 ? '논두렁에서 올챙이를 잡아 와 길렀다.' : '방울토마토 화분을 키우며 관찰 일기를 썼다.', { happiness: 2 }], [1, '장수풍뎅이를 애벌레부터 키워 냈다.', { happiness: 3 }]] });
      opts.push({ label: '가게 일을 거들며 용돈을 번다', auto: l.quintile <= 3 ? 1.5 : 0.8, lean: { biz: 1, thrift: 1 }, shape: { interests: { biz: 4 }, traits: { thrift: 6 } }, outcomes: [[1, '동네 가게에서 심부름을 하고 용돈을 받아 저금통에 모았다.', { happiness: 1, relation: 1 }], [1, '학교 앞에서 딱지를 팔아 친구들 사이에 소문이 났다.', { happiness: 2 }]] });
      if (y >= 1990) opts.push({ label: '컴퓨터 앞에 앉는다', auto: 2, lean: { tech: 1 }, shape: { interests: { tech: 4 }, traits: { social: -3 } }, outcomes: [[1, eraText(y, [[1998, '286 컴퓨터로 게임을 하다 플로피디스크를 망가뜨렸다.'], [2012, '컴퓨터로 게임을 하다 엄마에게 혼이 났다.']], '태블릿으로 영상을 보고 게임을 했다.'), { happiness: 3, ability: -1 }], [1, '컴퓨터로 이것저것 만져 보는 게 재미있었다.', { ability: 1, happiness: 2 }]] });
      if (l.quintile >= 3) opts.push({ label: '피아노·미술 학원에 다닌다', auto: 2, lean: { art: 1 }, shape: { interests: { art: 4 } }, outcomes: [[1, '체르니 30번까지 쳤다.', { ability: 1 }], [1, '미술 학원에서 그린 그림으로 상을 받았다.', { happiness: 3 }]] });
      return opts;
    },
  },
  {
    id: 'club', ages: [14, 14], chance: 0.85, when: inSchool,
    prompt: '중학교 동아리를 골라야 했다.',
    options: (l) => {
      const opts: PathOption[] = [
        { label: '과학반', auto: 2, lean: { science: 1 }, shape: { interests: { science: 3 } }, outcomes: [[1, '과학 경진대회에 학교 대표로 나갔다.', { ability: 2, happiness: 2 }], [1, '물로켓을 쏘아 올리던 날을 오래 기억했다.', { happiness: 2 }]] },
        { label: '문예반·방송반', auto: 2, lean: { words: 1 }, shape: { interests: { words: 3 }, traits: { social: 4 } }, outcomes: [[1, '교내 백일장에서 상을 받았다.', { happiness: 3 }], [1, '점심시간 교내 방송에서 사연을 읽었다.', { relation: 2 }]] },
        { label: '미술부·밴드부', auto: 2, lean: { art: 1 }, shape: { interests: { art: 3 }, traits: { bold: 3 } }, outcomes: [[1, '축제 무대에 올라 공연을 했다.', { happiness: 4, relation: 2 }], [1, '미술 대회에 그림을 내 입선했다.', { happiness: 3 }]] },
        { label: '운동부', auto: 2, lean: { sport: 1 }, shape: { interests: { sport: 3 }, traits: { social: 4 } }, outcomes: [[1, '반 대항 경기에서 결승골을 넣었다.', { happiness: 4, health: 2 }], [1, '방과 후 연습에 빠지지 않았다.', { health: 3 }]] },
        { label: '봉사 동아리', auto: 1, lean: { care: 1 }, shape: { interests: { care: 3 }, traits: { social: 4 } }, outcomes: [[1, '주말마다 복지관에서 어르신들 말동무를 했다.', { relation: 3 }]] },
      ];
      if (l.year >= 1990) opts.push({ label: '환경·텃밭 동아리', auto: 1.5, lean: { nature: 1 }, shape: { interests: { nature: 3 } }, outcomes: [[1, '학교 화단에 텃밭을 일구고 상추를 길렀다.', { happiness: 2, health: 1 }]] });
      if (l.year >= 1995) opts.push({ label: '경제 동아리', auto: 1.2, lean: { biz: 1 }, shape: { interests: { biz: 3 } }, outcomes: [[1, '모의 주식 투자 대회에 나갔다.', { ability: 1, happiness: 2 }], [1, '학교 축제에서 떡볶이를 팔아 남은 돈을 기부했다.', { relation: 2 }]] });
      if (l.year >= 1988) opts.push({ label: '컴퓨터반', auto: 2, lean: { tech: 1 }, shape: { interests: { tech: 3 } }, outcomes: [[1, l.year < 2000 ? '베이직으로 처음 프로그램을 짜 봤다.' : l.year < 2015 ? '홈페이지를 직접 만들어 친구들에게 자랑했다.' : '친구들과 앱을 만들어 대회에 나갔다.', { ability: 2, happiness: 2 }]] });
      return opts;
    },
  },
  {
    id: 'dream-talk', ages: [15, 15], chance: 0.7, when: (l) => inSchool(l) && !!l.mainInterest(),
    prompt: '진로 상담 시간에 선생님이 꿈을 물었다.',
    options: (l) => {
      const want = l.interestDream();
      return [
        { label: `${josa(want, '이/가')} 되고 싶다고 말한다`, auto: 3, lean: { bold: 1 }, shape: { traits: { bold: 5, diligent: 3 } }, outcomes: [[1, `${want}의 꿈을 처음 소리 내어 말했다.`, { happiness: 3 }]], then: (x) => x.setDream(want) },
        { label: '안정적인 직업이 좋다고 말한다', auto: 2, lean: { bold: -1 }, shape: { traits: { bold: -8, diligent: 4 } }, outcomes: [[1, '공무원이나 교사 같은 안정적인 직업이 좋다고 했다.', { happiness: 1 }]], then: (x) => x.setDream('공무원') },
        { label: '아직 잘 모르겠다', auto: 1, outcomes: [[1, '꿈이 뭐냐는 질문이 제일 어려웠다.', { happiness: -1 }]] },
      ];
    },
  },
  {
    id: 'temptation', ages: [15, 17], chance: 0.35, when: inSchool,
    prompt: (l) => `친구들이 ${eraText(l.year, [[1995, '수업을 빼먹고 오락실에'], [2035, '야자를 빼먹고 PC방에']], '보충 수업을 빼먹고 놀러')} 가자고 했다.`,
    options: () => [
      { label: '따라간다', auto: 2, lean: { bold: 1, social: 1 }, shape: { traits: { bold: 8, diligent: -8, social: 4 } }, outcomes: [[2, '그날 처음으로 담을 넘었다. 생각보다 짜릿했다.', { happiness: 3, relation: 2 }], [1, '걸려서 반성문을 썼다.', { happiness: -2 }]] },
      { label: '공부해야 한다며 거절한다', auto: 3, lean: { diligent: 1 }, shape: { traits: { diligent: 8, bold: -3 } }, outcomes: [[1, '혼자 자습실에 남았다. 조금 외로웠다.', { ability: 1, relation: -1 }]] },
    ],
  },
  {
    id: 'track', ages: [16, 17], chance: 1, from: 1965, when: (l) => inSchool(l) && !l.flags.vocational && !l.flags.track,
    prompt: (l) => (l.year <= 2021 ? '문과와 이과 가운데 하나를 골라야 했다.' : '고등학교에서 들을 선택 과목을 정해야 했다.'),
    options: (l) => {
      const late = l.year > 2021;
      const opts: PathOption[] = [
        { label: late ? '수학·과학 과목' : '이과', auto: 2, lean: { science: 1, tech: 1 }, shape: { interests: { science: 3, tech: 1 } }, outcomes: [[1, late ? '미적분과 물리를 골랐다.' : '이과를 골랐다. 수학 문제집이 두 배로 늘었다.', { ability: 1 }]], then: (x) => (x.flags.track = 'science') },
        { label: late ? '인문·사회 과목' : '문과', auto: 2, lean: { words: 1, biz: 1 }, shape: { interests: { words: 2, biz: 2 } }, outcomes: [[1, late ? '사회·문화와 경제를 골랐다.' : '문과를 골랐다. 외울 것이 산더미였다.', { ability: 1 }]], then: (x) => (x.flags.track = 'humanities') },
      ];
      if (Math.max(l.interests.art, l.interests.sport) >= 6) opts.push({ label: '예체능', auto: 1, lean: { art: 1, sport: 1, bold: 1 }, shape: { interests: { art: 2, sport: 2 }, traits: { bold: 6 } }, outcomes: [[1, '실기 학원을 다니며 예체능 입시를 준비했다.', { happiness: 2, ability: -1 }]], then: (x) => (x.flags.track = 'arts') });
      return opts;
    },
  },

  // ── 대학과 청년기 ──
  {
    id: 'major', ages: [19, 23], chance: 1, when: (l) => inCollege(l) && !l.major,
    prompt: '어느 학과로 갈까?',
    options: (l) => {
      const top = l.topInterests(2);
      const opts: PathOption[] = top.map((k) => {
        const m = l.pickFrom(MAJORS[k]);
        return { label: m, desc: '좋아하는 쪽으로', auto: 3, lean: { [k]: 1 }, shape: { interests: { [k]: 3 } }, outcomes: [[1, `${m}에 들어갔다.`, { happiness: 3 }]], then: (x: Life) => (x.major = m) };
      });
      const safe = l.flags.track === 'science' ? '전자공학과' : '경영학과';
      if (!opts.some((o) => o.label === safe)) opts.push({ label: safe, desc: '취업이 잘 된다는 과', auto: 2, lean: { bold: -1 }, shape: { interests: { [l.flags.track === 'science' ? 'tech' : 'biz']: 2 } }, outcomes: [[1, `취업을 생각해 ${josa(safe, '을/를')} 골랐다.`, { happiness: -1 }]], then: (x) => (x.major = safe) });
      return opts;
    },
  },
  {
    id: 'campus', ages: [20, 24], chance: 0.6, when: inCollege,
    prompt: '대학 시절 가장 열심이었던 것은?',
    options: (l) => {
      const opts: PathOption[] = [
        { label: '동아리·학생회', auto: 2, lean: { social: 1 }, shape: { traits: { social: 10 } }, outcomes: [[1, '동아리방에서 밤을 새우며 평생 친구들을 만났다.', { relation: 5, happiness: 3 }], [1, '학생회 일로 학점은 떨어졌지만 사람을 얻었다.', { relation: 4, ability: -1 }]] },
        { label: '학점 관리', auto: 2, lean: { diligent: 1 }, shape: { traits: { diligent: 10 } }, outcomes: [[1, '장학금을 받았다.', { ability: 3, cash: 200 }], [1, '도서관 맨 앞자리가 내 자리였다.', { ability: 3, happiness: -1 }]] },
        { label: '아르바이트로 돈 모으기', auto: 2, lean: { thrift: 1 }, shape: { traits: { thrift: 10 }, interests: { biz: 2 } }, outcomes: [[1, '학비 일부를 아르바이트로 벌었다.', { cash: 300, health: -1 }]] },
      ];
      if (l.year >= 1989) opts.push({ label: '휴학하고 떠난다', desc: '여행이나 어학연수', auto: 1, lean: { bold: 1 }, shape: { traits: { bold: 12 } }, outcomes: [[1, '휴학하고 배낭여행을 떠났다. 세상이 넓었다.', { happiness: 6, cash: -300 }], [1, '어학연수를 다녀왔다.', { ability: 3, cash: -800 }]] });
      return opts;
    },
  },
  {
    id: 'cert', ages: [23, 34], chance: 0.25, when: working,
    prompt: '퇴근 뒤에 자격증 공부를 해 볼까?',
    options: (l) => [
      { label: '해 본다', desc: '몇 달은 저녁이 없다', auto: 2, lean: { diligent: 1 }, shape: { traits: { diligent: 6 } }, outcomes: [[2, `${l.certName()} 자격증을 땄다.`, { ability: 3, happiness: 2 }], [1, '두 번 떨어지고 그만뒀다.', { happiness: -2 }]] },
      { label: '저녁은 쉬어야 한다', auto: 3, lean: { diligent: -1 }, shape: { traits: { diligent: -3 } }, outcomes: [[1, '퇴근하면 쉬는 게 남는 거라고 생각했다.', { happiness: 1, health: 1 }]] },
    ],
  },

  // ── 일: 이직·창업·대학원 ──
  {
    id: 'job-change', ages: [28, 45], chance: 0.25, when: office,
    prompt: '다른 회사로 옮길 기회가 생겼다.',
    options: () => [
      { label: '옮긴다', desc: '연봉은 오르지만 새로 적응해야 한다', auto: 2, lean: { bold: 1 }, shape: { traits: { bold: 8 } }, outcomes: [[3, '이직했다. 연봉이 올랐다.', { happiness: 3 }], [1, '이직했지만 새 회사 분위기가 맞지 않았다.', { happiness: -4 }]], then: (x) => x.raise(0.12) },
      { label: '남는다', desc: '익숙한 곳에서', auto: 3, lean: { bold: -1 }, shape: { traits: { bold: -5 } }, outcomes: [[1, '지금 회사에 남기로 했다.', { relation: 1 }]] },
    ],
  },
  {
    id: 'startup', ages: [30, 52], chance: 0.15, when: (l) => working(l) && l.job!.type !== 'self' && l.job!.type !== 'farm' && (l.trait('bold') >= 15 || l.interests.biz >= 6),
    prompt: '오래 생각해 온 사업을 시작해 볼까?',
    options: () => [
      { label: '회사를 그만두고 시작한다', desc: '창업 비용 약 5천만 원', auto: 1, lean: { bold: 1, biz: 1 }, shape: { traits: { bold: 10 } }, outcomes: [[1, '회사를 나와 내 사업을 시작했다.', { happiness: 4, cash: -5000 }]], then: (x) => x.beginJob('self', true) },
      { label: '아직은 때가 아니다', auto: 3, lean: { bold: -1 }, shape: { traits: { bold: -4 } }, outcomes: [[1, '사업 계획서는 서랍 속에 넣어 두었다.', { happiness: -1 }]] },
    ],
  },
  {
    id: 'grad-school', ages: [24, 36], chance: 0.15, when: (l) => fourYear(l) && l.trait('diligent') >= 10 && Math.max(l.interests.science, l.interests.words, l.interests.tech) >= 6,
    prompt: '대학원에 가서 공부를 더 해 볼까?',
    options: () => [
      { label: '대학원에 간다', desc: '2년 동안 학비와 시간이 든다', auto: 1, lean: { diligent: 1 }, shape: { traits: { diligent: 6 } }, outcomes: [[1, '석사 학위를 받았다.', { ability: 5, cash: -2500, happiness: -1 }]], then: (x) => x.raise(0.08) },
      { label: '일하면서 배운다', auto: 3, outcomes: [[1, '현장에서 배우는 게 더 많다고 생각했다.', { ability: 1 }]] },
    ],
  },
  {
    id: 'transfer', ages: [30, 50], chance: 0.1, when: (l) => !!l.job && ['large', 'public'].includes(l.job.type),
    prompt: (l) => (l.year >= 1990 && l.job?.type === 'large' ? '해외 지사로 발령이 났다.' : '먼 지방으로 발령이 났다.'),
    options: (l) => [
      { label: '간다', auto: 2, lean: { bold: 1 }, shape: { traits: { bold: 6 } }, outcomes: [[1, l.year >= 1990 && l.job?.type === 'large' ? '몇 년을 낯선 나라에서 일했다. 견문이 넓어졌다.' : '몇 년을 낯선 동네에서 일했다.', { ability: 3, relation: -2 }]], then: (x) => x.raise(0.06) },
      { label: '가족 때문에 남게 해 달라고 한다', auto: 2, lean: { social: 1 }, outcomes: [[2, '사정을 말했더니 다른 사람이 갔다.', { relation: 2 }], [1, '남는 대신 승진이 한 해 늦어졌다.', { happiness: -2 }]] },
    ],
  },
  {
    id: 'side-job', ages: [26, 50], chance: 0.12, from: 2012, when: working,
    prompt: '퇴근 뒤에 부업을 해 볼까?',
    options: (l) => {
      const k = l.mainInterest();
      const what = k === 'art' || k === 'words' ? '온라인에 글과 그림을 올리는 일' : k === 'tech' ? '앱과 홈페이지 외주' : k === 'biz' ? '온라인 쇼핑몰' : '배달 아르바이트';
      return [
        { label: what, auto: 1, lean: { bold: 1, biz: 1 }, shape: { traits: { bold: 4, thrift: 4 }, interests: { biz: 2 } }, outcomes: [[1, `${josa(what, '으로/로')} 한 해 수백만 원을 더 벌었다.`, { cash: 400, health: -2 }], [1, `${josa(what, '을/를')} 시작했지만 생각만큼 되지 않았다.`, { happiness: -2, health: -1 }]] },
        { label: '하지 않는다', auto: 3, outcomes: [[1, '저녁 시간은 나를 위해 쓰기로 했다.', { happiness: 1 }]] },
      ];
    },
  },
  {
    id: 'lend-money', ages: [30, 65], chance: 0.08, when: (l) => l.independent && l.cash > 1000 * l.wage,
    prompt: '오랜 친구가 돈을 빌려 달라고 했다.',
    options: () => [
      { label: '빌려준다', auto: 2, lean: { social: 1, thrift: -1 }, shape: { traits: { social: 5 } }, outcomes: [[1, '친구는 약속한 날에 돈을 갚았다.', { relation: 3 }], [1, '친구는 연락이 끊겼다. 돈도 사람도 잃었다.', { relation: -4, happiness: -4, cash: -1000 }]] },
      { label: '거절한다', auto: 2, lean: { thrift: 1 }, shape: { traits: { thrift: 5, social: -3 } }, outcomes: [[1, '미안하다고 했다. 친구와 조금 서먹해졌다.', { relation: -2 }]] },
    ],
  },
  {
    id: 'travel', ages: [25, 70], chance: 0.12, from: 1989, when: (l) => l.independent && l.cash > 500 * l.wage,
    prompt: '긴 휴가가 생겼다.',
    options: (l) => [
      { label: l.year >= 1995 ? '해외여행을 간다' : '제주도 여행을 간다', auto: 2, lean: { bold: 1, thrift: -1 }, shape: { traits: { bold: 4, thrift: -4 } }, outcomes: [[1, l.year >= 1995 ? '처음 보는 나라의 거리를 오래 걸었다.' : '신혼여행 이후 처음으로 비행기를 탔다.', { happiness: 6, cash: -300 }]] },
      { label: '집에서 푹 쉰다', auto: 2, lean: { thrift: 1 }, shape: { traits: { thrift: 4 } }, outcomes: [[1, '늦잠을 자고 밀린 드라마를 봤다.', { happiness: 2, health: 1 }]] },
    ],
  },

  // ── 돈: 그 시대의 투자 열풍 (claude/money/SKILL.md) ──
  {
    id: 'venture-fever', ages: [24, 62], chance: 0.8, from: 1999, to: 2000, when: (l) => l.independent && l.cash > 500 * l.wage,
    prompt: '벤처 주식 열풍이 불었다. 너도나도 주식 이야기뿐이었다.',
    options: () => [
      { label: '모은 돈의 절반을 주식에 넣는다', auto: 1, lean: { bold: 1, biz: 1 }, shape: { traits: { bold: 8, thrift: -3 } }, outcomes: [[1, '증권사 객장에 처음 가 봤다.', { happiness: 2 }]], then: (x) => x.tiltPlan('stock', 50) },
      { label: '조금만 넣어 본다', auto: 2, outcomes: [[1, '남들 하는 만큼만 주식을 샀다.', {}]], then: (x) => x.tiltPlan('stock', 15) },
      { label: '예금에 그대로 둔다', auto: 3, lean: { bold: -1, thrift: 1 }, shape: { traits: { bold: -5 } }, outcomes: [[1, '거품이라는 생각이 들어 손대지 않았다.', {}]] },
    ],
  },
  {
    id: 'fund-fever', ages: [25, 62], chance: 0.6, from: 2006, to: 2007, when: (l) => l.independent && l.cash > 300 * l.wage,
    prompt: '은행 창구마다 적립식 펀드를 권했다.',
    options: () => [
      { label: '펀드에 가입한다', auto: 2, lean: { bold: 1 }, outcomes: [[1, '다달이 펀드에 돈을 넣었다.', {}]], then: (x) => { x.tiltPlan('stock', 20); if (x.year >= 2007) x.tiltPlan('global', 10); } },
      { label: '적금이 낫다', auto: 3, lean: { thrift: 1 }, outcomes: [[1, '이자는 적어도 원금이 깨지지 않는 게 좋았다.', {}]] },
    ],
  },
  {
    id: 'ant-fever', ages: [22, 65], chance: 0.6, from: 2020, to: 2021, when: (l) => l.independent && l.cash > 300 * l.wage,
    prompt: '주변 사람들이 모두 주식 앱을 깔았다.',
    options: () => [
      { label: '국내 주식을 산다', auto: 2, lean: { bold: 1 }, shape: { traits: { bold: 4 } }, outcomes: [[1, '점심시간마다 주식 앱을 열어 봤다.', {}]], then: (x) => x.tiltPlan('stock', 25) },
      { label: '미국 주식 지수에 넣는다', auto: 2, lean: { diligent: 1 }, outcomes: [[1, '미국 주식 지수 펀드에 다달이 넣기로 했다.', {}]], then: (x) => x.tiltPlan('global', 25) },
      { label: '하지 않는다', auto: 2, lean: { bold: -1 }, outcomes: [[1, '남들이 번다는 이야기를 못 들은 척했다.', {}]] },
    ],
  },
  {
    id: 'coin-fever', ages: [20, 55], chance: 0.5, from: 2021, to: 2021, when: (l) => l.independent && l.cash > 200 * l.wage,
    prompt: '코인으로 몇 배를 벌었다는 이야기가 들려왔다.',
    options: () => [
      { label: '나도 해 본다', auto: 1, lean: { bold: 1 }, shape: { traits: { bold: 8, thrift: -4 } }, outcomes: [[1, '새벽에도 코인 시세를 들여다봤다.', { health: -1 }]], then: (x) => x.tiltPlan('crypto', 20) },
      { label: '아주 조금만', auto: 2, outcomes: [[1, '잃어도 괜찮을 만큼만 넣었다.', {}]], then: (x) => x.tiltPlan('crypto', 5) },
      { label: '거들떠보지 않는다', auto: 3, lean: { bold: -1 }, outcomes: [[1, '실체가 없는 것에는 돈을 넣지 않기로 했다.', {}]] },
    ],
  },
  {
    id: 'index-fund', ages: [28, 55], chance: 0.15, from: 2027, when: (l) => l.independent && l.riskShare < 0.2 && l.cash > 1000 * l.wage,
    prompt: '월급만으로는 노후가 막막하다는 생각이 들었다.',
    options: () => [
      { label: '주식 지수 펀드에 꾸준히 넣는다', auto: 2, lean: { diligent: 1 }, outcomes: [[1, '국내외 주식 지수에 나눠 넣기 시작했다.', {}]], then: (x) => { x.tiltPlan('stock', 15); x.tiltPlan('global', 20); } },
      { label: '예금이 마음 편하다', auto: 2, lean: { bold: -1 }, outcomes: [[1, '예금 금리를 비교해 조금 더 주는 곳으로 옮겼다.', {}]] },
    ],
  },
  {
    id: 'safe-money', ages: [60, 80], chance: 0.5, when: (l) => l.riskShare >= 0.3,
    prompt: '나이가 들수록 돈을 안전한 곳에 두라는 말을 들었다.',
    options: () => [
      { label: '투자를 정리해 예금으로 옮긴다', auto: 3, lean: { bold: -1 }, outcomes: [[1, '투자를 정리하고 예금으로 옮겼다. 마음이 편해졌다.', { happiness: 2 }]], then: (x) => x.safePlan() },
      { label: '그대로 둔다', auto: 1, lean: { bold: 1 }, outcomes: [[1, '오래 들고 있으면 오른다고 믿었다.', {}]] },
    ],
  },
  {
    id: 'spend-style', ages: [26, 40], chance: 0.35, when: (l) => l.independent && working(l),
    prompt: '월급날, 이번 달 돈을 어떻게 쓸지 생각했다.',
    options: (l) => [
      { label: '아껴 쓰고 모은다', desc: '소득의 40%를 모은다', auto: 1.5, lean: { thrift: 1 }, shape: { traits: { thrift: 10 } }, outcomes: [[1, '가계부를 쓰기 시작했다.', {}]], then: (x) => x.setSpend('frugal') },
      { label: '쓸 만큼 쓴다', desc: '소득의 30%를 모은다', auto: 3, outcomes: [[1, l.year >= 2015 ? '모을 만큼 모으고 나머지는 나를 위해 썼다.' : '모을 만큼 모으고 나머지는 생활비로 썼다.', {}]], then: (x) => x.setSpend('normal') },
      { label: '하고 싶은 건 한다', desc: '소득의 20%를 모은다', auto: 1.5, lean: { thrift: -1 }, shape: { traits: { thrift: -10 } }, outcomes: [[1, '한 번 사는 인생이라고 생각했다.', { happiness: 2 }]], then: (x) => x.setSpend('loose') },
    ],
  },

  // ── 중년: 자녀와 부모 ──
  {
    id: 'kid-edu', ages: [38, 58], chance: 0.35, when: childAged(10, 17),
    prompt: '아이 사교육을 어떻게 할까?',
    options: () => [
      { label: '학원을 여러 개 보낸다', desc: '한 해 수백만 원', auto: 2, lean: { thrift: -1 }, shape: { traits: { thrift: -5 } }, outcomes: [[1, '학원비 고지서가 매달 쌓였다.', { cash: -1200, happiness: -2 }]] },
      { label: '꼭 필요한 것만', auto: 3, lean: { thrift: 1 }, shape: { traits: { thrift: 5 } }, outcomes: [[1, '수학 학원 하나만 보냈다.', { cash: -400 }]] },
      { label: '아이가 원하는 걸 하게 둔다', auto: 1, lean: { bold: 1 }, outcomes: [[1, '아이는 좋아하는 것을 찾아 즐겁게 다녔다.', { relation: 4, happiness: 2 }], [1, '다른 집 아이들과 비교하며 마음이 불안했다.', { happiness: -2 }]] },
    ],
  },
  {
    id: 'parents-care', ages: [42, 65], chance: 0.25, when: (l) => !l.flags.parentsGone,
    prompt: '부모님이 편찮으셔서 돌봄이 필요해졌다.',
    options: (l) => {
      const opts: PathOption[] = [
        { label: '모시고 산다', auto: l.year < 2000 ? 4 : 2, lean: { social: 1 }, shape: { interests: { care: 3 } }, outcomes: [[1, '부모님을 모시고 살았다. 몸은 힘들어도 마음은 편했다.', { relation: 4, happiness: -3, health: -2 }]] },
        { label: '형제들과 돌아가며 돌본다', auto: 2, outcomes: [[2, '형제들과 주말마다 돌아가며 부모님 댁에 갔다.', { relation: 2, health: -1 }], [1, '누가 더 했냐를 두고 형제끼리 다퉜다.', { relation: -3 }]] },
      ];
      if (l.year >= 2008) opts.push({ label: '요양 시설에 모신다', desc: '한 해 천만 원 남짓', auto: 2, lean: { thrift: -1 }, outcomes: [[1, '요양원에 모셨다. 주말마다 찾아뵈었다.', { cash: -1200, happiness: -2 }]] });
      return opts;
    },
  },
  {
    id: 'reunion', ages: [40, 65], chance: 0.12,
    prompt: '오랜만에 동창회 연락이 왔다.',
    options: () => [
      { label: '나간다', auto: 2, lean: { social: 1 }, shape: { traits: { social: 5 } }, outcomes: [[2, '서로 늙었다며 한참을 웃었다.', { relation: 4, happiness: 3 }], [1, '누구는 잘나간다는 이야기에 괜히 위축됐다.', { happiness: -2 }]] },
      { label: '핑계를 대고 빠진다', auto: 2, lean: { social: -1 }, shape: { traits: { social: -5 } }, outcomes: [[1, '단체 사진만 나중에 받아 봤다.', { relation: -1 }]] },
    ],
  },

  // ── 은퇴를 앞두고 ──
  {
    id: 'retire-plan', ages: [50, 60], chance: 0.3, when: (l) => working(l) && !!l.job?.main && !l.flags.retirePlan,
    prompt: '은퇴 뒤를 어떻게 준비할까?',
    options: (l) => {
      const k = l.mainInterest();
      const opts: PathOption[] = [
        { label: '연금과 저축을 늘린다', auto: 3, lean: { thrift: 1 }, shape: { traits: { thrift: 6 } }, outcomes: [[1, '생활비를 줄이고 노후 자금을 모았다.', { happiness: -1, cash: 300 }]], then: (x) => (x.flags.retirePlan = 'save') },
        { label: '새 일을 배워 둔다', desc: k ? `${INTEREST_WORK[k]} 쪽` : '자격증', auto: 2, lean: { diligent: 1 }, shape: { traits: { diligent: 4 } }, outcomes: [[1, '주말마다 학원에 다니며 새 일을 배웠다.', { ability: 2 }]], then: (x) => (x.flags.retirePlan = 'work') },
      ];
      if (l.interests.nature >= 4 || l.residence.group === 'province') opts.push({ label: '귀농을 준비한다', auto: 1, lean: { nature: 1, bold: 1 }, shape: { interests: { nature: 3 } }, outcomes: [[1, '주말마다 시골에 내려가 밭을 알아봤다.', { happiness: 2, health: 1 }]], then: (x) => (x.flags.retirePlan = 'farm') });
      return opts;
    },
  },

  // ── 노년: 남는 시간 ──
  {
    id: 'hobby', ages: [58, 80], chance: 0.3, when: (l) => !working(l) || l.age >= 65,
    prompt: '남는 시간에 무엇을 해 볼까?',
    options: (l) => {
      const all: Record<InterestKey, PathOption> = {
        art: { label: '그림을 배운다', auto: 2, lean: { art: 1 }, shape: { interests: { art: 2 } }, outcomes: [[1, '복지관 그림 교실에서 그린 수채화로 전시회를 열었다.', { happiness: 5, relation: 2 }]] },
        sport: { label: '운동 모임에 나간다', auto: 2, lean: { sport: 1 }, shape: { interests: { sport: 2 } }, outcomes: [[1, '새벽마다 동네 사람들과 배드민턴을 쳤다.', { health: 4, relation: 3 }]] },
        words: { label: '지난 이야기를 글로 쓴다', auto: 2, lean: { words: 1 }, shape: { interests: { words: 2 } }, outcomes: [[1, '살아온 이야기를 글로 써서 자식들에게 묶어 주었다.', { happiness: 5, relation: 2 }]] },
        nature: { label: '텃밭을 가꾼다', auto: 2, lean: { nature: 1 }, shape: { interests: { nature: 2 } }, outcomes: [[1, '주말농장에서 키운 채소를 이웃과 나눴다.', { health: 3, relation: 2 }]] },
        care: { label: '봉사를 한다', auto: 2, lean: { care: 1 }, shape: { interests: { care: 2 } }, outcomes: [[1, '무료 급식소에서 일주일에 두 번 배식을 도왔다.', { relation: 4, happiness: 4 }]] },
        tech: { label: '새로운 기술을 배워 본다', auto: 1, lean: { tech: 1 }, shape: { interests: { tech: 2 } }, outcomes: [[1, l.birthYear <= 1965 ? '영상 편집을 배워 손주 동영상을 만들었다.' : '혼자서 작은 프로그램을 만들어 봤다.', { ability: 2, happiness: 3 }]] },
        science: { label: '강좌를 들으러 다닌다', auto: 1, lean: { science: 1 }, shape: { interests: { science: 2 } }, outcomes: [[1, '시민 대학에서 천문학 강의를 들었다.', { ability: 2, happiness: 3 }]] },
        biz: { label: '작은 장사를 해 본다', auto: 1, lean: { biz: 1 }, outcomes: [[1, '동네 장터에 좌판을 열었다. 쏠쏠했다.', { happiness: 3, cash: 100 }], [1, '장사는 생각보다 어려웠다.', { happiness: -2, cash: -200 }]] },
      };
      const top = l.topInterests(3);
      const opts = top.map((k) => all[k]);
      for (const k of ['sport', 'nature', 'care'] as InterestKey[]) if (opts.length < 3 && !top.includes(k)) opts.push(all[k]);
      opts.push({ label: '그냥 쉰다', auto: 1, outcomes: [[1, '텔레비전 앞에서 하루가 갔다.', { happiness: -1 }]] });
      return opts;
    },
  },
  {
    id: 'grandchild-care', ages: [55, 75], chance: 0.4, when: (l) => !!l.flags.grandchild && !l.flags.grandCareAsked,
    prompt: '자식이 맞벌이라 손주를 봐 달라고 했다.',
    options: () => [
      { label: '봐 준다', auto: 3, lean: { social: 1 }, shape: { interests: { care: 2 } }, outcomes: [[1, '손주를 키우며 하루가 짧았다. 허리가 아팠다.', { happiness: 4, health: -3, relation: 4 }]], then: (x) => (x.flags.grandCareAsked = true) },
      { label: '이제는 내 삶을 살고 싶다고 말한다', auto: 1, lean: { bold: 1 }, outcomes: [[1, '자식은 서운해했지만 이해해 주었다.', { relation: -2, happiness: 2 }]], then: (x) => (x.flags.grandCareAsked = true) },
    ],
  },
];

/** 관심 분야별 은퇴 뒤 일 */
export const INTEREST_WORK: Record<InterestKey, string> = {
  science: '과학 강사', words: '문화센터 강사', art: '공방', sport: '생활체육 지도', tech: '컴퓨터 강사', care: '요양보호', biz: '가게', nature: '귀농',
};
