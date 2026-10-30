# Choose a central Quest starting view

This workflow uses the **existing fixed-viewpoint Quest panorama viewer**.
It does not require WorldLabs Gaussian Splatting in Unity, joystick walking,
or a Unity downgrade.

## Use it

1. On desktop/web, sign in and open a ready 3D world from **My Worlds**.
2. Choose **Set Quest viewpoint**.
3. Click the room and use WASD/arrows and mouse look to find a suitable central
   position. Press Esc to return to the settings. The panel also has precise
   0.25 m movement buttons and an eye-height slider.
4. Choose the direction to face, then **Capture this position**. Capture is
   level, even if you were looking up/down.
5. Drag the 360° preview (or focus it and use arrow keys) to check every
   direction. Use **Retake** if the point is inside furniture or shows poor
   reconstruction. Choosing the center is manual, not an automatic estimate.
6. Choose **Save for Quest**.
7. In the headset, return to Immerse, refresh the world list and reopen the
   world. The existing first-JPEG-panorama selection loads the custom view.
8. To undo it, return to the web viewer's settings and choose **Restore original
   Quest panorama**. Reopen the world on the headset afterward.

## What this does and does not do

- Captures the already-generated 3D world, not the screen or a new AI generation.
- Saves a 4096 × 2048 JPEG, at most 8 MiB. Web HUD, music controls and panels
  are DOM overlays and are not included.
- Stores the position and horizontal facing direction with the custom image.
- Keeps the original Marble panorama and all 3D assets. Replacing a custom
  panorama removes only the previous custom-image reference.
- Does not repair distortion, fill missing geometry, add depth/parallax, move
  the physical XR Origin, or enable walking. Quest remains look-around only.
- Existing panorama-capable Quest APKs need no new renderer or APK change.
  The new website **and API server** must be deployed before the live Quest
  client can receive images saved using this feature.

## Storage and ownership

Uses the existing private Supabase world-assets bucket; no schema migration or
new storage provider is required. The API authenticates every operation and
checks ownership and ready status before signing an upload or changing assets.
File paths are generated server-side under the owner/world path. Uploads go
directly to a signed storage URL; the commit checks stored MIME type, actual
JPEG dimensions/markers, and size before updating the world's assets JSON.
Room images are never stored as base64 in the database.

Custom panoramas are first in the asset list and use `kind: panorama`,
`format: jpg`, `quality: quest_centered`. This preserves the existing Unity
panorama selector's wire contract. Original images remain behind them; reset
removes only `quest_centered` entries. Updates use the world's previous
`updated_at` value to reject conflicting writes instead of losing changes.

A failed/canceled direct upload or commit can leave an unreferenced image;
it is not activated as the Quest view. Scheduled orphan cleanup is not included.

## Verification

API tests run with isolated storage/auth fixtures:

```sh
node --test artifacts/api-server/test/quest-panorama.test.mjs
```

Live Supabase signed upload/download compatibility and the panorama's final
orientation/comfort on a physical Quest still need deployment/device validation.
