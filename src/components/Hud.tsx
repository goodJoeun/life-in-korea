import type { Ref } from 'react';
import type { Snapshot, Stats } from '@/lib/engine';
import { YEAR_SECONDS, type YearSeconds } from '@/lib/storage';

const METERS = [
  ['health', '건강'],
  ['happiness', '행복'],
  ['ability', '역량'],
  ['relation', '관계'],
] as const;

/** 진행 막대가 지금 무엇을 기다리는지 */
export type ProgressState = 'running' | 'paused' | 'choice' | 'done';

interface Props {
  snap: Snapshot;
  /** 직전 해의 수치 (변화량 표시용) */
  prevStats: Stats | null;
  yearSeconds: YearSeconds;
  paused: boolean;
  showControls: boolean;
  progress: ProgressState;
  /** 진행 막대의 채움 요소. 매 프레임 Game 이 직접 너비를 바꾼다(다시 그리기 없이). */
  barRef: Ref<HTMLElement>;
  onYearSeconds: (s: YearSeconds) => void;
  onTogglePause: () => void;
  onSkip: () => void;
  onOpenSide: () => void;
}

function level(v: number): string {
  if (v >= 80) return 'high';
  if (v < 30) return 'low';
  return 'mid';
}

const PROGRESS_LABEL: Record<ProgressState, string> = {
  running: '다음 해까지',
  paused: '멈춤',
  choice: '선택을 기다리는 중',
  done: '',
};

export default function Hud(props: Props) {
  const { snap, prevStats, yearSeconds, paused, showControls, progress, barRef } = props;
  return (
    <header className="hud">
      <div className="hud-top">
        <div className="who">
          <strong>{snap.name}</strong>
          <span className="age">{snap.age}세</span>
          <span className="year">{snap.year}년</span>
        </div>
        <div className="controls" role="group" aria-label="진행">
          <button className="ctrl side-toggle" onClick={props.onOpenSide}>
            가족·자산
          </button>
          {showControls && (
            <>
              <button className={`ctrl${paused ? ' on' : ''}`} onClick={props.onTogglePause} aria-label={paused ? '계속' : '일시정지'} title="Space">
                {paused ? '▶' : '❚❚'}
              </button>
              <button className="ctrl" onClick={props.onSkip} disabled={progress !== 'running' && progress !== 'paused'} aria-label="바로 다음 해로" title="→">
                ▶▶
              </button>
              <label className="year-len">
                <span>1년</span>
                <select value={yearSeconds} onChange={(e) => props.onYearSeconds(Number(e.target.value) as YearSeconds)} aria-label="게임 속 1년의 길이">
                  {YEAR_SECONDS.map((s) => (
                    <option key={s} value={s}>
                      {s}초
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      </div>

      {showControls && progress !== 'done' && (
        <div className={`year-progress ${progress}`} aria-hidden="true">
          <span className="yp-label">{PROGRESS_LABEL[progress]}</span>
          <i>
            <b ref={barRef} />
          </i>
          <span className="yp-next">{snap.year + 1}년 · {snap.age + 1}세</span>
        </div>
      )}

      <div className="stats">
        {METERS.map(([key, label]) => {
          const v = Math.round(snap.stats[key]);
          const d = prevStats ? v - Math.round(prevStats[key]) : 0;
          return (
            <div key={key} className={`stat ${level(v)}`}>
              <div className="stat-head">
                <span className="stat-label">{label}</span>
                <span className="stat-value">
                  {v}
                  {d !== 0 && (
                    <em key={`${snap.age}-${d}`} className={d > 0 ? 'up' : 'down'}>
                      {d > 0 ? `+${d}` : d}
                    </em>
                  )}
                </span>
              </div>
              <i>
                <b style={{ width: `${v}%` }} />
              </i>
            </div>
          );
        })}
      </div>
    </header>
  );
}
