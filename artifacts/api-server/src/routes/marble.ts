import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  getSupabaseAdmin,
  getWorldAssetsBucket,
  supabaseConfigurationError,
} from "../lib/supabase";

const router: IRouter = Router();
const MARBLE_API_BASE_URL = "https://api.worldlabs.ai";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 240;

type MarbleFileInput = {
  name?: unknown;
  type?: unknown;
  dataBase64?: unknown;
};

type MarbleWorldRequest = {
  mode?: unknown;
  prompt?: unknown;
  displayName?: unknown;
  model?: unknown;
  worldId?: unknown;
  files?: unknown;
};

type MarblePrompt = Record<string, unknown>;
type AssetCandidate = {
  kind: string;
  format: string;
  quality?: string;
  url: string;
  fileName: string;
  contentType: string;
};

function requireMarbleApiKey() {
  const apiKey = process.env["MARBLE_API_KEY"];
  if (!apiKey) {
    const error = new Error(
      "MARBLE_API_KEY is not configured. Add it as a Railway secret before using Marble.",
    );
    error.name = "ConfigurationError";
    throw error;
  }
  return apiKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extensionForFile(name: string, type: string) {
  const nameExtension = name.split(".").pop()?.toLowerCase();
  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) return nameExtension;
  const typeExtension = type.split("/").pop()?.toLowerCase();
  return typeExtension && /^[a-z0-9]+$/.test(typeExtension) ? typeExtension : undefined;
}

function fileToContent(file: MarbleFileInput) {
  const name = asNonEmptyString(file.name) ?? "upload";
  const type = asNonEmptyString(file.type) ?? "image/jpeg";
  const dataBase64 = asNonEmptyString(file.dataBase64);

  if (!dataBase64) throw new Error(`The file "${name}" is missing its base64 content.`);
  if (!type.startsWith("image/")) {
    throw new Error(`"${name}" is not an image. Marble image prompts currently accept images here.`);
  }

  return {
    source: "data_base64",
    data_base64: dataBase64,
    extension: extensionForFile(name, type),
  };
}

function buildWorldPrompt(prompt: string, files: MarbleFileInput[]): MarblePrompt {
  if (files.length === 0) return { type: "text", text_prompt: prompt };
  if (files.length === 1) {
    return {
      type: "image",
      image_prompt: fileToContent(files[0]),
      ...(prompt ? { text_prompt: prompt } : {}),
    };
  }
  return {
    type: "multi-image",
    multi_image_prompt: files.map((file) => ({ content: fileToContent(file) })),
    ...(prompt ? { text_prompt: prompt } : {}),
  };
}

async function marbleFetch(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${MARBLE_API_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": requireMarbleApiKey(),
      ...(init.headers ?? {}),
    },
  });
  const responseText = await response.text();
  let body: unknown = null;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch {
    body = responseText;
  }
  return { response, body };
}

function getOperationId(body: unknown) {
  if (!isRecord(body)) return undefined;
  return asNonEmptyString(body.operation_id) ?? asNonEmptyString(body.operationId);
}

function getWorldFromOperation(body: unknown) {
  if (!isRecord(body)) return undefined;
  return isRecord(body.response) ? body.response : undefined;
}

function getStringAt(value: unknown, ...keys: string[]) {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return asNonEmptyString(current);
}

function addAsset(
  candidates: AssetCandidate[],
  asset: Omit<AssetCandidate, "url"> & { url?: string },
) {
  if (!asset.url || candidates.some((candidate) => candidate.url === asset.url)) return;
  candidates.push({ ...asset, url: asset.url });
}

