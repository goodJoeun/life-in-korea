import type { Entry } from '@/lib/engine';

export interface YearBlock {
  id: number;
  age: number;
  year: number;
  entries: Entry[];
}

export default function LifeLog({ blocks, animate }: { blocks: YearBlock[]; animate: boolean }) {
  return (
    <section className={`log${animate ? '' : ' reviewing'}`} aria-live="polite">
      {blocks.map((b) => (
        <div key={b.id} className="yr">
          <div className="yr-when">
            <b>{b.age}세</b>
            <small>{b.year}</small>
          </div>
          <div className="yr-body">
            {b.entries.map((e, i) => (
              <p key={i} className={`e-${e.kind}`}>
                {e.text}
              </p>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
