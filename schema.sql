CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'general',
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  service TEXT, doctor TEXT, date TEXT, time_slot TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT, source TEXT, details TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, fails INTEGER NOT NULL, window_start INTEGER NOT NULL);
