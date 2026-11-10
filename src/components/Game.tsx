'use client';

/*
 * 게임 전체 상태와 진행 타이머.
 * 인생 자체(Life)는 엔진 객체라 ref 에 두고, 화면에 필요한 것만 state 로 옮겨 그린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLife, Life, type ChoiceView, type Snapshot, type Stats, type Summary, type YearResult } from '@/lib/engine';
import {
  clearSavedLife, DEFAULT_YEAR_SECONDS, FAST_YEAR_SECONDS, toYearSeconds, loadPastLives, loadPrefs, loadSavedLife, savePastLives, savePrefs, saveLife,
  type LifeAction, type PastLife, type SavedLife, type YearSeconds,
} from '@/lib/storage';
import { replayLife } from '@/lib/replay';
import { CURRENT_YEAR, MAX_BIRTH_YEAR, MIN_BIRTH_YEAR } from '@/lib/timeline';
import BirthMap from './BirthMap';
import ChoicePanel from './ChoicePanel';
import Ending from './Ending';
import Hud, { type ProgressState } from './Hud';
import Intro from './Intro';
import LifeLog, { revealDuration, type YearBlock } from './LifeLog';
import SidePanel from './SidePanel';

type Phase = 'intro' | 'birth' | 'playing' | 'ending' | 'review';

const ENDING_DELAY_MS = 1600;

/** 한 해 결과를 생애 기록에 덧붙인다. 선택의 결과는 그해 기록에 이어 붙인다. */
function mergeBlocks(prev: YearBlock[], res: YearResult): YearBlock[] {
  if (!res.entries.length) return prev;
  if (res.isChoiceResult && prev.length) {
    const last = prev[prev.length - 1];
    return [...prev.slice(0, -1), { ...last, entries: [...last.entries, ...res.entries], staggerFrom: last.entries.length }];
  }
  return [...prev, { id: prev.length, age: res.age, year: res.year, entries: res.entries, staggerFrom: 0 }];
}

/**
 * 저장된 생을 같은 씨앗값으로 처음부터 다시 돌려 되살린다 (lib/replay).
 * 엔진 코드가 바뀌어 동작이 맞지 않게 되면(선택지가 없는데 선택 등) 거기서 멈춘다.
 */
