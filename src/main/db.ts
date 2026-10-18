import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import initSqlJs, { type Database } from 'sql.js'
import type { Game } from '@shared/types'

// SQLite local via sql.js (WebAssembly) : aucun module natif à compiler sous Windows.
// La base est un simple fichier dans le dossier de données de l'appli.
let db: Database
let dbPath: string

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
  dbPath = join(app.getPath('userData'), 'launcher.db')
  db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database()
  db.run(`
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY, store TEXT NOT NULL, store_id TEXT NOT NULL, name TEXT NOT NULL,
      install_dir TEXT, cover_url TEXT, hero_url TEXT, last_played INTEGER, favorite INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS launches (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, at INTEGER NOT NULL);
  `)
  // Migration : colonne ajoutée après la première version.
  try {
    db.run('ALTER TABLE games ADD COLUMN exe_path TEXT')
  } catch {
    /* déjà présente */
  }
  persist()
}

function persist(): void {
  writeFileSync(dbPath, Buffer.from(db.export()))
}

// --- clé/valeur (paramètres, comptes). Les valeurs secrètes sont chiffrées par l'OS. ---

export function getKv<T>(key: string, fallback: T): T {
  const stmt = db.prepare('SELECT value FROM kv WHERE key = ?')
  stmt.bind([key])
  const raw = stmt.step() ? (stmt.get()[0] as string) : null
  stmt.free()
  if (raw === null) return fallback
  try {
    const text = raw.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(raw.slice(4), 'base64')) : raw
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export function setKv(key: string, value: unknown, secret = false): void {
  let text = JSON.stringify(value)
  if (secret && safeStorage.isEncryptionAvailable()) {
    text = 'enc:' + safeStorage.encryptString(text).toString('base64')
  }
  db.run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, text])
  persist()
}

export function deleteKv(key: string): void {
  db.run('DELETE FROM kv WHERE key = ?', [key])
  persist()
}

// --- jeux ---

export function listGames(): Game[] {
  const res = db.exec(`
    SELECT g.id, g.store, g.store_id, g.name, g.install_dir, g.cover_url, g.hero_url, g.last_played, g.favorite, g.exe_path,
           (SELECT COUNT(*) FROM launches l WHERE l.game_id = g.id)
    FROM games g`)
  if (!res.length) return []
  return res[0].values.map((r) => ({
    id: r[0] as string,
    store: r[1] as Game['store'],
    storeId: r[2] as string,
    name: r[3] as string,
    installDir: (r[4] as string) ?? undefined,
    coverUrl: (r[5] as string) ?? undefined,
    heroUrl: (r[6] as string) ?? undefined,
    lastPlayed: (r[7] as number) ?? undefined,
    favorite: r[8] === 1,
    exePath: (r[9] as string) ?? undefined,
    launches: r[10] as number
  }))
}

/** Remplace la liste des jeux détectés en gardant favoris et dernière session. */
export function replaceGames(games: Game[]): void {
  const keep = new Map(listGames().map((g) => [g.id, g]))
  db.run('BEGIN')
  try {
    db.run('DELETE FROM games')
    for (const g of games) {
      const old = keep.get(g.id)
      db.run(
        'INSERT OR REPLACE INTO games (id, store, store_id, name, install_dir, cover_url, hero_url, last_played, favorite, exe_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [g.id, g.store, g.storeId, g.name, g.installDir ?? null, g.coverUrl ?? null, g.heroUrl ?? null, old?.lastPlayed ?? null, old?.favorite ? 1 : 0, g.exePath ?? null]
      )
    }
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
  persist()
}

export function recordLaunch(id: string): void {
  const now = Date.now()
  db.run('UPDATE games SET last_played = ? WHERE id = ?', [now, id])
  db.run('INSERT INTO launches (game_id, at) VALUES (?, ?)', [id, now])
  persist()
}

export function toggleFavorite(id: string): void {
  db.run('UPDATE games SET favorite = 1 - favorite WHERE id = ?', [id])
  persist()
}
