import { Router, type IRouter } from "express";

const router: IRouter = Router();
const MARBLE_API_BASE_URL = "https://api.worldlabs.ai";

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

  if (!dataBase64) {
    throw new Error(`The file "${name}" is missing its base64 content.`);
  }
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
  if (files.length === 0) {
    return {
      type: "text",
      text_prompt: prompt,
    };
  }

  if (files.length === 1) {
    return {
      type: "image",
      image_prompt: fileToContent(files[0]),
      ...(prompt ? { text_prompt: prompt } : {}),
    };
  }

  return {
    type: "multi-image",
    multi_image_prompt: files.map((file) => ({
      content: fileToContent(file),
    })),
    ...(prompt ? { text_prompt: prompt } : {}),
  };
}

async function marbleFetch(pathname: string, init: RequestInit = {}) {
  const apiKey = requireMarbleApiKey();
  const response = await fetch(`${MARBLE_API_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": apiKey,
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

router.post("/marble/worlds", async (req, res) => {
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
    if (files.length > 8) {
      return res.status(400).json({ error: "Attach no more than eight images." });
    }

    let worldPrompt = buildWorldPrompt(prompt ?? "", files);

    if (mode === "edit" && worldId) {
      const existing = await marbleFetch(`/marble/v1/worlds/${encodeURIComponent(worldId)}`);
      if (!existing.response.ok) {
        return res.status(existing.response.status).json({
          error: "Marble could not load the world to edit.",
          details: existing.body,
        });
      }

      const existingWorld = isRecord(existing.body) ? existing.body : {};
      const existingPrompt = isRecord(existingWorld.world_prompt)
        ? existingWorld.world_prompt
        : undefined;

      if (files.length === 0 && existingPrompt) {
        const existingText = asNonEmptyString(existingPrompt.text_prompt);
        worldPrompt = {
          ...existingPrompt,
          ...(prompt
            ? {
                text_prompt: [existingText, `Requested changes: ${prompt}`]
                  .filter(Boolean)
                  .join("\n\n"),
              }
            : {}),
        };
      } else if (prompt) {
        worldPrompt = {
          ...worldPrompt,
          text_prompt: `Revision of Marble world ${worldId}: ${prompt}`,
        };
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

    return res.status(202).json({
      operationId: getOperationId(generated.body),
      mode,
      worldId,
      response: generated.body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Marble request error.";
    const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

router.get("/marble/operations/:operationId", async (req, res) => {
  try {
    const operationId = asNonEmptyString(req.params.operationId);
    if (!operationId) return res.status(400).json({ error: "operationId is required." });

    const operation = await marbleFetch(`/marble/v1/operations/${encodeURIComponent(operationId)}`);
    if (!operation.response.ok) {
      return res.status(operation.response.status).json({
        error: "Marble could not retrieve this operation.",
        details: operation.body,
      });
    }

    return res.json(operation.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Marble operation error.";
    const status = error instanceof Error && error.name === "ConfigurationError" ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

export default router;