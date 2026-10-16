import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Vem anropar: en annan edge-funktion (service role-nyckel) eller en inloggad användare.
export type Caller = { kind: "service" } | { kind: "user"; userId: string };

export async function getCaller(req: Request): Promise<Caller | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return { kind: "service" };
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { kind: "user", userId: data.user.id };
}

// Får anroparen köra AI-jobb på samlingen? Ägare, användare som samlingen delats med, eller admin.
// deno-lint-ignore no-explicit-any
export async function canUseCollection(admin: any, caller: Caller, collectionId: string): Promise<boolean> {
  if (caller.kind === "service") return true;
  const { data: collection } = await admin.from("collections").select("user_id").eq("id", collectionId).maybeSingle();
  if (!collection) return false;
  if (collection.user_id === caller.userId) return true;
  const { data: share } = await admin.from("collection_shares").select("id")
    .eq("collection_id", collectionId).eq("shared_with_user_id", caller.userId).maybeSingle();
  if (share) return true;
  const { data: role } = await admin.from("user_roles").select("role")
    .eq("user_id", caller.userId).eq("role", "admin").maybeSingle();
  return !!role;
}

export function errorResponse(status: number, message: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
