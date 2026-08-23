import { requireSupabase } from '../lib/supabase.js';

export async function getSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function ensureDemoSession(displayName = 'Dive Demo User') {
  const client = requireSupabase();
  const current = await getSession();
  if (current) return current;

  const { data, error } = await client.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data.session;
}

export async function signInWithOtp(email) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}
