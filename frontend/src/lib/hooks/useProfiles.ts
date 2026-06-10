// frontend/src/lib/hooks/useProfiles.ts
// ── HUI Admin — useProfiles Hook mit Realtime ────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount, sbUpdate } from '../api';
import type { HuiProfile } from './useSupabase';

export type { HuiProfile };

export interface UseProfilesOptions {
  search?:          string;
  role?:            string;
  status?:          'all' | 'active' | 'blocked' | 'deleted';
  is_wirker?:       boolean;
  page?:            number;
  limit?:           number;
  refreshInterval?: number;
  realtime?:        boolean;
}

const PROFILE_SELECT = [
  'id,display_name,username,avatar_url,bio,tagline,role,membership_type',
  'is_wirker,is_member,membership_active,has_talent_profile,talent',
  'location,location_label,is_available,availability,impact_eur',
  'follower_count,followers_count,trust_score,is_guardian',
  'last_seen,last_seen_at,created_at,updated_at,skills,focus_type',
  'email,phone,full_name,is_talent,talent_since,talent_activated_at',
  'member_since,blocked,blocked_at,blocked_by,is_blocked,is_deleted,username_lower',
].join(',');

export function useProfiles(opts: UseProfilesOptions = {}) {
  const {
    search, role, status = 'active', is_wirker,
    page = 0, limit = 50, refreshInterval = 0, realtime = true,
  } = opts;

  const [profiles, setProfiles] = useState<HuiProfile[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const channelRef              = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if (role && role !== 'all') params['role'] = `eq.${role}`;
      if (is_wirker !== undefined) params['is_wirker'] = `eq.${is_wirker}`;

      if      (status === 'deleted') { params['trust_score'] = 'eq.-999'; }
      else if (status === 'blocked') { params['role']        = 'eq.blocked'; }
      else if (status === 'active')  {
        params['trust_score'] = 'not.eq.-999';
        if (!params['role'])  params['role'] = 'not.eq.blocked';
      } else {
        params['trust_score'] = 'not.eq.-999';
      }

      const [rows, count] = await Promise.all([
        sbQuery<HuiProfile>('profiles', params, {
          select: PROFILE_SELECT,
          order: 'created_at.desc',
          limit,
          offset: page * limit,
        }),
        sbCount('profiles', params),
      ]);

      const q        = (search || '').toLowerCase();
      const filtered = q
        ? rows.filter(p =>
            p.display_name?.toLowerCase().includes(q) ||
            p.full_name?.toLowerCase().includes(q)    ||
            p.username?.toLowerCase().includes(q)     ||
            p.email?.toLowerCase().includes(q)        ||
            p.phone?.toLowerCase().includes(q)        ||
            p.talent?.toLowerCase().includes(q)
          )
        : rows;

      setProfiles(filtered); setTotal(count);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, role, status, is_wirker, page, limit]);

  useEffect(() => {
    if (!realtime) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('admin:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles'         }, fetchProfiles)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wirker_profiles'  }, fetchProfiles)
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [realtime, fetchProfiles]);

  useEffect(() => {
    fetchProfiles();
    if (refreshInterval > 0) {
      const id = setInterval(fetchProfiles, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchProfiles, refreshInterval]);

  const updateProfile = useCallback(async (id: string, data: Record<string, unknown>): Promise<boolean> => {
    const ok = await sbUpdate('profiles', id, data);
    if (ok) fetchProfiles();
    return ok;
  }, [fetchProfiles]);

  return { profiles, total, loading, error, refetch: fetchProfiles, updateProfile };
}
