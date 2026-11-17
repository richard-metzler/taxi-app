"use client";

import Image from "next/image";
import type { ReactNode } from "react";

/** Единые визуальные примитивы эталона tuber: шапка, glass-карточка, круглая кнопка. */

export function TuberHeader({
  onBack,
  onProfile,
  brand = "рядом",
}: {
  onBack?: () => void;
  onProfile?: () => void;
  brand?: string;
}) {
  return (
    <header className="relative z-10 flex items-center justify-between px-6 pt-11 text-white">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[15px] font-medium text-white/90">
        <span className="text-xl leading-none">‹</span> Back
      </button>
      <span className="absolute left-1/2 -translate-x-1/2 text-[26px] font-black tracking-tight">{brand}</span>
      <button type="button" aria-label="Профиль" onClick={onProfile} className="flex h-9 w-9 items-center justify-center text-white/90">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="7" r="3.2" />
          <path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[28px] border border-white/20 bg-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </section>
  );
}

export function RoundAction({ glyph, label, onClick }: { glyph: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-[92px] flex-col items-center gap-2 text-white">
      <span
        className="flex h-[58px] w-[58px] items-center justify-center rounded-full text-2xl"
        style={{ border: "1.5px solid #5B8FE8", boxShadow: "0 0 18px rgba(91,143,232,0.55), inset 0 0 12px rgba(91,143,232,0.18)" }}
      >
        {glyph}
      </span>
      <span className="text-center text-[13px] font-medium leading-tight text-white/85">{label}</span>
    </button>
  );
}

export function TaxiArt({ view, className = "" }: { view: "front" | "top"; className?: string }) {
  return (
    <div className={`pointer-events-none relative ${className}`}>
      <Image
        src={view === "front" ? "/images/taxi-3d-front.svg" : "/images/taxi-3d-top.svg"}
        alt=""
        fill
        unoptimized
        className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
        aria-hidden="true"
      />
    </div>
  );
}

/** Фон эталона: почти чёрный верх и синий подсвет снизу. */
export function TuberBackdrop({ blue = false }: { blue?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className={blue
        ? "absolute inset-0 bg-[linear-gradient(180deg,#1C4283_0%,#5093D6_52%,#153A90_100%)]"
        : "absolute inset-0 bg-[#07071A]"}
      />
      {!blue ? (
        <div className="absolute inset-x-0 bottom-0 h-[44%] bg-[radial-gradient(ellipse_at_50%_100%,#4E8FE0_0%,#2C5DAA_45%,rgba(7,7,26,0)_78%)]" />
      ) : null}
    </div>
  );
}
