/**
 * Utility to spread overlapping map markers so they don't stack on top of each other.
 * Now operates on lat/lng coordinates with degree-based offsets.
 */

export interface MarkerWithCoords {
  id: string;
  lat: number;
  lng: number;
  [key: string]: any;
}

export interface SpreadMarker<T extends MarkerWithCoords> extends MarkerWithCoords {
  originalLat: number;
  originalLng: number;
  wasSpread: boolean;
}

export function spreadOverlappingMarkers<T extends MarkerWithCoords>(
  markers: T[],
  minDistance: number = 0.05 // degrees
): SpreadMarker<T>[] {
  if (markers.length === 0) return [];

  const used = new Set<number>();
  const groups: number[][] = [];

  for (let i = 0; i < markers.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    used.add(i);
    for (let j = i + 1; j < markers.length; j++) {
      if (used.has(j)) continue;
      const dlat = markers[i].lat - markers[j].lat;
      const dlng = markers[i].lng - markers[j].lng;
      const dist = Math.sqrt(dlat * dlat + dlng * dlng);
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
      result.push({ ...m, originalLat: m.lat, originalLng: m.lng, wasSpread: false });
      continue;
    }

    let clat = 0, clng = 0;
    for (const idx of group) {
      clat += markers[idx].lat;
      clng += markers[idx].lng;
    }
    clat /= group.length;
    clng /= group.length;

    const radius = 0.02 * Math.max(1, group.length * 0.5);
    const angleStep = (2 * Math.PI) / group.length;

    group.forEach((idx, i) => {
      const angle = i * angleStep;
      const m = markers[idx];
      result.push({
        ...m,
        originalLat: m.lat,
        originalLng: m.lng,
        lat: clat + Math.sin(angle) * radius,
        lng: clng + Math.cos(angle) * radius,
        wasSpread: true,
      });
    });
  }

  return result;
}
