# Evoke Quest 2 — Evoke headset client

This is a **separate Unity client** for Meta Quest 2. It uses the same Supabase
email/password accounts and the same saved worlds as the Evoke website, but has
its own headset UI. After sign-in it has three screens: Immerse (your ready
worlds and 360° panorama viewer), How It Works, and Music. The viewer lets you
look around from one spot; it does **not** render SPZ splats or let you walk
through the world. World creation and editing remain on the website.

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

The Quest 2 runtime check blocks other reported Android device models; the
Unity Editor is allowed for development. A device-model check is **not**
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
- A 360° panorama shows the scene from a fixed viewpoint. For positional 3D
  movement later, a performant Quest-compatible SPZ renderer is separate
  work; this version does not pretend the collider GLB is a visual scene.
- Before sharing the APK, validate on a **physical Quest 2**: controller
  selection and keyboard input, sign-in, opening and returning from a panorama,
  session refresh after token expiry, native MP3 picking/upload/playback,
  switching tabs while audio plays, logout cleanup, and rejection on a
  non-Quest-2 Android device. No physical headset or Unity/Android toolchain is
  available in this workspace, so none of those device/build checks have been
  performed here.