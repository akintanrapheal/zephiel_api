import { sql } from "@/lib/db";

/**
 * Serve a stored profile picture.
 *
 * Public by id: the id is a uuid, the image is one the person chose to show,
 * and gating it behind a session would break the browser's own image cache for
 * no real benefit. Cached hard and busted by the ?v= the caller appends from
 * avatar_updated_at.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const [row] = await sql<{ avatar: Buffer | null; avatar_type: string | null }[]>`
    SELECT avatar, avatar_type FROM users WHERE id = ${id} LIMIT 1
  `;

  if (!row?.avatar) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(row.avatar), {
    headers: {
      "Content-Type": row.avatar_type ?? "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
