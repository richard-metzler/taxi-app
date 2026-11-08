import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { createEstimate, type EstimateInput } from "@/server/pricing";

/** POST /api/fare/estimate — серверная оценка стоимости по всем доступным тарифам. */
export async function POST(req: Request) {
  try {
    const user = await requirePassenger();
    const body = (await req.json()) as EstimateInput;
    const result = await createEstimate(user.id, body);
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
