// frontend/src/app/api/notes/route.ts
// Admin-Notizen zu User-Profilen — gespeichert in invitations table
// title = "__note_<userId>__", body = JSON-Array von Notizen
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

function noteTitle(userId: string) { return `__note_${userId}__`; }
interface Note { id: string; text: string; created_at: string; adminLabel?: string; }

async function loadNotes(userId: string) {
  const sb = getServiceClient();
  const { data } = await sb
    .from('invitations')
    .select('id,body')
    .eq('title', noteTitle(userId))
    .limit(1)
    .single();
  if (!data) return { recordId: null, notes: [] as Note[] };
  try { return { recordId: data.id as string, notes: JSON.parse(data.body || '[]') as Note[] }; }
  catch { return { recordId: data.id as string, notes: [] as Note[] }; }
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return validationError({ userId: 'Pflichtfeld' });

  try {
    const { notes } = await loadNotes(userId);
    return ok(notes);
  } catch (err) { return serverError(err, 'notes GET'); }
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, userId, noteId, text, adminLabel } = body as {
      action?: string; userId?: string; noteId?: string;
      text?: string; adminLabel?: string;
    };
    if (!userId) return validationError({ userId: 'Pflichtfeld' });
    if (!action) return validationError({ action: 'Pflichtfeld' });

    const sb = getServiceClient();
    const { recordId, notes } = await loadNotes(userId);

    const saveNotes = async (updated: Note[]) => {
      const bodyStr = JSON.stringify(updated);
      if (recordId) {
        const { error } = await sb.from('invitations').update({ body: bodyStr }).eq('id', recordId);
        if (error) throw error;
      } else {
        const { error } = await sb.from('invitations').insert({
          title: noteTitle(userId), body: bodyStr, text: '{}',
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      return updated;
    };

    if (action === 'add') {
      if (!text?.trim()) return validationError({ text: 'Pflichtfeld' });
      const updated = [
        { id: crypto.randomUUID(), text: text.trim(), created_at: new Date().toISOString(), adminLabel: adminLabel ?? 'Admin' },
        ...notes,
      ];
      return ok(await saveNotes(updated));
    }
    if (action === 'delete') {
      if (!noteId) return validationError({ noteId: 'Pflichtfeld' });
      return ok(await saveNotes(notes.filter(n => n.id !== noteId)));
    }
    if (action === 'edit') {
      if (!noteId || !text?.trim()) return validationError({ noteId: 'Pflichtfeld', text: 'Pflichtfeld' });
      return ok(await saveNotes(notes.map(n => n.id === noteId ? { ...n, text: text.trim() } : n)));
    }
    return fail(`Unbekannte Aktion: ${action}`);
  } catch (err) { return serverError(err, 'notes POST'); }
}
