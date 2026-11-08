export type NavigatorId = "yandex" | "dgis" | "google";

/**
 * Ссылка для построения маршрута до точки в выбранном навигаторе.
 * Универсальные ссылки открывают приложение навигатора, если оно установлено, иначе — сайт.
 */
export function buildNavigatorUrl(navigator: NavigatorId, point: { latitude: number; longitude: number }): string {
  const lat = Number(point.latitude.toFixed(6));
  const lng = Number(point.longitude.toFixed(6));
  switch (navigator) {
    case "yandex":
      return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
    case "dgis":
      return `https://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
}
