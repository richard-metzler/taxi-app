import "server-only";
import { randomUUID } from "node:crypto";
import { newId } from "./ids";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents, orders, payments, type Payment, type PaymentStatus, type User } from "@/db/schema";
import { AppError, Errors } from "@/core/errors";
import { advanceSimulation } from "./dispatch";

const YOOKASSA_API = "https://api.yookassa.ru/v3";

type YooPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  payment_method?: { type?: string; title?: string };
  cancellation_details?: { party?: string; reason?: string };
  metadata?: Record<string, string>;
};

/** Настроены ли учётные данные ЮKassa (секреты только на сервере). */
export function isYooKassaConfigured(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID ?? "";
  const secret = process.env.YOOKASSA_SECRET_KEY ?? "";
  return "Basic " + Buffer.from(`${shopId}:${secret}`).toString("base64");
}

async function yooRequest<T>(path: string, init: RequestInit & { idempotenceKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };
  if (init.idempotenceKey) headers["Idempotence-Key"] = init.idempotenceKey;
  const res = await fetch(`${YOOKASSA_API}${path}`, { ...init, headers, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { description?: string; code?: string };
  if (!res.ok) {
    console.error("[yookassa] Ошибка API:", res.status, data);
    throw new AppError("payment_provider_error", "Платёжный сервис вернул ошибку. Попробуйте позже.", 502);
  }
  return data;
}

function mapStatus(p: YooPayment): PaymentStatus {
  if (p.status === "succeeded") return "succeeded";
  if (p.status === "waiting_for_capture") return "waiting_for_capture";
  if (p.status === "canceled") return "canceled";
  return "pending";
}

/**
 * Создание платежа за завершённую поездку.
 * Сервер проверяет заказ, его стоимость и статус, затем обращается к API ЮKassa.
 */
export async function createPayment(user: User, orderId: string, returnUrl: string): Promise<Payment> {
  if (!isYooKassaConfigured()) {
    throw new AppError(
      "payment_not_configured",
      "Платёжный провайдер ЮKassa не настроен на сервере (нужны YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY).",
      503,
    );
  }

  let [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw Errors.notFound("Заказ");
  if (order.passengerId !== user.id) throw Errors.forbidden();
  order = await advanceSimulation(order);

  if (order.status === "paid") throw new AppError("already_paid", "Поездка уже оплачена", 409);
  if (!["payment_pending", "payment_failed", "completed"].includes(order.status)) {
    throw new AppError("order_not_completed", "Оплата доступна только после завершения поездки", 409);
  }
  const amount = order.finalPrice;
  if (!amount || amount <= 0) throw new AppError("invalid_amount", "Стоимость поездки не зафиксирована", 409);

  // Если есть незавершённый платёж — возвращаем его (идемпотентность).
  const [existing] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, order.id), inArray(payments.status, ["pending", "waiting_for_capture"])))
    .limit(1);
  if (existing?.confirmationUrl) {
    const synced = await syncPayment(existing);
    if (synced.status === "pending" || synced.status === "waiting_for_capture") return synced;
  }

  const idempotenceKey = randomUUID();
  const [draft] = await db
    .insert(payments)
    .values({ id: newId(), orderId: order.id, userId: user.id, idempotenceKey, amount, currency: order.currency, status: "pending" })
    .returning();

  const created = await yooRequest<YooPayment>("/payments", {
    method: "POST",
    idempotenceKey,
    body: JSON.stringify({
      amount: { value: (amount / 100).toFixed(2), currency: order.currency },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: `Оплата поездки ${order.id.slice(0, 8)}`,
      metadata: { orderId: order.id, paymentId: draft.id },
    }),
  });

  const [payment] = await db
    .update(payments)
    .set({
      providerPaymentId: created.id,
      status: mapStatus(created),
      confirmationUrl: created.confirmation?.confirmation_url ?? null,
      paymentMethod: created.payment_method?.title ?? created.payment_method?.type ?? null,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, draft.id))
    .returning();
  return payment;
}

/** Применяет актуальный статус платежа к записи и заказу. Единственное место фиксации оплаты. */
async function applyProviderState(payment: Payment, remote: YooPayment): Promise<Payment> {
  const status = mapStatus(remote);
  const [updated] = await db
    .update(payments)
    .set({
      status,
      paymentMethod: remote.payment_method?.title ?? remote.payment_method?.type ?? payment.paymentMethod,
      failureReason: remote.cancellation_details?.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id))
    .returning();

  if (status === "succeeded") {
    const [order] = await db
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.id, payment.orderId), inArray(orders.status, ["payment_pending", "payment_failed", "completed"])))
      .returning();
    if (order) {
      await db.insert(orderEvents).values({
    id: newId(),
        orderId: order.id,
        passengerId: order.passengerId,
        type: "paid",
        title: "Оплата прошла успешно",
        body: "Спасибо за поездку!",
      });
    }
  } else if (status === "canceled") {
    const [order] = await db
      .update(orders)
      .set({ status: "payment_failed", updatedAt: new Date() })
      .where(and(eq(orders.id, payment.orderId), eq(orders.status, "payment_pending")))
      .returning();
    if (order) {
      await db.insert(orderEvents).values({
    id: newId(),
        orderId: order.id,
        passengerId: order.passengerId,
        type: "payment_failed",
        title: "Оплата не прошла",
        body: "Попробуйте оплатить поездку ещё раз",
      });
    }
  }
  return updated;
}

/** Синхронизация статуса платежа с ЮKassa (возврат из платёжного окна не считается подтверждением). */
export async function syncPayment(payment: Payment): Promise<Payment> {
  if (!payment.providerPaymentId || !isYooKassaConfigured()) return payment;
  if (payment.status === "succeeded" || payment.status === "canceled") return payment;
  const remote = await yooRequest<YooPayment>(`/payments/${payment.providerPaymentId}`, { method: "GET" });
  return applyProviderState(payment, remote);
}

/** Платёж пассажира по id с проверкой владения и синхронизацией. */
export async function getOwnPayment(user: User, paymentId: string): Promise<Payment> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment) throw Errors.notFound("Платёж");
  if (payment.userId !== user.id) throw Errors.forbidden();
  return syncPayment(payment);
}

/**
 * Обработка webhook ЮKassa. Телу уведомления не доверяем:
 * подлинность и статус подтверждаются повторным запросом к API ЮKassa.
 */
export async function handleWebhook(body: unknown): Promise<void> {
  if (!isYooKassaConfigured()) return;
  const event = body as { event?: string; object?: { id?: string } };
  const providerId = event.object?.id;
  if (!providerId) return;
  const [payment] = await db.select().from(payments).where(eq(payments.providerPaymentId, providerId));
  if (!payment) return;
  const remote = await yooRequest<YooPayment>(`/payments/${providerId}`, { method: "GET" });
  await applyProviderState(payment, remote);
}
