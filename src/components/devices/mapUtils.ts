/**
 * Utility to spread overlapping map markers so they don't stack on top of each other.
 * Groups markers within `minDistance` pixels and redistributes them in a circle.
 */

export interface MarkerWithCoords {
  id: string;
  x: number;
  y: number;
  [key: string]: any;
}

export interface SpreadMarker<T extends MarkerWithCoords> extends MarkerWithCoords {
  originalX: number;
  originalY: number;
  wasSpread: boolean;
}

export function spreadOverlappingMarkers<T extends MarkerWithCoords>(
  markers: T[],
  minDistance: number = 25
): SpreadMarker<T>[] {
  if (markers.length === 0) return [];

  const used = new Set<number>();
  const groups: number[][] = [];

  // Group markers that are within minDistance of each other
  for (let i = 0; i < markers.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    used.add(i);
    for (let j = i + 1; j < markers.length; j++) {
      if (used.has(j)) continue;
      const dx = markers[i].x - markers[j].x;
      const dy = markers[i].y - markers[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        group.push(j);
        used.add(j);
      }
    }
    groups.push(group);
  }

  const result: SpreadMarker<T>[] = [];

  for (const group of groups) {
    if (group.length === 1) {
      const m = markers[group[0]];
      result.push({ ...m, originalX: m.x, originalY: m.y, wasSpread: false });
      continue;
    }

    // Calculate centroid
    let cx = 0, cy = 0;
    for (const idx of group) {
      cx += markers[idx].x;
      cy += markers[idx].y;
    }
    cx /= group.length;
    cy /= group.length;

    // Spread in circle around centroid
    const radius = Math.max(minDistance * 0.8, group.length * 6);
    const angleStep = (2 * Math.PI) / group.length;
    const startAngle = -Math.PI / 2; // start from top

    group.forEach((idx, i) => {
      const angle = startAngle + i * angleStep;
      const m = markers[idx];
      result.push({
        ...m,
        originalX: m.x,
        originalY: m.y,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        wasSpread: true,
      });
    });
  }

  return result;
}
