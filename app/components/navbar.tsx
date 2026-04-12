"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, UserRound, Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="border-b bg-[#eaf6ff] relative z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
        
        <Link href="/" className="text-2xl md:text-3xl font-semibold text-black leading-none">
          AirTool
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 md:flex">
          <Link href="/search" className="text-sm text-black/70 hover:text-black">Search</Link>
          <Link href="/categories" className="text-sm text-black/70 hover:text-black">Categories</Link>
          <Link href="/tools" className="text-sm text-black/70 hover:text-black">List Tool</Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href={user ? "/profile" : "/login"}
            className={`flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full border transition ${
              user ? "border-[#8bbb46] bg-[#8bbb46] text-white" : "border-black/15 bg-white text-[#23313f]"
            }`}
          >
            {user ? <UserRound className="h-5 w-5" /> : <User className="h-5 w-5" />}
          </Link>

          {user && (
            <button
              onClick={handleSignOut}
              className="hidden md:block rounded-full border border-black/15 bg-white px-4 py-2 text-sm text-black/70 hover:bg-black/5"
            >
              Sign out
            </button>
          )}

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
          <Link href="/search" onClick={() => setMenuOpen(false)} className="text-sm text-black/70 hover:text-black">Search</Link>
          <Link href="/categories" onClick={() => setMenuOpen(false)} className="text-sm text-black/70 hover:text-black">Categories</Link>
          <Link href="/tools" onClick={() => setMenuOpen(false)} className="text-sm text-black/70 hover:text-black">List Tool</Link>
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