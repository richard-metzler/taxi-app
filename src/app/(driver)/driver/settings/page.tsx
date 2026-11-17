"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth, useSession } from "@/shared/session";
import { clearStoredRole } from "@/shared/role";
import type { DriverStateView } from "@/shared/driver-types";
import { NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";
import { BrandMark } from "@/core/widgets/BrandMark";
import { formatPhone } from "@/core/phone";
import { GlassCard, TaxiArt, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";
import { BottomNav, Button, DRIVER_NAV, ErrorBanner, Spinner } from "@/core/widgets/ui";

const NAVIGATORS = Object.keys(NAVIGATOR_TEXT) as UserProfile["navigator"][];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassCard className="overflow-hidden p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFC400]">{title}</h2>
      <div className="mt-2 divide-y divide-white/15">{children}</div>
    </GlassCard>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{label}</span>
        {value ? <span className="block truncate text-xs text-white/65">{value}</span> : null}
      </span>
    </div>
  );
}

/** Профиль водителя: имя, телефон, автомобиль, навигатор и выход. */
export default function DriverSettingsPage() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const { setUser, signOut } = useSession();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<DriverStateView["driver"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(() => setName(user.name));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(async () => {
      try {
        const state = await api.driver.state();
        setProfile(state.driver);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить профиль");
      }
    });
  }, [user]);

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#07071A]">
        <Spinner className="h-8 w-8 text-[#FFC400]" />
      </main>
    );
  }

  const save = async (patch: { name?: string; navigator?: string }) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { user: updated } = await api.profile.update(patch);
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  // Единая реализация выхода: обычный выход остаётся в разделе водителя, смена роли ведёт к выбору.
  const leave = async (forgetRole: boolean) => {
    setSigningOut(true);
    setError(null);
    try {
      if (forgetRole) clearStoredRole();
      await signOut(forgetRole ? { to: "/?switch=true" } : undefined);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось выйти");
      setSigningOut(false);
    }
  };

  const vehicle = profile?.vehicle;

  return (
    <main className="relative flex min-h-dvh w-full flex-col bg-[#07071A] text-white">
      <TuberBackdrop />

      <TuberHeader onBack={() => router.back()} onProfile={() => router.push("/driver/settings")} />

      <h1 className="relative z-10 mt-8 px-6 text-[34px] font-bold leading-tight tracking-tight">Профиль</h1>

      <div className="relative z-10 flex flex-1 flex-col gap-4 px-4 pb-4 pt-6">
        {/* Шапка профиля: знак «Р», имя и телефон */}
        <GlassCard className="flex items-center gap-4 p-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FFC400] ring-2 ring-white/40">
            <BrandMark className="h-10 w-10" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-bold text-white">{name || user.name}</span>
            <span className="mt-0.5 block text-sm text-white/70">{formatPhone(user.phone)}</span>
          </span>
          <span className="shrink-0 rounded-full border border-[#FFC400]/50 bg-[#FFC400]/15 px-3 py-1 text-xs font-semibold text-[#FFC400]">
            Водитель
          </span>
        </GlassCard>

        <Group title="Личные данные">
          <Row icon="✏️" label="Имя" value={name || user.name} />
          <div className="flex flex-col gap-2 py-3">
            <input
              id="driver-name"
              className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/45 focus:border-[#FFC400] focus:bg-white/15"
              value={name}
              maxLength={60}
              aria-label="Имя"
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="primary"
              loading={saving}
              disabled={!name.trim() || name.trim() === user.name}
              onClick={() => void save({ name })}
              className="!rounded-2xl"
            >
              Сохранить имя
            </Button>
            {saved ? <div className="text-center text-sm font-semibold text-[#7BE8A6]">Сохранено</div> : null}
          </div>
          <Row icon="📱" label="Телефон" value={formatPhone(user.phone)} />
        </Group>

        <Group title="Автомобиль">
          {vehicle ? (
            <div className="flex items-center gap-3 py-3">
              <span className="relative h-12 w-16 shrink-0">
                <TaxiArt view="front" className="absolute inset-0" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {vehicle.brand} {vehicle.model}
                </span>
                <span className="block truncate text-xs text-white/65">
                  {vehicle.color.toLowerCase()} · {vehicle.plate} · {vehicle.tariffName}
                </span>
              </span>
            </div>
          ) : (
            <div className="py-3 text-sm text-white/65">Загрузка…</div>
          )}
        </Group>

        {/* Карта и навигатор */}
        <Group title="Карта и навигатор">
          <div className="py-3 text-xs leading-snug text-white/60">
            Выбранный навигатор открывается кнопкой «Открыть в навигаторе» в заказе, а его карта показывается на главном экране.
          </div>
          {NAVIGATORS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => void save({ navigator: n })}
              className="flex w-full items-center gap-3 py-3 text-left transition-opacity disabled:opacity-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg" aria-hidden="true">
                🧭
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{NAVIGATOR_TEXT[n]}</span>
              {user.navigator === n ? (
                <span className="text-lg font-bold text-[#FFC400]" aria-label="Выбрано">✓</span>
              ) : null}
            </button>
          ))}
        </Group>

        {/* Управление аккаунтом — отдельная секция, а не часть навигатора */}
        <Group title="Аккаунт">
          <div className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg" aria-hidden="true">
              🔄
            </span>
            <button
              type="button"
              onClick={() => void leave(true)}
              disabled={signingOut}
              className="flex-1 text-left text-base font-semibold text-white transition-opacity disabled:opacity-50"
            >
              Сменить роль (выйти из аккаунта)
            </button>
          </div>
          <div className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg" aria-hidden="true">
              🚪
            </span>
            <button
              type="button"
              onClick={() => void leave(false)}
              disabled={signingOut}
              className="flex-1 text-left text-base font-semibold text-[#FF5A5A] transition-opacity disabled:opacity-50"
            >
              Выйти из аккаунта
            </button>
          </div>
        </Group>

        {error ? (
          <div className="[&_.neo-inset]:!rounded-[20px] [&_.neo-inset]:!border [&_.neo-inset]:!border-white/20 [&_.neo-inset]:!bg-white/10 [&_.neo-inset]:!shadow-none [&_.neo-inset]:!backdrop-blur-2xl">
            <ErrorBanner message={error} />
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-40">
        <BottomNav items={DRIVER_NAV} />
      </div>
    </main>
  );
}
