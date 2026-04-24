"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import DashboardShell from "../components/dashboard-shell";
import BookingChat from "../components/booking-chat";
import DisputeTimeline, { type DisputeRecord } from "../components/dispute-timeline";

type Booking = {
  id: number;
  tool_id: number | null;
  user_name?: string | null;
  user_email?: string | null;
  renter_confirmed?: boolean | null;
  renter_confirmed_at?: string | null;
  owner_confirmed?: boolean | null;
  owner_confirmed_at?: string | null;
  confirmed_at?: string | null;
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
  owner_email: string | null;
  paid_at?: string | null;
  payout_status?: string | null;
  payout_amount?: number | null;
  payout_bank_account?: string | null;
  payout_date?: string | null;
  payout_note?: string | null;
};

type Tool = {
  id: number;
  name: string | null;
  description: string | null;
  category: string | null;
  condition: string | null;
  sale_price: number | null;
  price_per_day: number | null;
  image_url: string | null;
  video_url: string | null;
  promo_price: number | null;
  promo_label: string | null;
  listing_type: string | null;
  status: string | null;
  owner_email: string | null;
  created_at: string | null;
};

const TOOL_CATEGORIES = [
  "Uncategorised",
  "Garden & Outdoor",
  "Power Tools",
  "Hand Tools",
  "Cleaning",
  "Construction",
  "Automotive",
  "Plumbing",
  "Electrical",
  "Ladders & Scaffolding",
  "Other",
] as const;

/** Owner's share of a booking: price minus platform fee, or 85 % if fee is unknown. */
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
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
};

function ownerPayout(priceTotal: number | null, platformFee: number | null): number {
  const price = Number(priceTotal || 0);
  return platformFee != null ? price - Number(platformFee) : price * 0.85;
}

const statusColorMap: Record<string, string> = {
  new:           "bg-yellow-100 text-yellow-800",
  pending:       "bg-yellow-100 text-yellow-800",
  waiting_renter:"bg-orange-100 text-orange-800",
  waiting_owner: "bg-orange-100 text-orange-800",
  waiting_both:  "bg-orange-100 text-orange-800",
  approved:      "bg-blue-100 text-blue-800",
  confirmed:     "bg-green-100 text-green-700",
  in_use:        "bg-blue-100 text-blue-700",
  return_check:  "bg-indigo-100 text-indigo-700",
  returning:     "bg-indigo-100 text-indigo-700",
  completed:     "bg-green-100 text-green-800",
  review:        "bg-amber-100 text-amber-700",
  disputed:      "bg-red-100 text-red-800",
  declined:      "bg-red-100 text-red-800",
  cancelled:     "bg-gray-200 text-gray-700",
};

type OwnerTab = "bookings" | "tools";

type Review = {
  booking_id: number;
  reviewer_id: string;
  rating: number;
  content: string | null;
  reviewer_role: string | null;
  created_at: string | null;
};

function getOwnerStatusLabel(b: Booking): string {
  const renterName = b.user_name || "Renter";
  switch (b.status) {
    case "pending":        return "New booking request";
    case "waiting_renter": return `✅ You confirmed — waiting for ${renterName} to confirm`;
    case "waiting_owner":  return "⚡ Please confirm this booking";
    case "waiting_both":   return "Waiting for both parties to confirm";
    case "confirmed":      return "🎉 Booking confirmed! Prepare the tool";
    case "in_use":         return "🔧 Tool in use — mark as returned when renter brings it back";
    case "return_check":
    case "returning":      return "📦 Return received — confirm condition or raise a dispute";
    case "completed":      return "✅ Completed — payment released from escrow";
    case "review":         return "⭐ Please review the renter";
    case "disputed":       return "⚠️ Dispute open — under AirTool review";
    default:               return b.status || "pending";
  }
}

