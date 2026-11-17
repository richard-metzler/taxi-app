"use client";

import type { ReactNode } from "react";
import { formatPhone } from "@/core/phone";
import { buildNavigatorUrl } from "@/core/navigator-links";
import { Button } from "@/core/widgets/ui";
import { GlassCard, TaxiArt } from "@/core/widgets/TuberUI";
import { driverStatusText, type AvailableOrderView, type DriverOrderView, type DriverStateView } from "@/shared/driver-types";
import { formatDistance, formatDuration, formatMoney, NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";

/** Токены эталона tuber: жёлтый акцент и синее свечение колец. */
const BLUE_RING = {
  border: "1.5px solid #5B8FE8",
  boxShadow: "0 0 18px rgba(91,143,232,0.55), inset 0 0 12px rgba(91,143,232,0.18)",
} as const;
const CTA = "!min-h-12 !rounded-2xl !text-base !font-extrabold !text-[#1a1200] [&_svg]:!text-[#1a1200]";
const SECONDARY =
  "flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-semibold text-white/90 backdrop-blur-xl transition active:scale-[0.99] disabled:opacity-50";

/** Тонкое кольцо прогресса с числом внутри — как таймер на эталоне. */
export function TuberRing({
  value,
  unit = "мин",
  progress = 0.72,
}: {
  value: string | number;
  unit?: string;
  progress?: number;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3.5" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#FFC400"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          style={{ filter: "drop-shadow(0 0 6px rgba(255,196,0,0.8))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none text-white">{String(value).padStart(2, "0")}</span>
        <span className="mt-0.5 text-[10px] font-semibold text-white/65">{unit}</span>
      </div>
    </div>
  );
}

/** Точка маршрута с жёлтым кольцом — визуальный маркер эталона. */
function PointRow({ mark, label, address, tone = "yellow" }: { mark: string; label: string; address: string; tone?: "yellow" | "blue" }) {
  const yellow = tone === "yellow";
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
          yellow ? "border-2 border-[#FFC400] bg-[#FFC400]/10 text-[#FFC400]" : "border-2 border-[#5B8FE8] bg-[#5B8FE8]/15 text-white"
        }`}
      >
        {mark}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">{label}</div>
        <div className="truncate text-sm font-semibold text-white">{address}</div>
      </div>
    </div>
  );
}

/** Круглая кнопка со свечением: ссылка или действие. */
function RoundItem({ glyph, label, href, onClick }: { glyph: ReactNode; label: string; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full text-2xl text-white" style={BLUE_RING}>
        {glyph}
      </span>
      <span className="text-center text-[13px] font-medium leading-tight text-white/85">{label}</span>
    </>
  );
  const className = "flex w-[76px] flex-col items-center gap-2 text-white";
  return href ? (
    <a href={href} className={className}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

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
    <GlassCard className="p-5">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-white/5">
          <TaxiArt view="front" className="absolute inset-0" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Автомобиль</div>
          {vehicle ? (
            <>
              <div className="truncate text-lg font-extrabold text-white">
                {vehicle.brand} {vehicle.model}
              </div>
              <div className="truncate text-xs text-white/65">
                {vehicle.color.toLowerCase()} · {vehicle.plate} · {vehicle.tariffName}
              </div>
            </>
          ) : (
            <div className="text-sm text-white/70">Не указан</div>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm text-white/70">
        Выйдите на линию, чтобы получать заказы рядом. Нужен доступ к геолокации.
      </p>
      <Button id="driver-go-online" variant="primary" loading={busy} onClick={onGoOnline} className={`mt-4 w-full ${CTA}`}>
        Выйти на линию
      </Button>
    </GlassCard>
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
        <h2 className="text-lg font-extrabold text-white">Заказы рядом</h2>
        <span className="text-xs text-white/60">
          {available.length > 0 ? `${available.length} ${available.length === 1 ? "предложение" : "предложений"}` : "Ожидаем заказы"}
        </span>
      </div>

      {available.length === 0 ? (
        <GlassCard className="px-4 py-6 text-center text-sm text-white/65">
          Заказов рядом пока нет. Новые появятся здесь автоматически.
        </GlassCard>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Заказы рядом">
          {available.map((order) => {
            const selected = selectedId === order.id;
            return (
              <li
                key={order.id}
                data-order-id={order.id}
                className={`rounded-[24px] border bg-white/10 p-4 backdrop-blur-2xl transition ${
                  selected ? "border-[#FFC400]/70 shadow-[0_0_22px_rgba(255,196,0,0.18)]" : "border-white/20"
                }`}
              >
                <button type="button" className="flex w-full flex-col gap-2.5 text-left" onClick={() => onSelect(selected ? null : order.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-[#FFC400]/45 bg-[#FFC400]/10 px-2.5 py-1 text-[11px] font-bold text-[#FFC400]">
                      {order.tariffName}
                    </span>
                    <span className="text-xl font-black text-[#FFC400]">{formatMoney(order.price)}</span>
                  </div>
                  <PointRow mark="А" label="Подача" address={order.pickup.address} />
                  <PointRow mark="Б" label="Назначение" address={order.destination.address} tone="blue" />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pl-9 text-xs text-white/60">
                    <span>До подачи {formatDistance(order.distanceToPickupMeters)}</span>
                    <span>
                      {formatDistance(order.tripDistanceMeters)} · {formatDuration(order.tripDurationSeconds)}
                    </span>
                  </div>
                </button>

                <Button
                  className={`mt-3 w-full ${CTA}`}
                  variant="primary"
                  loading={acceptingId === order.id}
                  disabled={acceptingId !== null}
                  onClick={() => onAccept(order.id)}
                >
                  Принять заказ
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" id="driver-go-offline" disabled={busy} onClick={onGoOffline} className={SECONDARY}>
        Уйти с линии
      </button>
    </section>
  );
}

/** Панель текущего заказа: крупный таймер, кольцевые действия и шаги поездки. */
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
  const minutes = Math.max(1, Math.round(order.durationSeconds / 60));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="pulse-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#FFC400]" />
            <h2 className="truncate text-2xl font-black text-white">{driverStatusText(order.status)}</h2>
          </div>
          <p className="mt-0.5 text-sm text-white/65">
            {order.status === "in_progress" ? "Везём пассажира в точку назначения" : "Подъезжайте к точке подачи"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Стоимость</div>
          <div className="text-xl font-black text-[#FFC400]">{formatMoney(order.price)}</div>
        </div>
      </div>

      <GlassCard className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <TuberRing value={minutes} unit="мин" progress={0.72} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">В пути</div>
            <div className="text-base font-extrabold text-white">{formatDuration(order.durationSeconds)}</div>
            <div className="text-xs text-white/60">{formatDistance(order.distanceMeters)}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RoundItem glyph="📞" label="Позвонить" href={`tel:${order.passenger.phone}`} />
          {order.canDecline ? <RoundItem glyph="✕" label="Отмена" onClick={onDecline} /> : null}
        </div>
      </GlassCard>

      <GlassCard className="flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#FFC400] bg-[#FFC400]/10 text-lg font-black text-[#FFC400]">
          {order.passenger.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Пассажир</div>
          <div className="truncate font-extrabold text-white">{order.passenger.name}</div>
        </div>
        <a href={`tel:${order.passenger.phone}`} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-[#FFC400] backdrop-blur-xl">
          {formatPhone(order.passenger.phone)}
        </a>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3 p-4">
        <PointRow mark="А" label="Подача" address={order.pickup.address} />
        <div className="ml-3 h-4 w-px bg-white/20" aria-hidden="true" />
        <PointRow mark="Б" label="Назначение" address={order.destination.address} tone="blue" />
      </GlassCard>

      <a
        href={navigatorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-[#FFC400] backdrop-blur-xl"
      >
        <span aria-hidden="true">🧭</span>
        Открыть в навигаторе: {NAVIGATOR_TEXT[navigator]} ↗
      </a>

      {order.nextAction ? (
        <Button id="driver-next-action" variant="primary" loading={busy} onClick={onAction} className={`w-full ${CTA}`}>
          {order.nextAction.label}
        </Button>
      ) : null}
    </section>
  );
}
