// frontend/src/app/api/notes/route.ts
// Admin-Notizen zu User-Profilen — gespeichert in invitations table
// title = "__note_<userId>__", body = JSON-Array von Notizen

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H = {
  apikey: KEY, Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json', Prefer: 'return=representation',
};

function noteTitle(userId: string) { return `__note_${userId}__`; }

interface Note { id: string; text: string; created_at: string; admin_label?: string; }

async function loadNotes(userId: string): Promise<{ recordId: string | null; notes: Note[] }> {
  const url = `${SUPA}/rest/v1/invitations?title=eq.${encodeURIComponent(noteTitle(userId))}&select=id,body&limit=1`;
  const res = await fetch(url, { headers: H });
  const data = await res.json().catch(() => []);
  if (Array.isArray(data) && data[0]) {
    try { return { recordId: data[0].id, notes: JSON.parse(data[0].body || '[]') }; } catch (_) {}
  }
  return { recordId: null, notes: [] };
}

async function saveNotes(userId: string, notes: Note[], recordId: string | null): Promise<boolean> {
  const body = JSON.stringify(notes);
  if (recordId) {
    const res = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${recordId}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ body }),
    });
    return res.ok;
  } else {
    const res = await fetch(`${SUPA}/rest/v1/invitations`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ title: noteTitle(userId), body, text: '{}', created_at: new Date().toISOString() }),
    });
    return res.ok;
  }
}

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const { notes } = await loadNotes(userId);
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const { action, userId, noteId, text, adminLabel } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { recordId, notes } = await loadNotes(userId);

  if (action === 'add') {
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });
    notes.unshift({ id: crypto.randomUUID(), text: text.trim(), created_at: new Date().toISOString(), admin_label: adminLabel || 'Admin' });
    const ok = await saveNotes(userId, notes, recordId);
    return NextResponse.json({ ok, notes });
  }

  if (action === 'delete') {
    const filtered = notes.filter((n: Note) => n.id !== noteId);
    const ok = await saveNotes(userId, filtered, recordId);
    return NextResponse.json({ ok, notes: filtered });
  }

  if (action === 'edit') {
    const updated = notes.map((n: Note) => n.id === noteId ? { ...n, text: text?.trim() || n.text, updated_at: new Date().toISOString() } : n);
    const ok = await saveNotes(userId, updated, recordId);
    return NextResponse.json({ ok, notes: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
