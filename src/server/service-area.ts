/**
 * Определение зоны обслуживания по точке подачи. Чистые функции без обращения к БД
 * (используются в src/server/pricing.ts и в тестах).
 */
import { haversineMeters, type LatLng } from "../core/geo.ts";

export type ZoneLike = { id: string; name: string; latitude: number; longitude: number; radiusKm: number };

/**
 * Пригородная зона: точка вне города, но не дальше этого расстояния от границы ближайшей городской зоны.
 * Такие заказы обслуживает ближайший город (тарифы без премиальных классов).
 */
export const SUBURBAN_RANGE_KM = 250;

export type ZoneMatch<Z extends ZoneLike> =
  | { kind: "inside"; zone: Z; distanceKm: number }
  | { kind: "suburban"; zone: Z; toBorderKm: number }
  | { kind: "outside"; nearest: Z | null; distanceKm: number | null };

/** Максимальная длина поездки по прямой: межгород в MVP не поддерживается. */
export const MAX_TRIP_STRAIGHT_KM = 150;

/**
 * Зона, в которую попадает точка. Если подходят несколько зон, берётся та, чей центр ближе.
 * Вне всех городов, но в пределах SUBURBAN_RANGE_KM от границы ближайшего — пригородная зона этого города.
 * Иначе — «вне зоны» с ближайшим городом и расстоянием до границы.
 */
export function matchZone<Z extends ZoneLike>(
  point: LatLng,
  zones: readonly Z[],
  suburbanRangeKm = SUBURBAN_RANGE_KM,
): ZoneMatch<Z> {
  let inside: { zone: Z; distanceKm: number } | null = null;
  let nearest: { zone: Z; toBorderKm: number } | null = null;

  for (const zone of zones) {
    const distanceKm = haversineMeters(point, zone) / 1000;
    if (distanceKm <= zone.radiusKm) {
      if (!inside || distanceKm < inside.distanceKm) inside = { zone, distanceKm };
    } else {
      const toBorderKm = distanceKm - zone.radiusKm;
      if (!nearest || toBorderKm < nearest.toBorderKm) nearest = { zone, toBorderKm };
    }
  }

  if (inside) return { kind: "inside", zone: inside.zone, distanceKm: inside.distanceKm };
  if (nearest && nearest.toBorderKm <= suburbanRangeKm) {
    return { kind: "suburban", zone: nearest.zone, toBorderKm: nearest.toBorderKm };
  }
  return { kind: "outside", nearest: nearest?.zone ?? null, distanceKm: nearest ? nearest.toBorderKm : null };
}

/** Тарифы, которые не подаются за город (премиальные классы). */
export const CITY_ONLY_TARIFFS: readonly string[] = ["business"];

/** Округление расстояния для сообщения пользователю: «≈ 12 км», «≈ 410 км». */
export function roundKm(km: number): number {
  if (km < 10) return Math.max(1, Math.round(km));
  if (km < 100) return Math.round(km / 5) * 5;
  return Math.round(km / 10) * 10;
}

/** Название зоны для пользователя. */
export function zoneDisplayName(match: Exclude<ZoneMatch<ZoneLike>, { kind: "outside" }>): string {
  return match.kind === "suburban" ? `${match.zone.name} (пригород и область)` : match.zone.name;
}

/** Понятное сообщение, почему по адресу подачи нет тарифов. */
export function outOfZoneMessage(match: Extract<ZoneMatch<ZoneLike>, { kind: "outside" }>): string {
  if (!match.nearest || match.distanceKm === null) {
    return "Сервис пока нигде не работает: не настроено ни одной зоны обслуживания.";
  }
  return (
    `Адрес подачи слишком далеко от городов обслуживания. Ближайший — ${match.nearest.name} ` +
    `(≈ ${roundKm(match.distanceKm)} км от границы зоны). Проверьте адрес отправления.`
  );
}
