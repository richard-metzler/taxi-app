import { useEffect } from "react";

export function usePresenceTracker(userId: string | number | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const sendStatus = (isOnline: boolean) => {
      const payload = JSON.stringify({ userId, isOnline });
      // sendBeacon надежно доставит запрос даже при закрытии страницы
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/presence", payload);
      } else {
        fetch("/api/presence", { method: "POST", body: payload, keepalive: true }).catch(() => {});
      }
    };

    // Отмечаемся онлайн при монтировании
    sendStatus(true);

    const handleVisibility = () => {
      sendStatus(document.visibilityState === "visible");
    };

    const handlePageHide = () => sendStatus(false);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    // Пульс каждые 20 секунд
    const interval = setInterval(() => {
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    }, 20000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      clearInterval(interval);
      sendStatus(false);
    };
  }, [userId]);
}
