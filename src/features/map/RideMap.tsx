"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LatLng } from "@/core/geo";
import { getMapProviderConfig, type MapProviderId } from "@/core/map-provider";

export type RideMapProps = {
  center: LatLng;
  zoom?: number;
  provider?: MapProviderId;
  pickup?: LatLng | null;
  destination?: LatLng | null;
  driver?: (LatLng & { heading?: number }) | null;
  route?: [number, number][] | null;
  showDriverRoute?: boolean;
  driverRoute?: [number, number][] | null;
  userLocation?: LatLng | null;
  pickupDraggable?: boolean;
  onPickupDragEnd?: (p: LatLng) => void;
  onMapClick?: (p: LatLng) => void;
  /** Увеличивать ли при изменении точек (подгонка границ). */
  fitKey?: string;
  /** Ключ размера открытой области карты (например, после сворачивания панели). */
  layoutKey?: string | boolean;
  /** Высота перекрывающей карту панели в px — маршрут центрируется в свободной области выше неё. */
  focusPaddingBottom?: number;
  /** Внешняя команда центрирования. */
  flyTo?: { point: LatLng; nonce: number } | null;
  className?: string;
};

function makeIcon(html: string, size: number): L.DivIcon {
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

// Посадка — жёлтая пульсирующая точка со свечением.
const pickupIcon = makeIcon(
  `<div class="pulse-dot" style="width:24px;height:24px;border-radius:50%;background:#FFCC00;border:4px solid #0B0D10;box-shadow:0 0 0 6px rgba(255,204,0,.25),0 0 14px rgba(255,204,0,.85)"></div>`,
  24,
);
// Назначение — белый квадрат.
const destinationIcon = makeIcon(
  `<div style="width:20px;height:20px;border-radius:4px;background:#FFFFFF;border:3px solid #0B0D10;box-shadow:0 0 10px rgba(255,255,255,.5)"></div>`,
  20,
);
// Позиция пользователя — зелёная точка (цвет success).
const userIcon = makeIcon(
  `<div class="pulse-dot" style="width:16px;height:16px;border-radius:50%;background:#4ADE80;border:3px solid #0B0D10;box-shadow:0 0 0 6px rgba(74,222,128,.25),0 0 10px rgba(74,222,128,.7)"></div>`,
  16,
);

// Машина — вид сверху из /images/car-top.svg (жёлтая, со свечением в самом SVG).
const carIcon = L.icon({
  iconUrl: "/images/car-top.svg",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  className: "car-marker",
});

/** Поворачиваем изображение машины внутри маркера по курсу, не затрагивая позиционирование Leaflet. */
function applyHeading(marker: L.Marker | null, heading = 0) {
  const img = marker?.getElement()?.querySelector("img");
  if (img) img.style.transform = `rotate(${heading}deg)`;
}

/**
 * Карта поездки. Подложка всегда тёмная (CARTO Dark Matter, провайдер `dark`),
 * поэтому не зависит от навигатора в профиле — тот используется только для ссылок в DriverPanels.
 * Обновляются только изменившиеся слои.
 */
export default function RideMap(props: RideMapProps) {
  // Тайлы берём у выбранного провайдера (по умолчанию Яндекс, как до смены темы),
  // а тёмный вид получаем CSS-фильтром — так карта не зависит от доступности стороннего CDN.
  return <RideMapCanvas {...props} provider={props.provider ?? "yandex"} />;
}

function RideMapCanvas(props: RideMapProps & { provider: MapProviderId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupRef = useRef<L.Marker | null>(null);
  const destRef = useRef<L.Marker | null>(null);
  const driverRef = useRef<L.Marker | null>(null);
  const userRef = useRef<L.Marker | null>(null);
  const routeGlowRef = useRef<L.Polyline | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const driverRouteRef = useRef<L.Polyline | null>(null);
  const callbacksRef = useRef({ onPickupDragEnd: props.onPickupDragEnd, onMapClick: props.onMapClick });

  // Актуальные колбэки для обработчиков Leaflet храним в ref, но обновляем его
  // вне рендера — во избежание чтения/записи ref во время рендера.
  useEffect(() => {
    callbacksRef.current = { onPickupDragEnd: props.onPickupDragEnd, onMapClick: props.onMapClick };
  }, [props.onPickupDragEnd, props.onMapClick]);

  const providerConfig = getMapProviderConfig(props.provider);

  // Инициализация карты с проекцией и тайлами выбранного провайдера
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const crs = providerConfig.crs === "EPSG3395" ? L.CRS.EPSG3395 : L.CRS.EPSG3857;
    const map = L.map(containerRef.current, {
      crs,
      center: [props.center.latitude, props.center.longitude],
      zoom: props.zoom ?? 14,
      zoomControl: false,
      attributionControl: true,
    });
    const tileOptions: L.TileLayerOptions = {
      maxZoom: providerConfig.maxZoom,
      attribution: providerConfig.attribution,
    };
    if (providerConfig.subdomains) tileOptions.subdomains = providerConfig.subdomains;
    L.tileLayer(providerConfig.tileUrl, tileOptions).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      callbacksRef.current.onMapClick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });
    mapRef.current = map;
    const initTimer = setTimeout(() => {
      if (mapRef.current === map) map.invalidateSize();
    }, 50);
    return () => {
      clearTimeout(initTimer);
      map.remove();
      mapRef.current = null;
      pickupRef.current = null;
      destRef.current = null;
      driverRef.current = null;
      userRef.current = null;
      routeGlowRef.current = null;
      routeRef.current = null;
      driverRouteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Маркер отправления
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!props.pickup) {
      pickupRef.current?.remove();
      pickupRef.current = null;
      return;
    }
    const ll: L.LatLngExpression = [props.pickup.latitude, props.pickup.longitude];
    if (!pickupRef.current) {
      const m = L.marker(ll, { icon: pickupIcon, draggable: !!props.pickupDraggable, zIndexOffset: 500 }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        callbacksRef.current.onPickupDragEnd?.({ latitude: p.lat, longitude: p.lng });
      });
      pickupRef.current = m;
    } else {
      pickupRef.current.setLatLng(ll);
      if (props.pickupDraggable) pickupRef.current.dragging?.enable();
      else pickupRef.current.dragging?.disable();
    }
  }, [props.pickup, props.pickupDraggable]);

  // Маркер назначения
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!props.destination) {
      destRef.current?.remove();
      destRef.current = null;
      return;
    }
    const ll: L.LatLngExpression = [props.destination.latitude, props.destination.longitude];
    if (!destRef.current) destRef.current = L.marker(ll, { icon: destinationIcon, zIndexOffset: 400 }).addTo(map);
    else destRef.current.setLatLng(ll);
  }, [props.destination]);

  // Позиция пользователя
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!props.userLocation) {
      userRef.current?.remove();
      userRef.current = null;
      return;
    }
    const ll: L.LatLngExpression = [props.userLocation.latitude, props.userLocation.longitude];
    if (!userRef.current) userRef.current = L.marker(ll, { icon: userIcon, interactive: false }).addTo(map);
    else userRef.current.setLatLng(ll);
  }, [props.userLocation]);

  // Маркер водителя — обновляется точечно
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!props.driver) {
      driverRef.current?.remove();
      driverRef.current = null;
      return;
    }
    const ll: L.LatLngExpression = [props.driver.latitude, props.driver.longitude];
    if (!driverRef.current) {
      driverRef.current = L.marker(ll, { icon: carIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      driverRef.current.setLatLng(ll);
      driverRef.current.setIcon(carIcon);
    }
    applyHeading(driverRef.current, props.driver.heading);
  }, [props.driver]);

  // Маршрут: два слоя — широкое жёлтое свечение и яркая жёлтая линия поверх него.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeGlowRef.current?.remove();
    routeRef.current?.remove();
    routeGlowRef.current = null;
    routeRef.current = null;
    if (props.route && props.route.length > 1) {
      routeGlowRef.current = L.polyline(props.route, {
        color: "#FFCC00",
        weight: 11,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
        className: "route-glow",
      }).addTo(map);
      routeRef.current = L.polyline(props.route, {
        color: "#FFD84D",
        weight: 5,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }
  }, [props.route]);

  // Подгонка границ и зума: маршрут и точки вписываются в свободную область карты
  // (между шапкой и панелью ввода). Используем реальную высоту панели как нижний padding.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const size = map.getSize();
    if (size.x < 40 || size.y < 40) return;
    const pts: L.LatLngExpression[] = [];
    if (props.route && props.route.length > 1) {
      for (const [lat, lng] of props.route) pts.push([lat, lng]);
    }
    if (props.pickup) pts.push([props.pickup.latitude, props.pickup.longitude]);
    if (props.destination) pts.push([props.destination.latitude, props.destination.longitude]);
    if (props.driver) pts.push([props.driver.latitude, props.driver.longitude]);
    if (pts.length === 0) return;
    const bounds = L.latLngBounds(pts);
    const pad = props.focusPaddingBottom ?? 0;
    const topInset = 130; // шапка + плашки над картой
    const bottomInset = pad + 40; // панель ввода + запас
    const horizontal = 36;
    const visibleW = Math.max(80, size.x - horizontal * 2);
    const visibleH = Math.max(80, size.y - topInset - bottomInset);
    if (visibleH < 80) return;

    // Вычисляем зум, при котором bounds помещаются в видимую область.
    let targetZoom = 15;
    if (pts.length >= 2) {
      const zoom = map.getBoundsZoom(bounds, false, L.point(0, 0));
      const sw = map.project(bounds.getSouthWest(), zoom);
      const ne = map.project(bounds.getNorthEast(), zoom);
      const spanX = Math.max(1, Math.abs(ne.x - sw.x));
      const spanY = Math.max(1, Math.abs(ne.y - sw.y));
      const fitZoom = Math.min(
        zoom,
        zoom + Math.log2(visibleW / spanX),
        zoom + Math.log2(visibleH / spanY),
        16,
      );
      targetZoom = Math.max(0, fitZoom);
    }

    // Центр bounds смещаем вниз на half видимой области, чтобы он оказался выше панели.
    const centerPx = map.project(bounds.getCenter(), targetZoom);
    const shiftY = (topInset + visibleH / 2) - size.y / 2;
    const center = map.unproject([centerPx.x, centerPx.y - shiftY], targetZoom);

    if (pts.length === 1) {
      map.setView(center, targetZoom, { animate: false });
    } else {
      map.setView(center, targetZoom, { animate: false });
    }
  }, [props.fitKey, props.focusPaddingBottom, props.route, props.pickup, props.destination, props.driver]);

  // Внешняя команда центрирования — тоже в видимую область выше панели.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.flyTo) return;
    // Когда есть маршрут, центрированием управляет эффект подгонки зума.
    if (props.route && props.route.length > 1) return;
    const p: L.LatLngExpression = [props.flyTo.point.latitude, props.flyTo.point.longitude];
    const bottom = (props.focusPaddingBottom ?? 0) + 24;
    map.flyToBounds(L.latLngBounds([p, p]), {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, bottom],
      maxZoom: 16,
      duration: 0.6,
    });
  }, [props.flyTo, props.focusPaddingBottom, props.route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => map.invalidateSize(), 180);
    return () => clearTimeout(timer);
  }, [props.layoutKey]);


  // Жёлтый пунктир маршрута водителя до пассажира (строится по дорогам и обрезается)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    driverRouteRef.current?.remove();
    driverRouteRef.current = null;

    if (props.showDriverRoute && props.driver && props.pickup) {
      // Если передан готовый маршрут, используем его
      if (props.driverRoute && props.driverRoute.length > 1) {
        // Обрезаем маршрут: оставляем только часть от текущей позиции водителя до пассажира
        const fullRoute = props.driverRoute;
        // Находим ближайшую точку маршрута к водителю
        let closestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < fullRoute.length; i++) {
          const d = Math.abs(fullRoute[i][0] - props.driver.latitude) + Math.abs(fullRoute[i][1] - props.driver.longitude);
          if (d < minDist) { minDist = d; closestIdx = i; }
        }
        
        const remainingRoute = fullRoute.slice(closestIdx);
        if (remainingRoute.length > 1) {
          driverRouteRef.current = L.polyline(remainingRoute, {
            color: "#FFCC00", weight: 5, opacity: 0.9, dashArray: "8, 8"
          }).addTo(map);
          return;
        }
      }
      
      // Fallback: прямая линия, если маршрута нет
      driverRouteRef.current = L.polyline(
        [[props.driver.latitude, props.driver.longitude], [props.pickup.latitude, props.pickup.longitude]],
        { color: "#FFCC00", weight: 5, opacity: 0.9, dashArray: "8, 8" }
      ).addTo(map);
    }
  }, [props.showDriverRoute, props.driver, props.pickup, props.driverRoute]);

  return (
    <div
      ref={containerRef}
      data-map-provider={providerConfig.id}
      className={`dark-map ${props.className ?? "h-full w-full"}`}
    />
  );
}
