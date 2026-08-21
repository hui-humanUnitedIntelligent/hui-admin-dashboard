import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/app/lib/supabase-server';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Internal-only: requires a secret header to prevent external abuse
  const authHeader = req.headers.get('x-sadb-internal');
  if (authHeader !== process.env.SADB_PUSH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getServiceClient();

  // Configure web-push
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@hui.app',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  // 1) Fetch current counts (same logic as pending-counts API)
  const [
    worksRes, talentsRes, expRes, momentesRes, recReportsRes,
    impactAppsRes, scoreFailuresRes, ticketsRes,
  ] = await Promise.all([
    sb.from('works').select('id').in('status', ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval']),
    sb.from('talents').select('id').in('status', ['pending', 'pending_review']),
    sb.from('experiences').select('id').eq('status', 'pending_review'),
    sb.from('momente_reports').select('moment_id'),
    sb.from('recommendation_reports').select('id').eq('status', 'new'),
    sb.from('impact_applications').select('id').in('status', ['submitted', 'pending', 'pending_review', 'review', 'waiting_for_approval']),
    sb.from('impact_score_failures').select('id'),
    // Tickets: in notifications table, type='support_ticket'
    sb.from('notifications').select('id,data').eq('type', 'support_ticket'),
  ]);

  const currentCounts = {
    works: worksRes.data?.length ?? 0,
    talents: talentsRes.data?.length ?? 0,
    experiences: expRes.data?.length ?? 0,
    momente: new Set((momentesRes.data ?? []).map((r: any) => r.moment_id)).size,
    rec_reports: recReportsRes.data?.length ?? 0,
    impact_applications: impactAppsRes.data?.length ?? 0,
    score_failures: scoreFailuresRes.data?.length ?? 0,
    // tickets: count unread support tickets (read_by_admin is in JSONB data)
    tickets_open: (ticketsRes.data ?? []).filter((t: any) => {
      const d = t.data && typeof t.data === 'object' ? t.data : {};
      return d.read_by_admin !== true;
    }).length,
  };

  // 2) Load last known state
  const { data: stateData } = await sb
    .from('sadb_notification_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const lastCounts = stateData || {
    works: 0, talents: 0, experiences: 0, momente: 0,
    rec_reports: 0, impact_applications: 0, score_failures: 0, tickets_open: 0,
  };

  // 3) Detect increases
  const changes: string[] = [];

  if (currentCounts.works > lastCounts.works) {
    const delta = currentCounts.works - lastCounts.works;
    changes.push(`${delta} neues Werk ${delta === 1 ? 'wartet' : 'warten'} auf Freigabe`);
  }
  if (currentCounts.talents > lastCounts.talents) {
    const delta = currentCounts.talents - lastCounts.talents;
    changes.push(`${delta} neues Talent ${delta === 1 ? 'wartet' : 'warten'} auf Freigabe`);
  }
  if (currentCounts.experiences > lastCounts.experiences) {
    const delta = currentCounts.experiences - lastCounts.experiences;
    changes.push(`${delta} neues Erlebnis ${delta === 1 ? 'wartet' : 'warten'} auf Freigabe`);
  }
  if (currentCounts.momente > lastCounts.momente) {
    const delta = currentCounts.momente - lastCounts.momente;
    changes.push(`${delta} gemeldeter ${delta === 1 ? 'Moment' : 'Momente'}`);
  }
  if (currentCounts.rec_reports > lastCounts.rec_reports) {
    changes.push('Neue Empfehlungs-Meldung');
  }
  if (currentCounts.impact_applications > lastCounts.impact_applications) {
    changes.push('Neues Impact-Projekt eingereicht');
  }
  if (currentCounts.score_failures > lastCounts.score_failures) {
    changes.push('Neue Fehlermeldung (Score Failure)');
  }
  if (currentCounts.tickets_open > lastCounts.tickets_open) {
    changes.push('Neues Support-Ticket');
  }

  // 4) Update state
  await sb.from('sadb_notification_state').upsert({
    id: 1,
    ...currentCounts,
    updated_at: new Date().toISOString(),
  });

  if (changes.length === 0) {
    return NextResponse.json({ sent: false, changes: [], counts: currentCounts });
  }

  // 5) Get all active push subscriptions
  const { data: subs } = await sb
    .from('sadb_push_subscriptions')
    .select('*')
    .eq('is_active', true);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: false, changes, counts: currentCounts, reason: 'no_subscriptions' });
  }

  // 6) Send push notifications
  const title = 'HUI Admin — Neue Aktivität';
  const body = changes.join('\n');

  // Determine which page to open
  let url = '/dashboard';
  if (changes.some(c => c.includes('Werk'))) url = '/works';
  else if (changes.some(c => c.includes('Talent'))) url = '/talents';
  else if (changes.some(c => c.includes('Moment'))) url = '/momente';
  else if (changes.some(c => c.includes('Empfehlung'))) url = '/reports';
  else if (changes.some(c => c.includes('Impact'))) url = '/impact-projekte';
  else if (changes.some(c => c.includes('Fehler'))) url = '/score-failures';
  else if (changes.some(c => c.includes('Ticket'))) url = '/tickets';

  const payload = JSON.stringify({ title, body, url, tag: 'sadb-activity' });
  let sentCount = 0;
  let failedCount = 0;

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    try {
      await webpush.sendNotification(pushSub, payload);
      sentCount++;
    } catch (err: any) {
      console.error('[push/check-and-notify] Send failed for', sub.endpoint.slice(0, 50), err.statusCode);
      // If subscription expired (410) or invalid (404), deactivate it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await sb.from('sadb_push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id);
      }
      failedCount++;
    }
  }

  return NextResponse.json({
    sent: sentCount > 0,
    sentCount,
    failedCount,
    changes,
    counts: currentCounts,
  });
}
