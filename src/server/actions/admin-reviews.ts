"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { refreshApiRating } from "@/server/reviews";
import type { FormState } from "./admin";

const reviewSchema = z.object({
  apiId: z.string().uuid("Choose an API."),
  rating: z.coerce.number().int().min(1).max(5),
  authorName: z.string().trim().min(1, "Give the reviewer a name.").max(80),
  role: z.string().trim().max(80),
  title: z.string().trim().max(120),
  body: z.string().trim().min(10, "The review needs at least 10 characters.").max(2000),
});

/**
 * Create or update a review from the console.
 *
 * Admin-entered reviews carry an author name rather than a user, so a
 * testimonial can be recorded without inventing an account for its author.
 * Saving recomputes the listing's rating from all its rows.
 */
export async function adminSaveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = reviewSchema.safeParse({
    apiId: String(formData.get("apiId") ?? ""),
    rating: formData.get("rating") || 5,
    authorName: String(formData.get("authorName") ?? ""),
    role: String(formData.get("role") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  const r = parsed.data;

  if (id) {
    await sql`
      UPDATE reviews SET
        api_id = ${r.apiId}, rating = ${r.rating}, author_name = ${r.authorName},
        role = ${r.role}, title = ${r.title}, body = ${r.body}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO reviews (api_id, user_id, rating, author_name, role, title, body)
      VALUES (${r.apiId}, NULL, ${r.rating}, ${r.authorName}, ${r.role}, ${r.title}, ${r.body})
    `;
  }

  await refreshApiRating(r.apiId);
  revalidateReview(r.apiId);

  return { ok: id ? "Review updated." : "Review added." };
}

export async function adminDeleteReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await sql<{ api_id: string }[]>`
    DELETE FROM reviews WHERE id = ${id} RETURNING api_id
  `;

  if (row) {
    await refreshApiRating(row.api_id);
    revalidateReview(row.api_id);
  }
}

async function revalidateReview(apiId: string) {
  const [row] = await sql<{ slug: string }[]>`SELECT slug FROM apis WHERE id = ${apiId} LIMIT 1`;
  revalidatePath("/admin/reviews");
  revalidatePath("/marketplace");
  if (row) revalidatePath(`/marketplace/${row.slug}`);
}
