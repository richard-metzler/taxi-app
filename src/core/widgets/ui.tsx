"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "default" | "danger" };

/** Неоморфная кнопка. */
export function Button({ loading, variant = "default", className = "", children, disabled, ...rest }: BtnProps) {
  const base = "flex items-center justify-center gap-2 px-5 py-4 text-base font-semibold min-h-14";
  const style =
    variant === "primary" ? "neo-btn-primary" : variant === "danger" ? "neo-btn text-danger" : "neo-btn text-ink";
  return (
    <button className={`${base} ${style} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner className="h-5 w-5" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Загрузка">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`neo p-4 ${className}`}>{children}</div>;
}

export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div className="neo-inset flex items-center gap-3 px-4 py-3 text-sm text-danger" role="alert">
      <span className="text-lg">⚠️</span>
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button onClick={onRetry} className="font-semibold text-accent underline">
          Повторить
        </button>
      ) : null}
    </div>
  );
}

/** Индикатор отсутствия интернета. */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] bg-danger px-4 py-2 text-center text-sm font-semibold text-white">
      Нет подключения к интернету. Данные синхронизируются после восстановления связи.
    </div>
  );
}

type NavItem = { href: string; label: string; icon: string };

export const PASSENGER_NAV: NavItem[] = [
  { href: "/home", label: "Заказ", icon: "🗺️" },
  { href: "/history", label: "История", icon: "🕓" },
  { href: "/settings", label: "Настройки", icon: "⚙️" },
];

/** Нижнее меню водителя. */
export const DRIVER_NAV: NavItem[] = [
  { href: "/driver", label: "Заказы", icon: "🚖" },
  { href: "/driver/history", label: "Поездки", icon: "🕓" },
  { href: "/driver/settings", label: "Профиль", icon: "⚙️" },
];

export function BottomNav({ items = PASSENGER_NAV }: { items?: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="neo safe-bottom mx-auto mb-2 flex w-[calc(100%-1.5rem)] max-w-md items-stretch justify-around px-2 pt-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-semibold ${
              active ? "neo-inset text-accent" : "text-muted"
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, back }: { title: string; back?: string }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-4 pb-2">
      {back ? (
        <Link href={back} className="neo-btn flex h-11 w-11 items-center justify-center text-xl" aria-label="Назад">
          ←
        </Link>
      ) : null}
      <h1 className="text-xl font-bold">{title}</h1>
    </header>
  );
}

export function StatusPill({ text, tone = "accent" }: { text: string; tone?: "accent" | "success" | "danger" | "muted" }) {
  const color =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : "text-accent";
  return <span className={`neo-inset inline-block rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{text}</span>;
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Сворачиваемая секция внутри карточки (например, водитель или детали маршрута). */
export function CollapsibleSection({
  id,
  title,
  summary,
  badge,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary?: string | null;
  badge?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = `${id}-content`;
  return (
    <section className="neo-inset px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          id={`${id}-toggle`}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={onToggle}
          className="flex min-h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wide text-muted uppercase">{title}</div>
            {collapsed && summary ? <div className="truncate text-sm font-semibold text-ink">{summary}</div> : null}
          </div>
          <span className="neo-btn flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-accent">
            <span>{collapsed ? "Показать" : "Скрыть"}</span>
            <ChevronIcon collapsed={collapsed} />
          </span>
        </button>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <div id={contentId} hidden={collapsed} className={collapsed ? "hidden" : "mt-2.5"}>
        {children}
      </div>
    </section>
  );
}
