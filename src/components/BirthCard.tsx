'use client';

/*
 * 출생 카드: 태어난 곳이 정해진 뒤 보여 준다. 그해 통계·사건·동갑내기를 확인하고,
 * 이미지로 저장하거나 공유한 다음, '삶을 시작하기'를 눌러야 게임이 시작된다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { birthCardData, birthCardText, type BirthCardInput } from '@/lib/birthCard';
import { birthCardPng } from './birthCardImage';
import { downloadBlob, shareOrCopy } from './share';

interface Props extends BirthCardInput {
  onStart: () => void;
}

function Rows({ items }: { items: [string, string][] }) {
  return (
    <dl className="bc-rows">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function BirthCard({ onStart, name, sex, regionId, birthYear, familyLabel }: Props) {
  const d = useMemo(() => birthCardData({ name, sex, regionId, birthYear, familyLabel }), [name, sex, regionId, birthYear, familyLabel]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const filename = `출생카드-${d.name}-${d.year}.png`;
  // Enter 로 바로 시작할 수 있게 포커스만 준다. 화면은 움직이지 않는다 (휴대폰에서 지도를 건너뛰지 않게)
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => startRef.current?.focus({ preventScroll: true }), []);

  async function save() {
    setBusy(true);
    try {
      downloadBlob(await birthCardPng(d), filename);
      setToast('이미지를 저장했어요.');
    } catch {
      setToast('이미지를 만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      let file: File | undefined;
      try {
        file = new File([await birthCardPng(d)], filename, { type: 'image/png' });
      } catch {
        file = undefined;
      }
      const r = await shareOrCopy({ title: `${d.name}의 출생 카드`, text: birthCardText(d), file });
      if (r === 'copied') setToast('글을 복사했어요. 붙여넣어 공유해 보세요.');
      else if (r === 'failed') setToast('공유하지 못했어요.');
      else setToast(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="birth-card" aria-label="출생 카드">
      <p className="eyebrow">출생 카드</p>
      <h2 className="bc-name">{d.name}</h2>
      <p className="bc-where">
        {d.year}년 · {d.place}
      </p>
      <p className="bc-who">{d.who}</p>

      <section>
        <h3>{d.year}년 대한민국</h3>
        <Rows items={d.national} />
      </section>
      {d.local.length > 0 && (
        <section>
          <h3>태어난 곳</h3>
          <Rows items={d.local} />
        </section>
      )}
      {(d.kr.length > 0 || d.world.length > 0) && (
        <section>
          <h3>그해 있었던 일</h3>
          <ul className="bc-events">
            {d.kr.map((t) => (
              <li key={t}>
                <span className="bc-tag">한국</span>
                {t}
              </li>
            ))}
            {d.world.map((t) => (
              <li key={t}>
                <span className="bc-tag world">세계</span>
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.born.length > 0 && (
        <section>
          <h3>같은 해 태어난 사람</h3>
          <ul className="bc-born">
            {d.born.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}
      {d.note && <p className="bc-note">통계 가운데 {d.note}</p>}

      <div className="bc-actions">
        <button ref={startRef} className="btn btn-primary" onClick={onStart}>
          삶을 시작하기
        </button>
        <button className="btn" onClick={save} disabled={busy}>
          이미지로 저장
        </button>
        <button className="btn" onClick={share} disabled={busy}>
          공유하기
        </button>
      </div>
      {toast && <p className="toast">{toast}</p>}
    </article>
  );
}
