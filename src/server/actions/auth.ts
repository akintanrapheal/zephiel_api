"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import {
  createSession,
  destroySession,
  generateApiKey,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = { error?: string } | null;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signupSchema = credentials.extend({
  name: z.string().trim().min(1, "Name is required.").max(120),
});

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { name, email, password } = parsed.data;

  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing) return { error: "An account with that email already exists." };

  const [user] = await sql<{ id: string }[]>`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${email}, ${name}, ${await hashPassword(password)}, 'customer')
    RETURNING id
  `;

  // Every new account gets a working key so the docs examples run immediately.
  const key = generateApiKey();
  await sql`
    INSERT INTO api_keys (user_id, label, scope, key_prefix, key_hash)
    VALUES (${user.id}, 'Default', 'All APIs', ${key.prefix}, ${key.hash})
  `;

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Enter a valid email and password." };

  const { email, password } = parsed.data;

  const [user] = await sql<{ id: string; password_hash: string; role: string }[]>`
    SELECT id, password_hash, role FROM users WHERE email = ${email} LIMIT 1
  `;

  // Same message either way, so the form can't be used to enumerate accounts.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Email or password is incorrect." };
  }

  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

/**
 * Sign-in for the admin console.
 *
 * Separate from the customer flow so a non-admin account is refused outright
 * rather than being signed in and then bounced by the layout guard — and so the
 * admin entry point never hints at whether an email exists.
 */
export async function adminSignIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Enter a valid email and password." };

  const { email, password } = parsed.data;

  const [user] = await sql<{ id: string; password_hash: string; role: string }[]>`
    SELECT id, password_hash, role FROM users WHERE email = ${email} LIMIT 1
  `;

  const ok = user ? await verifyPassword(password, user.password_hash) : false;

  if (!ok || user?.role !== "admin") {
    return { error: "Those credentials don't have administrator access." };
  }

  await createSession(user.id);
  redirect("/admin");
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
