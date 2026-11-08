"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/core/geo";

export type GeoState = {
  position: LatLng | null;
  error: string | null;
  loading: boolean;
};

/** Определение текущего местоположения с понятными ошибками на русском. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ position: null, error: null, loading: false });

  const locate = useCallback((): Promise<LatLng | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ position: null, error: "Геолокация не поддерживается этим устройством", loading: false });
      return Promise.resolve(null);
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setState({ position: p, error: null, loading: false });
          resolve(p);
        },
        (err) => {
          const message =
            err.code === err.PERMISSION_DENIED
              ? "Доступ к геолокации запрещён. Разрешите доступ в настройках браузера или укажите адрес вручную."
              : err.code === err.TIMEOUT
                ? "Не удалось определить местоположение: превышено время ожидания"
                : "Не удалось определить местоположение";
          setState((s) => ({ ...s, error: message, loading: false }));
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    });
  }, []);

  return { ...state, locate };
}
