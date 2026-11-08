'use client';

import { useState } from 'react';
import type { Summary } from '@/lib/engine';

interface Props {
  summary: Summary;
  onAgain: () => void;
  onReview: () => void;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export default function Ending({ summary: s, onAgain, onReview }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  const stats: [string, string][] = [
    ['태어난 곳', `${s.region}, ${s.family} 집`],
    ['최종 학력', s.edu ? s.edu.replace(' 졸업', '') : '—'],
    ['마지막 일', s.lastWork ?? '—'],
    ['가족', s.married ? (s.children ? `배우자, 자녀 ${s.children}명` : '배우자') : s.children ? `자녀 ${s.children}명` : '혼자'],
    ['남긴 재산', s.netWorthText ?? '—'],
    ['떠난 이유', s.cause],
  ];

  async function share() {
    const text = [...s.lines, '', s.outliveText, '', '너는 5000만 명 중 누구로 태어날까? #5000만분의1', window.location.href.split('#')[0]].join('\n');
    const ok = await copyText(text);
    setToast(ok ? '복사했어요. 붙여넣어 공유해 보세요.' : '복사하지 못했어요.');
  }

  return (
    <main className="screen ending">
      <article className="ending-card">
        <p className="eyebrow">한 번뿐인 생</p>
        <h2 className="end-name">{s.name}</h2>
        <p className="end-years">
          {s.birthYear} – {s.deathYear} · {s.age}세
        </p>
        <div className="end-lines">
          {s.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <p className="end-outlive">{s.outliveText}</p>
        <dl className="end-stats">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="end-actions">
          <button className="btn btn-primary" onClick={onAgain}>
            다시 태어나기
          </button>
          <button className="btn" onClick={share}>
            결과 복사하기
          </button>
          <button className="btn btn-ghost" onClick={onReview}>
            생애 기록 다시 보기
          </button>
        </div>
        {toast && <p className="toast">{toast}</p>}
      </article>
    </main>
  );
}
