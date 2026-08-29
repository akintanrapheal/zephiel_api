/**
 * The blog archive: posts from 2015 through 2025.
 *
 * Kept separate from the recent posts in posts.ts for the same reason
 * more-apis.ts is separate from apis.ts — one file per batch is easier to edit
 * than one very long one. Both are merged in posts.ts.
 *
 * Each entry carries an explicit publishedAt. The content is written to suit
 * its date: a post from 2015 does not know about TLS 1.3, and a post from 2017
 * talks about preparing for GDPR rather than living with it.
 */
import type { SeedPost } from "./posts";

export const archivePosts: SeedPost[] = [
  // ---------------------------------------------------------------- 2015 --
  {
    slug: "six-vendors-six-invoices",
    title: "Six vendors, six invoices, one very tired developer",
    tag: "Company",
    publishedAt: "2015-02-17",
    readMinutes: 5,
    excerpt:
      "We counted what it actually cost to add a sixth API to a product last year. The integration was the cheap part.",
    body: `We spent most of last autumn adding a sixth external API to a product. The code took two days. Everything around it took seven weeks.

## Where the seven weeks went

There was a vendor evaluation, because nobody wanted to be the person who picked the one that fell over. There was a procurement form, then a second procurement form after the first was returned for a missing cost centre. There was a security questionnaire with a question about fax retention policy. There was a credit card that belonged to someone on holiday.

By the time the key arrived, the feature it was meant to support had been descoped.

## The part that stayed broken

Once it shipped, we had six dashboards. Six invoices arriving on six different days of the month. Six sets of credentials, in three secret stores, two of them in a wiki page nobody was willing to admit existed. When one of the six had an outage, finding out which one meant opening six status pages.

Nobody had designed this. It accumulated, one reasonable decision at a time.

## What we are building

One account. One key. One invoice. A catalogue where the latency number is measured rather than claimed, and a free tier you can prototype against without asking anyone for a credit card.

We have four providers signed and a gateway that mostly works. That is not a marketplace yet. It is enough to find out whether anyone else has the same problem, which is what the next few months are for.

If this sounds like your last quarter, we would like to hear about it.`,
  },
  {
    slug: "why-rest-for-now",
    title: "Why we are building on REST, for now",
    tag: "Engineering",
    publishedAt: "2015-06-09",
    readMinutes: 7,
    excerpt:
      "Boring, ubiquitous, and debuggable with tools every developer already has. The alternatives are more interesting and that is the problem.",
    body: `We have been asked a few times why the gateway speaks plain REST over JSON rather than something more considered. It is a fair question. The answer is that we are optimising for the first ten minutes.

## The first ten minutes

Someone lands on a listing, copies a curl command, pastes it into a terminal, and sees a response. If that works, they keep going. If it requires installing a client library, generating stubs from a schema, or learning a query language first, a meaningful fraction of people stop.

curl, Postman, and a browser address bar all speak REST. That ubiquity is worth more to us right now than elegance.

## What we looked at

SOAP still turns up in enterprise catalogues and we will support it at the edges where a provider only offers it, but nobody is choosing it for a new integration in 2015.

Facebook's GraphQL is the interesting one. The specification came out this spring and the ideas are good — asking for exactly the fields you want solves a real problem with chatty REST endpoints. It is also months old, the tooling is thin outside one company, and we would be asking every provider on the platform to model their data twice. We are watching it rather than betting on it.

Hypermedia and HATEOAS get argued about more than they get used. We link related resources where it helps and do not pretend the API is self-describing.

## What we are strict about

Being unambitious about the protocol means being strict about everything else. Every response is JSON with a top-level success boolean. Errors carry a stable machine-readable code, not just a sentence. Pagination works the same way on every endpoint. Dates are ISO 8601 in UTC, always, with no exceptions for providers who prefer otherwise.

Consistency across forty APIs is the thing we can offer that no individual vendor can. That is where the effort goes.`,
  },
  {
    slug: "first-ten-providers",
    title: "What we learned signing our first ten providers",
    tag: "Company",
    publishedAt: "2015-11-03",
    readMinutes: 6,
    excerpt:
      "The good ones had documentation you could read without logging in. That correlation held better than anything else we measured.",
    body: `We now have ten APIs in the catalogue, which is enough to notice patterns in how the conversations went.

## The documentation tell

The single best predictor of whether a provider would be good to work with was whether we could read their documentation without creating an account. Not the quality of it — just whether it was public.

Providers who hid docs behind a signup wall were, without exception, slower to answer technical questions, vaguer about rate limits, and more likely to describe their uptime as "excellent" rather than as a number. Providers who published everything usually already knew their own p99 and were willing to have it printed next to their listing.

We started asking for the docs link first, before pricing.

## The rate limit conversation

Almost nobody could tell us what happened at their rate limit without checking. Several assumed requests queued. In two cases they were dropped silently, which the provider learned during our evaluation.

We now require a documented, tested answer to one question before a listing goes live: what does a client see on the request that exceeds the limit? A 429 with a Retry-After header is the answer we want. Anything else needs a reason.

## The thing we got wrong

We initially tried to normalise every provider's data model into a house schema. It worked for the first three, produced an unmaintainable translation layer by the sixth, and we abandoned it.

What we normalise now is the envelope — auth, errors, pagination, rate limits, dates. What is inside the data field belongs to the provider. Learning that boundary cost us about a month.

Ten providers is not a marketplace. It is enough to know the shape of the work.`,
  },

  // ---------------------------------------------------------------- 2016 --
  {
    slug: "certificates-cost-nothing-now",
    title: "Certificates cost nothing now, so everything is HTTPS",
    tag: "Engineering",
    publishedAt: "2016-05-24",
    readMinutes: 5,
    excerpt:
      "Let's Encrypt left beta last month. We have moved every endpoint, including the ones nobody would have bothered with before.",
    body: `Let's Encrypt came out of beta in April. We have spent the weeks since moving everything behind it, and the interesting part is not the gateway — that was already TLS — but everything else.

## The endpoints nobody would have paid for

A wildcard certificate used to cost a few hundred a year, which meant a quiet argument every time someone wanted TLS on a staging host, an internal metrics page, or a docs site serving nothing but public text. The argument was always resolved the same way: it is only public text, leave it on port 80.

That reasoning was wrong even when certificates were expensive. Plain HTTP on a docs site means an intermediary can rewrite the curl command a developer is about to paste into their terminal. We were serving example requests over a channel anyone on the same café wifi could edit.

Every host we run now redirects to HTTPS. The staging ones too.

## What actually took the time

Issuing certificates was the easy part. The work was in renewal, because a certificate that expires in ninety days will expire at the worst possible moment unless renewal is boring and automatic.

We renew at sixty days, alert loudly if a renewal fails twice, and treat an expiring certificate as a page-worthy incident rather than a ticket. The failure mode of forgetting is total: the API stops working for everyone at once, and the error the client sees is confusing enough that they will blame their own code first.

## What is next

We are turning on HSTS this quarter, with a short max-age to begin with and a longer one once we are confident nothing is left on plain HTTP. Preload submission comes after that.

None of this is novel work. It is just that the excuse for not doing it disappeared last month.`,
  },
  {
    slug: "against-per-endpoint-pricing",
    title: "The case against per-endpoint pricing",
    tag: "Product",
    publishedAt: "2016-08-30",
    readMinutes: 6,
    excerpt:
      "Charging differently for each endpoint makes your bill unpredictable and quietly teaches developers to write worse code.",
    body: `Several providers we talked to this year price per endpoint: a lookup costs one unit, a batch call costs five, a webhook registration costs three. It sounds fair. It causes two problems that are not obvious until you have lived with it.

## Your bill becomes unforecastable

To predict next month's spend you have to predict the mix of calls your application will make, which depends on user behaviour you do not control. A feature that shifts traffic from a cheap endpoint to an expensive one can double a bill without changing the request count at all.

Finance teams respond to this by asking engineers to estimate, engineers respond by padding, and the padded number becomes the reason the project is not approved.

## It teaches developers to write worse code

If the batch endpoint costs five units and the single-item endpoint costs one, a developer fetching five items will write a loop. The loop is worse for them — five round trips instead of one — and worse for the provider, who now serves five requests. The pricing has taught both sides to do the inefficient thing.

We saw exactly this in an evaluation: a customer had built a per-item loop over an endpoint that accepted a hundred IDs at once, purely because of how the units were counted.

## What we do instead

One call is one call. A batch of a hundred is one call. Where a request is genuinely expensive to serve, that belongs in the rate limit, not in the unit price — the limit shapes traffic without making the invoice unpredictable.

The result is a bill you can forecast by multiplying request volume by a single number, and an API where the efficient way to use it is also the cheap way.

There is a real cost to this. It means we absorb variance that a per-endpoint model would push onto the customer. We think a predictable invoice is worth more than the margin.`,
  },
  {
    slug: "one-region-for-a-year",
    title: "What a year in one region taught us",
    tag: "Engineering",
    publishedAt: "2016-12-06",
    readMinutes: 7,
    excerpt:
      "We ran the whole platform from a single region on purpose. Here is what broke, what did not, and why we are finally moving.",
    body: `The gateway has run from a single region since we started. That was a deliberate decision and, for a year, the right one. It is ending, so this is a good moment to write down what it actually cost.

## Why one region

Multi-region is not a checkbox. It is a data consistency problem, a deployment problem, a debugging problem, and a bill. Doing it early would have meant solving all four while we still did not know whether anyone wanted the product.

Running in one place meant one set of logs, one database, one deploy, and one place to look when something was wrong. For a team of four, that focus was worth more than the availability we gave up.

## What actually broke

Not the region. In twelve months we had no failure attributable to running in a single place.

What broke was latency for anyone far away. A customer in Singapore was paying two hundred milliseconds of round trip before we did any work at all. Our published median was honest for European traffic and quietly misleading for everyone else, which is the kind of thing that erodes trust slowly and then all at once.

## What we changed first

Before adding regions, we made the latency figures location-aware. The number on a listing is now measured from the caller's side, not ours, and we show it broken down rather than as one global median. That was a smaller piece of work than a second region and fixed the more urgent problem, which was that we were telling people something untrue.

## Where we go next

Read traffic moves to a second region in the new year. Writes stay in one place until we have a good answer for consistency, and we would rather have a slow write than an ambiguous one.

The lesson is not that single-region is fine. It is that the failure we spent a year worrying about was not the failure we got.`,
  },

  // ---------------------------------------------------------------- 2017 --
  {
    slug: "gateway-on-http2",
    title: "Moving the gateway to HTTP/2",
    tag: "Engineering",
    publishedAt: "2017-03-15",
    readMinutes: 8,
    excerpt:
      "Multiplexing removed a class of head-of-line blocking we had been working around for two years. It also broke our connection pooling assumptions.",
    body: `The gateway now speaks HTTP/2 to any client that offers it. The specification has been an RFC since 2015 and library support finally caught up enough to make this uneventful. Mostly.

## What we got

Multiplexing is the whole reason to do this. Under HTTP/1.1, a client making twelve concurrent calls opens six connections and queues the rest, because that is the per-host limit browsers and most clients settle on. Those queued requests wait behind whichever of the six is slowest.

We had customers working around this by sharding calls across several hostnames, which is a hack the protocol forced on them. With one connection carrying all twelve streams, that hack is unnecessary and we have told them they can stop.

Header compression matters more than we expected. Our requests carry an auth header, a request ID, and a handful of client hints on every call. Under HPACK those are sent once and referenced afterwards. For chatty clients making small requests, the saving is a meaningful fraction of the bytes.

## What broke

Connection pooling assumptions, everywhere. Our internal metrics counted connections as a proxy for concurrency, which was roughly true under HTTP/1.1 and is nonsense under HTTP/2 — one connection can carry a hundred in-flight streams. Several dashboards showed traffic collapsing on the day we shipped. Traffic had not collapsed.

We also found a client library that advertised HTTP/2 support, negotiated it, and then serialised every request onto a single stream anyway. It was slower than HTTP/1.1. We now test the protocol behaviour of the libraries we recommend rather than trusting the changelog.

## What we did not get

It is not faster for a single request. If you make one call and wait, HTTP/2 does nothing for you beyond the header compression. The wins are all about concurrency, and a customer whose workload is one call per user request will see no change at all.

We turned it on with ALPN negotiation, so HTTP/1.1 clients are unaffected and nobody has to do anything.`,
  },
  {
    slug: "reading-the-gdpr",
    title: "We read the GDPR so you do not have to",
    tag: "Compliance",
    publishedAt: "2017-07-11",
    readMinutes: 9,
    excerpt:
      "Enforcement starts in May 2018. Here is what it actually requires of an API platform, and the four things we are changing now.",
    body: `The General Data Protection Regulation was adopted last year and becomes enforceable on 25 May 2018. There is a lot of consultancy noise about it and comparatively little plain description, so here is ours.

## What it actually is

It is a regulation about personal data — anything that identifies a living person, directly or with a bit of joining. It applies to us because we process data belonging to people in the EU, regardless of where our servers are.

The parts that matter for a platform like ours are the lawful basis for processing, the rights individuals have over their data, the obligation to report breaches within seventy-two hours, and the requirement that processors are bound by contract to the same standards as controllers.

## Controller and processor

This distinction does most of the work and is worth getting right. When you use an API through us, you are generally the controller — you decide why the data is being processed. We are a processor acting on your instructions, and the provider behind the API is usually a sub-processor.

That means you need a data processing agreement with us, we need one with each provider, and you are entitled to know who the sub-processors are. We are publishing that list rather than making people ask.

## The four things we are changing

Data export, so any account can retrieve everything we hold about it without opening a ticket. Data deletion that actually deletes, including from backups within the retention window, rather than setting a flag. Retention limits on request logs, which we have been keeping indefinitely for no better reason than that storage was cheap. And a documented breach process with names against it, because seventy-two hours is not long enough to work out who is responsible.

## What we are not doing

We are not going to email you a consent banner. Consent is one lawful basis among six and it is the wrong one for a B2B contract; the correct basis for most of what we do is performance of a contract or legitimate interest. Vendors telling you that everything needs consent are selling something.

Ten months is more time than it sounds like. We are starting now.`,
  },
  {
    slug: "status-pages-should-show-bad-days",
    title: "Status pages should show the bad days",
    tag: "Engineering",
    publishedAt: "2017-10-26",
    readMinutes: 6,
    excerpt:
      "A wall of green squares is a marketing asset, not a status page. We rebuilt ours to make degradation visible.",
    body: `Our status page was green for four months, including a Tuesday afternoon when a third of requests to two APIs returned errors for nineteen minutes. That is not a monitoring failure. It is a design failure, and it was ours.

## How status pages lie

Most status pages have three states: operational, degraded, and down. A human sets them. Humans are reluctant to set anything other than operational, because doing so is an admission, and there is always an argument available that the incident was partial, or brief, or affected only some customers.

The nineteen-minute incident was all three of those things. It was also nineteen minutes during which our customers' code was failing, and the page told them the problem was on their end.

## What we changed

The status page is now generated from the same measurements as the metrics, with no human in the loop for the automatic part. If the error rate for an API exceeds its threshold for more than sixty seconds, the page says so while it is happening, not after someone has decided how to characterise it.

We show ninety days of history per API as a bar per day, coloured by the worst sustained state that day rather than the average. Averaging is how a bad hour disappears into a good day.

Humans still write the incident notes, because a machine cannot tell you what happened or what changes as a result. But they cannot change the colour of the bar.

## The uncomfortable part

Our page is no longer all green, and it never will be again. Two APIs have visible bad days in the last quarter. We have had exactly one prospect ask about them, and that conversation went better than any conversation we have had about a page full of green squares.

A status page that is always green tells a careful reader only that you are not measuring.`,
  },

  // ---------------------------------------------------------------- 2018 --
  {
    slug: "what-changed-on-25-may",
    title: "What changed for your account on 25 May",
    tag: "Compliance",
    publishedAt: "2018-05-21",
    readMinutes: 7,
    excerpt:
      "GDPR enforcement begins this Friday. Everything we committed to last year has shipped. Here is the short version of what you now have.",
    body: `We wrote about preparing for the GDPR last summer. Enforcement starts on Friday, everything we said we would build is live, and this is the plain description of what that means for your account.

## Your data processing agreement

There is a DPA in your account settings. You do not need to request it, negotiate it, or sign it in a PDF and email it back. It is the same terms for everyone, it names every sub-processor we use, and changes to that list are announced thirty days in advance.

If your legal team needs a signed copy on paper we will do that, but the agreement is in force either way.

## Export and deletion

Any account can export everything we hold: profile, subscriptions, invoices, API keys, and request logs within the retention window. It arrives as a single JSON file, usually within a minute.

Deletion removes the account and its data from the primary store immediately and from backups as those backups age out, which takes at most thirty-five days. We tell you that number rather than claiming deletion is instant, because instant deletion from backups is not a thing anyone does honestly.

## Retention

Request logs are kept for thirty days and then deleted. Previously they were kept forever, because storage was cheap and nobody had asked the question. Aggregate usage counts, which are what your invoice is built from, are kept for seven years for tax reasons and contain no request payloads.

## Breaches

We have a documented process with named owners and a seventy-two hour clock that starts when we become aware, not when we finish investigating. We have not had a reportable breach. If we do, you will hear it from us before you hear it anywhere else.

## What has not changed

Your integration. There is no migration, no new header, no deprecated endpoint. The point of doing this work over ten months rather than three weeks was that Friday should be uneventful for you.`,
  },
  {
    slug: "tls-13-already-shipped",
    title: "TLS 1.3 is finished, and we have already shipped it",
    tag: "Engineering",
    publishedAt: "2018-08-23",
    readMinutes: 6,
    excerpt:
      "RFC 8446 was published this month after four years and twenty-eight drafts. One round trip instead of two, and a much shorter list of things that can go wrong.",
    body: `RFC 8446 was published on 10 August, ending four years and twenty-eight drafts. We had been running a draft version on the gateway since the spring and switched to the final version last week.

## One round trip

The handshake is the headline. TLS 1.2 needs two round trips before any application data moves; 1.3 needs one. On a connection from Lagos to Frankfurt, that is roughly a hundred milliseconds removed from every new connection, before we have done any work.

For a client that holds a connection open, this matters once. For serverless callers that reconnect constantly — an increasingly large share of our traffic — it matters on every invocation, and those are exactly the clients most sensitive to cold latency.

## The shorter list of mistakes

The more valuable change is subtraction. RSA key exchange is gone, so a compromised server key can no longer decrypt recorded traffic from the past. Static Diffie-Hellman is gone. CBC mode ciphers are gone, and with them a decade of padding oracle attacks. Compression is gone, and with it CRIME. Renegotiation is gone.

The set of cipher suites went from hundreds of combinations, most of them bad, to five. It is now genuinely difficult to configure TLS 1.3 insecurely, which is not something anyone could say about 1.2.

## What we did not turn on

0-RTT resumption lets a client send application data in its first packet, which is fast and replayable. An attacker who captures that packet can send it again. That is acceptable for an idempotent GET and dangerous for anything that charges money or changes state.

We have left it off. If we enable it later it will be for specifically marked idempotent endpoints, with replay windows, and never for the whole gateway.

## What you need to do

Nothing. Negotiation is automatic and TLS 1.2 clients are unaffected. We will start talking about deprecating 1.0 and 1.1 next year, and that will come with a long notice period.`,
  },
  {
    slug: "three-years-what-we-got-wrong",
    title: "Three years in: the things we got wrong",
    tag: "Company",
    publishedAt: "2018-12-11",
    readMinutes: 8,
    excerpt:
      "An honest list. The normalisation layer, the pricing page, the region, and the year we spent building for a customer who did not exist.",
    body: `We started in early 2015. Three years is long enough that the early mistakes are safely in the past and short enough that we still remember them clearly.

## The normalisation layer

We tried to translate every provider's response into a single house schema. It felt principled. It produced a translation layer that grew a special case for every new provider and collapsed under its own weight around the sixth.

What survived was the envelope: auth, errors, pagination, rate limits, dates. Those are the same everywhere and always will be. The data inside belongs to the provider, and pretending otherwise cost us a month and a lot of goodwill with the providers whose models we had mangled.

## The pricing page

For most of 2016 our pricing page had five tiers with feature matrices. We believed this gave people choice. What it actually did was make everyone stop and think, and a meaningful number of them stopped and did not resume.

Three tiers, one of them free forever, converted better and generated fewer support tickets. The features we had been using to differentiate tiers were mostly things nobody should have to pay extra for, like being allowed to have more than one API key.

## The enterprise customer who did not exist

We spent most of a year building for a customer profile we had invented: a large organisation with a procurement process, an SSO requirement, and an audit log with configurable retention. We built all of it.

The customers we actually had were teams of three to twelve who wanted a key in ninety seconds and an invoice they could expense. The enterprise features were not wrong, they were early by about four years, and building them first meant a year of not building what our real users were asking for.

## The region

Covered at the time, but it belongs on this list. We ran in one region for a year and worried constantly about the region failing. It never did. What we should have worried about was latency for customers far away from it, which was quietly costing us conversions in Asia the whole time.

## What we would keep

Publishing real numbers. Free tiers that do not expire. Refusing to charge per endpoint. Those were unpopular internally at various points and all three were right.`,
  },

  // ---------------------------------------------------------------- 2019 --
  {
    slug: "keys-that-retire-themselves",
    title: "API keys that retire themselves",
    tag: "Engineering",
    publishedAt: "2019-03-19",
    readMinutes: 7,
    excerpt:
      "The average key in our system had not been rotated since it was created. We made rotation the default rather than a chore.",
    body: `We audited key age last month. The median key had been in use for fourteen months. The oldest was three years old and had been created by an employee of a customer who left that company in 2017.

Nobody involved was careless. Rotation was a task with no deadline, which is a task that does not happen.

## Why rotation is hard

Rotating a key means finding every place it is deployed, updating them all, and confirming nothing broke — and the failure mode is an outage in production. The safe version requires two keys valid at once, which most systems do not support, so people do the unsafe version at the worst possible moment or they do not do it at all.

## What we built

Keys can now have an expiry date, set at creation. The default for new keys is twelve months.

A key approaching expiry generates a notification at thirty days, at seven, and at one, to the account owner and to whoever created it. The dashboard shows age and last-used time on every key, so a key that has not been used in six months is visible as an obvious candidate for deletion rather than a row nobody reads.

Most importantly, an account can hold several active keys at once. Rotation is: create the new key, deploy it, confirm traffic has moved using the per-key usage chart, revoke the old one. Nothing is ever down, and each step is reversible.

## The part that surprised us

The last-used column found more problems than the expiry did. Roughly a fifth of active keys across all accounts had not made a request in ninety days. Those are pure risk with no benefit — credentials that work, sitting in a config file or a wiki page, protecting nothing because nothing uses them.

We now surface unused keys in the dashboard with a suggestion to revoke. Adoption of that suggestion has been much higher than adoption of rotation ever was, presumably because deleting something unused is easy and rotating something load-bearing is frightening.

Existing keys are not expiring automatically. We are not going to break anyone's production to make a point.`,
  },
  {
    slug: "latency-budgets-without-an-sre",
    title: "Latency budgets for teams without an SRE",
    tag: "Engineering",
    publishedAt: "2019-07-30",
    readMinutes: 8,
    excerpt:
      "You do not need error budgets and a reliability org to reason about latency. You need to know what you are spending and where.",
    body: `Most of our customers are teams of three to twelve people. They do not have a reliability engineer and are not going to acquire one. The literature on latency is largely written for organisations that do, which makes it less useful than it should be.

Here is the version that fits on one page.

## Start with the promise

Pick the user-facing thing that matters — a page load, a checkout, a search — and decide what you are willing to promise. Not an average: a number you are willing to be held to most of the time. Six hundred milliseconds at the ninety-fifth percentile is a real promise. "Fast" is not.

That number is your budget. Everything after this is spending it.

## Write down what you are spending

List every network call in the path, with its p95, not its median. Add them up if they are sequential. Take the maximum if they are parallel, then add a little, because parallel calls are only as fast as the slowest and something is always slower than you think.

Most teams doing this for the first time find they are already over budget, and that one call they had not thought about is responsible for a third of it.

## The three moves

There are only three things you can do with a call that costs too much.

Remove it from the path — do the work in the background and show the user something optimistic. Make it concurrent with something else already happening. Or cache it, if the data tolerates being slightly old, which more data does than people admit.

Making the call itself faster is usually not available to you, because it belongs to someone else. That is why we publish p95 and p99 per API rather than a single flattering median: you cannot budget against a number that hides the tail.

## Set a timeout that means something

A timeout longer than your budget is not a timeout, it is a formality. If the promise is six hundred milliseconds and the call has a thirty-second timeout, you have decided that a slow call will break the promise rather than fail. Choose the failure. Timeout at the budget and have a fallback.

The fallback is the part teams skip, and it is the part that turns a slow dependency into a degraded feature rather than a broken page.`,
  },
  {
    slug: "deprecating-tls-10-and-11",
    title: "Deprecating TLS 1.0 and 1.1",
    tag: "Engineering",
    publishedAt: "2019-11-14",
    readMinutes: 5,
    excerpt:
      "Every major browser drops them next year. We are following, with a twelve-month notice period and a list of exactly who is affected.",
    body: `TLS 1.0 is twenty-one years old. It has been deprecated by the PCI Council since 2018, and Chrome, Firefox, Safari and Edge have all announced removal during 2020. We are turning both 1.0 and 1.1 off on the gateway on 1 December 2020.

That is twelve months of notice, which is longer than we need and shorter than someone will want.

## Who this affects

Zero point three per cent of requests in the last thirty days negotiated TLS 1.0 or 1.1. That is not zero, and we know exactly which accounts they belong to.

Every affected account has been emailed individually with the specific keys and source addresses involved, rather than a general announcement that everyone ignores. If you did not get an email, you are not affected, and you can confirm that yourself — the dashboard now shows negotiated TLS version per request in the usage view.

## What is actually wrong with them

TLS 1.0 predates a lot of understanding about how these protocols fail. It is vulnerable to BEAST, its CBC constructions have produced a decade of padding oracle attacks, and it can be downgraded. Mitigations exist for all of these and each one is a workaround for a design that should be retired.

TLS 1.1 fixed the initialisation vector problem and little else. Nobody deploys 1.1 deliberately; it is what you get when a library negotiates down.

## What to do

Almost always, this is a runtime upgrade rather than a code change. Anything running a current version of OpenSSL, .NET, Java 8 or later, or any maintained language runtime already negotiates 1.2 or 1.3 by default.

The systems that genuinely cannot are usually embedded devices or an application server pinned to an ancient runtime for reasons that have nothing to do with TLS. If that is you, tell us — we would rather find a path for you over twelve months than have you discover this on 1 December.`,
  },

  // ---------------------------------------------------------------- 2020 --
  {
    slug: "traffic-in-a-month-nobody-planned-for",
    title: "Traffic patterns in a month nobody planned for",
    tag: "Engineering",
    publishedAt: "2020-04-16",
    readMinutes: 7,
    excerpt:
      "March rearranged our traffic. What broke was not capacity — it was every assumption we had encoded about when load arrives.",
    body: `March was not a normal month for anyone. From an infrastructure position it was interesting in a way we would rather it had not been, and there are a few things worth writing down.

## The shape changed, not just the size

Total volume rose about forty per cent, which capacity handled without drama. The disruptive part was the shape.

Our traffic used to have a clear daily rhythm: a European morning ramp, a midday plateau, an American afternoon peak, and quiet nights. Weekends were roughly a third of weekdays. Every piece of automation we had was tuned to that rhythm — scaling schedules, maintenance windows, the batch jobs that assumed a quiet period existed.

In March the peaks flattened and spread. The quiet night got shorter and the weekend stopped being quiet. None of this broke anything on its own; it broke the things that had assumed otherwise.

## What actually broke

A nightly rollup that had four hours of headroom for years suddenly had ninety minutes, because the traffic it competed with no longer went away. It did not fail, it just started finishing later each night until someone noticed the dashboards were stale by breakfast.

Two scheduled maintenance windows were cancelled because the window no longer existed. We have stopped defining maintenance windows by clock time and now define them by measured load, which is what we should have been doing anyway.

## What did not break

Capacity, autoscaling, and the providers. We had braced for a provider to fall over under sustained load and none did.

The one customer-visible incident was ours: a rate limit tuned for the old shape started rejecting legitimate traffic from a customer whose usage had moved, not grown. We raised it within the hour and then went looking for every other limit set against an assumption about time of day.

## The general lesson

Capacity planning is mostly about magnitude, and magnitude was the easy part. What cost us was every place where a schedule had been quietly encoded as a fact about the world.

We have removed the ones we could find. There are certainly more.`,
  },
  {
    slug: "idempotency-keys-mandatory",
    title: "Idempotency keys, and why we made them mandatory",
    tag: "Engineering",
    publishedAt: "2020-08-05",
    readMinutes: 8,
    excerpt:
      "Every write endpoint now requires one. It is a small imposition that eliminates an entire category of support ticket.",
    body: `As of this month, every endpoint on the gateway that creates or charges something requires an Idempotency-Key header. A request without one is rejected. This is a breaking change, we gave ninety days of notice, and we would do it again.

## The ticket that prompted it

A customer's payment retried on a timeout. The original request had succeeded; the response was lost on the way back. Their code, correctly and sensibly, retried. Two charges.

Finding this took two engineers most of a day across two companies, because from their logs the call failed and from ours it succeeded. Neither party was wrong. The protocol simply has no way to distinguish "did not happen" from "happened, and you did not hear about it."

## What an idempotency key does

The client generates a unique value per logical operation — a UUID is fine — and sends it with the request. We store the result against that key for twenty-four hours. A repeat with the same key returns the stored result rather than performing the operation again.

The retry becomes safe. The client cannot tell whether it was the first attempt or the fourth, which is the point.

## Why mandatory rather than optional

We shipped it as optional first. Adoption after six months was under fifteen per cent, and the accounts that adopted it were the ones who had already been bitten. Everyone else was one lost response away from the same afternoon.

An optional safety mechanism protects the people who already know they need it. Making it required means the developer meets it while writing the integration, when it costs thirty seconds, rather than during an incident.

## The details that matter

The key must be unique per operation, not per request — that is exactly what makes the retry work. Do not derive it from the request body, or two genuinely separate identical charges collapse into one. Generate it when the operation begins and reuse it for every attempt.

We return the original status code on a replay, plus an Idempotent-Replay header so you can tell. And if the same key arrives with a different body, that is a client bug and we return 422 rather than guessing which one you meant.`,
  },
  {
    slug: "five-years-of-free-tiers",
    title: "Five years of free tiers",
    tag: "Product",
    publishedAt: "2020-11-19",
    readMinutes: 6,
    excerpt:
      "We have never put an expiry on a free tier. Here is what that actually costs us and why the number is smaller than people assume.",
    body: `Every API on the platform has had a free tier since 2015, and none of them has ever expired. We get asked about the economics of this often enough that it is worth publishing the actual figures.

## What it costs

Free tier usage is about four per cent of total platform request volume. The marginal cost of serving it is real but small — it is the same infrastructure, sized for peak paid load, absorbing free traffic in the gaps.

The larger cost is support. Free accounts open tickets at a slightly higher rate than paid ones, which makes sense: they are more likely to be someone integrating for the first time. We answer them at the same priority, and that is a deliberate expense rather than an oversight.

## What it returns

Roughly a third of paid accounts had a free tier key for more than sixty days before anyone paid us anything. The median gap between first free call and first invoice is just under four months.

That is the whole argument. Four months is longer than any trial period would have been. Those accounts were evaluating on their own schedule, and a fourteen-day clock would have forced a decision at the point of least information, when the integration was half-built and the value was not yet visible.

## Why not a trial

A trial is a deadline you impose on someone else's project. Projects slip for reasons that have nothing to do with your product — a reorganisation, a launch, a person leaving. When the trial expires mid-slip, the integration is abandoned and rarely resumed, because resuming means going back to procurement.

A free tier that does not expire means the half-finished integration is still there in March when the project restarts.

## The rule we hold to

The free tier has to be enough to build something real. Not a demo — a working feature, at low volume, in production. If a free tier is only enough to run the sample request, it is a trial with extra steps and developers can tell immediately.

Where a provider has pushed back on this, we have generally not listed them.`,
  },

  // ---------------------------------------------------------------- 2021 --
  {
    slug: "webhooks-are-distributed-systems",
    title: "Webhooks are a distributed systems problem",
    tag: "Engineering",
    publishedAt: "2021-05-27",
    readMinutes: 9,
    excerpt:
      "Delivery is the easy part. Ordering, duplicates, and the customer endpoint that is down for six hours are the actual work.",
    body: `Webhooks look like the simple half of an API. You make an HTTP request when something happens. Everything difficult about them is a consequence of that request being made to a machine you do not control.

## Delivery is not the hard part

Sending the POST is trivial. What matters is what happens when it fails, and it will fail: the endpoint is down, or behind a firewall that changed, or returning 200 while silently discarding the body, or slow enough that you cannot tell the difference between processing and hanging.

We retry with exponential backoff for twenty-four hours — roughly a dozen attempts, spreading out. After that the event goes to a dead letter queue you can replay from the dashboard. We do not retry forever, because an endpoint that has been down for a day is not coming back in the next thirty seconds and the retries become an attack on a system already having a bad time.

## Ordering does not survive

Two events generated a millisecond apart will arrive in whatever order the network and the retries produce. If the first delivery fails and the second succeeds, the second arrives first. There is no fix for this that does not involve a queue per destination and head-of-line blocking, which trades one problem for a worse one.

So we do not promise ordering. Every event carries a sequence number and a timestamp, and the correct way to consume them is to treat each as a statement about state at a time, discarding anything older than what you have already applied.

Handlers that assume ordering work fine for months and then corrupt something during the first incident.

## Duplicates are guaranteed

At-least-once is the honest guarantee. Exactly-once delivery over a network is not available to anyone, whatever their marketing says — the acknowledgement can be lost after the work is done, which is the same problem idempotency keys solve on the request side.

Every event has a stable ID. Record the IDs you have processed and ignore repeats. This is five lines of code and it is the difference between a handler that survives an incident and one that double-charges during it.

## Signing

Every delivery carries an HMAC-SHA256 signature over the raw body with a secret only you and we hold, plus a timestamp inside the signed payload so an old delivery cannot be replayed at you.

Verify it against the raw bytes, before parsing. Parsing and re-serialising changes the bytes and the signature will not match, which is a support ticket we have answered many times.`,
  },
  {
    slug: "log4shell-week-from-the-gateway",
    title: "What Log4Shell week looked like from the gateway",
    tag: "Security",
    publishedAt: "2021-12-20",
    readMinutes: 7,
    excerpt:
      "We are not a Java shop, which turned out to be almost irrelevant. Ten days of dependency archaeology and what we changed afterwards.",
    body: `CVE-2021-44228 was published on 10 December. This is what the following ten days involved, written down while it is still fresh.

## The first question was the wrong one

Our first reaction was relief: the gateway is not Java. That relief lasted about an hour, which is how long it took to remember that "our code" and "our attack surface" are different things.

We run a log aggregator with a Java component. Two providers behind APIs on the platform are Java shops. Our CI system had a Java plugin nobody had thought about in two years. None of that is our code and all of it was our problem.

## What we actually did

Day one was inventory, and it was slower than it should have been because we did not have a current dependency list for everything we run. We had one for our applications. We did not have one for the things we had installed and forgotten.

Day two was patching what we controlled and blocking the JNDI lookup patterns at the edge as a stopgap. The stopgap mattered — several of the affected components could not be patched until upstream shipped, which for one of them took four days.

Days three to ten were providers. We contacted every provider on the platform, asked a specific question rather than a general one, and published the answers on the status page as they arrived. Two were affected and both had patched before we asked. One took six days to reply, which told us something useful about them.

## The uncomfortable finding

We had no reliable way to answer "what runs in our infrastructure" without a person going and looking. Every organisation says it has an inventory. Ours was a wiki page eleven months out of date.

## What changed

We generate a software bill of materials for every deployed artefact now, automatically, and we keep them queryable. The next time a CVE lands in something ubiquitous, the inventory question should take minutes rather than a day.

We also added a provider security contact as a listing requirement, with a response time expectation attached. The provider who took six days is aware of why that requirement now exists.

## For customers

No customer data was accessed and no gateway component was vulnerable. We said that on day two and it has not changed. The full timeline is on the status page, including the four days we spent waiting on an upstream patch, because leaving that out would have made us look better than we were.`,
  },

  // ---------------------------------------------------------------- 2022 --
  {
    slug: "per-store-billing",
    title: "Per-store billing, and the customers who asked for it",
    tag: "Product",
    publishedAt: "2022-03-24",
    readMinutes: 7,
    excerpt:
      "Multi-storefront retailers kept asking for something our pricing model could not express. So we changed the model.",
    body: `We have spent seven years insisting that one call is one call and pricing should be a single number multiplied by volume. A category of customer has been patiently explaining why that does not work for them, and they were right.

## The mismatch

A retailer running eleven storefronts across four platforms does not think in requests. They think in stores. Their costs scale with stores, their org chart is arranged by store, and when they add a market they want to know what that market costs — a question our invoice could not answer.

Worse, our model actively penalised the thing they needed most. Keeping eleven storefronts consistent means continuous reconciliation, which is a lot of requests, most of which confirm that nothing has changed. We were charging for diligence.

## What we changed

The Multistore API is priced per connected store per month, with request volume included rather than metered. Add a store, the invoice goes up by one store. Remove it, it goes down.

That is the whole model, and its virtue is that a non-technical person can predict it. The finance team stopped asking engineering to explain line items, which was a recurring cost nobody had counted.

## The part that was harder than pricing

Per-store billing only makes sense if a store is a real object in the system rather than a label. That meant stores needed their own identity: their own API key, their own usage record, their own rate limit, and their own place in the dashboard.

The per-store key turned out to be the feature customers talk about most. When a contractor's engagement ends you rotate one key, and the other ten storefronts do not notice. Under a single account-wide key, that same event means auditing every integration you have ever built.

## What we are not doing

We are not moving anything else to this model. For a lookup API, per-request is the honest unit and per-seat pricing would be arbitrary.

The lesson we take is narrower than "our pricing was wrong". It is that the billing unit should match the unit the customer already manages. For most APIs that is the request. For this one it is the store.`,
  },
  {
    slug: "http3-is-an-rfc",
    title: "HTTP/3 is an RFC now",
    tag: "Engineering",
    publishedAt: "2022-07-14",
    readMinutes: 7,
    excerpt:
      "RFC 9114 landed in June. QUIC fixes the head-of-line blocking that HTTP/2 pushed down a layer rather than solving.",
    body: `RFC 9114 was published in June, five years after the first drafts. We have HTTP/3 running on the gateway behind a flag and will make it the default once we have more data.

## The problem HTTP/2 moved rather than fixed

HTTP/2 gave us multiplexing: many streams over one connection, no more six-connection limit. That solved head-of-line blocking at the HTTP layer.

It did not solve it at the transport layer, because TCP delivers a single ordered byte stream. Lose one packet and every multiplexed stream stalls until it is retransmitted, including the nine that had nothing to do with the lost packet. On a clean network you never notice. On a mobile connection with two per cent loss, HTTP/2 can be measurably worse than HTTP/1.1.

## What QUIC does

QUIC runs over UDP and implements streams itself, so a lost packet stalls only the stream it belonged to. The other nine carry on.

The handshake is also folded together: transport and TLS 1.3 negotiate at once, so a new connection costs one round trip instead of two or three. And connections are identified by a connection ID rather than the four-tuple, which means a client moving from wifi to mobile keeps its connection instead of re-establishing it.

## What we measured

For clients on good fixed connections, nothing worth reporting. Median latency moved by less than the noise.

For clients on lossy networks the difference is substantial — our worst-decile latency for mobile-originated traffic improved by about a third in testing. That is the population the protocol was designed for and the numbers reflect it.

## Why it is not the default yet

UDP is blocked or throttled on a meaningful number of corporate networks, so clients must be able to fall back to HTTP/2 cleanly. Some do this well; some hang for several seconds first, which is worse than never trying.

We are collecting fallback behaviour data before we make it the default. When we do, it will be through Alt-Svc advertisement, so clients opt in on their own timetable and nothing changes for anyone who does not.`,
  },
  {
    slug: "support-ticket-is-part-of-the-product",
    title: "The support ticket is part of the product",
    tag: "Company",
    publishedAt: "2022-11-08",
    readMinutes: 6,
    excerpt:
      "We measure providers on how fast a human answers a technical question. It predicts more about the integration than latency does.",
    body: `We evaluate providers on documentation, latency under load, and support responsiveness. Of the three, support responsiveness has turned out to be the strongest predictor of whether a listing is any good, and it is the one nobody puts on a comparison page.

## What we measure

Twice a quarter, we send each provider a genuine technical question through their normal support channel, from an account they cannot identify as ours. Not a trivial one — something requiring a look at the actual behaviour, like what happens to an in-flight batch when a rate limit is hit halfway through.

We record time to first human response, and whether the answer was correct.

## What it correlates with

Almost everything. Providers who answer a real question within a working day also tend to have accurate documentation, honest rate limit behaviour, and changelogs that mention breaking changes before they ship.

Providers who take a week, or answer with a link to the FAQ that does not address the question, tend to have surprises in every other dimension too. The support queue is where an organisation's actual attitude to its users is visible, because it is the part that cannot be written by a marketing team.

## The one that failed

We delisted a provider last year over this. Their API was fine — good latency, sensible errors, competitive price. Three consecutive test questions went unanswered for more than two weeks, and a customer incident took eleven days to get a reply that turned out to be wrong.

An API that works ninety-nine per cent of the time is a support relationship one per cent of the time. If that one per cent is unreachable, the ninety-nine does not matter.

## Ours

We hold ourselves to the same measure and publish it: median time to first human response on a technical ticket, updated monthly, on the status page. It is currently just over three hours during working days.

It is a number we are occasionally embarrassed by, which is the point of publishing it.`,
  },

  // ---------------------------------------------------------------- 2023 --
  {
    slug: "every-provider-wants-to-sell-an-llm",
    title: "Every provider suddenly wants to sell you a model",
    tag: "Product",
    publishedAt: "2023-04-27",
    readMinutes: 8,
    excerpt:
      "Two thirds of provider conversations this quarter involved a language model. Most of them should not have. Here is how we are deciding what to list.",
    body: `Since the start of the year, a large majority of provider conversations have included a language model somewhere. Some are genuinely useful. Many are an existing product with a chat interface stapled on, and telling them apart has become a significant part of our week.

## The question we ask

Does the model do work the caller could not otherwise do, or does it restate work that already existed?

A document extraction API that reads a scanned invoice and returns structured fields is doing something genuinely hard, and doing it with a model is a reasonable implementation detail. A geocoding API that now accepts "the big Tesco near the station" is solving a real ambiguity problem.

An API that returns the same data as last year, with a paragraph of prose describing it, has added tokens and latency and taken away determinism.

## The three things that change for integrators

Latency goes up by an order of magnitude. A lookup that was forty milliseconds becomes two seconds. That moves it out of the request path and into a background job, which is an architectural change, not a drop-in upgrade — and providers pitching this as a free enhancement rarely mention it.

Output stops being deterministic. The same input can produce different output on Tuesday than it did on Monday. For a display string that is tolerable. For anything you compare, cache, or use as a key, it is not.

Cost per call becomes variable and input-dependent. Our per-request pricing assumes calls cost roughly the same to serve, and token-based pricing breaks that assumption in a way we are still working through.

## How we are listing them

Any listing where a model is in the response path is labelled as such, prominently. Latency figures are measured the same way as everything else, with no allowance for the fact that generation is slow. Where a provider offers both a deterministic and a generative endpoint, we list them separately rather than letting the fast one advertise the slow one.

And we ask what happens when the model is unavailable. A provider whose answer is "the endpoint returns 503" is being honest. A provider who has not considered the question is not ready to be listed.

## What we are not doing

We are not adding a model to Zephiel itself. The gateway's job is to be predictable, and a component whose output varies is a poor fit for the part of the stack everything else depends on.`,
  },
  {
    slug: "rate-limits-and-retries-by-default",
    title: "Rate limits in an era of retries-by-default",
    tag: "Engineering",
    publishedAt: "2023-09-12",
    readMinutes: 7,
    excerpt:
      "Every modern HTTP client retries automatically. Several of them retry badly, and the result looks exactly like an attack.",
    body: `Most HTTP clients now retry by default. That is progress — transient failures should not surface to application code. But several popular clients retry in ways that turn a small problem into a large one, and we see the results at the gateway.

## The pattern

An API has a brief hiccup — a slow query, a deploy, a network blip. Requests take longer than the client's timeout. The client retries. Its retry also times out, because the original request is still running and consuming capacity. It retries again.

Now there are three times the requests, the origin is more loaded than it was, and the thing that would have resolved in four seconds takes four minutes. This is a retry storm and it is entirely self-inflicted, by software that was trying to help.

## What good retry behaviour looks like

Exponential backoff with jitter. Without jitter, every client that failed at the same moment retries at the same moment, and the load arrives as a spike rather than a spread. Jitter is one line and it is the difference between recovery and oscillation.

A retry budget. A client should cap retries as a fraction of total requests — ten per cent is a reasonable ceiling. Beyond that, the correct response is to fail fast rather than to keep hoping.

Respect for Retry-After. We send it on every 429 and every 503. A client that ignores it and applies its own backoff is guessing when it has been told the answer.

And no retries on non-idempotent requests without an idempotency key. A retried POST that creates something creates it twice.

## What we changed on our side

We now return 429 with Retry-After rather than 503 when the cause is load rather than failure, because clients treat those differently and the distinction is real.

We also added a per-key circuit: an account generating a sustained retry storm gets a longer Retry-After and a notification explaining what we are seeing, with the specific key and endpoint. Previously they got throttled and had to work out why.

Nearly every storm we have investigated came from a default configuration nobody chose. The fix is usually four lines in the client setup, and the people involved were always surprised, because their code never said "retry".`,
  },

  // ---------------------------------------------------------------- 2024 --
  {
    slug: "rewrote-the-gateway",
    title: "We rewrote the gateway and nobody noticed",
    tag: "Engineering",
    publishedAt: "2024-02-20",
    readMinutes: 9,
    excerpt:
      "Fourteen months, no maintenance window, no breaking change, and one incident that lasted ninety seconds. The strategy was refusing to do it all at once.",
    body: `The gateway that routed requests for nine years was replaced last month. The work took fourteen months. There was no migration announcement because there was nothing for customers to migrate.

## Why

The original gateway was written when we had ten APIs and assumptions to match: one region, one pricing model, one key per account, request logs kept forever. Every one of those assumptions had been violated by reality and worked around in place. Rate limiting alone had four code paths that were supposed to be equivalent and were not.

It was not slow or unreliable. It was becoming difficult to change safely, which is the failure mode that gets you eventually.

## What we refused to do

We refused to build the new one alongside and cut over. Big-bang rewrites fail in a specific way: the new system is finished according to the plan and then discovers, in production, the six years of undocumented behaviour the old one had accumulated. Some of that behaviour is bugs customers now depend on.

Instead we put the new gateway in front as a pass-through that did nothing, then moved one responsibility at a time behind it: routing, then auth, then rate limiting, then metering, then logging. Each move was independently reversible.

## Shadow traffic

Every stage ran in shadow first. The new component processed a copy of live traffic, its output was compared against the old one, and differences were logged rather than served. We required a week of zero unexplained differences before switching.

That week caught things a test suite never would have. Auth had a case-insensitivity quirk in header parsing that had been there since 2016 and that a handful of customers depended on. Rate limiting had an off-by-one in window boundaries that made limits fractionally more generous than documented, and correcting it would have broken two accounts sitting exactly at the edge. We kept both behaviours and documented them.

## The ninety seconds

One incident. Metering cut over cleanly, then a counter reset in the wrong order on a deploy and about a minute and a half of usage went uncounted for some accounts. We noticed from the shadow comparison, replayed from the request log, and nobody was misbilled.

That is the entire customer-visible impact of the project.

## What we would do differently

Start the shadow comparison earlier. We built three components before adding shadowing, and had to retrofit it. Everything after that was faster, because we stopped guessing whether a change was safe and started measuring it.`,
  },
  {
    slug: "postgres-is-still-the-answer",
    title: "Postgres is still the answer",
    tag: "Engineering",
    publishedAt: "2024-06-11",
    readMinutes: 8,
    excerpt:
      "Nine years, four serious proposals to move part of the workload elsewhere, and one that we actually went through with.",
    body: `We store almost everything in Postgres: accounts, subscriptions, keys, invoices, usage, and until recently every request event. Four times we have seriously proposed moving part of that somewhere more specialised. Once we did it. This is the accounting.

## The three we did not do

A document store for provider response schemas, in 2017. The argument was that schemas vary per provider and relational modelling would be awkward. It would have been, but jsonb columns handle it, they are indexable with GIN, and they do not require a second database with its own backups, its own failover, and its own on-call knowledge.

A dedicated search cluster for the catalogue, in 2019. With forty listings, Postgres full-text search returns results in under ten milliseconds. We would have been operating a search cluster to serve a query over a few hundred rows.

A key-value store for rate limit counters, in 2021. This one was closer — counters are the workload relational databases are worst at, and we did end up putting a cache in front. But the durable record stayed in Postgres, because a rate limit counter that vanishes on failover is a rate limit that does not exist.

## The one we did

Request events. We were writing every gateway call as a row and keeping it forever. By 2022 that table was the largest thing we had by two orders of magnitude, and it made every operation on the database slower — backups, restores, schema changes, vacuum.

The fix was not a different database. It was recognising two workloads in one table: recent events, queried constantly for dashboards, and historical events, queried rarely for billing disputes. Recent events stay in a hot table with a two-day window. Everything older is rolled into daily aggregates and the raw rows are dropped.

The hot table is now small enough to fit in memory. Queries that took eight seconds take forty milliseconds. We did not add a database; we deleted data we were never going to read.

## Why it keeps being the answer

One backup story. One failover story. One set of credentials, one query language, one thing to be woken up about. Every additional datastore is not just its own operational burden but a consistency problem at the boundary.

Postgres will not be the answer forever. It has been the answer for nine years, and every time we proposed leaving, the actual problem turned out to be a schema or a query rather than the database.`,
  },
  {
    slug: "nine-years-of-uptime-reports",
    title: "Nine years of uptime reports and what they taught us about honesty",
    tag: "Company",
    publishedAt: "2024-10-15",
    readMinutes: 7,
    excerpt:
      "We have published every bad month since 2015. The commercial damage we feared has not once materialised.",
    body: `Since 2017 our status page has shown per-API daily history that no human can edit, and since 2015 we have published monthly uptime per API including the bad ones. That decision was contested internally more than once. Nine years of data later, here is what it actually cost.

## The fear

The argument against was straightforward and not stupid: a prospect comparing us to a competitor showing 100% will pick the competitor. We would be punished for measuring honestly while others were rewarded for measuring loosely.

## What happened

In nine years we can identify two deals where published downtime was raised as an objection. Both closed. In both, the conversation moved from the number to what we did about it, and having an incident write-up to point at was worth more than a clean record would have been.

Meanwhile the number of deals where a prospect specifically cited the honest reporting as a reason for choosing us is much larger. We stopped counting properly around 2021, but it was in the dozens by then.

The asymmetry makes sense on reflection. Anyone technical evaluating a platform knows that 100% uptime over a year is not a real number. Publishing it does not build confidence in your reliability; it builds doubt about your measurement.

## The internal effect we did not predict

The bigger benefit was inward. When downtime is published automatically and cannot be edited, the incentive to characterise an incident favourably disappears, because the characterisation does not change the bar on the chart.

That changed how our incident reviews went. We stopped spending the first twenty minutes negotiating whether something counted as an outage and started at what happened and what changes. Removing the ability to argue about the number removed the argument.

## What we would tighten

Our definition of "degraded" was too generous for the first few years. An API returning errors for five per cent of requests was shown as degraded rather than down, and for the customer whose traffic was in that five per cent, it was down.

We tightened the thresholds in 2019 and our historical figures got worse as a result. We did not restate the earlier months, and the seam is visible in the data. That is the honest way to handle it.`,
  },

  // ---------------------------------------------------------------- 2025 --
  {
    slug: "ten-years",
    title: "Ten years",
    tag: "Company",
    publishedAt: "2025-04-08",
    readMinutes: 7,
    excerpt:
      "From four providers and a gateway that mostly worked, to here. The things that turned out to matter were not the things we expected.",
    body: `We registered the company in early 2015 with four signed providers and a gateway that mostly worked. Ten years is an arbitrary milestone but a good excuse to look at what actually mattered.

## What we thought would matter

Breadth of catalogue. We assumed the platform with the most APIs would win and spent 2016 chasing listing count. It was the wrong target — customers do not want four hundred APIs, they want the six they need to be good and to work the same way. We now decline more providers than we accept.

Enterprise features. We built SSO, audit logs and configurable retention in 2017 for customers who did not exist yet. They exist now, so the work was not wasted, but it was four years early and it came out of the budget for things our actual customers were asking for.

## What actually mattered

Consistency of the envelope. One auth header, one error shape, one pagination scheme, one rate limit contract, across everything. It is unglamorous and it is the single most cited reason people give for staying.

Free tiers that do not expire. The median gap between someone's first free call and their first invoice is still around four months. No trial period would have survived that.

Publishing real numbers. Latency percentiles, uptime including bad months, our own support response time. Every one of these was argued against internally and every one has been a net commercial positive.

Answering support tickets like they are part of the product. We measure providers on this and hold ourselves to the same standard, and it has done more for retention than any feature.

## What we got wrong and fixed slowly

The normalisation layer, the five-tier pricing page, a year in a single region worrying about the wrong failure, and seven years of insisting that per-request was the only honest billing unit — until multi-storefront customers patiently explained that for them it was not.

That last one is the pattern worth naming. Most of our mistakes were not bad decisions. They were good decisions we kept applying after the conditions that justified them had changed.

## The next ten

The same, mostly. More providers, refused more often. Numbers published whether or not they flatter us. And a gateway that stays boring, because everything anyone builds on top of us depends on it being the least interesting part of their stack.

Thank you to everyone who has built something on this. Some of you have been here since the first ten providers.`,
  },
  {
    slug: "multistore-one-integration",
    title: "Multistore: one integration, every storefront",
    tag: "Product",
    publishedAt: "2025-09-16",
    readMinutes: 8,
    excerpt:
      "Three years after per-store billing, the API it was built for is our fastest growing listing. What we learned building for retailers.",
    body: `We introduced per-store billing in 2022 for a category of customer our pricing could not express. The Multistore API that came out of that work is now the fastest growing listing on the platform, and the lessons are worth writing down.

## The problem, restated

A retailer with eleven storefronts across four platforms has the same catalogue in eleven places and no reliable way to keep them consistent. Each platform has its own API, its own field names, its own idea of what a product variant is, and its own rate limits.

The work of reconciling them is continuous, unglamorous, and almost always done by a script one person wrote and everyone is afraid to touch. We have seen that script at a dozen companies. It is always the same script.

## What we built

One set of endpoints for catalogue, inventory, orders and pricing, with connectors underneath for each platform. The response shape is identical regardless of what is behind it, which is the entire value — the caller writes one integration instead of four.

What we do not do is pretend the platforms are the same. Where a concept genuinely differs, the field mapping is explicit and configurable rather than guessed at. Our earlier instinct, back in 2015, was to normalise everything into a house schema, and we learned then that it collapses on contact with the sixth provider.

## Per-store identity

Each connected store gets its own API key, its own usage record, its own rate limit, and its own line on the invoice.

The key is the part customers talk about. Rotating credentials for one storefront does not touch the other ten. When a contractor's engagement ends, that is one revocation rather than an audit of every integration.

Per-store usage charts have been unexpectedly valuable for debugging. Several customers have found runaway retry loops in their own code because one store's line on the chart diverged from the rest — a problem their own monitoring had not surfaced.

## What surprised us

Seasonal churn. Retailers connect and disconnect stores far more than we expected — pop-ups, market tests, holiday storefronts. Billing had to follow that gracefully, and disconnecting a store had to preserve its history so reconnecting three months later does not lose anything.

We got that wrong at first. A disconnected store used to lose its usage history, and the first customer to reconnect one in January discovered it in the worst way. History is now retained for twelve months after disconnection, at no charge.

## What is next

More platform connectors, and better conflict resolution when two platforms disagree about the same product. The field mapping handles most cases and the long tail is genuinely hard. That is the work for next year.`,
  },
];
