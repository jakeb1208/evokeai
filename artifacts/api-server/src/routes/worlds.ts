import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSupabaseAdmin, getWorldAssetsBucket, supabaseConfigurationError, worldStorageErrorMessage } from "../lib/supabase";

const router: IRouter = Router();

type StoredWorld = {
  id: string;
  owner_id: string;
  operation_id: string | null;
  marble_world_id: string | null;
  status: string;
  display_name: string;
  model: string;
  world_prompt: unknown;
  marble_world: unknown;
  assets: StoredAsset[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type StoredAsset = {
  kind: string;
  format: string;
  quality?: string;
  storage_path: string;
  content_type: string;
  byte_size: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function toWorldResponse(world: StoredWorld) {
  const client = getSupabaseAdmin();
  const bucket = getWorldAssetsBucket();
  const assets = await Promise.all(
    (Array.isArray(world.assets) ? world.assets : []).map(async (asset) => {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(asset.storage_path, 60 * 60);
      if (error || !data?.signedUrl) {
        throw new Error(`Could not create a signed URL for ${asset.storage_path}.`);
      }
      return { ...asset, signed_url: data.signedUrl };
    }),
  );

  return {
    id: world.id,
    user_id: world.owner_id,
    operation_id: world.operation_id,
    marble_world_id: world.marble_world_id,
    status: world.status,
    display_name: world.display_name,
    model: world.model,
    world_prompt: world.world_prompt,
    marble_world: world.marble_world,
    assets,
    error_message: world.error_message,
    created_at: world.created_at,
    updated_at: world.updated_at,
  };
}

async function selectWorlds(ownerId: string, worldId?: string) {
  let query = getSupabaseAdmin()
    .from("evoke_worlds")
    .select("*")
    .eq("owner_id", ownerId);
  query = worldId ? query.eq("id", worldId) : query.order("created_at", { ascending: false });
  const result = await query;
  if (result.error) throw result.error;
  return (result.data ?? []) as StoredWorld[];
}

router.get("/worlds", requireAuth, async (req, res) => {
  try {
    const worlds = await selectWorlds(req.evokeUser!.id);
    return res.json({ worlds: await Promise.all(worlds.map(toWorldResponse)) });
  } catch (error) {
    req.log.error({ err: error }, "Could not list Evoke worlds");
    const status = supabaseConfigurationError(error) ? 503 : 500;
    return res.status(status).json({
      error: worldStorageErrorMessage(error, "Could not load your worlds."),
    });
  }
});

router.get("/worlds/:id", requireAuth, async (req, res) => {
  try {
    const worldId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const worlds = await selectWorlds(req.evokeUser!.id, worldId);
    if (worlds.length === 0) return res.status(404).json({ error: "World not found." });
    return res.json({ world: await toWorldResponse(worlds[0]) });
  } catch (error) {
    req.log.error({ err: error }, "Could not load Evoke world");
    const status = supabaseConfigurationError(error) ? 503 : 500;
    return res.status(status).json({
      error: worldStorageErrorMessage(error, "Could not load this world."),
    });
  }
});

router.get("/worlds/operations/:operationId", requireAuth, async (req, res) => {
  try {
    const result = await getSupabaseAdmin()
      .from("evoke_worlds")
      .select("id,status,error_message")
      .eq("owner_id", req.evokeUser!.id)
      .eq("operation_id", req.params.operationId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return res.status(404).json({ error: "Generation not found." });

    if (result.data.status === "ready") {
      const worlds = await selectWorlds(req.evokeUser!.id, result.data.id);
      if (worlds.length === 0) return res.status(404).json({ error: "Generation not found." });
      return res.json({ status: "ready", world: await toWorldResponse(worlds[0]) });
    }
    return res.json({
      status: result.data.status,
      worldId: result.data.id,
      error: result.data.error_message,
    });
  } catch (error) {
    const errorCode = isRecord(error) && typeof error.code === "string" ? error.code : undefined;
    if (errorCode === "57014") {
      req.log.warn({ err: error }, "Supabase timed out while checking Evoke world generation");
      res.setHeader("Retry-After", "5");
      return res.status(503).json({
        error: "Supabase timed out while checking this generation. Evoke will retry; this does not start or cancel a generation.",
      });
    }

    req.log.error({ err: error }, "Could not check Evoke world generation");
    const status = supabaseConfigurationError(error) ? 503 : 500;
    return res.status(status).json({
      error: worldStorageErrorMessage(error, "Could not check this generation."),
    });
  }
});

export default router;