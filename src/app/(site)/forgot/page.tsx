import type { Metadata } from "next";
import { RequestResetForm } from "@/components/ResetForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="rounded-3xl border border-line bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Enter the address on your account and we will send a link to choose a new password.
        </p>
        <div className="mt-6">
          <RequestResetForm />
        </div>
      </div>
    </div>
  );
}
