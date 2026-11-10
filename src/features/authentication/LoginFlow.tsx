"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/shared/api";
import { useSession } from "@/shared/session";
import { clearStoredRole, type AppRole } from "@/shared/role";
import { normalizePhone } from "@/core/phone";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordPolicyError } from "@/core/password-policy";
import { DRIVER_CLASSES, validateVehicle, type DriverClassId } from "@/core/vehicle";
import { AppLogo } from "@/core/widgets/AppLogo";
import { Button, ErrorBanner } from "@/core/widgets/ui";

type Mode = "login" | "register";

type Props = { role: AppRole; notice?: string | null };

function PasswordField({
  id,
  label,
  value,
  onChange,
  registration,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  registration: boolean;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold" htmlFor={id}>{label}</label>
      <div className="neo-input flex items-center gap-2 px-4">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={registration ? "new-password" : "current-password"}
          className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={registration ? "Придумайте пароль" : "Введите пароль"}
          minLength={registration ? PASSWORD_MIN_LENGTH : undefined}
          maxLength={PASSWORD_MAX_LENGTH}
          disabled={disabled}
          required
        />
        <button
          type="button"
          className="shrink-0 rounded-lg px-1 py-3 text-xs font-semibold text-accent"
          aria-label={visible ? `Скрыть пароль: ${label}` : `Показать пароль: ${label}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
        >
          {visible ? "Скрыть" : "Показать"}
        </button>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  disabled,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  disabled: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold" htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type="text"
        autoComplete={autoComplete ?? "off"}
        className="neo-input px-4 py-4 text-base"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        required
      />
    </div>
  );
}

/**
 * Вход по телефону и паролю или регистрация в выбранной роли.
 * Водитель при регистрации дополнительно указывает автомобиль. Без SMS и переходов между страницами.
 */
export function LoginFlow({ role, notice }: Props) {
  const router = useRouter();
  const { completeSignIn } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("+7 ");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [tariffId, setTariffId] = useState<DriverClassId>("econom");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registering = mode === "register";
  const isDriver = role === "driver";

  useEffect(() => {
    if (!isDriver) void import("@/features/map/RideMap").catch(() => undefined);
  }, [isDriver]);

  const switchMode = (next: Mode) => {
    if (busy || next === mode) return;
    setMode(next);
    setPassword("");
    setConfirmation("");
    setError(null);
  };

  const changeRole = () => {
    clearStoredRole();
    router.replace("/");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Введите корректный номер телефона в формате +7 XXX XXX-XX-XX");
      return;
    }
    if (!password) {
      setError("Введите пароль");
      return;
    }
    let vehicle;
    if (registering) {
      if (!name.trim()) {
        setError("Укажите имя");
        return;
      }
      const policyError = passwordPolicyError(password);
      if (policyError) {
        setError(policyError);
        return;
      }
      if (password !== confirmation) {
        setError("Пароли не совпадают");
        return;
      }
      if (isDriver) {
        const checked = validateVehicle({ brand, model, color, plate, tariffId });
        if (!checked.ok) {
          setError(checked.error);
          return;
        }
        vehicle = checked.value;
      }
    }

    setBusy(true);
    try {
      if (registering) {
        await api.auth.register({ phone: normalized, name: name.trim(), password, role, vehicle });
      } else {
        await api.auth.login({ phone: normalized, password, role });
      }
      setPassword("");
      setConfirmation("");
      // Контрольная проверка сессии через тот же транспорт, которым пользуется приложение.
      const { user } = await api.auth.me();
      if (!user) {
        setError("Не удалось открыть сессию. Попробуйте войти ещё раз.");
        return;
      }
      completeSignIn(user);
    } catch (cause) {
      setPassword("");
      setConfirmation("");
      setError(
        cause instanceof ApiError
          ? cause.message
          : registering
            ? "Не удалось зарегистрироваться. Попробуйте ещё раз."
            : "Не удалось войти. Попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  };

  const heading = registering
    ? isDriver ? "Регистрация водителя" : "Создайте аккаунт"
    : isDriver ? "Вход для водителей" : "С возвращением!";
  const hint = registering
    ? isDriver ? "Укажите имя, телефон, пароль и данные автомобиля." : "Укажите имя, номер телефона и пароль."
    : "Войдите по номеру телефона и паролю.";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-6 flex flex-col items-center justify-center gap-3">
        <AppLogo className="h-auto w-48 max-w-full drop-shadow-sm" />
        <div className="flex items-center gap-2 text-sm">
          <span id="auth-role-badge" className="neo-inset rounded-full px-3 py-1 text-xs font-bold text-accent">
            {isDriver ? "🚖 Водитель" : "🧍 Пассажир"}
          </span>
          <button
            type="button"
            id="auth-change-role"
            onClick={() => { localStorage.setItem("max_auto_login_disabled", "true"); changeRole(); }}
            disabled={busy}
            className="text-xs font-semibold text-accent underline underline-offset-4"
          >
            Сменить роль
          </button>
        </div>
      </div>

      {notice ? (
        <div className="neo-inset mb-5 px-4 py-3 text-sm font-semibold text-accent" role="status">{notice}</div>
      ) : null}

      <section className="neo flex flex-col gap-5 p-5 sm:p-6" aria-label={registering ? "Регистрация" : "Вход в аккаунт"}>
        <div className="neo-inset flex gap-1 p-1" role="tablist" aria-label="Способ входа">
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              id={`auth-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              aria-controls="auth-form-panel"
              disabled={busy}
              onClick={() => switchMode(tab)}
              className={`min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-shadow ${mode === tab ? "neo-sm text-accent" : "text-muted"}`}
            >
              {tab === "login" ? "Вход" : "Регистрация"}
            </button>
          ))}
        </div>

        <div id="auth-form-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
          <h1 className="text-xl font-bold">{heading}</h1>
          <p className="mt-1 text-sm text-muted">{hint}</p>

          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4" aria-busy={busy}>
            {registering ? (
              <TextField
                id="auth-name"
                label="Ваше имя"
                value={name}
                onChange={setName}
                placeholder="Как к вам обращаться?"
                maxLength={60}
                disabled={busy}
                autoComplete="given-name"
              />
            ) : null}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="login-phone">Номер телефона</label>
              <input
                id="login-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="neo-input px-4 py-4 text-lg"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 999 123-45-67"
                disabled={busy}
                required
              />
            </div>

            <PasswordField
              key={`${mode}-password`}
              id="auth-password"
              label="Пароль"
              value={password}
              onChange={setPassword}
              registration={registering}
              disabled={busy}
            />
            {registering ? (
              <>
                <p className="-mt-2 text-xs text-muted">От 8 до 128 символов. Используйте пароль, который не применяете на других сайтах.</p>
                <PasswordField
                  id="auth-password-confirm"
                  label="Повторите пароль"
                  value={confirmation}
                  onChange={setConfirmation}
                  registration
                  disabled={busy}
                />
                {confirmation && password !== confirmation ? <p className="text-xs text-danger" role="status">Пароли не совпадают</p> : null}
              </>
            ) : null}

            {registering && isDriver ? (
              <fieldset className="flex flex-col gap-4 border-0 p-0" aria-label="Автомобиль">
                <legend className="mb-1 text-sm font-bold text-ink">Ваш автомобиль</legend>
                <div className="grid grid-cols-2 gap-3">
                  <TextField id="vehicle-brand" label="Марка" value={brand} onChange={setBrand} placeholder="Lada" maxLength={40} disabled={busy} />
                  <TextField id="vehicle-model" label="Модель" value={model} onChange={setModel} placeholder="Vesta" maxLength={40} disabled={busy} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField id="vehicle-color" label="Цвет" value={color} onChange={setColor} placeholder="Белый" maxLength={30} disabled={busy} />
                  <TextField id="vehicle-plate" label="Госномер" value={plate} onChange={setPlate} placeholder="А123ВС70" maxLength={12} disabled={busy} />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold" id="vehicle-class-label">Класс автомобиля</span>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="vehicle-class-label">
                    {DRIVER_CLASSES.map((item) => (
                      <button
                        key={item.id}
                        id={`vehicle-class-${item.id}`}
                        type="button"
                        role="radio"
                        aria-checked={tariffId === item.id}
                        disabled={busy}
                        onClick={() => setTariffId(item.id)}
                        className={`min-h-11 rounded-xl px-2 py-2 text-sm font-bold ${tariffId === item.id ? "neo-inset text-accent" : "neo-btn text-ink"}`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>
            ) : null}

            <ErrorBanner message={error} />
            <Button type="submit" variant="primary" loading={busy}>
              {registering ? "Зарегистрироваться" : "Войти"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted">
          {registering ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
          <button type="button" disabled={busy} onClick={() => switchMode(registering ? "login" : "register")} className="font-semibold text-accent underline underline-offset-4">
            {registering ? "Войти" : "Зарегистрироваться"}
          </button>
        </p>
        {registering ? <p className="text-center text-xs text-muted">Номер телефона используется как логин. SMS-подтверждение не требуется.</p> : null}
      </section>
    </main>
  );
}
