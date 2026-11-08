/**
 * Чистый расчёт стоимости по тарифу (копейки).
 * ТОЛЬКО для сервера: импортируется из src/server/pricing.ts и тестов. Не подключать в клиентский код.
 */
export type TariffRates = { baseFare: number; perKm: number; perMinute: number; minimumFare: number };

export function calculateFare(tariff: TariffRates, distanceMeters: number, durationSeconds: number): number {
  const km = Math.max(0, distanceMeters) / 1000;
  const minutes = Math.max(0, durationSeconds) / 60;
  const raw = tariff.baseFare + tariff.perKm * km + tariff.perMinute * minutes;
  const price = Math.max(tariff.minimumFare, raw);
  // Округление до рубля
  return Math.round(price / 100) * 100;
}
