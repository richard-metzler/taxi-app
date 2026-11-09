import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fareEstimates, serviceZones, tariffZones, tariffs, type FareQuote, type Tariff } from "@/db/schema";
import { Errors, AppError } from "@/core/errors";
import { haversineMeters, isValidLatLng, type LatLng } from "@/core/geo";
import { buildRoute } from "./routing";
import { ensureSeeded } from "./seed";
import { calculateFare } from "./fare-calculator";
import { CITY_ONLY_TARIFFS, MAX_TRIP_STRAIGHT_KM, matchZone, outOfZoneMessage, zoneDisplayName } from "./service-area";
import { newId } from "./ids";

export { calculateFare };

export const ESTIMATE_TTL_MS = 1000 * 60 * 10;

export type AvailableTariffs = {
  zone: { id: string; name: string; suburban: boolean };
  tariffs: Tariff[];
  extraPickupSeconds: number;
};

const SUBURBAN_SPEED_KMH = 60;

export async function availableTariffsAt(point: LatLng): Promise<AvailableTariffs> {
  const zones = await db.select().from(serviceZones).where(eq(serviceZones.isActive, "true" as any));
  const match = matchZone(point, zones);
  if (match.kind === "outside") {
    throw new AppError("out_of_service_area", outOfZoneMessage(match), 422);
  }
  const rows = (await db
    .select({ tariff: tariffs })
    .from(tariffZones)
    .innerJoin(tariffs, eq(tariffs.id, tariffZones.tariffId))
    .where(and(eq(tariffZones.zoneId, match.zone.id), eq(tariffs.isActive, "true" as any)))
    .orderBy(asc(tariffs.sortOrder))) as Array<{ tariff: Tariff }>;
  const suburban = match.kind === "suburban";
  const list = rows.map((r) => r.tariff).filter((t) => !suburban || !CITY_ONLY_TARIFFS.includes(t.id));
  const name = zoneDisplayName(match);
  if (list.length === 0) {
    throw new AppError("no_tariffs_in_zone", `Извините, тарифы временно недоступны. Попробуйте позже или измените адрес.`, 422);
  }
  return {
    zone: { id: match.zone.id, name, suburban },
    tariffs: list,
    extraPickupSeconds: suburban ? Math.round((match.toBorderKm / SUBURBAN_SPEED_KMH) * 3600) : 0,
  };
}

function estimatePickupEta(tariffId: string): number {
  return 300; // фиксированное время подачи для упрощения
}

export type EstimateInput = {
  pickup: { address: string } & LatLng;
  destination: { address: string } & LatLng;
};

export type EstimateResult = {
  estimateId: string;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: [number, number][];
  expiresAt: string;
  routeSource: "osrm" | "fallback";
  zone: { id: string; name: string; suburban: boolean };
  tariffs: Array<{
    id: string;
    version: number;
    name: string;
    description: string;
    icon: string;
    price: number;
    pickupEtaSeconds: number;
  }>;
};

export async function createEstimate(userId: string, input: EstimateInput): Promise<EstimateResult> {
  await ensureSeeded();
  if (!isValidLatLng(input.pickup) || !isValidLatLng(input.destination)) {
    throw Errors.validation("Некорректные координаты адресов");
  }
  if (!input.pickup.address?.trim() || !input.destination.address?.trim()) {
    throw Errors.validation("Укажите адреса отправления и назначения");
  }
  if (haversineMeters(input.pickup, input.destination) < 50) {
    throw Errors.validation("Адреса отправления и назначения совпадают");
  }

  const straightKm = haversineMeters(input.pickup, input.destination) / 1000;
  if (straightKm > MAX_TRIP_STRAIGHT_KM) {
    throw new AppError(
      "trip_too_long",
      `Слишком дальняя поездка (≈ ${Math.round(straightKm)} км по прямой). Максимум ${MAX_TRIP_STRAIGHT_KM} км.`,
      422,
    );
  }

  const { zone, tariffs: available, extraPickupSeconds } = await availableTariffsAt(input.pickup);
  const route = await buildRoute(input.pickup, input.destination);

  const quotes: FareQuote[] = available.map((t) => ({
    tariffId: t.id,
    tariffVersion: t.version,
    price: calculateFare(t, route.distanceMeters, route.durationSeconds),
    pickupEtaSeconds: estimatePickupEta(t.id) + extraPickupSeconds,
  }));

  const expiresAt = new Date(Date.now() + ESTIMATE_TTL_MS);
  const estimateId = newId();

  await db.execute(sql`
    INSERT INTO fare_estimates (
      id, user_id, pickup_address, pickup_lat, pickup_lng,
      destination_address, destination_lat, destination_lng,
      distance_meters, duration_seconds, route_geometry, quotes,
      expires_at, created_at
    ) VALUES (
      CAST(${estimateId} AS Utf8), 
      CAST(${userId} AS Utf8), 
      CAST(${input.pickup.address} AS Utf8), 
      CAST(${Number(input.pickup.latitude)} AS Double), 
      CAST(${Number(input.pickup.longitude)} AS Double),
      CAST(${input.destination.address} AS Utf8), 
      CAST(${Number(input.destination.latitude)} AS Double), 
      CAST(${Number(input.destination.longitude)} AS Double),
      CAST(${route.distanceMeters} AS Int32), 
      CAST(${route.durationSeconds} AS Int32), 
      CAST(${JSON.stringify(route.geometry)} AS Utf8), 
      CAST(${JSON.stringify(quotes)} AS Utf8),
      CAST(${expiresAt.toISOString()} AS Utf8), 
      CAST(${new Date().toISOString()} AS Utf8)
    )
  `);

  return {
    estimateId: estimateId,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    routeGeometry: route.geometry,
    expiresAt: expiresAt.toISOString(),
    routeSource: route.source,
    zone,
    tariffs: available.map((t) => {
      const q = quotes.find((x) => x.tariffId === t.id)!;
      return {
        id: t.id,
        version: t.version,
        name: t.name,
        description: t.description,
        icon: t.icon,
        price: q.price,
        pickupEtaSeconds: q.pickupEtaSeconds,
      };
    }),
  };
}
