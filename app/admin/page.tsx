"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Megaphone,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import DashboardShell from "../components/dashboard-shell";
import DisputeTimeline from "../components/dispute-timeline";

type Booking = {
  id: number;
  tool_id: number | null;
  renter_name?: string | null;
  user_name?: string | null;
  renter_email?: string | null;
  user_email?: string | null;
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
};

type Tool = {
  id: number;
  name: string | null;
  owner_email?: string | null;
  listing_type?: string | null;
  category?: string | null;
  hub?: string | null;
};

const statusColorMap: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800",
  pending: "bg-yellow-100 text-yellow-800",  // ← add this
  approved: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-700",
};

const financeRanges = [
  { key: "today", label: "Today" },
  { key: "7days", label: "Last 7 Days" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
] as const;

type FinanceRange = (typeof financeRanges)[number]["key"];
type BookingTab = "new" | "hub" | "p2p" | "approved" | "completed";

type Dispute = {
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
  status: string | null;
  created_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  admin_notes: string | null;
};

function safeMoney(value: number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

function getStartDateForRange(range: FinanceRange) {
  const now = new Date();
  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "7days") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return null;
}

export default function AdminPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolsMap, setToolsMap] = useState<Record<number, string>>({});
  const [toolsTypeMap, setToolsTypeMap] = useState<Record<number, string>>({});
  const [profilesCount, setProfilesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [errorText, setErrorText] = useState("");
  const [financeRange, setFinanceRange] = useState<FinanceRange>("month");
  const [bookingTab, setBookingTab] = useState<BookingTab>("new");
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [resolvingDisputeId, setResolvingDisputeId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [resolution, setResolution] = useState<"release_to_owner" | "partial_refund" | "full_refund">("release_to_owner");
  const [disputeResolving, setDisputeResolving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let authedUser: any = null;

    const fetchAdminData = async (showLoading = false) => {
      if (!authedUser) return;
      const user = authedUser;
      if (showLoading) setLoading(true);
      setErrorText("");

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (isMounted) {
        setRole(profile?.role ?? "admin");
        setUserEmail(user.email || "");
      }

      const { data: toolsData, error: toolsError } = await supabase
        .from("tools")
        .select("id,name,owner_email,listing_type");


      if (!toolsError && toolsData && isMounted) {
        const typedTools = (toolsData as Tool[]) || [];
        setTools(typedTools);

        const nameMap: Record<number, string> = {};
        const typeMap: Record<number, string> = {};

        typedTools.forEach((tool) => {
          if (typeof tool.id === "number") {
            nameMap[tool.id] = tool.name || `Tool #${tool.id}`;
            typeMap[tool.id] = tool.listing_type || "hub";
          }
        });

        setToolsMap(nameMap);
        setToolsTypeMap(typeMap);
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (bookingsError) {
        if (isMounted) {
          setErrorText(bookingsError.message);
          setLoading(false);
        }
        return;
      }

      const { count: profileCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Fetch disputes (best-effort — table may not exist yet)
      const { data: disputesData } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });

      if (isMounted) {
        setProfilesCount(profileCount || 0);
        setBookings((bookingsData as Booking[]) || []);
        if (disputesData) setDisputes(disputesData as Dispute[]);
        setLoading(false);
      }
    };

    let cancelled = false;

    supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !isMounted) return;
      if (session?.user) {
        authedUser = session.user;
        fetchAdminData(true);
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    const interval = setInterval(() => { fetchAdminData(false); }, 5000);
    return () => {
      cancelled = true;
      isMounted = false;
      clearInterval(interval);
    };
  }, [router]);

const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
};

  useEffect(() => {
    if (!loading && role && role !== "admin") {
      if (role === "owner") router.replace("/owner");
      else if (role === "hub") router.replace("/hub");
      else router.replace("/search");
    }
  }, [loading, role, router]);

  const filteredFinanceBookings = useMemo(() => {
    const start = getStartDateForRange(financeRange);
    if (!start) return bookings;

    return bookings.filter((b) => {
      if (!b.created_at) return false;
      return new Date(b.created_at) >= start;
    });
  }, [bookings, financeRange]);

  const totalBookings = bookings.length;

  const totalTurnover = useMemo(
    () => bookings.reduce((sum, b) => sum + Number(b.price_total || 0), 0),
    [bookings]
  );

  const totalPlatformRevenue = useMemo(
    () => bookings.reduce((sum, b) => sum + Number(b.platform_fee || 0), 0),
    [bookings]
  );

  const financeTurnover = useMemo(
    () =>
      filteredFinanceBookings.reduce(
        (sum, b) => sum + Number(b.price_total || 0),
        0
      ),
    [filteredFinanceBookings]
  );

  const financePlatformRevenue = useMemo(
    () =>
      filteredFinanceBookings.reduce(
        (sum, b) => sum + Number(b.platform_fee || 0),
        0
      ),
    [filteredFinanceBookings]
  );

  const financeBookingCount = filteredFinanceBookings.length;

  const activeToolsCount = useMemo(() => {
    const activeToolIds = new Set(
      bookings
        .filter((b) => {
          const status = b.status || "new";
          return (
            status === "new" ||
            status === "approved" ||
            status === "completed"
          );
        })
        .map((b) => b.tool_id)
        .filter((id): id is number => typeof id === "number")
    );
    return activeToolIds.size;
  }, [bookings]);

  const newBookings = useMemo(
    () => bookings.filter((b) => 
    b.status === "new" || b.status === "pending" || !b.status
  ),
  [bookings]
);

  const approvedBookings = useMemo(
    () => bookings.filter((b) => (b.status || "") === "approved"),
    [bookings]
  );

  const completedBookings = useMemo(
    () => bookings.filter((b) => (b.status || "") === "completed"),
    [bookings]
  );

