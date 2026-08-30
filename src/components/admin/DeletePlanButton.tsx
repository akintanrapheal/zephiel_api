"use client";

import { useActionState } from "react";
import { deletePlan } from "@/server/actions/admin";
import type { FormState } from "@/server/actions/admin";
import { Message } from "./Form";

/**
 * Deleting a plan cascades to every subscription on it. The action refuses
 * when anyone is subscribed, so the button needs somewhere to show that.
 */
export default function DeletePlanButton({ planId }: { planId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(deletePlan, null);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={planId} />
      <button className="text-xs font-medium text-rose-600 hover:underline">Delete plan</button>
      <Message state={state} />
    </form>
  );
}
