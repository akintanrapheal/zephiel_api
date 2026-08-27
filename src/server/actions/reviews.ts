"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canReview, refreshApiRating } from "@/server/reviews";
import type { FormState } from "./admin";

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120),
  body: z.string().trim().min(10, "Say a little more — at least 10 characters.").max(2000),
  role: z.string().trim().max(80),
});

/**
 * Leave or update a review.
 *
 * Only customers who have subscribed may review, so a rating reflects use
 * rather than opinion from the outside. One row per person per API, updated in
 * place rather than accumulating duplicates.
 */
export async function saveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const apiId = String(formData.get("apiId") ?? "");
  const slug = String(formData.get("apiSlug") ?? "");
  if (!apiId) return { error: "Missing API." };

  if (!(await canReview(user.id, apiId))) {
    return { error: "Only customers who have subscribed to this API can review it." };
  }

  const parsed = reviewSchema.safeParse({
    rating: formData.get("rating") || 5,
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    role: formData.get("role") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await sql`
    INSERT INTO reviews (api_id, user_id, rating, title, body, role)
    VALUES (${apiId}, ${user.id}, ${parsed.data.rating}, ${parsed.data.title},
            ${parsed.data.body}, ${parsed.data.role})
    ON CONFLICT (api_id, user_id) DO UPDATE
      SET rating = EXCLUDED.rating, title = EXCLUDED.title,
          body = EXCLUDED.body, role = EXCLUDED.role, created_at = now()
  `;

  await refreshApiRating(apiId);

  revalidatePath(`/marketplace/${slug}`);
  revalidatePath("/marketplace");
  return { ok: "Thanks — your review is live." };
}

export async function deleteReview(formData: FormData) {
  const user = await requireUser();
  const apiId = String(formData.get("apiId") ?? "");
  const slug = String(formData.get("apiSlug") ?? "");
  if (!apiId) return;

  await sql`DELETE FROM reviews WHERE api_id = ${apiId} AND user_id = ${user.id}`;
  await refreshApiRating(apiId);

  revalidatePath(`/marketplace/${slug}`);
}
