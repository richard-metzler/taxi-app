"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth, useSession } from "@/shared/session";
import { clearStoredRole } from "@/shared/role";
import { NAVIGATOR_TEXT, type UserProfile } from "@/shared/types";
import { formatPhone } from "@/core/phone";
import { Button, BottomNav, ErrorBanner } from "@/core/widgets/ui";
import { SplashScreen } from "@/core/widgets/SplashScreen";
import { BrandMark } from "@/core/widgets/BrandMark";
import { GlassCard, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";

const NAVIGATORS = Object.keys(NAVIGATOR_TEXT) as UserProfile["navigator"][];

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-white/55" fill="none" aria-hidden="true">
      <path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassCard className="overflow-hidden p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFC400]">{title}</h2>
      <div className="mt-2 divide-y divide-white/15">{children}</div>
    </GlassCard>
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
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{label}</span>
        {value ? <span className="block truncate text-xs text-white/65">{value}</span> : null}
        {note ? <span className="mt-0.5 block text-[11px] leading-tight text-white/50">{note}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center gap-3 py-3 text-left transition-opacity disabled:opacity-50">
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 py-3">{content}</div>;
}

export default function SettingsPage() {
  const router = useRouter();
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
    return <SplashScreen />;
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
    <main className="relative flex min-h-dvh w-full flex-col bg-[#07071A] text-white">
      <TuberBackdrop />

      <TuberHeader onBack={() => router.push("/home")} onProfile={() => router.push("/settings")} />

      <h1 className="relative z-10 mt-8 px-6 text-[34px] font-bold leading-tight tracking-tight">Профиль</h1>

      <div className="relative z-10 flex flex-1 flex-col gap-4 px-4 pb-4 pt-6">
        {/* Шапка профиля: знак «Р», имя и телефон */}
        <GlassCard className="flex items-center gap-4 p-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FFC400] ring-2 ring-white/40">
            <BrandMark className="h-10 w-10" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-bold text-white">{user.name}</span>
            <span className="mt-0.5 block text-sm text-white/70">{formatPhone(user.phone)}</span>
          </span>
          <span className="shrink-0 rounded-full border border-[#FFC400]/50 bg-[#FFC400]/15 px-3 py-1 text-xs font-semibold text-[#FFC400]">
            Пассажир
          </span>
        </GlassCard>

        <Group title="Личные данные">
          <Row icon="✏️" label="Имя" value={user.name} trailing={<Chevron />} onClick={() => setNameOpen((open) => !open)} />
          {nameOpen ? (
            <div className="flex flex-col gap-2 py-3">
              <input
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
                onClick={() => save({ name })}
                className="!rounded-2xl"
              >
                Сохранить имя
              </Button>
              {saved ? <div className="text-center text-sm font-semibold text-[#7BE8A6]">Сохранено</div> : null}
            </div>
          ) : null}
          <Row icon="📱" label="Телефон" value={formatPhone(user.phone)} />
          <Row icon="🛡️" label="Роль" value="Пассажир" note="Изменяется только администратором системы" />
        </Group>

        <Group title="Карта и навигатор">
          <div className="py-3 text-xs leading-snug text-white/60">
            Переключает подложку карты на главном экране и в заказе (Яндекс Карты, 2ГИС или Google Карты) и сохраняется в профиле.
          </div>
          {NAVIGATORS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => save({ navigator: n })}
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
          <Row icon="🔄" label="Сменить роль" trailing={<Chevron />} onClick={() => void leave(true)} disabled={signingOut} />
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
        <BottomNav />
      </div>
    </main>
  );
}
