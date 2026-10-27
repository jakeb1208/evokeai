// Generation guidance, not a renderer setting or a guarantee of complete geometry.
export const worldGeometryInstructions = [
  "View-consistent geometry guidance: Generate a coherent three-dimensional environment for nearby viewpoint changes, not a flat photograph stretched over proxy geometry.",
  "Keep wall planes, floor and ceiling intersections, corners, openings, object scale, and depth consistent across views. Avoid elongated or smeared textures, warped surfaces, floating fragments, duplicated edges, and objects fused into walls. Preserve observed fine detail and natural material scale.",
  "For small occluded gaps and unseen corners, conservatively continue the immediately adjacent wall, floor, ceiling, material color, texture scale, and lighting when the visible geometry supports that continuation. Maintain plausible surface thickness and clean connections; do not stretch foreground pixels across a hidden surface.",
  "This local continuation is an inference, not recovered evidence. Where the surroundings do not constrain a surface, use simple low-detail geometry and neutral material rather than fabricated fine detail. Do not invent distinctive furniture, photographs, text, doors, corridors, or additional rooms to fill gaps.",
  "Respect the requested angular coverage: complete local surfaces within that sector only; do not extend the world beyond it to satisfy this guidance. Preserve photo evidence and supported shared landmarks over speculative completion.",
].join(" ");
