// frontend/src/app/api/pending-counts/route.ts
// BADGE-SYNC-004: + Impact Projekte (impact_applications) + Ablehnungsgründe (impact_score_failures)
// BADGE-SYNC-005 (2026-08-22): + Fehlermeldungen (bug_reports, status='offen')
// BADGE-SYNC-006 (2026-09-18, Michael: "wenn ein Ticket rein kommt bei SADB
// muss auch eine rote Eins davor stehen"): + Support-Tickets. Zaehlt Threads
// mit mindestens einer ungelesenen Nachricht (read_by_admin=false) — exakt
// dieselbe Definition wie die "N ungelesen"-Pill auf der Tickets-Seite selbst
// (tickets/route.ts groupIntoThreads() -> thread.unread).
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  // FIX (2026-08-21, BADGE-GHOST-001): head:true + count:'exact' liefert auf
  // Vercel veraltete/wrong counts (Supabase JS Client HEAD-Count-Bug). Statt
  // head:true jetzt echtes Data-Fetch + .length — für kleine Admin-Counts
  // (0-50 Records) vernachlässigbar, aber KORREKT.
  const [
    worksRes, talentsRes, expRes, momentesRes, recReportsRes,
    impactAppsRes, scoreFailuresRes, moderationRes, bugReportsRes, ticketsRes,
  ] = await Promise.all([
    // Works: warten auf Freigabe
    sb.from('works')
      .select('id')
      .in('status', ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval']),

    // Talents: warten auf Freigabe
    sb.from('talents')
      .select('id')
      .in('status', ['pending', 'pending_review']),

    // Experiences: NUR wenn status=pending_review
    sb.from('experiences')
      .select('id')
      .eq('status', 'pending_review'),

    // Momente: gemeldete Momente (distinct moment_id)
    sb.from('momente_reports')
      .select('moment_id'),

    // Recommendation Reports: neue Meldungen
    sb.from('recommendation_reports')
      .select('id')
      .eq('status', 'new'),

    // Impact Projekte: eingereichte Bewerbungen
    sb.from('impact_applications')
      .select('id')
      .in('status', ['submitted','pending','pending_review','review','waiting_for_approval']),

    // Ablehnungsgründe: KI-abgelehnte Einreichungen
    sb.from('impact_score_failures')
      .select('id'),

    // Inhaltsprüfung: nur echte, noch nicht bearbeitete Treffer.
    // Cleared/False-Positive/Blurred zählen nicht weiter als neue Meldung.
    // Legacy-Treffer ohne admin_status bleiben zur Sicherheit sichtbar.
    sb.from('content_moderation')
      .select('id')
      .eq('is_flagged', true)
      .eq('is_false_positive', false)
      .or('admin_status.is.null,admin_status.in.(pending,urgent_review)'),

    // Fehlermeldungen: offene Bug-Reports (BADGE-SYNC-005)
    sb.from('bug_reports')
      .select('id')
      .eq('status', 'offen'),

    // Support-Tickets: alle Nachrichten holen, unread-Threads werden unten
    // gezaehlt (BADGE-SYNC-006) — kleine Admin-Tabelle, select(id,data) reicht.
    sb.from('notifications')
      .select('id, data')
      .eq('type', 'support_ticket'),
  ]);

  const works              = worksRes.data?.length     ?? 0;
  const talents            = talentsRes.data?.length   ?? 0;
  const experiences        = expRes.data?.length       ?? 0;
  // momente_reports: zähle distinct moment_id
  const momente = new Set((momentesRes.data ?? []).map((r: any) => r.moment_id)).size;
  const recReports          = recReportsRes.data?.length  ?? 0;
  const impactApplications  = impactAppsRes.data?.length ?? 0;
  const scoreFailures       = scoreFailuresRes.data?.length ?? 0;
  const moderation          = moderationRes.data?.length ?? 0;
  const bugReports          = bugReportsRes.data?.length  ?? 0;

  // Support-Tickets: pro Thread (ticket_number) pruefen ob irgendeine
  // Nachricht read_by_admin=false hat -> Anzahl UNGELESENER Threads,
  // nicht Anzahl Nachrichten (ein Thread mit 3 ungelesenen Antworten zaehlt
  // trotzdem nur als 1 -- gleiche Definition wie tickets/route.ts unread-Flag).
  const ticketRows = ticketsRes.data ?? [];
  const unreadTicketThreads = new Set<string>();
  for (const row of ticketRows as Array<{ data: Record<string, unknown> | null }>) {
    const d = row.data ?? {};
    const tnr = String(d.ticket_number ?? '');
    if (tnr && !d.read_by_admin) unreadTicketThreads.add(tnr);
  }
  const tickets = unreadTicketThreads.size;

  const total = works + talents + experiences + momente + recReports + impactApplications + scoreFailures + moderation + bugReports + tickets;

  // CACHE-BUST-001 (2026-08-21): Vercel liefert veraltete Badge-Zähler.
  // Force no-store + immutable response um Edge-Caching zu verhindern.
  const res = NextResponse.json({
    works,
    talents,
    experiences,
    momente,
    recReports,
    impactApplications,
    scoreFailures,
    moderation,
    bugReports,
    tickets,
    total,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
  return res;
}
