---
name: Quest 2 world viewing
description: Why the first Quest 2 client uses panoramas rather than runtime splats
---

For the Quest 2 native Unity client, start with owner-scoped saved-world panoramas and keep SPZ rendering as separate work requiring hardware validation. A device-model check is a compatibility gate for its native UI, not proof of device identity or an access-control boundary.

**Why:** World Labs' Unity guidance reports roughly 12 fps for 500k splats even on Quest 3 and problems with larger splats. Quest 2 has a smaller performance budget, while the existing world response already contains panorama assets and short-lived signed URLs. The user explicitly chose 360° viewing first.

**How to apply:** Do not promise walk-around SPZ worlds from the panorama client. If adding splats later, first prove dynamic loading and stereo performance on a physical Quest 2. Continue using the same Supabase accounts and owner-checked Railway world API; never put server-only keys in the headset build.

Unity's device model can be generic even when Android identifies a Quest 2 correctly. Do not reject the headset solely because Unity reports “Oculus Quest,” or accept that generic name as proof of Quest 2.

**Why:** On the user's physical Quest 2, Unity logged “Oculus Quest” while Android's model property returned “Quest 2.” The compatibility check stopped startup before creating any UI or controller pointers.

**How to apply:** Treat a successful ADB `getprop ro.product.model` result as evidence for that specific Android property, not proof that Java's `Build.MODEL` returns the same string. Device rejection messages must show detected model details in a tracked world-space canvas: screen-space overlays can be invisible in VR, and app diagnostic log lines may be absent on the installed build.

In VR interaction checks, a button changing color does not prove its click action was delivered.

**Why:** The user's controller rays and buttons reacted visually, but the email keyboard never appeared: the custom pointer handling lost click eligibility between trigger press and release. The user confirmed that interaction worked on the physical headset after preserving that state.

**How to apply:** Verify trigger-down, held frames, and release together, including release off the target and controller tracking loss. Preserve press-event state for each hand independently until release or cancellation.