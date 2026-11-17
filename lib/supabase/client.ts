import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

export type NodeRow = { id: string; public_key: JsonWebKey; status: string };
export type JournalistRow = { id: string; name: string; public_key: JsonWebKey };

function sbError(where: string, error: { message?: string; code?: string; hint?: string; details?: string }): Error {
  const parts = [
    `${where}: ${error.message || "unknown error"}`,
    error.code ? `code=${error.code}` : "",
    error.hint ? `hint=${error.hint}` : "",
    error.details ? `details=${error.details}` : "",
  ].filter(Boolean);
  return new Error(parts.join(" | "));
}

export async function fetchActiveNodes(): Promise<NodeRow[]> {
  const { data, error } = await supabase()
    .from("nodes")
    .select("id,public_key,status")
    .eq("status", "active")
    .order("id");
  if (error) throw sbError("fetchActiveNodes", error);
  return (data as NodeRow[]) ?? [];
}

export async function fetchJournalist(): Promise<JournalistRow> {
  const { data, error } = await supabase()
    .from("journalists")
    .select("id,name,public_key")
    .limit(1)
    .single();
  if (error) throw sbError("fetchJournalist", error);
  return data as JournalistRow;
}
