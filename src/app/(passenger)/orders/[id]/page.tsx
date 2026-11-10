"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useOrder } from "@/features/ride_order/useOrder";
import { Button, Spinner } from "@/core/widgets/ui";
import { api } from "@/shared/api";
import RideMap from "@/features/map/RideMap";
import { DriverCard } from "@/features/driver_tracking/DriverCard";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";

export default function OrderPage() {
  const params = useParams();
  const orderId = params.id as string;
  
  const { order, error, forbidden, reload } = useOrder(orderId);
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

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

  const route = typeof order.routeGeometry === 'string' ? JSON.parse(order.routeGeometry) : order.routeGeometry;
  
  // Маршрут водителя к вам (из симуляции)
  const driverRoute = order.simulation?.approachRoute || null;
  const showDriverRoute = ["driver_assigned", "driver_arriving"].includes(order.status);

  // Текст статуса для шапки шторки
  const statusText = 
    order.status === "searching" ? "Ищем водителя..." :
    order.status === "driver_assigned" ? "Водитель назначен" :
    order.status === "driver_arriving" ? "Водитель в пути" :
    order.status === "driver_waiting" ? "Водитель ожидает вас" :
    order.status === "in_progress" ? "В поездке" :
    order.status === "completed" ? "Поездка завершена" :
    order.status === "cancelled" ? "Заказ отменён" :
    order.status === "paid" ? "Заказ оплачен" : "";

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface">
      <div className="absolute inset-0 z-0">
        <RideMap 
          center={order.pickup || { latitude: 56.4846, longitude: 84.9476 }}
          pickup={order.pickup}
          destination={order.destination}
          driver={order.driver?.location}
          route={route}
          fitKey={order.id}
          showDriverRoute={showDriverRoute}
          driverRoute={driverRoute}
          layoutKey={!sheetCollapsed}
          className="h-full w-full"
        />
      </div>

      <CollapsibleSheet
        id="order-sheet"
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
        title={statusText}
      >
        <div className="flex flex-col gap-4 pb-4">
          <p className="text-center text-xs text-muted -mt-2 mb-2">Заказ #{order.id.slice(0, 6)}</p>
          
          {/* Карточка водителя */}
          {order.driver && (
            <div className="rounded-2xl bg-surface-muted p-4 border border-border">
              <DriverCard driver={order.driver} showEta={order.status === "driver_arriving"} />
            </div>
          )}

          {/* Детали маршрута */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs text-accent">📍</div>
              <p className="font-medium text-sm text-ink line-clamp-1">{order.pickup.address}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-xs text-muted">🏁</div>
              <p className="font-medium text-sm text-ink line-clamp-1">{order.destination.address}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-muted">Стоимость</span>
            <span className="text-2xl font-bold text-ink">
              {order.finalPrice ? order.finalPrice / 100 : order.estimatedPrice / 100} ₽
            </span>
          </div>

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
      </CollapsibleSheet>

      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-xl font-bold text-ink mb-2">Отменить заказ?</h3>
            <p className="text-muted mb-6">Вы уверены, что хотите отменить поездку?</p>
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
