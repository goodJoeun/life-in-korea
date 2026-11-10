/*
 * 5000만분의 1 — 시도별 인구와 연령 구조 (오른쪽 패널의 지도·인구 분포표용)
 *
 * 게임 확률에는 쓰지 않는다. 그해 대한민국이 대략 어땠는지 보여 주기만 한다.
 *
 * 출처 (천 명 단위로 반올림한 근사치)
 *  - 1960~2010: 인구총조사 시도별 인구 (통계청)
 *  - 2020·2024: 주민등록인구 시도별 연말 인구 (행정안전부)
 *  - 2052: 시도별 장래인구추계 2022~2052 중위 (통계청)
 *  - 2060·2072: 장래인구추계 2022~2072 중위 전국 인구. 시도 비중은 2052년 그대로 둔다.
 *  - 연령 구조: 인구총조사 · 장래인구추계 중위의 0~14세 / 15~64세 / 65세 이상 비중
 *
 * 표기: (공식) 공표치 그대로 · (추정) 공표치로 만든 근사치 · (추계) 장래인구추계
 * 아래 값은 모두 공표치를 천 명 단위로 옮긴 근사치이고, 광역시·세종이 생기기 전 해는
 * 당시 부모 도 인구에서 지금 경계만큼 떼어 낸 값이다. (추정)
 * 연도 사이는 앞뒤 값을 직선으로 잇는다. 2072년 이후는 2072년 추계를 그대로 쓴다.
 */
import { REGION_IDS, type RegionId } from './births';
import { at } from './timeline';

type Series = [number, number][];

const YEARS = [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2024, 2052] as const;
/** 1960~2010 인구총조사(추정: 지금 경계로 나눔) · 2020·2024 주민등록(공식, 천 명 반올림) · 2052 추계 */
const REGION_POP: Record<RegionId, number[]> = {
  //          1960   1970   1980   1990   2000   2010   2020   2024   2052
  seoul:     [2445,  5433,  8364, 10613,  9853,  9631,  9668,  9335,  7930],
  busan:     [1164,  1842,  3160,  3798,  3663,  3415,  3391,  3266,  2510],
  daegu:     [ 676,  1063,  1605,  2229,  2481,  2446,  2418,  2363,  1950],
  incheon:   [ 402,   634,  1084,  1818,  2475,  2663,  2942,  3021,  2980],
  gwangju:   [ 314,   502,   728,  1139,  1353,  1476,  1450,  1408,  1220],
  daejeon:   [ 229,   415,   652,  1050,  1368,  1502,  1463,  1440,  1280],
  ulsan:     [ 220,   300,   570,   830,  1014,  1082,  1136,  1097,   880],
  sejong:    [ 110,   110,    95,    85,    85,    85,   355,   391,   620],
  gyeonggi:  [2347,  2724,  3850,  6155,  8984, 11379, 13427, 13694, 13870],
  gangwon:   [1637,  1866,  1791,  1580,  1487,  1471,  1542,  1517,  1370],
  chungbuk:  [1369,  1481,  1424,  1390,  1466,  1512,  1600,  1591,  1540],
  chungnam:  [2189,  2334,  2209,  1929,  1755,  1943,  2121,  2135,  2170],
  jeonbuk:   [2395,  2434,  2288,  2069,  1891,  1777,  1804,  1739,  1430],
  jeonnam:   [3239,  3503,  3052,  2507,  1996,  1741,  1851,  1790,  1490],
  gyeongbuk: [3173,  3496,  3351,  2861,  2725,  2600,  2639,  2531,  2180],
  gyeongnam: [2863,  2819,  2752,  2842,  2978,  3160,  3340,  3236,  2690],
  jeju:      [ 282,   365,   463,   515,   513,   532,   675,   670,   690],
};

const series = (values: number[]): Series => YEARS.map((y, i) => [y, values[i]]);
const REGION_SERIES = Object.fromEntries(REGION_IDS.map((id) => [id, series(REGION_POP[id])])) as Record<RegionId, Series>;

