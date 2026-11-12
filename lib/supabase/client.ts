import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      url.startsWith('http') &&
      !url.includes('your-project-id') &&
      !key.includes('your-supabase-anon-key')
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;

  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
  return browserClient;
}

export async function ensureAnonymousSession(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

export interface WitnessCounts {
  submitted_count: number;
  started_count: number;
  total_roster: number;
  subject_filed_counts: Record<string, number>;
  most_filed_subject_id: string | null;
}

export async function fetchWitnessCounts(): Promise<WitnessCounts> {
  const fallback: WitnessCounts = {
    submitted_count: 0,
    started_count: 0,
    total_roster: 23,
    subject_filed_counts: {},
    most_filed_subject_id: null,
  };
  const supabase = getSupabaseClient();
  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase.rpc('get_witness_counts');
    if (error || !data) return fallback;
    return {
      submitted_count: Number(data.submitted_count ?? 0),
      started_count: Number(data.started_count ?? 0),
      total_roster: Number(data.total_roster ?? 23),
      subject_filed_counts: (data.subject_filed_counts as Record<string, number>) ?? {},
      most_filed_subject_id: data.most_filed_subject_id ?? null,
    };
  } catch {
    return fallback;
  }
}

export interface NicknameSuggestion {
  nickname: string;
  suggestion_count: number;
}

export async function fetchNicknameSuggestions(
  subjectRosterId: string
): Promise<NicknameSuggestion[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.rpc('get_nickname_suggestions', {
      p_subject_roster_id: subjectRosterId,
    });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: { nickname: string; suggestion_count: number }) => ({
      nickname: row.nickname,
      suggestion_count: Number(row.suggestion_count ?? 1),
    }));
  } catch {
    return [];
  }
}
