/**
 * Storefront platforms the Multistore API can connect.
 *
 * Kept out of the server-actions module: a "use server" file may only export
 * async functions, so a constant exported from there does not survive the
 * client boundary intact.
 */
export const PLATFORMS = [
  "shopify",
  "woocommerce",
  "magento",
  "bigcommerce",
  "wix",
  "squarespace",
  "etsy",
  "amazon",
  "ebay",
  "custom",
] as const;

/** Display labels — "custom" needs more than a capitalised slug. */
export const PLATFORM_LABELS: Record<Platform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  magento: "Magento",
  bigcommerce: "BigCommerce",
  wix: "Wix",
  squarespace: "Squarespace",
  etsy: "Etsy",
  amazon: "Amazon",
  ebay: "eBay",
  custom: "Custom website",
};

export type Platform = (typeof PLATFORMS)[number];
