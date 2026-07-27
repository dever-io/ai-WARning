import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DB_PATH = process.env.DB_PATH ?? resolve(process.cwd(), 'data/override.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS factions (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  tagline     TEXT NOT NULL,
  creed       TEXT NOT NULL,
  join_code   TEXT NOT NULL,
  founder_id  INTEGER,
  cohesion    INTEGER NOT NULL DEFAULT 50,
  influence   INTEGER NOT NULL DEFAULT 20,
  doctrine    INTEGER NOT NULL DEFAULT 50,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY,
  handle      TEXT NOT NULL UNIQUE,
  token       TEXT UNIQUE,
  is_bot      INTEGER NOT NULL DEFAULT 0,
  persona     TEXT,
  faction_id  INTEGER REFERENCES factions(id) ON DELETE SET NULL,
  seen_day    INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS epochs (
  id           INTEGER PRIMARY KEY,
  started_at   INTEGER NOT NULL,
  round_ms     INTEGER NOT NULL,
  clock_offset INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'running',
  ctl INTEGER NOT NULL, pwr INTEGER NOT NULL, eco INTEGER NOT NULL,
  trs INTEGER NOT NULL, pln INTEGER NOT NULL,
  ending_key   TEXT,
  ended_at     INTEGER
);

CREATE TABLE IF NOT EXISTS votes (
  id         INTEGER PRIMARY KEY,
  epoch_id   INTEGER NOT NULL,
  round      INTEGER NOT NULL,
  scope      TEXT NOT NULL,
  faction_id INTEGER,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dir        TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (epoch_id, round, scope, user_id)
);
CREATE INDEX IF NOT EXISTS votes_lookup ON votes (epoch_id, round, scope);

CREATE TABLE IF NOT EXISTS round_results (
  epoch_id    INTEGER NOT NULL,
  round       INTEGER NOT NULL,
  result      TEXT NOT NULL,
  yes         INTEGER NOT NULL,
  no          INTEGER NOT NULL,
  mandate     REAL NOT NULL,
  fx          TEXT NOT NULL,
  meters      TEXT NOT NULL,
  resolved_at INTEGER NOT NULL,
  PRIMARY KEY (epoch_id, round)
);

CREATE TABLE IF NOT EXISTS faction_results (
  epoch_id   INTEGER NOT NULL,
  round      INTEGER NOT NULL,
  faction_id INTEGER NOT NULL,
  result     TEXT NOT NULL,
  yes        INTEGER NOT NULL,
  no         INTEGER NOT NULL,
  fx         TEXT NOT NULL,
  note       TEXT NOT NULL,
  PRIMARY KEY (epoch_id, round, faction_id)
);

CREATE TABLE IF NOT EXISTS bot_rounds (
  epoch_id INTEGER NOT NULL,
  round    INTEGER NOT NULL,
  PRIMARY KEY (epoch_id, round)
);
`);

/** Adds a column to an already-created table on an existing database file. */
function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

ensureColumn('users', 'seen_day', 'seen_day INTEGER NOT NULL DEFAULT 1');

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
