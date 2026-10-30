---
name: Quest 2 world viewing
description: Current Quest 2 prototype priorities and device validation decisions
---

The user wants within-world movement on desktop/web and Quest 2, like Marble's fixed-height flying or gliding rather than walking. Preserve the photo-faithful room-generation priority.

**Why:** The user requested desktop/web movement first, accepted fixed height, then explicitly asked to add it on Quest 2.

**How to apply:** Keep horizontal navigation at steady rig height with natural head tracking. Quest translation must render an actual 3D scene, not move a camera through a head-centered panorama sphere. Do not claim physical collision or a true room boundary from splats alone. Keep panorama as a fallback and validate stereo rendering, comfort, frame rate and memory use on Quest 2.

The selected third-party splat renderer is not compatible as-is with the user's installed Unity 6.6/URP rendering API.

**Why:** After successful package installation, the user received CS0115 for the renderer's legacy `ScriptableRenderPass.Execute` override. The renderer documents Unity 6000.2.10f1 and 6000.3.14f1 as tested; its supplied URP pass has no Render Graph implementation.

**How to apply:** Do not continue offering graphics-setting changes as a fix for this compile failure, remove `override` to suppress it, or edit the disposable PackageCache. Choose either a separate project using a documented compatible editor or a complete, persistent Render Graph renderer port. Never open the sole newer project in an older editor; preserve the working project and require a separate copy or fresh project for migration.

A device-model check is a compatibility gate for native UI, not proof of device identity or an access-control boundary.

Unity's device model can be generic even when Android identifies a Quest 2 correctly. Do not reject the headset solely because Unity reports “Oculus Quest,” or accept that generic name as proof of Quest 2.

**Why:** On the user's physical Quest 2, Unity logged “Oculus Quest” while Android's model property returned “Quest 2.” The compatibility check stopped startup before creating any UI or controller pointers.

**How to apply:** Treat a successful ADB `getprop ro.product.model` result as evidence for that specific Android property, not proof that Java's `Build.MODEL` returns the same string. Device rejection messages must show detected model details in a tracked world-space canvas: screen-space overlays can be invisible in VR, and app diagnostic log lines may be absent on the installed build.

In VR interaction checks, a button changing color does not prove its click action was delivered.

**Why:** The user's controller rays and buttons reacted visually, but the email keyboard never appeared: the custom pointer handling lost click eligibility between trigger press and release. The user confirmed that interaction worked on the physical headset after preserving that state.

**How to apply:** Verify trigger-down, held frames, and release together, including release off the target and controller tracking loss. Preserve press-event state for each hand independently until release or cancellation.