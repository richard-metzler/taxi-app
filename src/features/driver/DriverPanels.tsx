"use client";

import { formatPhone } from "@/core/phone";
import { buildNavigatorUrl } from "@/core/navigator-links";
import { Button, StatusPill } from "@/core/widgets/ui";
import { driverStatusText, type AvailableOrderView, type DriverOrderView, type DriverStateView } from "@/shared/driver-types";
import { formatDistance, formatDuration, formatMoney, NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";

/** Панель водителя вне линии. */
export function OfflinePanel({
  vehicle,
  busy,
  onGoOnline,
}: {
  vehicle: DriverStateView["driver"]["vehicle"];
  busy: boolean;
  onGoOnline: () => void;
}) {
  return (
    <>
      {vehicle ? (
        <div className="neo-inset px-4 py-3 text-sm">
          <div className="font-bold">
            {vehicle.brand} {vehicle.model}
          </div>
          <div className="text-muted">
            {vehicle.color.toLowerCase()} · {vehicle.plate} · {vehicle.tariffName}
          </div>
        </div>
      ) : null}
      <p className="px-1 text-sm text-muted">Выйдите на линию, чтобы получать заказы рядом. Нужен доступ к геолокации.</p>
      <Button id="driver-go-online" variant="primary" loading={busy} onClick={onGoOnline}>
        Выйти на линию
      </Button>
    </>
  );
}

/** Панель водителя на линии: заказы рядом. */
export function OnlinePanel({
  available,
  selectedId,
  acceptingId,
  busy,
  onSelect,
  onAccept,
  onGoOffline,
}: {
  available: AvailableOrderView[];
  selectedId: string | null;
  acceptingId: string | null;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onAccept: (id: string) => void;
  onGoOffline: () => void;
}) {
  return (
    <>
      {available.length === 0 ? (
        <div className="neo-inset px-4 py-5 text-center text-sm text-muted">
          Заказов рядом пока нет. Новые появятся здесь автоматически.
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Заказы рядом">
          {available.map((order) => (
            <li key={order.id} data-order-id={order.id} className={`${selectedId === order.id ? "neo-inset" : "neo-sm"} flex flex-col gap-2 p-3`}>
              <button type="button" className="flex flex-col gap-1.5 text-left" onClick={() => onSelect(selectedId === order.id ? null : order.id)}>
                <span className="flex gap-2 text-sm">
                  <span className="text-accent">●</span>
                  <span className="flex-1 font-semibold">{order.pickup.address}</span>
                </span>
                <span className="flex gap-2 text-sm">
                  <span>■</span>
                  <span className="flex-1">{order.destination.address}</span>
                </span>
                <span className="text-xs text-muted">
                  До подачи {formatDistance(order.distanceToPickupMeters)} · поездка {formatDistance(order.tripDistanceMeters)},{" "}
                  {formatDuration(order.tripDurationSeconds)}
                </span>
              </button>
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-bold">{formatMoney(order.price)}</span>
                <Button className="min-h-11 px-4 py-2" variant="primary" loading={acceptingId === order.id} disabled={acceptingId !== null} onClick={() => onAccept(order.id)}>
                  Принять заказ
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button id="driver-go-offline" loading={busy} onClick={onGoOffline}>
        Уйти с линии
      </Button>
    </>
  );
}

/** Панель текущего заказа: ведение поездки по шагам. */
export function ActiveOrderPanel({
  order,
  navigator,
  busy,
  onAction,
  onDecline,
}: {
  order: DriverOrderView;
  navigator: UserProfile["navigator"];
  busy: boolean;
  onAction: () => void;
  onDecline: () => void;
}) {
  const target = order.status === "in_progress" ? order.destination : order.pickup;
  const navigatorUrl = buildNavigatorUrl(navigator, target);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{driverStatusText(order.status)}</h2>
          <p className="text-sm text-muted">
            {order.status === "in_progress" ? "Везём пассажира в точку назначения" : "Подъезжайте к точке подачи"}
          </p>
        </div>
        <StatusPill text={formatMoney(order.price)} tone="success" />
      </div>

      <div className="neo-inset flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">Пассажир</div>
          <div className="truncate font-bold">{order.passenger.name}</div>
        </div>
        <a href={`tel:${order.passenger.phone}`} className="neo-btn shrink-0 px-4 py-2 text-sm font-semibold text-accent">
          {formatPhone(order.passenger.phone)}
        </a>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex gap-2">
          <span className="text-accent">●</span>
          <span className="flex-1">{order.pickup.address}</span>
        </div>
        <div className="flex gap-2">
          <span>■</span>
          <span className="flex-1">{order.destination.address}</span>
        </div>
        <div className="text-xs text-muted">
          {formatDistance(order.distanceMeters)} · {formatDuration(order.durationSeconds)} · {order.tariffName}
        </div>
      </div>

      <a
        href={navigatorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="neo-btn flex min-h-12 items-center justify-center px-4 py-3 text-sm font-semibold text-accent"
      >
        Открыть в навигаторе: {NAVIGATOR_TEXT[navigator]} ↗
      </a>

      {order.nextAction ? (
        <Button id="driver-next-action" variant="primary" loading={busy} onClick={onAction}>
          {order.nextAction.label}
        </Button>
      ) : null}
      {order.canDecline ? (
        <Button variant="danger" disabled={busy} onClick={onDecline}>
          Отказаться от заказа
        </Button>
      ) : null}
    </>
  );
}
