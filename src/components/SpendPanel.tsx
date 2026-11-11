'use client';

/*
 * 내 돈 쓰기: 모은 돈으로 건강을 챙기고, 여행을 가고, 사람들에게 쓴다 (claude/spend/SKILL.md).
 * 무엇을 할 수 있는지는 엔진이 그해 형편에 맞춰 알려 준다(snap.spend).
 */
import { useState } from 'react';
import type { Snapshot, SpendState } from '@/lib/engine';
import { SPEND_GROUPS, SPEND_PER_YEAR, type SpendGroup } from '@/lib/spend';
import { won } from '@/lib/text';

const STAT_LABEL = { health: '건강', happiness: '행복', ability: '역량', relation: '관계' } as const;
const WHY: Record<Exclude<SpendState, 'ok'>, string> = { done: '올해 했다', limit: '내년에', poor: '돈이 모자란다' };

interface Props {
  snap: Snapshot;
  onSpend?: (id: string) => void;
}

export default function SpendPanel({ snap, onSpend }: Props) {
  const [group, setGroup] = useState<SpendGroup>('health');
  const groups = (Object.keys(SPEND_GROUPS) as SpendGroup[]).filter((g) => snap.spend.some((s) => s.group === g));
  const cur = groups.includes(group) ? group : groups[0];
  const items = snap.spend.filter((s) => s.group === cur);

  return (
    <div className="spend">
      <p className="spend-left">
        올해 <b>{snap.spendLeft}</b>번 더 쓸 수 있다 <small>(한 해 {SPEND_PER_YEAR}번)</small>
      </p>
      <div className="spend-tabs" role="tablist" aria-label="돈 쓸 곳">
        {groups.map((g) => (
          <button key={g} role="tab" aria-selected={g === cur} className={`chip${g === cur ? ' on' : ''}`} onClick={() => setGroup(g)}>
            {SPEND_GROUPS[g]}
          </button>
        ))}
      </div>
      <ul className="spend-list">
        {items.map((s) => (
          <li key={s.id}>
            <button className="spend-item" disabled={!onSpend || s.state !== 'ok'} onClick={() => onSpend?.(s.id)}>
              <span className="spend-name">
                <b>{s.label}</b>
                <small>{s.desc}</small>
              </span>
              <span className="spend-cost">
                {won(s.cost)}
                <small>
                  {s.state !== 'ok'
                    ? WHY[s.state]
                    : (Object.keys(s.fx) as (keyof typeof STAT_LABEL)[]).map((k) => `${STAT_LABEL[k]}${(s.fx[k] ?? 0) > 0 ? '↑' : '↓'}`).join(' ')}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="side-note">이미 높은 수치는 돈을 써도 조금만 오른다.</p>
    </div>
  );
}
