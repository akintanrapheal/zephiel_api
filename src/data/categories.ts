export type Category = {
  slug: string;
  name: string;
  blurb: string;
  icon: string;
};

export const categories: Category[] = [
  { slug: "finance", name: "Finance & Currency", blurb: "Exchange rates, market data, and payment intelligence.", icon: "M3 17l6-6 4 4 8-8M21 7v5h-5" },
  { slug: "location", name: "Location & Geo", blurb: "IP intelligence, geocoding, timezones, and maps.", icon: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z M12 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" },
  { slug: "communication", name: "Communication", blurb: "Email validation, SMS, and phone number lookup.", icon: "M4 5h16v12H8l-4 3V5z" },
  { slug: "data", name: "Data & Scraping", blurb: "Web scraping, search results, and structured extraction.", icon: "M4 6h16M4 12h16M4 18h10" },
  { slug: "ai", name: "AI & Machine Learning", blurb: "Vision, language, moderation, and generative endpoints.", icon: "M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.8 2.8M14.7 14.7l2.8 2.8M17.5 6.5l-2.8 2.8M9.3 14.7l-2.8 2.8" },
  { slug: "media", name: "Media & Files", blurb: "PDF, image processing, screenshots, and conversion.", icon: "M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4" },
  { slug: "weather", name: "Weather", blurb: "Forecasts, historical climate, and severe alerts.", icon: "M7 18h9a4 4 0 0 0 .6-7.96A6 6 0 0 0 5 11.5 3.25 3.25 0 0 0 7 18z" },
  { slug: "security", name: "Security", blurb: "Threat intel, breach checks, and fraud scoring.", icon: "M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3z" },
];

export const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug);
