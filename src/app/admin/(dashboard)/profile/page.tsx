import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import Avatar from "@/components/app/Avatar";
import PageHeader, { Card } from "@/components/admin/PageHeader";
import { NameForm, EmailForm, PasswordForm, AvatarForm } from "@/components/app/ProfileForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

export default async function AdminProfilePage() {
  const admin = await requireAdmin();

  const [row] = await sql<{ name: string; avatar_updated_at: Date | null; created_at: Date }[]>`
    SELECT name, avatar_updated_at, created_at FROM users WHERE id = ${admin.id} LIMIT 1
  `;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        description="Your own account. Platform-wide configuration lives in Settings."
      />

      <Card title="Profile picture" padded>
        <div className="flex flex-wrap items-center gap-6">
          <Avatar
            userId={admin.id}
            name={row?.name}
            email={admin.email}
            updatedAt={row?.avatar_updated_at}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <AvatarForm hasAvatar={Boolean(row?.avatar_updated_at)} />
          </div>
        </div>
      </Card>

      <Card title="Your name" padded>
        <NameForm name={row?.name ?? ""} />
      </Card>

      <Card title="Sign-in address" padded>
        <EmailForm email={admin.email} />
      </Card>

      <Card title="Password" padded>
        <PasswordForm email={admin.email} />
      </Card>
    </div>
  );
}
