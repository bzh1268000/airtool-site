"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Booking = {
  id: number;
  tool_id: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  preferred_dates: string | null;
  price_total: number | null;
  platform_fee: number | null;
  owner_email: string | null;
  created_at: string | null;
  paid_at: string | null;
  stripe_session_id: string | null;
};

type Tool = {
  id: number;
  name: string | null;
  image_url: string | null;
  price_per_day: number | null;
  description: string | null;
};

type DisputeRecord = {
  id: number;
  booking_id: number;
  owner_email: string | null;
  renter_email: string | null;
  reason: string | null;
  amount_claimed: number | null;
  owner_evidence_urls: string[] | null;
  renter_response: string | null;
  renter_responded_at: string | null;
  renter_evidence_urls: string[] | null;
  resolution: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  status: string | null;
  created_at: string | null;
};

const statusLabel: Record<string, { text: string; color: string }> = {
  new:          { text: "Awaiting owner review",       color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  pending:      { text: "Awaiting owner review",       color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  approved:     { text: "Approved — ready to confirm", color: "text-blue-700 bg-blue-50 border-blue-200" },
  confirmed:    { text: "Confirmed — payment due",     color: "text-purple-700 bg-purple-50 border-purple-200" },
  in_use:       { text: "✅ Tool in use",              color: "text-green-700 bg-green-50 border-green-200" },
  return_check: { text: "📦 Return check in progress", color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  returning:    { text: "📦 Return initiated",         color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  completed:    { text: "✅ Completed",                color: "text-gray-600 bg-gray-50 border-gray-200" },
  review:       { text: "⭐ Please leave a review",    color: "text-amber-700 bg-amber-50 border-amber-200" },
  disputed:     { text: "⚠️ Disputed — under review",  color: "text-red-700 bg-red-50 border-red-200" },
  declined:     { text: "Declined",                    color: "text-red-700 bg-red-50 border-red-200" },
  cancelled:    { text: "Cancelled",                   color: "text-gray-500 bg-gray-50 border-gray-200" },
};

// ── Fetch signed URLs from the private dispute-evidence bucket ────────────────
async function fetchSignedUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const results = await Promise.all(
    paths.map((p) =>
      supabase.storage.from("dispute-evidence").createSignedUrl(p, 3600),
    ),
  );
  return results.flatMap((r) => (r.data?.signedUrl ? [r.data.signedUrl] : []));
}

// ── Small evidence image grid ─────────────────────────────────────────────────
function EvidenceGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={`Evidence ${i + 1}`}
            className="h-20 w-20 rounded-xl border border-gray-200 object-cover hover:opacity-90 transition"
          />
        </a>
      ))}
    </div>
  );
}

