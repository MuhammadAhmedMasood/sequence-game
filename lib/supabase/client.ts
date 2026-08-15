import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// sessionStorage, not localStorage: localStorage is shared across every
// tab of the same browser, which would silently make two tabs the same
// "player" — sessionStorage is per-tab, so each tab gets its own
// anonymous identity (see lib/player/identity.ts). The typeof window
// guard matters because this module can be evaluated during Next's
// server-side render pass even though it's only ever *used* from client
// components; omitting the key (rather than passing `storage: undefined`)
// lets supabase-js fall back to its own safe in-memory default on the
// server.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(typeof window !== "undefined" ? { storage: window.sessionStorage } : {}),
    persistSession: true,
    autoRefreshToken: true,
  },
});
