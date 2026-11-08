'use client';

/*
 * 게임 전체 상태와 진행 타이머.
 * 인생 자체(Life)는 엔진 객체라 ref 에 두고, 화면에 필요한 것만 state 로 옮겨 그린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLife, type ChoiceView, type Life, type Snapshot, type Stats, type Summary, type YearResult } from '@/lib/engine';
import { DEFAULT_YEAR_SECONDS, isYearSeconds, loadPastLives, loadPrefs, savePastLives, savePrefs, type PastLife, type YearSeconds } from '@/lib/storage';
import { CURRENT_YEAR, MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from '@/lib/timeline';
import ChoicePanel from './ChoicePanel';
import Ending from './Ending';
import Hud, { type ProgressState } from './Hud';
import Intro from './Intro';
import LifeLog, { type YearBlock } from './LifeLog';
import SidePanel from './SidePanel';

type Phase = 'intro' | 'playing' | 'ending' | 'review';

const ENDING_DELAY_MS = 1600;

export default function Game() {
  const lifeRef = useRef<Life | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [blocks, setBlocks] = useState<YearBlock[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const [prevStats, setPrevStats] = useState<Stats | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [choice, setChoice] = useState<ChoiceView | null>(null);
  const [dead, setDead] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [yearSeconds, setYearSecondsState] = useState<YearSeconds>(DEFAULT_YEAR_SECONDS);
  const [paused, setPaused] = useState(false);
  const [auto, setAutoState] = useState(false);
  const [pastLives, setPastLives] = useState<PastLife[]>([]);
  const [birthYear, setBirthYearState] = useState<number>(CURRENT_YEAR);

  // 저장된 설정과 지난 생 불러오기 (브라우저에서만)
  useEffect(() => {
    const prefs = loadPrefs();
    if (isYearSeconds(prefs.yearSeconds)) setYearSecondsState(prefs.yearSeconds);
    if (prefs.auto) setAutoState(true);
    if (prefs.birthYear && prefs.birthYear >= MIN_BIRTH_YEAR && prefs.birthYear <= MAX_BIRTH_YEAR) setBirthYearState(prefs.birthYear);
    setPastLives(loadPastLives());
  }, []);

  const setYearSeconds = useCallback((s: YearSeconds) => {
    setYearSecondsState(s);
    savePrefs({ ...loadPrefs(), yearSeconds: s });
  }, []);

  const setBirthYear = useCallback((y: number) => {
    setBirthYearState(y);
    savePrefs({ ...loadPrefs(), birthYear: y });
  }, []);

  const setAuto = useCallback((v: boolean) => {
    setAutoState(v);
    savePrefs({ ...loadPrefs(), auto: v });
  }, []);

  // 엔진이 돌려준 한 해 결과를 화면 상태로 옮긴다
  const applyResult = useCallback((res: YearResult) => {
    setPrevStats(snapRef.current ? snapRef.current.stats : null);
    snapRef.current = res.snapshot;
    setSnap(res.snapshot);
    if (res.entries.length) {
      setBlocks((prev) => {
        if (res.isChoiceResult && prev.length) {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, entries: [...last.entries, ...res.entries] }];
        }
        return [...prev, { id: prev.length, age: res.age, year: res.year, entries: res.entries }];
      });
    }
    setChoice(res.choice);
    if (res.dead) setDead(true);
  }, []);

  const start = useCallback(() => {
    const life = createLife({ birthYear });
    lifeRef.current = life;
    snapRef.current = null;
    setSideOpen(false);
    setBlocks([]);
    setDead(false);
    setSummary(null);
    setChoice(null);
    setPaused(false);
    setPhase('playing');
    applyResult(life.start());
    window.scrollTo(0, 0);
  }, [applyResult, birthYear]);

  const pick = useCallback(
    (i: number) => {
      const life = lifeRef.current;
      if (!life || !life.pending || i < 0 || i >= life.pending.options.length) return;
      applyResult(life.choose(i));
    },
    [applyResult],
  );

  // 다음 해로 넘기기 (선택이 떠 있으면 자동 선택)
  const advance = useCallback(() => {
    const life = lifeRef.current;
    if (!life || !life.alive) return;
    if (life.pending) {
      pick(life.autoChoiceIndex());
      return;
    }
    let res = life.next();
    // 아무 일도 없던 해는 몰아서 넘긴다
    for (let guard = 0; !res.entries.length && !res.choice && !res.dead && guard < 3; guard++) res = life.next();
    applyResult(res);
  }, [applyResult, pick]);

  // 진행 타이머. 한 해(1년 = yearSeconds 초)가 흐르는 정도를 progress(0~1)로 쌓고, 다 차면 다음 해로 넘긴다.
  // 멈추거나 선택을 기다리는 동안에는 쌓지 않아서, 다시 움직이면 멈췄던 자리부터 이어진다.
  // 막대는 매 프레임 DOM 너비만 바꿔 화면 전체를 다시 그리지 않는다.
  const progressRef = useRef(0);
  const barRef = useRef<HTMLElement | null>(null);
  const waitingChoice = !!choice && !auto;
  const progressState: ProgressState = phase !== 'playing' || dead ? 'done' : waitingChoice ? 'choice' : paused ? 'paused' : 'running';
  useEffect(() => {
    const paint = () => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, progressRef.current)})`;
    };
    paint();
    if (progressState !== 'running') return;
    // 자동 선택은 한 해의 절반만 기다린다 (최소 0.8초)
    const duration = choice ? Math.max(800, yearSeconds * 500) : yearSeconds * 1000;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      progressRef.current += Math.min(now - last, 250) / duration; // 탭을 다녀오면 한 번에 몰아 넘기지 않는다
      last = now;
      paint();
      if (progressRef.current >= 1) {
        progressRef.current = 0;
        advance();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [progressState, choice, yearSeconds, snap, advance]);

  // 새 해가 시작되면 막대를 비운다
  useEffect(() => {
    progressRef.current = 0;
  }, [snap]);

  const skip = useCallback(() => {
    if (progressState !== 'running' && progressState !== 'paused') return;
    progressRef.current = 0;
    advance();
  }, [progressState, advance]);

  // 생이 끝나면 기록을 남기고 잠시 뒤 마지막 화면으로
  useEffect(() => {
    if (!dead || phase !== 'playing' || !lifeRef.current) return;
    const s = lifeRef.current.summary();
    setSummary(s);
    const t = setTimeout(() => {
      const lives = [{ name: s.name, region: s.region, age: s.age, cause: s.cause, first: s.lines[0], at: Date.now(), birthYear: s.birthYear }, ...loadPastLives()];
      savePastLives(lives);
      setPastLives(lives);
      setPhase('ending');
      window.scrollTo(0, 0);
    }, ENDING_DELAY_MS);
    return () => clearTimeout(t);
  }, [dead, phase]);

  // 새 기록이 생기면 맨 아래로 스크롤
  useEffect(() => {
    if (phase !== 'playing' || !blocks.length) return;
    const id = requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: yearSeconds <= 1 ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [blocks, phase, yearSeconds]);

  // 키보드: Space 일시정지, → 바로 다음 해, 숫자키로 선택
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'Escape') setSideOpen(false);
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'ArrowRight' && !choice) {
        skip();
      } else if (choice && /^[1-9]$/.test(e.key)) {
        pick(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, choice, pick, skip]);

  const clearPast = useCallback(() => {
    savePastLives([]);
    setPastLives([]);
  }, []);

  if (phase === 'intro' || !snap) {
    return (
      <Intro
        birthYear={birthYear}
        onBirthYearChange={setBirthYear}
        auto={auto}
        onAutoChange={setAuto}
        yearSeconds={yearSeconds}
        onYearSecondsChange={setYearSeconds}
        onStart={start}
        pastLives={pastLives}
        onClearPast={clearPast}
      />
    );
  }

  if (phase === 'ending' && summary) {
    return (
      <Ending
        summary={summary}
        onAgain={start}
        onReview={() => {
          setPhase('review');
          window.scrollTo(0, 0);
        }}
        onHome={() => {
          setPhase('intro');
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  return (
    <main className="screen game">
      <Hud
        snap={snap}
        prevStats={prevStats}
        yearSeconds={yearSeconds}
        paused={paused}
        showControls={phase === 'playing'}
        progress={progressState}
        barRef={barRef}
        onYearSeconds={setYearSeconds}
        onTogglePause={() => setPaused((p) => !p)}
        onSkip={skip}
        onOpenSide={() => setSideOpen(true)}
      />
      <div className="game-body">
        <div className="game-main">
          <LifeLog blocks={blocks} animate={phase === 'playing'} />
          {phase === 'review' && (
            <div className="review-actions">
              <button className="btn btn-primary" onClick={() => setPhase('ending')}>
                마지막 화면으로
              </button>
              <button className="btn" onClick={() => { setPhase('intro'); window.scrollTo(0, 0); }}>
                처음으로
              </button>
            </div>
          )}
          {phase === 'playing' && choice && !dead && <ChoicePanel choice={choice} auto={auto} onPick={pick} onAutoChange={setAuto} />}
        </div>
        {/* 넓은 화면: 오른쪽 고정 패널 / 휴대폰: '가족·자산' 버튼으로 여는 서랍 */}
        <div className={`side-wrap${sideOpen ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && setSideOpen(false)}>
          <SidePanel snap={snap} onClose={() => setSideOpen(false)} />
        </div>
      </div>
    </main>
  );
}
