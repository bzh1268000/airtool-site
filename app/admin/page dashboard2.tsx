"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import DashboardShell from "../components/dashboard-shell";

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
};

type Tool = {
  id: number;
  name: string | null;
  owner_email?: string | null;
  listing_type?: string | null;
};

const statusColorMap: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800",
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

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [toolsMap, setToolsMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [errorText, setErrorText] = useState("");
  const [financeRange, setFinanceRange] = useState<FinanceRange>("month");

  useEffect(() => {
    let isMounted = true;

    const fetchAdminData = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      setErrorText("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        if (isMounted) {
          setErrorText(authError.message);
          setLoading(false);
        }
        return;
      }

      if (!user?.id) {
        if (isMounted) {
          setErrorText("Please log in first.");
          setLoading(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (isMounted) {
        setRole(profile?.role || null);
        setUserEmail(user.email || "");
      }

      const { data: toolsData, error: toolsError } = await supabase
        .from("tools")
        .select("id,name,owner_email,listing_type");

      if (!toolsError && toolsData && isMounted) {
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
        .order("created_at", { ascending: false });

      if (bookingsError) {
        if (isMounted) {
          setErrorText(bookingsError.message);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setBookings((bookingsData as Booking[]) || []);
        setLoading(false);
      }
    };

    fetchAdminData(true);

    const interval = setInterval(() => {
      fetchAdminData(false);
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!loading && role && role !== "admin") {
      if (role === "owner") router.replace("/owner");
      else if (role === "hub") router.replace("/hub");
      else router.replace("/search");
    }
  }, [loading, role, router]);

  const getStartDateForRange = (range: FinanceRange) => {
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
  };

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

  const platformRevenue = useMemo(
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

  const currentListings = useMemo(
    () =>
      bookings.filter((b) => {
        const status = b.status || "new";
        return status === "new" || status === "approved";
      }),
    [bookings]
  );

  const pastListings = useMemo(
    () =>
      bookings.filter((b) => {
        const status = b.status || "new";
        return (
          status === "completed" ||
          status === "declined" ||
          status === "cancelled"
        );
      }),
    [bookings]
  );

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

  const renderBookingCard = (b: Booking, showReview = false) => (
    <div
      key={b.id}
      className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {toolsMap[b.tool_id || 0] || "Unknown Tool"}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-600">Status:</p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                statusColorMap[b.status || "new"] ||
                "bg-gray-100 text-gray-800"
              }`}
            >
              {b.status || "new"}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
            Platform fee
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            ${Number(b.platform_fee || 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-gray-700 md:grid-cols-2 xl:grid-cols-3">
        <p>
          <span className="font-medium text-gray-900">Renter:</span>{" "}
          {b.renter_name || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">Renter email:</span>{" "}
          {b.renter_email || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">Owner email:</span>{" "}
          {b.owner_email || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">Phone:</span>{" "}
          {b.phone || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">Start date:</span>{" "}
          {b.start_date || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">End date:</span>{" "}
          {b.end_date || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">Preferred dates:</span>{" "}
          {b.preferred_dates || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">Address:</span>{" "}
          {b.address || "-"}
        </p>
        <p>
          <span className="font-medium text-gray-900">Price total:</span>{" "}
          ${Number(b.price_total || 0).toFixed(2)}
        </p>
        <p className="md:col-span-2 xl:col-span-3">
          <span className="font-medium text-gray-900">Message:</span>{" "}
          {b.message || "-"}
        </p>
      </div>

      {showReview && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
  <p className="text-sm font-semibold text-gray-900">Review</p>
  <p className="mt-1 text-sm text-gray-600">
    No review available for this completed transaction yet.
  </p>
</div>
      )}

      <p className="mt-5 text-xs text-gray-400">
        {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
      </p>
    </div>
  );

  if (loading || role === null) {
    return (
      <DashboardShell title="Checking access..." subtitle="Please wait">
        <div className="rounded-3xl border border-gray-200 bg-white/70 p-6 shadow-sm">
          <p className="text-gray-600">Loading...</p>
        </div>
      </DashboardShell>
    );
  }

  if (role !== "admin") {
    return null;
  }

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle={`Admin: ${userEmail || "-"}`}
    >
      <div className="grid gap-6">
        <div className="rounded-3xl border border-blue-100 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            Platform control
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Admin does not normally approve bookings. P2P bookings should be
            approved by the owner, and hub bookings should be approved by hub
            staff. Admin is mainly for platform finance, risk control,
            promotions, disputes, rules, and override when necessary.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  Finance
                </p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">
                  Platform Finance
                </h2>
              </div>
              <div className="rounded-2xl bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                Query enabled
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {financeRanges.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFinanceRange(item.key)}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    financeRange === item.key
                      ? "bg-gray-900 text-white"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Turnover</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  ${financeTurnover.toFixed(2)}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Platform Income</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  ${financePlatformRevenue.toFixed(2)}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Booking Count</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {financeBookingCount}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Active Tools</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {activeToolsCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Action
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              Platform Actions
            </h2>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Risk control
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-2xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
                    Block User
                  </button>
                  <button className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Suspend Listing
                  </button>
                  <button className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600">
                    Handle Dispute
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900">Promotion</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Promote Tool
                  </button>
                  <button className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Promote Hub
                  </button>
                  <button className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Promote User
                  </button>
                  <button className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Promote Sponsor
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
              Rules & Info
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              Platform Rules
            </h2>

            <div className="mt-6 space-y-4">
  <div className="rounded-2xl bg-gray-50 p-4">
    <p className="text-sm font-semibold text-gray-900">AirTool Point System</p>
    <p className="mt-2 text-sm leading-6 text-gray-600">
      Good trade +1. Bad trade -1. High score may upgrade to Hub.
    </p>
    <button className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
      View details
    </button>
  </div>

  <div className="rounded-2xl bg-gray-50 p-4">
    <p className="text-sm font-semibold text-gray-900">Social Media Reward</p>
    <p className="mt-2 text-sm leading-6 text-gray-600">
      Post short video, add AirTool link and tags, then claim points.
    </p>
    <button className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
      View details
    </button>
  </div>

  <div className="rounded-2xl bg-gray-50 p-4">
    <p className="text-sm font-semibold text-gray-900">Rules and Announcements</p>
    <p className="mt-2 text-sm leading-6 text-gray-600">
      Latest rules, notices, and trust updates.
    </p>
    <button className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
      View details
    </button>
  </div>
            </div>
          </div>
        </div>


        {errorText ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-medium text-red-700">Error</p>
            <p className="mt-2 text-sm text-red-600">{errorText}</p>
          </div>
        ) : (
          <>
            <section className="grid gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    Current Listing
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-gray-900">
                    Current Transactions
                  </h2>
                </div>
                <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                  {currentListings.length} active
                </div>
              </div>

              {currentListings.length === 0 ? (
                <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur">
                  <p className="text-gray-600">No current listings.</p>
                </div>
              ) : (
                currentListings.map((b) => renderBookingCard(b, false))
              )}
            </section>

            <section className="grid gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    Listed / Past Transactions
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-gray-900">
                    Transaction History
                  </h2>
                </div>
                <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                  {pastListings.length} records
                </div>
              </div>

              {pastListings.length === 0 ? (
                <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur">
                  <p className="text-gray-600">No past transactions yet.</p>
                </div>
              ) : (
                pastListings.map((b) => renderBookingCard(b, true))
              )}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}