/**
 * 2024~2052 사이 전국 인구의 굽은 모양. (추계) 장래인구추계 2022~2072 중위, 만 명.
 * 시도 값을 직선으로 이으면 감소가 너무 일찍 시작되므로, 이 추계가 직선에서 벗어난 비율만큼 곱한다.
 */
const NATIONAL_2024_2052: Series = [
  [2024, 5175],
  [2030, 5131],
  [2040, 5006],
  [2050, 4711],
  [2052, 4627],
];
function curve(year: number): number {
  if (year <= 2024 || year >= 2052) return 1;
  const straight = 5175 + ((4627 - 5175) * (year - 2024)) / (2052 - 2024);
  return at(NATIONAL_2024_2052, year) / straight;
}

/** 2052년 시도 합계에 곱할 배율. (추계) 전국 인구 2052 4,627만 → 2060 4,230만 → 2072 3,622만 */
const AFTER_2052: Series = [
  [2052, 1],
  [2060, 4230 / 4627],
  [2072, 3622 / 4627],
];

/** 연령 구조 (%) [0~14세, 15~64세, 65세 이상]. 2030년부터 (추계) */
const AGE_SHARE: [number, [number, number, number]][] = [
  [1960, [42.3, 54.8, 2.9]],
  [1970, [42.5, 54.4, 3.1]],
  [1980, [34.0, 62.2, 3.8]],
  [1990, [25.6, 69.3, 5.1]],
  [2000, [21.1, 71.7, 7.2]],
  [2010, [16.1, 72.9, 11.0]],
  [2020, [12.2, 72.1, 15.7]],
  [2024, [10.6, 70.2, 19.2]],
  [2030, [8.5, 66.2, 25.3]],
  [2040, [7.5, 58.2, 34.3]],
  [2050, [8.3, 51.6, 40.1]],
  [2060, [7.6, 48.2, 44.2]],
  [2072, [6.6, 45.7, 47.7]],
];
const AGE_SERIES = [0, 1, 2].map((k) => AGE_SHARE.map(([y, v]) => [y, v[k]] as [number, number]));

export const REGION_SHORT: Record<RegionId, string> = {
  seoul: '서울', busan: '부산', daegu: '대구', incheon: '인천', gwangju: '광주', daejeon: '대전', ulsan: '울산', sejong: '세종',
  gyeonggi: '경기', gangwon: '강원', chungbuk: '충북', chungnam: '충남', jeonbuk: '전북', jeonnam: '전남',
  gyeongbuk: '경북', gyeongnam: '경남', jeju: '제주',
};

export interface RegionPopulation { id: RegionId; name: string; pop: number; share: number }
export interface PopulationView {
  year: number;
  /** 명 */
  total: number;
  /** 인구 많은 순 */
  regions: RegionPopulation[];
  /** % [0~14세, 15~64세, 65세 이상] */
  ages: [number, number, number];
  kind: '추정' | '공식' | '추계';
}

/** year 년의 시도별 인구(명)와 연령 구조 */
export function populationIn(year: number): PopulationView {
  const scale = year > 2052 ? at(AFTER_2052, year) : curve(year);
  const regions = REGION_IDS.map((id) => ({ id, name: REGION_SHORT[id], pop: at(REGION_SERIES[id], year) * 1000 * scale, share: 0 }));
  const total = regions.reduce((s, r) => s + r.pop, 0);
  for (const r of regions) r.share = r.pop / total;
  regions.sort((a, b) => b.pop - a.pop);
  const raw = AGE_SERIES.map((s) => at(s, year));
  const sum = raw[0] + raw[1] + raw[2];
  const ages = raw.map((v) => (v / sum) * 100) as [number, number, number];
  const kind = year > 2024 ? '추계' : year === 2020 || year === 2024 ? '공식' : '추정';
  return { year, total, regions, ages, kind };
}

/** 게임 속 사는 곳 이름(서울, 경기 …)을 시도 id 로 */
export function regionIdByShortName(name: string): RegionId | null {
  return REGION_IDS.find((id) => REGION_SHORT[id] === name) ?? null;
}
