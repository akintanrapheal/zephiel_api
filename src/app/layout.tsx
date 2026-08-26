import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "Zephiel API — One marketplace for every API you need",
    template: "%s | Zephiel API",
  },
  description:
    "Discover, test, and subscribe to production-ready APIs with a single key, a single bill, and a single dashboard. Free tiers on every listing.",
  keywords: ["api marketplace", "rest api", "developer api", "api keys", "zephiel"],
  openGraph: {
    type: "website",
    siteName: "Zephiel API",
    title: "Zephiel API — One marketplace for every API you need",
    description:
      "Discover, test, and subscribe to production-ready APIs with a single key, a single bill, and a single dashboard.",
  },
  twitter: { card: "summary_large_image" },
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("zephiel-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <Navbar user={user ? { email: user.email, role: user.role } : null} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
