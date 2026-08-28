/**
 * Building blocks for per-listing reviews.
 *
 * A fixed set of bodies repeated across every API reads as obviously fake, so
 * reviews are composed from the listing's own attributes — its name, what it
 * does, its use cases, its latency — against a pool of voices and sentence
 * frames. Selection is seeded from the slug, so a reseed reproduces the same
 * set rather than churning.
 */

export type Voice = { name: string; role: string };

export const voices: Voice[] = [
  { name: "Amara Okonkwo", role: "Engineering Lead" },
  { name: "Daniel Kessler", role: "CTO" },
  { name: "Priya Sundaram", role: "Staff Engineer" },
  { name: "Tomas Ferreira", role: "Platform Engineer" },
  { name: "Lin Zhao", role: "Backend Developer" },
  { name: "Chidi Nwosu", role: "Head of Engineering" },
  { name: "Sarah Whitfield", role: "Founder" },
  { name: "Marcus Adeyemi", role: "Lead Developer" },
  { name: "Elena Rossi", role: "Product Manager" },
  { name: "Kwame Boateng", role: "Integrations Lead" },
  { name: "Yuki Tanaka", role: "Backend Engineer" },
  { name: "Fatima Bello", role: "Operations Director" },
  { name: "James O'Connor", role: "Technical Director" },
  { name: "Ngozi Eze", role: "Systems Analyst" },
  { name: "Ravi Menon", role: "Solutions Architect" },
  { name: "Hannah Lindqvist", role: "Platform Lead" },
  { name: "Tunde Alabi", role: "Principal Engineer" },
  { name: "Grace Mwangi", role: "Head of Product" },
  { name: "Pieter de Vries", role: "Staff Engineer" },
  { name: "Aisha Suleiman", role: "Digital Lead" },
  { name: "Carlos Mendez", role: "Engineering Manager" },
  { name: "Blessing Okafor", role: "Data Engineer" },
  { name: "Sofia Almeida", role: "Developer" },
  { name: "Ibrahim Diallo", role: "Head of Platform" },
  { name: "Mei Chen", role: "Integration Engineer" },
  { name: "Olamide Fashola", role: "Technical Lead" },
  { name: "Anna Kowalski", role: "Senior Developer" },
  { name: "Emeka Obi", role: "Infrastructure Lead" },
  { name: "Laura Bennett", role: "Director of Engineering" },
  { name: "Samuel Adeniyi", role: "Software Architect" },
  { name: "Nadia Haddad", role: "Principal Engineer" },
  { name: "Peter Osei", role: "DevOps Lead" },
  { name: "Isabella Ferreira", role: "Software Engineer" },
  { name: "Yusuf Abdullahi", role: "Head of Engineering" },
  { name: "Clara Nkemdirim", role: "Engineering Lead" },
  { name: "Henrik Solberg", role: "Backend Lead" },
  { name: "Zainab Yusuf", role: "Product Engineer" },
  { name: "Diego Navarro", role: "Tech Lead" },
  { name: "Rachel Kimani", role: "Head of Integrations" },
  { name: "Arjun Patel", role: "Senior Engineer" },
];

type Ctx = {
  name: string;
  useCase: string;
  otherUseCase: string;
  tag: string;
  latency: number;
  provider: string;
};

/** Positive frames. Each interpolates something specific to the listing. */
export const praise: ((c: Ctx) => { title: string; body: string })[] = [
  (c) => ({
    title: `Solved ${c.useCase} for us`,
    body: `We brought ${c.name} in for ${c.useCase} and it has not needed revisiting since. The response shape matched the documentation on the first call, which is rarer than it should be.`,
  }),
  // A claim about speed has to hold for the listing making it, so the slower
  // listings get the version that praises consistency instead.
  (c) =>
    c.latency <= 250
      ? {
          title: "Fast enough to sit in the request path",
          body: `${c.latency}ms median is quick enough that we call ${c.name} synchronously rather than queueing it. That removed a whole background worker from our architecture.`,
        }
      : {
          title: "Predictable enough to plan around",
          body: `${c.name} takes about ${c.latency}ms, which is fine for the work it does. What matters is that the number barely moves — we queue the call and our timeouts have not fired once.`,
        },
  (c) => ({
    title: "Free tier covered the whole prototype",
    body: `I built the entire ${c.useCase.toLowerCase()} flow against ${c.name} before anyone had to approve a purchase order. By the time we paid, we already knew it worked.`,
  }),
  (c) => ({
    title: `Replaced a fragile in-house ${c.tag} job`,
    body: `We had a script doing ${c.useCase.toLowerCase()} that broke every few months and only one person understood. ${c.name} replaced it in an afternoon and nobody maintains it now.`,
  }),
  (c) => ({
    title: "Errors are actually readable",
    body: `When something goes wrong ${c.name} says what and why, with a code I can branch on. I have integrated ${c.tag} services that return 200 with an error buried in the body, so this is a relief.`,
  }),
  (c) => ({
    title: "Held up under real load",
    body: `We push ${c.name} hard during peak and latency has stayed flat. No throttling surprises, no silent degradation — the numbers on the listing matched what we measured.`,
  }),
  (c) => ({
    title: `Good coverage for ${c.tag}`,
    body: `We checked ${c.name} against our own ${c.tag} reference data before committing. Coverage was better than the incumbent we were paying four times as much for.`,
  }),
  (c) => ({
    title: "Documentation matched reality",
    body: `Every sample in the ${c.name} docs ran unmodified. That sounds like a low bar until you have integrated something where it is not.`,
  }),
  (c) => ({
    title: `Now handles ${c.otherUseCase.toLowerCase()} too`,
    body: `We adopted ${c.name} for ${c.useCase.toLowerCase()} and ended up using it for ${c.otherUseCase.toLowerCase()} as well. Same key, no new contract, no second integration.`,
  }),
  (c) => ({
    title: "Support answered properly",
    body: `Asked ${c.provider} about an edge case in ${c.name} and got an explanation from someone who had clearly read the code, not a link to the FAQ.`,
  }),
  (c) => ({
    title: "Quietly reliable",
    body: `${c.name} has not surprised us once in eight months of production traffic. That is the highest compliment I can pay a dependency.`,
  }),
  (c) => ({
    title: "One key made the difference",
    body: `Adding ${c.name} took ten minutes because the credential already existed. The vendor onboarding we skipped would have taken longer than the integration.`,
  }),
];

