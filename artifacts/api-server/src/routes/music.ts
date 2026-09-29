import { randomUUID } from "node:crypto";
import express, { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSupabaseAdmin, supabaseConfigurationError } from "../lib/supabase";

const router: IRouter = Router();
const MUSIC_BUCKET = "evoke-music";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60;

type MusicTrack = {
  id: string;
  owner_id: string;
  name: string;
  storage_path: string;
  byte_size: number;
  created_at: string;
};

function supabaseErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return typeof error.code === "string" ? error.code : undefined;
  }
  return undefined;
}

function isMissingMusicSetup(error: unknown): boolean {
  const code = supabaseErrorCode(error);
  if (code === "PGRST205" || code === "42P01") return true;

  if (typeof error !== "object" || error === null) return false;
  const value = error as { code?: unknown; message?: unknown; statusCode?: unknown };
  return (
    typeof value.message === "string" &&
    /bucket.*not found|not found.*bucket/i.test(value.message) &&
    (value.statusCode === 404 || value.statusCode === "404" || value.code === "BucketNotFound")
  );
}

function storageSetupMessage() {
  return "The Evoke music storage is not set up. Run docs/supabase-music.sql in the Supabase SQL editor.";
}

function musicErrorStatus(error: unknown): number {
  return isMissingMusicSetup(error) || supabaseConfigurationError(error) ? 503 : 500;
}

function musicErrorMessage(error: unknown, fallback: string): string {
  if (isMissingMusicSetup(error)) return storageSetupMessage();
  if (supabaseConfigurationError(error) && error instanceof Error) return error.message;
  const code = supabaseErrorCode(error);
  return code ? `${fallback} (Supabase error ${code}).` : fallback;
}

function trackResponse(track: MusicTrack) {
  return {
    id: track.id,
    name: track.name,
    byte_size: track.byte_size,
    created_at: track.created_at,
  };
}

function decodeSafeFilename(header: string | undefined): string | null {
  if (!header || header.length > 2400) return null;

  let filename: string;
  try {
    filename = decodeURIComponent(header).trim();
  } catch {
    return null;
  }

  if (
    filename.length < 5 ||
    filename.length > 184 ||
    !/\.mp3$/i.test(filename) ||
    /[\u0000-\u001f\u007f-\u009f\\/]/u.test(filename)
  ) {
    return null;
  }
  return filename;
}

type MpegFrameHeader = {
  version: number;
  layer: number;
  sampleRate: number;
  frameLength: number;
};

const MPEG1_BITRATES: Record<number, number[]> = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  3: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
};
const MPEG2_BITRATES: Record<number, number[]> = {
  1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
};
const MPEG1_SAMPLE_RATES = [44100, 48000, 32000];

function id3AudioStart(bytes: Buffer): number | null {
  if (bytes.length < 3 || bytes.subarray(0, 3).toString("ascii") !== "ID3") return 0;
  if (bytes.length < 10) return null;

  const version = bytes[3];
  const flags = bytes[5];
  const allowedFlags = version === 2 ? 0xc0 : version === 3 ? 0xe0 : version === 4 ? 0xf0 : 0;
  if (version < 2 || version > 4 || bytes[4] === 0xff || (flags & ~allowedFlags) !== 0) return null;

  const sizeBytes = bytes.subarray(6, 10);
  if (sizeBytes.some((byte) => (byte & 0x80) !== 0)) return null;
  const tagSize =
    (sizeBytes[0] << 21) |
    (sizeBytes[1] << 14) |
    (sizeBytes[2] << 7) |
    sizeBytes[3];
  if (tagSize > bytes.length - 10) return null;
  return 10 + tagSize;
}

function parseMpegFrameHeader(bytes: Buffer, offset: number): MpegFrameHeader | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  const first = bytes[offset];
  const second = bytes[offset + 1];
  const third = bytes[offset + 2];
  const fourth = bytes[offset + 3];
  if (
    first !== 0xff ||
    (second & 0xe0) !== 0xe0 ||
    (fourth & 0x03) === 0x02
  ) {
    return null;
  }

  const version = (second >> 3) & 0x03;
  const layer = (second >> 1) & 0x03;
  const bitrateIndex = (third >> 4) & 0x0f;
  const sampleRateIndex = (third >> 2) & 0x03;
  if (version === 1 || layer === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return null;
  }

  const bitrateTable = version === 3 ? MPEG1_BITRATES : MPEG2_BITRATES;
  const bitrateKbps = bitrateTable[layer][bitrateIndex];
  const baseSampleRate = MPEG1_SAMPLE_RATES[sampleRateIndex];
  const sampleRate = version === 3 ? baseSampleRate : version === 2 ? baseSampleRate / 2 : baseSampleRate / 4;
  const bitrate = bitrateKbps * 1000;
  const padding = (third >> 1) & 1;
  const coefficient = layer === 3 ? 12 : version === 3 || layer === 2 ? 144 : 72;
  const frameLength = Math.floor((coefficient * bitrate) / sampleRate + padding) * (layer === 3 ? 4 : 1);

  return { version, layer, sampleRate, frameLength };
}

function hasKnownTrailingTag(bytes: Buffer, offset: number): boolean {
  const remaining = bytes.length - offset;
  if (remaining === 0) return true;
  if (remaining >= 128 && bytes.subarray(bytes.length - 128, bytes.length - 125).toString("ascii") === "TAG") {
    return offset === bytes.length - 128;
  }
  if (remaining >= 32 && bytes.subarray(offset, offset + 8).toString("ascii") === "APETAGEX") {
    const tagSize = bytes.readUInt32LE(offset + 12);
    return tagSize >= 32 && tagSize === remaining;
  }
  if (remaining >= 10 && bytes.subarray(offset, offset + 3).toString("ascii") === "ID3") {
    const tagStart = id3AudioStart(bytes.subarray(offset));
    return tagStart === remaining;
  }
  return false;
}

