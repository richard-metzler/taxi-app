import { NextResponse } from "next/server";
import { Errors, handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { createOrder, listOrders } from "@/server/orders";

export async function GET() {
  try {
    const user = await requirePassenger();
    const items = await listOrders(user);
    return NextResponse.json({ items });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePassenger();
    const { estimateId, tariffId } = (await req.json()) as { estimateId?: string; tariffId?: string };
    if (!estimateId || !tariffId) throw Errors.validation("Не указаны расчёт или тариф");
    
    const order = await createOrder(user, estimateId, tariffId);
    
    // Возвращаем orderId для фронтенда
    return NextResponse.json({ orderId: order.id, status: order.status }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
