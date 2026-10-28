import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  assertWorldStorageReady,
  getSupabaseAdmin,
  getWorldAssetsBucket,
  supabaseConfigurationError,
  worldStorageErrorMessage,
} from "../lib/supabase";
import { logger } from "../lib/logger";
import { parseWorldCoverage, worldCoverageInstructions } from "../lib/world-coverage";
import { worldGeometryInstructions } from "../lib/world-geometry";

const router: IRouter = Router();
const MARBLE_API_BASE_URL = "https://api.worldlabs.ai";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 240;

type MarbleFileInput = {
  name?: unknown;
  type?: unknown;
  dataBase64?: unknown;
  note?: unknown;
};

type MarbleWorldRequest = {
  mode?: unknown;
  prompt?: unknown;
  displayName?: unknown;
  model?: unknown;
  worldId?: unknown;
  files?: unknown;
  photoRelationship?: unknown;
  coverageDegrees?: unknown;
};

type PhotoRelationship = "same-room" | "same-home" | "uncertain";
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

function buildWorldPrompt(
  prompt: string,
  files: MarbleFileInput[],
  photoRelationship: PhotoRelationship,
): MarblePrompt {
  if (files.length === 0) {
    return {
      type: "text",
      text_prompt: prompt.trim(),
    };
  }
  const rememberedPhotoNotes = files.flatMap((file, index) => {
    const note = asNonEmptyString(file.note)?.slice(0, 240);
    return note ? [`Photo ${index + 1}: ${note}`] : [];
  });
  const relationshipInstructions: Record<PhotoRelationship, string> = {
    "same-room": "CRITICAL: The user confirms these photos show the same physical room. They are multiple views of ONE room, not separate spaces. Reconstruct one coherent room. Match only genuinely shared landmarks; never duplicate an object or force conflicting details into alignment.",
    "same-home": "The user says these photos are from the same home, but they may show different rooms or times. Create one coherent room using the requested room and relevant shared house character; if no target room is named, choose one plausible room without blending distinct layouts. Do not treat the photos as consecutive camera views or merge separate rooms' walls and openings.",
    uncertain: "These may be incomplete archival photos and are not guaranteed to show the same room, angle, or time. Create one coherent room using only clear shared period and style cues. Do not claim the images are views of the same room, force a camera path, or combine conflicting room layouts; keep uncertain geometry simple.",
  };
  const roomAccuracyInstructions = [
    "Automatic memory-photo accuracy instructions: These are the photos the user has available; do not ask for or assume new matching views.",
    files.length > 1
      ? relationshipInstructions[photoRelationship]
      : "Use this single archival photo as evidence. Preserve visible room details; a photo cannot reveal unseen walls, objects, or layout.",
    files.length > 1
      ? "RECONCILE THE PHOTOS AS EVIDENCE OF ONE SCENE BEFORE BUILDING GEOMETRY. Compare corners, wall edges, windows, doors, fixed features, furniture, and repeated patterns. When a feature is visibly shared, align both views to that SAME feature and represent it ONCE in the 3D room. NEVER assign one complete room or separate wall to each image. NEVER duplicate an object just because it appears in multiple photos. Treat similar-looking objects as identical only when surrounding positions or details confirm the match."
      : "",
    files.length > 1
      ? "Room proportions, connected walls, openings, and object positions MUST remain spatially consistent across all photos. If overlap or position cannot be established from the images and notes, do NOT claim the views align and do NOT invent a connecting layout; keep unsupported geometry plain."
      : "",
    "Preserve the visible house's apparent period, architecture, proportions, openings, object count, relative placement, colors, materials, and signs of age. Do not modernize or invent a date. Preserve fine texture only where visible.",
    "Where no photo or memory note reveals a surface, keep it simple and neutral rather than inventing distinctive architecture or decor. Conservative continuation of adjacent materials and geometry is allowed, but do not present guessed details as known facts.",
    photoRelationship === "same-room" && files.length > 1
      ? "Reconstruct exactly one shared room, not one room per photograph. Different camera positions, including opposite corners, are viewpoints within that room, not neighboring rooms to connect with a doorway or corridor. Plain gray image borders are preprocessing padding, not scene geometry."
      : "",
    "Only change a visible feature when the user's written request explicitly asks for that specific change; preserve all other observed details.",
    rememberedPhotoNotes.length > 0
      ? `Photo-specific remembered context:\n${rememberedPhotoNotes.join("\n")}`
      : "",
  ].join(" ");
  const textPrompt = [roomAccuracyInstructions, prompt.trim()]
    .filter(Boolean)
    .join("\n\n");

  if (files.length === 1) {
    return {
      type: "image",
      image_prompt: fileToContent(files[0]),
      text_prompt: textPrompt,
    };
  }
  return {
    type: "multi-image",
    reconstruct_images: photoRelationship === "same-room",
    multi_image_prompt: files.map((file) => ({ content: fileToContent(file) })),
    text_prompt: textPrompt,
  };
}

