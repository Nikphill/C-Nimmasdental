import { Ctx } from '../_lib/types';
import { clearCookie, isAuthed, json, setPassword, verifyPassword } from '../_lib/auth';

export const onRequestPost = async ({ request, env }: Ctx) => {
  if (!(await isAuthed(env, request))) return json({ error: 'Unauthorized' }, 401);
  const { currentPassword, newPassword } = (await request.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !(await verifyPassword(env, currentPassword))) {
    return json({ error: 'Current password is incorrect' }, 403);
  }
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return json({ error: 'New password must be 8–128 characters' }, 400);
  }
  await setPassword(env, newPassword); // also signs out every session
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
};
