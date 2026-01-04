// frontend/src/lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (for client components like /auth/login)
 * Uses the same env vars as supabaseServer.ts
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
