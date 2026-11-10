// 브라우저 저장소. 막혀 있거나(사파리 비공개 모드 등) 비어 있어도 게임은 돌아가게 한다.

export interface PastLife { name: string; region: string; age: number; cause: string; first: string; at: number; birthYear?: number }
/** 게임 속 1년이 실제로 몇 초인지. 고를 수 있는 값 */
export const YEAR_SECONDS = [1, 2, 4, 7, 12] as const;
export type YearSeconds = (typeof YEAR_SECONDS)[number];
export const DEFAULT_YEAR_SECONDS: YearSeconds = 4;
export const isYearSeconds = (v: unknown): v is YearSeconds => (YEAR_SECONDS as readonly unknown[]).includes(v);
export interface Prefs { yearSeconds?: number; auto?: boolean; birthYear?: number }

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

// ───────── 진행 중인 생 ─────────
// 엔진은 씨앗값이 같으면 똑같이 흘러가므로, 씨앗값과 지금까지의 동작만 남겼다가 다시 돌려 되살린다.
// (갈림길 선택지에는 함수가 들어 있어 인생 객체를 그대로 저장할 수 없다)

/** n: 다음 해 · a: 운에 맡긴 선택(난수를 쓴다) · 숫자: 직접 고른 선택지 */
export type LifeAction = 'n' | 'a' | number;
export interface SavedLife {
  v: 1; seed: number; birthYear: number; actions: LifeAction[];
  /** 시작 화면에 보여 줄 요약 */
  name: string; age: number; year: number; at: number;
}

const SAVE_KEY = 'lik.save.v1';

export function loadSavedLife(): SavedLife | null {
  const s = load<SavedLife | null>(SAVE_KEY, null);
  return s && s.v === 1 && Array.isArray(s.actions) && typeof s.seed === 'number' ? s : null;
}
export const saveLife = (s: SavedLife) => save(SAVE_KEY, s);
export function clearSavedLife() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 무시 */
  }
}
