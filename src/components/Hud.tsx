import { choicesPerDay } from '../game/data';

export function Hud({ made, over }: { made: number; over: boolean }) {
  const day = over
    ? Math.max(1, Math.ceil(made / choicesPerDay))
    : Math.floor(made / choicesPerDay) + 1;
  const choiceInDay = (made % choicesPerDay) + 1;
  return (
    <header className="hud">
      <span className="hud-counter">
        {over ? `DAY ${day} · SIGNAL LOST` : `DAY ${day} · CHOICE ${choiceInDay}/${choicesPerDay}`}
      </span>
      <span className="hud-brand">OVERRIDE</span>
    </header>
  );
}
