import { AppError } from "@/core/errors";
import { authErrorResponse, authResponse, readAuthBody } from "@/server/auth-response";
import { signInWithMax } from "@/server/auth";
import { validateMaxInitData } from "@/server/max-init-data";

/** POST /api/auth/max — вход через мини-приложение MAX с проверкой подписи initData. */
export async function POST(req: Request) {
  try {
    const body = await readAuthBody(req);
    const initData = typeof body.initData === "string" ? body.initData : "";
    // Некорректный формат — это ошибка клиента (401), а не отсутствие настроек сервера (503).
    if (!initData || !/hash=/.test(initData)) {
      throw new AppError("invalid_init_data", "Не удалось подтвердить данные MAX", 401);
    }
    const role = body.role === "driver" ? "driver" : "passenger";
    const name = typeof body.name === "string" ? body.name.trim() : undefined;

    // Идентификатор и имя берём только из проверенных данных initData.
    const verified = validateMaxInitData(initData, process.env.MAX_BOT_TOKEN ?? "");
    const result = await signInWithMax(verified.userId, role, name || verified.name);
    return authResponse(req, result, 200);
  } catch (error) {
    return authErrorResponse(error);
  }
}
