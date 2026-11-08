import type { ChoiceView } from '@/lib/engine';

interface Props {
  choice: ChoiceView;
  auto: boolean;
  onPick: (i: number) => void;
  onAutoChange: (v: boolean) => void;
}

export default function ChoicePanel({ choice, auto, onPick, onAutoChange }: Props) {
  return (
    <div className="choice" role="dialog" aria-label={choice.prompt}>
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
