"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { resolveSheetSwipe } from "@/core/collapsible";
import { StatusPill } from "@/core/widgets/ui";

type Props = {
  id: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  badgeTone?: "accent" | "success" | "danger" | "muted";
  pulse?: boolean;
  collapseLabel?: string;
  expandLabel?: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  maxHeightClass?: string;
  children: ReactNode;
};

/**
 * Неоморфная нижняя панель поверх карты.
 * Сворачивается кнопкой или свайпом вниз за шапку, освобождая карту; содержимое остаётся в DOM,
 * поэтому введённые адреса и расчёт маршрута не сбрасываются.
 */
export function CollapsibleSheet({
  id,
  collapsed,
  onCollapsedChange,
  title,
  subtitle,
  badge,
  badgeTone = "accent",
  pulse = false,
  collapseLabel = "Свернуть панель",
  expandLabel = "Развернуть панель",
  headerExtra,
  footer,
  maxHeightClass = "max-h-[72dvh]",
  children,
}: Props) {
  const startYRef = useRef<number | null>(null);
  const bodyId = `${id}-body`;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    startYRef.current = event.clientY;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    const action = resolveSheetSwipe(event.clientY - startYRef.current);
    startYRef.current = null;
    if (action === "collapse" && !collapsed) onCollapsedChange(true);
    if (action === "expand" && collapsed) onCollapsedChange(false);
  };

  return (
    <div className={`pointer-events-none relative z-[1000] mt-auto flex flex-col ${collapsed ? "" : maxHeightClass}`}>
      <section
        aria-label={title}
        data-collapsed={collapsed ? "true" : "false"}
        className={`neo pointer-events-auto mx-3 mb-2 flex flex-col overflow-hidden transition-all duration-200 ${
          collapsed ? "px-4 py-2.5" : "gap-3 overflow-y-auto p-4"
        }`}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            startYRef.current = null;
          }}
          className="flex touch-pan-x flex-col gap-1.5 select-none"
        >
          <div className="mx-auto h-1.5 w-11 rounded-full bg-muted/35" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            {collapsed ? (
              <button
                type="button"
                aria-expanded={false}
                aria-controls={bodyId}
                onClick={() => onCollapsedChange(false)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                {pulse ? <span className="pulse-dot inline-block h-3 w-3 shrink-0 rounded-full bg-accent" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-ink">{title}</span>
                  {subtitle ? <span className="block truncate text-xs text-muted">{subtitle}</span> : null}
                </span>
              </button>
            ) : (
              <div className="min-w-0 flex-1">{headerExtra}</div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {collapsed && badge ? <StatusPill text={badge} tone={badgeTone} /> : null}
              <button
                type="button"
                id={`${id}-toggle`}
                aria-label={collapsed ? expandLabel : collapseLabel}
                aria-expanded={!collapsed}
                aria-controls={bodyId}
                onClick={() => onCollapsedChange(!collapsed)}
                className="neo-btn flex min-h-10 items-center gap-1.5 px-3 py-2 text-xs font-semibold text-accent"
              >
                <span>{collapsed ? "Развернуть" : "Карта"}</span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div id={bodyId} hidden={collapsed} className={collapsed ? "hidden" : "flex flex-col gap-3"}>
          {children}
        </div>
      </section>
      {footer ? <div className="pointer-events-auto">{footer}</div> : null}
    </div>
  );
}
