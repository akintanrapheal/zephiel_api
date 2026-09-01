import { redirect } from "next/navigation";

/** The settings area opens on Payments; the tabs carry the rest. */
export default function SettingsIndex() {
  redirect("/admin/settings/payments");
}
