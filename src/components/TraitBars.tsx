import { TRAITS, type TraitKey } from '@/lib/content';

/** 성향 4축 막대. 가운데가 0, ±50이면 한쪽 끝까지 찬다 */
export default function TraitBars({ traits }: { traits: Record<TraitKey, number> }) {
  return (
    <ul className="me-traits">
      {(Object.keys(TRAITS) as TraitKey[]).map((k) => {
        const v = traits[k];
        const [pos, neg] = TRAITS[k];
        const len = Math.min(50, Math.abs(v));
        return (
          <li key={k} aria-label={`${v >= 0 ? pos : neg} ${Math.abs(v)}`}>
            <span className={v < -10 ? 'on' : ''}>{neg}</span>
            <i>
              <b style={{ left: v >= 0 ? '50%' : `${50 - len}%`, width: `${len}%` }} />
            </i>
            <span className={v > 10 ? 'on' : ''}>{pos}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 성향과 관심 분야로 만든 한 줄 */
export function epitaph(traits: Record<TraitKey, number>, interest: string | null, josaFn: (w: string, p: string) => string): string {
  const words = (Object.keys(TRAITS) as TraitKey[])
    .map((k) => [k, traits[k]] as const)
    .filter(([, v]) => Math.abs(v) >= 12)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2)
    .map(([k, v]) => TRAITS[k][v >= 0 ? 0 : 1]);
  const who = words.length ? `${words.join(', ')} 사람이었다.` : '담담하게 하루하루를 살아 낸 사람이었다.';
  return interest ? `${josaFn(interest, '을/를')} 좋아했고, ${who}` : who;
}
