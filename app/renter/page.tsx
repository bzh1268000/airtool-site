"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import DashboardShell from "../components/dashboard-shell";
import BookingChat from "../components/booking-chat";
import { useRouter } from "next/navigation";

type DisputeRecord = {
  id: number;
  booking_id: number;
  reason: string | null;
  amount_claimed: number | null;
  status: string | null;
  created_at: string | null;
  renter_response: string | null;
  resolution: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  raised_by?: string | null;
};

type Booking = {
  id: number;
  tool_id: number | null;
  renter_name?: string | null;
  renter_email?: string | null;
  owner_email?: string | null;
  start_date: string | null;
  end_date: string | null;
  preferred_dates?: string | null;
  phone: string | null;
  address: string | null;
  message: string | null;
  status: string | null;
  price_total: number | null;
  platform_fee: number | null;
  created_at: string | null;
  renter_confirmed?: boolean | null;
  renter_confirmed_at?: string | null;
  owner_confirmed?: boolean | null;
  owner_confirmed_at?: string | null;
  confirmed_at?: string | null;
  paid_at?: string | null;
};

type Tool = {
  id: number;
  name: string | null;
};

type Review = {
  booking_id: number;
  rating: number;
  content: string | null;
  created_at: string | null;
};

type Profile = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  prefer_delivery?: string | null;
  role?: string | null;
  successful_transactions?: number | null;
};

const statusColorMap: Record<string, string> = {
  new:           "bg-yellow-100 text-yellow-800",
  pending:       "bg-yellow-100 text-yellow-800",
  waiting_renter:"bg-orange-100 text-orange-800",
  waiting_owner: "bg-orange-100 text-orange-800",
  waiting_both:  "bg-orange-100 text-orange-800",
  approved:      "bg-blue-100 text-blue-700",
  confirmed:     "bg-green-100 text-green-700",
  in_use:        "bg-green-100 text-green-700",
  return_check:  "bg-indigo-100 text-indigo-700",
  returning:     "bg-indigo-100 text-indigo-700",
  completed:     "bg-gray-100 text-gray-700",
  review:        "bg-amber-100 text-amber-700",
  disputed:      "bg-red-100 text-red-700",
  declined:      "bg-red-100 text-red-700",
  cancelled:     "bg-gray-200 text-gray-700",
};

function getRenterStatusLabel(b: Booking): string {
  switch (b.status) {
    case "pending":        return "Waiting for owner to respond";
    case "waiting_owner":  return "✅ You confirmed — waiting for owner to confirm";
    case "waiting_renter": return "⚡ Please confirm this booking";
    case "waiting_both":   return "Waiting for both parties to confirm";
    case "confirmed":      return b.paid_at ? "🎉 Paid & confirmed — please arrange pickup" : "✅ Confirmed — payment required to complete booking";
    case "in_use":         return "✅ Tool in use — enjoy your rental!";
    case "return_check":
    case "returning":      return "📦 Return check in progress — owner reviewing condition";
    case "completed":      return "✅ Completed — rental finished";
    case "review":         return "⭐ Please review your experience";
    case "disputed":       return "⚠️ Dispute open — under review by AirTool team";
    default:               return b.status || "pending";
  }
}

