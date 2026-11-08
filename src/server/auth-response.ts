import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "@/core/errors";
import type { SignInResult } from "./auth";
import { toProfile } from "./profile";
import { isHttpsRequest } from "./request-origin";
import { serializeSessionCookie } from "./session-transport";

/** Читает небольшой JSON-объект; Content-Type не обязателен для RPC-прокси. */
export async function readAuthBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > 8192) throw new AppError("payload_too_large", "Слишком большой запрос", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError("bad_request", "Некорректный запрос к серверу", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("bad_request", "Некорректные данные формы", 400);
  }
  return body as Record<string, unknown>;
}

/** Единый ответ входа/регистрации. Хеши и открытые пароли никогда не включаются в ответ. */
export function authResponse(req: Request, result: SignInResult, status = 200): NextResponse {
  const response = NextResponse.json(
    { user: toProfile(result.user), token: result.token, expiresAt: result.expiresAt.toISOString() },
    { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } },
  );
  response.headers.append("Set-Cookie", serializeSessionCookie(result.token, result.expiresAt, isHttpsRequest(req)));
  return response;
}

/** Ошибки авторизации тоже не должны кешироваться. */
export function authErrorResponse(error: unknown): NextResponse {
  const response = error instanceof AppError
    ? NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    : NextResponse.json({ error: { code: "database_unavailable", message: "Не удалось подключиться к базе данных. Попробуйте ещё раз через минуту." } }, { status: 503 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  if (!(error instanceof AppError)) {
    console.error("[auth] Ошибка авторизации:", error instanceof Error ? error.message : "unknown");
  }
  return response;
}
