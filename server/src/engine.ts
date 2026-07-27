import { db, tx } from './db.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import {
  ENDINGS,
  FACTION_DECK,
  METERS,
  WORLD_DECK,
  type FactionCard,
  type WorldCard,
} from './content.ts';
import { CHOICES_PER_DAY, ROUNDS_TOTAL, type Dir, type MeterKey } from '../../shared/protocol.ts';

export interface EpochRow {
  id: number;
  started_at: number;
  round_ms: number;
  clock_offset: number;
  status: 'running' | 'ended';
  ctl: number;
  pwr: number;
  eco: number;
  trs: number;
  pln: number;
  ending_key: string | null;
  ended_at: number | null;
}

export interface UserRow {
  id: number;
  handle: string;
  token: string | null;
  is_bot: number;
  persona: string | null;
  faction_id: number | null;
  seen_day: number;
}

export interface FactionRow {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  creed: string;
  join_code: string;
  founder_id: number | null;
  cohesion: number;
  influence: number;
  doctrine: number;
}

export type Meters = Record<MeterKey, number>;

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export const worldCardAt = (round: number): WorldCard => WORLD_DECK[round % WORLD_DECK.length];
export const factionCardAt = (round: number): FactionCard =>
  FACTION_DECK[round % FACTION_DECK.length];

export const dayOf = (round: number) => Math.floor(round / CHOICES_PER_DAY) + 1;
export const slotOf = (round: number) => (round % CHOICES_PER_DAY) + 1;

/* ------------------------------------------------------------------ clock */

export function getEpoch(): EpochRow {
  return db.prepare('SELECT * FROM epochs ORDER BY id DESC LIMIT 1').get() as unknown as EpochRow;
}

/** Wall clock plus whatever the dev skip button has fast-forwarded. */
export function epochNow(epoch: EpochRow): number {
  return Date.now() + epoch.clock_offset;
}

/** Which round the clock is currently inside — may exceed the last round. */
export function rawRoundIndex(epoch: EpochRow, now: number): number {
  return Math.floor((now - epoch.started_at) / epoch.round_ms);
}

export function openRound(epoch: EpochRow, now: number): number {
  return Math.max(0, Math.min(ROUNDS_TOTAL - 1, rawRoundIndex(epoch, now)));
}

export function roundWindow(epoch: EpochRow, round: number) {
  const startedAt = epoch.started_at + round * epoch.round_ms;
  return { startedAt, endsAt: startedAt + epoch.round_ms };
}

/* ------------------------------------------------------------- bot voting */

type Weights = Partial<Record<MeterKey, number>>;

const PERSONA_WEIGHTS: Record<string, Weights> = {
  guardian: { ctl: 3, pwr: -3.2, eco: 0.5, trs: 1.2, pln: 1 },
  accelerationist: { ctl: -0.4, pwr: 2.6, eco: 2.2, trs: 0.2, pln: -0.2 },
  pragmatist: { ctl: 1, pwr: -0.6, eco: 2.2, trs: 2, pln: 1 },
  doomer: { ctl: 2.2, pwr: -4.2, eco: 0.3, trs: 0.6, pln: 0.8 },
  chaotic: { ctl: 0.4, pwr: 0.4, eco: 0.6, trs: 0.4, pln: 0.4 },
};

export const PERSONAS = Object.keys(PERSONA_WEIGHTS);

/** Doctrine slides a bloc's members from leash-first (0) to build-first (100). */
function doctrineWeights(doctrine: number): Weights {
  const t = doctrine / 100;
  return {
    ctl: 2.4 * (1 - t) - 0.4 * t,
    pwr: -3.4 * (1 - t) + 2.6 * t,
    eco: 0.6 + 1.8 * t,
    trs: 1.2 * (1 - t),
    pln: 0.8 * (1 - t),
  };
}

function blend(a: Weights, b: Weights, bShare: number): Weights {
  const out: Weights = {};
  for (const m of METERS) {
    out[m.key] = (a[m.key] ?? 0) * (1 - bShare) + (b[m.key] ?? 0) * bShare;
  }
  return out;
}

function scoreFx(fx: Partial<Record<MeterKey, number>>, w: Weights): number {
  let total = 0;
  for (const m of METERS) total += (w[m.key] ?? 0) * (fx[m.key] ?? 0);
  return total;
}

