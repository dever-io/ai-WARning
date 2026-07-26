import { db } from './db.ts';
import {
  CATEGORIES,
  ENDINGS,
  METERS,
  WORLD_LABELS,
  factionEpilogue,
  personalEpilogue,
} from './content.ts';
import {
  countWorldBallots,
  dayOf,
  epochNow,
  factionCardAt,
  openRound,
  roundWindow,
  slotOf,
  tallyFaction,
  tallyWorld,
  worldCardAt,
  type EpochRow,
  type FactionRow,
  type UserRow,
} from './engine.ts';
import {
  ROUNDS_TOTAL,
  DAYS,
  type CardView,
  type Dir,
  type EndingView,
  type FactionMember,
  type FactionSummary,
  type GameState,
  type MeterView,
  type MyFactionView,
  type RoundRecord,
  type StatView,
  type TallyView,
  type Creed,
} from '../../shared/protocol.ts';

export const DEV_TOOLS = process.env.DEV_TOOLS !== '0';

function metersOf(epoch: EpochRow): MeterView[] {
  const raw: Record<string, number> = {
    ctl: epoch.ctl,
    pwr: epoch.pwr,
    eco: epoch.eco,
    trs: epoch.trs,
    pln: epoch.pln,
  };
  return METERS.map((m) => ({ key: m.key, label: m.label, value: raw[m.key], danger: m.danger }));
}

function botBallots(epoch: EpochRow, round: number, scope: string, factionId?: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM votes v JOIN users u ON u.id = v.user_id
        WHERE v.epoch_id = ? AND v.round = ? AND v.scope = ? AND u.is_bot = 1
          AND (? IS NULL OR v.faction_id = ?)`,
    )
    .get(epoch.id, round, scope, factionId ?? null, factionId ?? null) as unknown as { n: number };
  return row.n;
}

/** Ballots trickle in over the round instead of landing all at once. */
function revealFraction(epoch: EpochRow, round: number, now: number): number {
  if (epoch.status === 'ended') return 1;
  const { startedAt } = roundWindow(epoch, round);
  const elapsed = now - startedAt;
  if (elapsed >= epoch.round_ms) return 1;
  return Math.max(0.08, Math.min(1, (elapsed / epoch.round_ms) * 1.25));
}

function worldCardView(round: number): CardView {
  const card = worldCardAt(round);
  const cat = CATEGORIES[card.cat];
  return {
    id: card.id,
    scope: 'world',
    src: card.src,
    title: card.title,
    ctx: card.ctx,
    chipLabel: cat.label,
    chipColor: cat.color,
    yes: { label: card.yesLabel, note: card.yes.note, fx: card.yes.fx as Record<string, number> },
    no: { label: card.noLabel, note: card.no.note, fx: card.no.fx as Record<string, number> },
  };
}

function factionCardView(round: number): CardView {
  const card = factionCardAt(round);
  const cat = CATEGORIES.faction;
  return {
    id: card.id,
    scope: 'faction',
    src: card.src,
    title: card.title,
    ctx: card.ctx,
    chipLabel: cat.label,
    chipColor: cat.color,
    yes: { label: card.yesLabel, note: card.yes.note, fx: card.yes.fx as Record<string, number> },
    no: { label: card.noLabel, note: card.no.note, fx: card.no.fx as Record<string, number> },
  };
}

function myVote(epoch: EpochRow, round: number, userId: number, scope: string): Dir | null {
  const row = db
    .prepare(
      'SELECT dir FROM votes WHERE epoch_id = ? AND round = ? AND scope = ? AND user_id = ?',
    )
    .get(epoch.id, round, scope, userId) as unknown as { dir: Dir } | undefined;
  return row?.dir ?? null;
}

export function memberCount(factionId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM users WHERE faction_id = ?')
    .get(factionId) as unknown as { n: number };
  return row.n;
}

export function factionSummary(f: FactionRow, myFactionId: number | null): FactionSummary {
  const members = memberCount(f.id);
  return {
    id: f.id,
    name: f.name,
    slug: f.slug,
    tagline: f.tagline,
    creed: f.creed as Creed,
    members,
    cohesion: f.cohesion,
    influence: f.influence,
    doctrine: f.doctrine,
    clout: Math.round(members * (f.influence / 100)),
    isMine: f.id === myFactionId,
  };
}

function statViews(f: FactionRow): StatView[] {
  return [
    { key: 'coh', label: 'Cohesion', value: f.cohesion, neutral: false },
    { key: 'inf', label: 'Influence', value: f.influence, neutral: false },
    { key: 'doc', label: 'Doctrine', value: f.doctrine, neutral: true },
  ];
}

function rosterOf(faction: FactionRow, epoch: EpochRow, round: number): FactionMember[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.handle, u.is_bot,
              (SELECT dir FROM votes v
                WHERE v.epoch_id = ? AND v.round = ? AND v.scope = 'faction' AND v.user_id = u.id)
              AS vote
         FROM users u
        WHERE u.faction_id = ?
        ORDER BY u.is_bot, u.id
        LIMIT 40`,
    )
    .all(epoch.id, round, faction.id) as unknown as Array<{
    id: number;
    handle: string;
    is_bot: number;
    vote: Dir | null;
  }>;
  return rows.map((r) => ({
    handle: r.handle,
    isBot: r.is_bot === 1,
    isFounder: r.id === faction.founder_id,
    vote: r.vote ?? null,
  }));
}

