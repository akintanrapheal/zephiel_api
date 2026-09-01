"use client";

import { useActionState } from "react";
import { saveCompanyDetails } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

export default function CompanyForm({
  name,
  address,
  taxId,
}: {
  name: string;
  address: string;
  taxId: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCompanyDetails, null);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        Printed on every invoice and receipt. Leave a field blank and it is omitted rather than
        filled with a placeholder.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Registered name</span>
          <input name="companyName" defaultValue={name} maxLength={120} className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Tax ID <span className="font-normal text-muted">optional</span></span>
          <input name="companyTaxId" defaultValue={taxId} maxLength={60} className={field} />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-ink">Registered address</span>
        <textarea name="companyAddress" defaultValue={address} rows={4} maxLength={400} className={field} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Save invoice details</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