export default function MyBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }       = use(params);
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [booking, setBooking]   = useState<Booking | null>(null);
  const [tool, setTool]         = useState<Tool | null>(null);
  const [loading, setLoading]   = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying]         = useState(false);
  const [payError, setPayError]     = useState("");

  // Dispute state
  const [dispute, setDispute]           = useState<DisputeRecord | null>(null);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [ownerEvidenceUrls, setOwnerEvidenceUrls]   = useState<string[]>([]);
  const [renterEvidenceUrls, setRenterEvidenceUrls] = useState<string[]>([]);

  // Renter response form
  const [renterResponse, setRenterResponse]           = useState("");
  const [renterEvidenceFiles, setRenterEvidenceFiles] = useState<File[]>([]);
  const [responseSubmitting, setResponseSubmitting]   = useState(false);
  const [responseSubmitted, setResponseSubmitted]     = useState(false);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  const paymentResult = searchParams.get("payment");

  // ── Fetch dispute record + signed URLs ────────────────────────────────────────
  const loadDispute = async (bookingId: number) => {
    console.log("[my-booking] loadDispute called for booking_id:", bookingId);
    setDisputeLoading(true);

    const { data: d, error } = await supabase
      .from("disputes")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("[my-booking] dispute fetch result — data:", d, "| error:", error);

    if (error) {
      console.error("[my-booking] dispute fetch error:", error.message, error);
      setDisputeLoading(false);
      return;
    }

    if (d) {
      const rec = d as DisputeRecord;
      console.log("[my-booking] dispute record found:", rec);
      setDispute(rec);

      const [ownerUrls, renterUrls] = await Promise.all([
        fetchSignedUrls(rec.owner_evidence_urls ?? []),
        fetchSignedUrls(rec.renter_evidence_urls ?? []),
      ]);
      setOwnerEvidenceUrls(ownerUrls);
      setRenterEvidenceUrls(renterUrls);
    } else {
      console.warn("[my-booking] no dispute row found for booking_id:", bookingId);
    }

    setDisputeLoading(false);
  };

  // ── Initial page load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data: b, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", Number(id))
        .single();
      if (error || !b) { router.replace("/renter"); return; }

      const bk = b as unknown as Booking;
      console.log("[my-booking] booking loaded — id:", bk.id, "| status:", bk.status);
      setBooking(bk);

      // Fetch tool + dispute in parallel
      await Promise.all([
        bk.tool_id
          ? supabase
              .from("tools")
              .select("id, name, image_url, price_per_day, description")
              .eq("id", bk.tool_id)
              .single()
              .then(({ data: t }) => { if (t) setTool(t as Tool); })
          : Promise.resolve(),
        bk.status === "disputed"
          ? loadDispute(bk.id)
          : (console.log("[my-booking] status is not disputed, skipping dispute fetch. Status:", bk.status), Promise.resolve()),
      ]);

      setLoading(false);
    };
    load();
  }, [id, router]);

  // ── Safety net: if booking is disputed but dispute didn't load yet, retry ─────
  useEffect(() => {
    if (booking?.status === "disputed" && !dispute && !disputeLoading) {
      console.log("[my-booking] safety-net: booking is disputed but dispute is null — retrying loadDispute");
      loadDispute(booking.id);
    }
  }, [booking?.status]);

  // ── Poll after Stripe redirect ────────────────────────────────────────────────
  useEffect(() => {
    if (paymentResult !== "success") return;
    if (booking?.paid_at) return;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data: b } = await supabase
        .from("bookings")
        .select("status, paid_at, stripe_session_id")
        .eq("id", Number(id))
        .single();
      if (b?.paid_at || b?.status === "in_use") {
        setBooking((prev) => prev ? { ...prev, ...b } : prev);
        clearInterval(poll);
      } else if (attempts >= 6) {
        clearInterval(poll);
      }
    }, 1500);
    return () => clearInterval(poll);
  }, [paymentResult, id]);

  // ── Confirm booking ───────────────────────────────────────────────────────────
  const handleConfirm = async (): Promise<boolean> => {
    if (!booking) return false;
    setConfirming(true);
    const { error } = await supabase
      .from("bookings").update({ status: "confirmed" }).eq("id", booking.id);
    if (error) { alert("Failed to confirm: " + error.message); setConfirming(false); return false; }
    setBooking((prev) => prev ? { ...prev, status: "confirmed" } : prev);
    setConfirming(false);
    return true;
  };

  const handleConfirmAndPay = async () => {
    const confirmed = await handleConfirm();
    if (confirmed) await handlePay();
  };

  // ── Stripe Checkout ───────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!booking) return;
    setPaying(true);
    setPayError("");
    try {
      const res  = await fetch("/api/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bookingId: booking.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setPayError(json.error || "Could not start checkout. Please try again.");
        setPaying(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setPayError("Network error. Please try again.");
      setPaying(false);
    }
  };

  // ── Submit renter response ────────────────────────────────────────────────────
  const handleSubmitResponse = async () => {
    if (!dispute) return;
    if (!renterResponse.trim()) { alert("Please write your response before submitting."); return; }
    setResponseSubmitting(true);

    // Upload evidence files
    const evidencePaths: string[] = [];
    for (const file of renterEvidenceFiles) {
      const ext  = file.name.split(".").pop() || "jpg";
      const path = `${booking!.id}/renter/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("dispute-evidence").upload(path, file);
      if (!error) evidencePaths.push(path);
    }

    const res = await fetch(`/api/disputes/${dispute.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        renter_response:      renterResponse.trim(),
        renter_evidence_urls: evidencePaths,
      }),
    });

    if (!res.ok) {
      const j = await res.json();
      alert("Failed to submit: " + (j.error || "Unknown error"));
      setResponseSubmitting(false);
      return;
    }

    // Fetch signed URLs for renter's new evidence
    const newSignedUrls = await fetchSignedUrls(evidencePaths);

    setDispute((prev) => prev ? {
      ...prev,
      renter_response:      renterResponse.trim(),
      renter_evidence_urls: evidencePaths,
      renter_responded_at:  new Date().toISOString(),
    } : prev);
    setRenterEvidenceUrls(newSignedUrls);
    setResponseSubmitted(true);
    setRenterResponse("");
    setRenterEvidenceFiles([]);
    setResponseSubmitting(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f2]">
        <p className="text-gray-500">Loading your booking…</p>
      </div>
    );
  }
  if (!booking) return null;

  const PAID_STATUSES = ["in_use", "return_check", "returning", "completed", "review", "disputed"] as const;
  const status      = booking.status || "new";
  const badge       = statusLabel[status] || { text: status, color: "text-gray-600 bg-gray-50 border-gray-200" };
  const isPending   = status === "new" || status === "pending";
  const isApproved  = status === "approved";
  const isPaid      = !!booking.paid_at || PAID_STATUSES.includes(status as typeof PAID_STATUSES[number]);
  const isConfirmed = status === "confirmed" && !isPaid;
  const isReturning = status === "return_check" || status === "returning";
  const isComplete  = status === "completed" || status === "review";
  const isDisputed  = status === "disputed";
  const canCancel   = !["completed", "in_use", "return_check", "returning", "confirmed", "cancelled", "declined", "disputed"].includes(status);

  const rentalWindow = booking.preferred_dates || `${booking.start_date} → ${booking.end_date}`;
  const ownerPayout  = booking.price_total != null && booking.platform_fee != null
    ? Number(booking.price_total) - Number(booking.platform_fee)
    : null;

  const hasResponded  = !!(dispute?.renter_response || responseSubmitted);
  const isResolved    = !!(dispute?.resolution);

  return (
    <div className="min-h-screen bg-[#f7f7f2]">

      {/* Top nav */}
      <div className="border-b border-black/10 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-xl font-bold text-[#2f641f]">AirTool.nz</span>
          <button
            onClick={() => router.push("/renter")}
            className="text-sm text-black/50 hover:text-black"
          >
            ← My Dashboard
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">

        {/* ══════════════════════════════════════════════════════════════════════
            DISPUTED — shown FIRST, above everything else
        ══════════════════════════════════════════════════════════════════════ */}
        {isDisputed && (
          <div className="overflow-hidden rounded-3xl border-2 border-red-500 bg-white shadow-lg">

            {/* Red header bar */}
            <div className="bg-red-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">Action required</p>
                  <h2 className="text-2xl font-bold text-white">Dispute raised by owner</h2>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-red-100">
                Your payment is held in escrow while this is reviewed. Read the owner&rsquo;s
                claim and submit your response below.
              </p>
            </div>

            <div className="p-6 space-y-6">

              {/* Loading state */}
              {disputeLoading && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                  <p className="text-sm text-red-700">Loading dispute details…</p>
                </div>
              )}

              {/* Dispute not found (fetch failed / RLS) */}
              {!disputeLoading && !dispute && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
                  <p className="text-sm font-semibold text-orange-800">Could not load dispute details</p>
                  <p className="mt-1 text-xs text-orange-600">
                    Please try refreshing the page, or contact AirTool support.
                  </p>
                  <button
                    onClick={() => loadDispute(booking.id)}
                    className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                  >
                    Retry
                  </button>
                </div>
              )}

              {dispute && (
                <>
                  {/* ── Owner's claim ──────────────────────────────────────── */}
                  <section>
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-red-500">
                      Owner&rsquo;s Claim
                    </p>

                    {/* Key facts grid */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Reason</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{dispute.reason}</p>
                      </div>
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Amount claimed</p>
                        <p className="mt-1 text-base font-bold text-red-700">
                          {dispute.amount_claimed != null
                            ? `$${Number(dispute.amount_claimed).toFixed(2)} NZD`
                            : "Not specified"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Status</p>
                        <p className="mt-1 text-sm font-bold">
                          {dispute.status === "resolved"
                            ? <span className="text-green-700">✅ Resolved</span>
                            : dispute.status === "escalated"
                              ? <span className="text-orange-700">🔺 Escalated</span>
                              : <span className="text-red-700">🔴 Open</span>}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Date raised</p>
                        <p className="mt-1 text-sm text-gray-700">
                          {dispute.created_at
                            ? new Date(dispute.created_at).toLocaleString("en-NZ", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Owner evidence images */}
                    {ownerEvidenceUrls.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                          Owner&rsquo;s evidence photos
                        </p>
                        <EvidenceGrid urls={ownerEvidenceUrls} />
                      </div>
                    )}
                    {(dispute.owner_evidence_urls?.length ?? 0) > 0 && ownerEvidenceUrls.length === 0 && !disputeLoading && (
                      <p className="mt-2 text-xs text-gray-400">
                        {dispute.owner_evidence_urls!.length} evidence photo{dispute.owner_evidence_urls!.length > 1 ? "s" : ""} attached (loading…)
                      </p>
                    )}
                  </section>

                  <hr className="border-gray-100" />

                  {/* ── Admin decision (if resolved) ────────────────────────── */}
                  {isResolved && (
                    <section className="rounded-2xl border border-green-200 bg-green-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-green-600">
                        ✅ Dispute resolved
                      </p>
                      <p className="mt-2 text-sm font-semibold text-green-900">
                        {dispute.resolution === "release_to_owner" && "Payment has been released to the owner."}
                        {dispute.resolution === "partial_refund"   && "A partial refund has been issued to you."}
                        {dispute.resolution === "full_refund"      && "A full refund has been issued to you."}
                        {!["release_to_owner","partial_refund","full_refund"].includes(dispute.resolution ?? "") && dispute.resolution}
                      </p>
                      {dispute.admin_notes && (
                        <p className="mt-2 text-sm text-green-800">
                          <span className="font-semibold">AirTool note: </span>{dispute.admin_notes}
                        </p>
                      )}
                      {dispute.resolved_at && (
                        <p className="mt-2 text-xs text-green-600">
                          Resolved {new Date(dispute.resolved_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      )}
                    </section>
                  )}

                  {/* ── Your response (already submitted) ──────────────────── */}
                  {hasResponded && (
                    <section>
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-blue-500">
                        Your Response
                      </p>
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                        <p className="text-sm text-gray-900">
                          {dispute.renter_response || renterResponse}
                        </p>
                        {renterEvidenceUrls.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                              Your evidence photos
                            </p>
                            <EvidenceGrid urls={renterEvidenceUrls} />
                          </div>
                        )}
                        {dispute.renter_responded_at && (
                          <p className="mt-2 text-xs text-blue-500">
                            Submitted {new Date(dispute.renter_responded_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        )}
                      </div>

                      {/* Awaiting decision */}
                      {!isResolved && (
                        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <span className="text-lg">⏳</span>
                          <p className="text-sm text-amber-800">
                            <span className="font-semibold">Awaiting admin decision.</span>{" "}
                            AirTool team will review both sides and contact you. Your payment remains in escrow.
                          </p>
                        </div>
                      )}
                    </section>
                  )}

                  {/* ── Response form (not yet responded, not resolved) ─────── */}
                  {!hasResponded && !isResolved && (
                    <section>
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-blue-500">
                        Your Response
                      </p>
                      <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <div>
                          <p className="text-sm font-semibold text-blue-900">
                            💬 Explain your side of the situation
                          </p>
                          <p className="mt-0.5 text-xs text-blue-600">
                            Be factual and specific. Attach photos if they support your case.
                          </p>
                        </div>
                        <textarea
                          value={renterResponse}
                          onChange={(e) => setRenterResponse(e.target.value)}
                          placeholder="Describe what happened from your perspective — e.g. the tool was in the same condition when returned, here is proof…"
                          rows={5}
                          className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                        />
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-blue-700">
                            Evidence photos — optional, up to 5 images
                          </label>
                          <input
                            ref={evidenceInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) =>
                              setRenterEvidenceFiles(Array.from(e.target.files ?? []).slice(0, 5))
                            }
                            className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-200"
                          />
                          {renterEvidenceFiles.length > 0 && (
                            <p className="mt-1.5 text-xs text-blue-600">
                              {renterEvidenceFiles.length} file{renterEvidenceFiles.length > 1 ? "s" : ""} ready to upload
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleSubmitResponse}
                          disabled={responseSubmitting || !renterResponse.trim()}
                          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {responseSubmitting ? "Uploading & submitting…" : "Submit My Response →"}
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Payment result banners ── */}
        {paymentResult === "success" && (
          <div className="rounded-3xl bg-[#2f641f] p-6 text-white shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Payment complete</div>
            <h2 className="mt-2 text-2xl font-bold">✅ Payment received — thank you!</h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              Your payment is confirmed. Contact the owner to arrange pickup if you haven&apos;t already.
            </p>
            {!isPaid && (
              <p className="mt-3 flex items-center gap-2 text-xs text-white/50">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Updating booking record…
              </p>
            )}
          </div>
        )}

        {paymentResult === "cancelled" && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-800">Payment cancelled</p>
            <p className="mt-1 text-sm text-amber-700">No charge was made. You can try again whenever you&apos;re ready.</p>
          </div>
        )}

        {/* ── State banners (non-disputed) ── */}

        {isPending && (
          <div className="rounded-3xl bg-[#2f641f] p-7 text-white shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Step 1</div>
            <h1 className="mt-2 text-3xl font-bold leading-tight">Talk to the owner first</h1>
            <p className="mt-3 text-base leading-7 text-white/80">
              Your booking is submitted and awaiting approval. Message the owner to introduce
              yourself, ask questions, and agree on pickup details.
            </p>
            <a
              href={`/messages?other_email=${encodeURIComponent(booking.owner_email || "")}&booking_id=${booking.id}`}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#2f641f] hover:bg-[#f0f8e8]"
            >
              💬 Message the Owner
            </a>
          </div>
        )}

        {isApproved && (
          <div className="rounded-3xl bg-[#2f641f] p-7 text-white shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Action required — owner approved your booking
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight">Ready to pay?</h1>
            <p className="mt-3 text-base leading-7 text-white/80">
              The owner approved your request. Confirm and pay now to lock in the rental.
              Your payment is held in escrow until the tool is safely returned.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white/80">
              🔒 Payment held in escrow · released after safe return
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleConfirmAndPay}
                disabled={confirming || paying}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3 text-sm font-bold text-[#2f641f] shadow transition hover:bg-[#f0f8e8] disabled:opacity-60"
              >
                {confirming ? "Confirming…" : paying ? "Redirecting to Stripe…" : "💳 Confirm & Pay Now →"}
              </button>
              <a
                href={`/messages?other_email=${encodeURIComponent(booking.owner_email || "")}&booking_id=${booking.id}`}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                💬 Ask owner a question
              </a>
            </div>
            {payError && <p className="mt-3 text-xs text-red-200">⚠ {payError}</p>}
          </div>
        )}

        {isConfirmed && !isPaid && paymentResult !== "success" && (
          <div className="rounded-3xl bg-purple-600 p-7 text-white shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Final step</div>
            <h1 className="mt-2 text-3xl font-bold">Pay to complete your booking</h1>
            <p className="mt-3 text-base leading-7 text-white/80">
              Both parties confirmed. Complete payment via Stripe to lock in the rental.
              Your money is held in escrow until the tool is returned safely.
            </p>
            <div className="mt-5 rounded-2xl bg-white/15 px-4 py-3 text-sm text-white/90">
              🔒 <strong>Escrow:</strong> your payment is held securely and released to the owner only after you confirm the return.
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={handlePay}
                disabled={paying}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3 text-sm font-bold text-purple-700 shadow transition hover:bg-purple-50 disabled:opacity-60"
              >
                {paying ? "Redirecting to Stripe…" : "💳 Pay Now"}
              </button>
              <a
                href={`/messages?other_email=${encodeURIComponent(booking.owner_email || "")}&booking_id=${booking.id}`}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/40 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                💬 Message Owner
              </a>
            </div>
            {payError && <p className="mt-3 text-xs text-red-200">⚠ {payError}</p>}
          </div>
        )}

        {isReturning && (
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Return in progress</div>
            <h2 className="mt-2 text-xl font-bold text-indigo-900">📦 Tool return initiated</h2>
            <p className="mt-2 text-sm leading-6 text-indigo-700">
              The owner has marked the tool as returned. They are reviewing its condition.
              Your payment will be released once they confirm everything is in order.
            </p>
          </div>
        )}

        {isComplete && (
          <div className="rounded-3xl bg-[#2f641f] p-7 text-white shadow-lg">
            <h1 className="text-2xl font-bold">🎉 Rental Complete!</h1>
            <p className="mt-2 text-sm leading-6 text-white/80">
              Thank you for using AirTool.nz. The owner has confirmed the tool return.
              Payment has been released from escrow. Enjoy your project!
            </p>
          </div>
        )}

        {/* ── Booking summary card ── */}
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            {tool?.image_url ? (
              <img src={tool.image_url} alt={tool.name || "Tool"} className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 text-2xl">🔧</div>
            )}
            <div className="flex-1 min-w-0">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badge.color}`}>
                {badge.text}
              </div>
              <h2 className="mt-2 text-xl font-bold text-gray-900 truncate">
                {tool?.name || `Tool #${booking.tool_id}`}
              </h2>
              <p className="mt-0.5 text-sm text-gray-400">Booking #{booking.id}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Rental Window</p>
              <p className="mt-1 font-semibold text-gray-900">{rentalWindow}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest">You Pay</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {booking.price_total != null ? `$${Number(booking.price_total).toFixed(2)}` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">Platform fee included</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Owner Receives</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {ownerPayout != null ? `$${ownerPayout.toFixed(2)}` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">After 15% platform fee</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Payment</p>
              <p className="mt-1 font-semibold text-gray-900">
                {booking.paid_at
                  ? `✅ Paid — ${new Date(booking.paid_at).toLocaleString("en-NZ")}`
                  : "⏳ Not yet paid"}
              </p>
              {booking.stripe_session_id && (
                <p className="mt-0.5 text-xs text-gray-400 font-mono">
                  Session: {booking.stripe_session_id.slice(0, 28)}…
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/5 pt-5">
            <a
              href={`/messages?other_email=${encodeURIComponent(booking.owner_email || "")}&booking_id=${booking.id}`}
              className="rounded-2xl bg-[#2f641f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245018]"
            >
              💬 Messages
            </a>
            <button
              onClick={() => router.push("/renter")}
              className="rounded-2xl border border-black/15 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              My Dashboard
            </button>
            {canCancel && (
              <button
                onClick={async () => {
                  if (!confirm("Cancel this booking?")) return;
                  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
                  setBooking((prev) => prev ? { ...prev, status: "cancelled" } : prev);
                }}
                className="ml-auto text-xs text-red-400 hover:text-red-600"
              >
                Cancel booking
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Your personal details are managed in{" "}
          <button onClick={() => router.push("/renter")} className="underline hover:text-gray-600">
            My Dashboard
          </button>
          .
        </p>

      </div>
    </div>
  );
}
