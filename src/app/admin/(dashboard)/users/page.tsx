import { listUsers } from "@/server/admin";
import { setUserRole } from "@/server/actions/admin";
import PageHeader from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const users = await listUsers();

  return (
    <div>
      <PageHeader title="Users" description={`${users.length} account${users.length === 1 ? "" : "s"}`} />

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-elevated text-left">
              <th className="px-5 py-3 font-semibold text-ink">Email</th>
              <th className="px-5 py-3 font-semibold text-ink">Name</th>
              <th className="px-5 py-3 font-semibold text-ink">Role</th>
              <th className="px-5 py-3 font-semibold text-ink">Subs</th>
              <th className="px-5 py-3 font-semibold text-ink">Calls</th>
              <th className="px-5 py-3 font-semibold text-ink">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={i % 2 ? "bg-elevated/40" : "bg-surface"}>
                <td className="px-5 py-3 text-ink">{u.email}</td>
                <td className="px-5 py-3 text-muted">{u.name || "—"}</td>
                <td className="px-5 py-3">
                  <form action={setUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="rounded-lg border border-line bg-bg px-2 py-1 text-xs text-ink"
                    >
                      <option value="customer">customer</option>
                      <option value="admin">admin</option>
                    </select>
                    <button className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:text-ink">
                      Set
                    </button>
                  </form>
                </td>
                <td className="px-5 py-3 tabular-nums text-muted">{u.subs}</td>
                <td className="px-5 py-3 tabular-nums text-muted">{u.calls}</td>
                <td className="px-5 py-3 text-muted">
                  {new Date(u.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        The last remaining administrator cannot demote themselves.
      </p>
    </div>
  );
}
