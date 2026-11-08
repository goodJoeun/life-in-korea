@AGENTS.md

# 5000만분의 1

한국 통계 기반 인생 시뮬레이션 웹게임. Next.js 16 App Router + React 19 + TypeScript, 정적 export.

## 명령
- `npm run dev` 개발 서버 · `npm run build` 정적 빌드(out/) · `npm run typecheck` · `npm run simulate` 통계 검증

## 규칙
- `src/lib/engine.ts`와 `src/lib/*`는 React·DOM을 쓰지 않는다. `scripts/simulate.ts`가 Node에서 그대로 실행한다.
- 통계 숫자는 `src/lib/data.ts`에만 둔다. 숫자를 바꾸면 출처 주석도 함께 고친다.
- 사건 문장·직업 이름은 `src/lib/content.ts`에 둔다.
- `data.ts`나 `engine.ts`를 고친 뒤에는 `npm run simulate`로 기대수명·진학률·혼인율 등이 목표에서 크게 벗어나지 않았는지 확인한다.
- 서버 기능(API 라우트, 서버 액션, 동적 렌더링)을 넣지 않는다. `output: 'export'`로 정적 사이트를 유지한다.
- 사망 원인에 자살을 넣지 않는다.
- 게임 문장은 과거형 일기체로 담담하게 쓴다 ("~했다"). 조사는 `josa()` / `particle()`로 붙인다.
- 금액 단위는 만원, 2024년 현재 가치.