/**
 * Fills in the crowd's ballots for a round. Idempotent: the round is stamped in
 * bot_rounds so a replay (or a clock skip) never double-votes.
 */
export function ensureBotVotes(epoch: EpochRow, round: number): void {
  const done = db
    .prepare('SELECT 1 FROM bot_rounds WHERE epoch_id = ? AND round = ?')
    .get(epoch.id, round);
  if (done) return;

  const bots = db
    .prepare('SELECT id, persona, faction_id FROM users WHERE is_bot = 1')
    .all() as unknown as Array<{ id: number; persona: string; faction_id: number | null }>;
  const factions = new Map<number, FactionRow>();
  for (const f of db.prepare('SELECT * FROM factions').all() as unknown as FactionRow[]) {
    factions.set(f.id, f);
  }

  const card = worldCardAt(round);
  const fCard = factionCardAt(round);
  const stamp = Date.now();
  const ballots: Array<{ scope: 'world' | 'faction'; factionId: number | null; botId: number; dir: Dir }> =
    [];

  for (const bot of bots) {
    const rand = mulberry32(hashSeed(epoch.id, round, bot.id));
    const faction = bot.faction_id ? factions.get(bot.faction_id) : undefined;
    let w = PERSONA_WEIGHTS[bot.persona] ?? PERSONA_WEIGHTS.pragmatist;
    if (faction) w = blend(w, doctrineWeights(faction.doctrine), 0.45);

    if (rand() < 0.78) {
      const lean = scoreFx(card.yes.fx, w) - scoreFx(card.no.fx, w) + (rand() - 0.5) * 26;
      ballots.push({ scope: 'world', factionId: null, botId: bot.id, dir: lean > 0 ? 'yes' : 'no' });
    }

    if (faction && rand() < 0.84) {
      // Loyalists protect cohesion; operators chase influence.
      const loyal = bot.persona === 'guardian' || bot.persona === 'doomer' ? 1.6 : 0.7;
      const reach = bot.persona === 'accelerationist' || bot.persona === 'pragmatist' ? 1.6 : 0.7;
      const docPull = (faction.doctrine - 50) / 50;
      const value = (fx: { coh?: number; inf?: number; doc?: number }) =>
        loyal * (fx.coh ?? 0) + reach * (fx.inf ?? 0) + docPull * (fx.doc ?? 0) * 0.6;
      const lean = value(fCard.yes.fx) - value(fCard.no.fx) + (rand() - 0.5) * 18;
      ballots.push({
        scope: 'faction',
        factionId: faction.id,
        botId: bot.id,
        dir: lean > 0 ? 'yes' : 'no',
      });
    }
  }

  // Insert order drives the live reveal, and users are stored grouped by faction —
  // shuffle so the count streams in as a mixed crowd, not one bloc at a time.
  const shuffle = mulberry32(hashSeed('order', epoch.id, round));
  for (let i = ballots.length - 1; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1));
    [ballots[i], ballots[j]] = [ballots[j], ballots[i]];
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO votes (epoch_id, round, scope, faction_id, user_id, dir, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const b of ballots) {
    insert.run(epoch.id, round, b.scope, b.factionId, b.botId, b.dir, stamp);
  }

  db.prepare('INSERT OR IGNORE INTO bot_rounds (epoch_id, round) VALUES (?, ?)').run(
    epoch.id,
    round,
  );
}

/**
 * Fills in faction ballots for one bloc in a round whose crowd votes were already
 * generated — a bloc founded (or joined) mid-round would otherwise sit silent
 * until the next one.
 */
