'use client';

/*
 * 게임 전체 상태와 진행 타이머.
 * 인생 자체(Life)는 엔진 객체라 ref 에 두고, 화면에 필요한 것만 state 로 옮겨 그린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLife, type ChoiceView, type Life, type Snapshot, type Summary, type YearResult } from '@/lib/engine';
import { loadPastLives, loadPrefs, savePastLives, savePrefs, type PastLife, type Speed } from '@/lib/storage';
import ChoicePanel from './ChoicePanel';
import Ending from './Ending';
import Hud from './Hud';
import Intro from './Intro';
import LifeLog, { type YearBlock } from './LifeLog';

type Phase = 'intro' | 'playing' | 'ending' | 'review';

const SPEED_MS: Record<Speed, number> = { 1: 2200, 2: 1100, 4: 550, 8: 260 };
const ENDING_DELAY_MS = 1600;

export default function Game() {
  const lifeRef = useRef<Life | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [blocks, setBlocks] = useState<YearBlock[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [choice, setChoice] = useState<ChoiceView | null>(null);
  const [dead, setDead] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [speed, setSpeedState] = useState<Speed>(1);
  const [paused, setPaused] = useState(false);
  const [auto, setAutoState] = useState(false);
  const [pastLives, setPastLives] = useState<PastLife[]>([]);

  // 저장된 설정과 지난 생 불러오기 (브라우저에서만)
  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.speed && SPEED_MS[prefs.speed]) setSpeedState(prefs.speed);
    if (prefs.auto) setAutoState(true);
    setPastLives(loadPastLives());
  }, []);

  const setSpeed = useCallback((s: Speed) => {
    setSpeedState(s);
    savePrefs({ ...loadPrefs(), speed: s });
  }, []);

  const setAuto = useCallback((v: boolean) => {
    setAutoState(v);
    savePrefs({ ...loadPrefs(), auto: v });
  }, []);

  // 엔진이 돌려준 한 해 결과를 화면 상태로 옮긴다
  const applyResult = useCallback((res: YearResult) => {
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
    const life = createLife();
    lifeRef.current = life;
    setBlocks([]);
    setDead(false);
    setSummary(null);
    setChoice(null);
    setPaused(false);
    setPhase('playing');
    applyResult(life.start());
    window.scrollTo(0, 0);
  }, [applyResult]);

  const pick = useCallback(
    (i: number) => {
      const life = lifeRef.current;
      if (!life || !life.pending || i < 0 || i >= life.pending.options.length) return;
      applyResult(life.choose(i));
    },
    [applyResult],
  );

  // 진행 타이머: 한 해가 그려질 때마다(snap 변경) 다음 해를 예약한다
  useEffect(() => {
    const life = lifeRef.current;
    if (phase !== 'playing' || paused || dead || !life) return;
    if (choice) {
      if (!auto) return;
      const t = setTimeout(() => pick(life.autoChoiceIndex()), Math.max(500, SPEED_MS[speed]));
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      let res = life.next();
      // 아무 일도 없던 해는 몰아서 넘긴다
      for (let guard = 0; !res.entries.length && !res.choice && !res.dead && guard < 3; guard++) res = life.next();
      applyResult(res);
    }, SPEED_MS[speed]);
    return () => clearTimeout(t);
  }, [phase, paused, dead, choice, auto, speed, snap, pick, applyResult]);

  // 생이 끝나면 기록을 남기고 잠시 뒤 마지막 화면으로
  useEffect(() => {
    if (!dead || phase !== 'playing' || !lifeRef.current) return;
    const s = lifeRef.current.summary();
    setSummary(s);
    const t = setTimeout(() => {
      const lives = [{ name: s.name, region: s.region, age: s.age, cause: s.cause, first: s.lines[0], at: Date.now() }, ...loadPastLives()];
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
    const id = requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: speed >= 4 ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [blocks, phase, speed]);

  // 키보드: Space 일시정지, 숫자키로 선택
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (choice && /^[1-9]$/.test(e.key)) {
        pick(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, choice, pick]);

  const clearPast = useCallback(() => {
    savePastLives([]);
    setPastLives([]);
  }, []);

  if (phase === 'intro' || !snap) {
    return <Intro auto={auto} onAutoChange={setAuto} onStart={start} pastLives={pastLives} onClearPast={clearPast} />;
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
      />
    );
  }

  return (
    <main className="screen game">
      <Hud snap={snap} speed={speed} paused={paused} showControls={phase === 'playing'} onSpeed={setSpeed} onTogglePause={() => setPaused((p) => !p)} />
      <LifeLog blocks={blocks} animate={phase === 'playing'} />
      {phase === 'review' && (
        <button className="btn btn-primary back-to-end" onClick={() => setPhase('ending')}>
          마지막 화면으로
        </button>
      )}
      {phase === 'playing' && choice && !dead && <ChoicePanel choice={choice} auto={auto} onPick={pick} onAutoChange={setAuto} />}
    </main>
  );
}
