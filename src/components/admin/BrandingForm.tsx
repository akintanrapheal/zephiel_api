"use client";

import { useActionState, useState } from "react";
import { saveBrandingSettings } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

export default function BrandingForm({
  logoUrl,
  color,
  footer,
  invoiceCurrency,
}: {
  logoUrl: string;
  color: string;
  footer: string;
  invoiceCurrency: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveBrandingSettings, null);
  const [logo, setLogo] = useState(logoUrl);
  const [hex, setHex] = useState(color);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        Applies to every email, receipt, invoice and reminder — change it here once and it updates
        everywhere.
      </p>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-semibold text-ink">
            Logo URL <span className="ml-1 font-normal text-muted">full https:// image link</span>
          </span>
          <input
            name="logoUrl"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://zephiel.com/logo-192.png"
            className={field}
          />
        </label>
        <div className="flex items-end">
          {/* Live preview of the mark customers will see at the top of a message. */}
          <span className="flex h-[42px] items-center justify-center rounded-xl border border-line bg-white px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? (
              <img src={logo} alt="Logo preview" className="h-7 w-auto" />
            ) : (
              <span className="text-xs text-muted">no logo</span>
            )}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Accent colour</span>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              value={/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex) ? hex : "#2445d6"}
              onChange={(e) => setHex(e.target.value)}
              className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-bg"
              aria-label="Accent colour picker"
            />
            <input
              name="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              placeholder="#2445d6"
              className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-ink">Invoice currency</span>
          <select name="invoiceCurrency" defaultValue={invoiceCurrency} className={field}>
            <option value="USD">US Dollars ($) — recommended</option>
            <option value="NGN">Naira (₦)</option>
          </select>
          <span className="mt-1 block text-[11px] text-muted">
            Documents are shown in this currency. Customers are still charged in your Paystack
            currency at the live rate; a note reconciles the two.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-ink">
          Email footer <span className="ml-1 font-normal text-muted">{"{company}"} is filled in</span>
        </span>
        <input
          name="footer"
          defaultValue={footer}
          placeholder="You are receiving this because you have an account on {company}."
          className={field}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Save branding</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
