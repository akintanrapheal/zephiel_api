/*
 * Change a user's password from the command line.
 *
 *   npm run admin:password
 *
 * Prompts for the email and the new password without echoing it, so nothing
 * sensitive lands in shell history. Also clears that user's existing sessions,
 * so anyone already signed in with the old password is signed out.
 */
import { createInterface } from "node:readline";
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { loadEnv } from "./env.mts";

loadEnv();

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    // Suppress echo: intercept the output stream while the answer is typed.
    const output = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput: (s: string) => void };
    process.stdout.write(question);
    output._writeToOutput = () => {};

    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
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
  const target = url.includes("localhost") ? "your LOCAL database" : "a REMOTE database";
  console.log(`\nChanging a password in ${target}.\n`);

  const email = (await ask("Email: ")).toLowerCase();
  if (!email) throw new Error("An email is required.");

  const [user] = await sql<{ id: string; role: string }[]>`
    SELECT id, role FROM users WHERE email = ${email} LIMIT 1
  `;
  if (!user) throw new Error(`No account found for ${email}.`);

  const password = await ask("New password (min 12 chars, hidden): ", true);
  if (password.length < 12) throw new Error("Use at least 12 characters.");

  const confirm = await ask("Confirm password (hidden): ", true);
  if (password !== confirm) throw new Error("Those did not match.");

  await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${user.id}`;
  const killed = await sql`DELETE FROM sessions WHERE user_id = ${user.id} RETURNING id`;

  console.log(`\nPassword updated for ${email} (${user.role}).`);
  console.log(`${killed.length} existing session${killed.length === 1 ? "" : "s"} signed out.\n`);
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : err}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
