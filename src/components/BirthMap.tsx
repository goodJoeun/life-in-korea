'use client';

/*
 * 태어나는 장면: 한반도 지도 위에서 시도가 룰렛처럼 돌다가, 태어난 곳에 멈춰 핀이 꽂힌다.
 * 태어날 곳은 이미 엔진이 정했다(그해 시도별 출생아 비중). 이 화면은 그것을 보여 주기만 한다.
 * 멈춘 뒤에는 출생 카드를 보여 주고, '삶을 시작하기'를 눌러야 게임이 시작된다.
 */
import { useEffect, useMemo, useState } from 'react';
import { people } from '@/lib/birthCard';
import { isRegionId, regionBirthWeights, regionFullName } from '@/lib/births';
import type { Sex } from '@/lib/data';
import { MAP_REGIONS, MAP_VIEWBOX, NORTH_KOREA_PATH } from '@/lib/koreaMap';
import { at, BIRTHS } from '@/lib/timeline';
import BirthCard from './BirthCard';

interface Props {
  regionId: string;
  birthYear: number;
  name: string;
  sex: Sex;
  familyLabel: string;
  onDone: () => void;
}

const [, , VW, VH] = MAP_VIEWBOX.split(' ').map(Number);
const HOPS = 18; // 멈추기 전까지 불이 옮겨 다니는 횟수
const FIRST_DELAY = 60;
const LAST_DELAY = 420;

/** 불이 옮겨 다닐 순서: 무작위로 섞되 같은 곳이 연달아 나오지 않게, 마지막은 태어난 곳 */
function hopOrder(target: string): string[] {
  const ids = MAP_REGIONS.map((r) => r.id).filter((id) => id !== target);
  const out: string[] = [];
  let prev = '';
  for (let i = 0; i < HOPS - 1; i++) {
    const pool = ids.filter((id) => id !== prev);
    prev = pool[Math.floor(Math.random() * pool.length)];
    out.push(prev);
  }
  out.push(target);
  return out;
}

export default function BirthMap({ regionId, birthYear, name, sex, familyLabel, onDone }: Props) {
  const order = useMemo(() => hopOrder(regionId), [regionId]);
  const [step, setStep] = useState(0);
  const landed = step >= order.length - 1;
  const lit = order[Math.min(step, order.length - 1)];
  const target = MAP_REGIONS.find((r) => r.id === regionId);

  // 룰렛: 점점 느려지다가 멈춘다. 움직임 줄이기 설정이면 바로 멈춘 화면으로.
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setStep(order.length - 1);
      return;
    }
    if (landed) return;
    const t = step / (order.length - 1);
    const delay = FIRST_DELAY + (LAST_DELAY - FIRST_DELAY) * t * t;
    const id = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(id);
  }, [step, landed, order.length]);

  const land = () => setStep(order.length - 1);

  // 도는 동안 Enter·Space·Esc 로 바로 멈추기 (멈춘 뒤에는 카드의 '삶을 시작하기'로만 시작)
  useEffect(() => {
    if (landed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        setStep(order.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [landed, order.length]);

  // 멈추면 태어난 곳으로 다가간다
  const zoom = landed && target ? 2.1 : 1;
  const tx = landed && target ? VW / 2 - zoom * target.cx : 0;
  const ty = landed && target ? VH * 0.5 - zoom * target.cy : 0;

  const fullName = isRegionId(regionId) ? regionFullName(regionId, birthYear) : (target?.name ?? '');
  const sameYearBirths = isRegionId(regionId) ? regionBirthWeights(birthYear)[regionId] * at(BIRTHS, birthYear) : 0;
  const births = people(sameYearBirths).replace(/^약 /, '');

  return (
    <main className={`screen birth-map${landed ? ' landed' : ''}`}>
      <div className="bm-stage">
        <p className="bm-year">{birthYear}년</p>
        <h1 className={`bm-title${landed ? ' on' : ''}`} aria-live="polite">
          {landed ? fullName : '어디에서 태어날까'}
        </h1>
        <p className={`bm-sub${landed ? ' on' : ''}`}>
          {landed ? `그해 이곳에서 태어난 약 ${births} 가운데 한 명이었다.` : '그해 실제로 아이가 태어난 비율대로 정해집니다.'}
        </p>

        <svg className={`bm-svg${landed ? ' zoomed' : ''}`} viewBox={MAP_VIEWBOX} role="img" aria-label={landed ? `${fullName}에 핀이 꽂힌 한반도 지도` : '한반도 지도'}>
          <g className="bm-world" style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})` }}>
            <path className="bm-north" d={NORTH_KOREA_PATH} />
            {MAP_REGIONS.map((r) => (
              <path
                key={r.id}
                d={r.d}
                className={`bm-region${r.id === lit ? (landed ? ' home' : ' lit') : ''}${landed && r.id !== regionId ? ' dim' : ''}`}
              />
            ))}
            {landed && target && (
              <g transform={`translate(${target.cx} ${target.cy}) scale(${1 / zoom})`}>
                <circle className="bm-pulse" r="10" />
                <g className="bm-pin">
                  <path className="bm-pin-head" d="M0,0 C-2,-6 -8,-10 -8,-16 A8,8 0 1 1 8,-16 C8,-10 2,-6 0,0 Z" />
                  <circle cx="0" cy="-16" r="3" fill="var(--paper)" />
                </g>
              </g>
            )}
          </g>
        </svg>

        {!landed && (
          <button className="btn-link bm-skip" onClick={land}>
            건너뛰기
          </button>
        )}
      </div>
      {landed && <BirthCard name={name} sex={sex} regionId={regionId} birthYear={birthYear} familyLabel={familyLabel} onStart={onDone} />}
    </main>
  );
}
