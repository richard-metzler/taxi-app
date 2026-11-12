import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["passenger", "driver", "admin"]);
export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "searching",
  "driver_assigned",
  "driver_arriving",
  "driver_waiting",
  "in_progress",
  "completed",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "waiting_for_capture",
  "succeeded",
  "canceled",
  "failed",
]);
export const navigatorEnum = pgEnum("navigator_app", ["yandex", "dgis", "google"]);

export const USER_ROLES = userRoleEnum.enumValues;
export const ORDER_STATUSES = orderStatusEnum.enumValues;
export const PAYMENT_STATUSES = paymentStatusEnum.enumValues;
export const NAVIGATORS = navigatorEnum.enumValues;

export const declinedOrders = pgTable("declined_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRole = (typeof USER_ROLES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type NavigatorApp = (typeof NAVIGATORS)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role"),
  navigator: navigatorEnum("navigator").notNull().default("yandex"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.role] })]);

export const authAttempts = pgTable("auth_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tariffs = pgTable("tariffs", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(1),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  baseFare: integer("base_fare").notNull(),
  perKm: integer("per_km").notNull(),
  perMinute: integer("per_minute").notNull(),
  minimumFare: integer("minimum_fare").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceZones = pgTable("service_zones", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusKm: doublePrecision("radius_km").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tariffZones = pgTable(
  "tariff_zones",
  {
    tariffId: text("tariff_id").notNull().references(() => tariffs.id, { onDelete: "cascade" }),
    zoneId: text("zone_id").notNull().references(() => serviceZones.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tariffId, t.zoneId] })],
);

export type FareQuote = {
  tariffId: string;
  tariffVersion: number;
  price: number;
  pickupEtaSeconds: number;
};

export const fareEstimates = pgTable("fare_estimates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pickupAddress: text("pickup_address").notNull(),
  pickupLat: doublePrecision("pickup_lat").notNull(),
  pickupLng: doublePrecision("pickup_lng").notNull(),
  destinationAddress: text("destination_address").notNull(),
  destinationLat: doublePrecision("destination_lat").notNull(),
  destinationLng: doublePrecision("destination_lng").notNull(),
  distanceMeters: integer("distance_meters").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  routeGeometry: jsonb("route_geometry").$type<[number, number][]>().notNull(),
  quotes: jsonb("quotes").$type<FareQuote[]>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  photoUrl: text("photo_url"),
  userId: uuid("user_id").unique().references(() => users.id, { onDelete: "cascade" }),
  isOnline: boolean("is_online").notNull().default(false),
  rating: doublePrecision("rating").notNull().default(5),
  isSimulated: boolean("is_simulated").notNull().default(false),
  isBusy: boolean("is_busy").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  color: text("color").notNull(),
  plate: text("plate").notNull(),
  tariffId: text("tariff_id").notNull().references(() => tariffs.id),
});

export const driverLocations = pgTable("driver_locations", {
  driverId: uuid("driver_id").primaryKey().references(() => drivers.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  heading: doublePrecision("heading").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrderSimulation = {
  driverStartLat: number;
  driverStartLng: number;
  approachSeconds: number;
  rideSeconds: number;
  approachRoute?: [number, number][];
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    passengerId: uuid("passenger_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id").references(() => drivers.id),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),
    status: orderStatusEnum("status").notNull().default("searching"),
    pickupAddress: text("pickup_address").notNull(),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    destinationAddress: text("destination_address").notNull(),
    destinationLat: doublePrecision("destination_lat").notNull(),
    destinationLng: doublePrecision("destination_lng").notNull(),
    tariffId: text("tariff_id").notNull().references(() => tariffs.id),
    tariffVersion: integer("tariff_version").notNull(),
    estimateId: uuid("estimate_id").references(() => fareEstimates.id),
    estimatedPrice: integer("estimated_price").notNull(),
    finalPrice: integer("final_price"),
    currency: text("currency").notNull().default("RUB"),
    distanceMeters: integer("distance_meters").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    routeGeometry: jsonb("route_geometry").$type<[number, number][]>().notNull(),
    simulation: jsonb("simulation").$type<OrderSimulation | null>(),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_passenger_idx").on(t.passengerId, t.createdAt)],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull().default("yookassa"),
  providerPaymentId: text("provider_payment_id").unique(),
  idempotenceKey: text("idempotence_key").notNull().unique(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("RUB"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  confirmationUrl: text("confirmation_url"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    passengerId: uuid("passenger_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_passenger_idx").on(t.passengerId, t.createdAt)],
);

export const authDiagnostics = pgTable(
  "auth_diagnostics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event: text("event").notNull(),
    userId: uuid("user_id"),
    authorization: text("authorization_header").notNull(),
    sessionHeader: boolean("session_header").notNull(),
    cookie: boolean("cookie").notNull(),
    clientHeader: boolean("client_header").notNull(),
    bodySession: boolean("body_session").notNull().default(false),
    viaRpc: boolean("via_rpc").notNull().default(false),
    headerNames: text("header_names"),
    forwardedHost: text("forwarded_host"),
    forwardedProto: text("forwarded_proto"),
    secFetchSite: text("sec_fetch_site"),
    origin: text("origin"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_diagnostics_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Tariff = typeof tariffs.$inferSelect;
export type ServiceZone = typeof serviceZones.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type FareEstimate = typeof fareEstimates.$inferSelect;
