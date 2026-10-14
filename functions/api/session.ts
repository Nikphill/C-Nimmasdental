import { Ctx } from '../_lib/types';
import { isAuthed, json } from '../_lib/auth';

// Lets the portal check on page load whether the staff member is still signed in.
export const onRequestGet = async ({ request, env }: Ctx) => json({ authed: await isAuthed(env, request) });
