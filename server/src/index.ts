import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';

import { db, tx } from './db.ts';
import { CREEDS } from './content.ts';
import {
  dayOf,
  epochNow,
  getEpoch,
  openRound,
  resolveDue,
  seedFactionBallots,
  skipRound,
  type FactionRow,
  type UserRow,
} from './engine.ts';
import { bootstrap, joinCode, resetWorld, ROUND_MS } from './seed.ts';
import { DEV_TOOLS, buildState, factionSummary, memberCount } from './state.ts';
import { CHOICES_PER_DAY, type Creed, type Dir, type Scope } from '../../shared/protocol.ts';
import { mulberry32 } from './rng.ts';

// API_PORT wins so a dev harness that injects PORT (for the web server) cannot
// steal the API's port; PORT stays supported for plain hosting.
const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 8787);
const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{2,15}$/;

if (bootstrap()) {
  console.log(`[override] seeded a fresh world · ${ROUND_MS / 1000}s per round`);
}

type Env = { Variables: { user: UserRow } };
const app = new Hono<Env>();

app.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

function currentUser(c: Context): UserRow | null {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  return (db.prepare('SELECT * FROM users WHERE token = ?').get(token) as unknown as UserRow) ?? null;
}

async function auth(c: Context<Env>, next: Next) {
  const user = currentUser(c);
  if (!user) return c.json({ error: 'Not signed in.' }, 401);
  c.set('user', user);
  await next();
}

/* ------------------------------------------------------------------ session */

app.post('/api/session', async (c) => {
  const body = await c.req.json<{ handle?: string }>().catch(() => ({}) as { handle?: string });
  const handle = (body.handle ?? '').trim().toLowerCase();
  if (!HANDLE_RE.test(handle)) {
    return c.json(
      { error: 'Callsign must be 3–16 characters: letters, digits, dot, dash or underscore.' },
      400,
    );
  }

  const existing = db.prepare('SELECT * FROM users WHERE handle = ?').get(handle) as unknown as
    | UserRow
    | undefined;
  if (existing?.is_bot) return c.json({ error: 'That callsign belongs to the crowd. Pick another.' }, 409);

  const token = randomUUID();
  if (existing) {
    // Local demo: no passwords, so a known callsign simply hands back a fresh token.
    db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, existing.id);
    return c.json({ token, handle: existing.handle });
  }
  db.prepare(
    `INSERT INTO users (handle, token, is_bot, persona, faction_id, created_at)
     VALUES (?, ?, 0, NULL, NULL, ?)`,
  ).run(handle, token, Date.now());
  return c.json({ token, handle });
});

/* -------------------------------------------------------------------- state */

app.get('/api/state', auth, (c) => {
  resolveDue();
  const epoch = getEpoch();
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(c.get('user').id) as unknown as UserRow;
  return c.json(buildState(epoch, user));
});

/* --------------------------------------------------------------------- vote */

