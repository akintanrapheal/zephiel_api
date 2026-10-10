import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "./db";
import type { Role, User } from "./types";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const SESSION_COOKIE = "zephiel_session";
const SESSION_DAYS = 30;

// ------------------------------------------------------------- passwords --

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  // Lengths must match before timingSafeEqual, which throws otherwise.
  if (expected.length !== key.length) return false;
  return timingSafeEqual(key, expected);
}

// -------------------------------------------------------------- API keys --

/** Returns the plaintext key (shown once) and the values to persist. */
export function generateApiKey(live = true) {
  const secret = randomBytes(20).toString("hex");
  const plaintext = `zk_${live ? "live" : "test"}_${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 11),
    hash: hashApiKey(plaintext),
  };
}

/**
 * API keys are high-entropy random strings, so a fast digest is appropriate
 * here — unlike passwords, there is nothing to brute-force offline.
 */
export function hashApiKey(plaintext: string) {
  return createHash("sha256").update(plaintext).digest("hex");
}

// -------------------------------------------------------------- sessions --

export async function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${id}, ${userId}, ${expiresAt})
  `;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) await sql`DELETE FROM sessions WHERE id = ${id}`;
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  // account_owner_id links a member to the account they belong to. Tolerate it
  // being absent (migration not yet run) by falling back to a query without it,
  // so a deployment that hasn't migrated still signs people in as owners.
  type Row = {
    id: string;
    account_owner_id: string | null;
    email: string;
    name: string;
    role: Role;
    created_at: Date;
  };
  let rows: Row[];
  try {
    rows = await sql<Row[]>`
      SELECT u.id, u.account_owner_id, u.email, u.name, u.role, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${id} AND s.expires_at > now()
      LIMIT 1
    `;
  } catch {
    const legacy = await sql<Omit<Row, "account_owner_id">[]>`
      SELECT u.id, u.email, u.name, u.role, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${id} AND s.expires_at > now()
      LIMIT 1
    `;
    rows = legacy.map((r) => ({ ...r, account_owner_id: null }));
  }

  const row = rows[0];
  if (!row) return null;
  return {
    // A member shares the owner's account, so the effective account id is the
    // owner's. Queries scoped by `id` therefore operate on that account.
    id: row.account_owner_id ?? row.id,
    memberId: row.id,
    isMember: row.account_owner_id != null,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

/** The signed-in user, required to OWN their account (members are refused). */
export async function requireAccountOwner(): Promise<User> {
  const user = await requireUser();
  if (user.isMember) throw new Error("FORBIDDEN");
  return user;
}
