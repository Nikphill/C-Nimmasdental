import { Ctx } from '../../_lib/types';
import { isAuthed, json } from '../../_lib/auth';

const STATUSES = ['new', 'contacted', 'consultation_scheduled', 'completed', 'cancelled'];

export const onRequestPatch = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(env, request))) return json({ error: 'Unauthorized' }, 401);
  const b = (await request.json().catch(() => ({}))) as { status?: string; notes?: string };
  const now = new Date().toISOString();
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return json({ error: 'Invalid status' }, 400);
    await env.DB.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').bind(b.status, now, params.id).run();
  }
  if (b.notes !== undefined) {
    await env.DB.prepare('UPDATE leads SET notes = ?, updated_at = ? WHERE id = ?')
      .bind(String(b.notes).slice(0, 1000), now, params.id).run();
  }
  return json({ ok: true });
};

export const onRequestDelete = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(env, request))) return json({ error: 'Unauthorized' }, 401);
  await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
};
