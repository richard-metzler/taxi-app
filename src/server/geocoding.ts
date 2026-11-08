import "server-only";
import { AppError } from "@/core/errors";
import type { LatLng } from "@/core/geo";

export type AddressSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  address: string;
  latitude: number;
  longitude: number;
};

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "TaxiPassengerMVP/1.0 (support@taxi-passenger.local)";

type NominatimItem = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: Record<string, string>;
};

function buildShortAddress(item: NominatimItem): { title: string; subtitle: string; address: string } {
  const a = item.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.footway ?? a.residential ?? "";
  const house = a.house_number ?? "";
  const place = a.city ?? a.town ?? a.village ?? a.municipality ?? a.state ?? "";
  const poi = item.name && item.name !== street ? item.name : "";
  const streetLine = [street, house].filter(Boolean).join(", ");
  const title = poi || streetLine || item.display_name.split(",")[0];
  const subtitle = [poi ? streetLine : "", place].filter(Boolean).join(", ");
  const address = [title, subtitle].filter(Boolean).join(", ");
  return { title, subtitle, address };
}

/** Подсказки адресов по строке запроса. Приоритет — рядом с указанной точкой. */
export async function searchAddresses(query: string, near?: LatLng | null): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("countrycodes", "ru");
  if (near) {
    const d = 0.5;
    url.searchParams.set(
      "viewbox",
      `${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`,
    );
  }
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, next: { revalidate: 0 } });
  if (!res.ok) throw new AppError("geocoding_failed", "Сервис адресов временно недоступен", 502);
  const data = (await res.json()) as NominatimItem[];
  return data.map((item) => {
    const s = buildShortAddress(item);
    return {
      id: String(item.place_id),
      ...s,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    };
  });
}

/** Адрес по координатам (для перемещения маркера на карте). */
export async function reverseGeocode(point: LatLng): Promise<AddressSuggestion | null> {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("zoom", "18");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, next: { revalidate: 0 } });
  if (!res.ok) throw new AppError("geocoding_failed", "Сервис адресов временно недоступен", 502);
  const item = (await res.json()) as NominatimItem & { error?: string };
  if (item.error || !item.lat) return null;
  const s = buildShortAddress(item);
  return { id: String(item.place_id), ...s, latitude: point.latitude, longitude: point.longitude };
}
