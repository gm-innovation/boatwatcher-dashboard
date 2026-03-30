/**
 * Utility to spread overlapping map markers so they don't stack on top of each other.
 * Groups markers within `minDistance` pixels and redistributes them in a seaward fan.
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

/**
 * For coastal markers, determines the preferred spread direction (toward the ocean).
 * Returns an angle in radians pointing "seaward".
 * Brazil's coast is roughly on the east/southeast side, so we bias east (0 rad)
 * or southeast (+π/4). For specific regions we can be more precise.
 */
function getSeawardAngle(cx: number, cy: number): number {
  // Southern coast (RS, SC, PR, SP) – ocean is to the east/southeast
  if (cy > 450) return Math.PI / 6;       // ~30° (east-southeast)
  // RJ / ES region – ocean is to the east
  if (cy > 360 && cx > 450) return 0;      // east
  // BA coast – ocean is to the east
  if (cy > 240 && cx > 500) return 0;      // east
  // NE coast – ocean is to the east/northeast
  if (cy < 240 && cx > 540) return -Math.PI / 6; // ~-30° (east-northeast)
  // North (AM/PA) – default south
  if (cy < 150) return Math.PI / 2;        // south
  // Default: east
  return 0;
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

    // Spread in a SEAWARD FAN (≤180°) instead of a full circle
    const seawardAngle = getSeawardAngle(cx, cy);
    const radius = Math.max(minDistance * 0.8, group.length * 6);
    const fanSpan = Math.min(Math.PI, group.length * 0.4); // up to 180°
    const angleStep = group.length > 1 ? fanSpan / (group.length - 1) : 0;
    const startAngle = seawardAngle - fanSpan / 2;

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
