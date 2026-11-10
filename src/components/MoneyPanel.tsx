'use client';

/*
 * 돈 관리: 씀씀이와 쓸 수 있는 돈의 배분(예금·국내 주식·해외 주식·코인)을 정한다 (claude/money/SKILL.md).
 * 슬라이더는 초안만 바꾸고, '적용'을 눌러야 엔진에 반영된다(되살리기 동작이 하나만 남게).
 */
import { useEffect, useState } from 'react';
import type { AssetView, InvestKind, MoneyPlan, Snapshot, Spend } from '@/lib/engine';
import { won } from '@/lib/text';

const KINDS: { key: InvestKind; label: string; from: number; note: string }[] = [
  { key: 'stock', label: '국내 주식', from: 1981, note: '코스피 지수 흐름' },
  { key: 'global', label: '해외 주식', from: 2000, note: '미국 주식 지수, 환율 포함' },
  { key: 'crypto', label: '코인', from: 2018, note: '값이 매우 크게 오르내린다' },
];
const SPENDS: { key: Spend; label: string; desc: string }[] = [
  { key: 'frugal', label: '아껴 쓰기', desc: '소득의 40%를 모은다' },
  { key: 'normal', label: '보통', desc: '소득의 30%를 모은다' },
  { key: 'loose', label: '넉넉히', desc: '소득의 20%를 모은다' },
];

interface Props {
  snap: Snapshot;
  assets: AssetView;
  onPlan?: (plan: MoneyPlan) => void;
}

const pct = (r: number) => `${r >= 0 ? '+' : ''}${Math.round(r * 100)}%`;

export default function MoneyPanel({ snap, assets: a, onPlan }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MoneyPlan>(snap.plan);
  const planKey = JSON.stringify(snap.plan);
  // 갈림길 등으로 계획이 바뀌면 초안도 따라간다
  useEffect(() => setDraft(JSON.parse(planKey)), [planKey]);
  const changed = JSON.stringify(draft) !== planKey;

  const setShare = (k: InvestKind, v: number) => {
    const others = KINDS.filter((x) => x.key !== k).reduce((s, x) => s + draft.alloc[x.key], 0);
    const val = Math.max(0, Math.min(100 - others, v));
    const alloc = { ...draft.alloc, [k]: val };
    alloc.deposit = 100 - alloc.stock - alloc.global - alloc.crypto;
    setDraft({ ...draft, alloc });
  };

  return (
    <div className="money">
      <dl className="money-rows">
        <div>
          <dt>{a.deposit >= 0 ? '예금' : '빚'}</dt>
          <dd className={a.deposit < 0 ? 'tone-minus' : undefined}>{won(Math.abs(a.deposit))}</dd>
        </div>
        {KINDS.filter((k) => a.invest[k.key] > 0).map((k) => {
          const r = snap.lastReturn[k.key];
          return (
            <div key={k.key}>
              <dt>{k.label}</dt>
              <dd>
                {won(a.invest[k.key])}
                {r !== undefined && <small className={r >= 0 ? 'up' : 'down'}> {pct(r)}</small>}
              </dd>
            </div>
          );
        })}
      </dl>

      {onPlan && (
        <button className="btn-link money-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? '돈 관리 닫기' : '돈 관리'}
        </button>
      )}
      {open && onPlan && (
        <div className="money-edit">
          <h4>씀씀이</h4>
          <div className="money-spend" role="radiogroup" aria-label="씀씀이">
            {SPENDS.map((s) => (
              <button key={s.key} role="radio" aria-checked={draft.spend === s.key} className={`chip${draft.spend === s.key ? ' on' : ''}`} onClick={() => setDraft({ ...draft, spend: s.key })} title={s.desc}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="side-note">{SPENDS.find((s) => s.key === draft.spend)!.desc}. 아끼면 조금 답답하고, 넉넉히 쓰면 조금 즐겁다.</p>

          <h4>모은 돈을 어디에 둘까</h4>
          <ul className="money-alloc">
            <li>
              <span>예금</span>
              <b>{draft.alloc.deposit}%</b>
            </li>
            {KINDS.map((k) => {
              const ok = snap.investOpen[k.key];
              return (
                <li key={k.key} className={ok ? undefined : 'off'}>
                  <span>
                    {k.label}
                    <small>{ok ? k.note : `${k.from}년부터`}</small>
                  </span>
                  <input type="range" min={0} max={100} step={10} value={draft.alloc[k.key]} disabled={!ok} onChange={(e) => setShare(k.key, Number(e.target.value))} aria-label={`${k.label} 비율`} />
                  <b>{draft.alloc[k.key]}%</b>
                </li>
              );
            })}
          </ul>
          <p className="side-note">해마다 이 비율대로 다시 나눈다. 과거는 그해 실제 지수, 미래는 확률을 따른다.</p>
          <div className="money-actions">
            <button className="btn btn-primary" disabled={!changed} onClick={() => onPlan(draft)}>
              적용
            </button>
            <button className="btn" disabled={!changed} onClick={() => setDraft(snap.plan)}>
              되돌리기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
