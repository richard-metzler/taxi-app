/** Данные автомобиля водителя и их проверка. Проверка повторяется сервером при регистрации. */

/** Буквы, допустимые в российских госномерах (имеют латинские аналоги). */
export const PLATE_LETTERS = "АВЕКМНОРСТУХ";

const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: "А",
  B: "В",
  E: "Е",
  K: "К",
  M: "М",
  H: "Н",
  O: "О",
  P: "Р",
  C: "С",
  T: "Т",
  Y: "У",
  X: "Х",
};

const PLATE_RE = new RegExp(`^[${PLATE_LETTERS}]\\d{3}[${PLATE_LETTERS}]{2}\\d{2,3}$`);

/** Приводит госномер к виду «А123ВС70»: верхний регистр, без пробелов, латиница → кириллица. */
export function normalizePlate(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[A-Z]/g, (ch) => LATIN_TO_CYRILLIC[ch] ?? ch);
}

export function isValidPlate(plate: string): boolean {
  return PLATE_RE.test(plate);
}

/** Классы автомобилей совпадают с тарифами сервера. */
export const DRIVER_CLASSES = [
  { id: "econom", name: "Эконом" },
  { id: "comfort", name: "Комфорт" },
  { id: "business", name: "Бизнес" },
] as const;

export type DriverClassId = (typeof DRIVER_CLASSES)[number]["id"];

export type VehicleInput = {
  brand: string;
  model: string;
  color: string;
  plate: string;
  tariffId: DriverClassId;
};

function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  const length = Array.from(text).length;
  return length >= min && length <= max ? text : null;
}

export type VehicleCheck = { ok: true; value: VehicleInput } | { ok: false; error: string };

/** Проверяет и нормализует данные автомобиля. */
export function validateVehicle(raw: unknown): VehicleCheck {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Укажите данные автомобиля" };
  const v = raw as Record<string, unknown>;
  const brand = cleanText(v.brand, 1, 40);
  if (!brand) return { ok: false, error: "Укажите марку автомобиля" };
  const model = cleanText(v.model, 1, 40);
  if (!model) return { ok: false, error: "Укажите модель автомобиля" };
  const color = cleanText(v.color, 2, 30);
  if (!color) return { ok: false, error: "Укажите цвет автомобиля" };
  const plate = typeof v.plate === "string" ? normalizePlate(v.plate) : "";
  if (!isValidPlate(plate)) return { ok: false, error: "Укажите госномер в формате А123ВС70" };
  const driverClass = DRIVER_CLASSES.find((c) => c.id === v.tariffId);
  if (!driverClass) return { ok: false, error: "Выберите класс автомобиля" };
  return { ok: true, value: { brand, model, color, plate, tariffId: driverClass.id } };
}
