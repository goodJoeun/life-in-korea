'use client';

/*
 * 돈 관리: 씀씀이와 쓸 수 있는 돈의 배분(예금·국내 주식·해외 주식·코인)을 정한다 (claude/money/SKILL.md).
 * 슬라이더는 초안만 바꾸고, '적용'을 눌러야 엔진에 반영된다(되살리기 동작이 하나만 남게).
 */
import { useEffect, useState } from 'react';
import type { AssetAction, AssetView, InvestKind, MoneyPlan, Snapshot, Spend } from '@/lib/engine';
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
  /** 집 사고팔기·대출 미리 갚기 */
  onManage?: (act: AssetAction) => void;
}

/** 대출을 미리 갚을 때 고르는 금액 (만원) */
const REPAY_STEPS = [1000, 5000];

const pct = (r: number) => `${r >= 0 ? '+' : ''}${Math.round(r * 100)}%`;

export default function MoneyPanel({ snap, assets: a, onPlan, onManage }: Props) {
  const [open, setOpen] = useState(false);
  const [selling, setSelling] = useState(false);
  const h = snap.housing;
  const total = Math.max(0, a.deposit) + a.invest.stock + a.invest.global + a.invest.crypto + (a.house ? a.house.price : 0);
  const parts = ([
    ['예금', 'deposit', Math.max(0, a.deposit)], ['국내 주식', 'stock', a.invest.stock], ['해외 주식', 'global', a.invest.global],
    ['코인', 'crypto', a.invest.crypto], ['집', 'house', a.house ? a.house.price : 0],
  ] as [string, string, number][]).filter((p) => p[2] > 0);
  const share = (v: number) => Math.round((v / total) * 100);
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
      {total > 0 && (
        <div className="money-bar" role="img" aria-label={parts.map((p) => `${p[0]} ${share(p[2])}%`).join(', ')}>
          {parts.map((p) => (
            <i key={p[1]} className={`bar-${p[1]}`} style={{ width: `${(p[2] / total) * 100}%` }} title={`${p[0]} ${share(p[2])}%`} />
          ))}
        </div>
      )}
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
        <button className="btn money-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? '자산 관리 닫기' : '자산 관리'}
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

          {h && onManage && (
            <>
              <h4>집</h4>
              {a.house ? (
                <>
                  {a.house.debt > 0 && (
                    <>
                      <p className="side-note">대출 {won(a.house.debt)}이 남았다. 해마다 이자가 4% 붙는다. 미리 갚으면 이자가 준다.</p>
                      <div className="money-actions wrap">
                        {REPAY_STEPS.filter((v) => v < h.repayMax).map((v) => (
                          <button key={v} className="btn" onClick={() => onManage({ t: 'repay', amt: v })}>
                            {won(v)} 갚기
                          </button>
                        ))}
                        <button className="btn" disabled={h.repayMax < 1} onClick={() => onManage({ t: 'repay', amt: h.repayMax })}>
                          {h.repayMax >= a.house.debt ? '모두 갚기' : h.repayMax >= 1 ? `${won(h.repayMax)} 갚기` : '갚을 돈이 없다'}
                        </button>
                      </div>
                    </>
                  )}
                  {h.sell && (
                    <div className="money-actions wrap">
                      {selling ? (
                        <>
                          <button className="btn btn-primary" onClick={() => { setSelling(false); onManage({ t: 'sell' }); }}>
                            판다 (손에 {won(h.sell.gain)})
                          </button>
                          <button className="btn" onClick={() => setSelling(false)}>
                            그만둔다
                          </button>
                        </>
                      ) : (
                        <button className="btn" onClick={() => setSelling(true)}>
                          집 팔기
                        </button>
                      )}
                    </div>
                  )}
                  {selling && h.sell && <p className="side-note">수수료와 세금으로 {won(h.sell.fee)}이 든다. 팔고 나면 전·월세로 산다.</p>}
                </>
              ) : h.offers.length ? (
                <>
                  <ul className="house-offers">
                    {h.offers.map((o) => (
                      <li key={o.size}>
                        <button className="spend-item" disabled={!o.ok} onClick={() => onManage({ t: 'buy', size: o.size })}>
                          <span className="spend-name">
                            <b>{o.label}</b>
                            <small>{o.ok ? `내 돈 ${won(o.down)} + 대출 ${won(o.loan)}` : `내 돈 ${won(o.down)}이 있어야 한다`}</small>
                          </span>
                          <span className="spend-cost">{won(o.price)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="side-note">{snap.residence} 집값. 대출은 30년에 걸쳐 갚는다.</p>
                </>
              ) : (
                <p className="side-note">아직 집을 살 나이가 아니다.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
