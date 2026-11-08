import { NextResponse } from "next/server";
import { describeTransport } from "@/server/session-transport";

/**
 * GET /api/diagnostics/transport — какие способы передачи сессии дошли до сервера.
 * Только признаки наличия и имена заголовков, без значений токенов.
 */
export async function GET() {
  const t = await describeTransport();
  return NextResponse.json(
    {
      bodySession: t.bodySession,
      viaRpc: t.viaRpc,
      authorization: t.authorization,
      sessionHeader: t.sessionHeader,
      cookie: t.cookie,
      clientHeader: t.clientHeader,
      forwardedProto: t.forwardedProto,
      secFetchSite: t.secFetchSite,
      headerNames: t.headerNames,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
