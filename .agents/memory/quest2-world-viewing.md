---
name: Quest 2 world viewing
description: Current Quest 2 prototype priorities and device validation decisions
---

The user wants within-world movement on desktop/web first, like Marble's fixed-height flying or gliding rather than walking. Quest movement is a separate follow-on; preserve the photo-faithful room-generation priority.

**Why:** The user requested movement inside generated worlds, chose desktop/web first, and said fixed height is fine.

**How to apply:** Use mouse-look and horizontal keyboard glide at a steady eye height for the desktop/web viewer. Marble Gaussian-splat worlds do not provide solid collision walls, so do not claim physical collision or a true room boundary. Keep Quest locomotion separate and validate it on Quest 2 before enabling it.

A device-model check is a compatibility gate for native UI, not proof of device identity or an access-control boundary.

Unity's device model can be generic even when Android identifies a Quest 2 correctly. Do not reject the headset solely because Unity reports “Oculus Quest,” or accept that generic name as proof of Quest 2.

**Why:** On the user's physical Quest 2, Unity logged “Oculus Quest” while Android's model property returned “Quest 2.” The compatibility check stopped startup before creating any UI or controller pointers.

**How to apply:** Treat a successful ADB `getprop ro.product.model` result as evidence for that specific Android property, not proof that Java's `Build.MODEL` returns the same string. Device rejection messages must show detected model details in a tracked world-space canvas: screen-space overlays can be invisible in VR, and app diagnostic log lines may be absent on the installed build.

In VR interaction checks, a button changing color does not prove its click action was delivered.

**Why:** The user's controller rays and buttons reacted visually, but the email keyboard never appeared: the custom pointer handling lost click eligibility between trigger press and release. The user confirmed that interaction worked on the physical headset after preserving that state.

**How to apply:** Verify trigger-down, held frames, and release together, including release off the target and controller tracking loss. Preserve press-event state for each hand independently until release or cancellation.