export function logClient(message: string, data?: any) {
  fetch("/api/debug", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, data }),
  }).catch(() => {});
}
