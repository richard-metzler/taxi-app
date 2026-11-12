"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api";
import type { LatLng } from "@/core/geo";

const SEND_INTERVAL_MS = 4000;
const KEEPALIVE_MS = 20000;

/**
 * Передача позиции водителя на сервер, пока он на линии.
 * Позиция уходит не чаще раза в 4 секунды, а на стоянке повторяется каждые 20 секунд,
 * чтобы сервер считал водителя доступным. Пассажир видит эту позицию в реальном времени.
 */
export function useDriverLocation(enabled: boolean) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<{ point: LatLng; heading: number } | null>(null);
  const sentAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Геолокация не поддерживается этим устройством");
      return;
    }
    const send = () => {
      const last = lastRef.current;
      if (!last) return;
      sentAtRef.current = Date.now();
      void api.driver.sendLocation({ ...last.point, heading: last.heading }).catch(() => undefined);
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        lastRef.current = { point, heading: pos.coords.heading ?? 0 };
        setPosition(point);
        setError(null);
        if (Date.now() - sentAtRef.current >= SEND_INTERVAL_MS) send();
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Доступ к геолокации запрещён. Без неё заказы не поступают — разрешите доступ в настройках браузера."
            : "Не удалось определить местоположение",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    // Принудительно запрашиваем позицию сразу, не дожидаясь watchPosition
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        lastRef.current = { point, heading: pos.coords.heading ?? 0 };
        setPosition(point);
        setError(null);
        send();
      },
      undefined,
      { enableHighAccuracy: true, timeout: 10000 }
    );

    const keepAlive = setInterval(() => {
      if (Date.now() - sentAtRef.current >= KEEPALIVE_MS) send();
    }, 5000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(keepAlive);
    };
  }, [enabled]);

  return { position, error };
}
