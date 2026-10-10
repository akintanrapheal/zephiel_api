import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listMembers } from "@/server/actions/team";
import { AddMemberForm, RemoveMemberButton } from "@/components/app/TeamForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/dashboard/team");
  // Only the account owner manages the team — a member is sent back to the dashboard.
  if (user.isMember) redirect("/dashboard");

  const members = await listMembers(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Team</h1>
        <p className="mt-1 text-sm text-muted">
          Add people to your account. They sign in with their own email and password and share your
          subscriptions, stores, API keys, and usage.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Add a member</h2>
        <div className="mt-5">
          <AddMemberForm />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">
          Members{members.length > 0 && <span className="text-muted"> · {members.length}</span>}
        </h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No members yet. Add one above.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{m.name || m.email}</p>
                  <p className="truncate text-xs text-muted">
                    {m.email} · added{" "}
                    {new Date(m.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <RemoveMemberButton memberId={m.id} label={m.name || m.email} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
