"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth, useSession } from "@/shared/session";
import { clearStoredRole } from "@/shared/role";
import { NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";
import { formatPhone } from "@/core/phone";
import { Button, BottomNav, ErrorBanner, PageHeader, Spinner } from "@/core/widgets/ui";

const NAVIGATORS = Object.keys(NAVIGATOR_TEXT) as UserProfile["navigator"][];

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { setUser, signOut } = useSession();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- имя синхронизируется с загруженным профилем
    if (user) setName(user.name);
  }, [user]);

  if (loading || !user) {
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  // Единая реализация выхода: обычный выход остаётся в разделе роли, смена роли ведёт к выбору.
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PageHeader title="Настройки" />
      <div className="flex flex-1 flex-col gap-4 px-3 pb-3">
        <section className="neo flex flex-col gap-3 p-4">
          <label className="text-xs font-semibold text-muted">Имя</label>
          <input className="neo-input px-4 py-3 text-base" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <label className="text-xs font-semibold text-muted">Телефон</label>
          <div className="neo-inset px-4 py-3 text-base text-muted">{formatPhone(user.phone)}</div>
          <div className="text-xs text-muted">Роль: пассажир (изменяется только администратором системы)</div>
          <Button variant="primary" loading={saving} disabled={name.trim() === user.name} onClick={() => save({ name })}>
            Сохранить имя
          </Button>
          {saved ? <div className="text-center text-sm text-success">Сохранено</div> : null}
        </section>

        <section className="neo flex flex-col gap-2 p-4">
          <div className="text-xs font-semibold text-muted">Карта и навигатор</div>
          <div className="text-xs text-muted">
            Переключает подложку карты на главном экране и в заказе (Яндекс Карты, 2ГИС или Google Карты) и сохраняется в профиле.
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

        {/* Управление аккаунтом — отдельная секция, а не часть навигатора */}
        <section className="neo flex flex-col gap-3 p-4">
          <div className="text-xs font-semibold text-muted">Аккаунт</div>
          <button
            onClick={() => void leave(false)}
            disabled={signingOut}
            className="neo-btn flex h-14 w-full items-center justify-center text-base font-semibold text-red-500 disabled:opacity-50"
          >
            Выйти из аккаунта
          </button>
          <button
            onClick={() => void leave(true)}
            disabled={signingOut}
            className="neo-btn flex h-14 w-full items-center justify-center text-base font-semibold text-ink disabled:opacity-50"
          >
            Сменить роль
          </button>
        </section>

        <ErrorBanner message={error} />
      </div>
      <div className="sticky bottom-0">
        <BottomNav />
      </div>
    </main>
  );
}
