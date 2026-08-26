/**
 * Wordmarks for the (fictional) companies in the social-proof strip.
 *
 * Each is an inline SVG so it inherits `currentColor` and stays crisp — a
 * uniform 22px cap height keeps the row optically even despite different
 * glyph widths.
 */
type Mark = { name: string; glyph: string; wordmark: string };

export const brands: Mark[] = [
  {
    name: "Northwind",
    wordmark: "Northwind",
    glyph: "M4 20V4l16 16V4",
  },
  {
    name: "Corvus Bank",
    wordmark: "Corvus",
    glyph: "M20 6c-3 0-5 1.6-6.5 4C12 12.4 9.6 14 6 14c0 4 3 6 7 6 5 0 8-4 8-9 0-2-.4-3.6-1-5zM4 9l4 1",
  },
  {
    name: "Halyard",
    wordmark: "Halyard",
    glyph: "M12 3v18M12 5l8 5-8 5M12 8L6 11l6 3",
  },
  {
    name: "Meridian",
    wordmark: "Meridian",
    glyph: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.4 2.7 3.7 5.7 3.7 9S14.4 18.3 12 21",
  },
  {
    name: "Tessera",
    wordmark: "Tessera",
    glyph: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  },
  {
    name: "Brightloom",
    wordmark: "Brightloom",
    glyph: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  },
  {
    name: "Kite Freight",
    wordmark: "Kite",
    glyph: "M12 2l8 8-8 12L4 10l8-8zM4 10h16M12 2v20",
  },
  {
    name: "Onward",
    wordmark: "Onward",
    glyph: "M3 12h14M13 7l5 5-5 5M20 5v14",
  },
];

export function BrandMark({ brand }: { brand: Mark }) {
  return (
    <span
      className="flex shrink-0 items-center gap-2.5 text-muted/50 transition duration-300 hover:text-ink"
      title={brand.name}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
        className="h-[22px] w-[22px]"
      >
        <path d={brand.glyph} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="whitespace-nowrap text-[17px] font-semibold tracking-tight">
        {brand.wordmark}
      </span>
    </span>
  );
}

/**
 * The strip itself. The list is duplicated so the -50% translation loops
 * seamlessly; the copy is hidden from assistive technology and the whole
 * animation stops for `prefers-reduced-motion`.
 */
export default function BrandMarquee({ label }: { label: string }) {
  return (
    <section aria-label={label} className="overflow-hidden py-12">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>

      <div className="relative mt-7">
        {/* Fade the edges so logos enter and leave instead of clipping. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bg to-transparent" />

        <div className="flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-12 pr-12 motion-reduce:animate-none">
            {brands.map((b) => (
              <BrandMark key={b.name} brand={b} />
            ))}
          </div>
          <div
            aria-hidden
            className="flex shrink-0 animate-marquee items-center gap-12 pr-12 motion-reduce:hidden"
          >
            {brands.map((b) => (
              <BrandMark key={`${b.name}-dup`} brand={b} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
