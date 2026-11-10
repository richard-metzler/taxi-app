"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LatLng } from "@/core/geo";
import { getMapProviderConfig, type MapProviderId } from "@/core/map-provider";
import { useSession } from "@/shared/session";

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
  /** Внешняя команда центрирования. */
  flyTo?: { point: LatLng; nonce: number } | null;
  className?: string;
};

function makeIcon(html: string, size: number): L.DivIcon {
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

const pickupIcon = makeIcon(
  `<div style="width:22px;height:22px;border-radius:50%;background:#426D91;border:4px solid #fff;box-shadow:0 2px 8px rgba(38,52,69,.35)"></div>`,
  22,
);
const destinationIcon = makeIcon(
  `<div style="width:22px;height:22px;border-radius:6px;background:#263445;border:4px solid #fff;box-shadow:0 2px 8px rgba(38,52,69,.35)"></div>`,
  22,
);
const userIcon = makeIcon(
  `<div class="pulse-dot" style="width:16px;height:16px;border-radius:50%;background:#419B78;border:3px solid #fff;box-shadow:0 0 0 6px rgba(65,155,120,.25)"></div>`,
  16,
);

function carIcon(heading = 0): L.DivIcon {
  return makeIcon(
    `<div style="transform:rotate(${heading}deg);width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#E9EDF2;box-shadow:3px 3px 8px #c6ccd4,-3px -3px 8px #fff;font-size:20px;line-height:1">🚖</div>`,
    36,
  );
}

/**
 * Карта поездки. Использует картографический сервис, выбранный в настройках профиля
 * (Яндекс Карты, 2ГИС или Google Карты), и обновляет только изменившиеся слои.
 */
export default function RideMap(props: RideMapProps) {
  const { user } = useSession();
  const activeProvider = props.provider ?? user?.navigator ?? "yandex";
  return <RideMapCanvas key={activeProvider} {...props} provider={activeProvider} />;
}

function RideMapCanvas(props: RideMapProps & { provider: MapProviderId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupRef = useRef<L.Marker | null>(null);
  const destRef = useRef<L.Marker | null>(null);
  const driverRef = useRef<L.Marker | null>(null);
  const userRef = useRef<L.Marker | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const driverRouteRef = useRef<L.Polyline | null>(null);
  const callbacksRef = useRef({ onPickupDragEnd: props.onPickupDragEnd, onMapClick: props.onMapClick });
  callbacksRef.current = { onPickupDragEnd: props.onPickupDragEnd, onMapClick: props.onMapClick };

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
    L.tileLayer(providerConfig.tileUrl, {
      maxZoom: providerConfig.maxZoom,
      attribution: providerConfig.attribution,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      callbacksRef.current.onMapClick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
      mapRef.current = null;
      pickupRef.current = null;
      destRef.current = null;
      driverRef.current = null;
      userRef.current = null;
      routeRef.current = null;
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
      driverRef.current = L.marker(ll, { icon: carIcon(props.driver.heading), zIndexOffset: 1000 }).addTo(map);
    } else {
      driverRef.current.setLatLng(ll);
      driverRef.current.setIcon(carIcon(props.driver.heading));
    }
  }, [props.driver]);

  // Маршрут
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeRef.current?.remove();
    routeRef.current = null;
    if (props.route && props.route.length > 1) {
      routeRef.current = L.polyline(props.route, { color: "#426D91", weight: 5, opacity: 0.85 }).addTo(map);
    }
  }, [props.route]);

  // Подгонка границ
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.fitKey) return;
    const pts: L.LatLngExpression[] = [];
    if (props.pickup) pts.push([props.pickup.latitude, props.pickup.longitude]);
    if (props.destination) pts.push([props.destination.latitude, props.destination.longitude]);
    if (props.driver) pts.push([props.driver.latitude, props.driver.longitude]);
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16 });
    } else if (pts.length === 1) {
      map.setView(pts[0], 15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fitKey]);

  // Внешняя команда центрирования
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.flyTo) return;
    map.flyTo([props.flyTo.point.latitude, props.flyTo.point.longitude], 16, { duration: 0.6 });
  }, [props.flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => map.invalidateSize(), 180);
    return () => clearTimeout(timer);
  }, [props.layoutKey]);


  // Зеленый маршрут водителя до пассажира
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    driverRouteRef.current?.remove();
    driverRouteRef.current = null;

    if (props.showDriverRoute && props.driverRoute && props.driver) {
      let closestIdx = 0;
      let minDst = Infinity;
      const dLat = props.driver.latitude;
      const dLng = props.driver.longitude;

      // Ищем ближайшую точку на маршруте к текущему положению машины
      for (let i = 0; i < props.driverRoute.length; i++) {
        const p = props.driverRoute[i];
        const dist = (p[0] - dLat) ** 2 + (p[1] - dLng) ** 2; 
        if (dist < minDst) {
          minDst = dist;
          closestIdx = i;
        }
      }

      // Берем текущую позицию машины и оставшуюся часть маршрута
      const remainingRoute = [
        [dLat, dLng] as [number, number],
        ...props.driverRoute.slice(closestIdx)
      ];

      if (remainingRoute.length > 1) {
        driverRouteRef.current = L.polyline(
          remainingRoute,
          { color: "#10b981", weight: 5, opacity: 0.8 }
        ).addTo(map);
      }
    }
  }, [props.showDriverRoute, props.driverRoute, props.driver]);

  return (
    <div
      ref={containerRef}
      data-map-provider={providerConfig.id}
      className={props.className ?? "h-full w-full"}
    />
  );
}
