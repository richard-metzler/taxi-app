"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useOrder } from "@/features/ride_order/useOrder";
import { Button, Spinner } from "@/core/widgets/ui";
import { api } from "@/shared/api";
import RideMap from "@/features/map/RideMap";
import { DriverCard } from "@/features/driver_tracking/DriverCard";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { BottomNav } from "@/core/widgets/ui";

export default function OrderPage() {
  const params = useParams();
  const orderId = params.id as string;
  
  const { order, error, forbidden, reload } = useOrder(orderId);
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    if (!order) return;
    
    if (order.status === "completed") {
      setShowReceipt(true);
      return;
    }

    if (order.status === "cancelled") return;

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
  
  const driverRoute = (order.simulation as any)?.approachRoute || null;
  const showDriverRoute = ["driver_assigned", "driver_arriving"].includes(order.status);

  const statusText = 
    order.status === "searching" ? "Ищем водителя..." :
    order.status === "driver_assigned" ? "Водитель назначен" :
    order.status === "driver_arriving" ? "Водитель в пути" :
    order.status === "driver_waiting" ? "Водитель ожидает вас" :
    order.status === "in_progress" ? "В поездке" :
    order.status === "completed" ? "Поездка завершена" :
    order.status === "cancelled" ? "Заказ отменён" :
    "";

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
          layoutKey={!sheetCollapsed}
          className="h-full w-full"
          showDriverRoute={showDriverRoute}
          driverRoute={driverRoute}
        />
      </div>

      {/* Плашка статуса поверх карты */}
      <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2 shadow-lg backdrop-blur-md border border-gray-200">
        <span className={`h-3 w-3 rounded-full ${isFinal ? 'bg-gray-400' : 'bg-accent animate-pulse'}`} />
        <span className="text-sm font-bold text-ink">{statusText}</span>
      </div>

      <CollapsibleSheet
        id="order-sheet"
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
        title={statusText}
      >
        <div className="flex flex-col gap-4 pb-4">
          <div className="text-center">
            <p className="text-sm font-bold text-accent">{statusText}</p>
            <p className="text-xs text-muted mt-1">Заказ #{order.id.slice(0, 6)}</p>
          </div>
          
          {order.driver && (
            <div className="rounded-2xl bg-surface-muted p-4 border border-border">
              <DriverCard driver={order.driver} showEta={order.status === "driver_arriving"} />
            </div>
          )}

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
              {(order.finalPrice || order.estimatedPrice || 0) / 100} ₽
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {canCancel && (
              <Button variant="danger" onClick={() => setShowCancelModal(true)} loading={isCancelling} className="w-full">
                Отменить заказ
              </Button>
            )}
            
            {isFinal && (
              <BottomNav />
            )}
          </div>
        </div>
      </CollapsibleSheet>

      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[#E9EDF2] rounded-3xl p-6 max-w-sm w-full shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            <h3 className="text-xl font-bold text-ink mb-2 text-center">Отменить заказ?</h3>
            <p className="text-muted mb-6 text-center">Вы уверены, что хотите отменить поездку?</p>
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

      {showReceipt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[#E9EDF2] rounded-3xl p-6 max-w-sm w-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              ✓
            </div>
            <h3 className="text-xl font-bold text-ink mb-2">Поездка завершена</h3>
            <p className="text-muted mb-6">С Вас <span className="text-xl font-bold text-ink">{(order.finalPrice || order.estimatedPrice || 0) / 100} ₽</span></p>
            <Button variant="primary" className="w-full" onClick={() => { window.location.href = "/home"; }}>
              На главную
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
