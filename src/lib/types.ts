export type Plan = {
  id?: string;
  name: string;
  price: number;
  /**
   * Billing unit when the price is charged per something rather than flat —
   * e.g. "store" renders as "$50 /store/mo". Omit for flat monthly pricing.
   */
  unit?: string;
  requests: string;
  rateLimit: string;
  features: string[];
  popular?: boolean;
  /** Connected storefronts allowed; 0 means negotiated rather than fixed. */
  storeLimit?: number;
  /** Calls included per month; enforced by the gateway. */
  quota?: number;
};

export type Endpoint = {
  id?: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  summary: string;
};

export type Api = {
  id?: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  provider: string;
  logo: string;
  /** Key into the icon registry in src/lib/icons.ts; empty falls back to `logo`. */
  icon?: string;
  color: string;
  rating: number;
  reviews: number;
  subscribers: number;
  latency: number;
  uptime: number;
  featured?: boolean;
  freeTier: boolean;
  published?: boolean;
  tags: string[];
  useCases: string[];
  endpoints: Endpoint[];
  sampleResponse: string;
  plans: Plan[];
};

export type Category = {
  id?: string;
  slug: string;
  name: string;
  blurb: string;
  icon: string;
};

export type Role = "admin" | "customer";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
};

export type SubscriptionStatus = "active" | "pending" | "cancelled" | "expired";

export type Subscription = {
  id: string;
  userId: string;
  apiId: string;
  apiName: string;
  apiSlug: string;
  apiLogo: string;
  apiColor: string;
  apiIcon: string | null;
  planName: string;
  planPrice: number;
  planUnit: string | null;
  status: SubscriptionStatus;
  quota: number;
  used: number;
  units: number;
  billingInterval: "monthly" | "annual";
  currentPeriodEnd: Date | null;
  createdAt: Date;
};

export type ApiKey = {
  id: string;
  label: string;
  scope: string;
  /** Set when the key is scoped to one storefront. */
  storeName?: string | null;
  keyPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type Payment = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  email: string;
  apiName: string | null;
  planName: string | null;
  createdAt: Date;
};
