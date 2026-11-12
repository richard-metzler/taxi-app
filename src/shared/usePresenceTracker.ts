import { useEffect } from "react";

export function usePresenceTracker(userId: string | number | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const sendStatus = (isOnline: boolean) => {
      const payload = JSON.stringify({ userId, isOnline });
      // Используем fetch с keepalive: true, он надежнее в WebView, чем sendBeacon
      fetch("/api/presence", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: payload, 
        keepalive: true 
      }).catch((e) => console.error("Presence error:", e));
    };

    sendStatus(true);
    const handleVisibility = () => sendStatus(document.visibilityState === "visible");
    const handlePageHide = () => sendStatus(false);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

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
