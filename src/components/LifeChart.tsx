'use client';

/*
 * 결과 리포트의 생애 그래프 (claude/report/SKILL.md, dataviz 규칙).
 * 손으로 그린 SVG: 선 2px, 면은 10% 옅은 채움, 점 8px + 흰 테두리, 격자 1px 실선, 한 축만.
 * 마우스·터치·키보드로 가장 가까운 나이에 세로 기준선이 붙고, 툴팁에 그 나이의 모든 값이 나온다.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  area?: boolean;
}
interface Props {
  ages: number[];
  series: ChartSeries[];
  /** 축 눈금과 툴팁 숫자 */
  format: (v: number) => string;
  /** 축 눈금(짧게) */
  tick?: (v: number) => string;
  /** 첫 번째 선 위에 점으로 찍을 큰 일 */
  moments?: { age: number; label: string }[];
  height?: number;
  /** 값 범위를 고정 (상태 수치 0~100 등) */
  domain?: [number, number];
  label: string;
}

const PAD = { l: 52, r: 14, t: 16, b: 26 };

function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** 사건 점의 자리와 이름표 줄. 가까운 이름표는 한 줄씩 위로 비키고, 세 줄을 넘으면 점만 남긴다(row -1) */
function placeMoments(moments: { age: number; label: string }[], ages: number[], values: (number | null)[], x: (a: number) => number, y: (v: number) => number) {
  const out: { label: string; px: number; py: number; row: number }[] = [];
  const rows: number[] = []; // 줄마다 마지막 이름표의 오른쪽 끝
  for (const m of moments) {
    const i = ages.indexOf(m.age);
    const v = i >= 0 ? values[i] : null;
    if (v === null || v === undefined) continue;
    const px = x(m.age);
    const half = m.label.length * 6 + 4;
    let row = rows.findIndex((end) => px - half > end);
    if (row < 0) row = rows.length < 3 ? rows.length : -1;
    if (row >= 0) rows[row] = px + half;
    out.push({ label: m.label, px, py: y(v), row });
  }
  return out;
}

export default function LifeChart({ ages, series, format, tick = format, moments = [], height = 200, domain, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  let [lo, hi] = domain ?? [Math.min(0, ...all), Math.max(1, ...all)];
  if (!domain) { const pad = (hi - lo) * 0.08; hi += pad; if (lo < 0) lo -= pad; }
  const ticks = domain ? niceTicks(lo, hi, 4) : niceTicks(lo, hi, 4);
  if (!domain) { lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]); }
  const a0 = ages[0] ?? 0, a1 = ages[ages.length - 1] ?? 1;
  const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const x = (age: number) => PAD.l + (a1 === a0 ? iw / 2 : ((age - a0) / (a1 - a0)) * iw);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * ih;

  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(ages[i]).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const areaPath = (vals: (number | null)[]) => {
    const pts = vals.map((v, i) => (v === null ? null : [x(ages[i]), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
    if (pts.length < 2) return '';
    const base = y(Math.max(lo, Math.min(hi, 0)));
    return `M${pts[0][0]},${base}` + pts.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join('') + `L${pts[pts.length - 1][0]},${base}Z`;
  };

  const xTicks = niceTicks(a0, a1, Math.min(8, Math.max(3, Math.floor(iw / 70))));
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const age = a0 + ((clientX - r.left - PAD.l) / iw) * (a1 - a0);
    let best = 0;
    ages.forEach((a, i) => { if (Math.abs(a - age) < Math.abs(ages[best] - age)) best = i; });
    setHover(best);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(ages.length - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? ages.length) - 1));
    else if (e.key === 'Escape') setHover(null);
  };
  const main = series[0];
  const hx = hover !== null ? x(ages[hover]) : 0;

  return (
    <div className="chart" ref={box}>
      {series.length > 1 && (
        <ul className="chart-legend">
          {series.map((s) => (
            <li key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={(e: PointerEvent) => pick(e.clientX)}
        onPointerDown={(e: PointerEvent) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-zero' : 'chart-grid'} />
            <text x={PAD.l - 8} y={y(t) + 4} className="chart-tick" textAnchor="end">{tick(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={height - 6} className="chart-tick" textAnchor="middle">{t}세</text>
        ))}
        {series.map((s) => (
          <g key={s.key}>
            {s.area && <path d={areaPath(s.values)} fill={s.color} opacity={0.1} />}
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        {main && placeMoments(moments, ages, main.values, x, y).map((m) => (
          <g key={m.label}>
            <circle cx={m.px} cy={m.py} r={4} fill={main.color} stroke="#fff" strokeWidth={2} />
            {m.row >= 0 && <text x={m.px} y={m.py - 9 - m.row * 14} className="chart-moment" textAnchor="middle">{m.label}</text>}
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={PAD.t} y2={PAD.t + ih} className="chart-cross" />
            {series.map((s) => {
              const v = s.values[hover];
              return v === null ? null : <circle key={s.key} cx={hx} cy={y(v)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />;
            })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(hx, 70), w - 70) }} role="status">
          <b>{ages[hover]}세</b>
          {series.map((s) => {
            const v = s.values[hover];
            return (
              <span key={s.key}>
                <i style={{ background: s.color }} />
                {s.label} {v === null ? '—' : format(v)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
