import { registerWithPassword } from "@/server/auth";
import { authErrorResponse, authResponse, readAuthBody } from "@/server/auth-response";
import { recordAuthDiagnostic } from "@/server/diagnostics";

/** POST /api/auth/register — регистрация по имени, телефону и паролю. */
export async function POST(req: Request) {
  try {
    const body = await readAuthBody(req);
    const result = await registerWithPassword({
      phone: body.phone,
      name: body.name,
      password: body.password,
      role: body.role,
      vehicle: body.vehicle,
    });
    await recordAuthDiagnostic("register_ok", result.user.id);
    return authResponse(req, result, 201);
  } catch (error) {
    return authErrorResponse(error);
  }
}
