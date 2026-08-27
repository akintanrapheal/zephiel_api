/*
 * Adjust a customer account for demonstration purposes.
 *
 *   npm run user:adjust
 *
 * Backdates the registration date and moves active subscriptions onto their
 * API's free plan with a chosen expiry. Everything is prompted, and the current
 * state is shown before anything changes.
 */
import { createInterface } from "node:readline";
import postgres from "postgres";
import { loadEnv } from "./env.mts";

loadEnv();

function ask(question: string, fallback = ""): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(fallback ? `${question} [${fallback}] ` : question, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Point .env.local at the database you want to change.");
  process.exit(1);
}

const sql = postgres(url, {
  max: 1,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
});

try {
  console.log(`\nAdjusting an account in ${url.includes("localhost") ? "your LOCAL" : "a REMOTE"} database.\n`);

  const email = (await ask("Customer email: ")).toLowerCase();
  if (!email) throw new Error("An email is required.");

  const [user] = await sql<{ id: string; name: string; created_at: Date }[]>`
    SELECT id, name, created_at FROM users WHERE email = ${email} LIMIT 1
  `;
  if (!user) throw new Error(`No account found for ${email}.`);

  const before = await sql<
    { id: string; api: string; plan: string; price: string; status: string; ends: Date | null }[]
  >`
    SELECT s.id, a.name AS api, p.name AS plan, p.price, s.status, s.current_period_end AS ends
    FROM subscriptions s
    JOIN apis a  ON a.id = s.api_id
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${user.id}
  `;

  console.log(`\nCurrent state for ${email}`);
  console.log(`  Registered: ${user.created_at.toISOString().slice(0, 10)}`);
  if (before.length === 0) console.log("  Subscriptions: none");
  for (const s of before) {
    const ends = s.ends ? s.ends.toISOString().slice(0, 10) : "—";
    console.log(`  ${s.api}: ${s.plan} ($${s.price}) · ${s.status} · ends ${ends}`);
  }

  const joined = await ask("\nRegistration date (YYYY-MM-DD): ", "2026-06-05");
  const expiry = await ask("Subscription expiry (YYYY-MM-DD): ", "2026-09-20");

  for (const value of [joined, expiry]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`"${value}" is not a YYYY-MM-DD date.`);
  }

  const confirm = await ask(`\nApply to ${email}? (yes/no): `, "no");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled — nothing changed.\n");
    process.exit(0);
  }

  await sql.begin(async (tx) => {
    await tx`UPDATE users SET created_at = ${`${joined}T09:00:00Z`} WHERE id = ${user.id}`;

    // Move each active subscription onto the free plan of the same API.
    await tx`
      UPDATE subscriptions s
      SET plan_id = free.id,
          quota   = free.quota,
          units   = 1,
          current_period_end = ${`${expiry}T23:59:59Z`},
          status  = 'active',
          updated_at = now()
      FROM LATERAL (
        SELECT p.id, p.quota FROM plans p
        WHERE p.api_id = s.api_id AND p.price = 0
        ORDER BY p.sort_order
        LIMIT 1
      ) AS free
      WHERE s.user_id = ${user.id} AND s.status = 'active'
    `;
  });

  const after = await sql<
    { api: string; plan: string; price: string; status: string; ends: Date | null; quota: number }[]
  >`
    SELECT a.name AS api, p.name AS plan, p.price, s.status, s.current_period_end AS ends, s.quota
    FROM subscriptions s
    JOIN apis a  ON a.id = s.api_id
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = ${user.id}
  `;

  const [updated] = await sql<{ created_at: Date }[]>`
    SELECT created_at FROM users WHERE id = ${user.id}
  `;

  console.log(`\nUpdated`);
  console.log(`  Registered: ${updated.created_at.toISOString().slice(0, 10)}`);
  for (const s of after) {
    const ends = s.ends ? s.ends.toISOString().slice(0, 10) : "—";
    console.log(`  ${s.api}: ${s.plan} ($${s.price}) · ${s.status} · ${s.quota} calls · ends ${ends}`);
  }
  console.log("");
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : err}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
