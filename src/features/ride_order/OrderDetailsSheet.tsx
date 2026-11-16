"use client";

import { useState } from "react";
import { Button } from "@/core/widgets/ui";
import { BrandMark } from "@/core/widgets/BrandMark";
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

/** Экран деталей заказа: открывается кнопкой справа от основного действия. */
export function OrderDetailsSheet({ open, onClose, pickupText, destinationText, tariff, onOrder, ordering }: Props) {
  const [notice, setNotice] = useState("");
  if (!open) return null;

  const unavailable = (title: string) => setNotice(`«${title}» пока недоступно в этой версии`);

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-bg">
      {/* Шапка */}
      <header className="flex items-start gap-3 px-4 pb-4 pt-6">
        <button
          type="button"
          aria-label="Назад к заказу"
          onClick={onClose}
          className="neo-btn flex h-12 w-12 shrink-0 items-center justify-center text-2xl text-ink"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 pt-1 text-center">
          <p className="truncate text-sm font-semibold text-ink">{pickupText || "Адрес отправления"}</p>
          <p className="truncate text-sm font-semibold text-ink">{destinationText || "Адрес назначения"}</p>
        </div>
        <button
          type="button"
          aria-label="Информация о тарифе"
          onClick={() => unavailable("Информация о тарифе")}
          className="neo-btn flex h-12 w-12 shrink-0 items-center justify-center text-lg font-bold text-muted"
        >
          i
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Тариф */}
        <section className="flex flex-col items-center rounded-3xl neo px-4 py-6">
          <svg viewBox="0 0 64 32" className="h-24 w-56" aria-hidden="true">
            <path d="M5 22h54v-5c0-3-2-5-5-5H43l-6-6H18c-4 0-7 3-8 7l-2 6v3z" fill="#FFC72C" />
            <path d="M21 8h15l4 5H18l3-5z" fill="#fff" opacity="0.55" />
            <circle cx="17" cy="23" r="5" fill="#263445" />
            <circle cx="17" cy="23" r="2" fill="#c6ccd4" />
            <circle cx="47" cy="23" r="5" fill="#263445" />
            <circle cx="47" cy="23" r="2" fill="#c6ccd4" />
          </svg>
          <h2 className="mt-4 self-start text-2xl font-bold text-ink">{tariff?.name ?? "Тариф"}</h2>
          <p className="mt-1 self-start text-sm text-muted">Для коротких поездок · ♿ 4</p>
          <button
            type="button"
            onClick={() => unavailable("Детализация цены")}
            className="mt-4 self-start text-2xl font-bold text-ink"
          >
            ⚡ {tariff ? formatMoney(tariff.price) : "—"} · {tariff ? formatDuration(tariff.pickupEtaSeconds) : "—"} ›
          </button>
        </section>

        {/* Дополнительные опции */}
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {OPTIONS.map((option) => (
            <button
              key={option.title}
              type="button"
              onClick={() => unavailable(option.title)}
              className="neo flex min-w-[140px] flex-col gap-3 rounded-2xl p-3 text-left"
            >
              <span className="text-3xl" aria-hidden="true">{option.icon}</span>
              <span className="text-sm font-semibold text-ink">{option.title}</span>
              <span className="neo-btn flex items-center justify-between rounded-full px-3 py-2 text-xs font-semibold text-accent">
                {option.action} <span aria-hidden="true">›</span>
              </span>
            </button>
          ))}
        </div>

        {/* Настройки поездки */}
        <div className="neo mt-4 flex flex-col overflow-hidden rounded-3xl">
          {ROWS.map((row, index) => (
            <button
              key={row.title}
              type="button"
              onClick={() => unavailable(row.title)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left ${index > 0 ? "border-t border-muted/15" : ""}`}
            >
              <span className="text-xl" aria-hidden="true">{row.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{row.title}</span>
                {row.subtitle ? <span className="block text-xs text-muted">{row.subtitle}</span> : null}
              </span>
              <span className="text-xl text-muted" aria-hidden="true">›</span>
            </button>
          ))}
        </div>

        {notice ? <p className="mt-3 text-center text-sm text-danger">{notice}</p> : null}
      </div>

      {/* Нижнее действие */}
      <div className="neo m-3 mt-0 flex shrink-0 items-center gap-2 p-2">
        <BrandMark />
        <Button variant="primary" className="min-h-14 flex-1 text-lg" onClick={onOrder} loading={ordering} disabled={!tariff}>
          Заказать
        </Button>
        <button
          type="button"
          aria-label="Закрыть детали"
          onClick={onClose}
          className="neo-btn flex h-12 w-12 shrink-0 items-center justify-center text-xl text-ink"
        >
          ⌄
        </button>
      </div>
    </div>
  );
}