function collectAssetCandidates(world: Record<string, unknown>): AssetCandidate[] {
  const candidates: AssetCandidate[] = [];
  const assets = isRecord(world.assets) ? world.assets : {};

  const spzUrls = isRecord(assets.splats) && isRecord(assets.splats.spz_urls)
    ? assets.splats.spz_urls
    : {};
  for (const [quality, value] of Object.entries(spzUrls)) {
    addAsset(candidates, {
      kind: "splat",
      format: "spz",
      quality,
      url: asNonEmptyString(value),
      fileName: `splats-${quality}.spz`,
      contentType: "application/octet-stream",
    });
  }

  const mesh = isRecord(assets.mesh) ? assets.mesh : {};
  for (const [name, kind] of [
    ["collider_mesh_url", "collider"],
    ["full_res_mesh_url", "mesh"],
    ["hq_mesh_url", "mesh-hq"],
  ] as const) {
    addAsset(candidates, {
      kind,
      format: "glb",
      url: asNonEmptyString(mesh[name]),
      fileName: `${kind}.glb`,
      contentType: "model/gltf-binary",
    });
  }

  addAsset(candidates, {
    kind: "panorama",
    format: "jpg",
    url: getStringAt(assets, "imagery", "pano_url"),
    fileName: "panorama.jpg",
    contentType: "image/jpeg",
  });
  addAsset(candidates, {
    kind: "thumbnail",
    format: "jpg",
    url: asNonEmptyString(assets.thumbnail_url),
    fileName: "thumbnail.jpg",
    contentType: "image/jpeg",
  });

  return candidates;
}

function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "asset";
}

