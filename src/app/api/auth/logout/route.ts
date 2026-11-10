import { NextResponse } from "next/server";
import { signOut } from "@/server/auth";

// Возвращаем параметр req, так как RPC-диспетчер передает его при вызове
export async function POST(req: Request) {
  try {
    await signOut();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[logout] Ошибка при выходе:", error);
    return NextResponse.json({ error: "Ошибка выхода" }, { status: 500 });
  }
}
