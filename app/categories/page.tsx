"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type JobCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  example_jobs: string[];
  sort_order: number;
};

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<JobCategory[] | null>(null);
  const [searchText, setSearchText] = useState("");

  const FALLBACK_CATEGORIES: JobCategory[] = [
    { id: "1", name: "Plumbing",        slug: "plumbing",        icon: "🔧", sort_order: 1, example_jobs: ["Leaking tap", "Blocked drain", "Toilet running"] },
    { id: "2", name: "Electrical",      slug: "electrical",      icon: "⚡", sort_order: 2, example_jobs: ["Light not working", "Powerpoint fault", "Install ceiling fan"] },
    { id: "3", name: "Garden & Lawn",   slug: "garden",          icon: "🌿", sort_order: 3, example_jobs: ["Mow lawns", "Prune hedges", "Weed garden beds"] },
    { id: "4", name: "Painting",        slug: "painting",        icon: "🎨", sort_order: 4, example_jobs: ["Interior walls", "Exterior weatherboard", "Touch-up trim"] },
    { id: "5", name: "Carpentry",       slug: "carpentry",       icon: "🪚", sort_order: 5, example_jobs: ["Repair deck", "Fix door frame", "Build shelves"] },
    { id: "6", name: "Tiling",          slug: "tiling",          icon: "🏠", sort_order: 6, example_jobs: ["Cracked tile", "Bathroom retile", "Kitchen splashback"] },
    { id: "7", name: "Cleaning",        slug: "cleaning",        icon: "🧹", sort_order: 7, example_jobs: ["House clean", "End of tenancy", "Carpet clean"] },
    { id: "8", name: "Moving & Lifting",slug: "moving",          icon: "📦", sort_order: 8, example_jobs: ["Furniture removal", "Load a trailer", "Piano move"] },
    { id: "9", name: "General Repairs", slug: "general-repairs", icon: "🛠️", sort_order: 9, example_jobs: ["Fix fence", "Patch hole in wall", "Replace door handle"] },
  ];

  useEffect(() => {
    supabase
      .from("job_categories")
      .select("id, name, slug, icon, example_jobs, sort_order")
      .order("sort_order")
      .then(({ data, error }) => {
        console.log("job_categories fetch — data:", data, "error:", error);
        if (data && data.length > 0) {
          setCategories(data as JobCategory[]);
        } else {
          console.log("job_categories returned empty — using fallback. Error:", error?.message);
          setCategories(FALLBACK_CATEGORIES);
        }
      });
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchText.trim()) params.set("q", searchText.trim());
    router.push(`/fix?${params.toString()}`);
  };

  const handleCategoryClick = (slug: string) => {
    const params = new URLSearchParams();
    params.set("category", slug);
    if (searchText.trim()) params.set("q", searchText.trim());
    router.push(`/fix?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#1b1b1b]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#e8f5d0] via-[#f0f8e8] to-[#f7f7f2] px-4 pb-16 pt-28 md:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#2f641f] shadow-sm">
            Free instant quotes
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
            Got something to fix?
          </h1>
          <p className="mt-4 text-lg text-black/60 md:text-xl">
            Tell us what&apos;s wrong — we&apos;ll find the cheapest way to sort it
          </p>

          <div className="mx-auto mt-8 flex max-w-xl gap-3 rounded-2xl bg-white p-2 shadow-lg">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="e.g. leaking tap, overgrown lawn, cracked tile..."
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
            />
            <button
              onClick={handleSearch}
              className="rounded-xl bg-[#8bbb46] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] transition"
            >
              Get Help
            </button>
          </div>
        </div>
      </section>

      {/* Category grid */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <h2 className="mb-8 text-center text-xl font-semibold text-black/60">
          Or browse by category
        </h2>

        {categories === null ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.slug)}
                className="group rounded-2xl border border-black/5 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-[#8bbb46]/40 hover:shadow-md"
              >
                <div className="text-[2.5rem] leading-none">{cat.icon}</div>
                <div className="mt-3 text-base font-bold">{cat.name}</div>
                <div className="mt-2 space-y-0.5">
                  {(cat.example_jobs || []).slice(0, 3).map((ex, i) => (
                    <div key={i} className="text-xs text-black/40">{ex}</div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
