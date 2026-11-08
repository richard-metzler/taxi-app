import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fareEstimates, serviceZones, tariffZones, tariffs, type FareQuote, type Tariff } from "@/db/schema";
import { newId } from "./ids";
import { Errors, AppError } from "@/core/errors";
import { haversineMeters, isValidLatLng, type LatLng } from "@/core/geo";
import { buildRoute } from "./routing";
import { ensureSeeded } from "./seed";
import { calculateFare } from "./fare-calculator";
import { CITY_ONLY_TARIFFS, MAX_TRIP_STRAIGHT_KM, matchZone, outOfZoneMessage, zoneDisplayName } from "./service-area";

export { calculateFare };

export const ESTIMATE_TTL_MS = 1000 * 60 * 10; // оценка действительна 10 минут

/** Зона точки подачи и доступные в ней тарифы. */
export type AvailableTariffs = {
  zone: { id: string; name: string; suburban: boolean };
  tariffs: Tariff[];
  /** Дополнительное время подачи из города (для пригородных заказов), секунды. */
  extraPickupSeconds: number;
};

/** Средняя скорость подачи за город, км/ч. */
const SUBURBAN_SPEED_KMH = 60;

/**
 * Тарифы, доступные в точке подачи. В городе — тарифы его зоны; в пригороде и области
 * (до SUBURBAN_RANGE_KM от границы) — тарифы ближайшего города без премиальных классов.
 * Дальше — понятная ошибка с ближайшим городом.
 */
export async function availableTariffsAt(point: LatLng): Promise<AvailableTariffs> {
  const zones = await db.select().from(serviceZones).where(eq(serviceZones.isActive, "true"));
  const match = matchZone(point, zones);
  if (match.kind === "outside") {
    throw new AppError("out_of_service_area", outOfZoneMessage(match), 422);
  }
  const rows = await db
    .select({ tariff: tariffs })
    .from(tariffZones)
    .innerJoin(tariffs, eq(tariffs.id, tariffZones.tariffId))
    .where(and(eq(tariffZones.zoneId, match.zone.id), eq(tariffs.isActive, "true")))
    .orderBy(asc(tariffs.sortOrder));
  const suburban = match.kind === "suburban";
  const list = rows.map((r: { tariff: Tariff }) => r.tariff).filter((t: Tariff) => !suburban || !CITY_ONLY_TARIFFS.includes(t.id));
  const name = zoneDisplayName(match);
  if (list.length === 0) {
    throw new AppError("no_tariffs_in_zone", `В зоне «${name}» сейчас нет доступных тарифов`, 422);
  }
  return {
    zone: { id: match.zone.id, name, suburban },
    tariffs: list,
    extraPickupSeconds: suburban ? Math.round((match.toBorderKm / SUBURBAN_SPEED_KMH) * 3600) : 0,
  };
}

/** Оценка времени подачи в секундах — зависит от класса и загруженности (упрощённо). */
function estimatePickupEta(tariffId: string): number {
  const base: Record<string, number> = { econom: 240, comfort: 360, business: 540 };
  return base[tariffId] ?? 300;
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
  /** Зона обслуживания точки подачи (suburban — пригород/область ближайшего города). */
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

/** Серверная оценка поездки по всем доступным тарифам. Сохраняется для последующего создания заказа. */
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
      `Слишком дальняя поездка (≈ ${Math.round(straightKm)} км по прямой). Междугородние поездки пока не поддерживаются — максимум ${MAX_TRIP_STRAIGHT_KM} км.`,
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
  const [estimate] = await db
    .insert(fareEstimates)
    .values({
      userId,
      pickupAddress: input.pickup.address,
      pickupLat: input.pickup.latitude,
      pickupLng: input.pickup.longitude,
      destinationAddress: input.destination.address,
      destinationLat: input.destination.latitude,
      destinationLng: input.destination.longitude,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      routeGeometry: route.geometry,
      quotes,
      expiresAt,
    })
    .returning();

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
