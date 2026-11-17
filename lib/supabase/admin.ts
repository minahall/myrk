import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

export function adminSupabase(): SupabaseClient {
  if (client) return client;
  if (!url || !serviceKey) {
    throw new Error(
      "Admin Supabase env missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}
