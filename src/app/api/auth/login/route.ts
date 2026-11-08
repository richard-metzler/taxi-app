import { signInWithPassword } from "@/server/auth";
import { authErrorResponse, authResponse, readAuthBody } from "@/server/auth-response";
import { recordAuthDiagnostic } from "@/server/diagnostics";

/** POST /api/auth/login — вход по номеру телефона и паролю, без SMS. */
export async function POST(req: Request) {
  try {
    const body = await readAuthBody(req);
    const result = await signInWithPassword({ phone: body.phone, password: body.password, role: body.role });
    // await recordAuthDiagnostic("login_ok", result.user.id);
    return authResponse(req, result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
