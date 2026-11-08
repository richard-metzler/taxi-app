import "server-only";
import * as postgresSchema from "./schema.pg";
import * as ydbSchema from "./schema.ydb";

/**
 * Пока не заданы YDB_CONNECTION_STRING и YANDEX_SA_KEY_JSON, приложение работает
 * с локальным PostgreSQL. Иначе используется схема Yandex YDB.
 */
const active = process.env.YDB_CONNECTION_STRING && process.env.YANDEX_SA_KEY_JSON ? ydbSchema : postgresSchema;

export const USER_ROLES = active.USER_ROLES;
export const ORDER_STATUSES = active.ORDER_STATUSES;
export const PAYMENT_STATUSES = active.PAYMENT_STATUSES;
export const NAVIGATORS = active.NAVIGATORS;
export const users = active.users;
export const authAttempts = active.authAttempts;
export const sessions = active.sessions;
export const tariffs = active.tariffs;
export const serviceZones = active.serviceZones;
export const tariffZones = active.tariffZones;
export const fareEstimates = active.fareEstimates;
export const drivers = active.drivers;
export const vehicles = active.vehicles;
export const driverLocations = active.driverLocations;
export const orders = active.orders;
export const payments = active.payments;
export const orderEvents = active.orderEvents;
export const authDiagnostics = active.authDiagnostics;

export type UserRole = postgresSchema.UserRole;
export type OrderStatus = postgresSchema.OrderStatus;
export type PaymentStatus = postgresSchema.PaymentStatus;
export type NavigatorApp = postgresSchema.NavigatorApp;
export type FareQuote = postgresSchema.FareQuote;
export type OrderSimulation = postgresSchema.OrderSimulation;
export type User = postgresSchema.User;
export type Tariff = postgresSchema.Tariff;
export type ServiceZone = postgresSchema.ServiceZone;
export type Order = postgresSchema.Order;
export type Driver = postgresSchema.Driver;
export type Vehicle = postgresSchema.Vehicle;
export type DriverLocation = postgresSchema.DriverLocation;
export type Payment = postgresSchema.Payment;
export type FareEstimate = postgresSchema.FareEstimate;
