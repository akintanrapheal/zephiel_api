"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import sharp from "sharp";
import { sql } from "@/lib/db";
import { requireUser, hashPassword, verifyPassword, createSession } from "@/lib/auth";
import type { FormState } from "./admin";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "That name is too long."),
});

export async function changeMyName(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = nameSchema.safeParse({ name: String(formData.get("name") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  await sql`UPDATE users SET name = ${parsed.data.name} WHERE id = ${user.id}`;
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
  return { ok: "Name updated." };
}

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  current: z.string().min(1, "Enter your password to confirm."),
});

/**
 * Change the signed-in customer's own sign-in address.
 *
 * The email is the login identifier, so this is a credential change: it takes
 * the current password, and signs other sessions out afterwards.
 */
export async function changeMyEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = emailSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    current: String(formData.get("current") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const next = parsed.data.email;
  if (next === user.email.toLowerCase()) return { error: "That is already your sign-in address." };

  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE id = ${user.id} LIMIT 1
  `;
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) {
    return { error: "That password is incorrect." };
  }

  // users.email is unique; checking first turns a constraint violation into a
  // message someone can act on.
  const [taken] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE lower(email) = ${next} AND id <> ${user.id} LIMIT 1
  `;
  if (taken) return { error: "Another account already uses that address." };

  await sql`UPDATE users SET email = ${next} WHERE id = ${user.id}`;
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await createSession(user.id);

  revalidatePath("/dashboard/profile");
  return { ok: `Sign-in address changed to ${next}. Use it next time you sign in.` };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(12, "Use at least 12 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The new passwords do not match." });

export async function changeMyPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = passwordSchema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE id = ${user.id} LIMIT 1
  `;
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) {
    return { error: "Your current password is incorrect." };
  }
  if (parsed.data.next === parsed.data.current) {
    return { error: "The new password must be different." };
  }

  await sql`
    UPDATE users SET password_hash = ${await hashPassword(parsed.data.next)} WHERE id = ${user.id}
  `;
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await createSession(user.id);

  revalidatePath("/dashboard/profile");
  return { ok: "Password changed. Other devices have been signed out." };
}

/** Generous enough for a phone photo, small enough to reject a video. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"];

/**
 * Store a profile picture.
 *
 * Phone cameras produce multi-megabyte images, often HEIC, and frequently
 * rotated with only an EXIF orientation tag to say so. Everything is decoded,
 * rotated upright, cropped square, and re-encoded to a small WebP, so what is
 * stored is a few kilobytes in a format every browser can display.
 */
export async function uploadAvatar(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That image is larger than 8MB." };
  if (file.type && !ACCEPTED.includes(file.type.toLowerCase())) {
    return { error: "Use a JPEG, PNG, WebP, or HEIC image." };
  }

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()))
      // Applies the EXIF orientation phones set instead of rotating pixels,
      // which is why an uploaded selfie otherwise arrives sideways.
      .rotate()
      .resize(256, 256, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "That file could not be read as an image." };
  }

  await sql`
    UPDATE users
    SET avatar = ${webp}, avatar_type = 'image/webp', avatar_updated_at = now()
    WHERE id = ${user.id}
  `;

  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
  return { ok: "Profile picture updated." };
}

export async function removeAvatar(): Promise<void> {
  const user = await requireUser();
  await sql`
    UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_updated_at = NULL
    WHERE id = ${user.id}
  `;
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
}
