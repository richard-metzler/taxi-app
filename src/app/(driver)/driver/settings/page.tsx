"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth, useSession } from "@/shared/session";
import { clearStoredRole } from "@/shared/role";
import type { DriverStateView } from "@/shared/driver-types";
import { NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";
import { BrandMark } from "@/core/widgets/BrandMark";
import { formatPhone } from "@/core/phone";
import { BottomNav, Button, DRIVER_NAV, ErrorBanner, PageHeader, Spinner } from "@/core/widgets/ui";

const NAVIGATORS = Object.keys(NAVIGATOR_TEXT) as UserProfile["navigator"][];

/** Профиль водителя: имя, телефон, автомобиль, навигатор и выход. */
export default function DriverSettingsPage() {
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
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PageHeader title="Профиль" />
      <div className="flex flex-1 flex-col gap-4 px-3 pb-3">
        <ErrorBanner message={error} />

        <section className="neo flex items-center gap-4 p-5">
          <BrandMark className="h-16 w-16 rounded-2xl" />
          <div className="min-w-0">
            <div className="truncate text-xl font-bold text-ink">{name || user.name}</div>
            <div className="mt-0.5 text-sm text-muted">{formatPhone(user.phone)}</div>
          </div>
        </section>

        <section className="neo flex flex-col gap-3 p-4">
          <label className="text-xs font-semibold text-muted" htmlFor="driver-name">Имя</label>
          <input id="driver-name" className="neo-input px-4 py-3 text-base" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <Button variant="primary" loading={saving} disabled={!name.trim() || name.trim() === user.name} onClick={() => save({ name })}>
            Сохранить имя
          </Button>
          {saved ? <div className="text-center text-sm text-success">Сохранено</div> : null}
        </section>

        <section className="neo flex flex-col gap-2 p-4">
          <div className="text-xs font-semibold text-muted">Автомобиль</div>
          {vehicle ? (
            <div className="neo-inset flex items-center gap-3 px-4 py-3">
              <div className="neo flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
                <Image src="/images/taxi-side.svg" alt="" width={36} height={36} className="h-8 w-8" draggable={false} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-bold text-ink">
                  {vehicle.brand} {vehicle.model}
                </div>
                <div className="truncate text-xs text-muted">
                  {vehicle.color.toLowerCase()} · {vehicle.plate} · {vehicle.tariffName}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted">Загрузка…</div>
          )}
        </section>

        <section className="neo flex flex-col gap-2 p-4">
          <div className="text-xs font-semibold text-muted">Карта и навигатор</div>
          <div className="text-xs text-muted">
            Выбранный навигатор открывается кнопкой «Открыть в навигаторе» в заказе, а его карта показывается на главном экране.
          </div>
          <div className="mt-1 flex flex-col gap-2">
            {NAVIGATORS.map((n) => (
              <button
                key={n}
                disabled={saving}
                onClick={() => save({ navigator: n })}
                className={`flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold ${
                  user.navigator === n ? "neo-inset text-accent" : "neo-btn text-ink"
                }`}
              >
                {NAVIGATOR_TEXT[n]}
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    user.navigator === n ? "bg-accent text-bg" : "text-transparent"
                  }`}
                  aria-hidden={user.navigator !== n}
                >
                  ✓
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Управление аккаунтом — отдельная секция, а не часть навигатора */}
        <section className="neo flex flex-col gap-3 p-4">
          <div className="text-xs font-semibold text-muted">Аккаунт</div>
          <button
            onClick={() => void leave(true)}
            disabled={signingOut}
            className="neo-btn flex h-14 w-full items-center justify-center text-base font-semibold text-ink disabled:opacity-50"
          >
            Сменить роль (выйти из аккаунта)
          </button>
          <button
            onClick={() => void leave(false)}
            disabled={signingOut}
            className="neo-btn flex h-14 w-full items-center justify-center text-base font-semibold text-danger disabled:opacity-50"
          >
            Выйти из аккаунта
          </button>
        </section>
      </div>
      <div className="sticky bottom-0">
        <BottomNav items={DRIVER_NAV} />
      </div>
    </main>
  );
}
