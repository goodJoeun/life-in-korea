/*
 * 동작 기록과 되살리기.
 * 엔진은 씨앗값이 같으면 똑같이 흘러가므로, 씨앗값과 지금까지 한 동작만 있으면 생을 그대로 다시 만들 수 있다.
 * 화면(Game 의 이어서 하기)과 테스트(scripts/test.ts)가 함께 쓴다. React·DOM 을 쓰지 않는다.
 */
import { createLife, type Life, type MoneyPlan, type YearResult } from './engine';

/** n: 다음 해 · a: 운에 맡긴 선택(난수를 쓴다) · 숫자: 직접 고른 선택지 · { p }: 돈 관리 계획 바꾸기 */
export type LifeAction = 'n' | 'a' | number | { p: MoneyPlan };

/** 동작 하나를 적용한다. 지금 상태와 맞지 않으면(선택지가 없는데 선택 등) null */
export function applyAction(life: Life, a: LifeAction): YearResult | null {
  if (!life.alive) return null;
  if (typeof a === 'object') return life.setPlan(a.p);
  const p = life.pending;
  if (a === 'n') return p ? null : life.next();
  if (!p) return null;
  if (a === 'a') return life.choose(life.autoChoiceIndex());
  if (a < 0 || a >= p.options.length) return null;
  return life.choose(a);
}

/**
 * 처음부터 다시 돌린다. 맞지 않는 동작을 만나면 거기서 멈추고, 실제로 적용된 동작만 돌려준다.
 * onResult 는 출생을 포함한 해마다의 결과를 받는다.
 */
export function replayLife(seed: number, birthYear: number, actions: LifeAction[], onResult?: (res: YearResult) => void) {
  const life = createLife({ seed, birthYear });
  let res = life.start();
  onResult?.(res);
  let prev: YearResult | null = null;
  const applied: LifeAction[] = [];
  for (const a of actions) {
    const next = applyAction(life, a);
    if (!next) break;
    prev = res;
    res = next;
    onResult?.(res);
    applied.push(a);
  }
  return { life, res, prev, actions: applied };
}
