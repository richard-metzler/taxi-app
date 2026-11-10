"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "@/features/ride_order/useOrder";
import { Button, Spinner } from "@/core/widgets/ui";

export default function OrderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { order, error, forbidden, reload } = useOrder(params.id);
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (!order && !error && !forbidden) {
    if (!params.id || params.id === 'undefined' || params.id === '') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">Заказ не найден или ID пуст</p>
        <a href="/home" className="inline-flex items-center justify-center rounded-xl bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition-colors">На главную</a>
      </main>
    );
  }

  return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">У вас нет доступа к этому заказу</p>
        <p className="text-sm text-gray-500">ID заказа: {params.id}</p>
        <a href="/home" className="inline-flex items-center justify-center rounded-xl bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition-colors">На главную</a>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">{error || "Заказ не найден"}</p>
        <a href="/home" className="inline-flex items-center justify-center rounded-xl bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition-colors">На главную</a>
      </main>
    );
  }

  const isFinal = ["completed", "cancelled", "payment_failed", "paid"].includes(order.status);
  const canCancel = ["searching", "driver_assigned", "driver_arriving", "driver_waiting"].includes(order.status);

  const handleCancel = async () => {
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Ошибка при отмене');
      await reload();
    } catch (e: any) {
      alert(e.message || 'Не удалось отменить заказ');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-gray-50 relative pb-32">
      <div className="flex-1 p-6 flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Заказ #{order.id.slice(0, 6)}</h1>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Статус</p>
          <p className="text-lg font-bold text-accent mt-1">
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

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Откуда</p>
            <p className="font-medium mt-0.5">{order.pickup.address}</p>
          </div>
          <div className="h-px bg-gray-100 w-full" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Куда</p>
            <p className="font-medium mt-0.5">{order.destination.address}</p>
          </div>
          <div className="mt-2 pt-3 border-t flex justify-between items-center">
            <span className="font-medium text-gray-600">Стоимость</span>
            <span className="text-xl font-bold">{order.finalPrice ? order.finalPrice / 100 : order.estimatedPrice / 100} ₽</span>
          </div>
        </div>
      </div>

      {/* Нижняя панель с кнопками */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-pb z-40">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {canCancel && (
            <Button variant="danger" onClick={() => setShowCancelModal(true)} loading={isCancelling} className="w-full">
              Отменить заказ
            </Button>
          )}

          {isFinal && (
            <div className="flex gap-2 w-full">
              <Button variant="default" className="flex-1" onClick={() => { window.location.href = "/history"; }}>
                История
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => { window.location.href = "/home"; }}>
                Новый заказ
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно отмены (без системных confirm) */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2 text-gray-900">Отменить заказ?</h3>
            <p className="text-gray-500 mb-6">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleCancel} loading={isCancelling}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
