---
name: Memory-care archival photos
description: Product constraints for generating old-home rooms from family photographs in Evoke's memory-care experience.
---

People using this memory-care experience may only have old photographs of a home. Do not require retaking photos, matching camera angles, or filling gaps with new pictures. Preserve visible period details and let users note what they remember; do not force photos into one room when their relationship is unknown.

**Why:** The user said the experience is for memory care and must use the old house photos people already have.

**How to apply:** Make uncertainty explicit in prompts and controls. Distinguish known same-room views from same-home/different-room photos and uncertain sets. Keep unseen architecture conservative instead of inventing details that could be mistaken for a remembered fact.

## Conservative local completion

For unseen corners, the user wants conservative completion from immediate surroundings to reduce stretching during viewpoint changes. Continue supported surfaces and materials, not distinctive personal details; this remains inferred rather than recovered evidence.

The generation prompt should explicitly reject warped or stretched wall art, books, shelves, screens and fixtures, duplicate/floating/fused objects, and invented personal or architectural details. Plain connected surfaces are preferred over decorative guesses; never add rooms or hallways.

**Why:** The user requested local gap filling while seeking less distortion, within the existing no-extra-AI-step constraint.

**How to apply:** Preserve photo evidence first and do not promise that generation instructions eliminate rendering artifacts or make panoramas support positional movement.

For unseen room areas, the user prefers concise, affirmative instructions: continue nearby surfaces plainly and keep uncertain areas low-detail, rather than relying on long negative-prompt lists.

**Why:** The user observed that Marble's recaption omitted their negative prompt and suggested describing how to complete unseen areas simply.

**How to apply:** Preserve visible photo evidence and the single-room scope; guide unseen areas toward simple adjacent materials and geometry. Use absolute emphasis only where helpful, and do not claim prompt wording guarantees perfect output.

## Preserve supplied Marble text

Marble's image and multi-image prompts can each include `text_prompt` alongside image content. Set `disable_recaption: true` when the submitted wording must be used as-is.

**Why:** The user saw Marble's recaption differ from their submitted memory-photo guidance; the API documents this flag as preventing recaptioning.

**How to apply:** Keep image content and the full text guidance together in the same generation request, with recaption disabled. This preserves the prompt string but does not guarantee the generated geometry will obey every instruction.

Append the current high-priority geometry rules at the shared Marble generation boundary so new worlds and revisions both receive them.

**Why:** The user asked whether the exact prompt reaches Marble every time; older saved-world revisions previously reused their stored prompt without the newest rules.

**How to apply:** Keep one canonical instruction block and append it last after create/edit prompt assembly. Do not claim it affects status polling, downloads, already-generated worlds, or that Marble will obey every instruction.

## Future full-room movement

The product should support full walk-around movement in the future. In the meantime, prioritize reducing visible warping and distortion without replacing the 3D direction with a photo-only experience.

**Why:** The user wants room-scale exploration eventually, while minimizing distortion is important for memory-care use.

**How to apply:** Keep the 3D path; do not treat photo-only viewing as the intended default. Be explicit that current image-to-3D generation cannot guarantee accurate unseen geometry, and prefer meaningful reconstruction improvements over adding more negative prompt wording.

## No separate AI analysis pass

Do not add a separate AI photo-analysis step for room reconstruction. Use the existing Marble generation request and deterministic image preparation.

**Why:** The user said they cannot add an extra AI step.

**How to apply:** Improve the existing model request and preserve the available photos; do not introduce another vision service or an extra model call.

## Reconstruction versus creative image layout

Confirmed same-room photos need Marble's reconstruction mode, not creative multi-image direction control. Do not guess camera headings from camera positions: opposite corners do not necessarily mean opposite viewing directions.

**Why:** World Labs documents creative mode as connecting image environments, while reconstruction/Auto Layout targets one shared space. Creative mode is the API default. The user's confirmed same-room opposite-corner inputs produced two connected rooms under that default.

**How to apply:** Verify the current API contract when changing this integration. Reconstruction supports up to eight matching-dimension flat images; creative references support four. Preserve whole photos with proportional resizing/padding instead of cropping away evidence, and retain originals when already compatible. Reconstruction works best with overlapping views near one vantage point; do not promise exact geometry from arbitrary archival photos.

Sources: https://docs.worldlabs.ai/api/reference/worlds/generate and https://docs.worldlabs.ai/marble/create/prompt-guides/multi-image-prompt

## Requested angular coverage

Treat the user's 180–360° choice as a generation preference, not a web-only camera restriction. Do not claim the output is trimmed to that angle.

**Why:** The user wants the resulting world itself to carry the requested coverage into VR, rather than relying on web viewer behavior. Marble's documented generation contract does not expose an exact angular geometry constraint.

**How to apply:** Be explicit that prompt-based coverage may not be followed, does not guarantee less hallucination, and must be checked in the actual output. Do not imply Unity changes or guaranteed geometry clipping when only generation instructions have changed.