async function downloadAndStoreAssets(
  ownerId: string,
  marbleWorldId: string,
  world: Record<string, unknown>,
) {
  const bucket = getWorldAssetsBucket();
  const client = getSupabaseAdmin();
  const candidates = collectAssetCandidates(world);
  const stored = [];

  for (const candidate of candidates) {
    const response = await fetch(candidate.url);
    if (!response.ok) throw new Error(`Marble asset download failed (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const storagePath = `${ownerId}/${marbleWorldId}/${safeFileName(candidate.fileName)}`;
    const upload = await client.storage.from(bucket).upload(storagePath, bytes, {
      contentType: candidate.contentType,
      upsert: true,
    });
    if (upload.error) throw upload.error;
    stored.push({
      kind: candidate.kind,
      format: candidate.format,
      ...(candidate.quality ? { quality: candidate.quality } : {}),
      storage_path: storagePath,
      content_type: candidate.contentType,
      byte_size: bytes.byteLength,
    });
  }

  if (!stored.some((asset) => asset.kind === "splat")) {
    throw new Error("Marble completed without an SPZ Gaussian-splat asset.");
  }
  return stored;
}

async function waitForMarbleWorld(operationId: string) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const operation = await marbleFetch(
      `/marble/v1/operations/${encodeURIComponent(operationId)}`,
    );
    if (!operation.response.ok) {
      throw new Error(`Marble could not retrieve the generation operation (${operation.response.status}).`);
    }
    const body = isRecord(operation.body) ? operation.body : {};
    if (body.done === true) {
      if (isRecord(body.error)) {
        throw new Error(
          asNonEmptyString(body.error.message) ?? "Marble reported a generation error.",
        );
      }
      const responseWorld = getWorldFromOperation(body);
      const marbleWorldId = getStringAt(responseWorld, "world_id");
      if (!marbleWorldId) throw new Error("Marble completed without a world ID.");

      const fetchedWorld = await marbleFetch(
        `/marble/v1/worlds/${encodeURIComponent(marbleWorldId)}`,
      );
      if (!fetchedWorld.response.ok || !isRecord(fetchedWorld.body)) {
        throw new Error("Marble completed, but the saved world metadata could not be retrieved.");
      }
      return { marbleWorldId, world: fetchedWorld.body };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("Marble generation timed out. The operation remains available in Marble.");
}

async function markGenerationFailed(worldRecordId: string, message: string) {
  await getSupabaseAdmin()
    .from("evoke_worlds")
    .update({ status: "failed", error_message: message })
    .eq("id", worldRecordId);
}

async function persistCompletedWorld(
  worldRecordId: string,
  ownerId: string,
  operationId: string,
  displayName: string,
  model: string,
) {
  try {
    const completed = await waitForMarbleWorld(operationId);
    const world = completed.world;
    const assets = await downloadAndStoreAssets(ownerId, completed.marbleWorldId, world);
    const result = await getSupabaseAdmin()
      .from("evoke_worlds")
      .update({
        status: "ready",
        marble_world_id: completed.marbleWorldId,
        display_name: getStringAt(world, "display_name") ?? displayName,
        model: getStringAt(world, "model") ?? model,
        world_prompt: isRecord(world.world_prompt) ? world.world_prompt : null,
        marble_world: world,
        assets,
        error_message: null,
      })
      .eq("id", worldRecordId)
      .eq("owner_id", ownerId);
    if (result.error) throw result.error;
  } catch (error) {
    const message = error instanceof Error ? error.message : "World generation failed.";
    await markGenerationFailed(worldRecordId, message);
  }
}

router.post("/marble/worlds", requireAuth, async (req, res) => {
  try {
    const input = req.body as MarbleWorldRequest;
    const mode = input.mode === "edit" ? "edit" : input.mode === "create" ? "create" : undefined;
    const prompt = asNonEmptyString(input.prompt);
    const displayName = asNonEmptyString(input.displayName) ?? "Evoke world";
    const model = asNonEmptyString(input.model) ?? "marble-1.1";
    const worldId = asNonEmptyString(input.worldId);
    const files = Array.isArray(input.files)
      ? input.files.filter(isRecord) as MarbleFileInput[]
      : [];

    if (!mode) return res.status(400).json({ error: "mode must be create or edit." });
    if (!prompt && files.length === 0) {
      return res.status(400).json({ error: "Add a prompt or at least one image." });
    }
    if (mode === "edit" && !worldId) {
      return res.status(400).json({ error: "worldId is required when editing a world." });
    }
    if (files.length > 8) return res.status(400).json({ error: "Attach no more than eight images." });

    let worldPrompt = buildWorldPrompt(prompt ?? "", files);
    if (mode === "edit" && worldId) {
      const ownedWorld = await getSupabaseAdmin()
        .from("evoke_worlds")
        .select("marble_world")
        .eq("owner_id", req.evokeUser!.id)
        .eq("marble_world_id", worldId)
        .maybeSingle();
      if (ownedWorld.error) throw ownedWorld.error;
      if (!ownedWorld.data) {
        return res.status(403).json({ error: "Edit a world saved in your Evoke account." });
      }

      const existingWorld = isRecord(ownedWorld.data.marble_world)
        ? ownedWorld.data.marble_world
        : {};
      const existingPrompt = isRecord(existingWorld.world_prompt)
        ? existingWorld.world_prompt
        : undefined;
      if (files.length === 0 && existingPrompt) {
        const existingText = asNonEmptyString(existingPrompt.text_prompt);
        worldPrompt = {
          ...existingPrompt,
          ...(prompt ? {
            text_prompt: [existingText, `Requested changes: ${prompt}`]
              .filter(Boolean)
              .join("\n\n"),
          } : {}),
        };
      } else if (prompt) {
        worldPrompt = { ...worldPrompt, text_prompt: `Revision of Marble world ${worldId}: ${prompt}` };
      }
    }

    const generated = await marbleFetch("/marble/v1/worlds:generate", {
      method: "POST",
      body: JSON.stringify({
        display_name: displayName,
        model,
        world_prompt: worldPrompt,
        permission: { public: false },
      }),
    });
    if (!generated.response.ok) {
      return res.status(generated.response.status).json({
        error: "Marble could not start world generation.",
        details: generated.body,
      });
    }

    const operationId = getOperationId(generated.body);
    if (!operationId) return res.status(502).json({ error: "Marble did not return an operation ID." });

    const inserted = await getSupabaseAdmin()
      .from("evoke_worlds")
      .insert({
        owner_id: req.evokeUser!.id,
        operation_id: operationId,
        status: "generating",
        display_name: displayName,
        model,
        world_prompt: worldPrompt,
        marble_world: null,
        assets: [],
        error_message: null,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("Could not create the Evoke world record.");

    void persistCompletedWorld(inserted.data.id as string, req.evokeUser!.id, operationId, displayName, model);
    return res.status(202).json({
      operationId,
      worldId: inserted.data.id,
      status: "generating",
    });
  } catch (error) {
    const status = error instanceof Error && error.name === "ConfigurationError"
      ? 503
      : supabaseConfigurationError(error) ? 503 : 500;
    return res.status(status).json({
      error: error instanceof Error ? error.message : "Unexpected world generation error.",
    });
  }
});

export default router;