function appendFinalWorldGeometryInstructions(worldPrompt: MarblePrompt): MarblePrompt {
  const existingText = asNonEmptyString(worldPrompt.text_prompt) ?? "";
  const legacyGeometryStart = "FINAL memory-photo fidelity and negative instructions:";
  const legacyGeometryIndex = existingText.indexOf(legacyGeometryStart);
  const promptWithoutLegacyGeometry = (
    legacyGeometryIndex >= 0
      ? existingText.slice(0, legacyGeometryIndex)
      : existingText
  ).trim();
  const promptWithoutCurrentGeometry = promptWithoutLegacyGeometry
    .split(worldGeometryInstructions)
    .join("\n")
    .trim();

  return {
    ...worldPrompt,
    text_prompt: [promptWithoutCurrentGeometry, worldGeometryInstructions]
      .filter(Boolean)
      .join("\n\n"),
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
  const result = await getSupabaseAdmin()
    .from("evoke_worlds")
    .update({ status: "failed", error_message: message })
    .eq("id", worldRecordId);
  if (result.error) throw result.error;
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
        marble_world: world,
        assets,
        error_message: null,
      })
      .eq("id", worldRecordId)
      .eq("owner_id", ownerId);
    if (result.error) throw result.error;
  } catch (error) {
    const message = error instanceof Error ? error.message : "World generation failed.";
    logger.error({ err: error, operationId, worldRecordId }, "Could not save generated Marble world");
    try {
      await markGenerationFailed(worldRecordId, message);
    } catch (updateError) {
      logger.error({ err: updateError, operationId, worldRecordId }, "Could not mark Marble generation as failed");
    }
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
    const photoRelationship: PhotoRelationship = input.photoRelationship === "same-room"
      ? "same-room"
      : input.photoRelationship === "same-home"
        ? "same-home"
        : "uncertain";
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
    if (files.length > 4 && photoRelationship !== "same-room") {
      return res.status(400).json({
        error: "Marble accepts up to four reference images, or eight when all photos show the same room and reconstruction mode is enabled.",
      });
    }
    const coverageDegrees = parseWorldCoverage(input.coverageDegrees);
    if (mode === "create" && coverageDegrees === null) {
      return res.status(400).json({ error: "coverageDegrees must be a whole number from 180 to 360." });
    }

    // Check both persistent destinations before starting a chargeable Marble operation.
    await assertWorldStorageReady();

    let worldPrompt = buildWorldPrompt(prompt ?? "", files, photoRelationship);
    if (mode === "create") {
      worldPrompt.text_prompt = [
        asNonEmptyString(worldPrompt.text_prompt),
        worldCoverageInstructions(coverageDegrees!),
      ].filter(Boolean).join("\n\n");
    }
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
        const roomInstructions = asNonEmptyString(worldPrompt.text_prompt);
        worldPrompt = {
          ...worldPrompt,
          text_prompt: [
            roomInstructions,
            `Revision of Marble world ${worldId}: ${prompt}`,
          ].filter(Boolean).join("\n\n"),
        };
      }
    }

    // Apply these authoritative rules after all create/edit prompt handling so every
    // request that reaches Marble's world-generation endpoint receives the latest version.
    worldPrompt = appendFinalWorldGeometryInstructions(worldPrompt);

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
    if (inserted.error || !inserted.data) {
      req.log.error({ err: inserted.error, operationId }, "Marble started but Evoke could not save its operation");
      const reason = worldStorageErrorMessage(inserted.error, "Could not create the Evoke world record.");
      return res.status(503).json({
        error: `Marble started this world, but Evoke could not save it. Do not generate it again. ${reason}`,
        operationId,
      });
    }

    void persistCompletedWorld(inserted.data.id as string, req.evokeUser!.id, operationId, displayName, model);
    return res.status(202).json({
      operationId,
      worldId: inserted.data.id,
      status: "generating",
    });
  } catch (error) {
    req.log.error({ err: error }, "Could not start Evoke world generation");
    const status = error instanceof Error && error.name === "ConfigurationError"
      ? 503
      : supabaseConfigurationError(error) ? 503 : 500;
    return res.status(status).json({
      error: worldStorageErrorMessage(error, "Could not start world generation."),
    });
  }
});

export default router;