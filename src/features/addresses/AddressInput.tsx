"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type AddressSuggestion } from "@/shared/api";
import type { LatLng } from "@/core/geo";
import { Spinner } from "@/core/widgets/ui";

type Props = {
  label: string;
  value: string;
  placeholder: string;
  near?: LatLng | null;
  onTextChange: (text: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  icon: string;
};

/** Поле адреса с поиском и выбором из подсказок (геокодинг выполняется на сервере). */
export function AddressInput({ label, value, placeholder, near, onTextChange, onSelect, icon }: Props) {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (q.length < 3 || q === lastQueryRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { items } = await api.geocode.search(q, near);
        lastQueryRef.current = q;
        setItems(items);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Ошибка поиска адреса");
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, open, near]);

  return (
    <div className="relative">
      <label className="mb-1 block px-1 text-xs font-semibold text-white/60">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 backdrop-blur-2xl">
        <span className="text-lg text-[#FFC400]">{icon}</span>
        <input
          className="min-w-0 flex-1 bg-transparent py-3 text-base text-white outline-none placeholder:text-white/45"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onTextChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading ? <Spinner className="h-4 w-4 text-[#FFC400]" /> : null}
      </div>
      {open && (items.length > 0 || error) && (
        <ul className="absolute left-0 right-0 z-[1500] mt-2 max-h-64 overflow-y-auto rounded-[24px] border border-white/20 bg-[#0E1230]/95 p-2 backdrop-blur-2xl">
          {error ? <li className="px-3 py-2 text-sm text-danger">{error}</li> : null}
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-white hover:bg-white/10 active:bg-white/15"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(s);
                  lastQueryRef.current = s.address;
                  setItems([]);
                  setOpen(false);
                }}
              >
                <div className="text-sm font-semibold">{s.title}</div>
                {s.subtitle ? <div className="text-xs text-white/55">{s.subtitle}</div> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
