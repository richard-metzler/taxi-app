"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth, useSession } from "@/shared/session";
import { clearStoredRole } from "@/shared/role";
import { NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";
import { formatPhone } from "@/core/phone";
import { Button, BottomNav, ErrorBanner, PageHeader, Spinner } from "@/core/widgets/ui";
import { BrandMark } from "@/core/widgets/BrandMark";

const NAVIGATORS = Object.keys(NAVIGATOR_TEXT) as UserProfile["navigator"][];

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-muted" fill="none" aria-hidden="true">
      <path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="neo overflow-hidden">
      <h2 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="divide-y divide-muted/15 px-4 pb-2">{children}</div>
    </section>
  );
}

type RowProps = {
  icon: string;
  label: string;
  value?: string | null;
  note?: string | null;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

function Row({ icon, label, value, note, trailing, onClick, disabled }: RowProps) {
  const content = (
    <>
      <span className="neo-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{label}</span>
        {value ? <span className="block truncate text-xs text-muted">{value}</span> : null}
        {note ? <span className="mt-0.5 block text-[11px] leading-tight text-muted">{note}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50">
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 py-3">{content}</div>;
}

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { setUser, signOut } = useSession();
  const [name, setName] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(() => setName(user.name));
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg">
      <PageHeader title="Профиль" back="/home" />

      <div className="flex flex-1 flex-col gap-4 px-3 pb-3">
        {/* Шапка профиля: знак «Р», имя и телефон */}
        <section className="neo flex items-center gap-4 p-4">
          <div className="neo-inset flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <BrandMark className="h-12 w-12" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-bold text-ink">{user.name}</div>
            <div className="mt-0.5 text-sm text-muted">{formatPhone(user.phone)}</div>
          </div>
          <span className="neo-inset shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-accent">Пассажир</span>
        </section>

        <Group title="Личные данные">
          <Row icon="✏️" label="Имя" value={user.name} trailing={<Chevron />} onClick={() => setNameOpen((open) => !open)} />
          {nameOpen ? (
            <div className="flex flex-col gap-2 py-3">
              <input
                className="neo-input px-4 py-3 text-base"
                value={name}
                maxLength={60}
                aria-label="Имя"
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                variant="primary"
                loading={saving}
                disabled={!name.trim() || name.trim() === user.name}
                onClick={() => save({ name })}
              >
                Сохранить имя
              </Button>
              {saved ? <div className="text-center text-sm text-success">Сохранено</div> : null}
            </div>
          ) : null}
          <Row icon="📱" label="Телефон" value={formatPhone(user.phone)} />
          <Row icon="🛡️" label="Роль" value="Пассажир" note="Изменяется только администратором системы" />
        </Group>

        <Group title="Карта и навигатор">
          <div className="py-3 text-xs leading-snug text-muted">
            Переключает подложку карты на главном экране и в заказе (Яндекс Карты, 2ГИС или Google Карты) и сохраняется в профиле.
          </div>
          {NAVIGATORS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => save({ navigator: n })}
              className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
            >
              <span className="neo-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
                🧭
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{NAVIGATOR_TEXT[n]}</span>
              {user.navigator === n ? (
                <span className="text-base font-bold text-accent" aria-label="Выбрано">
                  ✓
                </span>
              ) : null}
            </button>
          ))}
        </Group>

        {/* Управление аккаунтом — отдельная секция, а не часть навигатора */}
        <Group title="Аккаунт">
          <Row icon="🔄" label="Сменить роль" trailing={<Chevron />} onClick={() => void leave(true)} disabled={signingOut} />
          <div className="flex items-center gap-3 py-3">
            <span className="neo-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" aria-hidden="true">
              🚪
            </span>
            <button
              type="button"
              onClick={() => void leave(false)}
              disabled={signingOut}
              className="flex-1 text-left text-base font-semibold text-danger disabled:opacity-50"
            >
              Выйти из аккаунта
            </button>
          </div>
        </Group>

        <ErrorBanner message={error} />
      </div>

      <div className="sticky bottom-0 z-40">
        <BottomNav />
      </div>
    </main>
  );
}
