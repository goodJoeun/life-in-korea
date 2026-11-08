// 한국어 문장 도우미

// 숫자·기호를 읽었을 때의 받침 (0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔은 받침이 있다. ㄹ 받침은 8)
const DIGIT_JONG: Record<string, number> = { '0': 21, '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0, '%': 0 };

function lastJong(word: string): number {
  const ch = word[word.length - 1];
  if (ch in DIGIT_JONG) return DIGIT_JONG[ch];
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : -1; // -1: 한글이 아님
}

/**
 * 받침에 맞춰 조사를 붙인다.
 *   josa('사과', '을/를') → '사과를'
 *   josa('서울', '으로/로') → '서울로' (ㄹ 받침은 '로')
 */
export function josa(word: string, pair: string): string {
  const [withJong, noJong] = pair.split('/');
  const j = lastJong(word);
  if (pair === '으로/로') return word + (j <= 0 || j === 8 ? '로' : '으로');
  if (j < 0) return `${word}${withJong}(${noJong})`;
  return word + (j > 0 ? withJong : noJong);
}

/** 조사만 돌려준다. particle('서아', '과/와') → '와' */
export function particle(word: string, pair: string): string {
  return josa(word, pair).slice(word.length);
}

/** 만원 단위 금액 → '1억 2,300만 원' */
export function won(man: number): string {
  const neg = man < 0;
  const v = Math.round(Math.abs(man));
  const eok = Math.floor(v / 10000);
  const rest = v % 10000;
  let s = '';
  if (eok) s += eok.toLocaleString('ko-KR') + '억';
  if (rest || !eok) s += (eok ? ' ' : '') + rest.toLocaleString('ko-KR') + '만';
  return (neg ? '-' : '') + s + ' 원';
}
