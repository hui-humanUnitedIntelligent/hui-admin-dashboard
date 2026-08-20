// TEMP DEBUG ROUTE — wird nach Diagnose sofort wieder entfernt.
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET() {
  const sb = getServiceClient();

  // EXAKT die gleiche Query wie in pending-counts/route.ts
  const filtered = await sb.from('impact_applications')
    .select('id', { count: 'exact', head: true })
    .in('status', ['submitted','pending','pending_review','review','waiting_for_approval']);

  const unfiltered = await sb.from('impact_applications')
    .select('id', { count: 'exact', head: true });

  const allData = await sb.from('impact_applications').select('*');

  const statusCounts = await sb.from('impact_applications').select('status');

  return NextResponse.json({
    filteredCount: filtered.count,
    filteredError: filtered.error?.message,
    unfilteredCount: unfiltered.count,
    unfilteredError: unfiltered.error?.message,
    allDataLength: allData.data?.length,
    allDataError: allData.error?.message,
    allData: allData.data,
    statusCountsRaw: statusCounts.data,
  });
}
