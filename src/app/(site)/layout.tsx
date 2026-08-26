import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCurrentUser } from "@/lib/auth";

/** Chrome for the public marketplace. The admin area deliberately opts out. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      <Navbar user={user ? { email: user.email, role: user.role } : null} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
