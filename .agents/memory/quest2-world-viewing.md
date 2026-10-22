---
name: Quest 2 world viewing
description: Quest 2 panorama fallback, experimental walk-mode, and device validation decisions
---

The Quest 2 Unity client keeps owner-scoped panorama viewing as a fallback and adds walk-around mode only as a separate, experimental choice. A device-model check is a compatibility gate for its native UI, not proof of device identity or an access-control boundary.

**Why:** The user asked to move freely through generated worlds with joystick controls, collisions, stairs, and a boundary, then chose separate Walk mode while retaining the 360° panorama. Quest 2 performance is a constraint; this new renderer has not yet been built on their Unity 6.6 setup or tested on their headset.

**How to apply:** Do not remove the panorama fallback. Walking depends on the world's signed 100k SPZ and GLB collider, and stairs are walkable only when represented by connected collider surfaces within the character's step and slope limits. Test performance and boundaries on a physical Quest 2 before calling the feature complete. Continue using the owner-checked Railway API; never put server-only keys in the headset build.

Unity's device model can be generic even when Android identifies a Quest 2 correctly. Do not reject the headset solely because Unity reports “Oculus Quest,” or accept that generic name as proof of Quest 2.

**Why:** On the user's physical Quest 2, Unity logged “Oculus Quest” while Android's model property returned “Quest 2.” The compatibility check stopped startup before creating any UI or controller pointers.

**How to apply:** Treat a successful ADB `getprop ro.product.model` result as evidence for that specific Android property, not proof that Java's `Build.MODEL` returns the same string. Device rejection messages must show detected model details in a tracked world-space canvas: screen-space overlays can be invisible in VR, and app diagnostic log lines may be absent on the installed build.

In VR interaction checks, a button changing color does not prove its click action was delivered.

**Why:** The user's controller rays and buttons reacted visually, but the email keyboard never appeared: the custom pointer handling lost click eligibility between trigger press and release. The user confirmed that interaction worked on the physical headset after preserving that state.

**How to apply:** Verify trigger-down, held frames, and release together, including release off the target and controller tracking loss. Preserve press-event state for each hand independently until release or cancellation.