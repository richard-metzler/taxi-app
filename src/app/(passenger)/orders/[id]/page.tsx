"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useOrder } from "@/features/ride_order/useOrder";
import { Button, Spinner } from "@/core/widgets/ui";
import { api } from "@/shared/api";
import RideMap from "@/features/map/RideMap";
import { DriverCard } from "@/features/driver_tracking/DriverCard";

export default function OrderPage() {
  const params = useParams();
  const orderId = params.id as string;
  
  const { order, error, forbidden, reload } = useOrder(orderId);
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Автообновление каждые 3 секунды (чтобы работал диспетчер и двигалась машина)
  useEffect(() => {
    if (!order || order.status === "completed" || order.status === "cancelled") return;
    const interval = setInterval(() => { reload(); }, 3000);
    return () => clearInterval(interval);
  }, [order?.status, reload]);

  if (!orderId || orderId === "undefined" || orderId === "null") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-danger">Ошибка: некорректный ID заказа</p>
      </main>
    );
  }

  if (!order && !error && !forbidden) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  if (forbidden || error || !order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">{forbidden ? "У вас нет доступа к этому заказу" : (error || "Заказ не найден")}</p>
        <Button onClick={() => { window.location.href = "/home"; }}>На главную</Button>
      </main>
    );
  }

  const isFinal = ["completed", "cancelled", "payment_failed", "paid"].includes(order.status);
  const canCancel = ["searching", "driver_assigned", "driver_arriving", "driver_waiting"].includes(order.status);

  const handleCancel = async () => {
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      await api.orders.cancel(order.id);
      await reload();
    } catch (e: any) {
      alert(e.message || 'Не удалось отменить заказ');
    } finally {
      setIsCancelling(false);
    }
  };

  // Безопасный парсинг маршрута (PostgreSQL возвращает объект, но на всякий случай)
  const route = typeof order.routeGeometry === 'string' ? JSON.parse(order.routeGeometry) : order.routeGeometry;

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-gray-50">
      {/* Карта на весь экран */}
      <div className="absolute inset-0 z-0">
        <RideMap 
          center={order.pickup || { latitude: 56.4846, longitude: 84.9476 }}
          pickup={order.pickup}
          destination={order.destination}
          driver={order.driver?.location}
          route={route}
          fitKey={order.id}
          className="h-full w-full"
        />
      </div>

      {/* Белая шторка снизу */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col rounded-t-3xl bg-white p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
        
        <h2 className="text-xl font-bold mb-1">
          {order.status === "searching" && "Ищем водителя..."}
          {order.status === "driver_assigned" && "Водитель назначен"}
          {order.status === "driver_arriving" && "Водитель в пути"}
          {order.status === "driver_waiting" && "Водитель ожидает вас"}
          {order.status === "in_progress" && "В поездке"}
          {order.status === "completed" && "Поездка завершена"}
          {order.status === "cancelled" && "Заказ отменён"}
          {order.status === "paid" && "Заказ оплачен"}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {order.status === "searching" ? "Пожалуйста, подождите" : `Заказ #${order.id.slice(0, 6)}`}
        </p>

        {/* Карточка водителя */}
        {order.driver && (
          <div className="mb-4 rounded-2xl bg-gray-50 p-4 border border-gray-100">
            <DriverCard driver={order.driver} showEta={order.status === "driver_arriving"} />
          </div>
        )}

        {/* Детали маршрута */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs">📍</div>
            <p className="font-medium text-sm line-clamp-1">{order.pickup.address}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">🏁</div>
            <p className="font-medium text-sm line-clamp-1">{order.destination.address}</p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-gray-600">Стоимость</span>
          <span className="text-2xl font-bold">
            {order.finalPrice ? order.finalPrice / 100 : order.estimatedPrice / 100} ₽
          </span>
        </div>

        {/* Кнопки */}
        <div className="flex flex-col gap-2">
          {canCancel && (
            <Button variant="danger" onClick={() => setShowCancelModal(true)} loading={isCancelling} className="w-full">
              Отменить заказ
            </Button>
          )}
          {isFinal && (
            <Button variant="primary" onClick={() => { window.location.href = "/home"; }} className="w-full">
              Новый заказ
            </Button>
          )}
        </div>
      </div>

      {/* Модалка отмены */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2">Отменить заказ?</h3>
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
