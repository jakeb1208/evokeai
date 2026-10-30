import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import express from "express";

const owner = "11111111-1111-4111-8111-111111111111";
const outsider = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const uploadId = "44444444-4444-4444-8444-444444444444";
const oldId = "55555555-5555-4555-8555-555555555555";
const prefix = `${owner}/${id}/quest-viewpoints/`;
const uploadPath = `${prefix}${uploadId}.jpg`;
const original = { kind: "panorama", format: "jpg", storage_path: "original/panorama.jpg" };
const splat = { kind: "splat", format: "spz", storage_path: "original/room.spz" };
const custom = { kind: "panorama", format: "jpg", quality: "quest_centered", storage_path: `${prefix}${oldId}.jpg` };
const viewpoint = { x: 2, y: 1.65, z: -1, yaw: 0.5 };
// Header fixture for the dimension/marker validator, not a browser-renderable image.
const jpeg = Uint8Array.from([255,216,255,192,0,17,8,8,0,16,0,3,1,17,0,2,17,0,3,17,0,
  255,218,0,12,3,1,0,2,17,3,17,0,63,0,0,255,217]);
let state, server, base, directory;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "evoke-quest-tests-"));
  const output = path.join(directory, "router.cjs");
  await build({
    entryPoints: [new URL("../src/routes/quest-panorama.ts", import.meta.url).pathname],
    outfile: output, bundle: true, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{
      name: "isolated-storage-and-auth",
      setup(builder) {
        builder.onLoad({ filter: /[/\\]lib[/\\]supabase\.ts$/ }, () => ({
          contents: "export const getSupabaseAdmin = () => globalThis.__questTest.client; export const getWorldAssetsBucket = () => 'private';",
          loader: "js",
        }));
        builder.onLoad({ filter: /[/\\]middlewares[/\\]auth\.ts$/ }, () => ({
          contents: `export function requireAuth(req,res,next) {
            const owner = req.headers.authorization?.replace("Bearer ", "");
            if (!owner) return res.status(401).json({error:"Authentication required"});
            req.evokeUser={id:owner}; next();
          }`, loader: "js",
        }));
      },
    }],
  });
  const router = createRequire(import.meta.url)(output).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.log = { error() {}, warn() {} }; next(); });
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/worlds/${id}/quest-panorama`;
});
beforeEach(() => {
  state = {
    world: { id, owner_id: owner, status: "ready", updated_at: "v1", assets: [original, splat] },
    bytes: jpeg, size: jpeg.length, contentType: "image/jpeg",
    removed: [], signed: [], conflict: false, cleanupFails: false, public: false,
  };
  globalThis.__questTest = { client: {
    from() {
      const filters = []; let update;
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        update(values) { update = values; return query; },
        async maybeSingle() {
          const matches = filters.every(([key, value]) => state.world[key] === value);
          if (!matches || (update && state.conflict)) return { data: null, error: null };
          if (update) Object.assign(state.world, structuredClone(update));
          return { data: structuredClone(state.world), error: null };
        },
      };
      return query;
    },
    storage: {
      async getBucket() { return { data: { public: state.public }, error: null }; },
      from() { return {
      async createSignedUploadUrl(path, options) {
        state.signed.push({ path, options });
        return { data: { signedUrl: "https://storage.example/private-upload" }, error: null };
      },
      async info(path) {
        return path === uploadPath
          ? { data: { size: state.size, contentType: state.contentType }, error: null }
          : { data: null, error: { message: "Not found" } };
      },
      async download() { return { data: new Blob([state.bytes]), error: null }; },
      async remove(paths) {
        if (state.cleanupFails) throw new Error("Storage offline");
        state.removed.push(...paths); return { data: [], error: null };
      },
    }; } },
  } };
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
  delete globalThis.__questTest;
});
async function request(method, body, identity = owner, suffix = "") {
  return fetch(base + suffix, {
    method, headers: {
      ...(identity ? { Authorization: `Bearer ${identity}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const input = () => ({ upload_id: uploadId, viewpoint });

