import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { signOut } from "@/server/auth";
import { isHttpsRequest } from "@/server/request-origin";
import { serializeClearSessionCookies } from "@/server/session-transport";

/** POST /api/auth/logout — выход: сессия удаляется на сервере, cookie очищаются во всех вариантах. */
export async function POST(req: Request) {
  try {
    await signOut();
    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    for (const cookie of serializeClearSessionCookies(isHttpsRequest(req))) res.headers.append("Set-Cookie", cookie);
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