const hubPendingBookings = useMemo(
  () => bookings.filter((b) => {
    const status = b.status || "new";
    const listingType = toolsTypeMap[b.tool_id || 0] || "hub";
    return (status === "new" || status === "pending") && listingType !== "p2p";
  }),
  [bookings, toolsTypeMap]
);

const p2pPendingBookings = useMemo(
  () => bookings.filter((b) => {
    const status = b.status || "new";
    const listingType = toolsTypeMap[b.tool_id || 0] || "hub";
    return (status === "new" || status === "pending") && listingType === "p2p";
  }),
  [bookings, toolsTypeMap]
);

  const currentTabBookings = useMemo(() => {
    if (bookingTab === "new") return newBookings;
    if (bookingTab === "hub") return hubPendingBookings;
    if (bookingTab === "p2p") return p2pPendingBookings;
    if (bookingTab === "approved") return approvedBookings;
    return completedBookings;
  }, [
    bookingTab,
    newBookings,
    hubPendingBookings,
    p2pPendingBookings,
    approvedBookings,
    completedBookings,
  ]);

  const suspiciousCount = useMemo(
    () =>
      bookings.filter((b) => {
        const hasNoPhone = !b.phone || !b.phone.trim();
        const hasNoAddress = !b.address || !b.address.trim();
        return hasNoPhone || hasNoAddress;
      }).length,
    [bookings]
  );

  const missingMessageCount = useMemo(
    () => bookings.filter((b) => !b.message || !b.message.trim()).length,
    [bookings]
  );

  const topToolNames = useMemo(() => {
    const counter = new Map<string, number>();

    bookings.forEach((b) => {
      const name = toolsMap[b.tool_id || 0];
      if (!name) return;
      counter.set(name, (counter.get(name) || 0) + 1);
    });

    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [bookings, toolsMap]);

  const topListingTypes = useMemo(() => {
    const counts = { hub: 0, p2p: 0, sale: 0 };

    tools.forEach((tool) => {
      const type = (tool.listing_type || "hub").toLowerCase();
      if (type.includes("sale")) counts.sale += 1;
      else if (type === "p2p") counts.p2p += 1;
      else counts.hub += 1;
    });

    return counts;
  }, [tools]);

  const aiHighlights = [
    {
      title: "AI Overview",
      desc: "Weekly AI summary, quick suggestions, pending review signals.",
      stat: `${newBookings.length} new signals`,
      icon: Brain,
    },
    {
      title: "Customer Service AI",
      desc: "FAQ review queue, weak answers, knowledge updates.",
      stat: `${missingMessageCount} incomplete messages`,
      icon: MessageSquareText,
    },
    {
      title: "Search & Recommendation",
      desc: "Top searches, hot tools, no-result trends, recommendation hints.",
      stat: `${topToolNames.length} hot tools`,
      icon: Search,
    },
    {
      title: "Social Feedback",
      desc: "AI-assisted social ideas, platform news, trending content hooks.",
      stat: "Content-ready",
      icon: Sparkles,
    },
  ];

  const riskItems = [
    {
      title: "Suspicious user activity",
      detail: `${suspiciousCount} bookings are missing phone or address.`,
      level: "Medium",
    },
    {
      title: "P2P pending decisions",
      detail: `${p2pPendingBookings.length} P2P bookings are waiting for owner response.`,
      level: "Normal",
    },
    {
      title: "Hub pending decisions",
      detail: `${hubPendingBookings.length} hub bookings are waiting for hub response.`,
      level: "Normal",
    },
    {
      title: "AI knowledge review",
      detail: "AI-generated rule and customer-service content should still be reviewed by admin.",
      level: "High",
    },
  ];

  const tabConfig: { key: BookingTab; label: string; count: number }[] = [
    { key: "new", label: "New", count: newBookings.length },
    { key: "hub", label: "Hub", count: hubPendingBookings.length },
    { key: "p2p", label: "P2P", count: p2pPendingBookings.length },
    { key: "approved", label: "Approved", count: approvedBookings.length },
    { key: "completed", label: "Completed", count: completedBookings.length },
  ];

  const renderBookingCard = (b: Booking) => {
    const listingType = toolsTypeMap[b.tool_id || 0] || "hub";
    const hasRisk =
      !b.phone?.trim() || !b.address?.trim() || !b.message?.trim();

    return (
      <div
        key={b.id}
        className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">
                {b.tool_id ? (
                  <a href={`/tools/${b.tool_id}`} className="hover:text-[#2f641f] hover:underline">
                    {Object.keys(toolsMap).length === 0 ? "Loading..." : (toolsMap[b.tool_id] || "Unknown Tool")}
                  </a>
                ) : (
                  Object.keys(toolsMap).length === 0 ? "Loading..." : (toolsMap[b.tool_id || 0] || "Unknown Tool")
                )}
              </h3>
              {b.tool_id && (
                <a
                  href={`/tools/${b.tool_id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[#8bbb46]/40 bg-[#f0f8e8] px-2.5 py-0.5 text-[11px] font-semibold text-[#2f641f] hover:bg-[#e4f5d4] transition"
                >
                  🔧 Details
                </a>
              )}

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {listingType}
              </span>

              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  statusColorMap[b.status || "new"] ||
                  "bg-gray-100 text-gray-800"
                }`}
              >
                {b.status || "new"}
              </span>

              {hasRisk ? (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  AI flag
                </span>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
              <p>
                <span className="font-semibold text-slate-900">Renter:</span>{" "}
                {b.renter_name || b.user_name || "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Email:</span>{" "}
                {b.renter_email || "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Owner:</span>{" "}
                {b.owner_email || "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Phone:</span>{" "}
                {b.phone || "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Start:</span>{" "}
                {b.start_date || "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">End:</span>{" "}
                {b.end_date || "-"}
              </p>
              <p className="md:col-span-2 xl:col-span-3">
                <span className="font-semibold text-slate-900">Preferred:</span>{" "}
                {b.preferred_dates || "-"}
              </p>
              <p className="md:col-span-2 xl:col-span-3">
                <span className="font-semibold text-slate-900">Address:</span>{" "}
                {b.address || "-"}
              </p>
              <p className="md:col-span-2 xl:col-span-3">
                <span className="font-semibold text-slate-900">Message:</span>{" "}
                {b.message || "-"}
              </p>
            </div>
          </div>

          <div className="min-w-[180px] rounded-3xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Finance
            </p>
            <p className="mt-2 text-sm text-slate-500">Price total</p>
            <p className="text-xl font-bold text-slate-900">
              ${safeMoney(b.price_total)}
            </p>
            <p className="mt-3 text-sm text-slate-500">Platform fee</p>
            <p className="text-lg font-bold text-slate-900">
              ${safeMoney(b.platform_fee)}
            </p>
            <p className="mt-4 text-xs text-slate-400">
              {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const handleResolveDispute = async (disputeId: number, bookingId: number) => {
    setDisputeResolving(true);
    try {
      await supabase.from("disputes").update({
        status:       "resolved",
        admin_notes:  adminNotes.trim() || null,
        resolution,
        resolved_at:  new Date().toISOString(),
      }).eq("id", disputeId);

      // Map resolution → final booking status
      const bookingStatus =
        resolution === "release_to_owner" ? "completed" :
        resolution === "partial_refund"   ? "refunded"  :
        resolution === "full_refund"      ? "refunded"  :
        "completed";
      await supabase.from("bookings").update({ status: bookingStatus }).eq("id", bookingId);

      if (bookingStatus === "completed") {
        fetch('/api/xp/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId, new_status: bookingStatus }),
        })
      }

      setDisputes((prev) => prev.map((d) =>
        d.id === disputeId ? { ...d, status: "resolved", resolution, admin_notes: adminNotes.trim() || null } : d
      ));
      setResolvingDisputeId(null);
      setAdminNotes("");
    } finally {
      setDisputeResolving(false);
    }
  };

  if (loading || role === null) {
    return (
      <DashboardShell title="Checking access..." subtitle="Please wait">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <p className="text-slate-600">Loading admin page...</p>
        </div>
      </DashboardShell>
    );
  }

  if (role !== "admin") {
    return null;
  }

  return (
    <DashboardShell
      title="Admin Control Center"
      subtitle={`Admin: ${userEmail || "-"}`}
    >
      <div className="grid gap-6 pb-24">
        <section className="overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/90 to-blue-50/80 p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                <Bot className="h-4 w-4" />
                Platform + AI Control
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
                Keep the old structure, add AI into every practical function.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Admin is mainly for platform control, finance, risk, rules,
                announcements, social media direction, disputes, and AI review.
                Normal booking approval still belongs to owner or hub where
                appropriate.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  New
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {newBookings.length}
                </p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  P2P Pending
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {p2pPendingBookings.length}
                </p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Hub Pending
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {hubPendingBookings.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {errorText ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-medium text-red-700">Error</p>
            <p className="mt-2 text-sm text-red-600">{errorText}</p>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Total Bookings
              </p>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {totalBookings}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Active Tools
              </p>
              <Wrench className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {activeToolsCount}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Users
              </p>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {profilesCount}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Turnover
              </p>
              <CircleDollarSign className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              ${safeMoney(totalTurnover)}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Platform Revenue
              </p>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              ${safeMoney(totalPlatformRevenue)}
            </p>
          </div>

          <div className="rounded-[28px] border border-red-100 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-red-400">
                Risk Alerts
              </p>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {riskItems.length}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Data & Finance
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Overview
                </h2>
              </div>
              <CircleDollarSign className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {financeRanges.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFinanceRange(item.key)}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    financeRange === item.key
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Range turnover</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  ${safeMoney(financeTurnover)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Range platform income</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  ${safeMoney(financePlatformRevenue)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Range booking count</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {financeBookingCount}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-sky-700" />
                  <p className="text-sm font-semibold text-sky-800">
                    AI summary
                  </p>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    Hot tools:{" "}
                    {topToolNames.length > 0
                      ? topToolNames
                          .map(([name, count]) => `${name} (${count})`)
                          .join(", ")
                      : "No data yet"}
                  </p>
                  <p>Hub listings: {topListingTypes.hub}</p>
                  <p>P2P listings: {topListingTypes.p2p}</p>
                  <p>Sale listings: {topListingTypes.sale}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Actions & Risk Control
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Operations
                </h2>
              </div>
              <ShieldAlert className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-6 grid gap-3">
              {[
                "Block user",
                "Suspend listing",
                "Review suspicious booking",
                "Review low-rating pattern",
                "Promote tool",
                "Promote hub",
                "Promote sponsor",
              ].map((item) => (
                <button
                  key={item}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span>{item}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
              {(() => {
                const openCount = disputes.filter((d) => d.status === "open").length;
                return (
                  <button
                    onClick={() => document.getElementById("disputes")?.scrollIntoView({ behavior: "smooth" })}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span>Handle dispute</span>
                    <div className="flex items-center gap-2">
                      {openCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
                          {openCount}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                );
              })()}
            </div>

            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <p className="text-sm font-semibold text-amber-800">
                  AI risk assist
                </p>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Missing info bookings: {suspiciousCount}</p>
                <p>P2P pending owner actions: {p2pPendingBookings.length}</p>
                <p>Hub pending hub actions: {hubPendingBookings.length}</p>
                <p>Repeat checks should stay under admin control.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Rules, Info & Media
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Platform publishing
                </h2>
              </div>
              <Megaphone className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    Rules & announcements
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Platform notices, trust updates, rule changes, and official
                  information.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    Point system & reward policy
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  AirTool points, good/bad trade logic, and social media reward
                  scoring.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    Social media publishing
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Platform news, popular tools, useful stats, and sticky content
                  for stronger user connection.
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-sky-700" />
                  <p className="text-sm font-semibold text-sky-800">
                    AI publishing assist
                  </p>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Generate announcement draft</p>
                  <p>Generate social post draft</p>
                  <p>Suggest hot tools to highlight</p>
                  <p>Suggest trust-building platform updates</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
  id="transactions"
  className="scroll-mt-24 rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm"
>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Transaction Workspace
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Booking flow
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {tabConfig.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setBookingTab(tab.key)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    bookingTab === tab.key
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {currentTabBookings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                No records in this tab.
              </div>
            ) : (
              currentTabBookings.slice(0, 8).map((b) => renderBookingCard(b))
            )}
          </div>
          {currentTabBookings.length > 8 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                Showing 8 of {currentTabBookings.length} — export for full list
              </span>
              <button
                onClick={() => {
                  const sorted = [...bookings].sort(
                    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
                  );
                  const headers = ["ID","Tool","Renter","Email","Owner Email","Phone","Start Date","End Date","Preferred Dates","Address","Status","Price Total","Platform Fee","Created At"];
                  const rows = sorted.map((b) => [
                    b.id,
                    toolsMap[b.tool_id ?? 0] || "",
                    b.renter_name || b.user_name || "",
                    b.renter_email || b.user_email || "",
                    b.owner_email || "",
                    b.phone || "",
                    b.start_date || "",
                    b.end_date || "",
                    b.preferred_dates || "",
                    b.address || "",
                    b.status || "",
                    b.price_total ?? "",
                    b.platform_fee ?? "",
                    b.created_at || "",
                  ]);
                  const csv = [headers, ...rows]
                    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
                    .join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "bookings-export.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                More… (export all as CSV)
              </button>
            </div>
          )}
        </section>

        {/* ── Disputes ── */}
        <section
          id="disputes"
          className="scroll-mt-24 rounded-[30px] border border-red-200 bg-white/90 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-red-400">Dispute Management</p>
              <h2 className="mt-1 flex items-center gap-3 text-2xl font-bold text-slate-900">
                ⚠️ Open Disputes
                {disputes.filter((d) => d.status === "open").length > 0 && (
                  <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-red-500 px-2 text-sm font-bold text-white">
                    {disputes.filter((d) => d.status === "open").length}
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-6">
            {disputes.filter((d) => d.status !== "resolved").length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                No open disputes. When an owner raises a dispute it will appear here.
              </div>
            ) : (
              disputes.filter((d) => d.status !== "resolved").map((d) => (
                <div
                  key={d.id}
                  className={`rounded-[28px] border p-6 ${d.status === "resolved" ? "border-gray-200 bg-gray-50 opacity-80" : "border-red-200 bg-white"}`}
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${d.status === "resolved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {d.status === "resolved" ? "✅ Resolved" : "⚠️ Open"}
                      </span>
                      <span className="text-xs text-slate-400">
                        Dispute #{d.id} · Booking #{d.booking_id}
                        {d.amount_claimed ? ` · Claimed: $${Number(d.amount_claimed).toFixed(2)}` : ""}
                      </span>
                      {d.renter_response && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          Renter responded
                        </span>
                      )}
                    </div>
                    {d.status === "open" && resolvingDisputeId !== d.id && (
                      <button
                        onClick={() => { setResolvingDisputeId(d.id); setAdminNotes(""); setResolution("release_to_owner"); }}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                      >
                        Resolve Dispute
                      </button>
                    )}
                  </div>

                  {/* Full dispute timeline */}
                  <DisputeTimeline dispute={d} />

                  {/* Resolve form */}
                  {resolvingDisputeId === d.id && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                      <p className="text-sm font-bold text-slate-800">⚖️ Resolve Dispute #{d.id}</p>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Decision</label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value as typeof resolution)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                        >
                          <option value="release_to_owner">Release payment to owner — tool was damaged / returned late</option>
                          <option value="partial_refund">Partial refund to renter — split responsibility</option>
                          <option value="full_refund">Full refund to renter — owner at fault</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Admin notes (visible to both parties)</label>
                        <textarea
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          rows={3}
                          placeholder="Explain your decision clearly — both the owner and renter will see this."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveDispute(d.id, d.booking_id)}
                          disabled={disputeResolving}
                          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          {disputeResolving ? "Saving…" : "✅ Mark as Resolved"}
                        </button>
                        <button
                          onClick={() => setResolvingDisputeId(null)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {disputes.filter((d) => d.status === "resolved").length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {disputes.filter((d) => d.status === "resolved").length} resolved case{disputes.filter((d) => d.status === "resolved").length !== 1 ? "s" : ""} hidden — click More… to export all
              </span>
              <button
                onClick={() => {
                  const sorted = [...disputes].sort(
                    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
                  );
                  const headers = ["ID","Booking ID","Owner Email","Renter Email","Reason","Amount Claimed","Status","Resolution","Admin Notes","Created At","Resolved At"];
                  const rows = sorted.map((d) => [
                    d.id,
                    d.booking_id,
                    d.owner_email || "",
                    d.renter_email || "",
                    d.reason || "",
                    d.amount_claimed ?? "",
                    d.status || "",
                    d.resolution || "",
                    d.admin_notes || "",
                    d.created_at || "",
                    d.resolved_at || "",
                  ]);
                  const csv = [headers, ...rows]
                    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
                    .join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "disputes-export.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                More… (export all as CSV)
              </button>
            </div>
          )}
        </section>

        <section
  id="ai-highlights"
  className="scroll-mt-24 rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm"
>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                AI Highlights
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Light AI module
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Because AI is already blended into finance, risk control, rules,
                and media, this section stays lighter and only shows the extra
                AI functions that do not need to be repeated too heavily.
              </p>
            </div>

            <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Open AI Center
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {aiHighlights.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-white p-3 shadow-sm">
                      <Icon className="h-5 w-5 text-slate-700" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.desc}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                    {card.stat}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section
  id="risk-review"
  className="scroll-mt-24 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"
>
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Risk & Review Queue
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Logic completeness
            </h2>

            <div className="mt-6 grid gap-4">
              {riskItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-slate-500" />
                        <p className="font-semibold text-slate-900">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.level === "High"
                          ? "bg-red-100 text-red-700"
                          : item.level === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {item.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Notes
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Design principle
            </h2>

            <div className="mt-6 space-y-4 rounded-3xl bg-slate-50/80 p-5 text-sm leading-7 text-slate-700">
              <p>
                1. Keep the old 3-column structure because it is easier to reuse
                later for admin, hub, owner, and renter dashboards.
              </p>
              <p>
                2. Put AI inside the existing business functions first, instead
                of making AI too separate and too heavy.
              </p>
              <p>
                3. If one function logically needs another entry point inside AI
                or risk queue, repeating the entrance is acceptable.
              </p>
              <p>
                4. Platform rules, announcements, social media publishing, and
                AI-assisted content all belong to the same publishing direction.
              </p>
            </div>
          </div>
        </section>
      </div>
      
  <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
  <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 p-2 shadow-lg backdrop-blur-md">
    <button
      onClick={() => scrollToSection("transactions")}
      className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      <FileText className="h-4 w-4" />
      <span>Transactions</span>
    </button>

    <button
      onClick={() => scrollToSection("disputes")}
      className="relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      <ShieldAlert className="h-4 w-4" />
      <span>Disputes</span>
      {disputes.filter((d) => d.status === "open").length > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {disputes.filter((d) => d.status === "open").length}
        </span>
      )}
    </button>

    <button
      onClick={() => scrollToSection("ai-highlights")}
      className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      <Brain className="h-4 w-4" />
      <span>AI</span>
    </button>

    <button
      onClick={() => scrollToSection("risk-review")}
      className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      <ShieldAlert className="h-4 w-4" />
      <span>Risk</span>
    </button>
  </div>
</div>

    </DashboardShell>
  );
}