test("requires authentication and hides other owners' worlds", async () => {
  assert.equal((await request("POST", null, null, "/upload")).status, 401);
  for (const method of ["PUT", "DELETE"]) {
    assert.equal((await request(method, method === "PUT" ? input() : null, outsider)).status, 404);
  }
  assert.equal((await request("POST", null, outsider, "/upload")).status, 404);
  assert.equal(state.signed.length, 0);
});
test("issues a non-overwriting upload URL scoped to owner and world", async () => {
  const response = await request("POST", null, owner, "/upload");
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(state.signed[0].path, `${prefix}${result.upload_id}.jpg`);
  assert.equal(state.signed[0].options.upsert, false);
});
test("refuses to put memory-care room images in a public bucket", async () => {
  state.public = true;
  const response = await request("POST", null, owner, "/upload");
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /private/);
  assert.equal(state.signed.length, 0);
});
test("saves a Quest-compatible first panorama while retaining original and splat", async () => {
  const response = await request("PUT", input());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { saved: true });
  assert.equal(state.world.assets[0].quality, "quest_centered");
  assert.equal(state.world.assets[0].kind, "panorama");
  assert.equal(state.world.assets[0].format, "jpg");
  assert.deepEqual(state.world.assets[0].viewpoint, viewpoint);
  assert.deepEqual(state.world.assets.slice(1), [original, splat]);
  assert.deepEqual(state.removed, []);
});
test("replacement cleans only previous custom uploads after save", async () => {
  state.world.assets.unshift(custom);
  assert.equal((await request("PUT", input())).status, 200);
  assert.deepEqual(state.removed, [custom.storage_path]);
  assert.deepEqual(state.world.assets.slice(1), [original, splat]);
});
test("reset restores originals without deleting generated world assets", async () => {
  state.world.assets.unshift(custom);
  const response = await request("DELETE");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { saved: false });
  assert.deepEqual(state.world.assets, [original, splat]);
  assert.deepEqual(state.removed, [custom.storage_path]);
});
test("rejects invalid viewpoints before mutating storage", async () => {
  assert.equal((await request("PUT", { ...input(), viewpoint: { ...viewpoint, yaw: 8 } })).status, 400);
  assert.equal((await request("PUT", { ...input(), upload_id: "../other-user" })).status, 400);
  assert.deepEqual(state.world.assets, [original, splat]);
});
test("does not accept an arbitrary or other-owner storage path", async () => {
  assert.equal((await request("PUT", { ...input(), upload_id: oldId })).status, 404);
  assert.deepEqual(state.world.assets, [original, splat]);
});
test("rejects oversized, non-JPEG, truncated, and wrong-dimension uploads", async () => {
  state.size = 9 * 1024 * 1024;
  assert.equal((await request("PUT", input())).status, 400);
  state.size = jpeg.length; state.contentType = "text/html";
  assert.equal((await request("PUT", input())).status, 400);
  state.contentType = "image/jpeg"; state.bytes = jpeg.slice(0, -2);
  assert.equal((await request("PUT", input())).status, 400);
  state.bytes = jpeg.slice(); state.bytes[10] = 1;
  assert.equal((await request("PUT", input())).status, 400);
  assert.deepEqual(state.world.assets, [original, splat]);
});
test("stale saves and resets fail without removing the current image", async () => {
  state.world.assets.unshift(custom); state.conflict = true;
  assert.equal((await request("PUT", input())).status, 409);
  assert.equal((await request("DELETE")).status, 409);
  assert.deepEqual(state.world.assets, [custom, original, splat]);
  assert.deepEqual(state.removed, []);
});
test("cleanup failure does not falsely report that a committed save failed", async () => {
  state.world.assets.unshift(custom); state.cleanupFails = true;
  assert.equal((await request("PUT", input())).status, 200);
  assert.equal(state.world.assets[0].storage_path, uploadPath);
  assert.deepEqual(state.world.assets.slice(1), [original, splat]);
});
