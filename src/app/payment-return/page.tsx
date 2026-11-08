"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useSession } from "@/shared/session";
import { Spinner } from "@/core/widgets/ui";

/**
 * Возврат из платёжного окна ЮKassa.
 * Сам факт возврата не означает оплату: статус проверяет сервер у ЮKassa.
 * Если сессия доступна — открываем заказ, иначе просим вернуться в приложение.
 */
function PaymentReturn() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = search.get("orderId");
  const { user, loading } = useSession();
  const validOrderId = orderId && /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null;

  useEffect(() => {
    if (!loading && user && validOrderId) router.replace(`/orders/${validOrderId}?payment=return`);
  }, [loading, user, validOrderId, router]);

  if (loading || (user && validOrderId)) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="text-muted">Проверяем статус оплаты…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="neo flex h-16 w-16 items-center justify-center rounded-2xl text-3xl">💳</div>
      <h1 className="text-xl font-bold">Платёж обрабатывается</h1>
      <p className="text-muted">
        Вернитесь в окно приложения «Рядом» — статус оплаты обновится там автоматически после подтверждения от ЮKassa.
        Эту вкладку можно закрыть.
      </p>
      <Link href={validOrderId ? `/orders/${validOrderId}?payment=return` : "/home"} className="font-semibold text-accent">
        Открыть заказ в этой вкладке
      </Link>
    </main>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center">
          <Spinner className="h-8 w-8 text-accent" />
        </main>
      }
    >
      <PaymentReturn />
    </Suspense>
  );
}