function isMp3(bytes: Buffer): boolean {
  const audioStart = id3AudioStart(bytes);
  if (audioStart === null) return false;

  // Scan near the audio start rather than every byte of a large invalid upload.
  const lastCandidate = Math.min(bytes.length - 4, audioStart + 64 * 1024);
  for (let offset = audioStart; offset <= lastCandidate; offset += 1) {
    const frame = parseMpegFrameHeader(bytes, offset);
    if (!frame || frame.frameLength < 4) continue;
    const nextOffset = offset + frame.frameLength;
    if (nextOffset > bytes.length) continue;

    const nextFrame = parseMpegFrameHeader(bytes, nextOffset);
    if (
      nextFrame &&
      nextFrame.version === frame.version &&
      nextFrame.layer === frame.layer &&
      nextFrame.sampleRate === frame.sampleRate
    ) {
      return true;
    }
    if (hasKnownTrailingTag(bytes, nextOffset)) return true;
  }
  return false;
}

const rawAudioBody = express.raw({
  type: () => true,
  limit: MAX_UPLOAD_BYTES,
});

function handleRawBodyError(
  error: unknown,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (typeof error === "object" && error !== null && "type" in error) {
    if (error.type === "entity.too.large") {
      res.status(413).json({ error: "MP3 uploads must be 25 MiB or smaller." });
      return;
    }
    if (error.type === "entity.parse.failed" || error.type === "request.size.invalid") {
      res.status(400).json({ error: "The MP3 upload body is invalid." });
      return;
    }
  }
  next(error);
}

router.get("/music", requireAuth, async (req, res): Promise<void> => {
  try {
    const result = await getSupabaseAdmin()
      .from("evoke_music")
      .select("id,owner_id,name,storage_path,byte_size,created_at")
      .eq("owner_id", req.evokeUser!.id)
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;

    const tracks = (result.data ?? []) as MusicTrack[];
    res.json({ tracks: tracks.map(trackResponse) });
  } catch (error) {
    req.log.error({ code: supabaseErrorCode(error) }, "Could not list Evoke music");
    res.status(musicErrorStatus(error)).json({
      error: musicErrorMessage(error, "Could not load your music library."),
    });
  }
});

router.post(
  "/music",
  requireAuth,
  rawAudioBody,
  handleRawBodyError,
  async (req: express.Request, res: express.Response): Promise<void> => {
    const contentType = req.header("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "audio/mpeg") {
      res.status(415).json({ error: "Only audio/mpeg MP3 uploads are supported." });
      return;
    }

    const filename = decodeSafeFilename(req.header("x-file-name"));
    if (!filename) {
      res.status(400).json({ error: "X-File-Name must contain a safe .mp3 filename." });
      return;
    }

    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      res.status(400).json({ error: "The MP3 upload body is empty or invalid." });
      return;
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: "MP3 uploads must be 25 MiB or smaller." });
      return;
    }
    if (!isMp3(bytes)) {
      res.status(415).json({ error: "The uploaded file is not a recognizable MP3." });
      return;
    }

    const ownerId = req.evokeUser!.id;
    const storagePath = `${ownerId}/${randomUUID()}.mp3`;
    const admin = getSupabaseAdmin();

    try {
      const upload = await admin.storage.from(MUSIC_BUCKET).upload(storagePath, bytes, {
        contentType: "audio/mpeg",
        upsert: false,
      });
      if (upload.error) throw upload.error;

      let inserted;
      try {
        inserted = await admin
          .from("evoke_music")
          .insert({
            owner_id: ownerId,
            name: filename,
            storage_path: storagePath,
            byte_size: bytes.length,
          })
          .select("id,owner_id,name,storage_path,byte_size,created_at")
          .single();
        if (inserted.error) throw inserted.error;
      } catch (error) {
        try {
          const cleanup = await admin.storage.from(MUSIC_BUCKET).remove([storagePath]);
          if (cleanup.error) {
            req.log.error({ code: supabaseErrorCode(cleanup.error) }, "Could not clean up an unregistered music upload");
          }
        } catch (cleanupError) {
          req.log.error({ code: supabaseErrorCode(cleanupError) }, "Could not clean up an unregistered music upload");
        }
        throw error;
      }

      res.status(201).json({ track: trackResponse(inserted.data as MusicTrack) });
    } catch (error) {
      req.log.error({ code: supabaseErrorCode(error) }, "Could not upload Evoke music");
      res.status(musicErrorStatus(error)).json({
        error: musicErrorMessage(error, "Could not save this MP3."),
      });
    }
  },
);

router.get("/music/:id/play", requireAuth, async (req, res): Promise<void> => {
  const trackId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const result = await getSupabaseAdmin()
      .from("evoke_music")
      .select("id,owner_id,name,storage_path,byte_size,created_at")
      .eq("id", trackId)
      .eq("owner_id", req.evokeUser!.id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) {
      res.status(404).json({ error: "Track not found." });
      return;
    }

    const signed = await getSupabaseAdmin()
      .storage.from(MUSIC_BUCKET)
      .createSignedUrl((result.data as MusicTrack).storage_path, SIGNED_URL_LIFETIME_SECONDS);
    if (signed.error) throw signed.error;
    if (!signed.data?.signedUrl) throw new Error("Supabase did not return a signed URL.");
    res.json({ signed_url: signed.data.signedUrl });
  } catch (error) {
    req.log.error({ code: supabaseErrorCode(error) }, "Could not create an Evoke music playback URL");
    res.status(musicErrorStatus(error)).json({
      error: musicErrorMessage(error, "Could not play this track."),
    });
  }
});

export default router;