export default function OwnerPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [toolsMap, setToolsMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [errorText, setErrorText] = useState("");
  const [role, setRole] = useState<string | null>(null);
  // Persist selected tab across page navigations via localStorage.
  // Lazy initializer: read from localStorage on first render (client-only).
  const [activeTab, setActiveTab] = useState<OwnerTab>(() => {
    if (typeof window === "undefined") return "bookings";
    const saved = localStorage.getItem("ownerTab");
    return (saved === "bookings" || saved === "tools") ? saved : "bookings";
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [sales, setSales] = useState<{ id: number; tool_name: string; sale_price: number; platform_commission: number; buyer_email: string; buyer_name: string; paid_at: string; payout_status: string; payout_amount: number | null; payout_bank_account: string | null; payout_date: string | null; payout_note: string | null }[]>([]);
  const [saleCommissionPct, setSaleCommissionPct] = useState<number>(10);
  const router = useRouter();

  // My Tools state
  const [ownerTools, setOwnerTools] = useState<Tool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<number | null>(null);
  const [uploadingVideoId, setUploadingVideoId] = useState<number | null>(null);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [promoPrice, setPromoPrice] = useState("");
  const [promoLabel, setPromoLabel] = useState("");
  const [promoSaving, setPromoSaving] = useState(false);
  const photoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const videoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Experience points — message conversations (fetched async; rest is derived)
  const [xpMessageConvos, setXpMessageConvos] = useState(0);

  // DB-persisted XP from experience_points table
  const [dbXp, setDbXp] = useState<number | null>(null);
  const [xpBreakdown, setXpBreakdown] = useState<{ event_type: string; points: number; booking_id: number; created_at: string }[]>([]);

  // Profile panel
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [preferDelivery, setPreferDelivery] = useState("pickup");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

  // Category save state
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null);
  const [savedCategoryId, setSavedCategoryId] = useState<number | null>(null);

  // Condition save state
  const [savingConditionId, setSavingConditionId] = useState<number | null>(null);
  const [savedConditionId, setSavedConditionId] = useState<number | null>(null);

  // Dual-confirmation state
  const [cancelConfirmBookingId, setCancelConfirmBookingId] = useState<number | null>(null);
  const [cancelConfirmReason, setCancelConfirmReason] = useState("");

  // Dispute flow state
  const [disputingBookingId, setDisputingBookingId] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeAmount, setDisputeAmount] = useState("");
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState<File[]>([]);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  // Fetched dispute records keyed by booking_id
  const [disputesMap, setDisputesMap] = useState<Record<number, DisputeRecord>>({});

  // Reviews received keyed by booking_id
  const [reviewsMap, setReviewsMap] = useState<Record<number, Review>>({});

  // Single fetcher: bookings + XP message-convos + unread count — all in parallel.
  // Fetch disputes for a list of booking IDs and merge into disputesMap
  const fetchDisputesForBookings = async (bks: Booking[]) => {
    const disputedIds = bks.filter((b) => b.status === "disputed").map((b) => b.id);
    if (!disputedIds.length) return;
    const { data } = await supabase
      .from("disputes")
      .select("*")
      .in("booking_id", disputedIds);
    if (!data) return;
    setDisputesMap((prev) => {
      const next = { ...prev };
      for (const d of data as DisputeRecord[]) {
        next[d.booking_id] = d;
      }
      return next;
    });
  };

  const fetchBookings = async () => {
    if (!userEmail) return;
    const [
      { data: bookingsData },
      { data: sentMsgs },
      { count: unread },
    ] = await Promise.all([
      supabase.from("bookings").select("*").eq("owner_email", userEmail).order("created_at", { ascending: false }),
      supabase.from("messages").select("booking_id").eq("sender_email", userEmail),
      supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_email", userEmail).eq("is_read", false),
    ]);
    if (bookingsData) {
      const bks = bookingsData as Booking[];
      setBookings(bks);
      fetchDisputesForBookings(bks);
    }
    setXpMessageConvos(new Set((sentMsgs || []).map((m) => m.booking_id)).size);
    setUnreadCount(unread || 0);

    // Fetch tool sales + commission rate in parallel
    const [{ data: salesData, error: salesError }, { data: commissionSetting }] = await Promise.all([
      supabase.from("tool_sales")
        .select("id, tool_name, sale_price, platform_commission, buyer_email, buyer_name, paid_at, payout_status, payout_amount, payout_bank_account, payout_date, payout_note")
        .eq("owner_email", userEmail)
        .order("paid_at", { ascending: false }),
      supabase.from("platform_settings").select("value").eq("key", "sale_commission_pct").single(),
    ]);
    console.log("SALES_EMAIL:", userEmail);
    console.log("SALES_ERROR:", salesError?.message || salesError?.code || "none");
    console.log("SALES_COUNT:", salesData?.length ?? "null");
    if (salesData) setSales(salesData as any);
    if (commissionSetting?.value) setSaleCommissionPct(Number(commissionSetting.value));
  };

  const sendSystemMessage = async (bookingId: number, renterEmail: string | null | undefined, text: string) => {
    if (!renterEmail || !userEmail) return;
    await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_email: userEmail,
      receiver_email: renterEmail,
      message: text,
    });
  };

  const ownerConfirmBooking = async (b: Booking) => {
    const ok = window.confirm(`Confirm booking #${b.id} for ${b.user_name || "renter"}?`);
    if (!ok) return;

    const bothConfirmed = b.renter_confirmed === true;
    const newStatus = bothConfirmed ? "confirmed" : "waiting_renter";
    const updates: Record<string, unknown> = {
      owner_confirmed: true,
      owner_confirmed_at: new Date().toISOString(),
      status: newStatus,
    };
    if (bothConfirmed) updates.confirmed_at = new Date().toISOString();

    const { data: updatedRows, error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", b.id)
      .select();

    console.log("[ownerConfirm] booking id:", b.id, "| updated rows:", updatedRows, "| error:", error);

    if (error) { alert("Failed: " + error.message); return; }
    if (!updatedRows || updatedRows.length === 0) {
      alert(`Update matched 0 rows for booking #${b.id}. Check Supabase RLS policy — the owner may not have write permission on this row.`);
      return;
    }

    await supabase.from("booking_confirmations").insert({
      booking_id: b.id,
      user_role: "owner",
      action: "confirmed",
    });

    const msg = bothConfirmed
      ? "🎉 Both parties have confirmed the booking!"
      : `✅ Owner confirmed the booking — waiting for ${b.user_name || "renter"} to confirm`;
    await sendSystemMessage(b.id, b.user_email, msg);

    // Optimistic update so button disappears instantly
    setBookings((prev) => prev.map((bk) => bk.id === b.id ? { ...bk, ...updates } : bk));
    // Full re-fetch so all fields (status badge, action buttons) reflect server state
    await fetchBookings();
  };

  const ownerWithdrawConfirmation = async (b: Booking) => {
    const reason = cancelConfirmReason.trim();
    const { data: withdrawRows, error } = await supabase
      .from("bookings")
      .update({ owner_confirmed: false, status: "pending" })
      .eq("id", b.id)
      .select();

    console.log("[ownerWithdraw] booking id:", b.id, "| updated rows:", withdrawRows, "| error:", error);

    if (error) { alert("Failed: " + error.message); return; }
    if (!withdrawRows || withdrawRows.length === 0) {
      alert(`Update matched 0 rows for booking #${b.id}. Check Supabase RLS policy.`);
      return;
    }

    await supabase.from("booking_confirmations").insert({
      booking_id: b.id,
      user_role: "owner",
      action: "withdrawn",
      reason: reason || null,
    });

    await sendSystemMessage(b.id, b.user_email, "⚠️ Owner withdrew their confirmation — booking returned to pending");

    setBookings((prev) => prev.map((bk) =>
      bk.id === b.id ? { ...bk, owner_confirmed: false, status: "pending" } : bk
    ));
    setCancelConfirmBookingId(null);
    setCancelConfirmReason("");
  };

  useEffect(() => {
    const fetchOwnerData = async (user: any) => {
      setLoading(true);
      setErrorText("");

      setUserEmail(user.email);
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setRole(profile?.role ?? "owner");

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

      const { data: toolsData } = await supabase.from("tools").select("id,name");
      if (toolsData) {
        const map: Record<number, string> = {};
        (toolsData as { id: number; name: string | null }[]).forEach((t) => {
          if (typeof t.id === "number") map[t.id] = t.name || `Tool #${t.id}`;
        });
        setToolsMap(map);
      }

      const [
        { data: bookingsData, error: bookingsError },
        { data: sentMsgs },
        { count: initCount },
      ] = await Promise.all([
        supabase.from("bookings").select("*").eq("owner_email", user.email).order("created_at", { ascending: false }),
        supabase.from("messages").select("booking_id").eq("sender_email", user.email),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_email", user.email).eq("is_read", false),
      ]);

      if (bookingsError) { setErrorText(bookingsError.message); setLoading(false); return; }
      const bks = (bookingsData as Booking[]) || [];
      setBookings(bks);
      fetchDisputesForBookings(bks);
      setXpMessageConvos(new Set((sentMsgs || []).map((m) => m.booking_id)).size);
      setUnreadCount(initCount || 0);

      // Fetch reviews left on owner's bookings
      const bookingIds = bks.map((b) => b.id);
      if (bookingIds.length > 0) {
        const { data: reviewRows } = await supabase
          .from("reviews")
          .select("booking_id, reviewer_id, rating, content, reviewer_role, created_at")
          .in("booking_id", bookingIds);
        if (reviewRows) {
          const map: Record<number, Review> = {};
          (reviewRows as Review[]).forEach((r) => { map[Number(r.booking_id)] = r; });
          setReviewsMap(map);
        }
      }

      // Fetch tool sales + commission rate
      const [{ data: salesData }, { data: commissionSetting }] = await Promise.all([
        supabase.from("tool_sales")
          .select("id, tool_name, sale_price, platform_commission, buyer_email, buyer_name, paid_at, payout_status, payout_amount, payout_bank_account, payout_date, payout_note")
          .eq("owner_email", user.email)
          .order("paid_at", { ascending: false }),
        supabase.from("platform_settings").select("value").eq("key", "sale_commission_pct").single(),
      ]);
      if (salesData) setSales(salesData as any);
      if (commissionSetting?.value) setSaleCommissionPct(Number(commissionSetting.value));

      setLoading(false);
    };

    let cancelled = false;

    supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session?.user) {
        fetchOwnerData(session.user);
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!userEmail) return;
    fetchBookings();
    window.addEventListener("focus", fetchBookings);
    const interval = setInterval(fetchBookings, 30000);
    return () => {
      window.removeEventListener("focus", fetchBookings);
      clearInterval(interval);
    };
  }, [userEmail]);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        fetchBookings();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [userEmail]);

  useEffect(() => {
    if (!loading && role !== null && role !== "owner" && role !== "admin") router.replace("/search");
    if (!loading && role === "hub") router.replace("/hub");
  }, [loading, role, router]);

  // Persist tab selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("ownerTab", activeTab);
  }, [activeTab]);

  // Tab change handler — writes to localStorage immediately (not waiting for effect)
  // and logs so we can confirm the click is registering
  const handleTabChange = (tab: OwnerTab) => {
    console.log("tab changing to:", tab);
    setActiveTab(tab);
    localStorage.setItem("ownerTab", tab);
  };

  // Load owner tools as soon as we know the user's email (not gated on tab)
  useEffect(() => {
    if (!userEmail) return;
    const fetchOwnerTools = async () => {
      setToolsLoading(true);
      const { data, error } = await supabase
        .from("tools").select("*").eq("owner_email", userEmail)
        .order("created_at", { ascending: false });
      if (!error) setOwnerTools((data as Tool[]) || []);
      setToolsLoading(false);
    };
    fetchOwnerTools();
  }, [userEmail]);

  const handleUploadPhoto = async (toolId: number, file: File) => {
    setUploadingPhotoId(toolId);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${toolId}/photo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("tool-images").upload(path, file, { upsert: true });
    if (uploadError) { alert("Upload failed: " + uploadError.message); setUploadingPhotoId(null); return; }
    const { data: urlData } = supabase.storage.from("tool-images").getPublicUrl(path);
    const { error } = await supabase.from("tools")
      .update({ image_url: urlData.publicUrl }).eq("id", toolId);
    if (error) { alert(error.message); } else {
      setOwnerTools((prev) => prev.map((t) => t.id === toolId ? { ...t, image_url: urlData.publicUrl } : t));
    }
    setUploadingPhotoId(null);
  };

  const handleUploadVideo = async (toolId: number, file: File) => {
    setUploadingVideoId(toolId);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${toolId}/video-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("tool-images").upload(path, file, { upsert: true });
    if (uploadError) { alert("Upload failed: " + uploadError.message); setUploadingVideoId(null); return; }
    const { data: urlData } = supabase.storage.from("tool-images").getPublicUrl(path);
    const { error } = await supabase.from("tools")
      .update({ video_url: urlData.publicUrl }).eq("id", toolId);
    if (!error) {
      setOwnerTools((prev) => prev.map((t) => t.id === toolId ? { ...t, video_url: urlData.publicUrl } : t));
    }
    setUploadingVideoId(null);
  };

  const handleSavePromo = async (toolId: number) => {
    setPromoSaving(true);
    const price = promoPrice ? Number(promoPrice) : null;
    const { error } = await supabase.from("tools")
      .update({ promo_price: price, promo_label: promoLabel.trim() || null })
      .eq("id", toolId);
    if (error) { alert(error.message); setPromoSaving(false); return; }
    setOwnerTools((prev) => prev.map((t) =>
      t.id === toolId ? { ...t, promo_price: price, promo_label: promoLabel.trim() || null } : t
    ));
    setEditingPromoId(null);
    setPromoPrice("");
    setPromoLabel("");
    setPromoSaving(false);
  };

  const handleUpdateCategory = async (toolId: number, category: string) => {
    setSavingCategoryId(toolId);
    const { error } = await supabase.from("tools").update({ category }).eq("id", toolId);
    setSavingCategoryId(null);
    if (error) { alert(error.message); return; }
    setOwnerTools((prev) => prev.map((t) => t.id === toolId ? { ...t, category } : t));
    setSavedCategoryId(toolId);
    setTimeout(() => setSavedCategoryId((prev) => prev === toolId ? null : prev), 2000);
  };

  const CONDITION_OPTIONS = ["Brand New", "Like New", "Good", "Fair", "Well Used"];
  const CONDITION_STARS: Record<string, number> = {
    "Brand New": 5, "Like New": 4, "Good": 3, "Fair": 2, "Well Used": 1,
  };

  const handleUpdateCondition = async (toolId: number, condition: string) => {
    setSavingConditionId(toolId);
    const { error } = await supabase.from("tools").update({ condition }).eq("id", toolId);
    setSavingConditionId(null);
    if (error) { alert(error.message); return; }
    setOwnerTools((prev) => prev.map((t) => t.id === toolId ? { ...t, condition } : t));
    setSavedConditionId(toolId);
    setTimeout(() => setSavedConditionId((prev) => prev === toolId ? null : prev), 2000);
  };

  const handleUpdateSalePrice = async (toolId: number, raw: string) => {
    const sale_price = raw.trim() === "" ? null : Number(raw);
    if (sale_price !== null && isNaN(sale_price)) return;
    const { error } = await supabase.from("tools").update({ sale_price }).eq("id", toolId);
    if (error) { alert(error.message); return; }
    setOwnerTools((prev) => prev.map((t) => t.id === toolId ? { ...t, sale_price } : t));
  };

  const handleDeleteTool = async (toolId: number, toolName: string | null) => {
    if (!confirm(`Delete "${toolName || "this tool"}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("tools").delete().eq("id", toolId);
    if (error) { alert(error.message); return; }
    setOwnerTools((prev) => prev.filter((t) => t.id !== toolId));
  };

  const loadProfile = async () => {
    setProfileLoading(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setProfileLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, address, suburb, city, id_type, id_number, prefer_delivery, role, successful_transactions, bank_account_name, bank_account_number, bank_name")
      .eq("id", authUser.id)
      .maybeSingle();

    const meta = authUser.user_metadata || {};
    const authName = meta.full_name || meta.name || authUser.email?.split("@")[0] || "";

    if (data) setProfile(data as Profile);
    setFullName(data?.full_name || authName);
    setPhone(data?.phone || meta.phone || meta.phone_number || "");
    setAddress(data?.address || meta.address || "");
    setSuburb(data?.suburb || meta.suburb || "");
    setCity(data?.city || meta.city || "");
    setIdType(data?.id_type || meta.id_type || "");
    setIdNumber(data?.id_number || meta.id_number || "");
    setPreferDelivery(data?.prefer_delivery || meta.prefer_delivery || "pickup");
    setBankAccountName(data?.bank_account_name || "");
    setBankAccountNumber(data?.bank_account_number || "");
    setBankName(data?.bank_name || "");
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
      .update({ full_name: fullName, phone, address, suburb, city, id_type: idType, id_number: idNumber, prefer_delivery: preferDelivery, bank_account_name: bankAccountName || null, bank_account_number: bankAccountNumber || null, bank_name: bankName || null })
      .eq("id", userId);
    if (error) {
      setProfileMsg("❌ Failed to save: " + error.message);
    } else {
      setProfileMsg("✅ Profile updated successfully!");
    }
    setProfileSaving(false);
  };

  // ── Bookings stats ──────────────────────────────────────────────────────────
  const totalBookings = bookings.length;

  const newBookings = useMemo(
    () => bookings.filter((b) => (b.status || "new") === "new" || b.status === "pending").length,
    [bookings],
  );

  // "Approved" = confirmed by both parties
  const confirmedBookings = useMemo(
    () => bookings.filter((b) => b.status === "confirmed").length,
    [bookings],
  );

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === "completed").length,
    [bookings],
  );

  // Funds sitting in escrow (paid but not yet released to owner)
  const pendingIncome = useMemo(
    () =>
      bookings
        .filter((b) => ["confirmed", "in_use", "return_check"].includes(b.status || ""))
        .reduce((sum, b) => sum + Number(b.price_total || 0), 0) +
      sales.filter((s) => s.payout_status === "pending").reduce((sum, s) => sum + Number(s.sale_price || 0) - Number(s.platform_commission || 0), 0),
    [bookings, sales],
  );

  // Paid out — completed rentals where payout is done + paid tool sales
  const grossIncome = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "completed" && b.payout_status === "paid")
        .reduce((sum, b) => sum + ownerPayout(b.price_total, b.platform_fee), 0) +
      sales.filter((s) => s.payout_status === "paid").reduce((sum, s) => {
        const c = Number(s.platform_commission) > 0 ? Number(s.platform_commission) : Math.round(Number(s.sale_price) * saleCommissionPct) / 100;
        return sum + Number(s.sale_price) - c;
      }, 0),
    [bookings, sales, saleCommissionPct],
  );

  // ── Experience / trust points (derived — no extra DB column needed) ─────────
  // +1 per unique booking conversation with a message sent
  // +1 per booking the owner confirmed
  // +1 per booking where renter picked up  (in_use / return_check / completed / review)
  // +1 per booking where return was confirmed (completed / review)
  const ownerXp = useMemo(() => {
    const { confirms, pickups, returns } = bookings.reduce(
      (acc, b) => {
        if (b.owner_confirmed) acc.confirms++;
        if (["in_use", "return_check", "completed", "review"].includes(b.status || "")) acc.pickups++;
        if (["completed", "review"].includes(b.status || "")) acc.returns++;
        return acc;
      },
      { confirms: 0, pickups: 0, returns: 0 },
    );
    return xpMessageConvos + confirms + pickups + returns;
  }, [bookings, xpMessageConvos]);

  // Use DB total when available, fall back to client-side calculation
  const displayXp = dbXp !== null ? dbXp : ownerXp;

  const xpLevel =
    displayXp >= 200 ? "Legend"   :
    displayXp >= 100 ? "Champion" :
    displayXp >= 60  ? "Pro"      :
    displayXp >= 30  ? "Trusted"  :
    displayXp >= 10  ? "Regular"  :
    "Newcomer";

  const xpBadgeColor =
    displayXp >= 200 ? "bg-yellow-500"  :
    displayXp >= 100 ? "bg-amber-500"   :
    displayXp >= 60  ? "bg-purple-600"  :
    displayXp >= 30  ? "bg-indigo-600"  :
    displayXp >= 10  ? "bg-blue-500"    :
    "bg-gray-400";

  // ── Lifecycle: mark tool as returned (in_use → return_check) ─────────────────
  const handleMarkReturned = async (b: Booking) => {
    const ok = window.confirm(`Mark booking #${b.id} as returned? This tells the system the renter has handed the tool back.`);
    if (!ok) return;
    const { error } = await supabase.from("bookings").update({ status: "return_check" }).eq("id", b.id);
    if (error) { alert("Failed: " + error.message); return; }
    await sendSystemMessage(b.id, b.user_email, "📦 The owner has marked the tool as returned. Return check in progress.");
    setBookings((prev) => prev.map((bk) => bk.id === b.id ? { ...bk, status: "return_check" } : bk));
  };

  // ── Lifecycle: confirm return (return_check → completed) ──────────────────────
  const handleConfirmReturn = async (b: Booking) => {
    const ok = window.confirm(`Confirm the tool is returned in good condition? This will complete the booking and release payment from escrow.`);
    if (!ok) return;
    const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", b.id);
    if (error) { alert("Failed: " + error.message); return; }
    fetch('/api/xp/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: b.id, new_status: 'completed' }),
    })
    await sendSystemMessage(b.id, b.user_email, "✅ Return confirmed! Booking is now complete and payment has been released from escrow. Thank you!");
    setBookings((prev) => prev.map((bk) => bk.id === b.id ? { ...bk, status: "completed" } : bk));
  };

  // ── Upload evidence files to Supabase Storage ─────────────────────────────────
  const uploadEvidenceFiles = async (bookingId: number, files: File[], party: "owner" | "renter"): Promise<string[]> => {
    const paths: string[] = [];
    for (const file of files) {
      const ext  = file.name.split(".").pop() || "jpg";
      const path = `${bookingId}/${party}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("dispute-evidence").upload(path, file);
      if (!error) paths.push(path);
    }
    return paths;
  };

  // ── Lifecycle: raise dispute (return_check → disputed) ────────────────────────
  const handleRaiseDispute = async (b: Booking) => {
    if (!disputeReason.trim()) { alert("Please describe the issue."); return; }
    setDisputeSubmitting(true);
    try {
      // Upload evidence images first
      const evidencePaths = disputeEvidenceFiles.length > 0
        ? await uploadEvidenceFiles(b.id, disputeEvidenceFiles, "owner")
        : [];

      const res = await fetch("/api/disputes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          bookingId:         b.id,
          ownerEmail:        userEmail,
          renterEmail:       b.user_email,
          reason:            disputeReason.trim(),
          amountClaimed:     disputeAmount ? Number(disputeAmount) : null,
          ownerEvidenceUrls: evidencePaths,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert("Failed to raise dispute: " + (j.error || "Unknown error"));
        setDisputeSubmitting(false);
        return;
      }
    } catch {
      alert("Network error — please try again.");
      setDisputeSubmitting(false);
      return;
    }
    await sendSystemMessage(b.id, b.user_email, `⚠️ The owner has raised a dispute about this rental. AirTool team will be in contact shortly. Reason: ${disputeReason.trim()}`);
    setBookings((prev) => prev.map((bk) => bk.id === b.id ? { ...bk, status: "disputed" } : bk));

    // Optimistically add the dispute to disputesMap so the summary shows instantly
    setDisputesMap((prev) => ({
      ...prev,
      [b.id]: {
        id:                  0, // real ID unknown until refetch
        booking_id:          b.id,
        owner_email:         userEmail,
        renter_email:        b.user_email ?? null,
        reason:              disputeReason.trim(),
        amount_claimed:      disputeAmount ? Number(disputeAmount) : null,
        owner_evidence_urls: [],
        renter_response:     null,
        renter_responded_at: null,
        renter_evidence_urls:[],
        resolution:          null,
        admin_notes:         null,
        resolved_at:         null,
        status:              "open",
        created_at:          new Date().toISOString(),
      },
    }));

    setDisputingBookingId(null);
    setDisputeReason("");
    setDisputeAmount("");
    setDisputeEvidenceFiles([]);
    setDisputeSubmitting(false);

    // Refresh to get the real dispute ID from the DB
    setTimeout(fetchBookings, 1500);
  };

  const updateBookingStatus = async (bookingId: number, newStatus: "approved" | "completed" | "declined") => {
    const ok = window.confirm(`Change booking #${bookingId} to ${newStatus}?`);
    if (!ok) return;
    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", bookingId);
    if (error) { alert(`Failed: ${error.message}`); return; }

    if (newStatus === "approved" || newStatus === "completed") {
      fetch('/api/xp/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, new_status: newStatus }),
      })
    }

    // On approval — email the renter so they know to confirm & pay
    if (newStatus === "approved") {
      const b = bookings.find((bk) => bk.id === bookingId);
      if (b?.user_email) {
        fetch("/api/send-approval-email", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            renterEmail:    b.user_email,
            renterName:     b.user_name,
            toolName:       toolsMap[b.tool_id || 0] || "Tool",
            bookingId:      b.id,
            preferredDates: b.preferred_dates,
            startDate:      b.start_date,
            endDate:        b.end_date,
            priceTotal:     b.price_total,
          }),
        }).catch(() => {});
      }
    }

    fetchBookings();
  };

  if (loading || role === null) {
    return (
      <DashboardShell title="Checking access..." subtitle="Please wait">
        <div className="rounded-3xl border border-gray-200 bg-white/70 p-6 shadow-sm">
          <p className="text-gray-600">Loading...</p>
        </div>
      </DashboardShell>
    );
  }

  if (role !== "owner" && role !== "admin") return null;

  return (
    <DashboardShell title="Owner Dashboard" subtitle={`Owner: ${userEmail || "-"}`}>
      <div className="grid gap-6">

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Bookings",    value: totalBookings,              sub: `${newBookings} new`,              tab: "bookings", scrollTo: "bookings-list" },
            { label: "Confirmed",         value: confirmedBookings,          sub: `${completedBookings} completed`,  tab: "bookings", scrollTo: "bookings-list" },
            { label: "Pending Income",    value: `$${pendingIncome.toFixed(2)}`,  sub: "in escrow",              tab: "bookings", scrollTo: "bookings-list" },
            { label: "Paid Out",           value: `$${grossIncome.toFixed(2)}`,    sub: "confirmed received",     tab: "bookings", scrollTo: "bookings-list" },
            { label: "Tools Sold",        value: sales.length,               sub: sales.filter(s => s.payout_status === "paid").length > 0 ? `${sales.filter(s => s.payout_status === "paid").length} paid out` : sales.length > 0 ? "awaiting payout" : "no sales yet", tab: "bookings", scrollTo: "tool-sales-section" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => {
                handleTabChange(s.tab as OwnerTab);
                if ((s as any).scrollTo) {
                  setTimeout(() => {
                    document.getElementById((s as any).scrollTo)?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }
              }}
              className="rounded-3xl border border-gray-200 bg-white/20 p-4 backdrop-blur-md text-left hover:bg-white/40 transition"
            >
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="mt-1 text-xs text-gray-400">{s.sub}</p>
            </button>
          ))}
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
                  Earned by messaging renters, confirming bookings, pickups &amp; returns
                </p>
              </div>
              <div className="hidden sm:block shrink-0 text-right">
                <p className="text-xs text-gray-400">Next level</p>
                <p className="text-sm font-bold text-indigo-600">
                  {displayXp >= 200 ? "Max reached 🏆" :
                   displayXp >= 100 ? `${200 - displayXp} pts to Legend`   :
                   displayXp >= 60  ? `${100 - displayXp} pts to Champion` :
                   displayXp >= 30  ? `${60  - displayXp} pts to Pro`      :
                   displayXp >= 10  ? `${30  - displayXp} pts to Trusted`  :
                   `${10 - displayXp} pts to Regular`}
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
                {Object.keys(reviewsMap).length}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Tool Points</p>
                <p className="mt-0.5 text-xs text-gray-500">Tools reviewed by your renters</p>
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

        {showProfile && (
            <div className="mt-4 rounded-3xl border border-[#8bbb46]/30 bg-white/95 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Personal Info</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Role: <span className="font-semibold text-[#2f641f] uppercase">{profile.role || "owner"}</span>
                    {" · "}
                    Successful transactions: <span className="font-semibold">{profile.successful_transactions || 0}</span>
                  </p>
                </div>
                <button onClick={() => setShowProfile(false)} className="text-sm text-black/40 hover:text-black">✕ Close</button>
              </div>

              {profileLoading ? (
                <p className="text-sm text-gray-500">Loading profile...</p>
              ) : (
                <div className="grid gap-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-black/40">Personal</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-black/60">Full Name</label>
                      <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-black/60">Phone</label>
                      <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
                    </div>
                  </div>

                  <div className="text-xs font-semibold uppercase tracking-widest text-black/40 pt-2">Address</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-3">
                      <label className="mb-1 block text-xs font-semibold text-black/60">Street Address</label>
                      <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-black/60">Suburb</label>
                      <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Suburb" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-black/60">City</label>
                      <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                    </div>
                  </div>

                  <div className="text-xs font-semibold uppercase tracking-widest text-black/40 pt-2">Preferred Method</div>
                  <div className="grid grid-cols-3 gap-3 max-w-lg">
                    <button type="button" onClick={() => setPreferDelivery("pickup")} className={`rounded-xl border py-3 text-sm font-medium transition ${preferDelivery === "pickup" ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]" : "border-black/15 text-black/60"}`}>🤝 Pickup</button>
                    <button type="button" onClick={() => setPreferDelivery("hub")} className={`rounded-xl border py-3 text-sm font-medium transition ${preferDelivery === "hub" ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]" : "border-black/15 text-black/60"}`}>📦 Hub Pickup</button>
                    <button type="button" onClick={() => setPreferDelivery("delivery")} className={`rounded-xl border py-3 text-sm font-medium transition ${preferDelivery === "delivery" ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]" : "border-black/15 text-black/60"}`}>🚚 Delivery</button>
                  </div>

                  <div className="text-xs font-semibold uppercase tracking-widest text-black/40 pt-2">ID Verification</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-black/60">ID Type</label>
                      <select className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" value={idType} onChange={(e) => setIdType(e.target.value)}>
                        <option value="">Select ID type</option>
                        <option value="drivers_licence">Driver&apos;s Licence</option>
                        <option value="passport">Passport</option>
                        <option value="18plus">18+ Card</option>
                        <option value="kiwiaccess">Kiwi Access Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-black/60">ID Number</label>
                      <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ID number" />
                    </div>
                  </div>

                  {/* Bank details for payout */}
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">💳 Payout Bank Details</p>
                    <p className="text-xs text-blue-600/80">Optional — only needed if you plan to sell a tool outright. Fill in before listing for sale so admin can transfer your proceeds.</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-black/60">Account Name</label>
                        <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-blue-400" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="e.g. John Smith" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-black/60">Bank Name</label>
                        <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-blue-400" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. ANZ, ASB, BNZ, Westpac" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-black/60">Account Number</label>
                        <input className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-blue-400" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="e.g. 01-0123-0123456-00" />
                      </div>
                    </div>
                  </div>

                  {profileMsg && (
                    <div className={`rounded-xl px-4 py-3 text-sm ${profileMsg.startsWith("✅") ? "bg-[#f0f8e8] text-[#2f641f]" : "bg-red-50 text-red-600"}`}>
                      {profileMsg}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveProfile} disabled={profileSaving} className="rounded-xl bg-[#8bbb46] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] disabled:opacity-60">
                      {profileSaving ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={() => setShowProfile(false)} className="rounded-xl border border-black/15 px-6 py-3 text-sm font-semibold text-black/60 hover:bg-black/5">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Unread messages banner — hidden completely when count is 0 */}
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

        {/* Tabs + quick actions — single row */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTabChange("bookings")}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${activeTab === "bookings" ? "bg-slate-900 text-white" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Bookings ({totalBookings})
          </button>
          <button
            onClick={() => handleTabChange("tools")}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${activeTab === "tools" ? "bg-slate-900 text-white" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Tools Management ({ownerTools.length})
          </button>
          <button
            onClick={() => {
              const firstTool = ownerTools[0];
              const url = firstTool ? `${window.location.origin}/tools/${firstTool.id}` : window.location.origin;
              navigator.clipboard.writeText(url).then(() => alert("Listing link copied!"));
            }}
            className="rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Share Listing
          </button>
          <button
            onClick={() => showProfile ? setShowProfile(false) : handleOpenProfile()}
            className="rounded-2xl border border-[#8bbb46] bg-[#f0f8e8] px-5 py-2.5 text-sm font-semibold text-[#2f641f] hover:bg-[#e4f5d4] transition"
          >
            👤 My Profile
          </button>
        </div>

        {errorText && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-medium text-red-700">Error</p>
            <p className="mt-2 text-sm text-red-600">{errorText}</p>
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {activeTab === "bookings" && (
          <>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-500">What you can do here</p>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-800">
                <li>1. Monitor your bookings</li>
                <li>2. Communicate with renter / buyer</li>
              </ul>
            </div>

            {bookings.length === 0 ? (
              <div id="bookings-list" className="rounded-3xl border border-gray-200 bg-white/75 p-6 shadow-sm backdrop-blur">
                <p className="text-gray-600">No owner bookings found.</p>
              </div>
            ) : (
              <div id="bookings-list" className="grid gap-5">
                {bookings.map((b) => (
                  <div key={b.id} className="rounded-3xl border border-gray-200 bg-white/55 p-6 shadow-sm backdrop-blur">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            {toolsMap[b.tool_id || 0] || "Unknown Tool"}
                          </h2>
                          {b.tool_id && (
                            <a
                              href={`/tools/${b.tool_id}`}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#2f641f] hover:underline"
                            >
                              🔧 View tool details →
                            </a>
                          )}
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <p className="text-sm text-gray-600">Status:</p>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            b.status === "disputed" && disputesMap[b.id]?.status === "resolved"
                              ? "bg-green-100 text-green-700"
                              : statusColorMap[b.status || "new"] || "bg-gray-100 text-gray-800"
                          }`}>
                            {b.status === "disputed" && disputesMap[b.id]?.status === "resolved"
                              ? "dispute resolved"
                              : b.status || "new"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {b.status === "disputed" && disputesMap[b.id]?.status === "resolved"
                            ? "✅ Dispute resolved — awaiting final outcome"
                            : getOwnerStatusLabel(b)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 text-sm text-gray-700 md:grid-cols-2 xl:grid-cols-3">
                      <p><span className="font-medium text-gray-900">Renter:</span> {b.user_name || "-"}</p>
                      <p><span className="font-medium text-gray-900">Email:</span> {b.user_email || "-"}</p>
                      <p><span className="font-medium text-gray-900">Phone:</span> {b.phone || "-"}</p>
                      <p><span className="font-medium text-gray-900">Start date:</span> {b.start_date || "-"}</p>
                      <p><span className="font-medium text-gray-900">End date:</span> {b.end_date || "-"}</p>
                      <p><span className="font-medium text-gray-900">Preferred dates:</span> {b.preferred_dates || "-"}</p>
                      <p><span className="font-medium text-gray-900">Address:</span> {b.address || "-"}</p>
                      <p><span className="font-medium text-gray-900">Price total:</span> ${Number(b.price_total || 0).toFixed(2)}</p>
                      <p><span className="font-medium text-gray-900">Platform fee:</span> ${Number(b.platform_fee || 0).toFixed(2)}</p>
                      <p>
                        <span className="font-medium text-gray-900">Your payout:</span>{" "}
                        <span className="font-semibold text-green-700">
                          ${ownerPayout(b.price_total, b.platform_fee).toFixed(2)}
                        </span>
                        {" "}
                        {b.status === "completed" && b.payout_status === "paid"
                          ? <span className="text-xs font-semibold text-green-600">✅ Paid out</span>
                          : b.status === "completed"
                            ? <span className="text-xs font-semibold text-orange-500">⏳ Awaiting payout from AirTool</span>
                            : ["confirmed","in_use","return_check"].includes(b.status || "")
                              ? <span className="text-xs text-orange-500">(in escrow)</span>
                              : null
                        }
                      </p>
                      {b.status === "completed" && b.payout_status === "paid" && (
                        <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 space-y-0.5 text-xs">
                          {b.payout_amount && <div className="text-green-700 font-semibold">${Number(b.payout_amount).toFixed(2)} transferred</div>}
                          {b.payout_bank_account && <div className="text-gray-500">To: {b.payout_bank_account}</div>}
                          {b.payout_date && <div className="text-gray-400">{new Date(b.payout_date).toLocaleDateString("en-NZ", { dateStyle: "medium" })}</div>}
                          {b.payout_note && <div className="text-gray-500 italic">{b.payout_note}</div>}
                        </div>
                      )}
                      <p className="md:col-span-2 xl:col-span-3"><span className="font-medium text-gray-900">Message:</span> {b.message || "-"}</p>
                    </div>

                    {/* ── Dispute summary (shown when booking is disputed) ── */}
                    {b.status === "disputed" && (() => {
                      const d = disputesMap[b.id];
                      return (
                        <div className="mt-5 rounded-2xl border-2 border-red-400 bg-red-50 p-5">
                          {/* Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">⚠️</span>
                              <p className="text-base font-bold text-red-900">Dispute Raised</p>
                            </div>
                            {d && (
                              <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                                d.status === "resolved"   ? "bg-green-100 text-green-700" :
                                d.status === "escalated" ? "bg-orange-100 text-orange-700" :
                                                            "bg-red-100 text-red-700"
                              }`}>
                                {d.status === "resolved" ? "✅ Resolved" : d.status === "escalated" ? "🔺 Escalated" : "🔴 Open"}
                              </span>
                            )}
                          </div>

                          {d ? (
                            <>
                              {/* Quick-scan summary row */}
                              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Reason</p>
                                  <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-3">{d.reason}</p>
                                </div>
                                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Amount Claimed</p>
                                  <p className="mt-1 text-sm font-bold text-red-700">
                                    {d.amount_claimed != null ? `$${Number(d.amount_claimed).toFixed(2)} NZD` : "Not specified"}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Date Raised</p>
                                  <p className="mt-1 text-sm text-gray-700">
                                    {d.created_at ? new Date(d.created_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                                  </p>
                                </div>
                              </div>

                              {/* Full timeline */}
                              <DisputeTimeline dispute={d} />
                            </>
                          ) : (
                            <p className="mt-3 text-sm text-red-700 animate-pulse">Loading dispute details…</p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="mt-5 flex flex-wrap gap-3">
                      {/* ── Pre-payment flow buttons ── */}

                      {/* Owner confirm button (pending/waiting states) */}
                      {(b.status === "pending" || b.status === "waiting_owner") && !b.owner_confirmed && (
                        <button
                          onClick={() => ownerConfirmBooking(b)}
                          className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          ✅ Confirm Booking
                        </button>
                      )}

                      {/* Waiting badge */}
                      {b.status === "waiting_renter" && (
                        <span className="inline-flex items-center rounded-2xl bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">
                          ⏳ Waiting for renter to confirm…
                        </span>
                      )}

                      {/* Withdraw confirmation */}
                      {b.owner_confirmed && !["confirmed", "in_use", "return_check", "returning", "completed", "disputed"].includes(b.status || "") && (
                        cancelConfirmBookingId === b.id ? (
                          <div className="flex w-full flex-col gap-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 mt-2">
                            <p className="text-sm font-semibold text-orange-800">Withdraw confirmation?</p>
                            <input
                              value={cancelConfirmReason}
                              onChange={(e) => setCancelConfirmReason(e.target.value)}
                              placeholder="Reason (optional)"
                              className="rounded-xl border border-orange-200 px-3 py-2 text-sm outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => ownerWithdrawConfirmation(b)}
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
                            ↩ Withdraw
                          </button>
                        )
                      )}

                      {/* ── Post-payment lifecycle buttons ── */}

                      {/* in_use → mark as returned */}
                      {b.status === "in_use" && (
                        <button
                          onClick={() => handleMarkReturned(b)}
                          className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          📦 Mark as Returned
                        </button>
                      )}

                      {/* return_check → confirm return or raise dispute */}
                      {(b.status === "return_check" || b.status === "returning") && (
                        <>
                          <button
                            onClick={() => handleConfirmReturn(b)}
                            className="rounded-2xl bg-[#2f641f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245018]"
                          >
                            ✅ Confirm Return &amp; Release Payment
                          </button>
                          {disputingBookingId !== b.id && (
                            <button
                              onClick={() => { setDisputingBookingId(b.id); setDisputeReason(""); setDisputeAmount(""); }}
                              className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                            >
                              ⚠️ Raise Dispute
                            </button>
                          )}
                        </>
                      )}

                      {/* Dispute form inline */}
                      {disputingBookingId === b.id && (
                        <div className="w-full mt-2 rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
                          <p className="text-sm font-bold text-red-800">⚠️ Raise a Dispute</p>
                          <p className="text-xs text-red-600">Describe the issue. AirTool staff will review and contact both parties.</p>
                          <textarea
                            value={disputeReason}
                            onChange={(e) => setDisputeReason(e.target.value)}
                            placeholder="What is the issue? (e.g. tool returned damaged, missing parts, late return)"
                            rows={3}
                            className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400"
                          />
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-red-700">Amount claimed (NZD, optional)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={disputeAmount}
                              onChange={(e) => setDisputeAmount(e.target.value)}
                              placeholder="e.g. 50.00"
                              className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-red-700">
                              Evidence photos (optional — up to 5 images)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []).slice(0, 5);
                                setDisputeEvidenceFiles(files);
                              }}
                              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-red-700"
                            />
                            {disputeEvidenceFiles.length > 0 && (
                              <p className="mt-1 text-xs text-red-600">
                                {disputeEvidenceFiles.length} file{disputeEvidenceFiles.length > 1 ? "s" : ""} selected
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRaiseDispute(b)}
                              disabled={disputeSubmitting}
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {disputeSubmitting ? "Uploading & submitting…" : "Submit Dispute"}
                            </button>
                            <button
                              onClick={() => { setDisputingBookingId(null); setDisputeEvidenceFiles([]); }}
                              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Disputed — action buttons hidden while dispute is active */}
                      {b.status === "disputed" && (
                        <span className="inline-flex items-center rounded-2xl border border-red-300 bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">
                          ⚠️ Awaiting AirTool decision
                        </span>
                      )}

                      {/* Decline (for pre-payment statuses only) */}
                      {!["in_use", "return_check", "returning", "completed", "disputed", "declined", "cancelled"].includes(b.status || "") && (
                        <button onClick={() => updateBookingStatus(b.id, "declined")}
                          className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                          Decline
                        </button>
                      )}

                      {/* Chat */}
                      {b.user_email && (
                        <BookingChat
                          bookingId={b.id}
                          myEmail={userEmail}
                          otherEmail={b.user_email}
                          otherName={b.user_name || undefined}
                          label="💬 Message Renter"
                        />
                      )}
                    </div>

                    {reviewsMap[b.id] && (
                      <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <p className="text-xs font-semibold uppercase tracking-widest text-yellow-700">Renter Review</p>
                          {b.user_name && (
                            <a href={`/profile/${reviewsMap[b.id].reviewer_id}`} className="text-xs font-semibold text-[#2f641f] hover:underline">
                              {b.user_name} →
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 text-yellow-400 text-base">
                          {[1,2,3,4,5].map(s => <span key={s}>{s <= reviewsMap[b.id].rating ? "★" : "☆"}</span>)}
                        </div>
                        {reviewsMap[b.id].content && (
                          <p className="mt-2 text-sm text-gray-700">{reviewsMap[b.id].content}</p>
                        )}
                        {reviewsMap[b.id].created_at && (
                          <p className="mt-1 text-xs text-gray-400">{new Date(reviewsMap[b.id].created_at!).toLocaleString()}</p>
                        )}
                      </div>
                    )}

                    <p className="mt-5 text-xs text-gray-400">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TOOL SALES ── shown in bookings tab */}
        {activeTab === "bookings" && (
          <div className="mt-6 rounded-[28px] bg-white p-6 shadow-sm">
            <div id="tool-sales-section" className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">🏷️ Tool Sales</h2>
                <p className="mt-0.5 text-sm text-black/50">Tools sold outright — awaiting payout from AirTool admin.</p>
                <p className="mt-1 text-xs text-blue-600 font-medium">
                  ℹ️ A {saleCommissionPct}% platform fee is deducted from each sale — your payout is the remaining {100 - saleCommissionPct}%.
                </p>
              </div>
              {sales.length > 0 && (
                <div className="flex gap-3 text-center">
                  <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-2">
                    <div className="text-lg font-bold text-orange-600">
                      NZ${sales.filter((s) => s.payout_status === "pending").reduce((sum, s) => {
                        const c = Number(s.platform_commission) > 0 ? Number(s.platform_commission) : Math.round(Number(s.sale_price) * saleCommissionPct) / 100;
                        return sum + Number(s.sale_price) - c;
                      }, 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">Pending payout (net)</div>
                  </div>
                  <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-2">
                    <div className="text-lg font-bold text-green-600">
                      NZ${sales.filter((s) => s.payout_status === "paid").reduce((sum, s) => {
                        const c = Number(s.platform_commission) > 0 ? Number(s.platform_commission) : Math.round(Number(s.sale_price) * saleCommissionPct) / 100;
                        return sum + Number(s.sale_price) - c;
                      }, 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">Paid out (net)</div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {sales.length === 0 ? (
                <p className="text-sm text-black/40">No tool sales yet.</p>
              ) : sales.map((s) => {
                const comm = Number(s.platform_commission) > 0
                  ? Number(s.platform_commission)
                  : Math.round(Number(s.sale_price) * saleCommissionPct) / 100;
                const net = Number(s.sale_price) - comm;
                return (
                <div key={s.id} className={`rounded-2xl border p-4 ${s.payout_status === "paid" ? "border-green-100 bg-green-50" : "border-orange-100 bg-orange-50"}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-gray-900">{s.tool_name}</div>
                      <div className="text-xs text-gray-500">
                        🛒 Buyer: <span className="font-medium text-gray-700">{s.buyer_name || s.buyer_email || "—"}</span>
                        {s.buyer_name && s.buyer_email && <span className="text-gray-400"> ({s.buyer_email})</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(s.paid_at).toLocaleDateString("en-NZ", { dateStyle: "long" })} · Ref: AT-SALE-{String(s.id).slice(0, 8).toUpperCase()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Stripe received: NZ${Number(s.sale_price).toFixed(2)}</div>
                      <div className="text-xs text-gray-400">− NZ${comm.toFixed(2)} platform fee ({saleCommissionPct}%)</div>
                      <div className="text-xl font-bold text-orange-600 mt-0.5">
                        NZ${net.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">your payout</div>
                      {s.payout_status === "paid" ? (
                        <div className="mt-1 space-y-0.5">
                          <div className="text-xs font-semibold text-green-600">✅ Paid out to you</div>
                          {s.payout_amount && (
                            <div className="text-xs text-green-700">NZ${Number(s.payout_amount).toFixed(2)} transferred</div>
                          )}
                          {s.payout_bank_account && (
                            <div className="text-xs text-gray-500">To: {s.payout_bank_account}</div>
                          )}
                          {s.payout_date && (
                            <div className="text-xs text-gray-400">{new Date(s.payout_date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</div>
                          )}
                          {s.payout_note && (
                            <div className="text-xs text-gray-500 italic">{s.payout_note}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs font-semibold mt-1 text-amber-600">⏳ Payout pending from AirTool</div>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        )}

        {/* ── TOOLS MANAGEMENT TAB ── */}
        {activeTab === "tools" && (
          <>
            <div className="rounded-2xl border border-green-100 bg-green-50/70 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-green-600">What you can do here</p>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-green-800">
                <li>1. Update tool info</li>
                <li>2. Promote your tool</li>
                <li>3. Sell your tool</li>
                <li>4. Withdraw your tool from the market</li>
              </ul>
            </div>

            {toolsLoading ? (
              <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm">
                <p className="text-gray-600">Loading your tools...</p>
              </div>
            ) : ownerTools.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
                <p className="text-lg font-semibold">No tools listed yet.</p>
                <p className="mt-2 text-sm">Your tool listings will appear here once added.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {ownerTools.map((tool) => (
                  <div key={tool.id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">

                    {/* Photo area — click to edit, X to delete */}
                    <div className="relative aspect-[4/3] bg-gray-100 group">
                      <a href={`/tools/${tool.id}/edit`} className="block h-full w-full">
                        {tool.image_url ? (
                          <img src={tool.image_url} alt={tool.name || "Tool"} className="h-full w-full object-cover transition group-hover:brightness-90" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-gray-400">No photo yet</div>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-white">✏️ Edit listing</span>
                        </span>
                      </a>
                      {/* Delete X */}
                      <button
                        onClick={() => handleDeleteTool(tool.id, tool.name)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white text-xs font-bold hover:bg-red-600 transition z-10"
                        title="Delete tool"
                      >✕</button>
                      {tool.promo_price && (
                        <span className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow">
                          {tool.promo_label || "PROMO"} ${Number(tool.promo_price).toFixed(2)}/day
                        </span>
                      )}
                    </div>

                    {/* Video preview */}
                    {tool.video_url && (
                      <video src={tool.video_url} controls className="w-full max-h-40 bg-black object-contain" />
                    )}

                    <div className="p-5 space-y-4">
                      {/* Tool info */}
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <a
                              href={`/tools/${tool.id}`}
                              className="text-lg font-bold text-gray-900 hover:text-[#2f641f] hover:underline"
                            >
                              {tool.name || "Unnamed Tool"}
                            </a>
                            <a
                              href={`/tools/${tool.id}`}
                              className="ml-2 text-xs font-medium text-[#8bbb46] hover:underline"
                            >
                              View →
                            </a>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            tool.status === "active" ? "bg-green-100 text-green-700" :
                            tool.status === "for_sale" ? "bg-orange-100 text-orange-700" :
                            tool.status === "sold" ? "bg-gray-200 text-gray-500" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {tool.status === "for_sale" ? "For Sale" : tool.status === "sold" ? "Sold" : tool.status || "active"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="relative flex-1">
                            <select
                              value={tool.category || "Uncategorised"}
                              onChange={(e) => handleUpdateCategory(tool.id, e.target.value)}
                              disabled={savingCategoryId === tool.id}
                              className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-7 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60 cursor-pointer focus:outline-none focus:border-gray-400"
                            >
                              {TOOL_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▾</span>
                          </div>
                          {savedCategoryId === tool.id && (
                            <span className="shrink-0 text-sm font-semibold text-green-600">✓ Saved</span>
                          )}
                          {savingCategoryId === tool.id && (
                            <span className="shrink-0 text-xs text-gray-400">Saving…</span>
                          )}
                        </div>
                        <p className="mt-1 text-lg font-bold text-gray-900">
                          ${Number(tool.price_per_day || 0).toFixed(2)}
                          <span className="text-sm font-normal text-gray-500"> / day</span>
                        </p>

                        {/* Condition self-assessment */}
                        <div className="mt-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-black/40">Condition</p>
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <select
                                value={tool.condition || ""}
                                onChange={(e) => handleUpdateCondition(tool.id, e.target.value)}
                                disabled={savingConditionId === tool.id}
                                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-7 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60 cursor-pointer focus:outline-none focus:border-amber-300"
                              >
                                <option value="">— not set —</option>
                                {CONDITION_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▾</span>
                            </div>
                            {tool.condition && CONDITION_STARS[tool.condition] && (
                              <span className="shrink-0 text-sm text-amber-400 tracking-tight">
                                {"★".repeat(CONDITION_STARS[tool.condition])}{"☆".repeat(5 - CONDITION_STARS[tool.condition])}
                              </span>
                            )}
                            {savedConditionId === tool.id && (
                              <span className="shrink-0 text-sm font-semibold text-green-600">✓</span>
                            )}
                            {savingConditionId === tool.id && (
                              <span className="shrink-0 text-xs text-gray-400">Saving…</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Upload photo */}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          ref={(el) => { photoInputRefs.current[tool.id] = el; }}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadPhoto(tool.id, file);
                          }}
                        />
                        <button
                          onClick={() => photoInputRefs.current[tool.id]?.click()}
                          disabled={uploadingPhotoId === tool.id}
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                        >
                          {uploadingPhotoId === tool.id ? "Uploading photo..." : "📷 Upload / Replace Photo"}
                        </button>
                      </div>

                      {/* Upload video */}
                      <div>
                        <input
                          type="file"
                          accept="video/*"
                          ref={(el) => { videoInputRefs.current[tool.id] = el; }}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadVideo(tool.id, file);
                          }}
                        />
                        <button
                          onClick={() => videoInputRefs.current[tool.id]?.click()}
                          disabled={uploadingVideoId === tool.id}
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                        >
                          {uploadingVideoId === tool.id ? "Uploading video..." : "🎥 Upload / Replace Video"}
                        </button>
                      </div>

                      {/* For sale / replacement value */}
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                          🏷️ For Sale / Replacement Value
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-amber-700/60">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={tool.sale_price ?? ""}
                            onBlur={(e) => handleUpdateSalePrice(tool.id, e.target.value)}
                            placeholder="e.g. 350"
                            className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                          />
                        </div>
                        <p className="text-[10px] text-amber-600/70 leading-4">
                          Sets the sell price &amp; lost-tool replacement cost. Guides deposit amount.
                        </p>
                      </div>

                      {/* Promo price */}
                      {editingPromoId === tool.id ? (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">Set Promotional Price</p>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={promoPrice}
                            onChange={(e) => setPromoPrice(e.target.value)}
                            placeholder="Promo price / day"
                            className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                          />
                          <input
                            type="text"
                            value={promoLabel}
                            onChange={(e) => setPromoLabel(e.target.value)}
                            placeholder='Label e.g. "SALE" or "WEEKEND DEAL"'
                            className="w-full rounded-xl border border-orange-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSavePromo(tool.id)}
                              disabled={promoSaving}
                              className="flex-1 rounded-xl bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                            >
                              {promoSaving ? "Saving..." : "Save Promo"}
                            </button>
                            <button
                              onClick={() => { setEditingPromoId(null); setPromoPrice(""); setPromoLabel(""); }}
                              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                          {tool.promo_price && (
                            <button
                              onClick={async () => {
                                await supabase.from("tools").update({ promo_price: null, promo_label: null }).eq("id", tool.id);
                                setOwnerTools((prev) => prev.map((t) => t.id === tool.id ? { ...t, promo_price: null, promo_label: null } : t));
                                setEditingPromoId(null);
                              }}
                              className="w-full rounded-xl border border-red-200 py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
                            >
                              Remove Promo
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPromoId(tool.id);
                            setPromoPrice(tool.promo_price ? String(tool.promo_price) : "");
                            setPromoLabel(tool.promo_label || "");
                          }}
                          className={`w-full rounded-2xl py-2 text-sm font-semibold transition ${tool.promo_price ? "border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100" : "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
                        >
                          {tool.promo_price ? `🏷️ Promo: $${Number(tool.promo_price).toFixed(2)}/day — Edit` : "🏷️ Set Promo Price"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
