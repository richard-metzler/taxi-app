import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { resolveSession } from "@/server/auth";
import { recordAuthDiagnostic } from "@/server/diagnostics";
import { toProfile } from "@/server/profile";
import { readTokenCandidates } from "@/server/session-transport";

/** GET /api/auth/me — восстановление сессии. */
export async function GET() {
  try {
    const session = await resolveSession();
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