function historyFor(epoch: EpochRow, userId: number): RoundRecord[] {
  const rows = db
    .prepare(
      `SELECT r.round, r.result, r.yes, r.no, r.mandate, r.fx, r.meters,
              (SELECT dir FROM votes v
                WHERE v.epoch_id = r.epoch_id AND v.round = r.round
                  AND v.scope = 'world' AND v.user_id = ?) AS my_vote
         FROM round_results r
        WHERE r.epoch_id = ?
        ORDER BY r.round`,
    )
    .all(userId, epoch.id) as unknown as Array<{
    round: number;
    result: Dir;
    yes: number;
    no: number;
    mandate: number;
    fx: string;
    meters: string;
    my_vote: Dir | null;
  }>;

  return rows.map((r) => {
    const card = worldCardAt(r.round);
    const cat = CATEGORIES[card.cat];
    return {
      round: r.round,
      day: dayOf(r.round),
      slot: slotOf(r.round),
      title: card.title,
      src: card.src,
      chipLabel: cat.label,
      chipColor: cat.color,
      result: r.result,
      resultLabel: WORLD_LABELS[r.result],
      note: card[r.result].note,
      yes: r.yes,
      no: r.no,
      mandate: r.mandate,
      fx: JSON.parse(r.fx),
      meters: JSON.parse(r.meters),
      myVote: r.my_vote ?? null,
    };
  });
}

function endingFor(epoch: EpochRow, user: UserRow, history: RoundRecord[]): EndingView | null {
  if (epoch.status !== 'ended' || !epoch.ending_key) return null;
  const def = ENDINGS.find((e) => e.key === epoch.ending_key) ?? ENDINGS[ENDINGS.length - 1];

  let withMajority = 0;
  let against = 0;
  let abstained = 0;
  for (const record of history) {
    if (!record.myVote) abstained++;
    else if (record.myVote === record.result) withMajority++;
    else against++;
  }
  abstained += ROUNDS_TOTAL - history.length;

  const faction = user.faction_id
    ? (db.prepare('SELECT * FROM factions WHERE id = ?').get(user.faction_id) as unknown as
        | FactionRow
        | undefined)
    : undefined;

  const leaderboard = (
    db
      .prepare('SELECT * FROM factions ORDER BY influence DESC, cohesion DESC LIMIT 8')
      .all() as unknown as FactionRow[]
  ).map((f) => ({
    name: f.name,
    influence: f.influence,
    cohesion: f.cohesion,
    members: memberCount(f.id),
  }));

  return {
    key: def.key,
    title: def.title,
    verdict: def.verdict,
    tone: def.tone,
    meters: metersOf(epoch),
    personal: { ...personalEpilogue(withMajority, against, abstained), withMajority, against, abstained },
    faction: faction
      ? { name: faction.name, ...factionEpilogue(faction.cohesion, faction.influence) }
      : null,
    leaderboard,
  };
}

