import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { getOrderView } from "@/server/orders";

// ЖЕСТКО ОТКЛЮЧАЕМ КЕШ, чтобы сервер каждый раз запускал диспетчер
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePassenger();
    const { id } = await params; // В Next.js 16 params — это Promise
    const order = await getOrderView(user, id);
    return NextResponse.json({ order });
  } catch (e) {
    return handleApiError(e);
  }
}
