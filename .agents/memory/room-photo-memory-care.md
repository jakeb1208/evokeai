---
name: Memory-care archival photos
description: Product constraints for generating old-home rooms from family photographs in Evoke's memory-care experience.
---

People using this memory-care experience may only have old photographs of a home. Do not require retaking photos, matching camera angles, or filling gaps with new pictures. Preserve visible period details and let users note what they remember; do not force photos into one room when their relationship is unknown.

**Why:** The user said the experience is for memory care and must use the old house photos people already have.

**How to apply:** Make uncertainty explicit in prompts and controls. Distinguish known same-room views from same-home/different-room photos and uncertain sets. Keep unseen architecture conservative instead of inventing details that could be mistaken for a remembered fact.

## No separate AI analysis pass

Do not add a separate AI photo-analysis step for room reconstruction. Use the existing Marble generation request and deterministic image preparation.

**Why:** The user said they cannot add an extra AI step.

**How to apply:** Improve the existing model request and preserve the available photos; do not introduce another vision service or an extra model call.

## Reconstruction versus creative image layout

Confirmed same-room photos need Marble's reconstruction mode, not creative multi-image direction control. Do not guess camera headings from camera positions: opposite corners do not necessarily mean opposite viewing directions.

**Why:** World Labs documents creative mode as connecting image environments, while reconstruction/Auto Layout targets one shared space. Creative mode is the API default. The user's confirmed same-room opposite-corner inputs produced two connected rooms under that default.

**How to apply:** Verify the current API contract when changing this integration. Reconstruction supports up to eight matching-dimension flat images; creative references support four. Preserve whole photos with proportional resizing/padding instead of cropping away evidence, and retain originals when already compatible. Reconstruction works best with overlapping views near one vantage point; do not promise exact geometry from arbitrary archival photos.

Sources: https://docs.worldlabs.ai/api/reference/worlds/generate and https://docs.worldlabs.ai/marble/create/prompt-guides/multi-image-prompt
