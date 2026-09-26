"use client";

import { useActionState, useState } from "react";
import { saveEmailTemplates } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Message, Submit } from "./Form";

type Template = { subject: string; heading: string; intro: string; note: string };
type Kind = "renewal" | "sandbox" | "paused" | "cancelled" | "receipt" | "invoice" | "test";

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

// The invoice email is a rendered document — only its subject line is copy.
// (The receipt now also has an email body, so it shows the full fields.)
const SUBJECT_ONLY: Kind[] = ["invoice"];

export default function EmailTemplatesForm({
  labels,
  placeholders,
  templates,
}: {
  labels: Record<Kind, string>;
  placeholders: Record<Kind, string[]>;
  templates: Record<Kind, Template>;
}) {
  const kinds = Object.keys(templates) as Kind[];
  const [state, action] = useActionState<FormState, FormData>(saveEmailTemplates, null);
  const [open, setOpen] = useState<Kind>(kinds[0]);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        Edit the wording of each message. Leave a field on its default to keep receiving future
        improvements to that default. Placeholders in {"{braces}"} are filled in when the message is
        sent.
      </p>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setOpen(k)}
            aria-pressed={open === k}
            className={
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition " +
              (open === k
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line text-muted hover:border-brand-300 hover:text-brand-600")
            }
          >
            {labels[k]}
          </button>
        ))}
      </div>

      {/* Every kind's inputs stay mounted (hidden when not open) so all values post together. */}
      {kinds.map((k) => {
        const t = templates[k];
        const subjectOnly = SUBJECT_ONLY.includes(k);
        return (
          <div key={k} className={open === k ? "space-y-4" : "hidden"}>
            <label className="block">
              <span className="text-xs font-semibold text-ink">Subject</span>
              <input name={`${k}.subject`} defaultValue={t.subject} className={field} />
            </label>

            {!subjectOnly && (
              <>
                <label className="block">
                  <span className="text-xs font-semibold text-ink">Heading</span>
                  <input name={`${k}.heading`} defaultValue={t.heading} className={field} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink">Intro paragraph</span>
                  <textarea name={`${k}.intro`} defaultValue={t.intro} rows={3} className={field} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink">Note under the details</span>
                  <textarea name={`${k}.note`} defaultValue={t.note} rows={2} className={field} />
                </label>
              </>
            )}

            {/* Hidden fields keep document kinds' unused parts at their defaults on post. */}
            {subjectOnly && (
              <>
                <input type="hidden" name={`${k}.heading`} value={t.heading} />
                <input type="hidden" name={`${k}.intro`} value={t.intro} />
                <input type="hidden" name={`${k}.note`} value={t.note} />
                <p className="text-[11px] text-muted">
                  The {labels[k].toLowerCase()} body is a rendered document (logo, line items,
                  totals) — only its subject line is editable here.
                </p>
              </>
            )}

            <p className="text-[11px] text-muted">
              Placeholders:{" "}
              {placeholders[k].map((p) => (
                <code
                  key={p}
                  className="mr-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink"
                >
                  {p}
                </code>
              ))}
            </p>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Submit>Save templates</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
