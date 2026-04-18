"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import DashboardShell from "../components/dashboard-shell";

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
  hub_id?: string | null;
  hubs?: {
    id: string;
    name: string;
  } | null;
};

const statusColorMap: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800",
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-700",
};

type HubTab = "pending" | "approved" | "pickup" | "completed";

function safeMoney(value: number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

export default function HubPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [preferDelivery, setPreferDelivery] = useState("pickup");

  const [hubId, setHubId] = useState<string | null>(null);
  const [hubName, setHubName] = useState("My Hub");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolsMap, setToolsMap] = useState<Record<number, string>>({});
  const [toolHubMap, setToolHubMap] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<HubTab>("pending");

  useEffect(() => {
    let isMounted = true;
    let authedUser: any = null;

    const fetchHubData = async (showLoading = false) => {
      if (!authedUser) return;
      const user = authedUser;
      if (showLoading) setLoading(true);
      setErrorText("");

      setUserEmail(user.email || "");
      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, hub_id")
        .eq("id", user.id)
        .single();

      if (profileError) {
        if (isMounted) {
          setErrorText(profileError.message);
          setLoading(false);
        }
        return;
      }

      if (!isMounted) return;

      setRole(profile?.role ?? null);
      setHubId(profile?.hub_id || null);

      const { data: toolsData, error: toolsError } = await supabase
        .from("tools")
        .select(`
          id,
          name,
          owner_email,
          listing_type,
          hub_id,
          hubs (
            id,
            name
          )
        `)
        .eq("listing_type", "hub");

      if (toolsError) {
        if (isMounted) {
          setErrorText(toolsError.message);
          setLoading(false);
        }
        return;
      }

      const typedTools = (toolsData as Tool[]) || [];

      const nameMap: Record<number, string> = {};
      const hubMap: Record<number, string> = {};

      typedTools.forEach((tool) => {
        nameMap[tool.id] = tool.name || `Tool #${tool.id}`;
        hubMap[tool.id] = tool.hub_id || "";
      });

      if (isMounted) {
        setTools(typedTools);
        setToolsMap(nameMap);
        setToolHubMap(hubMap);

        if (profile?.hub_id) {
          const matchedHubTool = typedTools.find((t) => t.hub_id === profile.hub_id);
          if (matchedHubTool?.hubs?.name) {
            setHubName(matchedHubTool.hubs.name);
          }
        }
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

    let cancelled = false;

    supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !isMounted) return;
      if (session?.user) {
        authedUser = session.user;
        fetchHubData(true);
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    const interval = setInterval(() => { fetchHubData(false); }, 5000);
    return () => {
      cancelled = true;
      isMounted = false;
      clearInterval(interval);
    };
  }, [router]);

  useEffect(() => {
    if (!loading && role && role !== "hub") {
      if (role === "admin") router.replace("/admin");
      else if (role === "owner") router.replace("/owner");
      else router.replace("/search");
    }
  }, [loading, role, router]);

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
      .update({ full_name: fullName, phone, address, suburb, city, id_type: idType, id_number: idNumber, prefer_delivery: preferDelivery })
      .eq("id", userId);
    if (error) {
      setProfileMsg("❌ Failed to save: " + error.message);
    } else {
      setProfileMsg("✅ Profile updated successfully!");
    }
    setProfileSaving(false);
  };

  const hubBookings = useMemo(() => {
    if (!hubId) return [];

    return bookings.filter((b) => {
      if (!b.tool_id) return false;
      return toolHubMap[b.tool_id] === hubId;
    });
  }, [bookings, hubId, toolHubMap]);

  const pendingBookings = useMemo(
    () =>
      hubBookings.filter((b) => {
        const status = b.status || "new";
        return status === "new" || status === "pending";
      }),
    [hubBookings]
  );

  const approvedBookings = useMemo(
    () => hubBookings.filter((b) => (b.status || "") === "approved"),
    [hubBookings]
  );

  const pickupBookings = useMemo(
    () =>
      hubBookings.filter((b) => {
        const status = (b.status || "").toLowerCase();
        return status === "approved" || status === "confirmed";
      }),
    [hubBookings]
  );

  const completedBookings = useMemo(
    () => hubBookings.filter((b) => (b.status || "") === "completed"),
    [hubBookings]
  );

  const currentTabBookings = useMemo(() => {
    if (tab === "pending") return pendingBookings;
    if (tab === "approved") return approvedBookings;
    if (tab === "pickup") return pickupBookings;
    return completedBookings;
  }, [tab, pendingBookings, approvedBookings, pickupBookings, completedBookings]);

  const hubTurnover = useMemo(
    () => hubBookings.reduce((sum, b) => sum + Number(b.price_total || 0), 0),
    [hubBookings]
  );

  const hubPlatformFee = useMemo(
    () => hubBookings.reduce((sum, b) => sum + Number(b.platform_fee || 0), 0),
    [hubBookings]
  );

  const hubToolCount = useMemo(() => {
    if (!hubId) return 0;
    return tools.filter((t) => t.hub_id === hubId).length;
  }, [tools, hubId]);

  const flaggedCount = useMemo(
    () =>
      hubBookings.filter((b) => {
        const hasNoPhone = !b.phone || !b.phone.trim();
        const hasNoAddress = !b.address || !b.address.trim();
        return hasNoPhone || hasNoAddress;
      }).length,
    [hubBookings]
  );

  const tabConfig: { key: HubTab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: pendingBookings.length },
    { key: "approved", label: "Approved", count: approvedBookings.length },
    { key: "pickup", label: "Pickup", count: pickupBookings.length },
    { key: "completed", label: "Completed", count: completedBookings.length },
  ];

  const scrollToQueue = () => {
    document.getElementById("booking-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const todayHubBookings = useMemo(
    () => hubBookings.filter((b) => b.created_at && new Date(b.created_at) >= todayStart),
    [hubBookings, todayStart]
  );

  const todayPending = useMemo(
    () => todayHubBookings.filter((b) => b.status === "new" || b.status === "pending" || !b.status).length,
    [todayHubBookings]
  );

  const todayTurnover = useMemo(
    () => todayHubBookings.reduce((sum, b) => sum + Number(b.price_total || 0), 0),
    [todayHubBookings]
  );

  const todayPlatformFee = useMemo(
    () => todayHubBookings.reduce((sum, b) => sum + Number(b.platform_fee || 0), 0),
    [todayHubBookings]
  );

  const todayFlags = useMemo(
    () => todayHubBookings.filter((b) => !b.phone?.trim() || !b.address?.trim()).length,
    [todayHubBookings]
  );

  const updateBookingStatus = async (bookingId: number, nextStatus: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: nextStatus })
      .eq("id", bookingId);

    if (error) {
      alert(error.message);
      return;
    }

    if (['completed', 'approved', 'confirmed', 'in_use', 'disputed'].includes(nextStatus)) {
      fetch('/api/xp/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, new_status: nextStatus }),
      })
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: nextStatus } : b))
    );
  };

  const renderBookingCard = (b: Booking) => {
    const status = b.status || "new";
    const hasRisk = !b.phone?.trim() || !b.address?.trim();

    return (
      <div
        key={b.id}
        className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">
                {b.tool_id ? (
                  <a href={`/tools/${b.tool_id}`} className="hover:text-[#2f641f] hover:underline">
                    {toolsMap[b.tool_id] || "Unknown Tool"}
                  </a>
                ) : (
                  toolsMap[b.tool_id || 0] || "Unknown Tool"
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

              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                Hub booking
              </span>

              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  statusColorMap[status] || "bg-gray-100 text-gray-800"
                }`}
              >
                {status}
              </span>

              {hasRisk ? (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  Missing info
                </span>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
              <p>
                <span className="font-semibold text-slate-900">Renter:</span>{" "}
                {b.renter_name || "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Email:</span>{" "}
                {b.renter_email || "-"}
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
              <p>
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

            <div className="flex flex-wrap gap-3 pt-2">
              {(status === "new" || status === "pending") && (
                <>
                  <button
                    onClick={() => updateBookingStatus(b.id, "approved")}
                    className="rounded-2xl bg-[#8bbb46] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7aaa39]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateBookingStatus(b.id, "declined")}
                    className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Decline
                  </button>
                </>
              )}

              {status === "approved" && (
                <button
                  onClick={() => updateBookingStatus(b.id, "completed")}
                  className="rounded-2xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
                >
                  Mark Returned
                </button>
              )}
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

  if (loading || role === null) {
    return (
      <DashboardShell title="Checking access..." subtitle="Please wait">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <p className="text-slate-600">Loading hub page...</p>
        </div>
      </DashboardShell>
    );
  }

  if (role !== "hub") {
    return null;
  }

  return (
    <DashboardShell
      title={`${hubName} Hub Dashboard`}
      subtitle={`Hub staff: ${userEmail || "-"}`}
    >
      <div className="grid gap-6 pb-24">
        <section className="overflow-hidden rounded-[30px] border border-sky-100 bg-gradient-to-br from-white via-sky-50/90 to-blue-50/80 p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                <Bot className="h-4 w-4" />
                Local Hub Control
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
                Manage pickup, return, approval, and local trust flow.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                This page is for hub staff to handle hub tools, booking requests,
                pickup readiness, return confirmation, and local customer issues.
              </p>
              <button
                onClick={() => showProfile ? setShowProfile(false) : handleOpenProfile()}
                className="mt-4 rounded-2xl border border-[#8bbb46] bg-[#f0f8e8] px-4 py-2.5 text-sm font-semibold text-[#2f641f] hover:bg-[#e4f5d4]"
              >
                👤 My Profile
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Pending
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {pendingBookings.length}
                </p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Pickup Today
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {pickupBookings.length}
                </p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Completed
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {completedBookings.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {showProfile && (
          <div className="rounded-3xl border border-[#8bbb46]/30 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Personal Info</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Role: <span className="font-semibold text-[#2f641f] uppercase">{profile.role || "hub"}</span>
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
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <button type="button" onClick={() => setPreferDelivery("pickup")} className={`rounded-xl border py-3 text-sm font-medium transition ${preferDelivery === "pickup" ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]" : "border-black/15 text-black/60"}`}>📦 Hub Pickup</button>
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

        {errorText ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-medium text-red-700">Error</p>
            <p className="mt-2 text-sm text-red-600">{errorText}</p>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <button onClick={scrollToQueue} className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm text-left hover:bg-slate-50 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Hub Tools</p>
              <Wrench className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{hubToolCount}</p>
            <p className="mt-1 text-xs text-slate-400">View queue →</p>
          </button>

          <button onClick={scrollToQueue} className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm text-left hover:bg-slate-50 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Hub Bookings</p>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{hubBookings.length}</p>
            <p className="mt-1 text-xs text-slate-400">View queue →</p>
          </button>

          <button onClick={() => { setTab("pending"); scrollToQueue(); }} className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm text-left hover:bg-slate-50 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pending Review</p>
              <ClipboardCheck className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{pendingBookings.length}</p>
            <p className="mt-1 text-xs text-slate-400">View pending →</p>
          </button>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Turnover</p>
              <CircleDollarSign className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">${safeMoney(hubTurnover)}</p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Platform Fee</p>
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">${safeMoney(hubPlatformFee)}</p>
          </div>

          <button onClick={scrollToQueue} className="rounded-[28px] border border-red-100 bg-white/90 p-5 shadow-sm text-left hover:bg-red-50 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-red-400">Flags</p>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{flaggedCount}</p>
            <p className="mt-1 text-xs text-red-400">View flagged →</p>
          </button>
        </section>

        {/* Today's row */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Today's Tools</p>
              <Wrench className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{hubToolCount}</p>
            <p className="mt-1 text-xs text-slate-400">total in hub</p>
          </div>

          <button onClick={scrollToQueue} className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm text-left hover:bg-slate-50 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Today's Bookings</p>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{todayHubBookings.length}</p>
            <p className="mt-1 text-xs text-slate-400">{todayPending} pending →</p>
          </button>

          <button onClick={() => { setTab("pending"); scrollToQueue(); }} className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm text-left hover:bg-slate-50 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Today's Pending</p>
              <ClipboardCheck className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{todayPending}</p>
            <p className="mt-1 text-xs text-slate-400">needs review →</p>
          </button>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Today's Turnover</p>
              <CircleDollarSign className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">${safeMoney(todayTurnover)}</p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Today's Fees</p>
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">${safeMoney(todayPlatformFee)}</p>
          </div>

          <button onClick={scrollToQueue} className="rounded-[28px] border border-red-100 bg-white/90 p-5 shadow-sm text-left hover:bg-red-50 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-red-400">Today's Flags</p>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{todayFlags}</p>
            <p className="mt-1 text-xs text-red-400">missing info →</p>
          </button>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Hub Operations
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Daily overview
                </h2>
              </div>
              <MapPin className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Hub name</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{hubName}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Pending approvals</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {pendingBookings.length}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Ready for pickup / active</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {pickupBookings.length}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-sky-700" />
                  <p className="text-sm font-semibold text-sky-800">AI summary</p>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Hub tools: {hubToolCount}</p>
                  <p>Hub bookings: {hubBookings.length}</p>
                  <p>Missing info flags: {flaggedCount}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Pickup & Return
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Workflow
                </h2>
              </div>
              <Truck className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-6 grid gap-3">
              {[
                "Approve booking",
                "Prepare pickup",
                "Check renter ID / details",
                "Check return condition",
                "Mark completed",
                "Escalate issue to admin",
              ].map((item) => (
                <button
                  key={item}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span>{item}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  AI Assist
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Light AI tools
                </h2>
              </div>
              <Sparkles className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    Draft renter reply
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Quick message help for pickup, delay, and return reminders.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    Condition checklist
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  AI can help suggest what to inspect before handover and return.
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-sky-700" />
                  <p className="text-sm font-semibold text-sky-800">
                    Hub AI suggestions
                  </p>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Flag missing phone / address</p>
                  <p>Suggest pickup reminder</p>
                  <p>Suggest overdue follow-up</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="booking-queue" className="scroll-mt-6 rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Hub Transactions
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Booking queue
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {tabConfig.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    tab === item.key
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label} ({item.count})
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
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Risk Review
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Hub-side checks
            </h2>

            <div className="mt-6 grid gap-4">
              {[
                {
                  title: "Missing contact details",
                  detail: `${flaggedCount} bookings have incomplete phone or address.`,
                  level: "Medium",
                },
                {
                  title: "Pending pickup decisions",
                  detail: `${pendingBookings.length} bookings still need hub review.`,
                  level: "Normal",
                },
                {
                  title: "Admin escalation",
                  detail: "Disputes, suspicious renters, and damage issues should escalate to admin.",
                  level: "High",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-slate-500" />
                        <p className="font-semibold text-slate-900">{item.title}</p>
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
              Hub page principle
            </h2>

            <div className="mt-6 space-y-4 rounded-3xl bg-slate-50/80 p-5 text-sm leading-7 text-slate-700">
              <p>1. Hub handles hub bookings only.</p>
              <p>2. P2P approval belongs to owner, not hub.</p>
              <p>3. Admin still controls disputes, bans, and platform-wide trust rules.</p>
              <p>4. Hub focuses on pickup, return, and local service quality.</p>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}