app.post('/api/vote', auth, async (c) => {
  const body = await c.req
    .json<{ scope?: Scope; dir?: Dir }>()
    .catch(() => ({}) as { scope?: Scope; dir?: Dir });
  const scope = body.scope;
  const dir = body.dir;
  if (scope !== 'world' && scope !== 'faction') return c.json({ error: 'Unknown scope.' }, 400);
  if (dir !== 'yes' && dir !== 'no') return c.json({ error: 'Unknown direction.' }, 400);

  resolveDue();
  const epoch = getEpoch();
  if (epoch.status === 'ended') return c.json({ error: 'The epoch is over.' }, 409);

  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(c.get('user').id) as unknown as UserRow;
  if (scope === 'faction' && !user.faction_id) {
    return c.json({ error: 'You are not in a faction.' }, 409);
  }

  const round = openRound(epoch, epochNow(epoch));
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO votes (epoch_id, round, scope, faction_id, user_id, dir, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(epoch.id, round, scope, user.faction_id ?? null, user.id, dir, Date.now());
  if (result.changes === 0) return c.json({ error: 'Ballot already filed for this round.' }, 409);

  return c.json(buildState(getEpoch(), user));
});

/* ---------------------------------------------------------- morning report */

app.post('/api/briefing/ack', auth, (c) => {
  resolveDue();
  const epoch = getEpoch();
  const day = dayOf(openRound(epoch, epochNow(epoch)));
  db.prepare('UPDATE users SET seen_day = ? WHERE id = ? AND seen_day < ?').run(
    day,
    c.get('user').id,
    day,
  );
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(c.get('user').id) as unknown as UserRow;
  return c.json(buildState(getEpoch(), user));
});

/* ----------------------------------------------------------------- factions */

app.get('/api/factions', auth, (c) => {
  resolveDue();
  const user = c.get('user');
  const rows = db
    .prepare('SELECT * FROM factions ORDER BY influence DESC, id')
    .all() as unknown as FactionRow[];
  return c.json({
    factions: rows.map((f) => factionSummary(f, user.faction_id)),
    creeds: Object.entries(CREEDS).map(([key, v]) => ({ key, ...v })),
  });
});

app.post('/api/factions', auth, async (c) => {
  const body = await c.req.json<{ name?: string; tagline?: string; creed?: Creed }>().catch(
    () => ({}) as { name?: string; tagline?: string; creed?: Creed },
  );
  const name = (body.name ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const tagline = (body.tagline ?? '').trim();
  const creed = body.creed;

  if (name.length < 3 || name.length > 28) {
    return c.json({ error: 'Faction name must be 3–28 characters.' }, 400);
  }
  if (tagline.length < 3 || tagline.length > 90) {
    return c.json({ error: 'Give the bloc a creed line of 3–90 characters.' }, 400);
  }
  if (!creed || !(creed in CREEDS)) return c.json({ error: 'Pick a doctrine.' }, 400);

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `bloc-${Date.now()}`;
  if (db.prepare('SELECT 1 FROM factions WHERE name = ? OR slug = ?').get(name, slug)) {
    return c.json({ error: 'A bloc already flies that banner.' }, 409);
  }

  const user = c.get('user');
  const created = tx(() => {
    const rand = mulberry32(Date.now() >>> 0);
    const res = db
      .prepare(
        `INSERT INTO factions (name, slug, tagline, creed, join_code, founder_id,
                               cohesion, influence, doctrine, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 60, 12, ?, ?)`,
      )
      .run(name, slug, tagline, creed, joinCode(rand), user.id, CREEDS[creed].doctrine, Date.now());
    const id = Number(res.lastInsertRowid);
    db.prepare('UPDATE users SET faction_id = ? WHERE id = ?').run(id, user.id);

    // A new banner attracts a handful of the unaffiliated on day one.
    const pool = db
      .prepare('SELECT id FROM users WHERE is_bot = 1 AND faction_id IS NULL ORDER BY id LIMIT 40')
      .all() as unknown as Array<{ id: number }>;
    const take = Math.min(pool.length, 4 + Math.floor(rand() * 5));
    const stmt = db.prepare('UPDATE users SET faction_id = ? WHERE id = ?');
    for (let i = 0; i < take; i++) stmt.run(id, pool[Math.floor(rand() * pool.length)].id);
    return id;
  });

  const epoch = getEpoch();
  seedFactionBallots(epoch, openRound(epoch, epochNow(epoch)), created);

  const row = db.prepare('SELECT * FROM factions WHERE id = ?').get(created) as unknown as FactionRow;
  return c.json({ faction: factionSummary(row, created) });
});

app.post('/api/factions/join', auth, async (c) => {
  const body = await c.req
    .json<{ id?: number; code?: string }>()
    .catch(() => ({}) as { id?: number; code?: string });
  const code = (body.code ?? '').trim().toUpperCase();
  const row = (
    code
      ? db.prepare('SELECT * FROM factions WHERE join_code = ?').get(code)
      : db.prepare('SELECT * FROM factions WHERE id = ?').get(body.id ?? -1)
  ) as unknown as FactionRow | undefined;
  if (!row) return c.json({ error: 'No bloc answers to that.' }, 404);

  const user = c.get('user');
  if (user.faction_id === row.id) return c.json({ error: 'You already fly that banner.' }, 409);
  db.prepare('UPDATE users SET faction_id = ? WHERE id = ?').run(row.id, user.id);
  // A pending faction ballot belongs to the bloc you were in when you cast it.
  db.prepare(
    `DELETE FROM votes WHERE user_id = ? AND scope = 'faction'
       AND round = (SELECT round FROM votes WHERE user_id = ? AND scope = 'faction'
                     ORDER BY round DESC LIMIT 1)
       AND faction_id IS NOT ?`,
  ).run(user.id, user.id, row.id);
  return c.json({ faction: factionSummary(row, row.id) });
});

app.post('/api/factions/leave', auth, (c) => {
  const user = c.get('user');
  if (!user.faction_id) return c.json({ error: 'You are unaffiliated already.' }, 409);
  const epoch = getEpoch();
  const round = openRound(epoch, epochNow(epoch));
  db.prepare(`DELETE FROM votes WHERE user_id = ? AND scope = 'faction' AND round = ?`).run(
    user.id,
    round,
  );
  db.prepare('UPDATE users SET faction_id = NULL WHERE id = ?').run(user.id);
  return c.json({ ok: true });
});

app.get('/api/factions/:id', auth, (c) => {
  const row = db
    .prepare('SELECT * FROM factions WHERE id = ?')
    .get(Number(c.req.param('id'))) as unknown as FactionRow | undefined;
  if (!row) return c.json({ error: 'No such bloc.' }, 404);
  const user = c.get('user');
  const results = db
    .prepare(
      `SELECT round, result, yes, no, note FROM faction_results
        WHERE epoch_id = ? AND faction_id = ? ORDER BY round`,
    )
    .all(getEpoch().id, row.id);
  return c.json({
    faction: factionSummary(row, user.faction_id),
    members: memberCount(row.id),
    results,
  });
});

/* ---------------------------------------------------------------- dev tools */

const dev = new Hono<Env>();
dev.use('*', async (c, next) => {
  if (!DEV_TOOLS) return c.json({ error: 'Dev tools are disabled.' }, 403);
  await next();
});

dev.post('/skip', auth, async (c) => {
  const body = await c.req.json<{ rounds?: number }>().catch(() => ({}) as { rounds?: number });
  const rounds = Math.max(1, Math.min(CHOICES_PER_DAY * 3, Math.trunc(body.rounds ?? 1)));
  skipRound(rounds);
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(c.get('user').id) as unknown as UserRow;
  return c.json(buildState(getEpoch(), user));
});

dev.post('/reset', auth, (c) => {
  const handle = c.get('user').handle;
  resetWorld();
  const token = randomUUID();
  db.prepare(
    `INSERT INTO users (handle, token, is_bot, persona, faction_id, created_at)
     VALUES (?, ?, 0, NULL, NULL, ?)`,
  ).run(handle, token, Date.now());
  resolveDue();
  return c.json({ token, handle });
});

app.route('/api/dev', dev);

/* ------------------------------------------------------- static (prod mode) */

const distDir = resolve(process.cwd(), 'dist');
if (existsSync(distDir)) {
  app.use('/assets/*', serveStatic({ root: './dist' }));
  app.use('/favicon.svg', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[override] api listening on http://localhost:${info.port}`);
});
