import type { Snapshot } from '@/lib/engine';
import type { Speed } from '@/lib/storage';
import { won } from '@/lib/text';

const METERS = [
  ['health', '건강'],
  ['happiness', '행복'],
  ['ability', '역량'],
  ['relation', '관계'],
] as const;
const SPEEDS: Speed[] = [1, 2, 4, 8];

interface Props {
  snap: Snapshot;
  speed: Speed;
  paused: boolean;
  showControls: boolean;
  onSpeed: (s: Speed) => void;
  onTogglePause: () => void;
}

function metaOf(s: Snapshot): string[] {
  const meta = [s.residence];
  meta.push(s.netWorth === null ? `${s.familyLabel} 집` : '자산 ' + won(s.netWorth));
  if (s.job) meta.push(s.job);
  else if (s.edu && s.age < 30) meta.push(s.edu.replace(' 졸업', ''));
  if (s.married) meta.push(s.children ? `기혼 · 자녀 ${s.children}` : '기혼');
  else if (s.children) meta.push(`자녀 ${s.children}`);
  if (s.house) meta.push('자가');
  return meta;
}

export default function Hud({ snap, speed, paused, showControls, onSpeed, onTogglePause }: Props) {
  return (
    <header className="hud">
      <div className="hud-top">
        <div className="who">
          <strong>{snap.name}</strong>
          <span className="age">{snap.age}세</span>
          <span className="year">{snap.year}년</span>
        </div>
        {showControls && (
          <div className="controls" role="group" aria-label="진행 속도">
            <button className={`ctrl${paused ? ' on' : ''}`} onClick={onTogglePause} aria-label={paused ? '계속' : '일시정지'}>
              {paused ? '▶' : '❚❚'}
            </button>
            {SPEEDS.map((s) => (
              <button key={s} className={`ctrl${speed === s ? ' on' : ''}`} onClick={() => onSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="hud-meta">
        {metaOf(snap).map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <div className="meters">
        {METERS.map(([key, label]) => {
          const v = Math.round(snap.stats[key]);
          return (
            <div key={key} className={`meter${v < 30 ? ' low' : ''}`} title={`${label} ${v}`}>
              <span>{label}</span>
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
