import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateQuestPanoramaUploadParams, CreateQuestPanoramaUploadResponse,
  SaveQuestPanoramaParams, SaveQuestPanoramaBody, SaveQuestPanoramaResponse,
  ResetQuestPanoramaParams, ResetQuestPanoramaResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getSupabaseAdmin, getWorldAssetsBucket } from "../lib/supabase";
import { isQuestPanorama, MAX_QUEST_PANORAMA_BYTES, QUEST_PANORAMA_QUALITY, validateQuestJpeg } from "../lib/quest-panorama";

const router: IRouter = Router();
const route = "/worlds/:id/quest-panorama";

async function ownedWorld(ownerId: string, id: string) {
  const result = await getSupabaseAdmin().from("evoke_worlds")
    .select("id,assets,updated_at").eq("id", id).eq("owner_id", ownerId)
    .eq("status", "ready").maybeSingle();
  if (result.error) throw result.error;
  return result.data as { id: string; assets: unknown[]; updated_at: string } | null;
}

function uploadPath(ownerId: string, worldId: string, uploadId: string) {
  return `${ownerId}/${worldId}/quest-viewpoints/${uploadId}.jpg`;
}

function previousPaths(assets: unknown[], ownerId: string, worldId: string) {
  const prefix = `${ownerId}/${worldId}/quest-viewpoints/`;
  return assets.filter(isQuestPanorama).map((asset) => asset.storage_path)
    .filter((path): path is string => typeof path === "string" && path.startsWith(prefix));
}

async function cleanupImages(paths: string[], warn: () => void) {
  if (!paths.length) return;
  try {
    const result = await getSupabaseAdmin().storage.from(getWorldAssetsBucket()).remove(paths);
    if (result.error) warn();
  } catch { warn(); }
}

router.post(`${route}/upload`, requireAuth, async (req, res): Promise<void> => {
  const params = CreateQuestPanoramaUploadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid world ID." }); return; }
  try {
    const ownerId = req.evokeUser!.id;
    const world = await ownedWorld(ownerId, params.data.id);
    if (!world) { res.status(404).json({ error: "Ready world not found." }); return; }
    const bucket = await getSupabaseAdmin().storage.getBucket(getWorldAssetsBucket());
    if (bucket.error || !bucket.data) throw bucket.error ?? new Error("Storage unavailable.");
    if (bucket.data.public !== false) {
      res.status(503).json({ error: "Quest panoramas require a private world-assets bucket. Public storage is not accepted." });
      return;
    }
    const uploadId = randomUUID();
    const result = await getSupabaseAdmin().storage.from(getWorldAssetsBucket())
      .createSignedUploadUrl(uploadPath(ownerId, world.id, uploadId), { upsert: false });
    if (result.error || !result.data) throw result.error ?? new Error("Upload unavailable.");
    res.json(CreateQuestPanoramaUploadResponse.parse({
      upload_id: uploadId, upload_url: result.data.signedUrl,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Could not prepare private Quest panorama upload");
    res.status(503).json({ error: "Could not prepare the Quest image upload. Check storage availability and retry." });
  }
});

router.put(route, requireAuth, async (req, res): Promise<void> => {
  const params = SaveQuestPanoramaParams.safeParse(req.params);
  const body = SaveQuestPanoramaBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid upload or viewpoint." }); return;
  }
  try {
    const ownerId = req.evokeUser!.id;
    const world = await ownedWorld(ownerId, params.data.id);
    if (!world) { res.status(404).json({ error: "Ready world not found." }); return; }
    const storage = getSupabaseAdmin().storage.from(getWorldAssetsBucket());
    const path = uploadPath(ownerId, world.id, body.data.upload_id);
    const info = await storage.info(path);
    if (info.error || !info.data) {
      res.status(404).json({ error: "Uploaded image not found. Capture and upload again." }); return;
    }
    const size = info.data.size;
    if (typeof size !== "number" || !Number.isFinite(size) || size < 16 ||
        size > MAX_QUEST_PANORAMA_BYTES || info.data.contentType !== "image/jpeg") {
      res.status(400).json({ error: "The Quest image must be a JPEG smaller than 8 MiB." }); return;
    }
    const download = await storage.download(path);
    if (download.error || !download.data) throw download.error ?? new Error("Upload unavailable.");
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    if (!validateQuestJpeg(bytes)) {
      res.status(400).json({ error: "Expected a complete 4096 × 2048 JPEG panorama." }); return;
    }
    const assets = Array.isArray(world.assets) ? world.assets : [];
    const asset = {
      kind: "panorama", format: "jpg", quality: QUEST_PANORAMA_QUALITY,
      storage_path: path, content_type: "image/jpeg", byte_size: bytes.length,
      width: 4096, height: 2048, viewpoint: body.data.viewpoint,
      captured_at: new Date().toISOString(),
    };
    // The original stays intact. Existing Quest clients select the first JPG panorama.
    const update = await getSupabaseAdmin().from("evoke_worlds").update({
      assets: [asset, ...assets.filter((item) => !isQuestPanorama(item))],
      updated_at: new Date().toISOString(),
    }).eq("id", world.id).eq("owner_id", ownerId).eq("status", "ready")
      .eq("updated_at", world.updated_at).select("id").maybeSingle();
    if (update.error) throw update.error;
    if (!update.data) {
      res.status(409).json({ error: "This world changed during capture. Reopen it before saving again." }); return;
    }
    const cleanup = previousPaths(assets, ownerId, world.id).filter((old) => old !== path);
    await cleanupImages(cleanup, () => req.log.warn("Saved Quest panorama; old image cleanup needs a retry"));
    res.json(SaveQuestPanoramaResponse.parse({ saved: true }));
  } catch (error) {
    req.log.error({ err: error }, "Could not save Quest panorama");
    res.status(503).json({ error: "Could not save the Quest viewpoint. Your original panorama is unchanged." });
  }
});

router.delete(route, requireAuth, async (req, res): Promise<void> => {
  const params = ResetQuestPanoramaParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid world ID." }); return; }
  try {
    const ownerId = req.evokeUser!.id;
    const world = await ownedWorld(ownerId, params.data.id);
    if (!world) { res.status(404).json({ error: "Ready world not found." }); return; }
    const assets = Array.isArray(world.assets) ? world.assets : [];
    const update = await getSupabaseAdmin().from("evoke_worlds").update({
      assets: assets.filter((asset) => !isQuestPanorama(asset)), updated_at: new Date().toISOString(),
    }).eq("id", world.id).eq("owner_id", ownerId).eq("status", "ready")
      .eq("updated_at", world.updated_at).select("id").maybeSingle();
    if (update.error) throw update.error;
    if (!update.data) {
      res.status(409).json({ error: "This world changed. Reopen it and try again." }); return;
    }
    const cleanup = previousPaths(assets, ownerId, world.id);
    await cleanupImages(cleanup, () => req.log.warn("Restored original Quest panorama; image cleanup needs a retry"));
    res.json(ResetQuestPanoramaResponse.parse({ saved: false }));
  } catch (error) {
    req.log.error({ err: error }, "Could not restore original Quest panorama");
    res.status(503).json({ error: "Could not restore the original panorama. Please retry." });
  }
});

export default router;
