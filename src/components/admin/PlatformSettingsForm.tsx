"use client";

import { useActionState } from "react";
import { savePlatformSettings } from "@/server/actions/settings";
import type { FormState } from "@/server/actions/admin";
import { Field, Message, Submit } from "./Form";

export default function PlatformSettingsForm({
  platformName,
  supportEmail,
}: {
  platformName: string;
  supportEmail: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(savePlatformSettings, null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Platform name" name="platformName" defaultValue={platformName} required />
        <Field
          label="Support email"
          hint="optional"
          name="supportEmail"
          type="email"
          defaultValue={supportEmail}
          placeholder="support@zephiel.com"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>Save platform settings</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
