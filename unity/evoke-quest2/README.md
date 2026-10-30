# Evoke Quest 2 — Evoke headset client

This is a **separate Unity client** for Meta Quest 2. It uses the same Supabase
email/password accounts and the same saved worlds as the Evoke website, but has
its own headset UI. After sign-in it has three screens: Immerse (your saved
worlds and 360° panorama viewer), How It Works, and Music. Optional experimental
Glide mode loads the actual 3D scene for fixed-height joystick exploration.
Walking/stairs remain separate from Glide. World creation and
editing remain on the website.

Unity and the Android/Quest toolchain are not available in this Replit
workspace. These are Unity-ready source files, **not an APK**. Build and test
the APK in Unity on a computer with a Quest 2.

## Set up the Unity project

1. In Unity Hub, install **Unity 6.0** with **Android Build Support**, including
   the Android SDK/NDK and OpenJDK modules. Create a new **3D (URP)** project.
2. In Package Manager, add **XR Plug-in Management**, **OpenXR Plugin**,
   **XR Interaction Toolkit** (for the XR Origin), and **Unity UI** if the
   template did not install them.
3. In Project Settings → XR Plug-in Management, enable **OpenXR for Android**.
   Enable the **Meta Quest Support** feature and the **Oculus Touch Controller
   Profile** in OpenXR settings. Switch the build target to **Android**; use
   **ARM64** and **IL2CPP**.
4. Add an **XR Origin (VR)** to your scene. Keep one tracked camera, tagged
   `MainCamera`. Remove any duplicate non-XR Main Camera.
5. Copy the entire `Assets/EvokeQuest` folder from this repository into the
   Unity project's `Assets` folder. Add `EvokeQuestPanoramaClient` to your
   XR Origin and assign the tracked head camera to its camera field.
6. Open `Assets/EvokeQuest/Resources/EvokeQuestConfig.json`. Replace the two
   placeholders with your **Supabase project URL** and **public anon key**,
   available in your Supabase project's API settings. Keep the Railway URL
   unchanged. If the live Evoke domain changes, update both this JSON file and
   the allowed API origin in `EvokeQuestConfig.cs`, then rebuild. **Never put a
   Supabase service-role key, Marble key, password, or personal access token
   here.**
7. In Unity's Android Build Profiles, build and run on a **Quest 2 in Developer
   Mode** over USB. You can also build an APK, then install it with
   `adb install -r path/to/EvokeQuest2.apk`. The headset needs internet access.

The Quest 2 runtime check reads Android's `ro.product.model` property using the
same `getprop` command used over ADB, with a two-second timeout. If that lookup
is unavailable, it falls back to Android's `Build.MODEL`, then Unity's model
when the Android model is empty. Unity may report the generic `Oculus Quest`
name on a Quest 2. The check still blocks other reported Android device models;
the Unity Editor is allowed for development. Compatibility messages show the
detected models in a head-relative world-space canvas so they are visible in
VR even when app log messages are unavailable.
A device-model check is **not**
cryptographic device authorization: it does not restrict access to the
underlying Evoke website or database from other devices.

## Use it

- Point a Quest controller at the headset panel and squeeze the trigger to
  select. Use the built-in panel keyboard for email/password.
- Sign in with your existing Evoke account. The app keeps the access and
  refresh tokens **in memory only**, so you sign in again after closing it.
- Use the three headset tabs to move between Immerse, How It Works, and Music.
- In Immerse, choose a ready world. The app requests a fresh, short-lived
  signed panorama URL from Railway and displays the 360° image around your
  head. Use **Back** to return to Immerse.
- Music loads only after sign-in. Reload the owner-scoped library, choose an
  MP3 to play, or use play/pause, skip, seek, and volume. Playback continues
  while changing tabs or viewing a panorama; logout stops playback, clears the
  in-memory list and visible titles, invalidates outstanding account-scoped
  callbacks, and disposes the downloaded audio clip. The first loaded library
  auto-starts a shuffled track; a first upload also starts playback when nothing
  has started yet. Reloading does not restart the current track.
- **Add an MP3** opens Android's system document picker in an Android Quest
  build. Select an `.mp3` file no larger than 25 MiB. The plugin copies it
  temporarily to app-private cache, uploads the original MP3 bytes, then
  deletes the temporary copy. Canceling the picker does not upload anything.
  File picking explicitly reports that it is supported only in an Android
  Quest build; it is not available in the Unity Editor or other platforms.
- Use **Log out** to clear the session.
  Worlds without a saved panorama display an error instead of showing an
  unrelated image.

This app does not create or edit worlds. Continue doing that on the web; new
ready worlds will appear in the Quest library when you refresh it.

## Notes

- The public Supabase anon key is safe to include in a client; the
  `SUPABASE_SERVICE_ROLE_KEY` and `MARBLE_API_KEY` must remain on Railway.
- The world API verifies the user's Supabase access token and returns only
  their worlds. Panorama download URLs expire, so the client fetches a world
  again before viewing and retries once with a new URL if needed.
