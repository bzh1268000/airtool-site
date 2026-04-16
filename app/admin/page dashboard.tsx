"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Booking = {
  id: number;
  tool_id: number | null;
  preferred_dates: string | null;
  message: string | null;
  phone: string | null;
  address: string | null;
  status: string | null;
  created_at: string | null;
  booking_type: string | null;
  price_total: number | null;
  platform_fee: number | null;
};

const toolsMap: Record<number, string> = {
  1: "Cordless Drill",
  2: "Ladder",
  3: "Pressure Washer",
  4: "Generator",
};

const statusColorMap: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
};

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Failed to get user:", userError?.message);
        setLoading(false);
        return;
      }

      setUserEmail(user.email || "");

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load bookings:", error.message);
        setLoading(false);
        return;
      }

      setBookings((data as Booking[]) || []);
      setLoading(false);
    };

    fetchBookings();
  }, []);

  const handleApprove = async (bookingId: number) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "approved" })
      .eq("id", bookingId);

    if (error) {
      alert("Approve failed");
      return;
    }

    fetch('/api/xp/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, new_status: 'approved' }),
    })

    setBookings((prev) =>
      prev.map((item) =>
        item.id === bookingId ? { ...item, status: "approved" } : item
      )
    );
  };

  const handleReject = async (bookingId: number) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "rejected" })
      .eq("id", bookingId);

    if (error) {
      alert("Reject failed");
      return;
    }

    setBookings((prev) =>
      prev.map((item) =>
        item.id === bookingId ? { ...item, status: "rejected" } : item
      )
    );
  };

  const handleComplete = async (bookingId: number) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId);

    if (error) {
      alert("Complete failed");
      return;
    }

    fetch('/api/xp/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, new_status: 'completed' }),
    })

    setBookings((prev) =>
      prev.map((item) =>
        item.id === bookingId ? { ...item, status: "completed" } : item
      )
    );
  };

  const totalBookings = bookings.length;
  const hubBookings = bookings.filter((b) => b.booking_type === "hub").length;
  const p2pBookings = bookings.filter((b) => b.booking_type === "p2p").length;

  const totalTurnover = bookings.reduce(
    (sum, b) => sum + Number(b.price_total || 0),
    0
  );

  const platformShare = bookings.reduce(
    (sum, b) => sum + Number(b.platform_fee || 0),
    0
  );

  const totalTools = new Set(
    bookings.map((b) => b.tool_id).filter((id) => id !== null)
  ).size;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Admin Dashboard
          </h1>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  if (userEmail !== "bzh1268@gmail.com") {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Admin Dashboard
          </h1>
          <p className="mt-4 text-red-600">No access</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-base text-gray-600">Admin: {userEmail}</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalBookings}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Hub Bookings</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {hubBookings}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">P2P Bookings</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {p2pBookings}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Turnover</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              ${totalTurnover.toFixed(2)}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Platform Share</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              ${platformShare.toFixed(2)}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Tools</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalTools}
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          {bookings.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-gray-600">No bookings found.</p>
            </div>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-3xl font-bold text-gray-900">
                        {toolsMap[b.tool_id || 0] || "Unknown Tool"}
                      </h2>

                      {b.booking_type && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-700">
                          {b.booking_type}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <p className="text-sm text-gray-600">Status:</p>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          statusColorMap[b.status || ""] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {b.status || "new"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {b.status === "new" && (
                      <>
                        <button
                          onClick={() => handleApprove(b.id)}
                          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(b.id)}
                          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {b.status === "approved" && (
                      <button
                        onClick={() => handleComplete(b.id)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 text-sm text-gray-700 md:grid-cols-2 xl:grid-cols-3">
                  <p>
                    <span className="font-medium text-gray-900">
                      Preferred dates:
                    </span>{" "}
                    {b.preferred_dates || "-"}
                  </p>

                  <p>
                    <span className="font-medium text-gray-900">Phone:</span>{" "}
                    {b.phone || "-"}
                  </p>

                  <p>
                    <span className="font-medium text-gray-900">Address:</span>{" "}
                    {b.address || "-"}
                  </p>

                  <p>
                    <span className="font-medium text-gray-900">
                      Price total:
                    </span>{" "}
                    ${Number(b.price_total || 0).toFixed(2)}
                  </p>

                  <p>
                    <span className="font-medium text-gray-900">
                      Platform fee:
                    </span>{" "}
                    ${Number(b.platform_fee || 0).toFixed(2)}
                  </p>

                  <p>
                    <span className="font-medium text-gray-900">Message:</span>{" "}
                    {b.message || "-"}
                  </p>
                </div>

                <p className="mt-5 text-xs text-gray-400">
                  {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}