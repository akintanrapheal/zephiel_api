import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import Playground, { type PlaygroundApi } from "@/components/app/Playground";

export const dynamic = "force-dynamic";
export const metadata = { title: "Playground" };

export default async function PlaygroundPage() {
  const user = await requireUser();

  // Only APIs with an active subscription — the gateway would reject the rest.
  const apis = await sql<PlaygroundApi[]>`
    SELECT
      a.slug,
      a.name,
      COALESCE((
        SELECT json_agg(json_build_object('method', e.method, 'path', e.path, 'summary', e.summary)
               ORDER BY e.sort_order)
        FROM endpoints e WHERE e.api_id = a.id
      ), '[]'::json) AS endpoints
    FROM subscriptions s
    JOIN apis a ON a.id = s.api_id
    WHERE s.user_id = ${user.id} AND s.status = 'active' AND a.published = true
    ORDER BY a.name
  `;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Playground</h1>
        <p className="mt-1 text-sm text-muted">
          Send a real request through the gateway and see exactly what your code will get back.
        </p>
      </header>

      <Playground apis={apis} />
    </div>
  );
}
