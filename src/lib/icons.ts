/**
 * Icon registry for API listings.
 *
 * The database stores the *key*, not the path data, so icons can be restyled
 * everywhere at once and the admin form can offer a picker. Every path is drawn
 * on a 24×24 viewBox with `fill="none"`, `stroke="currentColor"`.
 */
export const apiIcons: Record<string, { label: string; path: string }> = {
  currency: {
    label: "Currency",
    path: "M12 3v18M8.5 7.5h5a2.5 2.5 0 0 1 0 5h-3a2.5 2.5 0 0 0 0 5h5",
  },
  chart: {
    label: "Chart",
    path: "M3 3v18h18M7 15l4-4 3 3 5-6",
  },
  globe: {
    label: "Globe",
    path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
  },
  pin: {
    label: "Map pin",
    path: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  },
  mail: {
    label: "Mail",
    path: "M3 6h18v12H3zM3 7l9 6 9-6",
  },
  phone: {
    label: "Phone",
    path: "M8 3H5a2 2 0 0 0-2 2c0 8.3 6.7 15 15 15a2 2 0 0 0 2-2v-3l-4-2-2 2a13 13 0 0 1-6-6l2-2z",
  },
  message: {
    label: "Message",
    path: "M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z",
  },
  spider: {
    label: "Web scraping",
    path: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  },
  search: {
    label: "Search",
    path: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  },
  building: {
    label: "Company",
    path: "M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 21V10h4v11M8 7h2M8 11h2M8 15h2",
  },
  sparkle: {
    label: "AI",
    path: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9L18 16z",
  },
  scan: {
    label: "Scan / OCR",
    path: "M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M7 12h10",
  },
  translate: {
    label: "Translate",
    path: "M4 5h9M8.5 5v2c0 3.3-2 6.3-4.5 8M6 10.5c1.2 2.6 3.4 4.7 6 5.9M13 21l4.5-10L22 21M15 17.5h5",
  },
  mic: {
    label: "Microphone",
    path: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3",
  },
  image: {
    label: "Image",
    path: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  },
  document: {
    label: "Document",
    path: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4",
  },
  camera: {
    label: "Screenshot",
    path: "M3 7h4l2-2h6l2 2h4v12H3zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  },
  cloud: {
    label: "Weather",
    path: "M7 18h9a4 4 0 0 0 .6-7.96A6 6 0 0 0 5 11.5 3.25 3.25 0 0 0 7 18z",
  },
  leaf: {
    label: "Environment",
    path: "M4 20c0-8 5-14 16-15 0 10-5 15-12 15H4zM8 16c2-4 5-6 8-7",
  },
  shield: {
    label: "Security",
    path: "M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  },
  lock: {
    label: "Lock",
    path: "M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3M12 15v2",
  },
  clock: {
    label: "Clock",
    path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  },
  cart: {
    label: "Cart",
    path: "M3 4h2l2.5 11h10L20 7H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  },
  store: {
    label: "Storefront",
    path: "M4 9h16v11H4zM3 9l2-5h14l2 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM10 20v-5h4v5",
  },
  coins: {
    label: "Coins",
    path: "M9 12a5 3 0 1 0 0-6 5 3 0 0 0 0 6zM4 9v4c0 1.7 2.2 3 5 3s5-1.3 5-3V9M10 16v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-4M15 15a5 3 0 1 0 0-6 5 3 0 0 0 0 6z",
  },
  receipt: {
    label: "Receipt / Tax",
    path: "M6 3v18l2-1.5L10 21l2-1.5L14 21l2-1.5L18 21V3H6zM9 8h6M9 12h6M9 16h3",
  },
  bolt: {
    label: "Bolt",
    path: "M13 3L5 14h6l-2 7 8-11h-6l2-7z",
  },
};

export type ApiIconKey = keyof typeof apiIcons;

export const iconKeys = Object.keys(apiIcons).sort();

export function iconPath(key?: string | null) {
  if (!key) return null;
  return apiIcons[key]?.path ?? null;
}
