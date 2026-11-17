"use client";

import Image from "next/image";
import { formatPhone } from "@/core/phone";
import { buildNavigatorUrl } from "@/core/navigator-links";
import { Button } from "@/core/widgets/ui";
import { driverStatusText, type AvailableOrderView, type DriverOrderView, type DriverStateView } from "@/shared/driver-types";
import { formatDistance, formatDuration, formatMoney, NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";

/** Панель водителя вне линии: автомобиль и главная кнопка выхода на линию. */
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="neo-inset flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden="true">
          <Image src="/images/taxi-side.svg" alt="" width={48} height={48} className="h-10 w-10" draggable={false} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Автомобиль</div>
          {vehicle ? (
            <>
              <div className="truncate text-base font-bold text-ink">
                {vehicle.brand} {vehicle.model}
              </div>
              <div className="truncate text-xs text-muted">
                {vehicle.color.toLowerCase()} · {vehicle.plate} · {vehicle.tariffName}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted">Не указан</div>
          )}
        </div>
      </div>
      <p className="px-1 text-sm text-muted">
        Выйдите на линию, чтобы получать заказы рядом. Нужен доступ к геолокации.
      </p>
      <Button id="driver-go-online" variant="primary" loading={busy} onClick={onGoOnline} className="text-lg">
        Выйти на линию
      </Button>
    </section>
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
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">Заказы рядом</h2>
        <span className="text-xs text-muted">
          {available.length > 0 ? `${available.length} ${available.length === 1 ? "предложение" : "предложений"}` : "Ожидаем заказы"}
        </span>
      </div>

      {available.length === 0 ? (
        <div className="neo-inset px-4 py-6 text-center text-sm text-muted">
          Заказов рядом пока нет. Новые появятся здесь автоматически.
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Заказы рядом">
          {available.map((order) => (
            <li
              key={order.id}
              data-order-id={order.id}
              className={`${selectedId === order.id ? "neo-inset" : "neo-sm"} flex flex-col gap-3 p-3.5`}
            >
              <button type="button" className="flex flex-col gap-2.5 text-left" onClick={() => onSelect(selectedId === order.id ? null : order.id)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="neo-inset rounded-full px-2.5 py-1 text-[11px] font-semibold text-accent">{order.tariffName}</span>
                  <span className="text-xl font-bold text-accent">{formatMoney(order.price)}</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg">
                    А
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Подача</div>
                    <div className="truncate text-sm font-semibold text-ink">{order.pickup.address}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-bg">
                    Б
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Назначение</div>
                    <div className="truncate text-sm text-ink">{order.destination.address}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 pl-[1.9rem] text-xs text-muted">
                  <span>До подачи {formatDistance(order.distanceToPickupMeters)}</span>
                  <span>
                    {formatDistance(order.tripDistanceMeters)} · {formatDuration(order.tripDurationSeconds)}
                  </span>
                </div>
              </button>

              <Button
                className="min-h-12"
                variant="primary"
                loading={acceptingId === order.id}
                disabled={acceptingId !== null}
                onClick={() => onAccept(order.id)}
              >
                Принять заказ
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button id="driver-go-offline" loading={busy} onClick={onGoOffline}>
        Уйти с линии
      </Button>
    </section>
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
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="pulse-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
            <h2 className="truncate text-2xl font-bold text-ink">{driverStatusText(order.status)}</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {order.status === "in_progress" ? "Везём пассажира в точку назначения" : "Подъезжайте к точке подачи"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Стоимость</div>
          <div className="text-xl font-bold text-accent">{formatMoney(order.price)}</div>
        </div>
      </div>

      <div className="neo-inset flex items-center gap-3 px-4 py-3">
        <div className="neo flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-accent" aria-hidden="true">
          {order.passenger.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Пассажир</div>
          <div className="truncate font-bold text-ink">{order.passenger.name}</div>
        </div>
        <a href={`tel:${order.passenger.phone}`} className="neo-btn shrink-0 px-3.5 py-2.5 text-sm font-semibold text-accent">
          {formatPhone(order.passenger.phone)}
        </a>
      </div>

      <div className="neo-inset flex flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg">А</span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Подача</div>
            <div className="truncate text-sm font-semibold text-ink">{order.pickup.address}</div>
          </div>
        </div>
        <div className="ml-2 h-3 w-px bg-border" aria-hidden="true" />
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-bg">Б</span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Назначение</div>
            <div className="truncate text-sm font-semibold text-ink">{order.destination.address}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted">
        <span>{formatDistance(order.distanceMeters)}</span>
        <span>{formatDuration(order.durationSeconds)}</span>
        <span>{order.tariffName}</span>
      </div>

      <a
        href={navigatorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="neo-btn flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-accent"
      >
        <span aria-hidden="true">🧭</span>
        Открыть в навигаторе: {NAVIGATOR_TEXT[navigator]} ↗
      </a>

      {order.nextAction ? (
        <Button id="driver-next-action" variant="primary" loading={busy} onClick={onAction} className="text-lg">
          {order.nextAction.label}
        </Button>
      ) : null}
      {order.canDecline ? (
        <Button variant="danger" disabled={busy} onClick={onDecline}>
          Отказаться от заказа
        </Button>
      ) : null}
    </section>
  );
}