function replay(saved: SavedLife) {
  let blocks: YearBlock[] = [];
  const r = replayLife(saved.seed, saved.birthYear, saved.actions, (res) => (blocks = mergeBlocks(blocks, res)));
  return { life: r.life, res: r.res, blocks, prev: r.prev ? r.prev.snapshot : null, actions: r.actions };
}

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
  /** 지금 인생에서 지금까지 한 동작 (저장·되살리기용) */
  const actionsRef = useRef<LifeAction[]>([]);
  const [saved, setSaved] = useState<SavedLife | null>(null);

  // 개발 중 핫 리로드: engine.ts·events.ts·content.ts 등을 고치면 Fast Refresh 가 새 Life 클래스를 가져오지만,
  // 진행 중인 인생은 ref 에 든 옛 클래스 객체라 그대로 옛 코드로 돈다. 프로토타입만 새 클래스로 바꿔 끼워
  // 나이·가족·재산은 그대로 두고 다음 해부터 고친 코드가 돌게 한다. (생성자에서 새로 만든 필드는 새 인생부터)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const life = lifeRef.current;
    if (!life || Object.getPrototypeOf(life) === Life.prototype) return;
    Object.setPrototypeOf(life, Life.prototype);
    const s = life.snapshot();
    snapRef.current = s;
    setSnap(s);
    console.info('[핫 리로드] 진행 중인 인생에 고친 엔진 코드를 적용했다.');
  });

  // 저장된 설정과 지난 생 불러오기 (브라우저에서만)
  useEffect(() => {
    const prefs = loadPrefs();
    const ys = toYearSeconds(prefs.yearSeconds);
    if (ys) setYearSecondsState(ys);
    if (prefs.auto) setAutoState(true);
    if (prefs.birthYear && prefs.birthYear >= MIN_BIRTH_YEAR && prefs.birthYear <= MAX_BIRTH_YEAR) setBirthYearState(prefs.birthYear);
    setPastLives(loadPastLives());
    setSaved(loadSavedLife());
  }, []);

  const yearSecondsRef = useRef(yearSeconds);
  yearSecondsRef.current = yearSeconds;
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
      setBlocks((prev) => mergeBlocks(prev, res));
    }
    setChoice(res.choice);
    if (res.dead) setDead(true);
  }, []);

  const start = useCallback(() => {
    // 새로 태어나면 저장해 둔 생은 지운다
    clearSavedLife();
    setSaved(null);
    actionsRef.current = [];
    const life = createLife({ birthYear });
    lifeRef.current = life;
    snapRef.current = null;
    setSideOpen(false);
    setBlocks([]);
    setDead(false);
    setSummary(null);
    setChoice(null);
    setPaused(false);
    applyResult(life.start());
    // 바로 시작하지 않고, 지도 위에서 태어날 곳을 보여 준 뒤 시작한다
    setPhase('birth');
    window.scrollTo(0, 0);
  }, [applyResult, birthYear]);

  const beginLife = useCallback(() => {
    setPhase((p) => (p === 'birth' ? 'playing' : p));
    window.scrollTo(0, 0);
  }, []);

  const pick = useCallback(
    (i: number) => {
      const life = lifeRef.current;
      if (!life || !life.pending || i < 0 || i >= life.pending.options.length) return;
      actionsRef.current.push(i);
      applyResult(life.choose(i));
    },
    [applyResult],
  );

  // 다음 해로 넘기기 (선택이 떠 있으면 자동 선택)
  const advance = useCallback(() => {
    const life = lifeRef.current;
    if (!life || !life.alive) return;
    if (life.pending) {
      // 운에 맡긴 선택은 난수를 쓰므로 직접 고른 선택과 따로 남긴다
      actionsRef.current.push('a');
      applyResult(life.choose(life.autoChoiceIndex()));
      return;
    }
    let res = life.next();
    actionsRef.current.push('n');
    // 빠른 모드에서는 아무 일도 없던 해를 몰아서 넘긴다
    for (let guard = 0; yearSecondsRef.current <= FAST_YEAR_SECONDS && !res.entries.length && !res.choice && !res.dead && guard < 3; guard++) {
      res = life.next();
      actionsRef.current.push('n');
    }
    applyResult(res);
  }, [applyResult]);

  // 진행 중인 생을 저장한다 (해가 바뀔 때마다, 홈으로 갈 때)
  const persist = useCallback((): SavedLife | null => {
    const life = lifeRef.current;
    const s = snapRef.current;
    if (!life || !life.alive || !s) return null;
    const data: SavedLife = {
      v: 1, seed: life.seed, birthYear: life.birthYear, actions: [...actionsRef.current],
      name: s.name, age: s.age, year: s.year, at: Date.now(),
    };
    saveLife(data);
    return data;
  }, []);

  useEffect(() => {
    if ((phase === 'playing' || phase === 'birth') && !dead) persist();
  }, [snap, phase, dead, persist]);

  const goHome = useCallback(() => {
    setSaved(persist());
    setSideOpen(false);
    setPhase('intro');
    window.scrollTo(0, 0);
  }, [persist]);

  // 이어서 하기: 이번 접속에서 홈으로 나왔던 생이면 그대로, 새로 고침 뒤라면 저장된 동작을 다시 돌려 되살린다
  const resume = useCallback(() => {
    if (!saved) return;
    const cur = lifeRef.current;
    if (!(cur && cur.alive && cur.seed === saved.seed && snapRef.current)) {
      const r = replay(saved);
      lifeRef.current = r.life;
      actionsRef.current = r.actions;
      snapRef.current = r.res.snapshot;
      setSnap(r.res.snapshot);
      setPrevStats(r.prev ? r.prev.stats : null);
      setBlocks(r.blocks);
      setChoice(r.res.choice);
      setDead(r.res.dead);
      setSummary(null);
      setPaused(false);
    }
    setSideOpen(false);
    setPhase('playing');
    requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  }, [saved]);

  const discardSaved = useCallback(() => {
    clearSavedLife();
    setSaved(null);
    lifeRef.current = null;
    actionsRef.current = [];
  }, []);

  // 진행 타이머. 한 해(1년 = yearSeconds 초)가 흐르는 정도를 progress(0~1)로 쌓고, 다 차면 다음 해로 넘긴다.
  // 멈추거나 선택을 기다리는 동안에는 쌓지 않아서, 다시 움직이면 멈췄던 자리부터 이어진다.
  // 막대는 매 프레임 DOM 너비만 바꿔 화면 전체를 다시 그리지 않는다.
  const progressRef = useRef(0);
  const barRef = useRef<HTMLElement | null>(null);
  const waitingChoice = !!choice && !auto;
  // 그해 마지막 묶음의 문장이 다 나타나기까지 걸리는 시간. 선택지는 그 뒤에 보인다.
  const lastBlock = blocks[blocks.length - 1];
  const revealMs = phase === 'playing' && lastBlock ? revealDuration(yearSeconds, lastBlock.entries.length - (lastBlock.staggerFrom ?? 0)) * 1000 : 0;
  const progressState: ProgressState = phase !== 'playing' || dead ? 'done' : waitingChoice ? 'choice' : paused ? 'paused' : 'running';
  useEffect(() => {
    const paint = () => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, progressRef.current)})`;
    };
    paint();
    if (progressState !== 'running') return;
    // 자동 선택은 그해 문장이 다 나온 뒤 잠깐만 기다린다
    const duration = choice ? revealMs + Math.min(4000, Math.max(800, yearSeconds * 300)) : yearSeconds * 1000;
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
  }, [progressState, choice, yearSeconds, snap, advance, revealMs]);

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
    clearSavedLife();
    setSaved(null);
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
        saved={saved}
        onResume={resume}
        onDiscardSaved={discardSaved}
      />
    );
  }

  if (phase === 'birth' && lifeRef.current) {
    return (
      <BirthMap
        regionId={lifeRef.current.region.id}
        birthYear={lifeRef.current.birthYear}
        name={snap.name}
        sex={snap.sex}
        familyLabel={snap.familyLabel}
        onDone={beginLife}
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
        onHome={goHome}
      />
      <div className="game-body">
        <div className="game-main">
          <LifeLog blocks={blocks} animate={phase === 'playing'} yearSeconds={yearSeconds} />
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
          {phase === 'playing' && choice && !dead && <ChoicePanel choice={choice} auto={auto} onPick={pick} onAutoChange={setAuto} delayMs={revealMs} />}
        </div>
        {/* 넓은 화면: 오른쪽 고정 패널 / 휴대폰: '가족·자산' 버튼으로 여는 서랍 */}
        <div className={`side-wrap${sideOpen ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && setSideOpen(false)}>
          <SidePanel snap={snap} onClose={() => setSideOpen(false)} />
        </div>
      </div>
    </main>
  );
}
