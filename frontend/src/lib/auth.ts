import { getSupabaseClient } from "@/lib/supabase";

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}
