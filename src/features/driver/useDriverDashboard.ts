"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import type { AvailableOrderView, DriverStateView } from "@/shared/driver-types";

const POLL_MS = 3000;

/**
 * Состояние водителя: профиль, текущий заказ и заказы рядом.
 * Опрашивает сервер и обновляет интерфейс только при изменениях; после восстановления
 * связи и возврата в окно синхронизируется сразу.
 */
export function useDriverDashboard() {
  const [state, setState] = useState<DriverStateView | null>(null);
  const [available, setAvailable] = useState<AvailableOrderView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stateJson = useRef("");
  const availableJson = useRef("[]");

  const fetchOnce = useCallback(async () => {
    try {
      const next = await api.driver.state();
      const json = JSON.stringify(next);
      if (json !== stateJson.current) {
        stateJson.current = json;
        setState(next);
      }
      if (next.driver.isOnline && !next.currentOrder) {
        const { items } = await api.driver.availableOrders();
        const itemsJson = JSON.stringify(items);
        if (itemsJson !== availableJson.current) {
          availableJson.current = itemsJson;
          setAvailable(items);
        }
      } else if (availableJson.current !== "[]") {
        availableJson.current = "[]";
        setAvailable([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Нет связи с сервером");
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      await fetchOnce();
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    const onWake = () => void fetchOnce();
    window.addEventListener("online", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [fetchOnce]);

  return { state, available, error, reload: fetchOnce };
}
