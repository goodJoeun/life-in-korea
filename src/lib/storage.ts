// 브라우저 저장소. 막혀 있거나(사파리 비공개 모드 등) 비어 있어도 게임은 돌아가게 한다.

export interface PastLife { name: string; region: string; age: number; cause: string; first: string; at: number; birthYear?: number }
export type Speed = 1 | 2 | 4 | 8;
export interface Prefs { speed?: Speed; auto?: boolean; birthYear?: number }

const LIVES_KEY = 'lik.lives.v1';
const PREFS_KEY = 'lik.prefs.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 못 해도 무시 */
  }
}

export const loadPastLives = () => load<PastLife[]>(LIVES_KEY, []);
export const savePastLives = (lives: PastLife[]) => save(LIVES_KEY, lives.slice(0, 50));
export const loadPrefs = () => load<Prefs>(PREFS_KEY, {});
export const savePrefs = (p: Prefs) => save(PREFS_KEY, p);
