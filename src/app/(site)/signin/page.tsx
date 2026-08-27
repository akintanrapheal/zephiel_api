import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;

  return (
    <>
      {reset && (
        <p className="mx-auto mt-8 max-w-md rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-center text-sm text-accent">
          Password updated — sign in with your new one.
        </p>
      )}
      <AuthForm mode="signin" />
    </>
  );
}
