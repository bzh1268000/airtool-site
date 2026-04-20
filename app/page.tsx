"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";


type HubRow = {
  id: string;
  name: string;
};

type CategoryRow = {
  id: string;
  name: string;
};

type ToolCard = {
  id: number;
  name: string;
  price_per_day?: number | string | null;
  image_url?: string | null;
  listing_type?: "hub" | "owner" | string | null;
  pickup_hub?: string | null;
  hub_id?: string | null;
  category_id?: string | null;
  city?: string | null;
};

export default function AirToolNZHomepage() {
  const router = useRouter();

  const heroImages = [
    "/grocery.jpg",
    "/sky.jpg",
    "/IMG_20181126_000229_702.jpg",
  ];

  const [currentHero, setCurrentHero] = useState(0);

  const [searchTool, setSearchTool] = useState("");
  const [hubsData, setHubsData] = useState<HubRow[]>([]);
  const [selectedHubId, setSelectedHubId] = useState("");
  const [categoriesData, setCategoriesData] = useState<CategoryRow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const [dbTools, setDbTools] = useState<ToolCard[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHero((prev) => (prev + 1) % heroImages.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  useEffect(() => {
    const savedHubId = localStorage.getItem("preferredHubId");
    if (savedHubId) {
      setSelectedHubId(savedHubId);
    }
  }, []);

  useEffect(() => {
    const loadHubs = async () => {
      const { data, error } = await supabase
        .from("hubs")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      console.log("hubs error", error);

      if (!error && data) {
        setHubsData(data);

        setSelectedHubId((prev) => {
          if (prev) return prev;
          const oxford = data.find((h) => h.name === "Oxford");
          return oxford?.id || data[0]?.id || "";
        });
      }
    };

    loadHubs();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      console.log("categories error", error);

      if (!error && data) {
        setCategoriesData(data);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadTools = async () => {
      setLoadingTools(true);

const { data, error } = await supabase
  .from("tools")
  .select(
    "id, name, price_per_day, image_url, listing_type, hub_id, category_id, city"
  )
  .order("id", { ascending: false });
      console.log("tools error", error);

      if (!error && data) {
        setDbTools(data as ToolCard[]);
      } else {
        setDbTools([]);
      }

      setLoadingTools(false);
    };

    loadTools();
  }, []);

  useEffect(() => {
    if (selectedHubId) {
      localStorage.setItem("preferredHubId", selectedHubId);
    }
  }, [selectedHubId]);

  const selectedHubName =
    selectedHubId === "nearest"
      ? "Explore Tools Near You"
      : `${hubsData.find((hub) => hub.id === selectedHubId)?.name || "Oxford"} Tool Hub`;

  const normalizedSearch = searchTool.trim().toLowerCase();

  const exactMatches = useMemo(() => {
    return dbTools.filter((tool) => {
      const matchName =
        !normalizedSearch ||
        tool.name?.toLowerCase().includes(normalizedSearch);

      const matchCategory =
        !selectedCategoryId || tool.category_id === selectedCategoryId;

      const hubName = hubsData.find((h) => h.id === selectedHubId)?.name?.toLowerCase() || "";
      const matchHub =
        !selectedHubId ||
        selectedHubId === "nearest" ||
        tool.hub_id === selectedHubId ||
        (hubName && tool.city?.toLowerCase() === hubName) ||
        (hubName && (tool as any).suburb?.toLowerCase() === hubName);

      return matchName && matchCategory && matchHub;
    });
  }, [dbTools, normalizedSearch, selectedCategoryId, selectedHubId]);

  const nearbyRest = useMemo(() => {
    const matchedIds = new Set(exactMatches.map((t) => t.id));

    return dbTools.filter((tool) => {
      if (matchedIds.has(tool.id)) return false;

      if (selectedHubId && selectedHubId !== "nearest") {
        return tool.hub_id === selectedHubId;
      }

      return true;
    });
  }, [dbTools, exactMatches, selectedHubId]);

  const displayTools = [...exactMatches, ...nearbyRest].slice(0, 8);

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

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#1b1b1b]">
      <section id="home" className="relative pt-16 md:pt-24">
        <div className="absolute inset-0 z-0">
          {heroImages.map((image, index) => (
            <div
              key={image}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[1800ms] ${
                index === currentHero ? "opacity-100" : "opacity-0"
              }`}
              style={{ backgroundImage: `url('${image}')` }}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(214,234,252,0.42),rgba(244,247,251,0.20))]" />
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(240,246,255,0.35),rgba(255,255,255,0.55))]" />

        <div className="relative z-20 mx-auto max-w-7xl px-4 pb-10 pt-8 md:px-6 md:pb-24 md:pt-28 overflow-visible">
          <div className="mx-auto max-w-4xl text-center overflow-visible">
            <div className="inline-flex rounded-full bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#2f641f] shadow-sm">
              Local tool sharing · New Zealand
            </div>

            <h1 className="mt-6 text-4xl font-semibold md:text-6xl leading-tight">
              Rent tools near you —<br className="hidden md:block" /> or earn from yours
            </h1>

            <p className="mt-3 text-lg text-black/60 font-medium">
              No hassle. We handle bookings &amp; payments.
            </p>

            {/* Owner / Renter split */}
            <div className="mx-auto mt-6 flex max-w-xl gap-3">
            <button
              onClick={() => router.push("/login?redirect=/tools")}
              className="hover:scale-105 transition-transform text-left bg-green-700 text-white px-10 py-6 rounded-2xl shadow-2xl hover:bg-green-800"
            >
              <p className="text-xs mb-1">🔥 Start here</p>
              <p className="text-white text-lg font-semibold">💰 Start earning today</p>
              <p className="text-sm opacity-90 mt-1">List your first tool</p>
            </button>
              <button
                onClick={() => router.push("/search")}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-[#8bbb46]/90 px-5 py-4 text-white hover:bg-[#8bbb46] transition"
              >
                <span className="text-2xl">🔧</span>
                <span className="font-semibold text-sm">Find tools near you</span>
                <span className="text-xs text-white/70">Browse available tools</span>
              </button>
            </div>

            <div className="relative z-[100] mx-auto mt-6 max-w-7xl px-6">
              <div className="grid w-full gap-3 rounded-[24px] bg-white p-4 shadow-lg md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-center">
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

          <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-3">
            {heroImages.map((_, index) => (
              <button
                key={index}
                aria-label={`Show hero image ${index + 1}`}
                onClick={() => setCurrentHero(index)}
                className={`h-2.5 w-10 rounded-full transition ${
                  index === currentHero ? "bg-[#8bbb46]" : "bg-white/65"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8f1] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {normalizedSearch || selectedCategoryId || selectedHubId
                ? "Matched tools + nearby tools"
                : selectedHubId === "nearest"
                ? "Tools near you"
                : `${hubsData.find((hub) => hub.id === selectedHubId)?.name || "Oxford"} tools near you`}
            </h2>
          </div>

          {loadingTools ? (
            <div className="mt-8 text-sm text-black/60">Loading tools...</div>
          ) : displayTools.length === 0 ? (
            <div className="mt-8 text-sm text-black/60">No tools found.</div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {displayTools.map((tool) => (
                <div
                  key={tool.id}
                  className="overflow-hidden border border-black/5 bg-white shadow-sm hover:-translate-y-1 hover:shadow-md transition"
                >
                  <a href={`/tools/${tool.id}`} className="block aspect-[4/3] bg-[#eef2ea] overflow-hidden">
                    <img
                      src={tool.image_url || "/sky.jpg"}
                      alt={tool.name}
                      className="h-full w-full object-cover transition hover:scale-105"
                    />
                  </a>

                  <div className="p-4">
                    <div className="text-lg font-semibold">{tool.name}</div>

                    <div className="mt-2 text-sm text-black/60">
                      {"Local pickup available"}
                    </div>

                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em]">
                      {tool.listing_type === "hub" ? (
                        <span className="bg-green-100 px-2 py-1 text-green-700">
                          Hub pickup
                        </span>
                      ) : (
                        <span className="bg-blue-100 px-2 py-1 text-blue-700">
                          Owner approval
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-semibold text-[#2f641f]">
                        {formatPrice(tool.price_per_day)}
                      </span>

                      <button
                        onClick={() => router.push(`/booking/${tool.id}`)}
                        className="bg-[#8bbb46] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}