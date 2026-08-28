/** Seed blog posts, shared by the CLI seeder and the admin console. */
export type SeedPost = {
  slug: string;
  title: string;
  tag: string;
  readMinutes: number;
  excerpt: string;
  body: string;
};

export const posts: SeedPost[] = [
  {
    slug: "why-we-publish-p99",
    title: "Why we publish our p99, not our p50",
    tag: "Engineering",
    readMinutes: 6,
    excerpt:
      "Median latency is a marketing number. The tail is what pages your on-call. Here is every percentile we measure and how we collect it.",
    body: `Every vendor page quotes a median. It is the most flattering number available, and it tells you almost nothing about the experience of running something in production.

## The median hides the failure

If half your calls return in 40ms and one in a hundred takes four seconds, the median still reads 40ms. Your users experience the four seconds. Your on-call engineer is paged about the four seconds. Nobody has ever been woken up by a p50.

## What we measure

Latency is recorded at the gateway for every call, not sampled. We keep p50, p90, p99, and the maximum for each API, each day. The number on a listing is the median because that is what people compare on, but the detail page shows the spread, and the status page shows the bad days rather than hiding them.

## What we do not do

We do not exclude errors from latency. A request that failed slowly still cost you the wait. We do not measure from inside our own network either — the figure includes the time to reach us.`,
  },
  {
    slug: "rate-limiting-bursty-clients",
    title: "Rate limiting without punishing bursty clients",
    tag: "Engineering",
    readMinutes: 9,
    excerpt:
      "Sliding windows, token buckets, and why we settled on a hybrid that absorbs a 10x burst without letting a runaway loop drain your quota.",
    body: `Rate limiting is a negotiation between two failure modes. Too strict and you break legitimate traffic that happens to arrive together. Too loose and one bug in a customer's retry loop consumes a month of allowance in an afternoon.

## Fixed windows are the worst of both

A fixed window resets on the minute, so a client can send its full allowance at 59 seconds and again at 61. You have permitted double the rate you advertised, and you did it at exactly the moment you were least prepared.

## What we run

A sliding window for the advertised per-minute limit, and a separate monthly quota that does not reset until the billing period does. The window absorbs a burst; the quota is what you actually bought.

## Failing usefully

A 429 carries Retry-After and the remaining allowance. A limit that does not tell you when to try again is just an error.`,
  },
  {
    slug: "one-error-envelope",
    title: "One error envelope across every provider",
    tag: "Engineering",
    readMinutes: 7,
    excerpt:
      "Normalising upstream failures is unglamorous work. It is also the single thing developers thank us for most.",
    body: `Every API fails differently. One returns 200 with an error field. Another returns 500 for a validation problem. A third returns a bare string.

## The cost of that variety

Handling it is the least interesting code in your codebase, and it is duplicated per vendor. Consolidating four providers behind us removed roughly four hundred lines of vendor-specific error handling from one customer's application.

## The shape

Every response carries a success boolean. Every failure carries a stable machine-readable code, a message written for a human, and a link to the documentation for that code. Status codes mean what the specification says they mean.

## Where it is hard

Some upstreams genuinely cannot distinguish between a bad request and an outage. We map those to a single code and say so in the reference, rather than guessing and being confidently wrong.`,
  },
  {
    slug: "what-a-free-tier-is-for",
    title: "A free tier is not a trial",
    tag: "Product",
    readMinutes: 4,
    excerpt:
      "A trial that expires is a deadline. A free tier that never expires lets you prototype on your own schedule and upgrade when traffic justifies it.",
    body: `Trials optimise for the vendor. They create urgency, and urgency converts. They also mean an engineer evaluating your product is doing it against a clock they did not set.

## What we do instead

Every listing has a tier that does not expire. It is small — a hundred calls a month — but it is permanent, and it is enough to build the whole integration before anyone has to approve a purchase order.

## The trade

We convert more slowly and later. We also stop losing the evaluation that got parked for a fortnight because a sprint went sideways.`,
  },
];
