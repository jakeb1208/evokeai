# Evoke Quest 2 — 360° world viewer

This is a **separate Unity client** for Meta Quest 2. It uses the same Supabase
email/password accounts and the same saved worlds as the Evoke website, but has
its own headset UI. This first version lets you look around from one spot in a
world's 360° panorama; it does **not** render SPZ splats or let you walk through
the world.

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
- Choose a ready world. The app requests a fresh, short-lived signed panorama
  URL from Railway and displays the 360° image around your head.
- Use **Back** to return to the world list or **Log out** to clear the session.
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
- A 360° panorama shows the scene from a fixed viewpoint. For positional 3D
  movement later, a performant Quest-compatible SPZ renderer is separate
  work; this version does not pretend the collider GLB is a visual scene.
- Before sharing the APK, check on a physical Quest 2: controller selection and
  keyboard input, signing in with an existing account, opening and returning
  from a panorama, session refresh after the access token expires, and rejection
  on a non-Quest-2 Android device. These cannot be verified in Replit.