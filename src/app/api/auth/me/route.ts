import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { db } from "@/db";
import { drivers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveSession } from "@/server/auth";
import { recordAuthDiagnostic } from "@/server/diagnostics";
import { toProfile } from "@/server/profile";
import { readTokenCandidates } from "@/server/session-transport";

/** GET /api/auth/me — восстановление сессии. */
export async function GET() {
  try {
    const session = await resolveSession();
    
    // Если пользователь — пассажир, принудительно снимаем его профиль водителя с линии
    if (session?.user.role === "passenger") {
      try {
        const { db } = await import("@/db");
        const { drivers } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(drivers).set({ isOnline: false, isBusy: false }).where(eq(drivers.userId, session.user.id));
      } catch (e) {
        console.error("Ошибка снятия с линии:", e);
      }
    }

    const event = session
      ? `me_ok_${session.source}`
      : (await readTokenCandidates()).length > 0
        ? "me_unrecognized"
        : "me_anonymous";
    await recordAuthDiagnostic(event, session?.user.id ?? null);
    return NextResponse.json(
      { user: session ? toProfile(session.user) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
