import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requireAccount } from "@/server/auth";
import { toProfile, updateProfile } from "@/server/profile";

/** PATCH /api/profile — имя и навигатор (пассажир и водитель). Роль изменить нельзя. */
export async function PATCH(req: Request) {
  try {
    const user = await requireAccount();
    const body = (await req.json()) as { name?: string; navigator?: string };
    const updated = await updateProfile(user, body);
    return NextResponse.json({ user: toProfile(updated) });
  } catch (e) {
    return handleApiError(e);
  }
}
