// 시드 고정 난수. 같은 시드면 같은 인생이 나온다.

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  rand(): number {
    return this.next();
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** 가중치 뽑기. 기본은 [값, 가중치] 튜플 */
  weighted<T>(items: readonly T[], w: (x: T) => number = (x) => (x as unknown as [unknown, number])[1]): T {
    const total = items.reduce((s, x) => s + w(x), 0);
    let r = this.next() * total;
    for (const x of items) {
      r -= w(x);
      if (r <= 0) return x;
    }
    return items[items.length - 1];
  }
}
