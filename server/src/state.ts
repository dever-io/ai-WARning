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
  CHOICES_PER_DAY,
  type ArchivedWorld,
  type ArchiveView,
  type BriefingView,
  type CardView,
  type Dir,
  type EndingView,
  type FactionMember,
  type FactionSummary,
  type GameState,
  type MeterKey,
  type MeterView,
  type MyFactionView,
  type RoundRecord,
  type StatView,
  type TallyView,
  type Creed,
} from '../../shared/protocol.ts';

export const DEV_TOOLS = process.env.DEV_TOOLS !== '0';

interface ArchiveRow {
  n: number;
  ended_at: number;
  ending_key: string;
  meters: string;
  rounds: string;
  humans: number;
  top_bloc: string | null;
}

const endingDef = (key: string) => ENDINGS.find((e) => e.key === key) ?? ENDINGS[ENDINGS.length - 1];

function archiveRows(): ArchiveRow[] {
  return db.prepare('SELECT * FROM archive ORDER BY n').all() as unknown as ArchiveRow[];
}

export function buildArchive(): ArchiveView {
  const rows = archiveRows();
  const worlds: ArchivedWorld[] = rows.map((r) => {
    const def = endingDef(r.ending_key);
    const m = JSON.parse(r.meters) as Record<MeterKey, number>;
    return {
      n: r.n,
      endingKey: def.key,
      endingTitle: def.title,
      tone: def.tone,
      pwr: m.pwr,
      endedAt: r.ended_at,
      humans: r.humans,
      topBloc: r.top_bloc,
    };
  });

  const counts = new Map<string, number>();
  for (const w of worlds) counts.set(w.endingKey, (counts.get(w.endingKey) ?? 0) + 1);
  const tally = [...counts.entries()]
    .map(([key, count]) => {
      const def = endingDef(key);
      return { key, title: def.title, tone: def.tone, count };
    })
    .sort((a, b) => b.count - a.count);

  const pwrs = worlds.map((w) => w.pwr).sort((a, b) => a - b);
  const medianPwr = pwrs.length ? pwrs[Math.floor(pwrs.length / 2)] : null;

  return { currentWorld: worlds.length + 1, worlds, tally, medianPwr };
}

/** How every archived world settled each dilemma, keyed by round index. */
function precedentByRound(): Map<number, { worlds: number; yes: number; no: number }> {
  const out = new Map<number, { worlds: number; yes: number; no: number }>();
  for (const row of archiveRows()) {
    const rounds = JSON.parse(row.rounds) as Array<{ round: number; result: Dir }>;
    for (const r of rounds) {
      const acc = out.get(r.round) ?? { worlds: 0, yes: 0, no: 0 };
      acc.worlds++;
      acc[r.result]++;
      out.set(r.round, acc);
    }
  }
  return out;
}

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

/** Meter values recorded right after `round` resolved. */
function snapshotAfter(epoch: EpochRow, round: number): Record<MeterKey, number> | null {
  if (round < 0) {
    return Object.fromEntries(METERS.map((m) => [m.key, m.start])) as Record<MeterKey, number>;
  }
  const row = db
    .prepare('SELECT meters FROM round_results WHERE epoch_id = ? AND round = ?')
    .get(epoch.id, round) as unknown as { meters: string } | undefined;
  return row ? (JSON.parse(row.meters) as Record<MeterKey, number>) : null;
}

/**
 * The world as the public last saw it: the snapshot taken at the close of the
 * previous day. Today's resolved rounds have moved the real meters, but that
 * only surfaces in tomorrow's report.
 */
function reportedMeters(epoch: EpochRow, day: number): MeterView[] {
  const snap = snapshotAfter(epoch, (day - 1) * CHOICES_PER_DAY - 1);
  // A missing snapshot would mean hiding nothing; show reality rather than lie.
  if (!snap) return metersOf(epoch);
  return METERS.map((m) => ({
    key: m.key,
    label: m.label,
    value: snap[m.key],
    danger: m.danger,
  }));
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

/**
 * Deliberately ships no `fx` and no outcome text: a world decision is made on
 * what the card says, not on a numeric preview. The impact lands in the morning
 * report, so it must not reach the client early.
 */
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
    yes: { label: card.yesLabel },
    no: { label: card.noLabel },
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

function historyFor(epoch: EpochRow, userId: number, currentDay: number): RoundRecord[] {
  const rows = db
    .prepare(
      // r.meters is deliberately not selected: it is the post-round snapshot,
      // and a sealed round must not ship its numbers to the client at all.
      `SELECT r.round, r.result, r.yes, r.no, r.mandate, r.fx,
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
    my_vote: Dir | null;
  }>;

  const ended = epoch.status === 'ended';
  // Safe here: the log only ever holds rounds that are already decided.
  const precedent = precedentByRound();
  return rows.map((r) => {
    const card = worldCardAt(r.round);
    const cat = CATEGORIES[card.cat];
    const day = dayOf(r.round);
    // Today's numbers stay sealed until the next morning's report.
    const reported = ended || day < currentDay;
    return {
      round: r.round,
      day,
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
      reported,
      fx: reported ? JSON.parse(r.fx) : {},
      myVote: r.my_vote ?? null,
      precedent: precedent.get(r.round) ?? null,
    };
  });
}

function briefingFor(
  epoch: EpochRow,
  user: UserRow,
  currentDay: number,
  history: RoundRecord[],
): BriefingView | null {
  if (epoch.status === 'ended' || currentDay <= 1 || user.seen_day >= currentDay) return null;

  const covered = currentDay - 1;
  const first = (covered - 1) * CHOICES_PER_DAY;
  const last = first + CHOICES_PER_DAY - 1;
  const rounds = history.filter((r) => r.round >= first && r.round <= last);
  if (rounds.length === 0) return null;

  const before = snapshotAfter(epoch, first - 1);
  const after = snapshotAfter(epoch, last);
  if (!before || !after) return null;

  return {
    day: currentDay,
    coveredDay: covered,
    meters: METERS.map((m) => ({
      key: m.key,
      label: m.label,
      danger: m.danger,
      before: before[m.key],
      after: after[m.key],
    })),
    rounds,
  };
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
    pwr: epoch.pwr,
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
  const day = dayOf(round);
  const history = historyFor(epoch, user.id, day);
  const sealed = ended ? 0 : history.filter((r) => !r.reported).length;

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
    meters: ended ? metersOf(epoch) : reportedMeters(epoch, day),
    sealed,
    world: { card: ended ? null : worldCardView(round), myVote: worldVote, tally: worldTally },
    faction,
    standby: !ended && worldVote !== null && (!faction || faction.myVote !== null),
    briefing: briefingFor(epoch, user, day, history),
    history,
    ending: endingFor(epoch, user, history),
    archive: buildArchive(),
    record: { worlds: user.worlds, ballots: user.ballots, withWorld: user.with_world },
    devTools: DEV_TOOLS,
  };
}

export { metersOf };
