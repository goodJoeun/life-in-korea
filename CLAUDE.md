@AGENTS.md

# 5000만분의 1

한국 통계 기반 인생 시뮬레이션 웹게임. Next.js 16 App Router + React 19 + TypeScript, 정적 export.

## 명령
- `npm test` 엔진 스모크 테스트 (끝까지 살기·되살리기·시대 검사)
- `npm run dev` 개발 서버 · `npm run build` 정적 빌드(out/) · `npm run typecheck` · `npm run simulate` 통계 검증 (`npx tsx scripts/simulate.ts all` 출생연도별)

## 규칙
- `src/lib/engine.ts`와 `src/lib/*`는 React·DOM을 쓰지 않는다. `scripts/simulate.ts`가 Node에서 그대로 실행한다.
- 2024년 기준 숫자는 `src/lib/data.ts`, 연도별로 달라지는 숫자는 `src/lib/timeline.ts`에 둔다. 시도별 출생아 수와 출생성비 원자료는 `src/lib/births.ts`에 둔다. 숫자를 바꾸면 (공식)/(추정)/(추계) 출처 주석도 함께 고친다.
- 시대가 있는 문장(스마트폰, 삐삐 등)에는 from/to 연도를 붙인다. 세대가 있는 문장(노인이 스마트폰을 처음 배움, 키오스크 앞에서 헤맴 등)에는 bornFrom/bornTo 태어난 해를 붙인다.
- 해마다 일어나는 작은 사건과 갈림길은 `src/lib/events.ts`, 성향·관심 분야를 쌓는 생애 갈림길은 `src/lib/paths.ts`, 직업 이름·장래희망·전공 등은 `src/lib/content.ts`에 둔다. 사건 수치는 엔진에서 60%만 반영되므로(EVENT_STAT_SCALE) 사건을 많이 늘려도 진학률이 변하는지 시뮬레이터로 확인한다.
- `data.ts`·`timeline.ts`·`engine.ts`를 고친 뒤에는 `npx tsx scripts/simulate.ts all`로 출생연도별 진학률·초혼 연령·혼인율·자녀 수 등이 실제와 크게 벗어나지 않았는지 확인한다.
- 서버 기능(API 라우트, 서버 액션, 동적 렌더링)을 넣지 않는다. `output: 'export'`로 정적 사이트를 유지한다.
- 사망 원인에 자살을 넣지 않는다.
- 게임 문장은 과거형 일기체로 담담하게 쓴다 ("~했다"). 조사는 `josa()` / `particle()`로 붙인다.
- 금액 단위는 만원, 2024년 현재 가치.

## 개발 문서
- 큰 기능은 `claude/*/SKILL.md` 에 설계와 진행 상태가 있다. 작업 전에 `claude/roadmap/SKILL.md` 를 먼저 읽는다.
