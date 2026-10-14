// Lead storage backed by Cloudflare (Pages Functions + D1) instead of the browser.

export type LeadStatus = 'new' | 'contacted' | 'consultation_scheduled' | 'completed' | 'cancelled';

export interface FormSubmission {
  id: string;
  type: 'cosmetic' | 'general' | 'quiz';
  patientName: string;
  phone: string;
  email?: string;
  service: string;
  doctor?: string;
  date: string;
  timeSlot: string;
  status: LeadStatus;
  notes?: string;
  createdAt: string;
  source: string;
  details?: {
    smileGoal?: string;
    concerns?: string[];
    budgetEstimate?: string;
    promoCode?: string;
    shadeGoal?: string;
    urgency?: string;
    specialRequests?: string;
  };
}

const UPDATED_EVENT = 'nimma_leads_updated';
let cache: FormSubmission[] = [];

const notify = () => window.dispatchEvent(new Event(UPDATED_EVENT));

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
}

/** Last list fetched from the server (staff only). Call refreshLeads() to update it. */
export const getLeads = (): FormSubmission[] => cache;

/** Loads leads from Cloudflare. Returns [] and clears the cache if not signed in. */
export async function refreshLeads(): Promise<FormSubmission[]> {
  try {
    const res = await api('/api/leads');
    cache = res.ok ? ((await res.json()) as { leads: FormSubmission[] }).leads : [];
  } catch {
    // network error: keep whatever we had
  }
  notify();
  return cache;
}

export function clearLeadsCache() {
  cache = [];
  notify();
}

/** Public: used by the website forms and staff manual entry. Resolves to the saved reference id. */
export async function saveLead(lead: FormSubmission): Promise<string> {
  const res = await api('/api/leads', { method: 'POST', body: JSON.stringify(lead) });
  if (!res.ok) throw new Error('Could not save your request');
  const { id } = (await res.json()) as { id: string };
  notify(); // portal (if open and signed in) reloads on this event
  return id;
}

async function patchLead(id: string, body: { status?: LeadStatus; notes?: string }) {
  const res = await api(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Update failed');
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  await patchLead(id, { status });
}

export async function updateLeadNotes(id: string, notes: string) {
  await patchLead(id, { notes });
}

export async function deleteLead(id: string) {
  const res = await api(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

export function exportLeadsToCSV() {
  const cols: (keyof FormSubmission)[] = [
    'id', 'type', 'patientName', 'phone', 'email', 'service', 'doctor', 'date', 'timeSlot', 'status', 'notes', 'source', 'createdAt',
  ];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...cache.map((l) => cols.map((c) => esc(l[c])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `nimma-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
