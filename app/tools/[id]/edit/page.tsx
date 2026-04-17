"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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

export default function EditToolPage() {
  const router  = useRouter();
  const params  = useParams();
  const toolId  = Number(params.id);

  const [loading, setLoading]       = useState(true);
  const [userId, setUserId]         = useState<string | null>(null);
  const [notOwner, setNotOwner]     = useState(false);

  // Form fields
  const [name, setName]                             = useState("");
  const [category, setCategory]                     = useState("");
  const [listingType, setListingType]               = useState("owner_approved");
  const [location, setLocation]                     = useState("");
  const [pricePerDay, setPricePerDay]               = useState("");
  const [deposit, setDeposit]                       = useState("");
  const [salePrice, setSalePrice]                   = useState("");
  const [brand, setBrand]                           = useState("");
  const [model, setModel]                           = useState("");
  const [conditionStars, setConditionStars]         = useState<number | null>(null);
  const [description, setDescription]               = useState("");
  const [usageNotes, setUsageNotes]                 = useState("");
  const [pickupNotes, setPickupNotes]               = useState("");
  const [includedAccessories, setIncludedAccessories] = useState("");

  // Photos — previews = what to show; files = new File if replacing; existingUrls = original DB values
  const [photoPreviews, setPhotoPreviews]       = useState<(string | null)[]>([null, null, null]);
  const [photoFiles, setPhotoFiles]             = useState<(File | null)[]>([null, null, null]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<(string | null)[]>([null, null, null]);

  // Video
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile]               = useState<File | null>(null);
  const [removeVideo, setRemoveVideo]           = useState(false);


  const photoInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const videoInputRef  = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving]         = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const [error, setError]           = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { router.replace("/login"); return; }
      setUserId(user.id);

      const { data: tool } = await supabase.from("tools").select(
        "name, category, listing_type, hub_id, price_per_day, deposit, sale_price, brand, model, condition, description, usage_notes, pickup_notes, included_accessories, image_url, image_url_2, image_url_3, video_url, owner_email, hubs(name)"
      ).eq("id", toolId).single();

      if (!tool) { setLoading(false); return; }
      if (tool.owner_email !== user.email) { setNotOwner(true); setLoading(false); return; }

      // Pre-fill
      setName(tool.name || "");
      setCategory(tool.category || "");
      setListingType(tool.listing_type || "owner_approved");
      setLocation((tool as any).hubs?.name || "");
      setPricePerDay(tool.price_per_day != null ? String(tool.price_per_day) : "");
      setDeposit(tool.deposit != null ? String(tool.deposit) : "");
      setSalePrice(tool.sale_price != null ? String(tool.sale_price) : "");
      setBrand(tool.brand || "");
      setModel(tool.model || "");
      setConditionStars(CONDITIONS.find(c => c.label === tool.condition)?.stars ?? null);
      setDescription(tool.description || "");
      setUsageNotes(tool.usage_notes || "");
      setPickupNotes(tool.pickup_notes || "");
      setIncludedAccessories(tool.included_accessories || "");

      const urls = [tool.image_url || null, tool.image_url_2 || null, tool.image_url_3 || null];
      setExistingPhotoUrls(urls);
      setPhotoPreviews([...urls]);
      setExistingVideoUrl(tool.video_url || null);

      setLoading(false);
    };
    init();
  }, [toolId, router]);

  const pickPhoto = (slot: number, file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoFiles(p => { const n = [...p]; n[slot] = file; return n; });
    setPhotoPreviews(p => { const n = [...p]; n[slot] = url; return n; });
  };

  const removePhoto = (slot: number) => {
    setPhotoFiles(p => { const n = [...p]; n[slot] = null; return n; });
    setPhotoPreviews(p => { const n = [...p]; n[slot] = null; return n; });
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
    if (!photoPreviews[0]) { setError("Main photo is required."); return; }

    setSaving(true);
    const conditionLabel = CONDITIONS.find(c => c.stars === conditionStars)?.label ?? null;

    // Build the update payload
    const resolvedHubId = await getOrCreateHub(location);

    const update: Record<string, unknown> = {
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
    };

    // Photos: upload new files, null out cleared slots
    const newPhotoFiles = photoFiles.map((f, i) => ({ file: f, key: PHOTO_KEYS[i], preview: photoPreviews[i] }));
    const toUpload = newPhotoFiles.filter(x => x.file);
    if (toUpload.length > 0) {
      setSavingStep(`Uploading ${toUpload.length} photo${toUpload.length > 1 ? "s" : ""}…`);
      for (const { file, key } of toUpload) {
        try {
          const ext = file!.name.split(".").pop() || "jpg";
          const path = `${userId}/${toolId}/${key}-${Date.now()}.${ext}`;
          update[key] = await uploadFile(path, file!);
        } catch (err: any) {
          setError(`Photo upload failed: ${err.message}`);
          setSaving(false); setSavingStep(""); return;
        }
      }
    }
    // Slots that were cleared (had existing URL but now null and no new file)
    for (let i = 0; i < 3; i++) {
      if (!photoFiles[i] && !photoPreviews[i] && existingPhotoUrls[i]) {
        update[PHOTO_KEYS[i]] = null;
      }
    }

    // Video
    if (videoFile) {
      setSavingStep("Uploading video…");
      try {
        const ext = videoFile.name.split(".").pop() || "mp4";
        const path = `${userId}/${toolId}/video-${Date.now()}.${ext}`;
        update["video_url"] = await uploadFile(path, videoFile);
      } catch (err: any) {
        setError(`Video upload failed: ${err.message}`);
        setSaving(false); setSavingStep(""); return;
      }
    } else if (removeVideo) {
      update["video_url"] = null;
    }

    setSavingStep("Saving…");
    const { error: dbErr } = await supabase.from("tools").update(update).eq("id", toolId);
    setSaving(false); setSavingStep("");
    if (dbErr) { setError(dbErr.message); return; }
    router.push("/owner");
  };

  if (loading) return (
    <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
      <div className="text-sm text-black/40">Loading tool…</div>
    </main>
  );

  if (notOwner) return (
    <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center p-6">
      <div className="rounded-[28px] bg-white p-8 shadow-sm text-center">
        <p className="text-lg font-semibold text-red-600">You don't own this tool.</p>
        <Link href="/owner" className="mt-4 block text-sm text-[#2f641f] underline">Back to dashboard</Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f7f8f5] py-10 px-4">
      <div className="mx-auto max-w-2xl">

        <div className="mb-8">
          <Link href="/owner" className="text-sm font-medium text-[#2f641f]">← Back to dashboard</Link>
          <div className="mt-4 inline-flex rounded-full bg-[#eef5df] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f641f]">
            Edit listing
          </div>
          <h1 className="mt-2 text-4xl font-bold text-black">Edit Tool</h1>
          <p className="mt-2 text-base text-black/55">Update your listing details.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Photos */}
          <section className="rounded-[28px] bg-white p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Photos <span className="text-sm font-normal text-black/40">(main photo required)</span></h2>
              <p className="mt-1 text-sm text-black/50">Click a photo to replace it. Click ✕ to remove.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((slot) => (
                <div key={slot} className="relative">
                  <input
                    type="file" accept="image/*"
                    ref={(el) => { photoInputRefs.current[slot] = el; }}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(slot, f); }}
                  />
                  {photoPreviews[slot] ? (
                    <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200">
                      <img
                        src={photoPreviews[slot]!}
                        alt=""
                        className="h-full w-full object-cover cursor-pointer"
                        onClick={() => photoInputRefs.current[slot]?.click()}
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(slot)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
                      >✕</button>
                      {slot === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#8bbb46] px-2 py-0.5 text-[10px] font-semibold text-white">Main</span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition rounded-2xl cursor-pointer pointer-events-none">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold">Replace</span>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRefs.current[slot]?.click()}
                      className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed bg-gray-50 text-gray-400 hover:border-[#8bbb46] hover:bg-[#f3faeb] hover:text-[#2f641f] transition ${slot === 0 ? "border-[#8bbb46]/60" : "border-gray-200"}`}
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
              <input type="file" accept="video/*" ref={videoInputRef} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setVideoFile(f); setRemoveVideo(false); } }} />

              {videoFile ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <svg className="h-5 w-5 shrink-0 text-[#2f641f]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
                  </svg>
                  <span className="flex-1 truncate text-sm text-gray-700">{videoFile.name}</span>
                  <button type="button" onClick={() => setVideoFile(null)} className="shrink-0 text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              ) : existingVideoUrl && !removeVideo ? (
                <div className="mt-3 space-y-2">
                  <video src={existingVideoUrl} controls className="w-full rounded-2xl max-h-40 bg-black object-contain" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => videoInputRef.current?.click()}
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100">
                      Replace video
                    </button>
                    <button type="button" onClick={() => setRemoveVideo(true)}
                      className="flex-1 rounded-xl border border-red-100 bg-red-50 py-2 text-xs font-semibold text-red-500 hover:bg-red-100">
                      Remove video
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { videoInputRef.current?.click(); setRemoveVideo(false); }}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-gray-400 hover:border-[#8bbb46] hover:bg-[#f3faeb] hover:text-[#2f641f] transition">
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
                  </svg>
                  <span className="text-sm font-medium">Add video</span>
                </button>
              )}
            </div>
          </section>

          {/* Basics */}
          <section className="rounded-[28px] bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold">The basics</h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Tool name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Makita Cordless Drill"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#8bbb46]">
                  <option value="">Select category…</option>
                  {TOOL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Listing type</label>
                <select value={listingType} onChange={(e) => setListingType(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#8bbb46]">
                  <option value="owner_approved">Owner Approved</option>
                  <option value="direct">Direct — instant booking</option>
                  <option value="hub">Hub — pickup/dropoff via hub</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Suburb / Location</label>
              <input
                list="nz-locations-edit"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Dunedin CBD, Ponsonby, Riccarton…"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
              />
              <datalist id="nz-locations-edit">
                {NZ_LOCATIONS.map((loc) => <option key={loc} value={loc} />)}
              </datalist>
              <p className="mt-1.5 text-xs text-black/40">Type your suburb — created as a pickup hub if new.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Price per day ($) *</label>
                <input type="number" min="0" step="0.01" value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} placeholder="50"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Security deposit ($)</label>
                <input type="number" min="0" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="100"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 space-y-3">
              <label className="block text-sm font-semibold text-amber-800">🏷️ For sale / replacement value ($)</label>
              <input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="e.g. 350"
                className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400" />
              <p className="text-xs text-amber-700/80 leading-5">
                Open to selling, or sets the lost-tool replacement cost and deposit ceiling.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Brand</label>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Makita"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-black/70">Model</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. DHP484Z"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
              </div>
            </div>
          </section>

          {/* Condition */}
          <section className="rounded-[28px] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Tool condition *</h2>
            <p className="mt-1 text-sm text-black/50">Your honest self-assessment helps renters set expectations.</p>
            <div className="mt-5 space-y-3">
              {CONDITIONS.map((c) => {
                const isSelected = conditionStars === c.stars;
                return (
                  <button key={c.stars} type="button" onClick={() => setConditionStars(c.stars)}
                    className={`w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition ${isSelected ? "border-[#8bbb46] bg-[#f3faeb] ring-1 ring-[#8bbb46]/40" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white"}`}>
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

          {/* Description & notes */}
          <section className="rounded-[28px] bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold">Description &amp; notes</h2>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                placeholder="What is this tool, what jobs is it good for?"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] resize-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Included accessories</label>
              <input value={includedAccessories} onChange={(e) => setIncludedAccessories(e.target.value)}
                placeholder="e.g. 2 batteries, charger, carry case"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Usage notes</label>
              <textarea value={usageNotes} onChange={(e) => setUsageNotes(e.target.value)} rows={2}
                placeholder="Any tips or safety notes for the renter?"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] resize-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-black/70">Pickup notes</label>
              <textarea value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)} rows={2}
                placeholder="Where and how should the renter collect the tool?"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] resize-none" />
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <button type="submit" disabled={saving}
            className="w-full rounded-full bg-[#2f641f] py-4 text-sm font-semibold text-white transition hover:bg-[#245018] disabled:opacity-60">
            {saving ? savingStep || "Saving…" : "Save changes"}
          </button>

          <p className="pb-4 text-center text-xs text-black/35">Changes are saved immediately and go live on the listing.</p>
        </form>
      </div>
    </main>
  );
}
