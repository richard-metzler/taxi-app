import "server-only";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { driverLocations, drivers, serviceZones, tariffZones, tariffs, vehicles } from "@/db/schema";
import { newId } from "./ids";

const DRIVERS_HOME = { latitude: 56.4846, longitude: 84.9476 };

const ZONES: { id: string; name: string; lat: number; lng: number; radiusKm: number; premium: boolean }[] = [
  { id: "tomsk", name: "Томск", lat: 56.4846, lng: 84.9476, radiusKm: 200, premium: true },
];

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;

  const [{ value: tariffCount }] = await db.select({ value: count() }).from(tariffs);
  if (Number(tariffCount) === 0) {
    await db.insert(tariffs).values([
      { id: "econom", version: 1, name: "Эконом", description: "Недорогие поездки по городу", icon: "🚗", sortOrder: 1, isActive: true, baseFare: 8900, perKm: 1400, perMinute: 500, minimumFare: 14900, updatedAt: new Date() },
      { id: "comfort", version: 1, name: "Комфорт", description: "Новые автомобили, больше пространства", icon: "🚙", sortOrder: 2, isActive: true, baseFare: 12900, perKm: 1900, perMinute: 700, minimumFare: 19900, updatedAt: new Date() },
      { id: "business", version: 1, name: "Бизнес", description: "Премиальные автомобили и водители", icon: "🚘", sortOrder: 3, isActive: true, baseFare: 24900, perKm: 3200, perMinute: 1100, minimumFare: 39900, updatedAt: new Date() },
    ]);
  }

  const [{ value: zoneCount }] = await db.select({ value: count() }).from(serviceZones);
  if (Number(zoneCount) === 0) {
    await db.insert(serviceZones).values(
      ZONES.map((z, i) => ({
        id: z.id,
        name: z.name,
        latitude: z.lat,
        longitude: z.lng,
        radiusKm: z.radiusKm,
        isActive: true,
        sortOrder: i + 1,
      })),
    );
    const links = ZONES.flatMap((z) =>
      (z.premium ? ["econom", "comfort", "business"] : ["econom", "comfort"]).map((tariffId) => ({ tariffId, zoneId: z.id })),
    );
    try { await db.insert(tariffZones).values(links); } catch (e) { console.warn("tariffZones already seeded"); }
  }

  const [{ value: driverCount }] = await db.select({ value: count() }).from(drivers);
  if (Number(driverCount) === 0) {
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
        id: driverId,
        name: d.name,
        rating: d.rating,
        isSimulated: true,
        isOnline: false,
        isBusy: false,
        photoUrl: null,
        userId: null,
        createdAt: new Date(),
      });
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
        heading: 0,
        updatedAt: new Date(),
      });
    }
  }
  seeded = true;
}
