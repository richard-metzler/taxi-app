import { redirect } from "next/navigation";
import { safeNextPath } from "@/core/navigation";

/**
 * /login — совместимый адрес. Вход показывается на самих экранах ролей,
 * поэтому здесь только перенаправление на запрошенную страницу (или в корень приложения).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  redirect(safeNextPath(Array.isArray(next) ? next[0] : next, "/"));
}