export function seedFactionBallots(epoch: EpochRow, round: number, factionId: number): void {
  const faction = db.prepare('SELECT * FROM factions WHERE id = ?').get(factionId) as unknown as
    | FactionRow
    | undefined;
  if (!faction) return;
  const bots = db
    .prepare('SELECT id, persona FROM users WHERE is_bot = 1 AND faction_id = ?')
    .all(factionId) as unknown as Array<{ id: number; persona: string }>;
  if (!bots.length) return;

  const card = factionCardAt(round);
  const docPull = (faction.doctrine - 50) / 50;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO votes (epoch_id, round, scope, faction_id, user_id, dir, created_at)
     VALUES (?, ?, 'faction', ?, ?, ?, ?)`,
  );
  const stamp = Date.now();

  for (const bot of bots) {
    const rand = mulberry32(hashSeed(epoch.id, round, bot.id, 'topup'));
    if (rand() >= 0.84) continue;
    const loyal = bot.persona === 'guardian' || bot.persona === 'doomer' ? 1.6 : 0.7;
    const reach = bot.persona === 'accelerationist' || bot.persona === 'pragmatist' ? 1.6 : 0.7;
    const value = (fx: { coh?: number; inf?: number; doc?: number }) =>
      loyal * (fx.coh ?? 0) + reach * (fx.inf ?? 0) + docPull * (fx.doc ?? 0) * 0.6;
    const lean = value(card.yes.fx) - value(card.no.fx) + (rand() - 0.5) * 18;
    insert.run(epoch.id, round, factionId, bot.id, lean > 0 ? 'yes' : 'no', stamp);
  }
}

/* --------------------------------------------------------------- tallying */

export interface Bloc {
  factionId: number;
  name: string;
  stance: Dir;
  weight: number;
}

interface RawTally {
  yes: number;
  no: number;
  blocs: Bloc[];
}

/**
 * Individual ballots plus the extra weight unified factions swing behind them.
 * `botLimit` throttles how much of the crowd is visible so the count streams in
 * across the round; human ballots are always included so a player never loses
 * sight of their own vote.
 */
export function tallyWorld(epoch: EpochRow, round: number, botLimit?: number): RawTally {
  const rows = db
    .prepare(
      `SELECT v.dir AS dir, u.faction_id AS faction_id, u.is_bot AS is_bot
         FROM votes v JOIN users u ON u.id = v.user_id
        WHERE v.epoch_id = ? AND v.round = ? AND v.scope = 'world'
        ORDER BY v.id`,
    )
    .all(epoch.id, round) as unknown as Array<{
    dir: Dir;
    faction_id: number | null;
    is_bot: number;
  }>;

  let yes = 0;
  let no = 0;
  let botsSeen = 0;
  const cap = botLimit ?? Number.MAX_SAFE_INTEGER;
  const perFaction = new Map<number, { yes: number; no: number }>();
  for (const row of rows) {
    if (row.is_bot) {
      if (botsSeen >= cap) continue;
      botsSeen++;
    }
    if (row.dir === 'yes') yes++;
    else no++;
    if (row.faction_id) {
      const acc = perFaction.get(row.faction_id) ?? { yes: 0, no: 0 };
      acc[row.dir]++;
      perFaction.set(row.faction_id, acc);
    }
  }

  const blocs: Bloc[] = [];
  for (const [factionId, acc] of perFaction) {
    const total = acc.yes + acc.no;
    if (total < 2) continue;
    const faction = db
      .prepare('SELECT name, influence FROM factions WHERE id = ?')
      .get(factionId) as unknown as { name: string; influence: number } | undefined;
    if (!faction) continue;
    const unity = Math.abs(acc.yes - acc.no) / total;
    const weight = Math.round(total * (faction.influence / 100) * unity);
    if (weight <= 0) continue;
    const stance: Dir = acc.yes >= acc.no ? 'yes' : 'no';
    if (stance === 'yes') yes += weight;
    else no += weight;
    blocs.push({ factionId, name: faction.name, stance, weight });
  }
  blocs.sort((a, b) => b.weight - a.weight);
  return { yes, no, blocs };
}

export function countWorldBallots(epoch: EpochRow, round: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM votes WHERE epoch_id = ? AND round = ? AND scope = 'world'`,
    )
    .get(epoch.id, round) as unknown as { n: number };
  return row.n;
}

export function tallyFaction(
  epoch: EpochRow,
  round: number,
  factionId: number,
  botLimit?: number,
) {
  const rows = db
    .prepare(
      `SELECT v.dir AS dir, u.is_bot AS is_bot
         FROM votes v JOIN users u ON u.id = v.user_id
        WHERE v.epoch_id = ? AND v.round = ? AND v.scope = 'faction' AND v.faction_id = ?
        ORDER BY v.id`,
    )
    .all(epoch.id, round, factionId) as unknown as Array<{ dir: Dir; is_bot: number }>;
  const cap = botLimit ?? Number.MAX_SAFE_INTEGER;
  let yes = 0;
  let no = 0;
  let botsSeen = 0;
  for (const row of rows) {
    if (row.is_bot) {
      if (botsSeen >= cap) continue;
      botsSeen++;
    }
    if (row.dir === 'yes') yes++;
    else no++;
  }
  return { yes, no };
}

