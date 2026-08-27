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
] as const;

export type Platform = (typeof PLATFORMS)[number];
