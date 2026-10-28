// Affirmative, high-priority room-building guidance is appended after user notes.
// It guides Marble but cannot guarantee specific geometry or rendering.
export const worldGeometryInstructions = [
  "AUTHORITATIVE ROOM-BUILDING PRIORITIES: Use these priorities to guide the reconstruction while honoring the user's specific requests.",
  "PRIORITY 1 — PHOTO EVIDENCE: Use supplied photos and explicit memory notes as the source for distinctive room details. Preserve visible features, shapes, positions, colors, scale, and relationships. Represent each visible feature faithfully and once. Apply requested changes only to the features the user names.",
  "PRIORITY 2 — ONE COHERENT ROOM: For confirmed same-room photos, align shared landmarks into one connected layout with one set of walls, openings, and objects. When relationships are uncertain, use only clear shared evidence and keep ambiguous areas simple.",
  "PRIORITY 3 — STABLE 3D GEOMETRY: Build one view-consistent 3D room with straight connected walls, coherent corners, joined floor and ceiling, stable openings, consistent object scale, and plausible depth. Keep the room shape consistent as the viewpoint changes.",
  "VISIBLE OBJECTS: Preserve each visible item as a separate, recognizable, proportionate object attached to its proper surface. Match the outlines of artwork, books, shelves, screens, signs, doors, windows, curtains, beds, chairs, and furniture to the photo.",
  "UNSEEN AREAS: Continue the immediately adjacent wall, floor, ceiling, material, color, texture scale, lighting, and broad wear pattern. Keep these extensions plain, neutral, and low-detail. Use distinctive objects and personal details when they are supported by photos or notes; keep uncertain surfaces undecorated.",
  "ROOM EXTENT: Keep the reconstruction within one photographed room and the requested coverage. Resolve uncertain space with the simplest continuous layout supported by nearby evidence.",
  "SIMPLE ACCURACY: Prioritize photo fidelity and stable geometry over decoration, novelty, or extra detail. Treat the requested angular coverage as a generation preference.",
].join(" ");
