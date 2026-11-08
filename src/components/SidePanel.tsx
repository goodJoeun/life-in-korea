import type { Snapshot } from '@/lib/engine';
import { won } from '@/lib/text';

interface Props {
  snap: Snapshot;
  /** 휴대폰에서 서랍처럼 열렸을 때 닫기 */
  onClose?: () => void;
}

const SPOUSE_STATUS = { married: '', widowed: '사별', divorced: '이혼' } as const;

function Row({ label, value, tone }: { label: string; value: string; tone?: 'plus' | 'minus' }) {
  return (
    <div className="side-row">
      <dt>{label}</dt>
      <dd className={tone ? `tone-${tone}` : undefined}>{value}</dd>
    </div>
  );
}

export default function SidePanel({ snap, onClose }: Props) {
  const { family: f, assets: a } = snap;
  const spouseWord = f.spouse ? (snap.sex === 'M' ? '아내' : '남편') : '배우자';
  const income = a ? a.income.self + a.income.spouse + a.income.pension : 0;

  return (
    <aside className="side" aria-label="가족과 자산">
      {onClose && (
        <button className="side-close ctrl" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      )}

      <section className="side-card">
        <h3>가족</h3>
        <dl>
          <Row label="부모님" value={f.parentsAlive ? `계심 · ${snap.familyLabel} 집` : '돌아가심'} />
          {f.spouse ? (
            <Row
              label={spouseWord}
              value={
                f.spouse.status === 'married'
                  ? `${f.spouse.name} · ${f.spouse.age}세${f.spouse.works ? ' · 맞벌이' : ''}`
                  : `${f.spouse.name} · ${SPOUSE_STATUS[f.spouse.status]}`
              }
            />
          ) : (
            <Row label="배우자" value={snap.age >= 20 ? '미혼' : '—'} />
          )}
        </dl>
        {f.children.length > 0 ? (
          <ul className="kids">
            {f.children.map((c) => (
              <li key={c.name + c.age}>
                <span className="kid-badge">{c.sex === 'M' ? '아들' : '딸'}</span>
                {c.name}
                <span className="kid-age">{c.age}세</span>
              </li>
            ))}
          </ul>
        ) : (
          snap.age >= 20 && <p className="side-empty">자녀 없음</p>
        )}
        {f.grandchild && <p className="side-note">손주가 있다</p>}
      </section>

      <section className="side-card">
        <h3>자산</h3>
        {a ? (
          <>
            <p className={`networth${a.netWorth < 0 ? ' minus' : ''}`}>
              <span>순자산</span>
              {won(a.netWorth)}
            </p>
            <dl>
              <Row label={a.cash >= 0 ? '예금' : '빚'} value={won(Math.abs(a.cash))} tone={a.cash >= 0 ? undefined : 'minus'} />
              <Row label="집" value={a.house ? `자가 · ${won(a.house.price)}` : snap.age >= 25 ? '전·월세' : '—'} />
              {a.house && a.house.debt > 0 && <Row label="주택 대출" value={won(a.house.debt)} tone="minus" />}
            </dl>
            <h4>올해 소득</h4>
            <dl>
              <Row label="내 일" value={a.income.self ? won(a.income.self) : snap.job ?? '없음'} />
              {a.income.spouse > 0 && <Row label={spouseWord} value={won(a.income.spouse)} />}
              {a.income.pension > 0 && <Row label="연금" value={won(a.income.pension)} />}
              {income > 0 && <Row label="합계" value={won(income)} tone="plus" />}
            </dl>
            <p className="side-note">2024년 돈 가치로 환산한 금액</p>
          </>
        ) : (
          <p className="side-empty">
            아직 부모님과 산다.
            <br />
            {snap.familyLabel} 집
          </p>
        )}
      </section>

      <section className="side-card side-meta">
        <dl>
          <Row label="사는 곳" value={snap.residence} />
          {snap.edu && <Row label="학력" value={snap.edu.replace(' 졸업', '')} />}
          {snap.job && <Row label="일" value={snap.job} />}
        </dl>
      </section>
    </aside>
  );
}
