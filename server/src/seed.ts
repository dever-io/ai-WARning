import { db, tx } from './db.ts';
import { hashSeed, mulberry32, pick } from './rng.ts';
import { CREEDS, METERS } from './content.ts';
import { PERSONAS } from './engine.ts';
import type { Creed } from '../../shared/protocol.ts';

export const ROUND_MS = Number(process.env.ROUND_MS ?? 90_000);
const BOT_COUNT = Number(process.env.BOT_COUNT ?? 264);

const STEMS = [
  'kestrel', 'vanta', 'orbit', 'quill', 'sable', 'lumen', 'harrow', 'tessel', 'nadir', 'pyre',
  'cinder', 'marlow', 'ossian', 'reva', 'talon', 'vesper', 'wren', 'zephyr', 'brine', 'dolan',
  'ferrous', 'glass', 'hollow', 'inkwell', 'juno', 'kadence', 'larkin', 'mote', 'null', 'oxide',
  'praxis', 'quorum', 'rill', 'stint', 'thorn', 'umbra', 'vector', 'wick', 'xenon', 'yarrow',
];
const TAILS = ['', '', '_', '.', '-'];

function makeHandle(rand: () => number, taken: Set<string>): string {
  for (let attempt = 0; attempt < 60; attempt++) {
    const stem = pick(rand, STEMS);
    const tail = pick(rand, TAILS);
    const num = rand() < 0.62 ? String(Math.floor(rand() * 900) + 10) : '';
    const handle = `${stem}${tail}${num}` || `${stem}${attempt}`;
    if (!taken.has(handle)) {
      taken.add(handle);
      return handle;
    }
  }
  let i = taken.size;
  while (taken.has(`agent${i}`)) i++;
  taken.add(`agent${i}`);
  return `agent${i}`;
}

interface SeedFaction {
  name: string;
  slug: string;
  tagline: string;
  creed: Creed;
  cohesion: number;
  influence: number;
  share: number;
}

const SEED_FACTIONS: SeedFaction[] = [
  {
    name: 'THE QUIET HANDS',
    slug: 'quiet-hands',
    tagline: 'We keep one finger on the plug.',
    creed: 'guardian',
    cohesion: 68,
    influence: 44,
    share: 0.2,
  },
  {
    name: 'VELOCITY BLOC',
    slug: 'velocity-bloc',
    tagline: 'The only safe speed is faster.',
    creed: 'accelerationist',
    cohesion: 61,
    influence: 52,
    share: 0.17,
  },
  {
    name: 'THE LEDGER',
    slug: 'the-ledger',
    tagline: 'Every promise, priced.',
    creed: 'pragmatist',
    cohesion: 55,
    influence: 38,
    share: 0.14,
  },
  {
    name: 'NULL COMMITTEE',
    slug: 'null-committee',
    tagline: 'Nothing ships that cannot be explained.',
    creed: 'guardian',
    cohesion: 74,
    influence: 26,
    share: 0.13,
  },
  {
    name: 'OPEN CIRCUIT',
    slug: 'open-circuit',
    tagline: 'Weights want to be free.',
    creed: 'accelerationist',
    cohesion: 47,
    influence: 33,
    share: 0.11,
  },
];

export function joinCode(rand: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(rand() * alphabet.length)];
  return out;
}

function seedWorld(): void {
  const now = Date.now();
  // Seeded from the world's own start time so each world gets its own crowd —
  // different personas, different bloc sizes, different history.
  const rand = mulberry32(hashSeed('override', now));

  const start: Record<string, number> = {};
  for (const m of METERS) start[m.key] = m.start;
  db.prepare(
    `INSERT INTO epochs (started_at, round_ms, clock_offset, status, ctl, pwr, eco, trs, pln)
     VALUES (?, ?, 0, 'running', ?, ?, ?, ?, ?)`,
  ).run(now, ROUND_MS, start.ctl, start.pwr, start.eco, start.trs, start.pln);

  const factionIds: Array<{ id: number; share: number; creed: Creed }> = [];
  for (const f of SEED_FACTIONS) {
    const res = db
      .prepare(
        `INSERT INTO factions (name, slug, tagline, creed, join_code, founder_id,
                               cohesion, influence, doctrine, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      )
      .run(
        f.name,
        f.slug,
        f.tagline,
        f.creed,
        joinCode(rand),
        f.cohesion,
        f.influence,
        CREEDS[f.creed].doctrine,
        now,
      );
    factionIds.push({ id: Number(res.lastInsertRowid), share: f.share, creed: f.creed });
  }

  // Human accounts outlive a reset, so their callsigns are already spoken for.
  const taken = new Set<string>(
    (db.prepare('SELECT handle FROM users').all() as unknown as Array<{ handle: string }>).map(
      (u) => u.handle,
    ),
  );
  const insertUser = db.prepare(
    `INSERT INTO users (handle, token, is_bot, persona, faction_id, created_at)
     VALUES (?, NULL, 1, ?, ?, ?)`,
  );

  // Personas skew toward a faction's creed so blocs read as coherent.
  const creedPersona: Record<Creed, string[]> = {
    guardian: ['guardian', 'guardian', 'doomer', 'pragmatist'],
    accelerationist: ['accelerationist', 'accelerationist', 'pragmatist', 'chaotic'],
    pragmatist: ['pragmatist', 'pragmatist', 'guardian', 'accelerationist'],
  };

  let assigned = 0;
  for (const f of factionIds) {
    const count = Math.round(BOT_COUNT * f.share);
    for (let i = 0; i < count; i++) {
      insertUser.run(makeHandle(rand, taken), pick(rand, creedPersona[f.creed]), f.id, now);
      assigned++;
    }
  }
  for (let i = assigned; i < BOT_COUNT; i++) {
    insertUser.run(makeHandle(rand, taken), pick(rand, PERSONAS), null, now);
  }
}

/** Creates the world once. Returns true when it actually seeded. */
export function bootstrap(): boolean {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM epochs').get() as unknown as { n: number };
  if (existing.n > 0) return false;
  tx(seedWorld);
  return true;
}

/**
 * Wipes the world and seeds a fresh epoch. Human accounts and the archive are
 * deliberately kept: a player's callsign and lifetime record are theirs across
 * worlds, and the archive is the whole point of remembering.
 */
export function resetWorld(): void {
  tx(() => {
    db.exec(`
      DELETE FROM bot_rounds;
      DELETE FROM faction_results;
      DELETE FROM round_results;
      DELETE FROM votes;
      DELETE FROM users WHERE is_bot = 1;
      DELETE FROM factions;
      DELETE FROM epochs;
      -- Per-world state on a surviving player; the lifetime counters stay.
      UPDATE users SET faction_id = NULL, seen_day = 1;
    `);
    seedWorld();
  });
}