- The music client uses the same authenticated, owner-scoped Railway routes as
  the website: `GET /api/music`, `GET /api/music/:id/play`, and raw-byte
  `POST /api/music`. Uploads set `Content-Type: audio/mpeg` and a percent-encoded
  `X-File-Name`, with the API enforcing its 25 MiB and MP3 checks. API requests
  refresh the in-memory Supabase session and retry an unauthorized request.
- Android picker bridge setup is in
  `Assets/EvokeQuest/Plugins/Android/EvokeMp3Picker.androidlib`; its manifest
  registers a small translucent Activity that launches `ACTION_OPEN_DOCUMENT`,
  copies the selected URI into app cache on a worker thread, and calls the
  Unity component's `OnQuestMp3Picked` callback with the launch-time session
  generation. The Java bridge uses reflection for UnityPlayer access so it has
  no compile-time UnityPlayer JAR dependency; its Android library build targets
  compile SDK 35. Unity 6 Android Gradle/manifest merging and SDK availability
  must still be checked in a generated build on the target Unity installation.
- Glide requires the optional SPZ renderer and `EVOKE_GLIDE_WORLDS` define;
  follow the setup below. Do not enable `EVOKE_WALKABLE_WORLDS` for Glide.
  Glide does not need GLB collision meshes, glTFast, stairs, or a NavMesh.
- Before sharing the APK, validate on a **physical Quest 2**: controller
  selection and keyboard input, sign-in, opening and returning from a panorama,
  session refresh after token expiry, native MP3 picking/upload/playback,
  switching tabs while audio plays, logout cleanup, and rejection on a
  non-Quest-2 Android device. No Unity/Android toolchain or attached physical
  Quest is available here, so a Unity build and device validation remain
  necessary, especially for the experimental walk mode.

## Experimental Quest 2 Glide setup

**This is source code, not an installed headset update.** Merge the supplied
`EvokeQuest/Scripts` into your existing `Assets/EvokeQuest/Scripts` folder.
Keep your existing `.meta` files, scene, Resources, plugins, and config JSON.
Save a copy of the working Unity project before changing render settings.

1. Install **Git for Windows** if Unity previously reported no Git executable.
   Close both Unity and Unity Hub after installation, then reopen them.
2. In Package Manager, choose **Add package from Git URL**:

   ```text
   https://github.com/nigelhartm/worldlabs_unity.git#207cd3f136d588fe21426519bd0cde7df7f18b0a
   ```

   Allow its declared dependencies to install. **Do not use the package's
   API-connected world browser or supply it with your Marble API key.** Evoke
   loads only the signed, owner-checked assets from its existing API.
3. Follow the pinned renderer's requirements:
   - Active URP Renderer Data: add **GaussianSplatURPFeature**.
   - Graphics settings: enable **Compatibility Mode (Render Graph disabled)**.
   - Android Graphics APIs: use **Vulkan**.
   - Android OpenXR: use **Multi-pass** rendering.
   - The renderer recommends Depth Texture and HDR on, MSAA off.
   - If testing its rendering in the Windows Editor, use Vulkan or D3D12,
     **not D3D11**. This does not mean changing the Android build target.
4. In **Player → Android → Other Settings → Scripting Define Symbols**, add
   `EVOKE_GLIDE_WORLDS`, preserving existing symbols. Leave
   `EVOKE_WALKABLE_WORLDS` off unless deliberately testing the separate older
   walking implementation with all its additional dependencies.
5. Select the **XR Origin**, open the Evoke client component's menu, choose
   **Assign Glide Mode Renderer Assets**, and confirm all six Glide shader /
   compute fields are populated. Save the scene.
6. **Build And Run** a new Android APK on Quest 2. The Immerse list now offers
   **360° VIEW** and **GLIDE · TEST**. Existing installed APKs do not update
   themselves when files in Replit change.

### Controls and limits

- **Left joystick:** move horizontally relative to the direction you look.
  The rig's height stays fixed; real head tracking remains enabled.
- **Right joystick left/right:** 45° snap-turn, once per stick deflection.
  Return the stick to center before turning again.
- **Press the left joystick:** reset the rig to its starting position and turn.
- **Back:** return to the library; the 3D scene unloads and the original rig
  position/rotation is restored. Logout also unloads the scene.
- Movement is disabled while loading, on other screens, when the app loses
  focus, or when the headset reports it is not being worn.
- Slow default speed: **0.8 units/second**, configurable on the component.
  Metric scale is applied when supplied by the world metadata.
- Only 100k or 150k SPZ assets are accepted, with a decoded 150k-splat cap and
  a 96 MiB download cap. Larger desktop assets are not silently loaded.
- **No collision, stairs, gravity, or true room boundary.** You can pass through
  furniture/walls or leave the reconstructed area. Reset brings you back.
  Glide does not repair distortions or invent missing geometry.
- Stop immediately if joystick motion causes discomfort. Keep 360° View
  available for seated users who prefer looking around without movement.

The pinned renderer lists Unity 6000.2.10f1 and 6000.3.14f1 as tested versions,
not the user's Unity 6.6 release. Package import, Android compilation, stereo
rendering/orientation, scene scale, frame rate, memory use, headset removal,
Back/logout cleanup, music, and controller UI still require physical Quest 2
validation. Replit has no Unity editor, Android toolchain, or attached headset,
so these source changes have **not** been Unity-compiled or device-tested here.
