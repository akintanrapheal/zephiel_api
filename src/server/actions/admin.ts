"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | null;

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A field absent from the payload arrives as null, which zod's string schemas
 * reject with a confusing message. Normalise to undefined so `.optional()` and
 * `??` defaults behave as intended.
 */
const str = (v: FormDataEntryValue | null) => (v == null ? undefined : String(v));

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const commas = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

// ---------------------------------------------------------------- categories --

const categorySchema = z.object({
  slug: z.string().trim().regex(slugRe, "Slug must be lowercase words separated by hyphens."),
  name: z.string().trim().min(1, "Name is required.").max(80),
  blurb: z.string().trim().max(240),
  icon: z.string().trim().max(600),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    slug: str(formData.get("slug")),
    name: str(formData.get("name")),
    blurb: str(formData.get("blurb")) ?? "",
    icon: str(formData.get("icon")) ?? "",
    sortOrder: formData.get("sortOrder") || 0,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  const c = parsed.data;

  try {
    if (id) {
      await sql`
        UPDATE categories
        SET slug = ${c.slug}, name = ${c.name}, blurb = ${c.blurb},
            icon = ${c.icon}, sort_order = ${c.sortOrder}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        INSERT INTO categories (slug, name, blurb, icon, sort_order)
        VALUES (${c.slug}, ${c.name}, ${c.blurb}, ${c.icon}, ${c.sortOrder})
      `;
    }
  } catch (err) {
    return { error: messageFor(err, "A category with that slug already exists.") };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: id ? "Category updated." : "Category created." };
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // APIs keep existing; the FK is ON DELETE SET NULL so they fall out of the
  // category listing rather than disappearing from the marketplace.
  await sql`DELETE FROM categories WHERE id = ${id}`;
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
}

// --------------------------------------------------------------------- apis --

const apiSchema = z.object({
  slug: z.string().trim().regex(slugRe, "Slug must be lowercase words separated by hyphens."),
  name: z.string().trim().min(1, "Name is required.").max(120),
  tagline: z.string().trim().max(200),
  description: z.string().trim().max(4000),
  categoryId: z.string().trim().optional(),
  provider: z.string().trim().max(120),
  logo: z.string().trim().max(4),
  icon: z.string().trim().max(40).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value like #2445d6."),
  rating: z.coerce.number().min(0).max(5),
  reviews: z.coerce.number().int().min(0),
  subscribers: z.coerce.number().int().min(0),
  latency: z.coerce.number().int().min(0),
  uptime: z.coerce.number().min(0).max(100),
  sampleResponse: z.string().max(8000),
});

export async function saveApi(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = apiSchema.safeParse({
    slug: str(formData.get("slug")),
    name: str(formData.get("name")),
    tagline: str(formData.get("tagline")) ?? "",
    description: str(formData.get("description")) ?? "",
    categoryId: str(formData.get("categoryId")),
    provider: str(formData.get("provider")) ?? "",
    logo: str(formData.get("logo")) ?? "",
    icon: str(formData.get("icon")) ?? "",
    color: str(formData.get("color")) ?? "#2445d6",
    rating: formData.get("rating") || 5,
    reviews: formData.get("reviews") || 0,
    subscribers: formData.get("subscribers") || 0,
    latency: formData.get("latency") || 100,
    uptime: formData.get("uptime") || 99.9,
    sampleResponse: str(formData.get("sampleResponse")) ?? "{}",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const a = parsed.data;
  const id = String(formData.get("id") ?? "");
  const categoryId = a.categoryId && a.categoryId !== "" ? a.categoryId : null;
  const featured = formData.get("featured") === "on";
  const freeTier = formData.get("freeTier") === "on";
  const published = formData.get("published") === "on";
  const tags = commas(formData.get("tags"));
  const useCases = lines(formData.get("useCases"));

  let apiId = id;

  try {
    if (id) {
      await sql`
        UPDATE apis SET
          slug = ${a.slug}, name = ${a.name}, tagline = ${a.tagline},
          description = ${a.description}, category_id = ${categoryId},
          provider = ${a.provider}, logo = ${a.logo}, icon = ${a.icon ?? ""}, color = ${a.color},
          rating = ${a.rating}, reviews = ${a.reviews}, subscribers = ${a.subscribers},
          latency = ${a.latency}, uptime = ${a.uptime}, featured = ${featured},
          free_tier = ${freeTier}, published = ${published}, tags = ${tags},
          use_cases = ${useCases}, sample_response = ${a.sampleResponse}, updated_at = now()
        WHERE id = ${id}
      `;
    } else {
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO apis (
          slug, name, tagline, description, category_id, provider, logo, icon, color,
          rating, reviews, subscribers, latency, uptime, featured, free_tier,
          published, tags, use_cases, sample_response
        ) VALUES (
          ${a.slug}, ${a.name}, ${a.tagline}, ${a.description}, ${categoryId},
          ${a.provider}, ${a.logo}, ${a.icon ?? ""}, ${a.color}, ${a.rating}, ${a.reviews},
          ${a.subscribers}, ${a.latency}, ${a.uptime}, ${featured}, ${freeTier},
          ${published}, ${tags}, ${useCases}, ${a.sampleResponse}
        )
        RETURNING id
      `;
      apiId = row.id;
    }
  } catch (err) {
    return { error: messageFor(err, "An API with that slug already exists.") };
  }

  revalidateCatalog(a.slug);
  if (!id) redirect(`/admin/apis/${apiId}?created=1`);
  return { ok: "Saved." };
}

export async function toggleApiPublished(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await sql<{ slug: string }[]>`
    UPDATE apis SET published = NOT published, updated_at = now()
    WHERE id = ${id}
    RETURNING slug
  `;
  revalidateCatalog(row?.slug);
}

export type PublishState = { error?: string; ok?: string } | null;

/**
 * Publish with a completeness check.
 *
 * A live listing with no plans cannot be subscribed to, and one with no
 * endpoints documents nothing — both are visible to the public, so the console
 * says so rather than letting it ship silently.
 */
export async function publishApi(_prev: PublishState, formData: FormData): Promise<PublishState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing API." };

  const [counts] = await sql<{ slug: string; plans: string; endpoints: string; published: boolean }[]>`
    SELECT a.slug, a.published,
           (SELECT COUNT(*) FROM plans p WHERE p.api_id = a.id)::text AS plans,
           (SELECT COUNT(*) FROM endpoints e WHERE e.api_id = a.id)::text AS endpoints
    FROM apis a WHERE a.id = ${id} LIMIT 1
  `;
  if (!counts) return { error: "API not found." };

  if (!counts.published && Number(counts.plans) === 0) {
    return { error: "Add at least one plan before publishing — nobody could subscribe to it." };
  }

  await sql`UPDATE apis SET published = NOT published, updated_at = now() WHERE id = ${id}`;
  revalidateCatalog(counts.slug);

  const warning =
    !counts.published && Number(counts.endpoints) === 0
      ? " It has no endpoints documented yet."
      : "";

  return { ok: `${counts.published ? "Unpublished" : "Published"}.${warning}` };
}

export async function deleteApi(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Plans, endpoints, subscriptions, and usage cascade via the schema.
  await sql`DELETE FROM apis WHERE id = ${id}`;
  revalidateCatalog();
  redirect("/admin/apis");
}

// -------------------------------------------------------------------- plans --

const planSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required.").max(60),
  price: z.coerce.number().min(0),
  unit: z.string().trim().max(30).optional(),
  requests: z.string().trim().max(120),
  rateLimit: z.string().trim().max(120),
  quota: z.coerce.number().int().min(0),
});

export async function savePlan(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = planSchema.safeParse({
    name: str(formData.get("name")),
    price: formData.get("price") || 0,
    unit: formData.get("unit") || undefined,
    requests: str(formData.get("requests")) ?? "",
    rateLimit: str(formData.get("rateLimit")) ?? "",
    quota: formData.get("quota") || 100,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const p = parsed.data;
  const id = String(formData.get("id") ?? "");
  const apiId = String(formData.get("apiId") ?? "");
  const features = lines(formData.get("features"));
  const popular = formData.get("popular") === "on";
  const unit = p.unit && p.unit.length > 0 ? p.unit : null;

  if (id) {
    await sql`
      UPDATE plans SET
        name = ${p.name}, price = ${p.price}, unit = ${unit},
        requests = ${p.requests}, rate_limit = ${p.rateLimit},
        features = ${features}, popular = ${popular}, quota = ${p.quota}
      WHERE id = ${id}
    `;
  } else {
    if (!apiId) return { error: "Missing API." };
    const [{ next }] = await sql<{ next: number }[]>`
      SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM plans WHERE api_id = ${apiId}
    `;
    await sql`
      INSERT INTO plans (api_id, name, price, unit, requests, rate_limit, features, popular, quota, sort_order)
      VALUES (${apiId}, ${p.name}, ${p.price}, ${unit}, ${p.requests}, ${p.rateLimit},
              ${features}, ${popular}, ${p.quota}, ${next})
    `;
  }

  revalidateCatalog();
  return { ok: "Plan saved." };
}

export async function deletePlan(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await sql`DELETE FROM plans WHERE id = ${id}`;
  revalidateCatalog();
}

// ---------------------------------------------------------------- endpoints --

export async function saveEndpoint(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const method = String(formData.get("method") ?? "GET").toUpperCase();
  const path = String(formData.get("path") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const apiId = String(formData.get("apiId") ?? "");
  const id = String(formData.get("id") ?? "");

  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) return { error: "Unsupported method." };
  if (!path.startsWith("/")) return { error: "Path must start with a forward slash." };

  if (id) {
    await sql`
      UPDATE endpoints SET method = ${method}, path = ${path}, summary = ${summary}
      WHERE id = ${id}
    `;
  } else {
    if (!apiId) return { error: "Missing API." };
    const [{ next }] = await sql<{ next: number }[]>`
      SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM endpoints WHERE api_id = ${apiId}
    `;
    await sql`
      INSERT INTO endpoints (api_id, method, path, summary, sort_order)
      VALUES (${apiId}, ${method}, ${path}, ${summary}, ${next})
    `;
  }

  revalidateCatalog();
  return { ok: "Endpoint saved." };
}

export async function deleteEndpoint(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await sql`DELETE FROM endpoints WHERE id = ${id}`;
  revalidateCatalog();
}

// -------------------------------------------------------------------- users --

export async function setUserRole(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!id || !["admin", "customer"].includes(role)) return;

  // Guard against an administrator removing their own last route back in.
  if (id === admin.id && role !== "admin") {
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin'
    `;
    if (Number(count) <= 1) return;
  }

  await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
  revalidatePath("/admin/users");
}

// ------------------------------------------------------------------ helpers --

function revalidateCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/marketplace");
  revalidatePath("/categories");
  revalidatePath("/admin/apis");
  if (slug) revalidatePath(`/marketplace/${slug}`);
}

function messageFor(err: unknown, duplicateMessage: string) {
  const code = (err as { code?: string })?.code;
  if (code === "23505") return duplicateMessage;
  console.error("Admin action failed:", err);
  return "Could not save. Check the values and try again.";
}
