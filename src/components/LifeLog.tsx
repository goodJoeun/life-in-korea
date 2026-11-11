import type { Entry } from '@/lib/engine';

export interface YearBlock {
  id: number;
  age: number;
  year: number;
  entries: Entry[];
  /** 이 번호부터가 새로 붙은 문장이다 (선택의 결과가 그해 기록에 이어 붙을 때). 차례로 나타나게 한다. */
  staggerFrom?: number;
}

/** 한 해의 문장 n개를 1년의 70% 동안 고르게 나눠 보여 줄 때, 문장 사이 간격(초). 최대 4초 */
export function revealGap(yearSeconds: number, n: number): number {
  if (n <= 1) return 0;
  return Math.min(4, (yearSeconds * 0.7) / n);
}
/** 문장 n개가 모두 나타나기까지 걸리는 시간(초) */
export const revealDuration = (yearSeconds: number, n: number) => (n <= 1 ? 0 : revealGap(yearSeconds, n) * (n - 1));

/** instant: 선택을 기다리는 해. 문장을 늦추지 않고 한꺼번에 보여 준다 */
export default function LifeLog({ blocks, animate, yearSeconds = 4, instant = false }: { blocks: YearBlock[]; animate: boolean; yearSeconds?: number; instant?: boolean }) {
  const lastId = blocks.length ? blocks[blocks.length - 1].id : -1;
  return (
    <section className={`log${animate ? '' : ' reviewing'}`} aria-live="polite">
      {blocks.map((b) => {
        const from = b.staggerFrom ?? 0;
        const gap = animate && !instant && b.id === lastId ? revealGap(yearSeconds, b.entries.length - from) : 0;
        return (
          <div key={b.id} className="yr">
            <div className="yr-when">
              <b>{b.age}세</b>
              <small>{b.year}</small>
            </div>
            <div className="yr-body">
              {b.entries.map((e, i) => (
                <p key={i} className={`e-${e.kind}`} style={gap && i >= from ? { animationDelay: `${(i - from) * gap}s` } : undefined}>
                  {e.text}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
