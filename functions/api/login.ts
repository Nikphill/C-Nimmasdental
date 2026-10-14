import { Ctx } from '../_lib/types';
import {
  clearFailures, createSession, isLockedOut, json, recordFailure, sessionCookie, verifyPassword,
} from '../_lib/auth';

export const onRequestPost = async ({ request, env }: Ctx) => {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await isLockedOut(env, ip)) {
    return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }
  const body = (await request.json().catch(() => ({}))) as { password?: string; remember?: boolean };
  if (!body.password || !(await verifyPassword(env, body.password))) {
    await recordFailure(env, ip);
    return json({ error: 'Incorrect passcode' }, 401);
  }
  await clearFailures(env, ip);
  const remember = body.remember === true;
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await createSession(env, remember), remember) });
};
