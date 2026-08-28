/**
 * Seed review content, shared by the CLI seeder and the admin console.
 *
 * The standard set is attributed to five demonstration accounts so every
 * listing has something to show; Multistore additionally carries a deep set
 * entered without accounts, the way an administrator would record real
 * testimonials.
 */
export const reviewers = [
  { email: "amara@zephiel.dev", name: "Amara Okonkwo", role: "Engineering Lead" },
  { email: "daniel@zephiel.dev", name: "Daniel Kessler", role: "CTO" },
  { email: "priya@zephiel.dev", name: "Priya Sundaram", role: "Staff Engineer" },
  { email: "tomas@zephiel.dev", name: "Tomas Ferreira", role: "Platform Engineer" },
  { email: "lin@zephiel.dev", name: "Lin Zhao", role: "Backend Developer" },
];

export const reviewBodies = [
  {
    title: "Consistent and quick to integrate",
    body: "Response shapes match the docs exactly, and the free tier covered the whole prototype before anyone had to approve a purchase order.",
  },
  {
    title: "Replaced three vendors",
    body: "One key and one invoice instead of three of each. Support answered a rate-limit question the same afternoon.",
  },
  {
    title: "Good, with room to grow",
    body: "Does what it says and the samples run unmodified. I would like deeper filtering on the batch endpoint.",
  },
  {
    title: "Latency has held up",
    body: "Steady under a hundred milliseconds from eu-west for months, and the status page matched what we actually observed.",
  },
  {
    title: "Solid, unglamorous, reliable",
    body: "It has not surprised us once in six months, which is the highest compliment I can pay a dependency.",
  },
];

type SeedReview = { name: string; role: string; rating: number; body: string };

export const multistoreReviews: SeedReview[] = [
  { name: "Chidi Nwosu", role: "Head of Engineering", rating: 5, body: "We run seven storefronts across three platforms. Before this, inventory drifted between them constantly and someone reconciled it by hand every Monday. That job no longer exists." },
  { name: "Sarah Whitfield", role: "Founder", rating: 5, body: "The per-store key model is what sold it. When a contractor left we rotated one key instead of auditing every integration we had ever built." },
  { name: "Marcus Adeyemi", role: "Lead Developer", rating: 5, body: "Pushing a price change to every channel used to mean four separate admin logins. It is one call now, and it lands in seconds." },
  { name: "Elena Rossi", role: "Product Manager", rating: 4, body: "Overselling was our biggest support cost. Continuous reconciliation cut it to almost nothing within a fortnight of switching over." },
  { name: "Kwame Boateng", role: "Integrations Lead", rating: 5, body: "The unified order queue is the part I did not expect to care about. Our fulfilment team works one list instead of tabbing between platforms." },
  { name: "Yuki Tanaka", role: "Backend Engineer", rating: 5, body: "Setup took an afternoon. The connectors handled the field mapping quirks between Shopify and WooCommerce that I had budgeted a week for." },
  { name: "Fatima Bello", role: "Operations Director", rating: 5, body: "Billing per store is honest and predictable. We add a market, we pay for a market, and the invoice matches what I expected." },
  { name: "James O'Connor", role: "CTO", rating: 5, body: "Migrating a store between platforms would have been a month of work. We ran both in parallel through the same API and cut over quietly." },
  { name: "Ngozi Eze", role: "Ecommerce Manager", rating: 5, body: "Documentation is accurate, which sounds like a low bar until you have integrated something where it is not." },
  { name: "Ravi Menon", role: "Solutions Architect", rating: 4, body: "Latency has been steady even during our Black Friday peak, when both upstream platforms were visibly struggling." },
  { name: "Hannah Lindqvist", role: "Platform Lead", rating: 5, body: "The sandbox status on a store is genuinely useful — we stage catalogue changes without touching live inventory." },
  { name: "Tunde Alabi", role: "Technical Director", rating: 5, body: "Support answered a webhook ordering question in under two hours with an actual explanation rather than a link to the FAQ." },
  { name: "Grace Mwangi", role: "Head of Retail Tech", rating: 5, body: "We had a stock sync bug on our side, and the per-store call charts made it obvious within minutes which storefront was misbehaving." },
  { name: "Pieter de Vries", role: "Staff Engineer", rating: 5, body: "Nine stores, one integration, one invoice. The finance team stopped asking me what half the line items were." },
  { name: "Aisha Suleiman", role: "Digital Lead", rating: 3, body: "Would like richer conflict resolution when two platforms disagree about a product. The field mapping covers most of it, but not all." },
  { name: "Carlos Mendez", role: "Engineering Manager", rating: 5, body: "The API returns the same shapes regardless of which platform is behind it. That consistency is the whole value." },
  { name: "Blessing Okafor", role: "Systems Analyst", rating: 5, body: "Disconnecting a seasonal store and reconnecting it three months later kept its history intact. Small thing, saved a reconciliation." },
  { name: "Sofia Almeida", role: "Developer", rating: 5, body: "Our Etsy and Amazon listings finally match the main catalogue without a nightly script nobody wanted to maintain." },
  { name: "Ibrahim Diallo", role: "Head of Product", rating: 4, body: "Rate limits are generous enough that our hourly full sync never comes close to them." },
  { name: "Mei Chen", role: "Integration Engineer", rating: 5, body: "It does one thing and does it properly. I have no complaints after eight months in production." },
  { name: "Olamide Fashola", role: "Retail Systems Lead", rating: 5, body: "Onboarding a new franchise store is now a form rather than a project." },
  { name: "Anna Kowalski", role: "Senior Developer", rating: 5, body: "The order webhooks are reliable enough that we retired our polling job entirely." },
  { name: "Emeka Obi", role: "Technical Lead", rating: 5, body: "Catalogue push handled forty thousand SKUs without complaint. I expected to have to batch it myself." },
  { name: "Laura Bennett", role: "Director of Engineering", rating: 5, body: "Honestly the best integration decision we made last year." },
  { name: "Samuel Adeniyi", role: "Head of Commerce", rating: 4, body: "Took us two attempts to get the custom field mapping right, but once it was set it has not needed touching." },
  { name: "Nadia Haddad", role: "Principal Engineer", rating: 5, body: "The store-level usage chart caught a runaway retry loop in our own code before our monitoring did." },
  { name: "Peter Osei", role: "Operations Lead", rating: 5, body: "We connect and disconnect pop-up stores seasonally. Billing follows the store count without anyone raising a ticket." },
  { name: "Isabella Ferreira", role: "Software Engineer", rating: 5, body: "Clean errors. When something upstream is down it says which store and why, rather than a generic 500." },
  { name: "Yusuf Abdullahi", role: "CTO", rating: 5, body: "Replaced a home-grown sync service that two engineers maintained. They are both doing more useful work now." },
  { name: "Clara Nkemdirim", role: "Engineering Lead", rating: 5, body: "Rotating a store key takes one click and does not interrupt the other eight. That alone justified the migration." },
];
