'use client';

import { useEffect, useState } from 'react';
import { yearPreview } from '@/lib/engine';
import { YEAR_SECONDS, type PastLife, type SavedLife, type YearSeconds } from '@/lib/storage';
import { CURRENT_YEAR, MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from '@/lib/timeline';
import PopulationMap from './PopulationMap';

interface Props {
  birthYear: number;
  onBirthYearChange: (y: number) => void;
  auto: boolean;
  onAutoChange: (v: boolean) => void;
  yearSeconds: YearSeconds;
  onYearSecondsChange: (s: YearSeconds) => void;
  onStart: () => void;
  pastLives: PastLife[];
  onClearPast: () => void;
  /** 홈으로 나와 저장해 둔 생 */
  saved: SavedLife | null;
  onResume: () => void;
  onDiscardSaved: () => void;
}

const QUICK_YEARS = [1965, 1975, 1985, 1995, 2005, 2015];

function YearPicker({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const p = yearPreview(year);
  const set = (y: number) => onChange(Math.max(MIN_BIRTH_YEAR, Math.min(MAX_BIRTH_YEAR, y)));
  // 직접 입력: 입력 중에는 draft 만 바꾸고, 네 자리가 범위 안이면 바로 반영
  const [draft, setDraft] = useState(String(year));
  useEffect(() => setDraft(String(year)), [year]);
  const n = Number(draft);
  const invalid = draft.length === 4 && (n < MIN_BIRTH_YEAR || n > MAX_BIRTH_YEAR);
  const typeYear = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setDraft(digits);
    const y = Number(digits);
    if (digits.length === 4 && y >= MIN_BIRTH_YEAR && y <= MAX_BIRTH_YEAR) onChange(y);
  };
  const commit = () => {
    if (draft.length === 4 && n >= MIN_BIRTH_YEAR && n <= MAX_BIRTH_YEAR) onChange(n);
    else setDraft(String(year));
  };
  return (
    <section className="year-picker" aria-label="태어날 해">
      <div className="year-head">
        <span className="year-label">
          태어날 해<small>숫자를 눌러 직접 입력</small>
        </span>
        <div className="year-stepper">
          <button className="ctrl" onClick={() => set(year - 1)} aria-label="한 해 전">−</button>
          <input
            className={`year-value${invalid ? ' invalid' : ''}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={draft}
            onChange={(e) => typeYear(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.currentTarget.select()}
            aria-label={`태어날 해 직접 입력 (${MIN_BIRTH_YEAR}~${MAX_BIRTH_YEAR})`}
          />
          <button className="ctrl" onClick={() => set(year + 1)} aria-label="한 해 뒤">+</button>
        </div>
      </div>
      <input
        type="range"
        min={MIN_BIRTH_YEAR}
        max={MAX_BIRTH_YEAR}
        value={year}
        onChange={(e) => set(Number(e.target.value))}
        aria-label="태어날 해 고르기"
      />
      <div className="year-chips">
        {QUICK_YEARS.map((y) => (
          <button key={y} className={`chip${y === year ? ' on' : ''}`} onClick={() => set(y)}>
            {y}
          </button>
        ))}
        <button className={`chip${year === CURRENT_YEAR ? ' on' : ''}`} onClick={() => set(CURRENT_YEAR)}>
          지금
        </button>
        <button className="chip" onClick={() => set(MIN_BIRTH_YEAR + Math.floor(Math.random() * (MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1)))}>
          무작위
        </button>
      </div>
      {invalid && <p className="year-error">{MIN_BIRTH_YEAR}년부터 {MAX_BIRTH_YEAR}년까지 고를 수 있어요.</p>}
      <p className="year-preview">
        이해 출생아 약 <b>{Math.round(p.births / 10000)}만 명</b> · 합계출산율 <b>{p.tfr.toFixed(2)}명</b> · 기대수명 남 <b>{p.e0M.toFixed(1)}세</b>, 여{' '}
        <b>{p.e0F.toFixed(1)}세</b> · 출생성비 <b>{p.sexRatio.toFixed(1)}</b>
        {p.estimated && <span className="year-note">{year < 1970 ? '1970년 이전은 추정치입니다.' : '2026년 이후는 추정·전망치입니다.'}</span>}
      </p>
    </section>
  );
}

export default function Intro({ birthYear, onBirthYearChange, auto, onAutoChange, yearSeconds, onYearSecondsChange, onStart, pastLives, onClearPast, saved, onResume, onDiscardSaved }: Props) {
  return (
    <main className="screen intro">
      <div className="intro-layout">
        <div className="intro-inner">
          <p className="eyebrow">대한민국 인생 시뮬레이션</p>
          <h1 className="title">5000만분의&nbsp;1</h1>
          <p className="lead">
            대한민국 어딘가에서 태어난 한 아이가 되어,
            <br />
            한 번뿐인 생을 끝까지 살아봅니다.
          </p>
          <p className="sub">
            태어날 해를 고르면 그 시대의 출생·진학·결혼·일자리·사망 통계가 해마다 적용됩니다. 지역과 집안 형편은 고를 수 없습니다.
            <br />
            학원, 진로, 결혼, 집 같은 갈림길에서는 직접 고를 수 있지만, 결과는 확률을 따릅니다.
          </p>

          {saved && (
            <section className="resume" aria-label="진행 중인 생">
              <p className="resume-title">살던 생이 있습니다</p>
              <p className="resume-who">
                <strong>{saved.name}</strong> · {saved.birthYear}년생 · {saved.year}년, {saved.age}세
              </p>
              <div className="resume-actions">
                <button className="btn btn-primary" onClick={onResume}>
                  이어서 하기
                </button>
                <button className="btn" onClick={onDiscardSaved}>
                  새로 시작하기
                </button>
              </div>
              <p className="year-note">새로 시작하거나 아래에서 새로 태어나면 이 생은 지워집니다.</p>
            </section>
          )}

          <YearPicker year={birthYear} onChange={onBirthYearChange} />

          <section className="year-length" aria-label="1년의 길이">
            <span className="year-label">
              1년의 길이<small>게임 속 한 해가 몇 초 동안 흐를지</small>
            </span>
            <div className="year-chips" role="radiogroup">
              {YEAR_SECONDS.map((s) => (
                <button key={s} role="radio" aria-checked={yearSeconds === s} className={`chip${yearSeconds === s ? ' on' : ''}`} onClick={() => onYearSecondsChange(s)}>
                  {s}초
                </button>
              ))}
            </div>
            <p className="year-note">
              82년을 살면 길어야 {Math.max(1, Math.round((yearSeconds * 82) / 60))}분쯤 걸립니다(아무 일 없는 해는 건너뜁니다). 게임 중에도 위쪽에서 바꿀 수 있고, Space로 멈추고 →로 바로 다음 해로 넘깁니다.
            </p>
          </section>

          <div className="intro-actions">
            <button className="btn btn-primary" onClick={onStart}>
              {birthYear}년에 태어나기
            </button>
            <label className="toggle">
              <input type="checkbox" checked={auto} onChange={(e) => onAutoChange(e.target.checked)} /> <span>선택도 운에 맡기기</span>
            </label>
          </div>

          {pastLives.length > 0 && (
            <section className="past">
              <h2>지난 생</h2>
              <ol>
                {pastLives.slice(0, 8).map((l) => (
                  <li key={l.at}>
                    <strong>{l.name}</strong> · {l.birthYear ? `${l.birthYear}년생 · ` : ''}
                    {l.region} · {l.age}세, {l.cause}
                  </li>
                ))}
              </ol>
              <button className="btn-link" onClick={onClearPast}>
                기록 지우기
              </button>
            </section>
          )}

          <details className="about">
            <summary>이 게임의 숫자에 대해</summary>
            <p>
              통계청 인구동향조사(출생), 생명표, 사망원인통계, 장래인구추계, 가계동향조사, 가계금융복지조사, 경제활동인구조사, 교육통계, 혼인통계,
              병무청 복무기간 등 공개 통계를 바탕으로 만든 근사 모형입니다. 연도 사이의 값은 앞뒤 공표치로 보간했고, 1970년 이전과 2025년 이후는
              추정·전망치입니다.
            </p>
            <p>금액은 모두 2024년 현재 가치로 계산합니다. 실제 개인의 삶을 예측하지 않으며, 같은 조건이라도 매번 다른 삶이 펼쳐집니다.</p>
            <p>
              이 게임은 자살을 사망 원인에서 제외합니다. 힘든 마음이 들면 자살예방상담전화 <strong>109</strong>에서 언제든 이야기를 나눌 수 있습니다.
            </p>
          </details>
        </div>
        {/* 넓은 화면: 오른쪽에 고른 해의 지도와 인구 분포표 / 좁은 화면: 맨 아래 */}
        <aside className="intro-side">
          <PopulationMap year={birthYear} />
        </aside>
      </div>
    </main>
  );
}
