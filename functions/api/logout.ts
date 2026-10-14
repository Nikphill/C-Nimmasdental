import { Ctx } from '../_lib/types';
import { clearCookie, destroySession, json } from '../_lib/auth';

export const onRequestPost = async ({ request, env }: Ctx) => {
  await destroySession(env, request);
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
};
