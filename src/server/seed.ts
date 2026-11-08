import "server-only";
import { db } from "@/db";
import { driverLocations, drivers, serviceZones, tariffZones, tariffs, vehicles } from "@/db/schema";
import { newId } from "./ids";

/** Город по умолчанию для стартовых позиций демо-водителей (их подача строится от точки заказа). */
const DRIVERS_HOME = { latitude: 56.4846, longitude: 84.9476 };

/**
 * Зоны обслуживания: крупные города России. Радиус покрывает город и ближайшие пригороды.
 * premium — в городе доступен тариф «Бизнес».
 * Список настраивается в таблицах service_zones и tariff_zones без изменения кода.
 */
const ZONES: { id: string; name: string; lat: number; lng: number; radiusKm: number; premium: boolean }[] = [
  { id: "moscow", name: "Москва", lat: 55.7558, lng: 37.6173, radiusKm: 60, premium: true },
  { id: "spb", name: "Санкт-Петербург", lat: 59.9343, lng: 30.3351, radiusKm: 50, premium: true },
  { id: "novosibirsk", name: "Новосибирск", lat: 55.0084, lng: 82.9357, radiusKm: 45, premium: true },
  { id: "ekaterinburg", name: "Екатеринбург", lat: 56.8389, lng: 60.6057, radiusKm: 40, premium: true },
  { id: "kazan", name: "Казань", lat: 55.7961, lng: 49.1064, radiusKm: 40, premium: true },
  { id: "krasnoyarsk", name: "Красноярск", lat: 56.0153, lng: 92.8932, radiusKm: 40, premium: true },
  { id: "nnovgorod", name: "Нижний Новгород", lat: 56.2965, lng: 43.9361, radiusKm: 40, premium: true },
  { id: "chelyabinsk", name: "Челябинск", lat: 55.1644, lng: 61.4368, radiusKm: 40, premium: true },
  { id: "ufa", name: "Уфа", lat: 54.7388, lng: 55.9721, radiusKm: 40, premium: true },
  { id: "samara", name: "Самара", lat: 53.1959, lng: 50.1002, radiusKm: 40, premium: true },
  { id: "rostov", name: "Ростов-на-Дону", lat: 47.2357, lng: 39.7015, radiusKm: 40, premium: true },
  { id: "krasnodar", name: "Краснодар", lat: 45.0355, lng: 38.9753, radiusKm: 40, premium: true },
  { id: "omsk", name: "Омск", lat: 54.9885, lng: 73.3242, radiusKm: 40, premium: true },
  { id: "voronezh", name: "Воронеж", lat: 51.6608, lng: 39.2003, radiusKm: 40, premium: true },
  { id: "perm", name: "Пермь", lat: 58.0105, lng: 56.2502, radiusKm: 40, premium: true },
  { id: "volgograd", name: "Волгоград", lat: 48.708, lng: 44.5133, radiusKm: 45, premium: true },
  { id: "tomsk", name: "Томск", lat: 56.4846, lng: 84.9476, radiusKm: 60, premium: true },
  { id: "saratov", name: "Саратов", lat: 51.5331, lng: 46.0342, radiusKm: 35, premium: false },
  { id: "tyumen", name: "Тюмень", lat: 57.1522, lng: 65.5272, radiusKm: 35, premium: false },
  { id: "tolyatti", name: "Тольятти", lat: 53.5303, lng: 49.3461, radiusKm: 30, premium: false },
  { id: "barnaul", name: "Барнаул", lat: 53.3548, lng: 83.7698, radiusKm: 35, premium: false },
  { id: "irkutsk", name: "Иркутск", lat: 52.287, lng: 104.305, radiusKm: 35, premium: false },
  { id: "izhevsk", name: "Ижевск", lat: 56.8526, lng: 53.2045, radiusKm: 30, premium: false },
  { id: "khabarovsk", name: "Хабаровск", lat: 48.4827, lng: 135.0838, radiusKm: 35, premium: false },
  { id: "vladivostok", name: "Владивосток", lat: 43.1155, lng: 131.8855, radiusKm: 35, premium: false },
  { id: "yaroslavl", name: "Ярославль", lat: 57.6261, lng: 39.8845, radiusKm: 30, premium: false },
  { id: "makhachkala", name: "Махачкала", lat: 42.9849, lng: 47.5047, radiusKm: 30, premium: false },
  { id: "orenburg", name: "Оренбург", lat: 51.7682, lng: 55.097, radiusKm: 30, premium: false },
  { id: "kemerovo", name: "Кемерово", lat: 55.3547, lng: 86.0873, radiusKm: 30, premium: false },
  { id: "novokuznetsk", name: "Новокузнецк", lat: 53.7596, lng: 87.1216, radiusKm: 30, premium: false },
  { id: "ryazan", name: "Рязань", lat: 54.6292, lng: 39.7364, radiusKm: 30, premium: false },
  { id: "chelny", name: "Набережные Челны", lat: 55.7436, lng: 52.3958, radiusKm: 30, premium: false },
  { id: "penza", name: "Пенза", lat: 53.1959, lng: 45.0183, radiusKm: 30, premium: false },
  { id: "kaliningrad", name: "Калининград", lat: 54.7104, lng: 20.4522, radiusKm: 30, premium: false },
  { id: "sochi", name: "Сочи", lat: 43.6028, lng: 39.7342, radiusKm: 40, premium: false },
];

