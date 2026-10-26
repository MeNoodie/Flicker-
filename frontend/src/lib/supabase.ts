/**
 * lib/supabase.ts
 * Supabase browser client for use in Client Components.
 * Uses @supabase/ssr for proper cookie-based auth in Next.js App Router.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes("your-project-ref")) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local."
    );
  }

  return createBrowserClient(
    url,
    anonKey
  );
}

// Singleton for convenience in client components
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_client) _client = createClient();
  return _client;
}
