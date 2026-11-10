'use client';

/*
 * 시작 화면 오른쪽의 남한 지도와 인구 분포표. 그해 시도별 인구를 색 농도로 칠한다.
 * 태어난 곳·사는 곳을 넘기면 지도에 표시한다. 표의 줄에 마우스를 올리면 지도에서 그 시도가 밝아진다.
 */
import { useMemo, useState } from 'react';
import type { RegionId } from '@/lib/births';
import { MAP_REGIONS } from '@/lib/koreaMap';
import { populationIn, regionIdByShortName } from '@/lib/population';

interface Props {
  year: number;
  /** 태어난 곳 (서울, 경기 …) */
  birthRegion?: string;
  /** 지금 사는 곳 */
  residence?: string;
}

/** 남한만 보이게 자른 영역 (koreaMap 좌표) */
const SOUTH_VIEWBOX = '52 236 266 278';
const AGE_LABELS = ['0~14세', '15~64세', '65세 이상'] as const;

const man = (n: number) => `${Math.round(n / 10000).toLocaleString('ko-KR')}만`;

export default function PopulationMap({ year, birthRegion, residence }: Props) {
  const view = useMemo(() => populationIn(year), [year]);
  const [focus, setFocus] = useState<RegionId | null>(null);
  const homeId = residence ? regionIdByShortName(residence) : null;
  const birthId = birthRegion ? regionIdByShortName(birthRegion) : null;
  const maxShare = view.regions[0].share;
  const shareOf = Object.fromEntries(view.regions.map((r) => [r.id, r.share])) as Record<RegionId, number>;
  const home = MAP_REGIONS.find((r) => r.id === homeId);
  const birth = birthId !== homeId ? MAP_REGIONS.find((r) => r.id === birthId) : undefined;

  return (
    <section className="side-card pop" aria-label={`${year}년 시도별 인구`}>
      <h3>
        {year}년 대한민국
        <span className="pop-kind">{view.kind}</span>
      </h3>
      <p className="pop-total">
        인구 약 <b>{man(view.total)} 명</b> · 65세 이상 <b>{view.ages[2].toFixed(1)}%</b>
      </p>

      <svg className="pop-map" viewBox={SOUTH_VIEWBOX} role="img" aria-label="시도별 인구 지도. 진할수록 인구가 많다.">
        {MAP_REGIONS.map((r) => {
          const id = r.id as RegionId;
          const t = Math.sqrt((shareOf[id] ?? 0) / maxShare);
          return (
            <path
              key={r.id}
              d={r.d}
              className={`pop-region${focus === id ? ' focus' : ''}`}
              style={{ fillOpacity: 0.12 + 0.78 * t }}
              onMouseEnter={() => setFocus(id)}
              onMouseLeave={() => setFocus(null)}
            >
              <title>{`${r.name} 약 ${man((shareOf[id] ?? 0) * view.total)} 명`}</title>
            </path>
          );
        })}
        {birth && <circle className="pop-birth" cx={birth.cx} cy={birth.cy} r="3.4" />}
        {home && (
          <g transform={`translate(${home.cx} ${home.cy}) scale(.55)`} className="pop-pin">
            <path d="M0,0 C-2,-6 -8,-10 -8,-16 A8,8 0 1 1 8,-16 C8,-10 2,-6 0,0 Z" />
            <circle cx="0" cy="-16" r="3" fill="var(--paper)" />
          </g>
        )}
      </svg>
      <p className="pop-legend">
        {home && (
          <>
            <span className="pop-key pin" /> 사는 곳
          </>
        )}
        {birth && (
          <>
            <span className="pop-key birth" /> 태어난 곳
          </>
        )}
        <span className="pop-key shade" /> 진할수록 인구가 많다
      </p>

      <table className="pop-table">
        <thead>
          <tr>
            <th scope="col">시도</th>
            <th scope="col">인구</th>
            <th scope="col">비중</th>
          </tr>
        </thead>
        <tbody>
          {view.regions.map((r) => (
            <tr
              key={r.id}
              className={`${r.id === homeId ? 'home' : ''}${focus === r.id ? ' focus' : ''}`}
              onMouseEnter={() => setFocus(r.id)}
              onMouseLeave={() => setFocus(null)}
            >
              <th scope="row">{r.name}</th>
              <td>{man(r.pop)}</td>
              <td className="pop-share">
                <span className="pop-bar" style={{ width: `calc((100% - 50px) * ${(r.share / maxShare).toFixed(3)})` }} />
                <span className="pop-num">{(r.share * 100).toFixed(1)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>나이대</h4>
      <div className="pop-ages" role="img" aria-label={AGE_LABELS.map((l, i) => `${l} ${view.ages[i].toFixed(1)}%`).join(', ')}>
        {view.ages.map((v, i) => (
          <span key={i} className={`pop-age a${i}`} style={{ width: `${v}%` }} />
        ))}
      </div>
      <dl className="pop-age-legend">
        {AGE_LABELS.map((l, i) => (
          <div key={l}>
            <dt>
              <span className={`pop-key a${i}`} /> {l}
            </dt>
            <dd>{view.ages[i].toFixed(1)}%</dd>
          </div>
        ))}
      </dl>
      <p className="side-note">통계청 인구총조사·주민등록인구·장래인구추계 근사치. {view.kind === '추계' ? '2025년 이후는 전망치.' : ''}</p>
    </section>
  );
}
