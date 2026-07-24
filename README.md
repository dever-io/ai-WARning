# ai-WARning

**OVERRIDE** — a Reigns/Tinder-style AI-catastrophe decision game. Everyone on Earth makes **3 choices per day**; each choice steers humanity toward or away from an AI catastrophe. Swipe **right to authorize**, **left to refuse**. Every choice shifts five meters and prints a one-line consequence.

Built with **React 19 + Vite + TypeScript** from the OVERRIDE design handoff, shipping the recommended **Variant A · Operations Console** visual direction.

## Play

```bash
npm install
npm run dev
```

Open http://localhost:5173.

**Controls:** drag the card left/right, click **◀ ABORT / CONFIRM ▶**, or use the **← →** arrow keys. Dragging past ±18px or hovering a button live-previews the fallout on the meters (delta chips + pulsing ghost fill) before you commit.

## Rules

| Meter | Start | Goal |
|-------|-------|------|
| Control | 52 | keep high |
| **AI Power** | 44 | **keep LOW** — 100 is game over |
| Economy | 55 | keep high |
| Trust | 50 | keep high |
| Planet | 48 | keep high |

The run ends when **AI Power hits 100** or any other meter collapses to **0**. Progress persists in `localStorage`; the end screen offers a reboot.

## Project structure

```
src/
  game/
    cards.json   # game content — the design handoff's source of truth
    types.ts     # domain types
    data.ts      # typed access to cards.json
    theme.ts     # Variant A palette tokens
    logic.ts     # clamp / apply effects / fail states / meter view models
    useGame.ts   # game state hook + localStorage persistence
  components/
    Hud.tsx              # DAY n · CHOICE k/3 + wordmark
    MeterPanel.tsx       # 5 segmented LED bars with live preview ghosts
    CardStack.tsx        # draggable top card + next-card peek, fly-out, stamps
    ActionButtons.tsx    # ABORT / CONFIRM with hover preview
    ConsequenceStrip.tsx # BRIEFING / OUTCOME line
    EndScreen.tsx        # fail-state panel + restart
  App.tsx
  main.tsx
  styles/global.css      # exact design tokens from the handoff
```

## Design notes

- Interaction constants come straight from the handoff: swipe threshold **110px**, rotation `dx * 0.05deg`, vertical follow `dy * 0.14`, fly-out `.4s ease-in` (state advances at 390ms), snap-back `.3s cubic-bezier(.2,.8,.2,1)`, meter fill `.55s`.
- The A/B/C variant switcher from the prototype was dropped per the handoff's production notes; fail states and persistence were added per the same notes.
- The deck loops infinitely (`idx % deck.length`); the day counter advances every 3 choices.
