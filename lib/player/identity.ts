import { supabase } from "@/lib/supabase/client";

// Ensures the current browser tab has an anonymous Supabase auth session
// (signing in if needed) and returns that session's auth user id. This id
// is only ever used to prove "which players row is mine" (via
// players.auth_user_id) and for Postgres RLS's auth.uid() checks — the
// app-level PlayerId used throughout lib/game is the players table's own
// row id, not this auth id.
export async function ensureAuthUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to sign in anonymously");
  }
  return data.user.id;
}
