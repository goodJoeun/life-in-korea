import type { PastLife } from '@/lib/storage';

interface Props {
  auto: boolean;
  onAutoChange: (v: boolean) => void;
  onStart: () => void;
  pastLives: PastLife[];
  onClearPast: () => void;
}

export default function Intro({ auto, onAutoChange, onStart, pastLives, onClearPast }: Props) {
  return (
    <main className="screen intro">
      <div className="intro-inner">
        <p className="eyebrow">대한민국 인생 시뮬레이션</p>
        <h1 className="title">5000만분의&nbsp;1</h1>
        <p className="lead">
          오늘도 대한민국 어딘가에서 하루 6백여 명의 아이가 태어납니다.
          <br />
          그중 한 아이가 되어, 한 번뿐인 생을 끝까지 살아봅니다.
        </p>
        <p className="sub">
          태어날 지역과 집안 형편은 고를 수 없습니다. 출생·소득·사망 통계가 정합니다.
          <br />
          학원, 진로, 결혼, 집 같은 갈림길에서는 직접 고를 수 있지만, 결과는 확률을 따릅니다.
        </p>

        <div className="intro-actions">
          <button className="btn btn-primary" onClick={onStart}>
            태어나기
          </button>
          <label className="toggle">
            <input type="checkbox" checked={auto} onChange={(e) => onAutoChange(e.target.checked)} /> <span>선택도 운에 맡기기</span>
          </label>
        </div>

        {pastLives.length > 0 && (
          <section className="past">
            <h2>지난 생</h2>
            <ol>
              {pastLives.slice(0, 8).map((l) => (
                <li key={l.at}>
                  <strong>{l.name}</strong> · {l.region} · {l.age}세, {l.cause}
                </li>
              ))}
            </ol>
            <button className="btn-link" onClick={onClearPast}>
              기록 지우기
            </button>
          </section>
        )}

        <details className="about">
          <summary>이 게임의 숫자에 대해</summary>
          <p>
            통계청 인구동향조사(출생), 생명표, 사망원인통계, 가계동향조사, 가계금융복지조사, 경제활동인구조사, 일자리행정통계, 교육기본통계, 초중고
            사교육비조사, 주택소유통계 등 공개 통계를 바탕으로 만든 근사 모형입니다.
          </p>
          <p>금액은 모두 2024년 현재 가치로 계산합니다. 실제 개인의 삶을 예측하지 않으며, 같은 조건이라도 매번 다른 삶이 펼쳐집니다.</p>
          <p>
            이 게임은 자살을 사망 원인에서 제외합니다. 힘든 마음이 들면 자살예방상담전화 <strong>109</strong>에서 언제든 이야기를 나눌 수 있습니다.
          </p>
        </details>
      </div>
    </main>
  );
}
