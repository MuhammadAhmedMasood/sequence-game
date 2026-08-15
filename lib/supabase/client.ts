import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// localStorage, not sessionStorage: identity has to survive a closed tab,
// a crashed browser, or a bad connection dropping and coming back, or a
// disconnected player could never get back into their own seat (RLS ties
// hand access to this session's auth.uid()). The tradeoff is that two
// tabs in the *same* browser now share one identity — for testing two
// players locally, use two separate browser profiles/contexts instead.
// The typeof window guard matters because this module can be evaluated
// during Next's server-side render pass even though it's only ever
// *used* from client components; omitting the key (rather than passing
// `storage: undefined`) lets supabase-js fall back to its own safe
// in-memory default on the server.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(typeof window !== "undefined" ? { storage: window.localStorage } : {}),
    persistSession: true,
    autoRefreshToken: true,
  },
});
