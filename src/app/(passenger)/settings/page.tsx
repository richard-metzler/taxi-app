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

        <ErrorBanner message={error} />

        <Button
          onClick={() => { window.location.href = "/?switch=true"; }}
        >
          Выйти из аккаунта
        </Button>
      </div>
      <div className="sticky bottom-0">
        <BottomNav />
      </div>
    </main>
  );
}
