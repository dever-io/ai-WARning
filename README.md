# ai-WARning

**OVERRIDE** — a multiplayer AI-catastrophe decision game. The whole world votes on the same dilemma at the same time: **three choices a day, three days, nine decisions**, and then it is over. Your ballot is one of hundreds — so found a bloc, hold it together, and swing the count.

React 19 + Vite on the front, a Hono + SQLite server on the back. Built from the OVERRIDE design handoff, shipping the **Variant A · Operations Console** visual direction.

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:5173** — the web app (5173) and the API (8787) start together. First boot seeds a world: one epoch, five blocs, and ~265 simulated citizens who vote alongside you.

Pick a callsign, and you're in. No password, no email — the callsign only separates you from the crowd.

## How a round works

1. **The world card.** Everyone votes yes/no. The majority wins; the losing side gets nothing.
2. **Your bloc's card.** If you're in a faction, you also vote on an internal directive — who to admit, what to leak, whether to bind members by oath.
3. **The count closes** on a timer. Effects are applied, the meters move, and the next choice opens.

Each round's effects scale with the **mandate** — how lopsided the vote was. A 3% margin barely moves the needle; a landslide lands at full force.

**Controls:** drag the card, click the buttons, or use **← →**. Dragging past ±18px or hovering a button previews the fallout live on the meters before you commit.

## Meters and endings

| Meter | Start | Goal |
|-------|-------|------|
| Control | 52 | keep high |
| **AI Power** | 44 | **keep LOW** |
| Economy | 55 | keep high |
| Trust | 50 | keep high |
| Planet | 48 | keep high |

The epoch ends after nine rounds, or early if AI Power reaches 90 or any other meter collapses to 5. There are eight endings — from *The Leash Holds* to *Override Complete* — plus a personal epilogue based on how often you sided with the world, and one for your bloc.

## Factions

A faction is how one ballot becomes leverage. Each bloc carries three stats:

- **Cohesion** — how unified its members are. Rises on lopsided internal votes, falls when the bloc splits.
- **Influence** — how much extra weight it swings. Gains soften as it approaches 100, so no bloc runs away with the epoch.
- **Doctrine** — where it sits between guardian (0) and accelerationist (100). It biases how the bloc's members vote.

When a bloc votes together on a world card, it adds `members × influence% × unity` extra votes to its side. A 40-member bloc at 60 influence voting 90/10 adds roughly 21 votes — and world margins are routinely under 20.

Found your own bloc (banner, creed line, doctrine) or join one by ID or invite code. A new banner attracts a handful of the unaffiliated immediately, and disciplined blocs keep recruiting each round.

## Testing tools

The **dev bar** (bottom-right) is the fast path through a run:

- **SKIP CHOICE** — fast-forwards the epoch clock past the current round and resolves it.
- **SKIP DAY** — skips three rounds at once.
- **RESET WORLD** — wipes the epoch, reseeds the crowd, and hands you a fresh session.

Skipping shifts a stored clock offset rather than faking state, so everything downstream — resolution, bot ballots, endings — runs exactly as it would in real time.

Disable the dev bar with `DEV_TOOLS=0`. Reset from the shell with:

```bash
npm run reset
```

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `ROUND_MS` | `90000` | Round length. `ROUND_MS=8000 npm run dev` for a two-minute epoch. |
| `API_PORT` | `8787` | API port. Takes precedence over `PORT`. |
| `BOT_COUNT` | `264` | Size of the simulated crowd. |
| `DEV_TOOLS` | on | Set to `0` to hide the skip/reset controls. |
| `DB_PATH` | `./data/override.db` | SQLite file. |

## API

All routes need `Authorization: Bearer <token>` except `POST /api/session`.

| Route | Purpose |
|-------|---------|
| `POST /api/session` | Claim a callsign, get a token |
| `GET /api/state` | Everything the client renders — epoch, meters, cards, tallies, bloc, history, ending |
| `POST /api/vote` | Cast a ballot (`{scope: "world" \| "faction", dir: "yes" \| "no"}`) |
| `GET /api/factions` | Bloc list with standings |
| `POST /api/factions` | Found a bloc |
| `POST /api/factions/join` `/leave` | Membership |
| `POST /api/dev/skip` `/reset` | Testing tools |

Rounds resolve lazily on read: any request that touches state first settles every round whose window has closed, so the world stays correct whether or not anyone is watching.

## Project structure

```
shared/protocol.ts     # wire types used by both sides

server/src/
  content.ts     # 9 world cards, 9 faction cards, creeds, endings
  db.ts          # node:sqlite schema
  engine.ts      # clock, bot ballots, bloc weighting, resolution, endings
  seed.ts        # world bootstrap + the simulated crowd
  state.ts       # the /api/state payload
  index.ts       # Hono routes

src/
  api/client.ts        # fetch wrapper + token storage
  hooks/               # polled server state, tick clock
  game/bars.ts         # meter/stat render model incl. live preview
  components/          # DecisionCard, BarPanel, TallyBar, Actions, Chrome
  screens/             # SignIn, Ops, Factions, WorldLog, Ending
  styles/global.css    # design tokens from the handoff
```

The server runs TypeScript directly on Node's native type stripping and uses the built-in `node:sqlite` — no build step, no native modules. Requires **Node 22.6+** (24 recommended).

## Design notes

- Interaction constants come from the handoff: swipe threshold 110px, rotation `dx * 0.05deg`, vertical follow `dy * 0.14`, fly-out `.4s ease-in` (state advances at 390ms), snap-back `.3s cubic-bezier(.2,.8,.2,1)`, meter fill `.55s`.
- Negative previews retract the fill to the target so the at-risk slice pulses over the dark track. The handoff's tint-over-the-fill approach was invisible against the bright fill.
- The meter panel is pinned to the top of the board — a live preview you have to scroll to see is not a preview.
- Faction UI runs on a cooler accent (`#8fa2ff`) so internal business never reads as a world decision.
- The A/B/C variant switcher from the prototype was dropped, per the handoff's production notes.

## Not production-ready

This is a local demo. Sessions have no passwords — claiming a known callsign issues a fresh token, which is fine on your own machine and unacceptable anywhere else. Add real authentication before exposing this to a network.