/* ------------------------------------------------------------- resolution */

function readMeters(epoch: EpochRow): Meters {
  return { ctl: epoch.ctl, pwr: epoch.pwr, eco: epoch.eco, trs: epoch.trs, pln: epoch.pln };
}

/**
 * Gains get harder the closer a faction is to the cap, so no bloc runs away with
 * the epoch; losses land at full weight.
 */
function softGain(current: number, delta: number): number {
  if (delta <= 0) return current + delta;
  return current + delta * (1.6 * (1 - current / 100));
}

/** Scales a card's printed effects by how decisive the world's mandate was. */
function scaleFx(fx: Partial<Record<MeterKey, number>>, mandate: number) {
  const scale = 0.55 + 1.1 * mandate;
  const out: Partial<Record<MeterKey, number>> = {};
  for (const [key, raw] of Object.entries(fx) as Array<[MeterKey, number]>) {
    if (!raw) continue;
    const scaled = raw * scale;
    // Never let scaling erase an effect the card promised.
    out[key] = scaled > 0 ? Math.max(1, Math.round(scaled)) : Math.min(-1, Math.round(scaled));
  }
  return out;
}

function recruitBots(factionId: number, count: number, seed: number): void {
  const pool = db
    .prepare('SELECT id FROM users WHERE is_bot = 1 AND faction_id IS NULL ORDER BY id')
    .all() as unknown as Array<{ id: number }>;
  if (!pool.length) return;
  const rand = mulberry32(seed);
  const take = Math.min(count, pool.length);
  const chosen = new Set<number>();
  let guard = 0;
  while (chosen.size < take && guard++ < take * 12) {
    chosen.add(pool[Math.floor(rand() * pool.length)].id);
  }
  const stmt = db.prepare('UPDATE users SET faction_id = ? WHERE id = ?');
  for (const id of chosen) stmt.run(factionId, id);
}

