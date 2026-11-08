export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;

/** Расстояние по дуге большого круга в метрах. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Проверка валидности координат. */
export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}

/** Линейная интерполяция между двумя точками (t в [0,1]). */
export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.max(0, Math.min(1, t));
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * k,
    longitude: a.longitude + (b.longitude - a.longitude) * k,
  };
}

/**
 * Точка на ломаной (массив [lat, lng]) на доле пути t в [0,1] по длине.
 */
export function pointAlongPolyline(line: [number, number][], t: number): LatLng {
  if (line.length === 0) return { latitude: 0, longitude: 0 };
  if (line.length === 1 || t <= 0) return { latitude: line[0][0], longitude: line[0][1] };
  const pts = line.map(([latitude, longitude]) => ({ latitude, longitude }));
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversineMeters(pts[i - 1], pts[i]);
    segs.push(d);
    total += d;
  }
  if (t >= 1 || total === 0) return pts[pts.length - 1];
  let target = total * t;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      return lerpLatLng(pts[i], pts[i + 1], segs[i] === 0 ? 0 : target / segs[i]);
    }
    target -= segs[i];
  }
  return pts[pts.length - 1];
}

/** Азимут от a к b в градусах. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Смещение точки на dist метров по азимуту bearing. */
export function offsetLatLng(p: LatLng, distanceMeters: number, bearing: number): LatLng {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const δ = distanceMeters / EARTH_RADIUS_M;
  const θ = toRad(bearing);
  const φ1 = toRad(p.latitude);
  const λ1 = toRad(p.longitude);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { latitude: toDeg(φ2), longitude: toDeg(λ2) };
}
