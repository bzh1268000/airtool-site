"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type HubRow = {
  id: string;
  name: string;
};

type CategoryRow = {
  id: string;
  name: string;
};

type ToolRow = {
  id: number;
  name: string;
  description?: string | null;
  price_per_day?: number | string | null;
  promo_price?: number | null;
  promo_label?: string | null;
  sale_price?: number | null;
  image_url?: string | null;
  listing_type?: "hub" | "owner" | string | null;
  hub_id?: string | null;
  category_id?: string | null;
  status?: string | null;
  owner_email?: string | null;
};

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTool = searchParams.get("tool") || "";
  const initialCategory = searchParams.get("category") || "";
  const initialHub = searchParams.get("hub") || "";
  const initialPromoOnly = searchParams.get("promo") === "1";

  const [searchTool, setSearchTool] = useState(initialTool);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategory);
  const [selectedHubId, setSelectedHubId] = useState(initialHub);
  const [promoOnly, setPromoOnly] = useState(initialPromoOnly);

  const [hubsData, setHubsData] = useState<HubRow[]>([]);
  const [categoriesData, setCategoriesData] = useState<CategoryRow[]>([]);

  const [matchedTools, setMatchedTools] = useState<ToolRow[]>([]);
  const [nearbyTools, setNearbyTools] = useState<ToolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewStats, setReviewStats] = useState<Record<number, { count: number; avg: number }>>({});

  useEffect(() => {
    const loadFilters = async () => {
      const [{ data: hubs, error: hubsError }, { data: cats, error: catsError }] =
        await Promise.all([
          supabase
            .from("hubs")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("categories")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
        ]);

      console.log("hubs error", hubsError);
      console.log("categories error", catsError);

      if (!hubsError && hubs) {
        setHubsData(hubs);

        if (!initialHub) {
          const oxford = hubs.find((h) => h.name === "Oxford");
          if (oxford?.id) setSelectedHubId(oxford.id);
        }
      }

      if (!catsError && cats) {
        setCategoriesData(cats);
      }
    };

    loadFilters();
  }, [initialHub]);

  useEffect(() => {
    const loadTools = async () => {
      setLoading(true);

let query = supabase
  .from("tools")
  .select(
    "id, name, description, price_per_day, promo_price, promo_label, sale_price, image_url, listing_type, hub_id, category_id, status, owner_email"
  )
  .neq("status", "sold");

      if (searchTool.trim()) {
        query = query.ilike("name", `%${searchTool.trim()}%`);
      }

      if (selectedCategoryId) {
        query = query.eq("category_id", selectedCategoryId);
      }

      if (selectedHubId && selectedHubId !== "nearest") {
        const hubName = hubsData.find((h) => h.id === selectedHubId)?.name || "";
        if (hubName) {
          query = query.or(
            `hub_id.eq.${selectedHubId},city.ilike.${hubName},suburb.ilike.${hubName}`
          );
        } else {
          query = query.eq("hub_id", selectedHubId);
        }
      }

      if (promoOnly) {
        query = query.not("promo_price", "is", null);
      }

      const { data, error } = await query.order("id", { ascending: false });

      console.log("matched tools error", error);

      if (!error && data) {
        setMatchedTools(data as ToolRow[]);
        // Fetch review stats for visible tools
        const ids = (data as ToolRow[]).map((t) => t.id);
        if (ids.length > 0) {
          const { data: revRows } = await supabase
            .from("reviews")
            .select("target_id, rating")
            .in("target_id", ids)
            .eq("target_type", "tool");
          if (revRows) {
            const stats: Record<number, { count: number; sum: number }> = {};
            (revRows as { target_id: number; rating: number }[]).forEach((r) => {
              if (!stats[r.target_id]) stats[r.target_id] = { count: 0, sum: 0 };
              stats[r.target_id].count++;
              stats[r.target_id].sum += r.rating;
            });
            const computed: Record<number, { count: number; avg: number }> = {};
            Object.entries(stats).forEach(([id, s]) => {
              computed[Number(id)] = { count: s.count, avg: s.sum / s.count };
            });
            setReviewStats(computed);
          }
        }
      } else {
        setMatchedTools([]);
      }

      setLoading(false);
    };

    loadTools();
  }, [searchTool, selectedCategoryId, selectedHubId, promoOnly]);

  useEffect(() => {
    const loadNearbyTools = async () => {
let query = supabase
  .from("tools")
  .select(
    "id, name, description, price_per_day, promo_price, promo_label, sale_price, image_url, listing_type, hub_id, category_id, status, owner_email"
  )
  .neq("status", "sold");

      if (selectedHubId && selectedHubId !== "nearest") {
        const hubName = hubsData.find((h) => h.id === selectedHubId)?.name || "";
        if (hubName) {
          query = query.or(
            `hub_id.eq.${selectedHubId},city.ilike.${hubName},suburb.ilike.${hubName}`
          );
        } else {
          query = query.eq("hub_id", selectedHubId);
        }
      }

      const { data, error } = await query.order("id", { ascending: false }).limit(8);

      console.log("nearby tools error", error);

      if (!error && data) {
        setNearbyTools(data as ToolRow[]);
      } else {
        setNearbyTools([]);
      }
    };

    loadNearbyTools();
  }, [selectedHubId]);

  const nearbyWithoutMatched = useMemo(() => {
    const matchedIds = new Set(matchedTools.map((tool) => tool.id));
    return nearbyTools.filter((tool) => !matchedIds.has(tool.id));
  }, [matchedTools, nearbyTools]);

  const selectedHubName =
    selectedHubId === "nearest"
      ? "Nearby"
      : hubsData.find((hub) => hub.id === selectedHubId)?.name || "Oxford";

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (searchTool.trim()) params.set("tool", searchTool.trim());
    if (selectedCategoryId) params.set("category", selectedCategoryId);
    if (selectedHubId) params.set("hub", selectedHubId);

    router.push(`/search?${params.toString()}`);
  };

  const formatPrice = (price?: number | string | null) => {
    if (price === null || price === undefined || price === "") return "Price TBC";
    return `$${price}/day`;
  };

  const ToolCard = ({ tool }: { tool: ToolRow }) => {
    const stats = reviewStats[tool.id];
    const ownerName = tool.owner_email
      ? tool.owner_email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      : null;
    return (
      <div className="overflow-hidden border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
        <a href={`/tools/${tool.id}`} className="block aspect-[4/3] bg-[#eef2ea] overflow-hidden">
          <img
            src={tool.image_url || "/sky.jpg"}
            alt={tool.name}
            className="h-full w-full object-cover transition hover:scale-105"
          />
        </a>

        <div className="p-4">
          <div className="text-lg font-semibold">{tool.name}</div>

          <div className="mt-1 text-sm text-black/60">
            {`${selectedHubName} pickup`}
          </div>

          {/* Owner name + rating points — clickable to tool ratings page */}
          <button
            onClick={() => router.push(`/tools/${tool.id}/reviews`)}
            className="mt-2 flex items-center gap-1.5 hover:opacity-80 text-left"
          >
            {ownerName && (
              <span className="text-xs font-semibold text-gray-600">{ownerName}</span>
            )}
            {stats ? (
              <>
                <span className="text-xs text-black/30">·</span>
                <span className="flex items-center gap-0.5 text-orange-400 text-xs">
                  {"★".repeat(Math.round(stats.avg))}{"☆".repeat(5 - Math.round(stats.avg))}
                </span>
                <span className="text-xs text-black/40">({stats.count})</span>
              </>
            ) : ownerName ? (
              <span className="text-xs text-black/30">· No ratings yet</span>
            ) : null}
          </button>

          {tool.description && tool.status !== "for_sale" ? (
            <div className="mt-2 line-clamp-2 text-sm text-black/50">
              {tool.description}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
            {tool.listing_type === "hub" ? (
              <span className="bg-green-100 px-2 py-1 text-green-700">Hub pickup</span>
            ) : (
              <span className="bg-blue-100 px-2 py-1 text-blue-700">Owner approval</span>
            )}
            {tool.status === "for_sale" && (
              <span className="bg-orange-100 px-2 py-1 text-orange-700">For Sale</span>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              {tool.status === "for_sale" && tool.sale_price ? (
                <>
                  {tool.promo_price ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-orange-600">
                        Buy: ${Number(tool.promo_price).toFixed(2)}
                      </span>
                      <span className="text-xs text-black/30 line-through">${Number(tool.sale_price).toFixed(2)}</span>
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-600">
                        {tool.promo_label || "PROMO"}
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold text-orange-600">
                      Buy: ${Number(tool.sale_price).toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs text-black/50">
                    Also rentable · {formatPrice(tool.price_per_day)}
                  </span>
                </>
              ) : tool.promo_price ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-600">
                    ${Number(tool.promo_price).toFixed(2)}/day
                  </span>
                  <span className="text-xs text-black/40 line-through">
                    {formatPrice(tool.price_per_day)}
                  </span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                    {tool.promo_label || "PROMO"}
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-[#2f641f]">
                  {formatPrice(tool.price_per_day)}
                </span>
              )}
            </div>

            <button
              onClick={() => router.push(tool.status === "for_sale" ? `/tools/${tool.id}` : `/booking/${tool.id}`)}
              className={`px-3 py-2 text-xs font-semibold text-white ${tool.status === "for_sale" ? "bg-orange-500 hover:bg-orange-600" : "bg-[#8bbb46]"}`}
            >
              {tool.status === "for_sale" ? "View" : "Book"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#1b1b1b]">
      <section className="bg-[linear-gradient(180deg,#e8f1fb_0%,#f7f7f2_100%)] pt-24 pb-10">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="text-center">
            <div className="inline-flex rounded-full bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#2f641f] shadow-sm">
              Search tools from database
            </div>

            <h1 className="mt-5 text-3xl font-semibold md:text-5xl">
              Find tools in {selectedHubName}
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-black/60 md:text-base">
              Search by tool name, category, and pickup hub.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-6xl">
            <div className="grid gap-3 rounded-[24px] bg-white p-4 shadow-lg md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-center">
              <input
                type="text"
                placeholder="Search tools..."
                value={searchTool}
                onChange={(e) => setSearchTool(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="h-12 w-full rounded-[22px] px-4 text-[16px] outline-none"
              />

              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="h-12 w-full rounded-[22px] px-4 text-[16px]"
              >
                <option value="">All Categories</option>
                {categoriesData.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedHubId}
                onChange={(e) => setSelectedHubId(e.target.value)}
                className="h-12 w-full rounded-[22px] px-4 text-[16px]"
              >
                {hubsData.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}
                  </option>
                ))}
                <option value="nearest">Pickup Location</option>
              </select>

              <button
                onClick={handleSearch}
                className="rounded-full bg-[#8bbb46] px-6 py-3 text-white"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Search results</h2>
            <button
              onClick={() => router.push("/")}
              className="text-sm font-medium text-[#2f641f]"
            >
              Back home
            </button>
          </div>

          {loading ? (
            <div className="mt-8 text-sm text-black/60">Loading tools...</div>
          ) : matchedTools.length === 0 ? (
            <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold">No exact match found</div>
              <div className="mt-2 text-sm text-black/60">
                Try another keyword, category, or hub.
              </div>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {matchedTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      </section>

      {nearbyWithoutMatched.length > 0 && (
        <section className="pb-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 className="text-2xl font-semibold">Nearby tools</h2>
            <p className="mt-2 text-sm text-black/60">
              Extra tools from the same hub area.
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {nearbyWithoutMatched.slice(0, 8).map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}