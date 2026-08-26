"use client";

import { useActionState } from "react";
import { saveEndpoint, type FormState } from "@/server/actions/admin";
import { Field, Message, Select, Submit } from "./Form";
import type { Endpoint } from "@/lib/types";

export default function EndpointForm({ apiId, endpoint }: { apiId: string; endpoint?: Endpoint }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveEndpoint, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="apiId" value={apiId} />
      {endpoint?.id && <input type="hidden" name="id" value={endpoint.id} />}

      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <Select label="Method" name="method" defaultValue={endpoint?.method ?? "GET"}>
          {["GET", "POST", "PUT", "DELETE"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        <Field label="Path" name="path" defaultValue={endpoint?.path} required placeholder="/stores" />
      </div>

      <Field
        label="Summary"
        name="summary"
        defaultValue={endpoint?.summary}
        placeholder="List every connected storefront"
      />

      <div className="flex items-center gap-3">
        <Submit>{endpoint?.id ? "Save endpoint" : "Add endpoint"}</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
