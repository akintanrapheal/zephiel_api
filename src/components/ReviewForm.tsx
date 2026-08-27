"use client";

import { useActionState, useState } from "react";
import { saveReview, deleteReview } from "@/server/actions/reviews";
import type { FormState } from "@/server/actions/admin";
import { cn } from "@/lib/utils";

export default function ReviewForm({
  apiId,
  apiSlug,
  existing,
}: {
  apiId: string;
  apiSlug: string;
  existing: { rating: number; title: string; body: string; role: string } | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveReview, null);
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [open, setOpen] = useState(!existing);

  if (!open) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">
          You reviewed this API — {existing?.rating} out of 5.
        </p>
        <div className="mt-3 flex gap-3">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-elevated"
          >
            Edit review
          </button>
          <form action={deleteReview}>
            <input type="hidden" name="apiId" value={apiId} />
            <input type="hidden" name="apiSlug" value={apiSlug} />
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/5">
              Remove
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-5">
      <input type="hidden" name="apiId" value={apiId} />
      <input type="hidden" name="apiSlug" value={apiSlug} />
      <input type="hidden" name="rating" value={rating} />

      <h3 className="text-sm font-semibold tracking-tight text-ink">
        {existing ? "Update your review" : "Write a review"}
      </h3>

      <div className="mt-3" role="radiogroup" aria-label="Rating out of 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            className="p-0.5"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
              className={cn("h-6 w-6 transition", n <= rating ? "text-amber-500" : "text-line")}
            >
              <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z" />
            </svg>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Headline</span>
          <input
            name="title"
            maxLength={120}
            defaultValue={existing?.title}
            placeholder="Quick to integrate"
            className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">
            Your role <span className="font-normal text-muted">optional</span>
          </span>
          <input
            name="role"
            maxLength={80}
            defaultValue={existing?.role}
            placeholder="Backend Developer"
            className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-semibold text-ink">Your review</span>
        <textarea
          name="body"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          defaultValue={existing?.body}
          placeholder="What did you build with it, and how did it hold up?"
          className="mt-1.5 w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
        />
      </label>

      {state?.error && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-600">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-accent">
          {state.ok}
        </p>
      )}

      <button className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
        {existing ? "Update review" : "Publish review"}
      </button>
    </form>
  );
}
