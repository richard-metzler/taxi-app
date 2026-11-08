import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Контекст запроса, пришедшего через POST /api/rpc.
 * Токен сессии передаётся в теле запроса: прокси окна превью удаляет заголовки
 * (Authorization, X-*, Origin, Sec-Fetch-*) и cookie, но тело запроса пересылает без изменений.
 */
export type RpcContext = {
  /** Токен сессии из тела запроса (только корректного формата) или null. */
  token: string | null;
};

const STORAGE_KEY = Symbol.for("taxi-passenger.rpc-context");
type GlobalWithRpc = typeof globalThis & { [STORAGE_KEY]?: AsyncLocalStorage<RpcContext> };

/** Единственный экземпляр хранилища на процесс, даже если модуль попал в несколько бандлов. */
function storage(): AsyncLocalStorage<RpcContext> {
  const g = globalThis as GlobalWithRpc;
  if (!g[STORAGE_KEY]) g[STORAGE_KEY] = new AsyncLocalStorage<RpcContext>();
  return g[STORAGE_KEY];
}

/** Выполнить обработчик в контексте RPC-запроса. */
export function runWithRpcContext<T>(ctx: RpcContext, fn: () => Promise<T>): Promise<T> {
  return storage().run(ctx, fn);
}

/** Контекст текущего RPC-запроса или undefined для прямых REST-запросов. */
export function getRpcContext(): RpcContext | undefined {
  return storage().getStore();
}
