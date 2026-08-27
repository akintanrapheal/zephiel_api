"use server";

import { z } from "zod";
import { sql } from "@/lib/db";

export type SubscribeState = { error?: string; ok?: string } | null;

/**
 * Newsletter signup.
 *
 * Re-subscribing an address that already exists is treated as success rather
 * than an error — telling a visitor "you are already on this list" discloses
 * membership to anyone who guesses an address.
 */
export async function subscribeToNewsletter(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .safeParse(formData.get("email"));

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await sql`
    INSERT INTO newsletter_subscribers (email, source)
    VALUES (${parsed.data}, 'footer')
    ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NULL
  `;

  return { ok: "You're on the list — thanks." };
}
