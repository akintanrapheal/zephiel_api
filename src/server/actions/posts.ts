"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "./admin";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const postSchema = z.object({
  slug: z.string().trim().regex(slugRe, "Slug must be lowercase words separated by hyphens."),
  title: z.string().trim().min(1, "A title is required.").max(160),
  excerpt: z.string().trim().max(400),
  body: z.string().trim().max(40_000),
  tag: z.string().trim().max(40),
  readMinutes: z.coerce.number().int().min(1).max(120),
});

export async function savePost(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = postSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    excerpt: String(formData.get("excerpt") ?? ""),
    body: String(formData.get("body") ?? ""),
    tag: String(formData.get("tag") ?? "Engineering"),
    readMinutes: formData.get("readMinutes") || 5,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  const published = formData.get("published") === "on";
  const p = parsed.data;

  try {
    if (id) {
      await sql`
        UPDATE posts SET slug = ${p.slug}, title = ${p.title}, excerpt = ${p.excerpt},
          body = ${p.body}, tag = ${p.tag}, read_minutes = ${p.readMinutes},
          published = ${published}, updated_at = now()
        WHERE id = ${id}
      `;
    } else {
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO posts (slug, title, excerpt, body, tag, read_minutes, published)
        VALUES (${p.slug}, ${p.title}, ${p.excerpt}, ${p.body}, ${p.tag}, ${p.readMinutes}, ${published})
        RETURNING id
      `;
      revalidatePost(p.slug);
      redirect(`/admin/posts/${row.id}?created=1`);
    }
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return { error: "A post with that slug already exists." };
    }
    throw err;
  }

  revalidatePost(p.slug);
  return { ok: "Saved." };
}

export async function deletePost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await sql`DELETE FROM posts WHERE id = ${id}`;
  revalidatePost();
  redirect("/admin/posts");
}

function revalidatePost(slug?: string) {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin/posts");
  if (slug) revalidatePath(`/blog/${slug}`);
}
