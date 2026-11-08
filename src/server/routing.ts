import "server-only";
import { haversineMeters, type LatLng } from "@/core/geo";

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  /** Геометрия маршрута: массив [lat, lng]. */
  geometry: [number, number][];
  source: "osrm" | "fallback";
};

const OSRM_BASE = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";

/**
 * Построение автомобильного маршрута через OSRM.
 * При недоступности сервиса — резервная оценка по прямой с коэффициентом извилистости.
 */
export async function buildRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 0 } });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        code: string;
        routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
      };
      const route = data.routes?.[0];
      if (data.code === "Ok" && route) {
        return {
          distanceMeters: Math.round(route.distance),
          durationSeconds: Math.round(route.duration),
          geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
          source: "osrm",
        };
      }
    }
  } catch (error) {
    console.warn("[routing] OSRM недоступен, используется резервная оценка:", (error as Error).message);
  }
  const straight = haversineMeters(from, to);
  const distanceMeters = Math.round(straight * 1.3);
  const avgSpeedMps = 30 / 3.6; // ~30 км/ч в городе
  return {
    distanceMeters,
    durationSeconds: Math.round(distanceMeters / avgSpeedMps),
    geometry: [
      [from.latitude, from.longitude],
      [to.latitude, to.longitude],
    ],
    source: "fallback",
  };
}
