---
name: testing
description: 5000만분의 1 테스트 방법. 엔진·사건·화면을 고친 뒤 무엇을 어떻게 돌려 확인하는지(npm test 스모크 테스트, 통계 시뮬레이터, 헤드리스 브라우저 스크린샷).
---

# 테스트

## 1. `npm test` — 엔진 스모크 테스트 (`scripts/test.ts`)

몇 초 안에 끝나는 검사. 엔진이나 사건 데이터를 고칠 때마다 돌린다. 실패하면 종료 코드 1.

- **끝까지 살기**: 출생연도 1960~2026, 여러 성향의 가상 플레이어(무작위·운에 맡기기·늘 첫째·늘 마지막)가
  예외 없이 생을 끝내는지. 한 생이 130년을 넘지 않는지.
- **되살리기**: 저장한 동작(씨앗값 + `n`/`a`/숫자/돈 관리 계획)을 다시 돌리면 같은 상태가 나오는지.
- **시대 검사**: 기록에 나온 문장이 시대·세대에 맞는지. `realism` SKILL 의 금지 규칙을 코드로 확인한다
  (예: 1980년 이후 출생자가 노년에 스마트폰 쓰는 법을 배우지 않는다, 삐삐는 1993~1999년에만).
- **수치 범위**: 상태 수치 0~100, 돈이 NaN·Infinity 가 아님.
- **돈 관리**: 무작위 플레이어가 가끔 계획을 바꾼다(`{ p }` 동작). 예금 + 투자 = 쓸 수 있는 돈인지.
- **선택지 수**: 2~5개인지 (`MAX_OPTIONS`).
- **문장 점검**: 조사 실패 흔적(`이(가)`, `을(를)`), `undefined`, `NaN` 이 기록에 없는지.

새 기능을 넣으면 그 기능의 불변 조건을 여기에 추가한다.

## 2. 통계 시뮬레이터 (`scripts/simulate.ts`)

- `npx tsx scripts/simulate.ts all` — 1960~2026년생 코호트별 5천 명. 진학률·초혼·자녀 수·출산 나이·자가·순자산.
- `data.ts`·`timeline.ts`·`engine.ts` 를 고친 뒤 꼭 돌린다. 기준값(참고 열)과 크게 벗어나면 보정한다.
- 갈림길·돈 관리처럼 '플레이어 선택'에 따라 달라지는 기능은 `scripts/stats.ts`(stats SKILL)로 따로 본다.

## 3. 화면 확인 (헤드리스 Edge)

개발 서버(`npm run dev`, http://localhost:3000)가 떠 있을 때:

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,1000 \
  --virtual-time-budget=8000 --screenshot="<스크래치>/shot.png" http://localhost:3000/
```

- 버튼을 눌러야 보이는 화면은 `node scripts/shot.mjs <url> <png> [너비] [높이] [버튼 글자...]` (CDP 로 클릭 후 전체 페이지).
  이 도구는 너비를 직접 지정하므로 390px 휴대폰 폭도 찍힌다.
- `--screenshot` 방식은 Edge 창 최소 폭(약 500px) 때문에 휴대폰 폭이 실제보다 넓게 그려진다.
- 게임 중간 화면은 클릭이 필요하므로, 확인용 임시 페이지(`src/app/preview-*/page.tsx`)를 만들어 찍고 **꼭 지운다**.
- 개발 오버레이 오류는 `POST http://localhost:3000/_next/mcp` (`get_errors`) 로 확인한다.

## 4. 커밋 전

`npm run typecheck && npm test && npm run build`
