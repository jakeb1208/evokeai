/** Requested generation coverage, not a native Marble geometry constraint. */
export function parseWorldCoverage(value: unknown): number | null {
  if (value === undefined) return 360;
  return typeof value === "number" && Number.isInteger(value) && value >= 180 && value <= 360
    ? value
    : null;
}

export function worldCoverageInstructions(degrees: number): string {
  if (degrees === 360) {
    return "Requested horizontal world coverage: 360 degrees, a full surrounding environment. Preserve photo evidence and keep unsupported areas simple rather than inventing distinctive details.";
  }
  const half = degrees / 2;
  return [
    `Requested horizontal world coverage: ${degrees} degrees total, extending ${half} degrees left and ${half} degrees right from the initial forward-facing viewpoint.`,
    "Generate the actual 3D scene as a partial environment within this angular sector, not a complete surrounding room merely shown through a cropped camera.",
    "When photos are supplied, use photo 1 as the primary forward-facing reference and reconcile other photos as evidence of that same space without duplicating features.",
    `Leave the remaining ${360 - degrees} degrees outside this sector empty and unmodeled; do not fill it with invented walls, rooms, corridors, furniture, or a mirrored copy of the reference.`,
    "Do not compress or stretch a full room to fit the requested sector. Prioritize visible evidence and detail within the requested coverage.",
  ].join(" ");
}
