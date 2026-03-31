/**
 * Utility to spread overlapping map markers so they don't stack on top of each other.
 * Groups markers within `minDistance` pixels and redistributes them in a directional fan
 * based on the geographic region (coastal areas spread along the coast, not inland).
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
 * Returns a preferred spread angle (radians) and optional constraints for a given region.
 * Angles: 0 = right (east), π/2 = down (south), -π/2 = up (north), π = left (west).
 *
 * For Guanabara Bay: spread north-south within the bay (avoid going east into ocean
 * or west into land). Bay runs roughly y=425→432 between x=494 and x=515.
 */
function getSpreadDirection(cx: number, cy: number): { angle: number; fanSpanMax: number } {
  // Guanabara Bay region (x: 490-520, y: 420-435)
  // Spread roughly south (downward in SVG) to stay inside the bay
  if (cx > 475 && cx < 500 && cy > 440 && cy < 458) {
    return { angle: Math.PI / 2, fanSpanMax: Math.PI * 0.6 }; // south, narrow fan
  }

  // Angra dos Reis (x: 450-470, y: 445-460) – spread southeast along coast
  if (cx > 450 && cx < 470 && cy > 445 && cy < 460) {
    return { angle: Math.PI / 3, fanSpanMax: Math.PI * 0.5 }; // ~60° (SE)
  }

  // Macaé / Açu / north RJ coast (x: 490-515, y: 410-420) – spread south
  if (cx > 490 && cx < 515 && cy > 410 && cy < 420) {
    return { angle: Math.PI / 2, fanSpanMax: Math.PI * 0.5 };
  }

  // ES coast (x: 510-540, y: 370-420) – spread east
  if (cx > 510 && cx < 540 && cy > 370 && cy < 420) {
    return { angle: 0, fanSpanMax: Math.PI * 0.6 };
  }

  // Southern coast (RS, SC, PR, SP) – spread east/southeast
  if (cy > 450) return { angle: Math.PI / 6, fanSpanMax: Math.PI };
  // RJ/ES general – spread east
  if (cy > 360 && cx > 450) return { angle: 0, fanSpanMax: Math.PI };
  // BA coast – spread east
  if (cy > 240 && cx > 500) return { angle: 0, fanSpanMax: Math.PI };
  // NE coast – spread east-northeast
  if (cy < 240 && cx > 540) return { angle: -Math.PI / 6, fanSpanMax: Math.PI };
  // North (AM/PA) – spread south
  if (cy < 150) return { angle: Math.PI / 2, fanSpanMax: Math.PI };
  // Default: east
  return { angle: 0, fanSpanMax: Math.PI };
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

    // Get region-specific spread direction
    const { angle: spreadAngle, fanSpanMax } = getSpreadDirection(cx, cy);
    const radius = Math.max(minDistance * 0.8, group.length * 6);
    const fanSpan = Math.min(fanSpanMax, group.length * 0.4);
    const angleStep = group.length > 1 ? fanSpan / (group.length - 1) : 0;
    const startAngle = spreadAngle - fanSpan / 2;

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
