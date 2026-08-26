import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-32 text-center">
      <p className="font-mono text-sm font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">This endpoint does not exist</h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        The page you were looking for has moved, or never shipped. Try the marketplace instead.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/marketplace"
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Browse APIs
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:bg-elevated"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
