"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import ToolImageGallery from "@/app/components/tool-image-gallery";

type ToolRow = {
  id: number;
  name: string | null;
  description?: string | null;
  price_per_day?: number | null;
  image_url?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  video_url?: string | null;
  deposit?: number | null;
  condition?: string | null;
  brand?: string | null;
  model?: string | null;
  included_accessories?: string | null;
  usage_notes?: string | null;
  pickup_notes?: string | null;
  late_return_rule?: string | null;
  damage_rule?: string | null;
  sale_price?: number | null;
  promo_price?: number | null;
  promo_label?: string | null;
  listing_type?: string | null;
  approval_type?: string | null;
  hub_id?: string | null;
  owner_email?: string | null;
  status?: string | null;
  hubs?: { id: string; name: string } | null;
  categories?: { id: string; name: string } | null;
};

type Review = {
  rating: number;
  content: string | null;
  reviewer_role: string | null;
  created_at: string | null;
  reviewer_id: string | null;
  booking_id: number | null;
};

function ToolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolId = Number(params.id);

  const [tool, setTool] = useState<ToolRow | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewNamesMap, setReviewNamesMap] = useState<Record<number, string>>({});
  const [ownerTotalXp, setOwnerTotalXp] = useState(0);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState("");

  const saleStatus = searchParams.get("sale");

  const handleBuyNow = async () => {
    setBuyLoading(true);
    setBuyError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId,
          buyerEmail: session?.user?.email ?? "",
          buyerName: session?.user?.user_metadata?.full_name ?? "",
        }),
      });
      const json = await res.json();
      if (!res.ok) { setBuyError(json.error || "Checkout failed"); return; }
      window.location.href = json.url;
    } catch {
      setBuyError("Failed to start checkout. Please try again.");
    } finally {
      setBuyLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [{ data: toolData, error: toolErr }, { data: reviewRows }] = await Promise.all([
        supabase.from("tools").select(`
          id, name, description, price_per_day, promo_price, promo_label, image_url, image_url_2, image_url_3,
          video_url, deposit, condition, brand, model, included_accessories,
          usage_notes, pickup_notes, late_return_rule, damage_rule, sale_price,
          listing_type, approval_type, hub_id, owner_email, status,
          hubs(id, name), categories:category_id(id, name)
        `).eq("id", toolId).single(),
        supabase.from("reviews")
          .select("rating, content, reviewer_role, created_at, reviewer_id, booking_id")
          .eq("target_id", toolId).eq("target_type", "tool")
          .order("created_at", { ascending: false }),
      ]);

      if (toolErr || !toolData) { setError("Tool not found."); setLoading(false); return; }
      setTool(toolData as ToolRow);

      const revs = (reviewRows || []) as Review[];
      setReviews(revs);

      // Fetch reviewer names
      const bookingIds = [...new Set(revs.map(r => r.booking_id).filter(Boolean))] as number[];
      if (bookingIds.length > 0) {
        const { data: bks } = await supabase.from("bookings").select("id, user_name").in("id", bookingIds);
        if (bks) {
          const map: Record<number, string> = {};
          (bks as { id: number; user_name: string | null }[]).forEach(b => { if (b.user_name) map[b.id] = b.user_name; });
          setReviewNamesMap(map);
        }
      }

      // Fetch owner XP (best-effort, no service role needed)
      if ((toolData as ToolRow).owner_email) {
        const { data: ownerProfile } = await supabase
          .from("profiles").select("id").eq("email", (toolData as ToolRow).owner_email!).single();
        if (ownerProfile) {
          setOwnerProfileId(ownerProfile.id);
          const { data: xpRows } = await supabase
            .from("experience_points").select("points").eq("user_id", ownerProfile.id);
          setOwnerTotalXp(xpRows?.reduce((s: number, r: { points: number }) => s + (r.points || 0), 0) ?? 0);
        }
      }

      setLoading(false);
    };
    load();
  }, [toolId]);

  if (loading) return (
    <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
      <div className="text-sm text-black/40">Loading tool…</div>
    </main>
  );

  if (error || !tool) return (
    <main className="min-h-screen bg-[#f7f8f5] p-6">
      <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-8 shadow-sm">
        <div className="text-xl font-semibold text-red-600">{error || "Tool not found."}</div>
        <button onClick={() => router.push("/search")} className="mt-4 text-sm text-[#2f641f] underline">← Back to search</button>
      </div>
    </main>
  );

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;

  const images = [tool.image_url, tool.image_url_2, tool.image_url_3].filter(Boolean) as string[];

  const ownerDisplayName = tool.owner_email
    ? tool.owner_email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : null;

  const isForSale = tool.status === "for_sale";

  return (
    <main className="min-h-screen bg-[#f7f8f5] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link href="/search" className="text-sm font-medium text-[#2f641f]">← Back to search</Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <ToolImageGallery images={images} toolName={tool.name || "Tool"} />

            <div className="mt-4 rounded-[28px] bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold">Product video</div>
              {tool.video_url ? (
                <div className="mt-3 overflow-hidden rounded-[20px] bg-black">
                  <video controls className="aspect-video w-full" src={tool.video_url} />
                </div>
              ) : (
                <div className="mt-3 flex aspect-video items-center justify-center rounded-[20px] bg-[#eef2ea] text-sm text-black/55">
                  No video yet
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full bg-[#eef5df] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f641f]">
                  {tool.listing_type === "p2p" ? "Owner approval" : tool.hubs?.name ? `${tool.hubs.name} Hub` : "Hub pickup"}
                </div>
                {isForSale && (
                  <div className="inline-flex rounded-full bg-orange-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                    🏷️ For Sale
                  </div>
                )}
              </div>

              <h1 className="mt-4 text-4xl font-bold">{tool.name || "Unnamed Tool"}</h1>

              {tool.hubs?.name && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-black/50">
                  <svg className="h-4 w-4 shrink-0 text-[#8bbb46]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  <span>{tool.hubs.name}</span>
                </div>
              )}

              {ownerDisplayName && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-black/50">Listed by</span>
                  {ownerProfileId ? (
                    <Link href={`/profile/${ownerProfileId}`} className="font-semibold text-[#2f641f] underline-offset-2 hover:underline">
                      {ownerDisplayName}
                    </Link>
                  ) : (
                    <span className="font-semibold text-gray-700">{ownerDisplayName}</span>
                  )}
                  {ownerTotalXp > 0 && (
                    <span className="rounded-full bg-[#eef5df] px-2 py-0.5 text-xs font-semibold text-[#2f641f]">⚡ {ownerTotalXp} XP</span>
                  )}
                  {reviews.length > 0 && (
                    <span className="flex items-center gap-0.5 text-orange-400 text-xs">
                      {"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}
                      <span className="text-black/40 ml-1">({reviews.length})</span>
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  🔧 {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                </span>
                {tool.condition && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {"★".repeat(["Well Used","Fair","Good","Like New","Brand New"].indexOf(tool.condition) + 1)} {tool.condition}
                  </span>
                )}
              </div>

              {/* Sale status banner */}
              {saleStatus === "success" && (
                <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-semibold text-green-700">
                  ✅ Payment successful! The owner will be in touch soon.
                </div>
              )}
              {saleStatus === "cancelled" && (
                <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
                  Payment cancelled. You can try again below.
                </div>
              )}

              {/* Price block */}
              {isForSale && tool.sale_price != null ? (
                <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-1">
                  {tool.promo_price ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-orange-600">NZ${Number(tool.promo_price).toFixed(2)}</span>
                        <span className="text-lg line-through text-orange-300">NZ${Number(tool.sale_price).toFixed(2)}</span>
                        <span className="rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                          {tool.promo_label || "PROMO"}
                        </span>
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-orange-500">Promotional sale price</div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-orange-600">NZ${Number(tool.sale_price).toFixed(2)}</div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-orange-500">Sale price</div>
                    </>
                  )}
                  <div className="pt-1 text-sm text-orange-700">
                    Also rentable · <span className="font-medium">${tool.price_per_day ?? 0}/day</span>
                  </div>
                </div>
              ) : tool.status === "sold" ? (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-2xl font-bold text-gray-500">SOLD</div>
                  <div className="mt-0.5 text-sm text-gray-400">This tool has been sold</div>
                </div>
              ) : tool.promo_price ? (
                <div className="mt-6 flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-red-600">${Number(tool.promo_price).toFixed(2)}/day</span>
                  <span className="text-lg text-black/30 line-through">${tool.price_per_day ?? 0}/day</span>
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold uppercase text-red-600">
                    {tool.promo_label || "PROMO"}
                  </span>
                </div>
              ) : (
                <div className="mt-6 text-4xl font-bold text-[#2f641f]">${tool.price_per_day ?? 0}/day</div>
              )}

              <p className="mt-6 text-base leading-8 text-black/70">{tool.description || "No description yet."}</p>

              {buyError && (
                <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">{buyError}</div>
              )}

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {tool.status === "sold" ? (
                  <Link href="/search"
                    className="sm:col-span-2 rounded-full border border-[#8bbb46] bg-white px-6 py-3 text-center text-sm font-semibold text-[#2f641f]">
                    Browse similar tools
                  </Link>
                ) : isForSale ? (
                  <>
                    <button
                      onClick={handleBuyNow}
                      disabled={buyLoading}
                      className="rounded-full bg-orange-500 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      {buyLoading ? "Redirecting…" : `Buy Now — NZ$${Number(tool.promo_price ?? tool.sale_price).toFixed(2)}`}
                    </button>
                    <Link href={`/booking/${tool.id}`}
                      className="rounded-full bg-[#8bbb46] px-6 py-3 text-center text-sm font-semibold text-white hover:bg-[#7aaa39]">
                      Request Rental Instead
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href={`/booking/${tool.id}`}
                      className="rounded-full bg-[#8bbb46] px-6 py-3 text-center text-sm font-semibold text-white">
                      Request Booking
                    </Link>
                    <Link href={`/search?hub=${tool.hub_id || ""}`}
                      className="rounded-full border border-[#8bbb46] bg-white px-6 py-3 text-center text-sm font-semibold text-[#2f641f]">
                      More nearby tools
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold">Quick facts</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Condition</div>
                  <div className="mt-1 font-medium">{tool.condition || "-"}</div>
                </div>
                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Category</div>
                  <div className="mt-1 font-medium">{(tool.categories as any)?.name || "-"}</div>
                </div>
                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Deposit</div>
                  <div className="mt-1 font-medium">${tool.deposit ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Brand</div>
                  <div className="mt-1 font-medium">{tool.brand || "-"}</div>
                </div>
                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Model</div>
                  <div className="mt-1 font-medium">{tool.model || "-"}</div>
                </div>
                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Approval</div>
                  <div className="mt-1 font-medium">{tool.approval_type || "-"}</div>
                </div>
                {tool.sale_price != null && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">🏷️ {isForSale ? "For Sale" : "Replacement Value"}</div>
                    <div className="mt-0.5 text-xl font-bold text-amber-700">${tool.sale_price.toFixed(2)}</div>
                    <div className="mt-0.5 text-xs text-amber-600/70">
                      {isForSale ? "Owner is selling this tool · contact via booking" : "Lost-tool replacement cost"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold">Included accessories</div>
              <p className="mt-4 text-sm leading-7 text-black/70">{tool.included_accessories || "Not added yet."}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold">Usage notes</div>
            <p className="mt-4 text-sm leading-8 text-black/70">{tool.usage_notes || "No usage notes yet."}</p>
          </div>
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold">Rental information</div>
            <div className="mt-4 space-y-4 text-sm text-black/70">
              <div className="rounded-2xl bg-[#f6f8f1] p-4">
                <div className="font-semibold text-black">Pickup</div>
                <div className="mt-2">{tool.pickup_notes || "Pickup details not added yet."}</div>
              </div>
              <div className="rounded-2xl bg-[#f6f8f1] p-4">
                <div className="font-semibold text-black">Late return rule</div>
                <div className="mt-2">{tool.late_return_rule || "Not added yet."}</div>
              </div>
              <div className="rounded-2xl bg-[#f6f8f1] p-4">
                <div className="font-semibold text-black">Damage / loss rule</div>
                <div className="mt-2">{tool.damage_rule || "Not added yet."}</div>
                {tool.sale_price != null && (
                  <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                    Lost-tool replacement cost: <span className="font-bold">${tool.sale_price.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="text-xl font-semibold">Reviews</div>
              {reviews.length > 0 && (
                <span className="rounded-full bg-[#eef5df] px-3 py-1 text-sm font-semibold text-[#2f641f]">
                  {avgRating.toFixed(1)} ★ · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {reviews.length > 0 && (
              <Link href={`/tools/${tool.id}/reviews`}
                className="rounded-full border border-[#8bbb46] px-4 py-2 text-sm font-semibold text-[#2f641f] hover:bg-[#f0f8e8]">
                See all reviews →
              </Link>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-[#8bbb46]/20 bg-[#f8fdf3] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#2f641f] mb-2">Owner&apos;s Assessment</p>
              {tool.description && <p className="text-sm text-gray-700 leading-relaxed">{tool.description}</p>}
              <p className="mt-3 text-xs text-black/40">No renter reviews yet — be the first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 3).map((r, i) => {
                const name = r.booking_id ? (reviewNamesMap[r.booking_id] || "Renter") : "Renter";
                return (
                  <div key={i} className="rounded-2xl bg-[#f6f8f1] p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Link href={`/profile/${r.reviewer_id}`} className="flex items-center gap-2 hover:opacity-80">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8bbb46] text-xs font-bold text-white">
                          {name[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{name}</span>
                      </Link>
                      <span className="flex items-center gap-0.5 text-orange-400">
                        {[1,2,3,4,5].map(s => <span key={s}>{s <= r.rating ? "★" : "☆"}</span>)}
                      </span>
                    </div>
                    {r.content && <p className="mt-2 text-sm text-gray-700">{r.content}</p>}
                    {r.created_at && <p className="mt-1 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("en-NZ", { dateStyle: "medium" })}</p>}
                  </div>
                );
              })}
              {reviews.length > 3 && (
                <Link href={`/tools/${tool.id}/reviews`} className="block text-center text-sm font-semibold text-[#2f641f] hover:underline pt-1">
                  See all {reviews.length} reviews →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ToolDetailPageWrapper() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#f7f8f5] flex items-center justify-center">
        <div className="text-sm text-black/40">Loading tool…</div>
      </main>
    }>
      <ToolDetailPage />
    </Suspense>
  );
}