export default function RenterPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [toolsMap, setToolsMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [errorText, setErrorText] = useState("");

  // Profile panel
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Editable profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [preferDelivery, setPreferDelivery] = useState("pickup");

  // Review state
  const [reviewingBookingId, setReviewingBookingId] = useState<number | null>(null);
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [reviewVideos, setReviewVideos] = useState<File[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<number>>(new Set());
  const [reviewsMap, setReviewsMap] = useState<Record<number, Review>>({});

  // Unread messages
  const [unreadCount, setUnreadCount] = useState(0);

  // Experience points — message conversations (async); rest derived from bookings
  const [xpMessageConvos, setXpMessageConvos] = useState(0);

  // DB-persisted XP from experience_points table
  const [dbXp, setDbXp] = useState<number | null>(null);
  const [xpBreakdown, setXpBreakdown] = useState<{ event_type: string; points: number; booking_id: number; created_at: string }[]>([]);

  // Confirmation cancel state
  const [cancelConfirmBookingId, setCancelConfirmBookingId] = useState<number | null>(null);
  const [cancelConfirmReason, setCancelConfirmReason] = useState("");

  // Disputes — keyed by booking_id
  const [disputesMap, setDisputesMap] = useState<Record<number, DisputeRecord>>({});

  // Promo tools count
  const [promoCount, setPromoCount] = useState(0);

  // Renter-initiated dispute state
  const [renterDisputeBookingId, setRenterDisputeBookingId] = useState<number | null>(null);
  const [renterDisputeReason, setRenterDisputeReason] = useState("");
  const [renterDisputeAmount, setRenterDisputeAmount] = useState("");
  const [renterDisputeFiles, setRenterDisputeFiles] = useState<File[]>([]);
  const [renterDisputeSubmitting, setRenterDisputeSubmitting] = useState(false);

  useEffect(() => {
    const fetchRenterData = async (user: any) => {
      setLoading(true);
      setErrorText("");

      setUserEmail(user.email);
      setUserId(user.id);

      // Fetch accumulated XP from DB
      const { data: xpRows } = await supabase
        .from("experience_points")
        .select("event_type, points, booking_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (xpRows) {
        const total = (xpRows as { points: number }[]).reduce((sum, r) => sum + (r.points || 0), 0);
        setDbXp(total);
        setXpBreakdown(xpRows as { event_type: string; points: number; booking_id: number; created_at: string }[]);
      }

      const { data: toolsData, error: toolsError } = await supabase
        .from("tools")
        .select("id,name");

      if (!toolsError && toolsData) {
        const map: Record<number, string> = {};
        (toolsData as Tool[]).forEach((tool) => {
          if (typeof tool.id === "number") {
            map[tool.id] = tool.name || `Tool #${tool.id}`;
          }
        });
        setToolsMap(map);
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_email", user.email)
        .order("created_at", { ascending: false });

      if (bookingsError) {
        setErrorText(bookingsError.message);
        setLoading(false);
        return;
      }

      const bks = (bookingsData as Booking[]) || [];
      setBookings(bks);

      // Fetch disputes for any disputed bookings
      const disputedIds = bks.filter((b) => b.status === "disputed").map((b) => b.id);
      if (disputedIds.length > 0) {
        const { data: disputeRows } = await supabase
          .from("disputes")
          .select("id, booking_id, reason, amount_claimed, status, created_at, renter_response, resolution, admin_notes, resolved_at")
          .in("booking_id", disputedIds);
        if (disputeRows) {
          const map: Record<number, DisputeRecord> = {};
          for (const d of disputeRows as DisputeRecord[]) map[d.booking_id] = d;
          setDisputesMap(map);
        }
      }

      // Count tools with active promo prices
      const { count: activePromoCount } = await supabase
        .from("tools")
        .select("*", { count: "exact", head: true })
        .not("promo_price", "is", null)
        .eq("status", "active");
      setPromoCount(activePromoCount || 0);

      // Initial unread count + XP message-convos — run in parallel
      const [{ count: initCount }, { data: msgData }] = await Promise.all([
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_email", user.email)
          .eq("is_read", false),
        supabase
          .from("messages")
          .select("booking_id")
          .eq("sender_email", user.email),
      ]);
      setUnreadCount(initCount || 0);
      const convos = new Set(
        ((msgData || []) as { booking_id: number }[]).map((m) => m.booking_id)
      ).size;
      setXpMessageConvos(convos);

      const { data: existingReviews } = await supabase
        .from("reviews")
        .select("booking_id, rating, content, created_at")
        .eq("reviewer_id", user.id);

      if (existingReviews) {
        setReviewedBookingIds(
          new Set(existingReviews.map((r) => Number(r.booking_id)))
        );
        const map: Record<number, Review> = {};
        (existingReviews as Review[]).forEach((r) => { map[Number(r.booking_id)] = r; });
        setReviewsMap(map);
      }

      setLoading(false);
    };

    let cancelled = false;

    supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session?.user) {
        fetchRenterData(session.user);
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => { cancelled = true; };
  }, [router]);

  // Re-query unread count on demand
  const fetchUnreadCount = async () => {
    if (!userEmail) return;
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_email", userEmail)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  };

  // Refresh unread count on window focus (returning from /messages)
  // and every 30 seconds while the page is open
  useEffect(() => {
    if (!userEmail) return;
    const handleFocus = () => fetchUnreadCount();
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [userEmail]);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        fetchUnreadCount();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [userEmail]);

  const loadProfile = async () => {
    if (!userId) return;
    setProfileLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone, address, suburb, city, id_type, id_number, prefer_delivery, role, successful_transactions")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
      setAddress(data.address || "");
      setSuburb(data.suburb || "");
      setCity(data.city || "");
      setIdType(data.id_type || "");
      setIdNumber(data.id_number || "");
      setPreferDelivery(data.prefer_delivery || "pickup");
    }

    setProfileLoading(false);
  };

  const handleOpenProfile = () => {
    setShowProfile(true);
    setProfileMsg("");
    loadProfile();
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        address,
        suburb,
        city,
        id_type: idType,
        id_number: idNumber,
        prefer_delivery: preferDelivery,
      })
      .eq("id", userId);

    if (error) {
      setProfileMsg("❌ Failed to save: " + error.message);
    } else {
      setProfileMsg("✅ Profile updated successfully!");
    }

    setProfileSaving(false);
  };

  const totalBookings = bookings.length;

  const newBookings = useMemo(
    () => bookings.filter((b) =>
      b.status === "new" || b.status === "pending" || !b.status
    ).length,
    [bookings]
  );

  const approvedBookings = useMemo(
    () => bookings.filter((b) => b.status === "approved").length,
    [bookings]
  );

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === "completed").length,
    [bookings]
  );

  const totalSpent = useMemo(
    () => bookings.reduce((sum, b) => sum + Number(b.price_total || 0), 0),
    [bookings]
  );

  // ── Experience / trust points (derived — no extra DB column needed) ─────────
  // +1 per unique booking conversation the renter started
  // +1 per booking renter confirmed
  // +1 per booking that reached pickup  (in_use / return_check / completed / review)
  // +1 per booking that was returned    (completed / review)
  // +1 per review written
  const renterXp = useMemo(() => {
    const { confirms, pickups, returns } = bookings.reduce(
      (acc, b) => {
        if (b.renter_confirmed) acc.confirms++;
        if (["in_use", "return_check", "completed", "review"].includes(b.status || "")) acc.pickups++;
        if (["completed", "review"].includes(b.status || "")) acc.returns++;
        return acc;
      },
      { confirms: 0, pickups: 0, returns: 0 },
    );
    return xpMessageConvos + confirms + pickups + returns + reviewedBookingIds.size;
  }, [bookings, xpMessageConvos, reviewedBookingIds]);

  // Use DB total when available, fall back to client-side calculation
  const displayXp = dbXp !== null ? dbXp : renterXp;

  const xpLevel =
    displayXp >= 20 ? "Champion" :
    displayXp >= 10 ? "Trusted"  :
    displayXp >= 5  ? "Regular"  :
    "Newcomer";

  // ── Booking sort: urgent / action-needed first, then most recent ─────────────
  const sortedBookings = useMemo(() => {
    const priority = (status: string): number => {
      switch (status) {
        case 'disputed':      return 0  // highest — action needed now
        case 'waiting_renter':
        case 'waiting_both':  return 1  // renter must act
        case 'approved':      return 2  // needs confirm + pay
        case 'confirmed':     return 3  // payment pending
        case 'in_use':        return 4  // active rental
        case 'return_check':
        case 'returning':     return 5  // return in progress
        case 'pending':
        case 'waiting_owner':
        case 'new':           return 6  // waiting on owner
        case 'review':        return 7  // review needed
        case 'completed':     return 8  // finished
        case 'cancelled':
        case 'declined':
        case 'rejected':      return 9  // archived — bottom
        default:              return 6
      }
    }

    return [...bookings].sort((a, b) => {
      const pd = priority(a.status ?? '') - priority(b.status ?? '')
      if (pd !== 0) return pd
      // within same priority: newer end_date first
      const aDate = new Date(a.end_date || a.created_at || 0).getTime()
      const bDate = new Date(b.end_date || b.created_at || 0).getTime()
      return bDate - aDate
    })
  }, [bookings]);

  const xpBadgeColor =
    displayXp >= 20 ? "bg-amber-500"  :
    displayXp >= 10 ? "bg-indigo-600" :
    displayXp >= 5  ? "bg-blue-500"   :
    "bg-gray-400";

  const handleSubmitReview = async (booking: Booking) => {
    if (!reviewScore) {
      setReviewMsg("Please select a star rating first.");
      return;
    }

    setReviewSubmitting(true);
    setReviewMsg("");

    // Upload photos
    const photoUrls: string[] = [];
    for (let i = 0; i < reviewPhotos.length; i++) {
      const file = reviewPhotos[i];
      const ext = file.name.split(".").pop();
      const path = `${userId}/${booking.id}/photo-${i}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("review-media").upload(path, file, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("review-media").getPublicUrl(path);
        photoUrls.push(urlData.publicUrl);
      }
    }

    // Upload videos
    const videoUrls: string[] = [];
    for (let i = 0; i < reviewVideos.length; i++) {
      const file = reviewVideos[i];
      const ext = file.name.split(".").pop();
      const path = `${userId}/${booking.id}/video-${i}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("review-media").upload(path, file, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("review-media").getPublicUrl(path);
        videoUrls.push(urlData.publicUrl);
      }
    }

    const { error } = await supabase.from("reviews").insert([{
      booking_id: booking.id,
      reviewer_id: userId,
      reviewer_role: "renter",
      target_type: "tool",
      target_id: booking.tool_id,
      rating: reviewScore,
      content: reviewContent.trim() || null,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
      video_urls: videoUrls.length > 0 ? videoUrls : null,
    }]);

    if (error) {
      setReviewMsg("Submission failed: " + error.message);
      setReviewSubmitting(false);
      return;
    }

    fetch('/api/xp/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: booking.id, new_status: 'review_written' }),
    })

    setReviewedBookingIds((prev) => new Set([...prev, booking.id]));
    setReviewsMap((prev) => ({
      ...prev,
      [booking.id]: { booking_id: booking.id, rating: reviewScore, content: reviewContent.trim() || null, created_at: new Date().toISOString() },
    }));
    setReviewingBookingId(null);
    setReviewScore(0);
    setReviewContent("");
    setReviewPhotos([]);
    setReviewVideos([]);
    setReviewMsg("");
    setReviewSubmitting(false);
  };

  const sendSystemMessage = async (bookingId: number, ownerEmail: string | null | undefined, text: string) => {
    if (!ownerEmail || !userEmail) return;
    await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_email: userEmail,
      receiver_email: ownerEmail,
      message: text,
    });
  };

  const confirmBooking = async (b: Booking) => {
    const ok = window.confirm("Confirm this booking? This means you agree to proceed with the rental.");
    if (!ok) return;

    const bothConfirmed = b.owner_confirmed === true;
    const newStatus = bothConfirmed ? "confirmed" : "waiting_owner";
    const updates: Record<string, unknown> = {
      renter_confirmed: true,
      renter_confirmed_at: new Date().toISOString(),
      status: newStatus,
    };
    if (bothConfirmed) updates.confirmed_at = new Date().toISOString();

    const { error } = await supabase.from("bookings").update(updates).eq("id", b.id);
    if (error) { alert("Failed to confirm: " + error.message); return; }

    // Write to booking_confirmations
    await supabase.from("booking_confirmations").insert({
      booking_id: b.id,
      user_role: "renter",
      action: "confirmed",
    });

    // System message
    const msg = bothConfirmed
      ? "🎉 Both parties have confirmed the booking!"
      : "✅ Renter confirmed the booking — waiting for owner to confirm";
    await sendSystemMessage(b.id, b.owner_email, msg);

    setBookings((prev) => prev.map((bk) => bk.id === b.id ? { ...bk, ...updates } : bk));
  };

  const withdrawConfirmation = async (b: Booking) => {
    const reason = cancelConfirmReason.trim();
    const { error } = await supabase.from("bookings")
      .update({ renter_confirmed: false, status: "pending" })
      .eq("id", b.id);
    if (error) { alert("Failed: " + error.message); return; }

    await supabase.from("booking_confirmations").insert({
      booking_id: b.id,
      user_role: "renter",
      action: "withdrawn",
      reason: reason || null,
    });

    await sendSystemMessage(b.id, b.owner_email, "⚠️ Renter withdrew their confirmation — booking returned to pending");

    setBookings((prev) => prev.map((bk) =>
      bk.id === b.id ? { ...bk, renter_confirmed: false, status: "pending" } : bk
    ));
    setCancelConfirmBookingId(null);
    setCancelConfirmReason("");
  };

  const cancelBooking = async (bookingId: number) => {
    const ok = window.confirm(`Cancel booking #${bookingId}?`);
    if (!ok) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      alert(`Failed: ${error.message}`);
      return;
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
    );
  };

  const handleRaiseRenterDispute = async (b: Booking) => {
    if (!renterDisputeReason.trim()) { alert("Please describe the issue."); return; }
    setRenterDisputeSubmitting(true);
    try {
      let evidenceUrls: string[] = [];
      if (renterDisputeFiles.length > 0) {
        for (const file of renterDisputeFiles) {
          const path = `booking-${b.id}/renter/${Date.now()}-${file.name}`;
          const { error } = await supabase.storage.from("dispute-evidence").upload(path, file);
          if (!error) evidenceUrls.push(path);
        }
      }

      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId:          b.id,
          ownerEmail:         b.owner_email,
          renterEmail:        b.renter_email || userEmail,
          reason:             renterDisputeReason.trim(),
          amountClaimed:      renterDisputeAmount ? Number(renterDisputeAmount) : null,
          renterEvidenceUrls: evidenceUrls,
          raisedBy:           "renter",
        }),
      });
      const j = await res.json();
      if (!res.ok) { alert("Failed to raise dispute: " + (j.error || "Unknown error")); setRenterDisputeSubmitting(false); return; }

      setBookings((prev) => prev.map((bk) => bk.id === b.id ? { ...bk, status: "disputed" } : bk));
      setDisputesMap((prev) => ({
        ...prev,
        [b.id]: {
          id: 0,
          booking_id:      b.id,
          reason:          renterDisputeReason.trim(),
          amount_claimed:  renterDisputeAmount ? Number(renterDisputeAmount) : null,
          status:          "open",
          created_at:      new Date().toISOString(),
          renter_response: null,
          resolution:      null,
          admin_notes:     null,
          resolved_at:     null,
        },
      }));
      setRenterDisputeBookingId(null);
      setRenterDisputeReason("");
      setRenterDisputeAmount("");
      setRenterDisputeFiles([]);
    } finally {
      setRenterDisputeSubmitting(false);
    }
  };

  return (
    <DashboardShell
      title="Renter Dashboard"
      subtitle={`Renter: ${userEmail || "-"}`}
    >
      <div className="grid gap-6">

        {/* "Pay now" banners — one per approved booking */}
        {bookings
          .filter((b) => b.status === "approved")
          .map((b) => (
            <a
              key={b.id}
              href={`/my-booking/${b.id}`}
              className="flex items-center gap-4 rounded-2xl bg-[#2f641f] px-5 py-4 shadow-md hover:bg-[#245018] transition"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2f641f] text-lg font-bold shadow">
                💳
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">
                  ✅ Booking approved — action required!
                </p>
                <p className="mt-0.5 text-xs text-white/70 truncate">
                  {toolsMap[b.tool_id || 0] || `Booking #${b.id}`}
                  {b.preferred_dates ? ` · ${b.preferred_dates.split("(")[0].trim()}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#2f641f]">
                Confirm &amp; Pay →
              </span>
            </a>
          ))
        }

        {/* Unread messages banner — hidden when count is 0 */}
        {unreadCount > 0 && (
          <a
            href="/messages"
            className="flex items-center gap-4 rounded-2xl bg-orange-500 px-5 py-4 shadow-md hover:bg-orange-600 transition"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-orange-600 text-lg font-bold shadow">
              {unreadCount}
            </span>
            <p className="text-sm font-bold text-white">
              💬 You have {unreadCount} unread message{unreadCount > 1 ? "s" : ""} — Check here
            </p>
            <span className="ml-auto text-white/80 text-sm">→</span>
          </a>
        )}

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-sm text-gray-500">Total</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totalBookings}</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{newBookings}</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{approvedBookings}</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{completedBookings}</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-sm text-gray-500">Total Spent</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">${totalSpent.toFixed(2)}</p>
          </div>
        </div>

        {/* Points panels */}
        <div className="grid gap-4 sm:grid-cols-3">

          {/* Trust Score */}
          <div className="rounded-3xl border border-indigo-100 bg-white/30 px-5 py-4 backdrop-blur-md sm:col-span-3">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${xpBadgeColor} text-white text-2xl font-bold shadow`}>
                {displayXp}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">Trust Score</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${xpBadgeColor}`}>
                    {xpLevel}
                  </span>
                  {dbXp !== null && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                      ✓ Live
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Earned by confirming bookings, completing rentals &amp; more
                </p>
              </div>
              <div className="hidden sm:block shrink-0 text-right">
                <p className="text-xs text-gray-400">Next level</p>
                <p className="text-sm font-bold text-indigo-600">
                  {displayXp >= 20 ? "Max reached 🏆" :
                   displayXp >= 10 ? `${20 - displayXp} pts to Champion` :
                   displayXp >= 5  ? `${10 - displayXp} pts to Trusted`  :
                   `${5 - displayXp} pts to Regular`}
                </p>
              </div>
            </div>

            {/* Trust Score breakdown — recent events */}
            {xpBreakdown.length > 0 && (
              <div className="mt-4 border-t border-indigo-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">How you earned your Trust Score</p>
                <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {xpBreakdown.slice(0, 6).map((row, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-xs">
                      <span className="text-gray-600">
                        {row.event_type === "booking_confirmed"  && "✅ Booking confirmed"}
                        {row.event_type === "booking_approved"   && "👍 Booking approved"}
                        {row.event_type === "booking_in_use"     && "🔧 Tool picked up"}
                        {row.event_type === "booking_completed"  && "🎉 Rental completed"}
                        {row.event_type === "booking_disputed"   && "⚠️ Dispute opened"}
                        {row.event_type === "booking_cancelled"  && "❌ Booking cancelled"}
                        {row.event_type === "review_written"     && "⭐ Review written"}
                        {row.event_type === "dispute_won"        && "🏆 Dispute won"}
                        {row.event_type === "dispute_lost"       && "💔 Dispute lost"}
                        {!["booking_confirmed","booking_approved","booking_in_use","booking_completed","booking_disputed","booking_cancelled","review_written","dispute_won","dispute_lost"].includes(row.event_type) && row.event_type}
                        {" "}
                        <span className="text-gray-400">#{row.booking_id}</span>
                      </span>
                      <span className={`ml-2 font-bold ${row.points >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {row.points >= 0 ? "+" : ""}{row.points} pts
                      </span>
                    </div>
                  ))}
                </div>
                {xpBreakdown.length > 6 && (
                  <p className="mt-2 text-xs text-gray-400 text-center">
                    +{xpBreakdown.length - 6} more events · {xpBreakdown.reduce((s, r) => s + r.points, 0)} pts total
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tool Points */}
          <div className="rounded-3xl border border-yellow-100 bg-white/30 px-5 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-white text-xl font-bold shadow">
                {reviewedBookingIds.size}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Tool Points</p>
                <p className="mt-0.5 text-xs text-gray-500">Tools you have reviewed</p>
              </div>
            </div>
          </div>

          {/* Community Points — coming soon */}
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white/20 px-5 py-4 backdrop-blur-md sm:col-span-2 opacity-60">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-300 text-white text-xl font-bold shadow">
                🔒
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Community Points</p>
                <p className="mt-0.5 text-xs text-gray-400">Coming soon — earn points by helping grow the AirTool community</p>
              </div>
            </div>
          </div>

        </div>

        {/* Action buttons */}
        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => document.getElementById("bookings-list")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Bookings ({bookings.length})
          </button>
          <button
            onClick={() => router.push("/search?promo=1")}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Promotions Nearby ({promoCount})
          </button>
          <button
            onClick={() => router.push("/search")}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Browse More Tools
          </button>
          <button
            onClick={handleOpenProfile}
            className="rounded-2xl border border-[#8bbb46] bg-[#f0f8e8] px-4 py-3 text-sm font-semibold text-[#2f641f] hover:bg-[#e4f5d4]"
          >
            👤 My Profile
          </button>
        </div>

        {/* Profile panel */}
        {showProfile && (
          <div className="rounded-3xl border border-[#8bbb46]/30 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Personal Info</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Role: <span className="font-semibold text-[#2f641f] uppercase">{profile.role || "renter"}</span>
                  {" · "}
                  Successful transactions: <span className="font-semibold">{profile.successful_transactions || 0}</span>
                  {profile.successful_transactions !== undefined && profile.successful_transactions < 3 && (
                    <span className="ml-2 text-xs text-black/40">({3 - (profile.successful_transactions || 0)} more to apply as Owner)</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowProfile(false)}
                className="text-sm text-black/40 hover:text-black"
              >
                ✕ Close
              </button>
            </div>

            {profileLoading ? (
              <p className="text-sm text-gray-500">Loading profile...</p>
            ) : (
              <div className="grid gap-4">

                <div className="text-xs font-semibold uppercase tracking-widest text-black/40">Personal</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-black/60">Full Name</label>
                    <input
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-black/60">Phone</label>
                    <input
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="text-xs font-semibold uppercase tracking-widest text-black/40 pt-2">Address</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs font-semibold text-black/60">Street Address</label>
                    <input
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-black/60">Suburb</label>
                    <input
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                      value={suburb}
                      onChange={(e) => setSuburb(e.target.value)}
                      placeholder="Suburb"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-black/60">City</label>
                    <input
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                </div>

                <div className="text-xs font-semibold uppercase tracking-widest text-black/40 pt-2">Preferred Method</div>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setPreferDelivery("pickup")}
                    className={`rounded-xl border py-3 text-sm font-medium transition ${
                      preferDelivery === "pickup"
                        ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]"
                        : "border-black/15 text-black/60"
                    }`}
                  >
                    📦 Hub Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferDelivery("delivery")}
                    className={`rounded-xl border py-3 text-sm font-medium transition ${
                      preferDelivery === "delivery"
                        ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]"
                        : "border-black/15 text-black/60"
                    }`}
                  >
                    🚚 Delivery
                  </button>
                </div>

                <div className="text-xs font-semibold uppercase tracking-widest text-black/40 pt-2">ID Verification</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-black/60">ID Type</label>
                    <select
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                    >
                      <option value="">Select ID type</option>
                      <option value="drivers_licence">Driver's Licence</option>
                      <option value="passport">Passport</option>
                      <option value="18plus">18+ Card</option>
                      <option value="kiwiaccess">Kiwi Access Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-black/60">ID Number</label>
                    <input
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="ID number"
                    />
                  </div>
                </div>

                {profileMsg && (
                  <div className={`rounded-xl px-4 py-3 text-sm ${
                    profileMsg.startsWith("✅")
                      ? "bg-[#f0f8e8] text-[#2f641f]"
                      : "bg-red-50 text-red-600"
                  }`}>
                    {profileMsg}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="rounded-xl bg-[#8bbb46] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] disabled:opacity-60"
                  >
                    {profileSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => setShowProfile(false)}
                    className="rounded-xl border border-black/15 px-6 py-3 text-sm font-semibold text-black/60 hover:bg-black/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bookings list */}
        <div id="bookings-list" className="scroll-mt-24" />
        {loading ? (
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <p className="text-gray-600">Loading renter bookings...</p>
          </div>
        ) : errorText ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-medium text-red-700">Error</p>
            <p className="mt-2 text-sm text-red-600">{errorText}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <p className="text-gray-600">No bookings found.</p>
            <button
              onClick={() => router.push("/search")}
              className="mt-4 rounded-xl bg-[#8bbb46] px-5 py-2 text-sm font-semibold text-white hover:bg-[#7aaa39]"
            >
              Browse tools
            </button>
          </div>
        ) : (
          <>
          <div className="grid gap-5">
            {sortedBookings.slice(0, 8).map((b) => (
              <div
                key={b.id}
                className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <a
                      href={`/my-booking/${b.id}`}
                      className="text-2xl font-bold text-gray-900 hover:text-[#2f641f] hover:underline"
                    >
                      {toolsMap[b.tool_id || 0] || "Unknown Tool"}
                    </a>
                    {b.tool_id && (
                      <a
                        href={`/tools/${b.tool_id}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#2f641f] hover:underline"
                      >
                        🔧 View tool details →
                      </a>
                    )}
                    <div className="mt-4 flex items-center gap-3">
                      <p className="text-sm text-gray-600">Status:</p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        b.status === "disputed" && disputesMap[b.id]?.status === "resolved"
                          ? "bg-green-100 text-green-700"
                          : statusColorMap[b.status || "new"] || "bg-gray-100 text-gray-800"
                      }`}>
                        {b.status === "disputed" && disputesMap[b.id]?.status === "resolved"
                          ? "dispute resolved"
                          : b.status || "pending"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {b.status === "disputed" && disputesMap[b.id]?.status === "resolved"
                        ? "✅ Dispute resolved — check the outcome below"
                        : getRenterStatusLabel(b)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 text-sm text-gray-700 md:grid-cols-2 xl:grid-cols-3">
                  <p><span className="font-medium text-gray-900">Start date:</span> {b.start_date || "-"}</p>
                  <p><span className="font-medium text-gray-900">End date:</span> {b.end_date || "-"}</p>
                  <p><span className="font-medium text-gray-900">Phone:</span> {b.phone || "-"}</p>
                  <p><span className="font-medium text-gray-900">Address:</span> {b.address || "-"}</p>
                  <p><span className="font-medium text-gray-900">Price total:</span> ${Number(b.price_total || 0).toFixed(2)}</p>
                  <p className="md:col-span-2 xl:col-span-3">
                    <span className="font-medium text-gray-900">Message:</span> {b.message || "-"}
                  </p>
                </div>

                {/* ── Dispute banner — shown prominently when booking is disputed ── */}
                {b.status === "disputed" && (() => {
                  const d = disputesMap[b.id];
                  const isResolved = d?.status === "resolved";
                  return (
                    <div className={`mt-5 overflow-hidden rounded-2xl border-2 ${isResolved ? "border-green-400" : "border-red-500"}`}>
                      {/* Header */}
                      <div className={`flex items-center gap-3 px-5 py-4 ${isResolved ? "bg-green-600" : "bg-red-600"}`}>
                        <span className="text-2xl">{isResolved ? "✅" : "⚠️"}</span>
                        <div className="flex-1">
                          <p className={`text-xs font-bold uppercase tracking-widest ${isResolved ? "text-green-100" : "text-red-200"}`}>
                            {isResolved ? "Dispute resolved" : "Action required"}
                          </p>
                          <p className="text-base font-bold text-white">
                            {d?.raised_by === "renter" ? "Dispute raised by you" : "Dispute raised by owner"}
                          </p>
                        </div>
                        <a
                          href={`/my-booking/${b.id}`}
                          className={`shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold hover:opacity-90 ${isResolved ? "text-green-700" : "text-red-700"}`}
                        >
                          View details →
                        </a>
                      </div>

                      {/* Detail body */}
                      <div className={`px-5 py-4 ${isResolved ? "bg-green-50" : "bg-red-50"}`}>
                        {d ? (
                          <>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="sm:col-span-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                                <p className={`text-xs font-semibold uppercase tracking-widest ${isResolved ? "text-green-500" : "text-red-400"}`}>
                                  {d.raised_by === "renter" ? "Your reason" : "Owner's reason"}
                                </p>
                                <p className="mt-1 text-sm font-medium text-gray-900">{d.reason}</p>
                              </div>
                              <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                                <p className={`text-xs font-semibold uppercase tracking-widest ${isResolved ? "text-green-500" : "text-red-400"}`}>Amount claimed</p>
                                <p className={`mt-1 text-sm font-bold ${isResolved ? "text-green-700" : "text-red-700"}`}>
                                  {d.amount_claimed != null ? `$${Number(d.amount_claimed).toFixed(2)} NZD` : "Not specified"}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                                <p className={`text-xs font-semibold uppercase tracking-widest ${isResolved ? "text-green-500" : "text-red-400"}`}>Status</p>
                                <p className="mt-1 text-sm font-bold">
                                  {isResolved
                                    ? <span className="text-green-700">✅ Resolved</span>
                                    : <span className="text-red-700">🔴 Open</span>}
                                </p>
                              </div>
                              <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                                <p className={`text-xs font-semibold uppercase tracking-widest ${isResolved ? "text-green-500" : "text-red-400"}`}>Date raised</p>
                                <p className="mt-1 text-sm text-gray-700">
                                  {d.created_at ? new Date(d.created_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                                </p>
                              </div>
                            </div>

                            {/* Response / resolution state */}
                            {d.resolution ? (
                              <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-green-600">✅ Dispute resolved</p>
                                <p className="mt-1 text-sm font-semibold text-green-900">
                                  {d.resolution === "release_to_owner" && "Payment released to owner."}
                                  {d.resolution === "partial_refund"   && "Partial refund issued to you."}
                                  {d.resolution === "full_refund"      && "Full refund issued to you."}
                                </p>
                                {d.admin_notes && <p className="mt-1 text-xs text-green-700">{d.admin_notes}</p>}
                              </div>
                            ) : d.renter_response ? (
                              <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <span className="text-lg">⏳</span>
                                <p className="text-sm text-amber-800">
                                  <span className="font-semibold">Your response was submitted.</span>{" "}
                                  Awaiting AirTool admin decision.
                                </p>
                              </div>
                            ) : (
                              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                                <p className="text-sm font-semibold text-blue-800">
                                  💬 You haven&rsquo;t responded yet — your response is important.
                                </p>
                                <a
                                  href={`/my-booking/${b.id}`}
                                  className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                                >
                                  Respond now →
                                </a>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-red-600">
                            Loading dispute details…{" "}
                            <a href={`/my-booking/${b.id}`} className="font-semibold underline">
                              View on booking page →
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-5 flex flex-wrap gap-3">

                  {/* ── Pay Now — prominent CTA when confirmed but not yet paid ── */}
                  {b.status === "confirmed" && !b.paid_at && (
                    <a
                      href={`/my-booking/${b.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#2f641f] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#245018] transition"
                    >
                      💳 Pay Now — ${Number(b.price_total || 0).toFixed(2)}
                    </a>
                  )}

                  {/* Paid badge */}
                  {b.paid_at && (
                    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                      ✅ Paid
                    </span>
                  )}

                  {/* Confirm booking button */}
                  {(b.status === "pending" || b.status === "waiting_renter" || b.status === "waiting_both") && !b.renter_confirmed && (
                    <button
                      onClick={() => confirmBooking(b)}
                      className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      ✅ Confirm Booking
                    </button>
                  )}

                  {/* Withdraw confirmation button */}
                  {b.renter_confirmed && b.status !== "confirmed" && !b.paid_at && (
                    cancelConfirmBookingId === b.id ? (
                      <div className="flex w-full flex-col gap-2 rounded-2xl border border-orange-200 bg-orange-50 p-3">
                        <p className="text-sm font-semibold text-orange-800">Withdraw confirmation?</p>
                        <input
                          value={cancelConfirmReason}
                          onChange={(e) => setCancelConfirmReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="rounded-xl border border-orange-200 px-3 py-2 text-sm outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => withdrawConfirmation(b)}
                            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                          >
                            Yes, withdraw
                          </button>
                          <button
                            onClick={() => { setCancelConfirmBookingId(null); setCancelConfirmReason(""); }}
                            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCancelConfirmBookingId(b.id)}
                        className="rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                      >
                        ↩ Withdraw Confirmation
                      </button>
                    )
                  )}

                  {/* Legacy confirmed badge (both confirmed) */}
                  {b.status === "confirmed" && (
                    <span className="inline-flex items-center rounded-2xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                      🎉 Confirmed
                    </span>
                  )}

                  {/* Waiting badge */}
                  {b.status === "waiting_owner" && (
                    <span className="inline-flex items-center rounded-2xl bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">
                      ⏳ Waiting for owner…
                    </span>
                  )}

                  <BookingChat
                    bookingId={b.id}
                    myEmail={userEmail}
                    otherEmail={b.owner_email || ""}
                    label="💬 Message Owner"
                  />
                  <button
                    onClick={() => cancelBooking(b.id)}
                    disabled={b.status === "completed" || b.status === "cancelled" || b.status === "confirmed"}
                    className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  {/* Raise dispute — available while tool is in use or during return check */}
                  {(b.status === "in_use" || b.status === "return_check") && !disputesMap[b.id] && (
                    <button
                      onClick={() => { setRenterDisputeBookingId(b.id); setRenterDisputeReason(""); setRenterDisputeAmount(""); setRenterDisputeFiles([]); }}
                      className="rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                    >
                      ⚠️ Raise Dispute
                    </button>
                  )}

                  {/* Review button — only for completed bookings */}
                  {b.status === "completed" && (
                    reviewedBookingIds.has(b.id) ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500">
                          Reviewed ✓
                        </span>
                        {reviewsMap[b.id] && (
                          <div className="mt-1 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm">
                            <div className="flex items-center gap-0.5 text-yellow-400 text-base">
                              {[1,2,3,4,5].map(s => <span key={s}>{s <= reviewsMap[b.id].rating ? "★" : "☆"}</span>)}
                            </div>
                            {reviewsMap[b.id].content && (
                              <p className="mt-1 text-gray-700">{reviewsMap[b.id].content}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReviewingBookingId(b.id);
                          setReviewScore(0);
                          setReviewContent("");
                          setReviewPhotos([]);
                          setReviewVideos([]);
                          setReviewMsg("");
                        }}
                        className="rounded-2xl bg-[#8bbb46] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7aaa39]"
                      >
                        ⭐ Write a Review
                      </button>
                    )
                  )}
                </div>

                {/* Review form */}
                {b.status === "completed" && reviewingBookingId === b.id && (
                  <div className="mt-5 rounded-2xl border border-[#8bbb46]/30 bg-[#f8fdf3] p-5 space-y-5">
                    <h3 className="text-base font-bold text-gray-800">Rate this rental</h3>

                    {/* Star rating */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Star Rating *</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewScore(star)}
                            className={`text-3xl leading-none transition-transform hover:scale-110 ${
                              star <= reviewScore ? "text-yellow-400" : "text-gray-200 hover:text-yellow-300"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                        {reviewScore > 0 && (
                          <span className="ml-3 text-sm font-medium text-gray-600">
                            {["", "Terrible", "Poor", "Okay", "Good", "Excellent"][reviewScore]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Your Review</p>
                      <textarea
                        value={reviewContent}
                        onChange={(e) => setReviewContent(e.target.value)}
                        placeholder="Share your experience with this tool..."
                        rows={3}
                        className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] resize-none"
                      />
                    </div>

                    {/* Photos */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                        Photos <span className="normal-case font-normal text-gray-400">(optional)</span>
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setReviewPhotos(Array.from(e.target.files || []))}
                        className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-xl file:border-0 file:bg-[#f0f8e8] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#2f641f] hover:file:bg-[#e4f5d4]"
                      />
                      {reviewPhotos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {reviewPhotos.map((f, i) => (
                            <span key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
                              📷 {f.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Video */}
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">
                        Short Video <span className="normal-case font-normal text-gray-400">(optional)</span>
                      </p>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => setReviewVideos(e.target.files?.[0] ? [e.target.files[0]] : [])}
                        className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-xl file:border-0 file:bg-[#f0f8e8] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#2f641f] hover:file:bg-[#e4f5d4]"
                      />
                      {reviewVideos.length > 0 && (
                        <span className="mt-2 inline-block rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
                          🎥 {reviewVideos[0].name}
                        </span>
                      )}
                    </div>

                    {reviewMsg && (
                      <div className={`rounded-xl px-4 py-3 text-sm ${reviewMsg.startsWith("Submission failed") ? "bg-red-50 text-red-600" : "bg-[#f0f8e8] text-[#2f641f]"}`}>
                        {reviewMsg}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSubmitReview(b)}
                        disabled={reviewSubmitting}
                        className="rounded-xl bg-[#8bbb46] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#7aaa39] disabled:opacity-60"
                      >
                        {reviewSubmitting ? "Submitting..." : "Submit Review"}
                      </button>
                      <button
                        onClick={() => { setReviewingBookingId(null); setReviewMsg(""); }}
                        className="rounded-xl border border-black/15 px-6 py-2.5 text-sm font-semibold text-black/60 hover:bg-black/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Renter dispute form */}
                {renterDisputeBookingId === b.id && (
                  <div className="mt-5 rounded-2xl border-2 border-orange-300 bg-orange-50 p-5 space-y-4">
                    <p className="text-sm font-bold text-orange-800">⚠️ Raise a Dispute</p>
                    <textarea
                      value={renterDisputeReason}
                      onChange={(e) => setRenterDisputeReason(e.target.value)}
                      placeholder="Describe the issue (e.g. tool was damaged, not as described, owner didn't show up)..."
                      rows={3}
                      className="w-full rounded-xl border border-orange-200 px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none bg-white"
                    />
                    <div className="flex gap-3 flex-wrap">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={renterDisputeAmount}
                        onChange={(e) => setRenterDisputeAmount(e.target.value)}
                        placeholder="Amount claimed (optional, NZD)"
                        className="rounded-xl border border-orange-200 px-4 py-2 text-sm outline-none focus:border-orange-400 bg-white w-56"
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={(e) => setRenterDisputeFiles(Array.from(e.target.files || []))}
                          className="hidden"
                        />
                        <span className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100">
                          📎 Add evidence {renterDisputeFiles.length > 0 && `(${renterDisputeFiles.length} files)`}
                        </span>
                      </label>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleRaiseRenterDispute(b)}
                        disabled={renterDisputeSubmitting}
                        className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        {renterDisputeSubmitting ? "Submitting…" : "Submit Dispute"}
                      </button>
                      <button
                        onClick={() => { setRenterDisputeBookingId(null); setRenterDisputeFiles([]); }}
                        className="rounded-xl border border-black/15 px-6 py-2.5 text-sm font-semibold text-black/60 hover:bg-black/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <p className="mt-5 text-xs text-gray-400">
                  {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
                </p>
              </div>
            ))}
          </div>
          {sortedBookings.length > 8 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                Showing 8 of {sortedBookings.length} bookings — export for full history
              </span>
              <button
                onClick={() => {
                  const headers = ["ID","Tool","Status","Start Date","End Date","Preferred Dates","Price Total","Platform Fee","Phone","Address","Message","Created At"];
                  const rows = sortedBookings.map((b) => [
                    b.id,
                    toolsMap[b.tool_id || 0] || "",
                    b.status || "",
                    b.start_date || "",
                    b.end_date || "",
                    b.preferred_dates || "",
                    b.price_total ?? "",
                    b.platform_fee ?? "",
                    b.phone || "",
                    b.address || "",
                    b.message || "",
                    b.created_at || "",
                  ]);
                  const csv = [headers, ...rows]
                    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
                    .join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "my-bookings.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                More… (export all as CSV)
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
