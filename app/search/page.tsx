"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type HubRow = { id: string; name: string };
type CategoryRow = { id: string; name: string };

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
  suburb?: string | null;
  city?: string | null;
  pickup_notes?: string | null;
};

const TOOL_SELECT = "id, name, description, price_per_day, promo_price, promo_label, sale_price, image_url, listing_type, hub_id, category_id, status, owner_email, suburb, city, pickup_notes";

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTool     = searchParams.get("tool")  || "";
  const initialCategory = searchParams.get("category") || "";
  const initialHub      = searchParams.get("hub")   || "";
  const initialPromo    = searchParams.get("promo") === "1";

  const [searchTool,         setSearchTool]         = useState(initialTool);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategory);
  const [selectedHubId,      setSelectedHubId]      = useState(initialHub); // no Oxford default
  const [promoOnly,          setPromoOnly]           = useState(initialPromo);

  const [hubsData,       setHubsData]       = useState<HubRow[]>([]);
  const [categoriesData, setCategoriesData] = useState<CategoryRow[]>([]);

  const [matchedTools,       setMatchedTools]       = useState<ToolRow[]>([]);
  const [nearbyWithDistance, setNearbyWithDistance] = useState<{ tool: ToolRow; distanceKm: number }[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [nearbyLoading,      setNearbyLoading]      = useState(false);
  const [reviewStats,        setReviewStats]        = useState<Record<number, { count: number; avg: number }>>({});

  const geocodeCache = useRef<Record<string, { lat: number; lon: number } | null>>({});

  const geocode = async (place: string): Promise<{ lat: number; lon: number } | null> => {
    const key = place.toLowerCase().trim();
    if (key in geocodeCache.current) return geocodeCache.current[key];
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const json = await res.json();
      if (json[0]) {
        const result = { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
        geocodeCache.current[key] = result;
        return result;
      }
    } catch {}
    geocodeCache.current[key] = null;
    return null;
  };

  // ── Load hubs + categories ──────────────────────────────────────────────────
  useEffect(() => {
    const loadFilters = async () => {
      const [{ data: hubs }, { data: cats }] = await Promise.all([
        supabase.from("hubs").select("id, name").eq("is_active", true).order("name"),
        supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
      ]);
      if (hubs) setHubsData(hubs);
      if (cats) setCategoriesData(cats);
    };
    loadFilters();
  }, []);

  // ── Main tool fetch + nearby geocode ───────────────────────────────────────
  useEffect(() => {
    const loadTools = async () => {
      setLoading(true);
      setNearbyWithDistance([]);

      let query = supabase.from("tools").select(TOOL_SELECT).neq("status", "sold");

      if (searchTool.trim())    query = query.ilike("name", `%${searchTool.trim()}%`);
      if (selectedCategoryId)   query = query.eq("category_id", selectedCategoryId);
      if (promoOnly)            query = query.not("promo_price", "is", null);

      const hubName = selectedHubId && selectedHubId !== "nearest"
        ? (hubsData.find((h) => h.id === selectedHubId)?.name || "")
        : "";

      if (hubName) {
        query = query.or(
          `hub_id.eq.${selectedHubId},city.ilike.%${hubName}%,suburb.ilike.%${hubName}%,pickup_notes.ilike.%${hubName}%`
        );
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (!error && data) {
        const tools = data as ToolRow[];
        setMatchedTools(tools);

        // Review stats
        const ids = tools.map((t) => t.id);
        if (ids.length > 0) {
          const { data: revRows } = await supabase
            .from("reviews").select("target_id, rating")
            .in("target_id", ids).eq("target_type", "tool");
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

        // ── Nearby: geocode + sort by distance ─────────────────────────────
        if (hubName) {
          setNearbyLoading(true);
          const hubCoords = await geocode(hubName);

          if (hubCoords) {
            const matchedIds = new Set(tools.map((t) => t.id));

            const { data: allTools } = await supabase
              .from("tools").select(TOOL_SELECT)
              .neq("status", "sold")
              .order("created_at", { ascending: false })
              .limit(60);

            if (allTools) {
              const candidates = (allTools as ToolRow[]).filter((t) => !matchedIds.has(t.id));

              // Batch-geocode unique cities
              const uniquePlaces = [...new Set(
                candidates.map((t) => t.city || t.suburb || "").filter(Boolean)
              )];
              await Promise.all(uniquePlaces.map((p) => geocode(p)));

              const withDist = candidates
                .map((tool) => {
                  const place = (tool.city || tool.suburb || "").toLowerCase().trim();
                  const coords = place ? geocodeCache.current[place] : null;
                  const distanceKm = coords
                    ? haversine(hubCoords.lat, hubCoords.lon, coords.lat, coords.lon)
                    : Infinity;
                  return { tool, distanceKm };
                })
                .filter((x) => x.distanceKm !== Infinity)
                .sort((a, b) => a.distanceKm - b.distanceKm)
                .slice(0, 8);

              setNearbyWithDistance(withDist);
            }
          }
          setNearbyLoading(false);
        }
      } else {
        setMatchedTools([]);
      }

      setLoading(false);
    };

    loadTools();
  }, [searchTool, selectedCategoryId, selectedHubId, promoOnly, hubsData]);

  const selectedHubName = hubsData.find((h) => h.id === selectedHubId)?.name || "";

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchTool.trim())    params.set("tool", searchTool.trim());
    if (selectedCategoryId)   params.set("category", selectedCategoryId);
    if (selectedHubId)        params.set("hub", selectedHubId);
    router.push(`/search?${params.toString()}`);
  };

  const formatPrice = (price?: number | string | null) => {
    if (price === null || price === undefined || price === "") return "Price TBC";
    return `$${price}/day`;
  };

  const ToolCard = ({ tool, distanceKm }: { tool: ToolRow; distanceKm?: number }) => {
    const stats = reviewStats[tool.id];
    const ownerName = tool.owner_email
      ? tool.owner_email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
    const locationLabel = tool.city || tool.suburb || (tool.hub_id ? selectedHubName : null) || "NZ";

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

          <div className="mt-1 flex items-center gap-2 text-sm text-black/60">
            <span>{locationLabel} pickup</span>
            {distanceKm !== undefined && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                📍 {distanceKm < 1 ? "&lt;1" : Math.round(distanceKm)} km away
              </span>
            )}
          </div>

          <button
            onClick={() => router.push(`/tools/${tool.id}/reviews`)}
            className="mt-2 flex items-center gap-1.5 hover:opacity-80 text-left"
          >
            {ownerName && <span className="text-xs font-semibold text-gray-600">{ownerName}</span>}
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

          {tool.description && tool.status !== "for_sale" && (
            <div className="mt-2 line-clamp-2 text-sm text-black/50">{tool.description}</div>
          )}

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
                      <span className="font-bold text-orange-600">Buy: ${Number(tool.promo_price).toFixed(2)}</span>
                      <span className="text-xs text-black/30 line-through">${Number(tool.sale_price).toFixed(2)}</span>
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-600">
                        {tool.promo_label || "PROMO"}
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold text-orange-600">Buy: ${Number(tool.sale_price).toFixed(2)}</span>
                  )}
                  <span className="text-xs text-black/50">Also rentable · {formatPrice(tool.price_per_day)}</span>
                </>
              ) : tool.promo_price ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-600">${Number(tool.promo_price).toFixed(2)}/day</span>
                  <span className="text-xs text-black/40 line-through">{formatPrice(tool.price_per_day)}</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                    {tool.promo_label || "PROMO"}
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-[#2f641f]">{formatPrice(tool.price_per_day)}</span>
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
            <h1 className="mt-5 text-3xl font-semibold md:text-5xl">
              {selectedHubName ? `Tools near ${selectedHubName}` : "All Tools"}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-black/60 md:text-base">
              Search by tool name, category, and pickup area.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-6xl">
            <div className="grid gap-3 rounded-[24px] bg-white p-4 shadow-lg md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-center">
              <input
                type="text"
                placeholder="Search tools..."
                value={searchTool}
                onChange={(e) => setSearchTool(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="h-12 w-full rounded-[22px] px-4 text-[16px] outline-none"
              />

              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="h-12 w-full rounded-[22px] px-4 text-[16px]"
              >
                <option value="">All Categories</option>
                {categoriesData.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <select
                value={selectedHubId}
                onChange={(e) => setSelectedHubId(e.target.value)}
                className="h-12 w-full rounded-[22px] px-4 text-[16px]"
              >
                <option value="">All Areas</option>
                {hubsData.map((hub) => (
                  <option key={hub.id} value={hub.id}>{hub.name}</option>
                ))}
                <option value="nearest">My Location</option>
              </select>

              <button onClick={handleSearch} className="rounded-full bg-[#8bbb46] px-6 py-3 text-white">
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Search results ───────────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {selectedHubName ? `Results in ${selectedHubName}` : "All tools"}
              {!loading && <span className="ml-2 text-base font-normal text-black/40">({matchedTools.length})</span>}
            </h2>
            <button onClick={() => router.push("/")} className="text-sm font-medium text-[#2f641f]">
              Back home
            </button>
          </div>

          {loading ? (
            <div className="mt-8 text-sm text-black/60">Loading tools...</div>
          ) : matchedTools.length === 0 ? (
            <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold">No tools found</div>
              <div className="mt-2 text-sm text-black/60">Try another keyword, category, or area.</div>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {matchedTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── Nearby tools (distance-sorted) ──────────────────────────────────── */}
      {(nearbyLoading || nearbyWithDistance.length > 0) && (
        <section className="pb-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 className="text-2xl font-semibold">Nearby tools</h2>
            <p className="mt-1 text-sm text-black/50">Tools from surrounding areas, sorted by distance.</p>

            {nearbyLoading ? (
              <div className="mt-8 text-sm text-black/40">Finding nearby tools…</div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {nearbyWithDistance.map(({ tool, distanceKm }) => (
                  <ToolCard key={tool.id} tool={tool} distanceKm={distanceKm} />
                ))}
              </div>
            )}
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
