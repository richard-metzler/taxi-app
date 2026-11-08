"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type AddressSuggestion } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatDistance, formatDuration, formatMoney, type EstimateView, type Place } from "@/shared/types";
import { buildHomeCollapsedSummary } from "@/core/collapsible";
import type { LatLng } from "@/core/geo";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { Button, BottomNav, ErrorBanner, Spinner } from "@/core/widgets/ui";
import { AddressInput } from "@/features/addresses/AddressInput";
import { useGeolocation } from "@/features/home/useGeolocation";

const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

/** Центр по умолчанию — Томск (совпадает с зоной обслуживания тарифов). */
const DEFAULT_CENTER: LatLng = { latitude: 56.4846, longitude: 84.9476 };

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const geo = useGeolocation();

  const [pickup, setPickup] = useState<Place | null>(null);
  const [pickupText, setPickupText] = useState("");
  const [destination, setDestination] = useState<Place | null>(null);
  const [destinationText, setDestinationText] = useState("");
  const [estimate, setEstimate] = useState<EstimateView | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; nonce: number } | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [unpaidOrderId, setUnpaidOrderId] = useState<string | null>(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  // Восстановление активного заказа после перезапуска
  useEffect(() => {
    if (!user) return;
    api.orders
      .active()
      .then(({ orderId, unpaidOrderId }) => {
        if (orderId) router.replace(`/orders/${orderId}`);
        else {
          setUnpaidOrderId(unpaidOrderId);
          setCheckingActive(false);
        }
      })
      .catch(() => setCheckingActive(false));
  }, [user, router]);

  const applyPickupFromPoint = useCallback(async (p: LatLng) => {
    setReverseBusy(true);
    setEstimate(null);
    try {
      const { item } = await api.geocode.reverse(p.latitude, p.longitude);
      const address = item?.address ?? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
      setPickup({ address, latitude: p.latitude, longitude: p.longitude });
      setPickupText(address);
    } catch {
      const address = `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
      setPickup({ address, latitude: p.latitude, longitude: p.longitude });
      setPickupText(address);
    } finally {
      setReverseBusy(false);
    }
  }, []);

  // Первичное определение местоположения
  useEffect(() => {
    if (!user || checkingActive) return;
    geo.locate().then((p) => {
      if (p) {
        setFlyTo({ point: p, nonce: Date.now() });
        if (!pickup) void applyPickupFromPoint(p);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checkingActive]);

  const onLocate = async () => {
    const p = await geo.locate();
    if (p) setFlyTo({ point: p, nonce: Date.now() });
  };

  const selectPlace = (s: AddressSuggestion, kind: "pickup" | "destination") => {
    const place: Place = { address: s.address, latitude: s.latitude, longitude: s.longitude };
    setEstimate(null);
    if (kind === "pickup") {
      setPickup(place);
      setPickupText(s.address);
    } else {
      setDestination(place);
      setDestinationText(s.address);
    }
    setFlyTo({ point: place, nonce: Date.now() });
  };

  const addressesConfirmed =
    !!pickup && !!destination && pickupText === pickup.address && destinationText === destination.address;

  const buildRoute = async () => {
    if (!pickup || !destination) return;
    setError(null);
    setEstimating(true);
    try {
      const res = await api.fare.estimate(pickup, destination);
      setEstimate(res);
    } catch (err) {
      setEstimate(null);
      setError(err instanceof ApiError ? err.message : "Не удалось рассчитать маршрут");
    } finally {
      setEstimating(false);
    }
  };

  const placeOrder = async () => {
    if (!estimate || !selected) return;
    if (!addressesConfirmed) {
      setError("Подтвердите адреса из списка подсказок");
      return;
    }
    setOrdering(true);
    setError(null);
    try {
      const { orderId } = await api.orders.create(estimate.estimateId, selected.id);
      router.push(`/orders/${orderId}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Не удалось создать заказ";
      setError(message);
      if (err instanceof ApiError && (err.code === "estimate_expired" || err.code === "tariff_changed")) setEstimate(null);
      setOrdering(false);
    }
  };

  const fitKey = useMemo(
    () => (estimate ? `route-${estimate.estimateId}` : pickup && destination ? `pts-${pickup.latitude}-${destination.latitude}` : ""),
    [estimate, pickup, destination],
  );

  /** Тариф заказа: первый доступный в зоне подачи (порядок задаёт сервер). */
  const selected = estimate?.tariffs[0] ?? null;
  const collapsedSummary = useMemo(
    () => buildHomeCollapsedSummary({ pickup, destination, estimate, unpaidOrderId }),
    [pickup, destination, estimate, unpaidOrderId],
  );

  if (loading || !user || checkingActive) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden">
      {/* Карта занимает основную площадь */}
      <div className="absolute inset-0">
        <RideMap
          center={DEFAULT_CENTER}
          pickup={pickup}
          destination={destination}
          userLocation={geo.position}
          route={estimate?.routeGeometry ?? null}
          pickupDraggable={!estimate}
          onPickupDragEnd={applyPickupFromPoint}
          fitKey={fitKey}
          layoutKey={sheetCollapsed}
          flyTo={flyTo}
        />
      </div>

      {/* Кнопка «моё местоположение» */}
      <button
        onClick={onLocate}
        className="neo-btn absolute right-4 top-4 z-[1000] flex h-12 w-12 items-center justify-center text-xl"
        aria-label="Моё местоположение"
      >
        {geo.loading ? <Spinner className="h-5 w-5 text-accent" /> : "◎"}
      </button>

      {/* Нижняя панель заказа: сворачивается кнопкой или свайпом вниз, чтобы освободить карту */}
      <CollapsibleSheet
        id="home-order-sheet"
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
        title={collapsedSummary.title}
        subtitle={collapsedSummary.subtitle}
        badge={collapsedSummary.badge}
        collapseLabel="Свернуть панель заказа"
        expandLabel="Развернуть панель заказа"
        headerExtra={<div className="px-1 text-sm font-bold text-ink">{estimate ? "Параметры поездки" : "Куда поедем?"}</div>}
        footer={
          sheetCollapsed && estimate && selected ? (
            <div className="safe-bottom mx-3 mb-2 flex gap-2">
              <Button className="flex-1" onClick={() => setSheetCollapsed(false)}>
                Адреса
              </Button>
              <Button className="flex-[2]" variant="primary" onClick={placeOrder} loading={ordering}>
                Заказать за {formatMoney(selected.price)}
              </Button>
            </div>
          ) : !sheetCollapsed ? (
            <BottomNav />
          ) : (
            <div className="safe-bottom" />
          )
        }
      >
        {unpaidOrderId ? (
          <Link href={`/orders/${unpaidOrderId}`} className="neo-inset flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-semibold text-accent">Есть неоплаченная поездка</span>
            <span className="text-muted">Оплатить →</span>
          </Link>
        ) : null}
        {geo.error && !pickup ? <ErrorBanner message={geo.error} onRetry={onLocate} /> : null}

        <AddressInput
          label="Откуда"
          icon="●"
          placeholder="Адрес отправления"
          value={pickupText}
          near={geo.position ?? pickup}
          onTextChange={(t) => {
            setPickupText(t);
            setEstimate(null);
          }}
          onSelect={(s) => selectPlace(s, "pickup")}
        />
        {!estimate && pickup ? (
          <div className="px-1 text-xs text-muted">
            {reverseBusy ? "Определяем адрес…" : "Маркер отправления можно перетащить на карте"}
          </div>
        ) : null}
        <AddressInput
          label="Куда"
          icon="■"
          placeholder="Адрес назначения"
          value={destinationText}
          near={pickup ?? geo.position}
          onTextChange={(t) => {
            setDestinationText(t);
            setEstimate(null);
          }}
          onSelect={(s) => selectPlace(s, "destination")}
        />

        <ErrorBanner message={error} />

        {!estimate ? (
          <Button variant="primary" onClick={buildRoute} loading={estimating} disabled={!addressesConfirmed}>
            Построить маршрут
          </Button>
        ) : (
          <>
            {/* Тариф выбирается автоматически (первый доступный по порядку сервера), без кнопок выбора */}
            <div className="flex items-center justify-between px-1 text-sm text-muted">
              <span>
                {formatDistance(estimate.distanceMeters)} · в пути {formatDuration(estimate.durationSeconds)}
                {selected ? ` · подача ~${formatDuration(selected.pickupEtaSeconds)}` : ""}
              </span>
              {estimate.routeSource === "fallback" ? <span title="Маршрут оценён приблизительно">≈</span> : null}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setEstimate(null)}>
                Изменить
              </Button>
              <Button className="flex-[2]" variant="primary" onClick={placeOrder} loading={ordering} disabled={!selected}>
                Заказать {selected ? `за ${formatMoney(selected.price)}` : ""}
              </Button>
            </div>
          </>
        )}
      </CollapsibleSheet>
    </main>
  );
}
