"use client";

import { useActionState, useState } from "react";
import { adminSaveReview } from "@/server/actions/admin-reviews";
import type { FormState } from "@/server/actions/admin";
import { Field, Message, Select, Submit, TextArea } from "./Form";
import { cn } from "@/lib/utils";

type Existing = {
  id: string;
  apiId: string;
  rating: number;
  authorName: string;
  role: string;
  title: string;
  body: string;
};

export default function AdminReviewForm({
  apis,
  review,
  defaultApiId,
}: {
  apis: { id: string; name: string }[];
  review?: Existing;
  defaultApiId?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(adminSaveReview, null);
  const [rating, setRating] = useState(review?.rating ?? 5);

  return (
    <form action={action} className="space-y-4">
      {review?.id && <input type="hidden" name="id" value={review.id} />}
      <input type="hidden" name="rating" value={rating} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="API" name="apiId" defaultValue={review?.apiId ?? defaultApiId ?? apis[0]?.id}>
          {apis.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        <div>
          <span className="block text-xs font-semibold text-ink">Rating</span>
          <div
            className="mt-1.5 flex items-center gap-0.5"
            role="radiogroup"
            aria-label="Rating out of 5"
          >
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
        </div>

        <Field
          label="Reviewer name"
          name="authorName"
          defaultValue={review?.authorName}
          required
          placeholder="Amara Okonkwo"
        />
        <Field
          label="Role"
          hint="optional"
          name="role"
          defaultValue={review?.role}
          placeholder="Engineering Lead"
        />
      </div>

      <Field
        label="Headline"
        hint="optional"
        name="title"
        defaultValue={review?.title}
        placeholder="Quick to integrate"
      />
      <TextArea label="Review" name="body" rows={5} defaultValue={review?.body} />

      <div className="flex flex-wrap items-center gap-3">
        <Submit>{review?.id ? "Save review" : "Add review"}</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
