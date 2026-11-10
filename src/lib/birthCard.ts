/*
 * 출생 카드에 들어갈 내용. 화면(BirthCard)과 이미지·공유 글이 모두 이것을 쓴다.
 * 그해 전국 통계(timeline·births), 시도 인구(population), 연감(almanac)을 모은다.
 */
import { almanacFor } from './almanac';
import { isRegionId, regionBirthWeights, regionFullName, type RegionId } from './births';
import { yearPreview } from './engine';
import { populationIn } from './population';
import { josa } from './text';
import { at, BIRTHS } from './timeline';
import type { Sex } from './data';

export interface BirthCardInput {
  name: string;
  sex: Sex;
  regionId: string;
  birthYear: number;
  /** '보통' 같은 집안 형편 */
  familyLabel: string;
}

export interface BirthCardData {
  name: string;
  year: number;
  regionId: RegionId | null;
  /** 당시 행정구역 이름 (경상남도 부산시 …) */
  place: string;
  /** '보통 집 남자아이' */
  who: string;
  /** 그해 대한민국 */
  national: [string, string][];
  /** 태어난 곳 */
  local: [string, string][];
  kr: string[];
  world: string[];
  born: string[];
  /** 추정·전망치가 섞였는지 */
  note: string | null;
}

/** 명 → '약 28만 명' / '약 3,200명' */
export function people(n: number): string {
  if (n >= 1_000_000) return `약 ${Math.round(n / 10000).toLocaleString('ko-KR')}만 명`;
  if (n >= 10000) return `약 ${(Math.round(n / 1000) / 10).toLocaleString('ko-KR')}만 명`;
  return `약 ${Math.max(100, Math.round(n / 100) * 100).toLocaleString('ko-KR')}명`;
}

export function birthCardData(input: BirthCardInput): BirthCardData {
  const { birthYear: year } = input;
  const p = yearPreview(year);
  const pop = populationIn(year);
  const id = isRegionId(input.regionId) ? input.regionId : null;
  const rank = id ? pop.regions.findIndex((r) => r.id === id) + 1 : 0;
  const region = id ? pop.regions[rank - 1] : null;
  const localBirths = id ? regionBirthWeights(year)[id] * at(BIRTHS, year) : 0;
  const a = almanacFor(year);

  const national: [string, string][] = [
    ['출생아', `${people(p.births)} · 하루 ${Math.round(p.births / 365).toLocaleString('ko-KR')}명꼴`],
    ['합계출산율', `${p.tfr.toFixed(2)}명`],
    ['기대수명', `남 ${p.e0M.toFixed(1)}세 · 여 ${p.e0F.toFixed(1)}세`],
    ['인구', `${people(pop.total)} · 65세 이상 ${pop.ages[2].toFixed(1)}%`],
  ];
  const local: [string, string][] = region
    ? [
        ['인구', `${people(region.pop)} · 전국 ${rank}위 (${(region.share * 100).toFixed(1)}%)`],
        ['그해 이곳 출생아', people(localBirths)],
      ]
    : [];

  return {
    name: input.name,
    year,
    regionId: id,
    place: id ? regionFullName(id, year) : input.regionId,
    who: `${input.familyLabel} 집 ${input.sex === 'M' ? '남자아이' : '여자아이'}`,
    national,
    local,
    kr: a?.kr ?? [],
    world: a?.world ?? [],
    born: a?.born ?? [],
    note: p.estimated || pop.kind !== '공식' ? (year > 2025 ? '전망치가 섞여 있다.' : '일부는 추정치다.') : null,
  };
}

/** 공유용 글 */
export function birthCardText(d: BirthCardData): string {
  const lines = [
    `${d.year}년, ${d.place}에서 ${josa(d.name, '으로/로')} 태어났다. (${d.who})`,
    '',
    `[그해 대한민국] ${d.national.map(([k, v]) => `${k} ${v}`).join(' / ')}`,
  ];
  if (d.local.length) lines.push(`[태어난 곳] ${d.local.map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  if (d.kr.length || d.world.length) lines.push(`[그해 있었던 일] ${[...d.kr, ...d.world].join(' ')}`);
  if (d.born.length) lines.push(`[동갑내기] ${d.born.join(', ')}`);
  lines.push('', `너는 ${d.year}년에 누구로 태어날까? #5000만분의1`);
  return lines.join('\n');
}
