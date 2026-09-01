import { Card } from "@/components/admin/PageHeader";
import SchemaCard from "@/components/admin/SchemaCard";
import ContentCard from "@/components/admin/ContentCard";
import { getSchemaStatus } from "@/server/schema-status";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data · Settings" };

export default async function DataSettingsPage() {
  const schema = await getSchemaStatus();

  const [content] = await sql<{ apis: string; reviews: string; posts: string }[]>`
    SELECT
      (SELECT COUNT(*) FROM apis)::text    AS apis,
      (SELECT COUNT(*) FROM reviews)::text AS reviews,
      (SELECT COUNT(*) FROM posts)::text   AS posts
  `.catch(() => [{ apis: "0", reviews: "0", posts: "0" }]);

  return (
    <div className="space-y-4">
      <Card title="Database schema" padded>
        <SchemaCard
          missingTables={schema.missingTables}
          missingColumns={schema.missingColumns}
          upToDate={schema.upToDate}
        />
      </Card>

      <Card title="Catalogue content" padded>
        <ContentCard
          apis={Number(content.apis)}
          reviews={Number(content.reviews)}
          posts={Number(content.posts)}
        />
      </Card>
    </div>
  );
}