let seeded = false;

/**
 * Начальное наполнение: тарифы, зоны обслуживания и имитируемые водители демо-диспетчера.
 * Каждая часть заполняется, только если её таблица пуста, — выполненные вручную настройки не перезаписываются.
 */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;

  const existingTariffs = await db.select({ id: tariffs.id }).from(tariffs).limit(1);
  if (existingTariffs.length === 0) {
    await db.insert(tariffs).values([
      {
        id: "econom",
        version: 1,
        name: "Эконом",
        description: "Недорогие поездки по городу",
        icon: "🚗",
        sortOrder: 1,
        baseFare: 8900,
        perKm: 1400,
        perMinute: 500,
        minimumFare: 14900,
      },
      {
        id: "comfort",
        version: 1,
        name: "Комфорт",
        description: "Новые автомобили, больше пространства",
        icon: "🚙",
        sortOrder: 2,
        baseFare: 12900,
        perKm: 1900,
        perMinute: 700,
        minimumFare: 19900,
      },
      {
        id: "business",
        version: 1,
        name: "Бизнес",
        description: "Премиальные автомобили и водители",
        icon: "🚘",
        sortOrder: 3,
        baseFare: 24900,
        perKm: 3200,
        perMinute: 1100,
        minimumFare: 39900,
      },
    ]);
  }

  const existingZones = await db.select({ id: serviceZones.id }).from(serviceZones).limit(1);
  if (existingZones.length === 0) {
    await db
      .insert(serviceZones)
      .values(
        ZONES.map((z, i) => ({
          id: z.id,
          name: z.name,
          latitude: z.lat,
          longitude: z.lng,
          radiusKm: z.radiusKm,
          sortOrder: i + 1,
        })),
      )
    const links = ZONES.flatMap((z) =>
      (z.premium ? ["econom", "comfort", "business"] : ["econom", "comfort"]).map((tariffId) => ({ tariffId, zoneId: z.id })),
    );
    await db.insert(tariffZones).values(links);
  }

  const existingDrivers = await db.select({ id: drivers.id }).from(drivers).limit(1);
  if (existingDrivers.length === 0) {
    const demoDrivers = [
      { name: "Алексей Смирнов", rating: 4.9, brand: "Lada", model: "Vesta", color: "Белый", plate: "А123ВС70", tariffId: "econom" },
      { name: "Дмитрий Козлов", rating: 4.8, brand: "Kia", model: "Rio", color: "Серый", plate: "Е456КХ70", tariffId: "econom" },
      { name: "Сергей Иванов", rating: 4.9, brand: "Skoda", model: "Octavia", color: "Чёрный", plate: "М789ОР70", tariffId: "comfort" },
      { name: "Андрей Петров", rating: 5.0, brand: "Toyota", model: "Camry", color: "Серебристый", plate: "Т321УН70", tariffId: "comfort" },
      { name: "Игорь Волков", rating: 5.0, brand: "Mercedes-Benz", model: "E-класс", color: "Чёрный", plate: "В001ОС70", tariffId: "business" },
    ];
    for (const d of demoDrivers) {
      const driverId = newId();
      await db.insert(drivers).values({
      id, driverId, name: d.name, rating: d.rating, isSimulated: true, photoUrl: null });
      await db.insert(vehicles).values({
      id: newId(),
      driverId,
        brand: d.brand,
        model: d.model,
        color: d.color,
        plate: d.plate,
        tariffId: d.tariffId,
      });
      await db.insert(driverLocations).values({
        driverId,
        latitude: DRIVERS_HOME.latitude + (Math.random() - 0.5) * 0.02,
        longitude: DRIVERS_HOME.longitude + (Math.random() - 0.5) * 0.04,
      });
    }
  }
  seeded = true;
}
