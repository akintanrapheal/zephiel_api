import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Administrator sign in",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, { error }] = await Promise.all([getCurrentUser(), searchParams]);

  // Already an admin — no reason to show the form again.
  if (user?.role === "admin") redirect("/admin");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-16">
      <div className="absolute inset-0 grid-bg" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-[420px] glow" aria-hidden />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-6 w-6">
              <path d="M13 3L5 14h6l-2 7 8-11h-6l2-7z" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">Administrator sign in</h1>
          <p className="mt-1.5 text-sm text-muted">Zephiel API console</p>
        </div>

        <div className="mt-7 rounded-2xl border border-line bg-surface p-7 shadow-lift">
          <AdminLoginForm
            notice={
              error === "forbidden"
                ? "That account doesn't have administrator access."
                : error === "session"
                  ? "Your session expired. Sign in again to continue."
                  : null
            }
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Not an administrator?{" "}
          <Link href="/signin" className="font-medium text-brand-600 hover:underline">
            Customer sign in
          </Link>
          <span className="mx-2 text-line">|</span>
          <Link href="/" className="font-medium text-brand-600 hover:underline">
            Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
