"use client";

import { useState } from "react";
import { Spinner } from "@/core/widgets/ui";
import { BrandMark } from "@/core/widgets/BrandMark";
import { GlassCard, TaxiArt, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";
import { formatDuration, formatMoney, type TariffQuoteView } from "@/shared/types";

type Props = {
  open: boolean;
  onClose: () => void;
  pickupText: string;
  destinationText: string;
  tariff: TariffQuoteView | null;
  onOrder: () => void;
  ordering: boolean;
};

const OPTIONS = [
  { icon: "👶", title: "Детское кресло", action: "С детьми" },
  { icon: "🐾", title: "С питомцем", action: "+" },
  { icon: "🎿", title: "Лыжи или сноуборд", action: "Комфорт" },
];

const ROWS = [
  { icon: "📅", title: "Оформить предзаказ", subtitle: "Запланировать поездку на своё время" },
  { icon: "💬", title: "Комментарий водителю", subtitle: null },
  { icon: "👤", title: "Заказ другому человеку", subtitle: null },
  { icon: "♿", title: "Специальные возможности", subtitle: "Инвалидное кресло, помощь в поиске машины…" },
];

const ROUND_GLOW = {
  border: "1.5px solid #5B8FE8",
  boxShadow: "0 0 18px rgba(91,143,232,0.55), inset 0 0 12px rgba(91,143,232,0.18)",
};

/** Экран деталей заказа: открывается кнопкой справа от основного действия. */
export function OrderDetailsSheet({ open, onClose, pickupText, destinationText, tariff, onOrder, ordering }: Props) {
  const [notice, setNotice] = useState("");
  if (!open) return null;

  const unavailable = (title: string) => setNotice(`«${title}» пока недоступно в этой версии`);

  return (
    <main className="fixed inset-0 z-[2000] flex h-dvh w-full flex-col overflow-hidden bg-[#07071A] text-white">
      <TuberBackdrop />

      {/* Шапка эталона: Back / логотип / профиль */}
      <div className="relative z-10">
        <TuberHeader
          onBack={onClose}
          onProfile={() => unavailable("Информация о тарифе")}
          brand="рядом"
        />
        {/* Сохраняем доступное имя кнопки возврата для существующих селекторов */}
        <button
          type="button"
          aria-label="Назад к заказу"
          onClick={onClose}
          className="absolute left-4 top-9 h-11 w-24 bg-transparent"
        />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-4">
        {/* Адреса: два жёлтых маркера и крупные цифры как на экране поездки */}
        <section className="mt-8 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="h-[15px] w-[15px] shrink-0 rounded-full bg-[#FFC400]" aria-hidden="true" />
              <span className="max-w-[190px] truncate text-[17px] font-medium">{pickupText || "Адрес отправления"}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-[15px] w-[15px] shrink-0 rounded-full bg-[#FFC400]" aria-hidden="true" />
              <span className="max-w-[190px] truncate text-[17px] font-medium">{destinationText || "Адрес назначения"}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-medium text-white/60">{tariff ? formatDuration(tariff.pickupEtaSeconds) : "—"}</div>
            <div className="text-[28px] font-bold leading-tight tracking-tight">
              {tariff ? formatMoney(tariff.price) : "—"}
            </div>
          </div>
        </section>

        {/* Крупная 3D-машина эталона */}
        <div className="relative mx-auto mt-6 h-[210px] w-[320px] max-w-full">
          <TaxiArt view="front" className="h-full w-full" />
        </div>

        {/* Тариф */}
        <GlassCard className="mt-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">{tariff?.name ?? "Тариф"}</h2>
            <span className="shrink-0 rounded-full bg-[#FFC400] px-3 py-1 text-sm font-bold text-[#07071A]">
              {tariff ? formatDuration(tariff.pickupEtaSeconds) : "—"}
            </span>
          </div>
          <p className="mt-1 text-sm text-white/60">Для коротких поездок · ♿ 4</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => unavailable("Детализация цены")}
              className="text-2xl font-bold text-white"
            >
              ⚡ {tariff ? formatMoney(tariff.price) : "—"} · {tariff ? formatDuration(tariff.pickupEtaSeconds) : "—"} ›
            </button>
            <button
              type="button"
              aria-label="Информация о тарифе"
              onClick={() => unavailable("Информация о тарифе")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold text-white/90"
            >
              i
            </button>
          </div>
        </GlassCard>

        {/* Дополнительные опции */}
        <div className="mt-4 flex gap-3 overflow-x-auto scrollbar-hide">
          {OPTIONS.map((option) => (
            <GlassCard key={option.title} className="min-w-[150px] p-3">
              <button
                type="button"
                onClick={() => unavailable(option.title)}
                className="flex w-full flex-col gap-3 text-left"
              >
                <span className="text-3xl" aria-hidden="true">{option.icon}</span>
                <span className="text-sm font-semibold text-white">{option.title}</span>
                <span className="flex items-center justify-between rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-[#FFC400]">
                  {option.action} <span aria-hidden="true">›</span>
                </span>
              </button>
            </GlassCard>
          ))}
        </div>

        {/* Настройки поездки */}
        <GlassCard className="mt-4 flex flex-col overflow-hidden">
          {ROWS.map((row, index) => (
            <button
              key={row.title}
              type="button"
              onClick={() => unavailable(row.title)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left ${index > 0 ? "border-t border-white/15" : ""}`}
            >
              <span className="text-xl" aria-hidden="true">{row.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-white">{row.title}</span>
                {row.subtitle ? <span className="block text-xs text-white/55">{row.subtitle}</span> : null}
              </span>
              <span className="text-xl text-white/55" aria-hidden="true">›</span>
            </button>
          ))}
        </GlassCard>

        {notice ? <p className="mt-3 text-center text-sm text-danger">{notice}</p> : null}
      </div>

      {/* Нижнее действие */}
      <GlassCard className="mx-3 mb-3 mt-0 flex shrink-0 items-center gap-3 p-3">
        <BrandMark className="h-12 w-12 shrink-0" />
        <button
          type="button"
          onClick={onOrder}
          disabled={!tariff || ordering}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[25px] bg-[#FFC400] text-[17px] font-bold text-[#07071A] shadow-[0_8px_24px_rgba(255,196,0,0.35)] transition active:scale-[0.99] disabled:opacity-50"
        >
          {ordering ? <Spinner className="h-5 w-5" /> : null}
          Заказать
        </button>
        <button
          type="button"
          aria-label="Закрыть детали"
          onClick={onClose}
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white backdrop-blur-2xl"
          style={ROUND_GLOW}
        >
          ⌄
        </button>
      </GlassCard>
    </main>
  );
}