function resolveFactions(epoch: EpochRow, round: number, blocs: Bloc[], worldResult: Dir): void {
  const card = factionCardAt(round);
  const factions = db.prepare('SELECT * FROM factions').all() as unknown as FactionRow[];
  const blocByFaction = new Map(blocs.map((b) => [b.factionId, b]));

  for (const faction of factions) {
    const { yes, no } = tallyFaction(epoch, round, faction.id);
    const total = yes + no;
    let cohesion = faction.cohesion;
    let influence = faction.influence;
    let doctrine = faction.doctrine;
    let result: Dir = 'no';
    let note: string;
    const fx: Record<string, number> = {};

    if (total === 0) {
      cohesion -= 4;
      influence -= 2;
      note = 'The bloc never convened. Silence is its own position.';
      fx.coh = -4;
      fx.inf = -2;
    } else {
      result = yes > no ? 'yes' : 'no';
      const unity = Math.abs(yes - no) / total;
      const outcome = card[result];
      const cohDelta = (outcome.fx.coh ?? 0) + Math.round((unity - 0.45) * 14);
      const bloc = blocByFaction.get(faction.id);
      const backedWinner = bloc ? bloc.stance === worldResult : false;
      const infDelta = (outcome.fx.inf ?? 0) + (bloc ? (backedWinner ? 3 : -1) : 0);
      const docDelta = outcome.fx.doc ?? 0;
      cohesion = softGain(cohesion, cohDelta);
      influence = softGain(influence, infDelta);
      doctrine += docDelta;
      fx.coh = clamp(cohesion) - faction.cohesion;
      fx.inf = clamp(influence) - faction.influence;
      if (docDelta) fx.doc = docDelta;
      note = outcome.note;
    }

    cohesion = clamp(cohesion);
    influence = clamp(influence);
    doctrine = clamp(doctrine);

    // A disciplined bloc draws in the unaffiliated.
    if (cohesion >= 55 && total > 0) {
      recruitBots(faction.id, 1 + Math.floor(cohesion / 45), hashSeed(epoch.id, round, faction.id));
    }

    db.prepare('UPDATE factions SET cohesion = ?, influence = ?, doctrine = ? WHERE id = ?').run(
      cohesion,
      influence,
      doctrine,
      faction.id,
    );
    db.prepare(
      `INSERT OR REPLACE INTO faction_results
         (epoch_id, round, faction_id, result, yes, no, fx, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(epoch.id, round, faction.id, result, yes, no, JSON.stringify(fx), note);
  }
}

function endEpoch(epoch: EpochRow, meters: Meters, endingKey: string): void {
  // Real wall time, not the (skippable) epoch clock: this timestamp drives the
  // auto-restart, which must not be thrown off by a dev skip.
  db.prepare(`UPDATE epochs SET status = 'ended', ending_key = ?, ended_at = ? WHERE id = ?`).run(
    endingKey,
    Date.now(),
    epoch.id,
  );
  void meters;
}

function resolveRound(epoch: EpochRow, round: number): void {
  ensureBotVotes(epoch, round);

  const card = worldCardAt(round);
  const { yes, no, blocs } = tallyWorld(epoch, round);
  const total = yes + no;
  const result: Dir = yes > no ? 'yes' : 'no';
  const mandate = total > 0 ? Math.abs(yes - no) / total : 0;
  const fx = total > 0 ? scaleFx(card[result].fx, mandate) : {};

  const meters = readMeters(epoch);
  for (const [key, delta] of Object.entries(fx) as Array<[MeterKey, number]>) {
    meters[key] = clamp(meters[key] + delta);
  }

  db.prepare(
    `UPDATE epochs SET ctl = ?, pwr = ?, eco = ?, trs = ?, pln = ? WHERE id = ?`,
  ).run(meters.ctl, meters.pwr, meters.eco, meters.trs, meters.pln, epoch.id);

  db.prepare(
    `INSERT OR REPLACE INTO round_results
       (epoch_id, round, result, yes, no, mandate, fx, meters, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    epoch.id,
    round,
    result,
    yes,
    no,
    mandate,
    JSON.stringify(fx),
    JSON.stringify(meters),
    Date.now(),
  );

  resolveFactions(epoch, round, blocs, result);

  const fatal = ENDINGS.find((e) => e.fatal && e.test(meters));
  if (fatal) {
    endEpoch(epoch, meters, fatal.key);
    return;
  }
  if (round >= ROUNDS_TOTAL - 1) {
    const ending = ENDINGS.find((e) => e.test(meters)) ?? ENDINGS[ENDINGS.length - 1];
    endEpoch(epoch, meters, ending.key);
  }
}

/**
 * Brings the epoch up to date with its clock. Safe to call on every read —
 * rounds already in round_results are skipped.
 */
export function resolveDue(): EpochRow {
  let epoch = getEpoch();
  if (epoch.status === 'ended') return epoch;

  const now = epochNow(epoch);
  const raw = rawRoundIndex(epoch, now);
  const lastClosed = Math.min(raw - 1, ROUNDS_TOTAL - 1);
  if (lastClosed < 0) {
    ensureBotVotes(epoch, 0);
    return epoch;
  }

  const resolved = new Set(
    (
      db
        .prepare('SELECT round FROM round_results WHERE epoch_id = ?')
        .all(epoch.id) as unknown as Array<{ round: number }>
    ).map((r) => r.round),
  );

  tx(() => {
    for (let r = 0; r <= lastClosed; r++) {
      if (resolved.has(r)) continue;
      const fresh = getEpoch();
      if (fresh.status === 'ended') break;
      resolveRound(fresh, r);
    }
  });

  epoch = getEpoch();
  if (epoch.status === 'running') ensureBotVotes(epoch, openRound(epoch, epochNow(epoch)));
  return epoch;
}

/* ------------------------------------------------------------ dev control */

/** Fast-forwards the epoch clock to just past the current round boundary. */
export function skipRound(rounds = 1): void {
  const epoch = getEpoch();
  const now = epochNow(epoch);
  const raw = rawRoundIndex(epoch, now);
  const target = epoch.started_at + (raw + rounds) * epoch.round_ms + 200;
  const delta = target - now;
  if (delta <= 0) return;
  db.prepare('UPDATE epochs SET clock_offset = clock_offset + ? WHERE id = ?').run(delta, epoch.id);
  resolveDue();
}

export { clamp, readMeters };
