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