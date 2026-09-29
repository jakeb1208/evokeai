import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let adminClient: SupabaseClient | undefined;

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured on the API server.`);
  return value;
}

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      requireEnvironment("SUPABASE_URL"),
      requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return adminClient;
}

export function getWorldAssetsBucket() {
  return process.env["SUPABASE_STORAGE_BUCKET"]?.trim() || "world-assets";
}

export function worldStorageErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
  if (code === "PGRST205" || code === "42P01") {
    return "The Evoke worlds table is missing in Supabase. Run docs/supabase-worlds.sql in your Supabase SQL editor.";
  }
  if (code === "42501") {
    return "Evoke cannot access its Supabase worlds table. Check the API server's SUPABASE_SERVICE_ROLE_KEY.";
  }
  return typeof code === "string" ? `${fallback} (Supabase error ${code}).` : fallback;
}

export async function assertWorldStorageReady() {
  const client = getSupabaseAdmin();
  const { error: tableError } = await client
    .from("evoke_worlds")
    .select("id,owner_id,operation_id,status,display_name,model,world_prompt,marble_world,assets,error_message")
    .limit(1);
  if (tableError) {
    throw new Error(worldStorageErrorMessage(tableError, "Evoke cannot access its Supabase worlds table."));
  }

  const bucket = getWorldAssetsBucket();
  const { data, error: bucketError } = await client.storage.getBucket(bucket);
  if (bucketError || !data) {
    throw new Error(
      `The ${bucket} Supabase Storage bucket is unavailable. Check the bucket and the API server's SUPABASE_SERVICE_ROLE_KEY.`,
    );
  }
}

export async function authenticateAccessToken(accessToken: string): Promise<User> {
  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("Your Supabase session is invalid or has expired.");
  }
  return user;
}

export function supabaseConfigurationError(error: unknown) {
  return (
    error instanceof Error &&
    /SUPABASE_(URL|SERVICE_ROLE_KEY)|supabase/i.test(error.message)
  );
}