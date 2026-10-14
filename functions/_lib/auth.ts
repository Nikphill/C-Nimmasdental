import type { Env } from './types';

const ITERATIONS = 100_000; // Workers' maximum for PBKDF2
const SHORT_HOURS = 12;
const LONG_HOURS = 24 * 30;
const COOKIE = 'staff_session';

const enc = new TextEncoder();
const toHex = (b: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${toHex(salt)}:${await pbkdf2(password, salt)}`;
}

async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** Checks the password against the stored hash, or the initial secret if none is stored yet. */
export async function verifyPassword(env: Env, password: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'staff_password_hash'").first<{ value: string }>();
  if (row) {
    const [saltHex, hashHex] = row.value.split(':');
    return safeEqual(await pbkdf2(password, fromHex(saltHex)), hashHex);
  }
  return !!env.STAFF_INITIAL_PASSWORD && safeEqual(await sha256(password), await sha256(env.STAFF_INITIAL_PASSWORD));
}

export async function setPassword(env: Env, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('staff_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).bind(hash).run();
  await env.DB.prepare('DELETE FROM sessions').run(); // sign everyone out
}

export async function createSession(env: Env, remember = false): Promise<string> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = Date.now() + (remember ? LONG_HOURS : SHORT_HOURS) * 3600_000;
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').bind(await sha256(token), expires).run();
  return token;
}

function readCookie(request: Request): string | null {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

export async function isAuthed(env: Env, request: Request): Promise<boolean> {
  const token = readCookie(request);
  if (!token) return false;
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .bind(await sha256(token)).first<{ expires_at: number }>();
  return !!row && row.expires_at > Date.now();
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = readCookie(request);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export const sessionCookie = (token: string, remember = false) =>
  `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/${remember ? `; Max-Age=${LONG_HOURS * 3600}` : ''}`;
export const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

// --- Login throttling: 5 failed attempts per IP per 15 minutes ---
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;

export async function isLockedOut(env: Env, ip: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT fails, window_start FROM login_attempts WHERE ip = ?')
    .bind(ip).first<{ fails: number; window_start: number }>();
  return !!row && Date.now() - row.window_start < WINDOW_MS && row.fails >= MAX_FAILS;
}

export async function recordFailure(env: Env, ip: string): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO login_attempts (ip, fails, window_start) VALUES (?, 1, ?)
     ON CONFLICT(ip) DO UPDATE SET
       fails = CASE WHEN ? - window_start >= ? THEN 1 ELSE fails + 1 END,
       window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END`,
  ).bind(ip, now, now, WINDOW_MS, now, WINDOW_MS, now).run();
}

export async function clearFailures(env: Env, ip: string): Promise<void> {
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
}
