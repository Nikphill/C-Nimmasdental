import { Ctx } from '../_lib/types';
import { isAuthed, json } from '../_lib/auth';

const TYPES = ['cosmetic', 'general', 'quiz'];
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// PUBLIC: website forms (booking, cosmetic VIP, smile quiz) and staff manual entry post here.
export const onRequestPost = async ({ request, env }: Ctx) => {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patientName = clean(b.patientName, 100);
  const phone = clean(b.phone, 20);
  if (!patientName || !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    return json({ error: 'Name and a valid phone number are required' }, 400);
  }
  const type = TYPES.includes(b.type as string) ? (b.type as string) : 'general';
  const details = b.details && typeof b.details === 'object' ? JSON.stringify(b.details).slice(0, 2000) : null;

  // Keep the client's reference id when it looks right and is free; otherwise mint a new one.
  let id = clean(b.id, 20);
  if (!/^NIMMA-[A-Z]{0,2}\d{3,6}$/.test(id) || (await env.DB.prepare('SELECT 1 AS x FROM leads WHERE id = ?').bind(id).first())) {
    id = 'NIMMA-' + String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO leads (id, type, patient_name, phone, email, service, doctor, date, time_slot, status, notes, source, details, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
  ).bind(
    id, type, patientName, phone, clean(b.email, 120) || null, clean(b.service, 160), clean(b.doctor, 120) || null,
    clean(b.date, 20), clean(b.timeSlot, 20), clean(b.notes, 1000), clean(b.source, 80), details, now, now,
  ).run();
  return json({ ok: true, id }, 201);
};

// STAFF ONLY
export const onRequestGet = async ({ request, env }: Ctx) => {
  if (!(await isAuthed(env, request))) return json({ error: 'Unauthorized' }, 401);
  const { results } = await env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 2000').all<Record<string, any>>();
  const leads = results.map((r) => ({
    id: r.id, type: r.type, patientName: r.patient_name, phone: r.phone, email: r.email || undefined,
    service: r.service, doctor: r.doctor || undefined, date: r.date, timeSlot: r.time_slot, status: r.status,
    notes: r.notes || '', source: r.source || '', createdAt: r.created_at,
    details: r.details ? JSON.parse(r.details) : undefined,
  }));
  return json({ leads });
};
