"use client";

import { useState } from "react";
import type { Plan } from "@/lib/types";
import type { BillingInterval } from "@/lib/plans";
import BillingToggle from "./BillingToggle";
import PlanCard from "./PlanCard";

/**
 * The platform tiers with a monthly/annual switch above them.
 *
 * A client wrapper because the toggle has to drive every card at once; the
 * cards themselves stay server-rendered components receiving the choice.
 */
export default function PricingPlans({
  plans,
  hrefs = {},
}: {
  plans: Plan[];
  /** Where each non-purchasable card should lead, by plan name. */
  hrefs?: Record<string, string>;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <div>
      <BillingToggle value={interval} onChange={setInterval} className="mb-10" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <PlanCard key={p.name} plan={p} interval={interval} href={hrefs[p.name]} />
        ))}
      </div>
    </div>
  );
}
