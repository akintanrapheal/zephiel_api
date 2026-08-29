import "server-only";
import { sql } from "@/lib/db";

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tag: string;
  readMinutes: number;
  published: boolean;
  publishedAt: Date;
};

const columns = sql`
  id, slug, title, excerpt, body, tag,
  read_minutes AS "readMinutes",
  published,
  published_at AS "publishedAt"
`;

export async function getPosts({ limit = 200, includeDrafts = false } = {}): Promise<Post[]> {
  return sql<Post[]>`
    SELECT ${columns} FROM posts
    ${includeDrafts ? sql`` : sql`WHERE published = true`}
    ORDER BY published_at DESC
    LIMIT ${limit}
  `;
}

export async function getPost(slug: string, { includeDrafts = false } = {}) {
  const rows = await sql<Post[]>`
    SELECT ${columns} FROM posts
    WHERE slug = ${slug} ${includeDrafts ? sql`` : sql`AND published = true`}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getPostById(id: string) {
  const rows = await sql<Post[]>`SELECT ${columns} FROM posts WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}
