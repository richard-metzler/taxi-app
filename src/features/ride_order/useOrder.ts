"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import type { OrderView } from "@/shared/types";

const TERMINAL = new Set(["completed", "cancelled"]);

/**
 * Подписка на состояние заказа. Опрашивает сервер и обновляет состояние только при изменениях.
 * После восстановления соединения синхронизация возобновляется автоматически.
 */
export function useOrder(orderId: string) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const lastJsonRef = useRef<string>("");

  const load = useCallback(async () => {
    try {
      const { order } = await api.orders.get(orderId);
      const json = JSON.stringify(order);
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        setOrder(order);
      }
      setError(null);
      return order;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) setForbidden(true);
      setError(err instanceof ApiError ? err.message : "Ошибка загрузки заказа");
      return null;
    }
  }, [orderId]);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      if (inFlight) return null;
      inFlight = true;
      try {
        return await load();
      } finally {
        inFlight = false;
      }
    };
    const loop = async () => {
      const o = await run();
      if (stopped || forbidden) return;
      const interval = o && TERMINAL.has(o.status) ? 15000 : 2500;
      timer = setTimeout(loop, interval);
    };
    void loop();
    // Онлайн/фокус只是 ускоряют следующий опрос, не создавая параллельный запрос.
    const onWake = () => {
      if (stopped || inFlight) return;
      if (timer) clearTimeout(timer);
      void loop();
    };
    window.addEventListener("online", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [load, forbidden]);

  return { order, error, forbidden, reload: load };
}
