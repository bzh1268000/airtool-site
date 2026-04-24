"use client";

import Link from "next/link"; // still used for nav links
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, UserRound, Menu, X, LayoutDashboard, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import LanguageSwitcher from "./language-switcher";
import { useCart } from "@/app/context/CartContext";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser]     = useState<any>(null);
  const [role, setRole]     = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { cartCount } = useCart();

  useEffect(() => {
    // getSession() reads from cookies immediately — no network round-trip, no flash.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      else setRole(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single();
    setRole(data?.role ?? "renter");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    router.push("/");
    router.refresh();
  };

  // Fresh live lookup — never depends on stale React state
  const handleDashboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user?.id) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = profile?.role ?? "renter";
      const url =
        role === "admin" ? "/admin"  :
        role === "hub"   ? "/hub"    :
        role === "owner" ? "/owner"  :
        "/renter";
      router.push(url);
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="border-b bg-[#eaf6ff] relative z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">

        <Link href="/" className="text-2xl md:text-3xl font-semibold text-black leading-none">
          AirTool
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 md:flex">
          <Link href="/search"     className="text-sm text-black/70 hover:text-black">Search</Link>
          <Link href="/categories" className="text-sm text-black/70 hover:text-black">Categories</Link>
          <button onClick={() => router.push(user ? "/tools" : "/login?redirect=/tools")} className="text-sm text-black/70 hover:text-black">List Tool</button>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">

          <LanguageSwitcher />

          {/* Cart icon — only when logged in */}
          {user && (
            <button
              onClick={() => router.push("/cart")}
              className="relative flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-black/15 bg-white text-[#23313f] transition hover:bg-black/5"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#8bbb46] text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* People icon — signs out if logged in, goes to login if not */}
          <div className="relative group">
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-[#8bbb46] bg-[#8bbb46] text-white transition hover:bg-[#7aaa39]"
              >
                <UserRound className="h-5 w-5" />
              </button>
            ) : (
              <Link
                href="/login"
                className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full border border-black/15 bg-white text-[#23313f] transition hover:bg-black/5"
              >
                <User className="h-5 w-5" />
              </Link>
            )}
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 z-50">
              {user ? "Sign out here" : "Sign in please"}
            </span>
          </div>

          {/* Dashboard button */}
          <button
            onClick={handleDashboard}
            className="hidden md:flex items-center gap-1.5 rounded-full bg-[#2f641f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#245018]"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center justify-center h-10 w-10 rounded-full border border-black/15 bg-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-black/10 bg-white px-4 py-4 flex flex-col gap-4">
          <Link href="/search"     onClick={() => setMenuOpen(false)} className="text-sm text-black/70 hover:text-black">Search</Link>
          <Link href="/categories" onClick={() => setMenuOpen(false)} className="text-sm text-black/70 hover:text-black">Categories</Link>
          <button onClick={() => { router.push(user ? "/tools" : "/login?redirect=/tools"); setMenuOpen(false); }} className="text-sm text-black/70 hover:text-black">List Tool</button>
          <button
            onClick={() => { handleDashboard(); setMenuOpen(false); }}
            className="flex items-center gap-2 rounded-full bg-[#2f641f] px-4 py-2 text-sm font-semibold text-white w-fit"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>
          {user && (
            <button
              onClick={() => { handleSignOut(); setMenuOpen(false); }}
              className="text-left text-sm text-black/70 hover:text-black"
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
