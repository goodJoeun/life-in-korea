/*
 * 5000만분의 1 — 통계 데이터
 *
 * ⚠ 모든 수치는 통계청(KOSIS)·관계부처 공개 통계를 바탕으로 한 "근사치"입니다.
 *   첫 버전은 개발 편의를 위해 기억에 의존해 채운 값이 섞여 있으므로,
 *   공개 전에 각 항목의 source 를 보고 KOSIS 에서 최신 값으로 교체하세요.
 *   (README.md 의 '데이터 검증 체크리스트' 참고)
 *
 * 이 파일은 '2024년 기준' 값이다. 연도별로 달라지는 값(출생·사망·진학·결혼·임금·집값 등)은 timeline.ts 에 있다.
 * 단위: 금액은 모두 "만원"(2024년 현재 가치, 물가 상승분 제외), 비율은 0~1.
 */
export type Sex = 'M' | 'F';
export type RegionGroup = 'capital' | 'metro' | 'province';
export type EduTier = 'elementary' | 'middle' | 'highschool' | 'college2' | 'local4' | 'capital4' | 'top4';
export type JobType = 'large' | 'public' | 'sme' | 'contract' | 'professional' | 'self' | 'farm' | 'none';

export const KDATA = {
  meta: {
    title: '5000만분의 1',
    population: 51_700_000, // 주민등록인구 약 5,170만 (2024 말)
    dataYear: '2023~2024 기준 근사치',
  },

  // ───────────────────────── 출생 ─────────────────────────
  // 시도 목록. births 는 2023 출생아 수(참고용). 실제 가중치는 출생 연도별로 src/lib/births.ts 에서 정한다.
  birthsByRegion: <{ id: string; name: string; births: number; group: RegionGroup }[]>[
    { id: 'seoul', name: '서울', births: 39500, group: 'capital' },
    { id: 'busan', name: '부산', births: 13100, group: 'metro' },
    { id: 'daegu', name: '대구', births: 10100, group: 'metro' },
    { id: 'incheon', name: '인천', births: 13600, group: 'capital' },
    { id: 'gwangju', name: '광주', births: 6300, group: 'metro' },
    { id: 'daejeon', name: '대전', births: 7000, group: 'metro' },
    { id: 'ulsan', name: '울산', births: 5100, group: 'metro' },
    { id: 'sejong', name: '세종', births: 3000, group: 'metro' },
    { id: 'gyeonggi', name: '경기', births: 69900, group: 'capital' },
    { id: 'gangwon', name: '강원', births: 7400, group: 'province' },
    { id: 'chungbuk', name: '충북', births: 7600, group: 'province' },
    { id: 'chungnam', name: '충남', births: 10200, group: 'province' },
    { id: 'jeonbuk', name: '전북', births: 7700, group: 'province' },
    { id: 'jeonnam', name: '전남', births: 7800, group: 'province' },
    { id: 'gyeongbuk', name: '경북', births: 10200, group: 'province' },
    { id: 'gyeongnam', name: '경남', births: 14000, group: 'province' },
    { id: 'jeju', name: '제주', births: 3300, group: 'province' },
  ],
  totalBirths: 230000, // 2023 출생아 약 23만 명
  tfr: 0.72, // 2023 합계출산율

  // 성씨 분포 (2015 인구주택총조사 근사, 상위 10개 + 기타)
  surnames: <[string, number][]>[
    ['김', 21.5], ['이', 14.7], ['박', 8.4], ['최', 4.7], ['정', 4.3],
    ['강', 2.4], ['조', 2.1], ['윤', 2.1], ['장', 2.0], ['임', 1.7],
    ['한', 1.5], ['오', 1.5], ['서', 1.5], ['신', 1.5], ['권', 1.4],
    ['황', 1.4], ['안', 1.4], ['송', 1.4], ['전', 1.1], ['홍', 1.1],
  ],
  // 최근 출생신고 인기 이름 (대법원 전자가족관계등록 통계 근사)
  givenNames: <Record<Sex, string[]>>{
    M: ['이준', '도윤', '하준', '서준', '은우', '시우', '유준', '지호', '선우', '이안', '수호', '건우', '우진', '로운', '연우'],
    F: ['이서', '서아', '하린', '지안', '아윤', '하윤', '지우', '서윤', '채아', '수아', '아린', '지유', '시아', '유나', '나은'],
  },

  // ───────────────────────── 가정 형편 ─────────────────────────
  // 가구 소득 5분위. 출처: 통계청 가계동향조사(2024 근사) 월평균 소득
  incomeQuintiles: [
    { q: 1, label: '형편이 어려운', monthly: 115, wealth: 1500 },
    { q: 2, label: '빠듯한', monthly: 290, wealth: 15000 },
    { q: 3, label: '평범한', monthly: 450, wealth: 32000 },
    { q: 4, label: '여유 있는', monthly: 650, wealth: 55000 },
    { q: 5, label: '넉넉한', monthly: 1150, wealth: 160000 },
  ],
  // wealth: 분위별 평균 순자산(만원). 출처: 가계금융복지조사(2024 근사)

  // ───────────────────────── 사망 ─────────────────────────
  // Gompertz-Makeham 모형: 연간 위험률 h(x) = (배경위험 + a·e^(b·x)) × 배수
  // a 는 해마다 그해 기대수명(timeline.ts)에 맞춰 엔진이 자동으로 보정한다. b 는 나이에 따른 증가 속도.
  mortality: {
    M: { b: 0.095 },
    F: { b: 0.105 },
    // 소득분위별 위험률 배수 (평균 1.0). 상·하위 20% 기대수명 격차 약 6~7년
    // 출처: 국민건강보험공단 소득분위별 기대수명 연구 (근사)
    quintileMultiplier: [1.32, 1.1, 0.98, 0.87, 0.73],
  },

  // 연령대별 사망원인 비중. 출처: 통계청 사망원인통계(2023 근사)
  // ※ 이 게임은 '고의적 자해(자살)'를 사망원인에서 제외하고 나머지 비중으로 재분배합니다.
  deathCauses: [
    { maxAge: 0, causes: <[string, number][]>[['출생 전후기에 생긴 질환', 55], ['선천 기형', 25], ['영아 돌연사', 12], ['사고', 8]] },
    { maxAge: 9, causes: <[string, number][]>[['사고', 30], ['암', 22], ['선천 기형', 20], ['신경계 질환', 15], ['폐렴', 13]] },
    { maxAge: 29, causes: <[string, number][]>[['교통사고', 30], ['암', 28], ['추락 등 사고', 16], ['심장 질환', 14], ['뇌혈관 질환', 6], ['익사', 6]] },
    { maxAge: 49, causes: <[string, number][]>[['암', 42], ['심장 질환', 15], ['간 질환', 11], ['교통사고', 10], ['뇌혈관 질환', 10], ['추락 등 사고', 7], ['당뇨병', 5]] },
    { maxAge: 69, causes: <[string, number][]>[['암', 48], ['심장 질환', 13], ['뇌혈관 질환', 9], ['간 질환', 7], ['폐렴', 7], ['당뇨병', 5], ['교통사고', 4], ['패혈증', 3], ['만성 폐질환', 4]] },
    { maxAge: 84, causes: <[string, number][]>[['암', 32], ['폐렴', 14], ['심장 질환', 13], ['뇌혈관 질환', 10], ['당뇨병', 5], ['알츠하이머병', 6], ['만성 폐질환', 5], ['패혈증', 5], ['고혈압성 질환', 4], ['신장 질환', 6]] },
    { maxAge: 200, causes: <[string, number][]>[['폐렴', 20], ['심장 질환', 15], ['암', 15], ['노쇠', 14], ['알츠하이머병', 10], ['뇌혈관 질환', 10], ['패혈증', 6], ['고혈압성 질환', 5], ['신장 질환', 5]] },
  ],
  cancerLifetimeRisk: 0.37, // 기대수명까지 생존 시 암 발생 확률 약 37% (국가암등록통계)

  // ───────────────────────── 교육 ─────────────────────────
  privateTutoring: { participation: 0.80, monthlyPerStudent: 47.4 }, // 2024 초중고 사교육비조사
  collegeEntryRate: 0.73, // 고등학교 졸업자 대학진학률 약 73% (교육기본통계)
  eduTiers: <Record<EduTier, { label: string; years: number }>>{
    elementary: { label: '초등학교 졸업', years: 0 },
    middle: { label: '중학교 졸업', years: 0 },
    highschool: { label: '고졸', years: 0 },
    college2: { label: '전문대 졸업', years: 2 },
    local4: { label: '지방 4년제 대학 졸업', years: 4 },
    capital4: { label: '수도권 4년제 대학 졸업', years: 4 },
    top4: { label: '상위권 대학 졸업', years: 4 },
  },

  // ───────────────────────── 군 복무 ─────────────────────────
  military: { activeDutyRate: 0.8, months: 18, alternativeRate: 0.17, exemptRate: 0.03 }, // 병무청 병역판정 근사

  // ───────────────────────── 일자리 ─────────────────────────
  // startSalary: 첫해 연봉(만원), growth: 50세까지의 연평균 실질 상승률(경력에 따른 상승)
  // 출처: 통계청 일자리행정통계 임금근로자 소득(대기업 월 591만, 중소기업 월 286만, 2023 근사)
  jobs: <Record<JobType, { label: string; startSalary: number; growth: number; stability: number }>>{
    large: { label: '대기업 정규직', startSalary: 5000, growth: 0.035, stability: 0.9 },
    public: { label: '공무원·공공기관', startSalary: 3000, growth: 0.03, stability: 0.99 },
    sme: { label: '중소기업 정규직', startSalary: 2900, growth: 0.022, stability: 0.8 },
    contract: { label: '비정규직', startSalary: 2400, growth: 0.01, stability: 0.6 },
    professional: { label: '전문직', startSalary: 7000, growth: 0.04, stability: 0.95 },
    self: { label: '자영업', startSalary: 3200, growth: 0.0, stability: 0.55 },
    farm: { label: '농림어업', startSalary: 2000, growth: 0.005, stability: 0.85 },
    none: { label: '무직', startSalary: 0, growth: 0, stability: 0 },
  },
  nonRegularShare: 0.382, // 임금근로자 중 비정규직 비중 (2024.8 경제활동인구조사 부가조사)
  selfEmployedShare: 0.2, // 취업자 중 자영업자 비중 약 20%
  youthEmploymentRate: 0.46, // 청년(15~29세) 고용률 약 46%
  mainJobRetireAge: 52.7, // 가장 오래 근무한 일자리 퇴직 연령 (경활 고령층 부가조사 근사)

  // ───────────────────────── 결혼·출산 ─────────────────────────
  marriage: {
    meanFirstAge: { M: 33.9, F: 31.5 }, // 2023 평균 초혼 연령
    neverMarriedAt50: { M: 0.2, F: 0.12 }, // 50세 시점 미혼 비율 목표치 (인구주택총조사 근사)
    annualDivorceRate: 0.004, // 유배우 인구 1,000명당 이혼 약 4건
  },
  marriedFertility: { first: 0.24, second: 0.11, third: 0.025 }, // 혼인 가구 연간 출산 확률(보정용 근사)

  // ───────────────────────── 주거 ─────────────────────────
  homeOwnershipRate: 0.564, // 주택 소유 가구 비율 (2023 주택소유통계)
  // 지역 그룹별 주택 평균가(만원). 출처: 한국부동산원·KB 아파트 평균 매매가 근사
  housePrice: <Record<'capitalSeoul' | RegionGroup, number>>{ capitalSeoul: 120000, capital: 55000, metro: 38000, province: 25000 },
  mortgageLTV: 0.7,

  // ───────────────────────── 노후 ─────────────────────────
  pensionMonthly: 65, // 국민연금 노령연금 월평균 수령액 약 65만원
  elderlyPovertyRate: 0.38, // 65세 이상 상대빈곤율 약 38~40%
};
