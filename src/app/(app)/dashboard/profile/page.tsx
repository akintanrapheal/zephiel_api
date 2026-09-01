import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import Avatar from "@/components/app/Avatar";
import { NameForm, EmailForm, PasswordForm, AvatarForm } from "@/components/app/ProfileForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

function Card({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();

  const [row] = await sql<{ name: string; avatar_updated_at: Date | null; created_at: Date }[]>`
    SELECT name, avatar_updated_at, created_at FROM users WHERE id = ${user.id} LIMIT 1
  `;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar
          userId={user.id}
          name={row?.name}
          email={user.email}
          updatedAt={row?.avatar_updated_at}
          size={64}
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Profile</h1>
          <p className="mt-1 text-sm text-muted">
            {user.email} · member since{" "}
            {row?.created_at
              ? new Date(row.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
              : "—"}
          </p>
        </div>
      </header>

      <Card title="Profile picture" description="Shown beside your name across the dashboard.">
        <AvatarForm hasAvatar={Boolean(row?.avatar_updated_at)} />
      </Card>

      <Card title="Your name">
        <NameForm name={row?.name ?? ""} />
      </Card>

      <Card title="Sign-in address">
        <EmailForm email={user.email} />
      </Card>

      <Card title="Password" description="At least 12 characters. Changing it signs out other devices.">
        <PasswordForm email={user.email} />
      </Card>
    </div>
  );
}
