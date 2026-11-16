import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { signOut } from "@/server/auth";
import { isSecureRequest } from "@/server/request-origin";
import { serializeClearSessionCookies } from "@/server/session-transport";

// Возвращаем параметр req, так как RPC-диспетчер передает его при вызове
export async function POST(req: Request) {
  try {
    await signOut();
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    for (const cookie of serializeClearSessionCookies(isSecureRequest(req))) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
