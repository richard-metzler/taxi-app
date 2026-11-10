"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth, useSession } from "@/shared/session";
import { clearStoredRole } from "@/shared/role";
import type { DriverStateView } from "@/shared/driver-types";
import { NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";
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
    if (user) setName(user.name);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api.driver
      .state()
      .then((state) => setProfile(state.driver))
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить профиль"));
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

  const leave = async (forgetRole: boolean) => {
    setSigningOut(true);
    try {
      if (forgetRole) clearStoredRole();
      await signOut(forgetRole ? { to: "/" } : undefined);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось выйти");
      setSigningOut(false);
    }
  };

  const vehicle = profile?.vehicle;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PageHeader title="Профиль водителя" />
      <div className="flex flex-1 flex-col gap-4 px-3 pb-3">
        <section className="neo flex flex-col gap-3 p-4">
          <label className="text-xs font-semibold text-muted" htmlFor="driver-name">Имя</label>
          <input id="driver-name" className="neo-input px-4 py-3 text-base" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <div className="text-xs font-semibold text-muted">Телефон</div>
          <div className="neo-inset px-4 py-3 text-base text-muted">{formatPhone(user.phone)}</div>
          <Button variant="primary" loading={saving} disabled={!name.trim() || name.trim() === user.name} onClick={() => save({ name })}>
            Сохранить имя
          </Button>
          {saved ? <div className="text-center text-sm text-success">Сохранено</div> : null}
        </section>

        <section className="neo flex flex-col gap-2 p-4">
          <div className="text-xs font-semibold text-muted">Автомобиль</div>
          {vehicle ? (
            <div className="neo-inset px-4 py-3 text-sm">
              <div className="font-bold">
                {vehicle.brand} {vehicle.model}
              </div>
              <div className="text-muted">
                {vehicle.color.toLowerCase()} · {vehicle.plate} · {vehicle.tariffName}
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
                className={`${user.navigator === n ? "neo-inset text-accent" : "neo-btn"} flex items-center justify-between px-4 py-3 text-left font-semibold`}
              >
                {NAVIGATOR_TEXT[n]}
                {user.navigator === n ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        </section>

        <ErrorBanner message={error} />

        <Button loading={signingOut} onClick={() => { localStorage.setItem("max_auto_login_disabled", "true"); void leave(true); }}>
          Сменить роль (выйти из аккаунта)
        </Button>
        <Button variant="danger" loading={signingOut} onClick={() => { localStorage.setItem("max_auto_login_disabled", "true"); void leave(false); }}>
          Выйти из аккаунта
        </Button>
      </div>
      <div className="sticky bottom-0">
        <BottomNav items={DRIVER_NAV} />
      </div>
    </main>
  );
}
