import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { sql } from "./db";

export type SettingKey =
  | "paystack_secret_key"
  | "paystack_currency"
  | "usd_to_ngn"
  | "platform_name"
  | "support_email"
  | "resend_api_key"
  | "email_from"
  | "company_name"
  | "company_address"
  | "company_tax_id";

const SECRET_KEYS: SettingKey[] = ["paystack_secret_key", "resend_api_key"];

/**
 * Key material for encrypting stored secrets.
 *
 * `SETTINGS_KEY` is preferred. Without it we derive from DATABASE_URL, which is
 * always present — that keeps the console usable out of the box, at the cost of
 * invalidating stored secrets if the database password is rotated. The settings
 * page says which mode is active.
 */
function keyMaterial() {
  const explicit = process.env.SETTINGS_KEY;
  if (explicit) return { secret: explicit, derived: false };

  const fallback = process.env.DATABASE_URL;
  if (!fallback) throw new Error("Neither SETTINGS_KEY nor DATABASE_URL is set.");
  return { secret: fallback, derived: true };
}

export function usingDerivedKey() {
  return !process.env.SETTINGS_KEY;
}

function encrypt(plaintext: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(keyMaterial().secret, salt, 32);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", salt.toString("hex"), iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

function decrypt(stored: string): string | null {
  const [version, saltHex, ivHex, tagHex, dataHex] = stored.split(":");
  if (version !== "v1" || !saltHex || !ivHex || !tagHex || !dataHex) return null;

  try {
    const key = scryptSync(keyMaterial().secret, Buffer.from(saltHex, "hex"), 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key (rotated DATABASE_URL, or SETTINGS_KEY added later).
    return null;
  }
}

/**
 * Keys whose stored value exists but could not be decrypted.
 *
 * Kept separate from getSettings() because an unreadable secret and an unset
 * one are very different situations: the first means an operator saved
 * something and the key material has since changed.
 */
export async function unreadableSecrets(): Promise<SettingKey[]> {
  const rows = await sql<{ key: SettingKey; value: string; is_secret: boolean }[]>`
    SELECT key, value, is_secret FROM settings WHERE is_secret = true AND value <> ''
  `;
  return rows.filter((r) => decrypt(r.value) === null).map((r) => r.key);
}

/** All settings, with secrets decrypted. Missing keys are simply absent. */
export async function getSettings(): Promise<Partial<Record<SettingKey, string>>> {
  const rows = await sql<{ key: SettingKey; value: string; is_secret: boolean }[]>`
    SELECT key, value, is_secret FROM settings
  `;

  const out: Partial<Record<SettingKey, string>> = {};
  for (const row of rows) {
    if (!row.value) continue;
    const value = row.is_secret ? decrypt(row.value) : row.value;
    if (value) out[row.key] = value;
  }
  return out;
}

export async function getSetting(key: SettingKey) {
  return (await getSettings())[key];
}

export async function setSetting(key: SettingKey, value: string, updatedBy?: string) {
  const isSecret = SECRET_KEYS.includes(key);
  const stored = value === "" ? "" : isSecret ? encrypt(value) : value;

  await sql`
    INSERT INTO settings (key, value, is_secret, updated_by)
    VALUES (${key}, ${stored}, ${isSecret}, ${updatedBy ?? null})
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          is_secret = EXCLUDED.is_secret,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
  `;
}

export async function clearSetting(key: SettingKey) {
  await sql`DELETE FROM settings WHERE key = ${key}`;
}

/** Metadata for the console: whether a secret is set, and a safe hint of it. */
export async function getSecretStatus(key: SettingKey) {
  const rows = await sql<{ value: string; updated_at: Date }[]>`
    SELECT value, updated_at FROM settings WHERE key = ${key} LIMIT 1
  `;

  const row = rows[0];
  if (!row?.value) return { configured: false as const };

  const plain = decrypt(row.value);
  if (!plain) {
    return { configured: true as const, unreadable: true as const, updatedAt: row.updated_at };
  }

  return {
    configured: true as const,
    unreadable: false as const,
    hint: `${plain.slice(0, 7)}…${plain.slice(-4)}`,
    updatedAt: row.updated_at,
  };
}