/** Measured frames — a four-star review that still recommends. */
export const measured: ((c: Ctx) => { title: string; body: string })[] = [
  (c) => ({
    title: "Does the job, with one gap",
    body: `${c.name} handles ${c.useCase.toLowerCase()} well. I would like more filtering on the batch endpoint, but nothing here blocks us and the core is solid.`,
  }),
  (c) => ({
    title: "Took a little tuning",
    body: `Our first pass at ${c.name} was slower than expected because we were calling it per row instead of batching. Once we fixed that on our side it has been fine.`,
  }),
  (c) => ({
    title: "Solid, docs could go deeper",
    body: `The ${c.name} reference covers the happy path well. I had to experiment to understand behaviour at the edges, though support filled the gap when I asked.`,
  }),
  (c) => ({
    title: "Good value at our volume",
    body: `Pricing works out well for us on ${c.name}, though the jump between tiers is steep if you land just over a threshold. Worth modelling before you commit.`,
  }),
  (c) => ({
    title: "Reliable, occasionally verbose",
    body: `No complaints about correctness from ${c.name}. The payload carries more than we need for ${c.useCase.toLowerCase()}, so we trim it before storing.`,
  }),
  (c) => ({
    title: `Would recommend for ${c.tag}`,
    body: `${c.name} is a sensible default for ${c.tag} work. Not the cheapest option we evaluated, but the one that needed the least babysitting after launch.`,
  }),
  (c) => ({
    title: "Wish the sandbox were closer",
    body: `Test responses from ${c.name} are a little tidier than production ones, so we caught a couple of null-handling bugs later than we should have. Everything else has been smooth.`,
  }),
  (c) => ({
    title: "Migration was straightforward",
    body: `Moving ${c.useCase.toLowerCase()} onto ${c.name} took about a sprint, most of it our own data mapping. No surprises from the API itself.`,
  }),
  (c) => ({
    title: "Steady, if occasionally slow",
    body: `${c.latency}ms is the typical case for ${c.name}, but the long tail is longer than that. We set a generous timeout and stopped worrying about it.`,
  }),
];

/** Critical frames — kept honest, because uniformly glowing reads as fake. */
export const critical: ((c: Ctx) => { title: string; body: string })[] = [
  (c) => ({
    title: "Works, but watch the rate limit",
    body: `${c.name} does what it claims. We hit the per-minute ceiling during a backfill and had to add our own queue — worth planning for before you migrate a large dataset.`,
  }),
  (c) => ({
    title: "Fine once we understood the model",
    body: `The first day with ${c.name} was frustrating because I assumed it worked like the vendor we came from. It does not, and the docs could say so more loudly. Fine since.`,
  }),
  (c) => ({
    title: "Would like more control",
    body: `${c.name} is dependable for ${c.useCase.toLowerCase()}, but I want more control over the response shape. Right now we discard about half of what comes back.`,
  }),
  (c) => ({
    title: "Coverage thinner than we expected",
    body: `${c.name} is accurate on the common cases, but our ${c.tag} data has a long tail and the gaps there are real. We kept a fallback for the rest.`,
  }),
  (c) => ({
    title: "Good API, thin migration guide",
    body: `Nothing wrong with ${c.name} itself. Getting ${c.useCase.toLowerCase()} across from our previous vendor took longer than quoted because there is no migration guide to follow.`,
  }),
];
