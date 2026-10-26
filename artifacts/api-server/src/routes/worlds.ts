import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSupabaseAdmin, getWorldAssetsBucket, supabaseConfigurationError, worldStorageErrorMessage } from "../lib/supabase";
import { SaveWorldFeedbackBody, SaveWorldFeedbackParams } from "@workspace/api-zod";

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

const ratingKeys = ["happiness", "good_memories", "visual_memories", "music_memories", "return_interest"] as const;
type Ratings = Record<(typeof ratingKeys)[number], number>;

function toFeedback(record: Ratings) {
  return {
    ...Object.fromEntries(ratingKeys.map((key) => [key, record[key]])),
    average: ratingKeys.reduce((total, key) => total + record[key], 0) / ratingKeys.length,
  };
}

function feedbackStorageError(error: unknown, fallback: string) {
  const code = isRecord(error) ? error.code : undefined;
  if (code === "PGRST205" || code === "42P01") {
    return "World feedback is not installed yet. Run docs/supabase-world-feedback.sql in your Supabase SQL editor.";
  }
  return worldStorageErrorMessage(error, fallback);
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
    const feedbackResult = worlds.length
      ? await getSupabaseAdmin()
        .from("evoke_world_feedback")
        .select("world_id,happiness,good_memories,visual_memories,music_memories,return_interest")
        .eq("owner_id", req.evokeUser!.id)
        .in("world_id", worlds.map((world) => world.id))
      : { data: [], error: null };
    const feedbackUnavailable = feedbackResult.error !== null
      && isRecord(feedbackResult.error)
      && (feedbackResult.error.code === "PGRST205" || feedbackResult.error.code === "42P01");
    if (feedbackResult.error && !feedbackUnavailable) throw feedbackResult.error;
    const feedbackByWorld = new Map(
      (feedbackResult.data ?? []).map((entry) => [entry.world_id, toFeedback(entry as Ratings)]),
    );
    return res.json({
      feedbackUnavailable,
      worlds: await Promise.all(worlds.map(async (world) => ({
        ...await toWorldResponse(world),
        feedback: feedbackByWorld.get(world.id) ?? null,
      }))),
    });
  } catch (error) {
    req.log.error({ err: error }, "Could not list Evoke worlds");
    const status = supabaseConfigurationError(error) ? 503 : 500;
    return res.status(status).json({
      error: feedbackStorageError(error, "Could not load your worlds."),
    });
  }
});

router.put("/worlds/:id/feedback", requireAuth, async (req, res) => {
  const params = SaveWorldFeedbackParams.safeParse({ id: req.params.id });
  const parsed = SaveWorldFeedbackBody.safeParse(req.body);
  if (!params.success || !parsed.success ||
      !isRecord(req.body) || Object.keys(req.body).some((key) => !ratingKeys.includes(key as typeof ratingKeys[number]))) {
    return res.status(400).json({ error: "Rate every question from 1 to 3 stars." });
  }
  try {
    const owned = await getSupabaseAdmin()
      .from("evoke_worlds")
      .select("id")
      .eq("id", params.data.id)
      .eq("owner_id", req.evokeUser!.id)
      .eq("status", "ready")
      .maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data) return res.status(404).json({ error: "Ready world not found." });
    const result = await getSupabaseAdmin()
      .from("evoke_world_feedback")
      .upsert({
        owner_id: req.evokeUser!.id,
        world_id: owned.data.id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_id,world_id" })
      .select("happiness,good_memories,visual_memories,music_memories,return_interest")
      .single();
    if (result.error || !result.data) throw result.error ?? new Error("Could not save feedback.");
    return res.json({ feedback: toFeedback(result.data as Ratings) });
  } catch (error) {
    req.log.error({ err: error }, "Could not save Evoke world feedback");
    return res.status(supabaseConfigurationError(error) ? 503 : 500).json({
      error: feedbackStorageError(error, "Could not save feedback."),
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