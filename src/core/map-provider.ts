import type { UserProfile } from "../shared/types.ts";

export type MapProviderId = UserProfile["navigator"];

export type MapProviderConfig = {
  id: MapProviderId;
  name: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  crs: "EPSG3395" | "EPSG3857";
};

/**
 * Конфигурация картографических подложек по выбранному навигатору в профиле:
 * - yandex: тайлы Яндекс Карт (проекция Меркатора EPSG:3395)
 * - dgis: тайлы 2ГИС (сферический Меркатор EPSG:3857)
 * - google: тайлы Google Карт на русском языке (EPSG:3857)
 */
export const MAP_PROVIDERS: Record<MapProviderId, MapProviderConfig> = {
  yandex: {
    id: "yandex",
    name: "Яндекс Карты",
    tileUrl: "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU",
    attribution: '&copy; <a href="https://yandex.ru/maps" target="_blank" rel="noreferrer">Яндекс Карты</a>',
    maxZoom: 19,
    crs: "EPSG3395",
  },
  dgis: {
    id: "dgis",
    name: "2ГИС",
    tileUrl: "https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1",
    attribution: '&copy; <a href="https://2gis.ru" target="_blank" rel="noreferrer">2ГИС</a>',
    maxZoom: 18,
    crs: "EPSG3857",
  },
  google: {
    id: "google",
    name: "Google Карты",
    tileUrl: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru",
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Карты</a>',
    maxZoom: 20,
    crs: "EPSG3857",
  },
};

export function getMapProviderConfig(provider?: MapProviderId | null): MapProviderConfig {
  if (provider && provider in MAP_PROVIDERS) {
    return MAP_PROVIDERS[provider];
  }
  return MAP_PROVIDERS.yandex;
}
