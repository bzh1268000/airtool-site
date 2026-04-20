"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { NZ_LOCATIONS } from "@/lib/nz-locations";

const TOOL_CATEGORIES = [
  "Garden & Outdoor", "Power Tools", "Hand Tools", "Cleaning",
  "Construction", "Automotive", "Plumbing", "Electrical",
  "Ladders & Scaffolding", "Other",
];

const CONDITIONS: { stars: number; label: string; desc: string }[] = [
  { stars: 5, label: "Brand New",  desc: "Never or barely used, in original condition" },
  { stars: 4, label: "Like New",   desc: "Excellent shape, minimal signs of use" },
  { stars: 3, label: "Good",       desc: "Normal wear, works perfectly" },
  { stars: 2, label: "Fair",       desc: "Visible wear but fully functional" },
  { stars: 1, label: "Well Used",  desc: "Heavy use, may have cosmetic marks" },
];

const PHOTO_KEYS = ["image_url", "image_url_2", "image_url_3"] as const;

export default function ListToolPage() {
  const router = useRouter();
  const [authReady, setAuthReady]     = useState(false);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  // Form fields
  const [name, setName]                           = useState("");
  const [location, setLocation]                   = useState("");
  const [category, setCategory]                   = useState("");
  const [listingType, setListingType]             = useState("owner_approved");
  const [pricePerDay, setPricePerDay]             = useState("");
  const [deposit, setDeposit]                     = useState("");
  const [salePrice, setSalePrice]                 = useState("");
  const [brand, setBrand]                         = useState("");
  const [model, setModel]                         = useState("");
  const [conditionStars, setConditionStars]       = useState<number | null>(null);
  const [forSale, setForSale]                     = useState(false);
  const [description, setDescription]             = useState("");
  const [usageNotes, setUsageNotes]               = useState("");
  const [pickupNotes, setPickupNotes]             = useState("");
  const [includedAccessories, setIncludedAccessories] = useState("");

  // Media
  const [photoFiles, setPhotoFiles]   = useState<(File | null)[]>([null, null, null]);
  const [photoPreviews, setPhotoPreviews] = useState<(string | null)[]>([null, null, null]);
  const [videoFile, setVideoFile]     = useState<File | null>(null);
  const photoInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const videoInputRef  = useRef<HTMLInputElement | null>(null);

  // Status
  const [saving, setSaving]       = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const [error, setError]         = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) { router.replace("/login?redirect=/tools"); return; }
      setUserEmail(user.email);
      setUserId(user.id);
      setAuthReady(true);

      // Prefill location from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("suburb, city")
        .eq("id", user.id)
        .single();

      const meta = user.user_metadata || {};
      const suburb = profile?.suburb || meta.suburb || "";
      const city   = profile?.city   || meta.city   || "";
      if (suburb) setLocation(suburb);
      else if (city) setLocation(city);
    });
  }, [router]);

  const pickPhoto = (slot: number, file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoFiles((prev) => { const n = [...prev]; n[slot] = file; return n; });
    setPhotoPreviews((prev) => { const n = [...prev]; n[slot] = url; return n; });
  };

  const removePhoto = (slot: number) => {
    setPhotoFiles((prev) => { const n = [...prev]; n[slot] = null; return n; });
    setPhotoPreviews((prev) => { const n = [...prev]; n[slot] = null; return n; });
  };

  const getOrCreateHub = async (name: string): Promise<string | null> => {
    if (!name.trim()) return null;
    const { data: existing } = await supabase
      .from("hubs").select("id").ilike("name", name.trim()).single();
    if (existing) return existing.id;
    const { data: created } = await supabase
      .from("hubs").insert({ name: name.trim(), is_active: true }).select("id").single();
    return created?.id ?? null;
  };

  const uploadFile = async (path: string, file: File) => {
    const { error } = await supabase.storage.from("tool-images").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return supabase.storage.from("tool-images").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Tool name is required."); return; }
    if (!pricePerDay || Number(pricePerDay) < 0) { setError("Please enter a valid daily price."); return; }
    if (!conditionStars) { setError("Please rate the tool condition."); return; }
    if (!photoFiles[0]) { setError("Please add at least one photo (main photo is required)."); return; }
    if (forSale && !salePrice) { setError("Please enter a sale price."); return; }

    setSaving(true);
    const conditionLabel = CONDITIONS.find((c) => c.stars === conditionStars)?.label ?? null;

    // ── Step 1: resolve hub (find or auto-create) ─────────────────────────────
    setSavingStep("Setting location…");
    const resolvedHubId = await getOrCreateHub(location);

    // ── Step 2: insert tool ───────────────────────────────────────────────────
    setSavingStep("Creating listing…");
    const { data, error: dbError } = await supabase
      .from("tools")
      .insert([{
        name: name.trim(),
        category: category || null,
        listing_type: listingType,
        hub_id: resolvedHubId,
        price_per_day: Number(pricePerDay),
        deposit: deposit ? Number(deposit) : null,
        sale_price: salePrice ? Number(salePrice) : null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        condition: conditionLabel,
        description: description.trim() || null,
        usage_notes: usageNotes.trim() || null,
        pickup_notes: pickupNotes.trim() || null,
        included_accessories: includedAccessories.trim() || null,
        owner_email: userEmail,
        status: forSale ? "for_sale" : "active",
      }])
      .select("id")
      .single();

    if (dbError) { setError(dbError.message); setSaving(false); setSavingStep(""); return; }
    const toolId = (data as { id: number }).id;

    // ── Step 3: upload photos ─────────────────────────────────────────────────
    const mediaUpdate: Record<string, string> = {};
    const filledPhotos = photoFiles.map((f, i) => ({ file: f, key: PHOTO_KEYS[i] })).filter((x) => x.file);
    if (filledPhotos.length > 0) {
      setSavingStep(`Uploading ${filledPhotos.length} photo${filledPhotos.length > 1 ? "s" : ""}…`);
      for (const { file, key } of filledPhotos) {
        try {
          const ext  = file!.name.split(".").pop() || "jpg";
          const path = `${userId}/${toolId}/${key}-${Date.now()}.${ext}`;
          mediaUpdate[key] = await uploadFile(path, file!);
        } catch (err: any) {
          setError(`Photo upload failed: ${err.message}`);
          setSaving(false); setSavingStep(""); return;
        }
      }
    }

    // ── Step 4: upload video ──────────────────────────────────────────────────
    if (videoFile) {
      setSavingStep("Uploading video…");
      try {
        const ext  = videoFile.name.split(".").pop() || "mp4";
        const path = `${userId}/${toolId}/video-${Date.now()}.${ext}`;
        mediaUpdate["video_url"] = await uploadFile(path, videoFile);
      } catch (err: any) {
        setError(`Video upload failed: ${err.message}`);
        setSaving(false); setSavingStep(""); return;
      }
    }

    // ── Step 5: patch media URLs onto tool ────────────────────────────────────
    if (Object.keys(mediaUpdate).length > 0) {
      setSavingStep("Saving media…");
      const { error: patchErr } = await supabase.from("tools").update(mediaUpdate).eq("id", toolId);
      if (patchErr) { setError(patchErr.message); setSaving(false); setSavingStep(""); return; }
    }

    setSaving(false);
    setSavingStep("");
    router.push("/owner");
  };


  if (!authReady) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url('/sky.jpg')" }} />
        <div className="pointer-events-none absolute inset-0 z-10 bg-white/40" />
        <div className="text-sm text-black/40">Checking sign-in…</div>
      </main>
    );
  }


  return (
    <main className="relative min-h-screen py-10 px-4">
      {/* Background — same as homepage */}
      <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url('/sky.jpg')" }} />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(214,234,252,0.42),rgba(244,247,251,0.20))]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(240,246,255,0.35),rgba(255,255,255,0.45))]" />
      <div className="relative z-20 mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex rounded-full bg-[#eef5df] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f641f] mb-4">
            Share your tools
          </div>
          <h1 className="text-4xl font-bold text-black">List a Tool</h1>
          <p className="mt-2 text-base text-black/55">
            Earn money sharing tools you already own. Listing takes under 2 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Photos & Video ───────────────────────────────────────────── */}
          <section className="rounded-[28px] bg-white/75 backdrop-blur-md border border-white/60 p-6 shadow-xl space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Photos <span className="text-sm font-normal text-black/40">(main photo required)</span></h2>
              <p className="mt-1 text-sm text-black/50">First photo is the main image. Photos 2 &amp; 3 are optional.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((slot) => (
                <div key={slot} className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    ref={(el) => { photoInputRefs.current[slot] = el; }}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(slot, f); }}
                  />
                  {photoPreviews[slot] ? (
                    <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200">
                      <img src={photoPreviews[slot]!} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(slot)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
                      >
                        ✕
                      </button>
                      {slot === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#8bbb46] px-2 py-0.5 text-[10px] font-semibold text-white">
                          Main
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRefs.current[slot]?.click()}
                      className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed bg-gray-50 text-gray-400 hover:border-[#8bbb46] hover:bg-[#f3faeb] hover:text-[#2f641f] transition ${
                        slot === 0 ? "border-[#8bbb46]/60" : "border-gray-200"
                      }`}
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 5.25 5.25 0 0 1 1.23 8.25" />
                      </svg>
                      <span className="text-[11px] font-medium">{slot === 0 ? "Main photo *" : `Photo ${slot + 1}`}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Video */}
            <div>
              <h2 className="text-lg font-semibold">Video <span className="text-sm font-normal text-black/40">optional</span></h2>
              <p className="mt-1 text-sm text-black/50">A short clip helps renters understand size and condition.</p>
              <input
                type="file"
                accept="video/*"
                ref={videoInputRef}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setVideoFile(f); }}
              />
              {videoFile ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <svg className="h-5 w-5 shrink-0 text-[#2f641f]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
                  </svg>
                  <span className="flex-1 truncate text-sm text-gray-700">{videoFile.name}</span>
                  <button type="button" onClick={() => setVideoFile(null)} className="shrink-0 text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-gray-400 hover:border-[#8bbb46] hover:bg-[#f3faeb] hover:text-[#2f641f] transition"
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
                  </svg>
                  <span className="text-sm font-medium">Choose video file</span>
                </button>
              )}
            </div>
          </section>

          {/* ── Basics ───────────────────────────────────────────────────── */}
          <section className="rounded-[28px] bg-white/75 backdrop-blur-md border border-white/60 p-6 shadow-xl space-y-5">
            <h2 className="text-lg font-semibold">The basics</h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Tool name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Makita Cordless Drill"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] focus:ring-1 focus:ring-[#8bbb46]/30"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                >
                  <option value="">Select category…</option>
                  {TOOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Listing type</label>
                <select
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                >
                  <option value="owner_approved">Owner Approved — you confirm each booking</option>
                  <option value="direct">Direct — instant booking, no approval</option>
                  <option value="hub">Hub — pickup/dropoff via hub</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">
                Suburb / Location
              </label>
              <input
                list="nz-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Dunedin CBD, Ponsonby, Riccarton…"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
              />
              <datalist id="nz-locations">
                {NZ_LOCATIONS.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
              <p className="mt-1.5 text-xs text-black/40">
                Type your suburb — it will be added as a pickup hub automatically.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Price per day ($) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={pricePerDay}
                  onChange={(e) => setPricePerDay(e.target.value)}
                  placeholder="50"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Security deposit ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="100"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                />
              </div>
            </div>

            <div className={`rounded-2xl border p-4 space-y-3 transition ${forSale ? "border-orange-300 bg-orange-50" : "border-amber-100 bg-amber-50"}`}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forSale}
                  onChange={(e) => setForSale(e.target.checked)}
                  className="h-4 w-4 rounded accent-orange-500"
                />
                <span className="text-sm font-semibold text-amber-900">
                  🏷️ List this tool for sale at estimated value
                </span>
              </label>

              {forSale && (
                <div className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-700">
                  ⚠️ Listing status will be set to <strong>For Sale</strong> — renters can contact you to purchase.
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-amber-800">
                  {forSale ? "Sale price ($) *" : "Estimated value / replacement cost ($)"}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="e.g. 350"
                  className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <p className="text-xs text-amber-700/80 leading-5">
                {forSale
                  ? "Buyers can make an offer via the booking system."
                  : "Sets the lost-tool replacement cost and deposit ceiling. Tick the box above to list as for sale."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Brand</label>
                <input
                  value={brand} onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Makita"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Model</label>
                <input
                  value={model} onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. DHP484Z"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                />
              </div>
            </div>
          </section>

          {/* ── Condition ────────────────────────────────────────────────── */}
          <section className="rounded-[28px] bg-white/75 backdrop-blur-md border border-white/60 p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Tool condition *</h2>
            <p className="mt-1 text-sm text-black/50">Your honest self-assessment helps renters set expectations.</p>

            <div className="mt-5 space-y-3">
              {CONDITIONS.map((c) => {
                const isSelected = conditionStars === c.stars;
                return (
                  <button
                    key={c.stars}
                    type="button"
                    onClick={() => setConditionStars(c.stars)}
                    className={`w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition ${
                      isSelected
                        ? "border-[#8bbb46] bg-[#f3faeb] ring-1 ring-[#8bbb46]/40"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex shrink-0 gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-lg ${i < c.stars ? "text-amber-400" : "text-gray-200"}`}>★</span>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isSelected ? "text-[#2f641f]" : "text-gray-800"}`}>{c.label}</div>
                      <div className="text-xs text-black/45 mt-0.5">{c.desc}</div>
                    </div>
                    {isSelected && (
                      <span className="shrink-0 h-5 w-5 rounded-full bg-[#8bbb46] flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Description & notes ──────────────────────────────────────── */}
          <section className="rounded-[28px] bg-white/75 backdrop-blur-md border border-white/60 p-6 shadow-xl space-y-5">
            <h2 className="text-lg font-semibold">Description &amp; notes</h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Description</label>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3} placeholder="What is this tool, what jobs is it good for?"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] resize-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Included accessories</label>
              <input
                value={includedAccessories} onChange={(e) => setIncludedAccessories(e.target.value)}
                placeholder="e.g. 2 batteries, charger, carry case"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Usage notes</label>
              <textarea
                value={usageNotes} onChange={(e) => setUsageNotes(e.target.value)}
                rows={2} placeholder="Any tips or safety notes for the renter?"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] resize-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Pickup notes</label>
              <textarea
                value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)}
                rows={2} placeholder="Where and how should the renter collect the tool?"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] resize-none"
              />
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-[#2f641f] py-4 text-sm font-semibold text-white transition hover:bg-[#245018] disabled:opacity-60"
          >
            {saving ? savingStep || "Working…" : "List my tool"}
          </button>

          <p className="pb-4 text-center text-xs text-black/35">
            You can replace or add more photos from your dashboard after listing.
          </p>
        </form>
      </div>
    </main>
  );
}
