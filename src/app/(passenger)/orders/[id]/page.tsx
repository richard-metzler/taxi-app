"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "@/features/ride_order/useOrder";
import { Button, Spinner } from "@/core/widgets/ui";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import Link from "next/link";

export default function OrderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { order, loading, error, cancel, cancelling } = useOrder(params.id);
  const [showCancelModal, setShowCancelModal] = useState(false);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">{error || "Заказ не найден"}</p>
        <Link href="/home">
          <Button>На главную</Button>
        </Link>
      </main>
    );
  }

  const isFinal = ["completed", "cancelled", "payment_failed", "paid"].includes(order.status);
  const canCancel = ["searching", "driver_assigned", "driver_arriving", "driver_waiting"].includes(order.status);

  const handleCancel = async () => {
    setShowCancelModal(false);
    await cancel();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-gray-50 relative">
      <div className="flex-1 p-6 flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Заказ #{order.id.slice(0, 6)}</h1>
        
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-sm text-gray-500">Статус</p>
          <p className="text-lg font-bold text-accent">
            {order.status === "searching" && "Ищем водителя..."}
            {order.status === "driver_assigned" && "Водитель назначен"}
            {order.status === "driver_arriving" && "Водитель в пути"}
            {order.status === "driver_waiting" && "Водитель ожидает"}
            {order.status === "in_progress" && "В поездке"}
            {order.status === "completed" && "Завершён"}
            {order.status === "cancelled" && "Отменён"}
            {order.status === "paid" && "Оплачен"}
            {order.status === "payment_pending" && "Ожидает оплаты"}
            {order.status === "payment_failed" && "Ошибка оплаты"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col gap-2">
          <div>
            <p className="text-sm text-gray-500">Откуда</p>
            <p className="font-medium">{order.pickup.address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Куда</p>
            <p className="font-medium">{order.destination.address}</p>
          </div>
          <div className="mt-2 pt-2 border-t flex justify-between">
            <span>Стоимость</span>
            <span className="font-bold">{order.finalPrice ? order.finalPrice / 100 : order.estimatedPrice / 100} ₽</span>
          </div>
        </div>
      </div>

      <CollapsibleSheet>
        {canCancel && (
          <Button variant="danger" onClick={() => setShowCancelModal(true)} loading={cancelling} className="w-full">
            Отменить заказ
          </Button>
        )}

        {isFinal && (
          <div className="flex gap-2 w-full">
            <Button className="flex-1" onClick={() => router.push("/history")}>
              История
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => router.push("/home")}>
              Новый заказ
            </Button>
          </div>
        )}
      </CollapsibleSheet>

      {/* Кастомное модальное окно (1 штука, без дублей) */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2">Отменить заказ?</h3>
            <p className="text-sm text-gray-500 mb-6">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleCancel} loading={cancelling}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
