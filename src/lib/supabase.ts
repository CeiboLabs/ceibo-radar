import { createClient } from "@supabase/supabase-js";

// Server-side only — never exposed to the client bundle
export const supabase = createClient(
  process.env.SUPABASE_URL ?? "http://localhost",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder",
  { auth: { persistSession: false } }
);
