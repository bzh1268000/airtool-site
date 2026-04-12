"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Booking = {
  id: number;
  tool_id: number | null;
  preferred_dates: string | null;
  message: string | null;
  phone: string | null;
  address: string | null;
  status: string | null;
  created_at: string | null;
  user_id?: string | null;
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

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

     if (userError || !user) {
  router.replace("/login");
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

  const approvedBooking = bookings.find((item) => item.id === bookingId);

  setBookings((prev) =>
    prev.map((item) =>
      item.id === bookingId ? { ...item, status: "approved" } : item
    )
  );

  try {
    await fetch("/api/send-approval-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId,
        toolName: approvedBooking
          ? toolsMap[approvedBooking.tool_id || 0] || "Unknown Tool"
          : "Unknown Tool",
        preferredDates: approvedBooking?.preferred_dates || "-",
        message: approvedBooking?.message || "-",
        phone: approvedBooking?.phone || "-",
        address: approvedBooking?.address || "-",
        userEmail,
      }),
    });
  } catch (e) {
    console.error("Email send failed:", e);
  }
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

    setBookings((prev) =>
      prev.map((item) =>
        item.id === bookingId ? { ...item, status: "completed" } : item
      )
    );
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <p className="mt-4 text-gray-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">My Bookings</h1>

      <p className="mt-2 text-lg text-gray-700">
        Logged in as: {userEmail || "-"}
      </p>

      <div className="mt-8 space-y-4">
        {bookings.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-gray-600">No bookings found.</p>
          </div>
        ) : (
          bookings.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-bold">
                {toolsMap[b.tool_id || 0] || "Unknown Tool"}
              </h2>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm">
                  Status:{" "}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      statusColorMap[b.status || ""] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {b.status || "new"}
                  </span>
                </p>

                {b.status === "new" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(b.id)}
                      className="rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => handleReject(b.id)}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:opacity-90"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {b.status === "approved" && (
                  <button
                    onClick={() => handleComplete(b.id)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:opacity-90"
                  >
                    Complete
                  </button>
                )}
              </div>

              <p className="mt-3 text-sm text-gray-600">
                Preferred dates: {b.preferred_dates || "-"}
              </p>

              <p className="text-sm text-gray-600">
                Message: {b.message || "-"}
              </p>

              <p className="mt-2 text-sm text-gray-600">
                Phone: {b.phone || "-"}
              </p>

              <p className="text-sm text-gray-600">
                Address: {b.address || "-"}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                {b.created_at ? new Date(b.created_at).toLocaleString() : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}