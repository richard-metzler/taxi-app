"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import type { OrderView } from "@/shared/types";

const TERMINAL = new Set(["paid", "cancelled"]);

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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      const o = await load();
      if (stopped || forbidden) return;
      const interval = o && TERMINAL.has(o.status) ? 15000 : 2500;
      timer = setTimeout(loop, interval);
    };
    void loop();
    const onOnline = () => void load();
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onOnline);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onOnline);
    };
  }, [load, forbidden]);

  return { order, error, forbidden, reload: load };
}
