import {
  double,
  integer,
  json,
  primaryKey,
  text,
  ydbTable,
} from "@ydbjs/drizzle-adapter/schema";

export const USER_ROLES = ["passenger", "driver", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = [
  "draft",
  "searching",
  "driver_assigned",
  "driver_arriving",
  "driver_waiting",
  "in_progress",
  "completed",
  "payment_pending",
  "paid",
  "cancelled",
  "payment_failed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "waiting_for_capture", "succeeded", "canceled", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const NAVIGATORS = ["yandex", "dgis", "google"] as const;
export type NavigatorApp = (typeof NAVIGATORS)[number];

// Адаптер не выводит Utf8 как string, поэтому оборачиваем через .$type<...>()
const str = (name: string) => text(name).$type<string>();
const num = (name: string) => integer(name).$type<number>();
const dbl = (name: string) => double(name).$type<number>();
// Даты и булевы храним как строки (адаптер пока не умеет Timestamp/Bool)
const ts = (name: string) => text(name).$type<string>();
const boolStr = (name: string) => text(name).$type<"true" | "false">();

export type FareQuote = {
  tariffId: string;
  tariffVersion: number;
  price: number;
  pickupEtaSeconds: number;
};

export type OrderSimulation = {
  driverStartLat: number;
  driverStartLng: number;
  approachSeconds: number;
  rideSeconds: number;
};

export const users = ydbTable("users", {
  id: str("id").primaryKey(),
  phone: str("phone").notNull(),
  name: str("name").notNull().default(""),
  passwordHash: str("password_hash"),
  role: str("role").$type<UserRole>().notNull().default("passenger"),
  navigator: str("navigator").$type<NavigatorApp>().notNull().default("yandex"),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const authAttempts = ydbTable("auth_attempts", {
  key: str("key").primaryKey(),
  attempts: num("attempts").notNull().default(0),
  windowStartedAt: ts("window_started_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sessions = ydbTable("sessions", {
  id: str("id").primaryKey(),
  userId: str("user_id").notNull(),
  tokenHash: str("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const tariffs = ydbTable("tariffs", {
  id: str("id").primaryKey(),
  version: num("version").notNull().default(1),
  name: str("name").notNull(),
  description: str("description").notNull(),
  icon: str("icon").notNull(),
  sortOrder: num("sort_order").notNull().default(0),
  isActive: boolStr("is_active").notNull().default("true"),
  baseFare: num("base_fare").notNull(),
  perKm: num("per_km").notNull(),
  perMinute: num("per_minute").notNull(),
  minimumFare: num("minimum_fare").notNull(),
  updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const serviceZones = ydbTable("service_zones", {
  id: str("id").primaryKey(),
  name: str("name").notNull(),
  latitude: dbl("latitude").notNull(),
  longitude: dbl("longitude").notNull(),
  radiusKm: dbl("radius_km").notNull(),
  isActive: boolStr("is_active").notNull().default("true"),
  sortOrder: num("sort_order").notNull().default(0),
});

export const tariffZones = ydbTable(
  "tariff_zones",
  {
    tariffId: str("tariff_id").notNull(),
    zoneId: str("zone_id").notNull(),
  },
  (t) => [primaryKey(t.tariffId, t.zoneId)],
);

export const fareEstimates = ydbTable("fare_estimates", {
  id: str("id").primaryKey(),
  userId: str("user_id").notNull(),
  pickupAddress: str("pickup_address").notNull(),
  pickupLat: dbl("pickup_lat").notNull(),
  pickupLng: dbl("pickup_lng").notNull(),
  destinationAddress: str("destination_address").notNull(),
  destinationLat: dbl("destination_lat").notNull(),
  destinationLng: dbl("destination_lng").notNull(),
  distanceMeters: num("distance_meters").notNull(),
  durationSeconds: num("duration_seconds").notNull(),
  routeGeometry: text("route_geometry").$type<string>().notNull(),
  quotes: text("quotes").$type<string>().notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const drivers = ydbTable("drivers", {
  id: str("id").primaryKey(),
  name: str("name").notNull(),
  photoUrl: str("photo_url"),
  userId: str("user_id"),
  isOnline: boolStr("is_online").notNull().default("false"),
  rating: dbl("rating").notNull().default(5),
  isSimulated: boolStr("is_simulated").notNull().default("false"),
  isBusy: boolStr("is_busy").notNull().default("false"),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const vehicles = ydbTable("vehicles", {
  id: str("id").primaryKey(),
  driverId: str("driver_id").notNull(),
  brand: str("brand").notNull(),
  model: str("model").notNull(),
  color: str("color").notNull(),
  plate: str("plate").notNull(),
  tariffId: str("tariff_id").notNull(),
});

export const driverLocations = ydbTable("driver_locations", {
  driverId: str("driver_id").primaryKey(),
  latitude: dbl("latitude").notNull(),
  longitude: dbl("longitude").notNull(),
  heading: dbl("heading").notNull().default(0),
  updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const orders = ydbTable("orders", {
  id: str("id").primaryKey(),
  passengerId: str("passenger_id").notNull(),
  driverId: str("driver_id"),
  vehicleId: str("vehicle_id"),
  status: str("status").$type<OrderStatus>().notNull().default("searching"),
  pickupAddress: str("pickup_address").notNull(),
  pickupLat: dbl("pickup_lat").notNull(),
  pickupLng: dbl("pickup_lng").notNull(),
  destinationAddress: str("destination_address").notNull(),
  destinationLat: dbl("destination_lat").notNull(),
  destinationLng: dbl("destination_lng").notNull(),
  tariffId: str("tariff_id").notNull(),
  tariffVersion: num("tariff_version").notNull(),
  estimateId: str("estimate_id"),
  estimatedPrice: num("estimated_price").notNull(),
  finalPrice: num("final_price"),
  currency: str("currency").notNull().default("RUB"),
  distanceMeters: num("distance_meters").notNull(),
  durationSeconds: num("duration_seconds").notNull(),
  routeGeometry: text("route_geometry").$type<string>().notNull(),
  simulation: text("simulation").$type<string | null>(),
  cancelReason: str("cancel_reason"),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  assignedAt: ts("assigned_at"),
  arrivedAt: ts("arrived_at"),
  startedAt: ts("started_at"),
  completedAt: ts("completed_at"),
  paidAt: ts("paid_at"),
  cancelledAt: ts("cancelled_at"),
  updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const payments = ydbTable("payments", {
  id: str("id").primaryKey(),
  orderId: str("order_id").notNull(),
  userId: str("user_id").notNull(),
  provider: str("provider").notNull().default("yookassa"),
  providerPaymentId: str("provider_payment_id"),
  idempotenceKey: str("idempotence_key").notNull(),
  amount: num("amount").notNull(),
  currency: str("currency").notNull().default("RUB"),
  status: str("status").$type<PaymentStatus>().notNull().default("pending"),
  paymentMethod: str("payment_method"),
  confirmationUrl: str("confirmation_url"),
  failureReason: str("failure_reason"),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const orderEvents = ydbTable("order_events", {
  id: str("id").primaryKey(),
  orderId: str("order_id").notNull(),
  passengerId: str("passenger_id").notNull(),
  type: str("type").notNull(),
  title: str("title").notNull(),
  body: str("body").notNull(),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const authDiagnostics = ydbTable("auth_diagnostics", {
  id: str("id").primaryKey(),
  event: str("event").notNull(),
  userId: str("user_id"),
  authorization: str("authorization_header").notNull(),
  sessionHeader: boolStr("session_header").notNull().default("false"),
  cookie: boolStr("cookie").notNull().default("false"),
  clientHeader: boolStr("client_header").notNull().default("false"),
  bodySession: boolStr("body_session").notNull().default("false"),
  viaRpc: boolStr("via_rpc").notNull().default("false"),
  headerNames: str("header_names"),
  forwardedHost: str("forwarded_host"),
  forwardedProto: str("forwarded_proto"),
  secFetchSite: str("sec_fetch_site"),
  origin: str("origin"),
  userAgent: str("user_agent"),
  createdAt: ts("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type User = typeof users.$inferSelect;
export type Tariff = typeof tariffs.$inferSelect;
export type ServiceZone = typeof serviceZones.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type FareEstimate = typeof fareEstimates.$inferSelect;
