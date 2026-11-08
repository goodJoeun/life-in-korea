import type { Snapshot, Stats } from '@/lib/engine';
import type { Speed } from '@/lib/storage';

const METERS = [
  ['health', '건강'],
  ['happiness', '행복'],
  ['ability', '역량'],
  ['relation', '관계'],
] as const;
const SPEEDS: Speed[] = [1, 2, 4, 8];

interface Props {
  snap: Snapshot;
  /** 직전 해의 수치 (변화량 표시용) */
  prevStats: Stats | null;
  speed: Speed;
  paused: boolean;
  showControls: boolean;
  onSpeed: (s: Speed) => void;
  onTogglePause: () => void;
  onOpenSide: () => void;
}

function level(v: number): string {
  if (v >= 80) return 'high';
  if (v < 30) return 'low';
  return 'mid';
}

export default function Hud({ snap, prevStats, speed, paused, showControls, onSpeed, onTogglePause, onOpenSide }: Props) {
  return (
    <header className="hud">
      <div className="hud-top">
        <div className="who">
          <strong>{snap.name}</strong>
          <span className="age">{snap.age}세</span>
          <span className="year">{snap.year}년</span>
        </div>
        <div className="controls" role="group" aria-label="진행">
          <button className="ctrl side-toggle" onClick={onOpenSide}>
            가족·자산
          </button>
          {showControls && (
            <>
              <button className={`ctrl${paused ? ' on' : ''}`} onClick={onTogglePause} aria-label={paused ? '계속' : '일시정지'}>
                {paused ? '▶' : '❚❚'}
              </button>
              {SPEEDS.map((s) => (
                <button key={s} className={`ctrl speed${speed === s ? ' on' : ''}`} onClick={() => onSpeed(s)}>
                  {s}×
                </button>
              ))}
            </>
          )}
        </div>
      </div>
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
