"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { formatMoney, PAYMENT_STATUS_TEXT, type OrderView } from "@/shared/types";
import { Button, ErrorBanner, StatusPill } from "@/core/widgets/ui";

type Props = { order: OrderView; returnedFromProvider: boolean };

/**
 * Панель оплаты. Платёж создаёт только сервер (createPayment → ЮKassa).
 * Результат берётся из состояния заказа, которое сервер сверяет с ЮKassa;
 * возврат из платёжного окна подтверждением оплаты не считается.
 */
export function PaymentPanel({ order, returnedFromProvider }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const amount = order.finalPrice ?? order.estimatedPrice;
  const payment = order.payment;
  const inProgress = payment?.status === "pending" || payment?.status === "waiting_for_capture";
  // Незавершённый платёж можно продолжить по той же ссылке.
  const continueUrl = paymentUrl ?? (inProgress ? payment?.confirmationUrl ?? null : null);

  useEffect(() => {
    // Во встроенном фрейме платёжная страница не откроется — используем новую вкладку.
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
    api.payments
      .availability()
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false));
  }, []);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await api.payments.create(order.id);
      if (!payment.confirmationUrl) {
        setError("Платёжный сервис не вернул ссылку на оплату");
        return;
      }
      if (embedded) {
        setPaymentUrl(payment.confirmationUrl);
      } else {
        api.auth.prepareExternalNavigation();
        window.location.assign(payment.confirmationUrl);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать платёж");
    } finally {
      setBusy(false);
    }
  };

  if (order.status === "paid") {
    return (
      <div className="neo-inset flex items-center justify-between px-4 py-3">
        <div>
          <div className="text-sm text-muted">Оплачено{payment?.paymentMethod ? ` · ${payment.paymentMethod}` : ""}</div>
          <div className="text-2xl font-bold text-success">{formatMoney(amount)}</div>
        </div>
        <StatusPill text="Оплачено" tone="success" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="neo-inset flex items-center justify-between px-4 py-3">
        <div>
          <div className="text-sm text-muted"> · банковская карта (ЮKassa)</div>
          <div className="text-2xl font-bold">{formatMoney(amount)}</div>
        </div>
        {payment ? (
          <StatusPill
            text={PAYMENT_STATUS_TEXT[payment.status]}
            tone={payment.status === "succeeded" ? "success" : payment.status === "canceled" ? "danger" : "accent"}
          />
        ) : null}
      </div>

      {inProgress || returnedFromProvider ? (
        <div className="px-1 text-sm text-muted">
          Ожидаем подтверждение от ЮKassa. Статус обновится автоматически.
        </div>
      ) : null}
      {payment?.failureReason ? <div className="px-1 text-sm text-danger">Причина: {payment.failureReason}</div> : null}

      {configured === false ? (
        <div className="neo-inset px-4 py-3 text-sm text-danger">
          Оплата недоступна: на сервере не настроен ЮKassa (переменные YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY).
          Поездка останется в статусе «Ожидается оплата».
        </div>
      ) : null}

      <ErrorBanner message={error} />

      {continueUrl ? (
        <a
          href={continueUrl}
          target={embedded ? "_blank" : "_self"}
          rel="noopener noreferrer"
          onClick={() => {
            if (!embedded) api.auth.prepareExternalNavigation();
          }}
          className="neo-btn-primary flex min-h-14 items-center justify-center px-5 py-4 text-base font-semibold"
        >
          {embedded ? "Открыть страницу оплаты ЮKassa ↗" : "Перейти к оплате"}
        </a>
      ) : (
        <Button variant="primary" onClick={pay} loading={busy} disabled={configured !== true}>
          {order.status === "payment_failed" ? "Повторить оплату" : "Оплатить"} {formatMoney(amount)}
        </Button>
      )}
      {continueUrl && embedded ? (
        <div className="px-1 text-xs text-muted">
          Оплата откроется в новой вкладке. После оплаты вернитесь сюда — результат появится здесь.
        </div>
      ) : null}
    </div>
  );
}
