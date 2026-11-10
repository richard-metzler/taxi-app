import { NextResponse } from "next/server";
import { signOut } from "@/server/auth";

export async function POST() {
  try {
    // На сервере просто вызываем функцию выхода, без всяких localStorage
    await signOut();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[logout] Ошибка при выходе:", error);
    return NextResponse.json({ error: "Ошибка выхода" }, { status: 500 });
  }
}
