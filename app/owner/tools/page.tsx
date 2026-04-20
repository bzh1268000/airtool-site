"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Tool = {
  id: number;
  name: string | null;
  description: string | null;
  category: string | null;
  price_per_day: number | null;
  image_url: string | null;
  listing_type: string | null;
  status: string | null;
  owner_email: string | null;
  created_at: string | null;
};

export default function OwnerToolsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [listingType, setListingType] = useState("owner_approved");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [locationDetecting, setLocationDetecting] = useState(false);

  const fetchTools = async (email: string) => {
    const { data, error } = await supabase
      .from("tools")
      .select("*")
      .eq("owner_email", email)
      .order("created_at", { ascending: false });

    if (!error) {
      setTools((data as Tool[]) || []);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        setLoading(false);
        return;
      }

      setUserEmail(user.email);
      await fetchTools(user.email);

      // Try profile location first
      const { data: profile } = await supabase
        .from("profiles")
        .select("suburb, city")
        .eq("id", user.id)
        .single();

      if (profile?.suburb || profile?.city) {
        if (profile.suburb) setSuburb(profile.suburb);
        if (profile.city) setCity(profile.city);
      } else if (typeof navigator !== "undefined" && navigator.geolocation) {
        setLocationDetecting(true);
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
                { headers: { "Accept-Language": navigator.language || "en" } }
              );
              const json = await res.json();
              const addr = json.address || {};
              setSuburb(addr.suburb || addr.village || addr.hamlet || "");
              setCity(addr.city || addr.town || addr.state_district || "");
            } catch {
              // silently ignore
            } finally {
              setLocationDetecting(false);
            }
          },
          () => setLocationDetecting(false),
          { timeout: 8000 }
        );
      }

      setLoading(false);
    };

    init();
  }, []);

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!userEmail) {
      setMessage("Please sign in first.");
      return;
    }

    if (!name.trim()) {
      setMessage("Tool name is required.");
      return;
    }

    if (!pricePerDay || Number(pricePerDay) < 0) {
      setMessage("Please enter a valid price.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("tools").insert([
      {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        price_per_day: Number(pricePerDay),
        image_url: imageUrl.trim() || null,
        listing_type: listingType,
        owner_email: userEmail,
        suburb: suburb.trim() || null,
        city: city.trim() || null,
        status: "active",
      },
    ]);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setName("");
    setDescription("");
    setCategory("");
    setPricePerDay("");
    setImageUrl("");
    setListingType("owner_approved");
    setSuburb("");
    setCity("");
    setMessage("Tool listed successfully.");

    await fetchTools(userEmail);
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white/30 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-3xl border border-gray-200 bg-white/15 backdrop-blur-sm">
            <p className="text-gray-600">Loading owner tools...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="rounded-3xl border border-gray-200 bg-white/30 p-6 shadow-sm backdrop-blur-md">
            <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur-md">
        <div className="mb-8 rounded-3xl border border-gray-200 bg-white/15 backdrop-blur-sm">
          <p className="mb-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Owner
          </p>
          <h1 className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur-md">
             My Tools
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Owner: {userEmail || "-"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-gray-200 bg-white/15 backdrop-blur-sm">
              <h2 className="rounded-3xl border border-gray-200 bg-white/30 p-6 shadow-sm backdrop-blur-md">Share a Tool</h2>
              <p className="rounded-3xl border border-gray-200 bg-white/30 p-6 shadow-sm backdrop-blur-md">
                Add a new tool listing for renters to request.
              </p>

              <form onSubmit={handleCreateTool} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Tool Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cordless Drill"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Power Tools"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Price Per Day
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value)}
                    placeholder="50"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Image URL
                  </label>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Suburb</label>
                    <input
                      value={suburb}
                      onChange={(e) => setSuburb(e.target.value)}
                      placeholder={locationDetecting ? "Detecting…" : "e.g. Oxford"}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">City / Region</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={locationDetecting ? "Detecting…" : "e.g. Christchurch"}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-gray-400">📍 Detected from your location — edit if needed</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Listing Type
                  </label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  >
                    <option value="owner_approved">Owner Approved</option>
                    <option value="hub">Hub</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Short description of the tool..."
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create Listing"}
                </button>

                {message ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    {message}
                  </div>
                ) : null}
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-gray-200 bg-white/15 backdrop-blur-sm">
              <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur-md">
                <h2 className="text-2xl font-bold text-gray-900">My Listings</h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                  {tools.length} tools
                </span>
              </div>

              {tools.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                  No tools listed yet.
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.id}
                      className="overflow-hidden rounded-3xl border border-gray-200 bg-white/15 shadow-sm"
                    >
                      <div className="aspect-[4/3] bg-gray-100">
                        {tool.image_url ? (
                          <img
                            src={tool.image_url}
                            alt={tool.name || "Tool image"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-gray-400">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-xl font-bold text-gray-900">
                            {tool.name || "Unnamed Tool"}
                          </h3>
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            {tool.status || "active"}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-gray-500">
                          {tool.category || "Uncategorized"}
                        </p>

                        <p className="mt-4 line-clamp-3 text-sm text-gray-600">
                          {tool.description || "No description"}
                        </p>

                        <div className="mt-5 flex items-center justify-between">
                          <p className="text-lg font-bold text-gray-900">
                            ${Number(tool.price_per_day || 0).toFixed(2)}
                            <span className="text-sm font-medium text-gray-500">
                              {" "}
                              / day
                            </span>
                          </p>

                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            {tool.listing_type || "owner_approved"}
                          </span>
                        </div>

                        <p className="mt-4 text-xs text-gray-400">
                          {tool.created_at
                            ? new Date(tool.created_at).toLocaleString()
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}