export function buildState(epoch: EpochRow, user: UserRow): GameState {
  const now = epochNow(epoch);
  const round = openRound(epoch, now);
  const ended = epoch.status === 'ended';
  const window = roundWindow(epoch, round);
  const reveal = revealFraction(epoch, round, now);

  const worldBots = botBallots(epoch, round, 'world');
  const worldCap = Math.ceil(worldBots * reveal);
  const rawTally = ended ? { yes: 0, no: 0, blocs: [] } : tallyWorld(epoch, round, worldCap);
  const totalBallots = ended ? 0 : countWorldBallots(epoch, round);
  const humanBallots = totalBallots - worldBots;
  const shownBallots = ended ? 0 : Math.min(worldBots, worldCap) + humanBallots;

  const worldTally: TallyView = {
    yes: rawTally.yes,
    no: rawTally.no,
    blocs: rawTally.blocs.map((b) => ({ name: b.name, stance: b.stance, weight: b.weight })),
    counted: shownBallots,
    pending: Math.max(0, totalBallots - shownBallots),
  };

  const factionRow = user.faction_id
    ? (db.prepare('SELECT * FROM factions WHERE id = ?').get(user.faction_id) as unknown as
        | FactionRow
        | undefined)
    : undefined;

  let faction: MyFactionView | null = null;
  if (factionRow) {
    const factionBots = botBallots(epoch, round, 'faction', factionRow.id);
    const fTally = ended
      ? { yes: 0, no: 0 }
      : tallyFaction(epoch, round, factionRow.id, Math.ceil(factionBots * reveal));
    const last = db
      .prepare(
        `SELECT round, result, yes, no, fx, note FROM faction_results
          WHERE epoch_id = ? AND faction_id = ? ORDER BY round DESC LIMIT 1`,
      )
      .get(epoch.id, factionRow.id) as unknown as
      | { round: number; result: Dir; yes: number; no: number; fx: string; note: string }
      | undefined;

    faction = {
      ...factionSummary(factionRow, user.faction_id),
      joinCode: factionRow.join_code,
      isFounder: factionRow.founder_id === user.id,
      roster: rosterOf(factionRow, epoch, round),
      stats: statViews(factionRow),
      card: ended ? null : factionCardView(round),
      myVote: ended ? null : myVote(epoch, round, user.id, 'faction'),
      tally: ended
        ? null
        : { yes: fTally.yes, no: fTally.no, blocs: [], counted: fTally.yes + fTally.no, pending: 0 },
      lastResult: last
        ? {
            round: last.round,
            result: last.result,
            note: last.note,
            yes: last.yes,
            no: last.no,
            fx: JSON.parse(last.fx),
          }
        : null,
    };
  }

  const population = (
    db.prepare('SELECT COUNT(*) AS n FROM users').get() as unknown as { n: number }
  ).n;

  const worldVote = ended ? null : myVote(epoch, round, user.id, 'world');
  const history = historyFor(epoch, user.id);

  return {
    now,
    user: { id: user.id, handle: user.handle, factionId: user.faction_id },
    epoch: {
      id: epoch.id,
      day: dayOf(round),
      slot: slotOf(round),
      round,
      roundsTotal: ROUNDS_TOTAL,
      daysTotal: DAYS,
      status: epoch.status,
      roundEndsAt: window.endsAt,
      roundStartedAt: window.startedAt,
      roundMs: epoch.round_ms,
      population,
    },
    meters: metersOf(epoch),
    world: { card: ended ? null : worldCardView(round), myVote: worldVote, tally: worldTally },
    faction,
    standby: !ended && worldVote !== null && (!faction || faction.myVote !== null),
    history,
    ending: endingFor(epoch, user, history),
    devTools: DEV_TOOLS,
  };
}

export { metersOf };
