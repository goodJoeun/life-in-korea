'use client';

/*
 * 결과 리포트 (claude/report/SKILL.md): 한 줄 요약, 생애 그래프, 이런 사람이었다, 인생의 갈림길, 또래와 비교, 숫자로 본 생.
 */
import { useState } from 'react';
import type { Summary } from '@/lib/engine';
import { josa, won } from '@/lib/text';
import LifeChart from './LifeChart';
import { copyText } from './share';
import TraitBars, { epitaph } from './TraitBars';

interface Props {
  summary: Summary;
  onAgain: () => void;
  onReview: () => void;
  onHome: () => void;
}

// dataviz 검사를 통과한 범주 색 (흰 카드 위, 밝은 화면)
const C_BLUE = '#2a78d6';
const C_ORANGE = '#eb6834';
const short = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 10000 ? `${Math.round(v / 1000) / 10}억` : `${Math.round(v).toLocaleString('ko-KR')}만`);
const KIND_LABEL = { core: '갈림길', path: '갈림길', dilemma: '작은 선택' } as const;

/** 고른 선택이 많으면 생애 전체에 고르게 8개를 고른다 */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

export default function Ending({ summary: s, onAgain, onReview, onHome }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const ages = s.series.map((p) => p.age);
  const hasMoney = s.series.some((p) => p.netWorth !== null);
  const turns = spread(s.turningPoints.filter((t) => t.kind !== 'dilemma'), 8);

  const stats: [string, string][] = [
    ['태어난 곳', `${s.region}, ${s.family} 집`],
    ['최종 학력', s.edu ? s.edu.replace(' 졸업', '') : '—'],
    ['마지막 일', s.lastWork ?? '—'],
    ['가족', s.married ? (s.children ? `배우자, 자녀 ${s.children}명` : '배우자') : s.children ? `자녀 ${s.children}명` : '혼자'],
    ['남긴 재산', s.netWorthText ?? '—'],
    ['떠난 이유', s.cause],
  ];
  const line = s.age >= 8 ? epitaph(s.traits, s.interest, josa) : null;

  async function share() {
    const text = [...s.lines, line ?? '', '', s.outliveText, '', `너는 ${s.birthYear}년에 누구로 태어날까? #5000만분의1`, window.location.href.split('#')[0]].join('\n');
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
        {line && <p className="end-epitaph">{line}</p>}
        <div className="end-lines">
          {s.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <p className="end-outlive">{s.outliveText}</p>

        {ages.length >= 3 && (
          <section className="end-sec" aria-label="생애 그래프">
            <h3>생애 그래프</h3>
            {hasMoney && (
              <>
                <p className="end-sub">순자산 (2024년 돈 가치)</p>
                <LifeChart
                  label={`나이별 순자산. ${s.moments.map((m) => `${m.age}세 ${m.label}`).join(', ')}`}
                  ages={ages}
                  series={[{ key: 'nw', label: '순자산', color: C_BLUE, values: s.series.map((p) => p.netWorth), area: true }]}
                  format={(v) => won(v)}
                  tick={short}
                  moments={s.moments}
                  height={210}
                />
              </>
            )}
            <p className="end-sub">행복과 건강 (0~100)</p>
            <LifeChart
              label="나이별 행복과 건강"
              ages={ages}
              series={[
                { key: 'hp', label: '행복', color: C_BLUE, values: s.series.map((p) => p.happiness) },
                { key: 'hl', label: '건강', color: C_ORANGE, values: s.series.map((p) => p.health) },
              ]}
              format={(v) => String(Math.round(v))}
              domain={[0, 100]}
              height={170}
            />
            <details className="end-table">
              <summary>표로 보기</summary>
              <table>
                <thead>
                  <tr>
                    <th scope="col">나이</th>
                    <th scope="col">연도</th>
                    <th scope="col">순자산</th>
                    <th scope="col">행복</th>
                    <th scope="col">건강</th>
                  </tr>
                </thead>
                <tbody>
                  {s.series.filter((p, i) => p.age % 5 === 0 || i === s.series.length - 1).map((p) => (
                    <tr key={p.age}>
                      <th scope="row">{p.age}세</th>
                      <td>{p.year}</td>
                      <td>{p.netWorth === null ? '—' : won(p.netWorth)}</td>
                      <td>{p.happiness}</td>
                      <td>{p.health}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
        )}

        {s.age >= 8 && (
          <section className="end-sec" aria-label="이런 사람이었다">
            <h3>이런 사람이었다</h3>
            <p className="me-line">
              {s.interest ? (
                <>
                  <b>{s.interest}</b>에 가장 관심이 많았다
                </>
              ) : (
                '뚜렷한 관심 분야는 없었다'
              )}
              {s.major && <small> · {s.major}</small>}
            </p>
            <TraitBars traits={s.traits} />
          </section>
        )}

        {turns.length > 0 && (
          <section className="end-sec" aria-label="인생의 갈림길">
            <h3>내가 고른 길</h3>
            <ol className="end-turns">
              {turns.map((t, i) => (
                <li key={i}>
                  <span className="end-turn-age">{t.age}세</span>
                  <span>
                    <small>{t.prompt}</small>
                    {t.label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="side-note">직접 고른 {KIND_LABEL.core} {s.turningPoints.filter((t) => t.kind !== 'dilemma').length}번 가운데 {turns.length}번. 운에 맡긴 선택은 빠졌다.</p>
          </section>
        )}

        <section className="end-sec" aria-label="또래와 비교">
          <h3>같은 해 태어난 사람들과</h3>
          <dl className="end-cohort">
            {s.cohort.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>
                  <b>{c.mine}</b>
                  <small>{c.peers}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>

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
            {s.birthYear}년에 다시 태어나기
          </button>
          <button className="btn" onClick={onHome}>
            다른 해에 태어나기
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
