// Minimal Cloudflare types (avoids needing @cloudflare/workers-types).
export interface D1Result<T = unknown> { results: T[]; success: boolean; meta: Record<string, unknown> }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database { prepare(query: string): D1PreparedStatement }

export interface Env {
  DB: D1Database;
  /** Secret used only until the staff password is changed for the first time. */
  STAFF_INITIAL_PASSWORD: string;
}

export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string>;
}
