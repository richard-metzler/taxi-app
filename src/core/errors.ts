import { NextResponse } from "next/server";

/** Ошибка приложения с кодом и HTTP-статусом. Сообщения — для пользователя, на русском. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: () => new AppError("unauthorized", "Требуется вход в аккаунт", 401),
  forbidden: () => new AppError("forbidden", "Нет доступа к этому ресурсу", 403),
  notFound: (what = "Объект") => new AppError("not_found", `${what} не найден`, 404),
  validation: (msg: string) => new AppError("validation", msg, 422),
};

/** Единая обработка ошибок в API-роутах. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error("[api] Необработанная ошибка:", error);
  return NextResponse.json(
    { error: { code: "internal", message: "Внутренняя ошибка сервера. Попробуйте позже." } },
    { status: 500 },
  );
}
