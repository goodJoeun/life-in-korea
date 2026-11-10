import type { ChoiceView } from '@/lib/engine';

interface Props {
  choice: ChoiceView;
  auto: boolean;
  onPick: (i: number) => void;
  onAutoChange: (v: boolean) => void;
  /** 그해 문장이 다 나타난 뒤에 보이도록 기다리는 시간 */
  delayMs?: number;
}

export default function ChoicePanel({ choice, auto, onPick, onAutoChange, delayMs = 0 }: Props) {
  return (
    <div className="choice" role="dialog" aria-label={choice.prompt} style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}>
      <p className="choice-prompt">{choice.prompt}</p>
      <div className="choice-options">
        {choice.options.map((o, i) => (
          <button key={i} className="opt" onClick={() => onPick(i)}>
            <kbd>{i + 1}</kbd>
            <b>{o.label}</b>
            {o.desc && <small>{o.desc}</small>}
          </button>
        ))}
      </div>
      <label className="toggle small">
        <input type="checkbox" checked={auto} onChange={(e) => onAutoChange(e.target.checked)} /> <span>이후 선택은 운에 맡기기</span>
      </label>
    </div>
  );
}
