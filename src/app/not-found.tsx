import Link from "next/link";

/** Страница не найдена. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="neo flex h-16 w-16 items-center justify-center rounded-2xl text-3xl">🧭</div>
      <h1 className="text-xl font-bold">Страница не найдена</h1>
      <p className="text-muted">Проверьте адрес или вернитесь на главный экран.</p>
      <Link href="/home" className="neo-btn-primary px-6 py-3 font-semibold">
        На главный экран
      </Link>
    </main>
  );
}
