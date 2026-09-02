import type { Plan } from "@/lib/types";

/**
 * One capability, and the tier index from which it is included.
 *
 * Tiers build cumulatively from this list, so a higher tier always contains
 * everything below it. That is what lets a plan card show the same rows on
 * every tier with a tick or a cross, rather than four unrelated lists that
 * cannot be compared side by side.
 */
export type Capability = { label: string; from: number };

const BASE_CAPABILITIES: Capability[] = [
  { label: "JSON output format", from: 0 },
  { label: "HTTPS encryption", from: 0 },
  { label: "API key authentication", from: 0 },
  { label: "Standard endpoints", from: 0 },
  { label: "Community support", from: 0 },
  { label: "CSV output format", from: 1 },
  { label: "Email support", from: 1 },
  { label: "Usage analytics and alerts", from: 1 },
  { label: "99.9% uptime SLA", from: 1 },
  { label: "Webhooks", from: 2 },
  { label: "Priority support", from: 2 },
  { label: "Custom rate limits", from: 2 },
  { label: "99.99% uptime SLA", from: 2 },
  { label: "Dedicated success manager", from: 3 },
  { label: "SSO / SAML", from: 3 },
  { label: "Custom SLA, DPA, and BAA", from: 3 },
  { label: "Private deployment option", from: 3 },
  { label: "Volume pricing", from: 3 },
];

const TIER_SHAPES = [
  { name: "Free", multiplier: 0, requests: 100, rateLimit: "5 req/min" },
  { name: "Starter", multiplier: 1, requests: 10_000, rateLimit: "60 req/min" },
  { name: "Pro", multiplier: 4, requests: 250_000, rateLimit: "600 req/min", popular: true },
  { name: "Enterprise", multiplier: 14, requests: 0, rateLimit: "Custom" },
];

export const tiers = (base: number, unit = "requests", extra: Capability[] = []): Plan[] => {
  const caps = [...BASE_CAPABILITIES, ...extra].sort((a, b) => a.from - b.from);

  return TIER_SHAPES.map((shape, i) => ({
    name: shape.name,
    price: base * shape.multiplier,
    requests: shape.requests === 0 ? `Unlimited ${unit}` : `${shape.requests.toLocaleString()} ${unit}/mo`,
    rateLimit: shape.rateLimit,
    features: caps.filter((c) => c.from <= i).map((c) => c.label),
    ...(shape.popular ? { popular: true } : {}),
  }));
};
