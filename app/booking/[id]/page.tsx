"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { validateFullName, validatePhone, validateAddress } from "@/lib/validation";

type Tool = {
  id: number;
  name: string | null;
  description: string | null;
  price_per_day: number | null;
  image_url: string | null;
  deposit: number | null;
  owner_email: string | null;
  listing_type: string | null;
  hubs: { id: string; name: string } | null;
};

type BookedPeriod = {
  id: number;
  start_date: string | null;
  end_date: string | null;
  preferred_dates: string | null;
  status: string | null;
};

// Statuses that lock the tool (pending → approved → in use; excludes cancelled/declined)
const BLOCKING_STATUSES = [
  "pending", "approved", "confirmed",
  "waiting_renter", "waiting_owner", "waiting_both",
  "in_use", "return_check",
];

// ── helpers ───────────────────────────────────────────────────────────────────

/** Fractional hours between two date+time strings. Returns 0 if invalid. */
function hoursBetween(
  startDate: string, startTime: string,
  endDate: string,   endTime: string,
): number {
  if (!startDate || !startTime || !endDate || !endTime) return 0;
  const start = new Date(`${startDate}T${startTime}`).getTime();
  const end   = new Date(`${endDate}T${endTime}`).getTime();
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.max(0, (end - start) / 3_600_000);
}

/** "2 hrs", "1 hr 30 min", etc. */
function fmtDuration(hrs: number): string {
  if (hrs <= 0) return "—";
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (m === 0) return `${h} hr${h !== 1 ? "s" : ""}`;
  return `${h} hr${h !== 1 ? "s" : ""} ${m} min`;
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Parse a BookedPeriod into {start, end} Date objects.
 * Tries the preferred_dates string first ("YYYY-MM-DD HH:MM → …"),
 * falls back to date-only (blocks the whole day).
 */
function parsePeriod(b: BookedPeriod): { start: Date; end: Date } | null {
  if (b.preferred_dates) {
    const m = b.preferred_dates.match(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) → (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/,
    );
    if (m) {
      return {
        start: new Date(`${m[1]}T${m[2]}`),
        end:   new Date(`${m[3]}T${m[4]}`),
      };
    }
  }
  if (b.start_date && b.end_date) {
    return {
      start: new Date(`${b.start_date}T00:00`),
      end:   new Date(`${b.end_date}T23:59`),
    };
  }
  return null;
}

/** Returns the first conflicting BookedPeriod, or null if the window is free. */
function findConflict(
  startDate: string, startTime: string,
  endDate: string,   endTime: string,
  periods: BookedPeriod[],
): BookedPeriod | null {
  if (!startDate || !startTime || !endDate || !endTime) return null;
  const newStart = new Date(`${startDate}T${startTime}`).getTime();
  const newEnd   = new Date(`${endDate}T${endTime}`).getTime();
  if (isNaN(newStart) || isNaN(newEnd) || newEnd <= newStart) return null;

  for (const b of periods) {
    const p = parsePeriod(b);
    if (!p) continue;
    // Overlap when intervals intersect: A.start < B.end && A.end > B.start
    if (newStart < p.end.getTime() && newEnd > p.start.getTime()) return b;
  }
  return null;
}

/** Human-readable period label, e.g. "15 Jan 08:00 → 17:00" */
function fmtPeriod(b: BookedPeriod): string {
  const p = parsePeriod(b);
  if (!p) return b.preferred_dates || `${b.start_date} → ${b.end_date}`;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const sameDay = p.start.toDateString() === p.end.toDateString();
  const startStr = p.start.toLocaleDateString("en-NZ", opts) + " " +
    p.start.toTimeString().slice(0, 5);
  const endStr   = sameDay
    ? p.end.toTimeString().slice(0, 5)
    : p.end.toLocaleDateString("en-NZ", opts) + " " + p.end.toTimeString().slice(0, 5);
  return `${startStr} → ${endStr}`;
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // remote data
  const [tool, setTool]                 = useState<Tool | null>(null);
  const [bookedPeriods, setBookedPeriods] = useState<BookedPeriod[]>([]);
  const [pageLoading, setPageLoading]   = useState(true);

  // auth
  const [userEmail, setUserEmail] = useState("");

  // date + time fields
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endDate,   setEndDate]   = useState("");
  const [endTime,   setEndTime]   = useState("17:00");

  // contact fields
  const [fullName, setFullName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [address, setAddress]     = useState("");
  const [suburb, setSuburb]       = useState("");
  const [city, setCity]           = useState("");
  const [noteToOwner, setNoteToOwner] = useState("");

  // ui state
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── derived pricing (hourly: daily rate ÷ 8) ─────────────────────────────────
  const today       = new Date().toISOString().split("T")[0];
  const pricePerDay = Number(tool?.price_per_day ?? 0);
  const hourlyRate  = pricePerDay / 8;                                   // $/hr
  const totalHours  = hoursBetween(startDate, startTime, endDate, endTime);
  const rentalTotal = Math.round(totalHours * hourlyRate * 100) / 100;  // what renter pays
  const platformFee = Math.round(rentalTotal * 0.15 * 100) / 100;       // platform's 15% (from total)
  const ownerPayout = Math.round(rentalTotal * 0.85 * 100) / 100;       // owner's 85%

  // ── init ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        router.replace(`/login?redirect=/booking/${id}`);
        return;
      }
      setUserEmail(user.email);

      const [{ data: toolData }, { data: profile }, { data: existingBookings }] = await Promise.all([
        supabase
          .from("tools")
          .select("id, name, description, price_per_day, image_url, deposit, owner_email, listing_type, hubs(id, name)")
          .eq("id", Number(id))
          .single(),
        supabase
          .from("profiles")
          .select("full_name, phone, address, suburb, city")
          .eq("id", user.id)
          .single(),
        supabase
          .from("bookings")
          .select("id, start_date, end_date, preferred_dates, status")
          .eq("tool_id", Number(id))
          .in("status", BLOCKING_STATUSES),
      ]);

     if (toolData) setTool(toolData as unknown as Tool);
      if (existingBookings) setBookedPeriods(existingBookings as BookedPeriod[]);
      if (profile) {
        setFullName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setAddress(profile.address ?? "");
        setSuburb(profile.suburb ?? "");
        setCity(profile.city ?? "");
      }

      setPageLoading(false);
    };
    init();
  }, [id, router]);

  // ── validation ────────────────────────────────────────────────────────────────
  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};

    if (!startDate) e.startDate = "Start date is required.";
    if (!endDate)   e.endDate   = "End date is required.";

    if (startDate && endDate) {
      const start = new Date(`${startDate}T${startTime}`);
      const end   = new Date(`${endDate}T${endTime}`);
      if (end <= start) {
        e.endTime = "End must be after start.";
      } else if (totalHours < 4) {
        e.endTime = "Minimum rental is 4 hours (half day).";
      } else {
        const conflict = findConflict(startDate, startTime, endDate, endTime, bookedPeriods);
        if (conflict) {
          e.endTime = `This time overlaps with an existing booking (${fmtPeriod(conflict)}). Please choose a different window.`;
        }
      }
    }

    const nameErr = validateFullName(fullName);
    if (nameErr) e.fullName = nameErr;

    const phoneErr = validatePhone(phone);
    if (phoneErr) e.phone = phoneErr;

    const addrErr = validateAddress(address);
    if (addrErr) e.address = addrErr;

    return e;
  };

  // ── submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      // ── Server-side double-booking guard ─────────────────────────────────────
      // Re-fetch current bookings right before inserting so two simultaneous
      // submissions for the same slot are both caught.
      const { data: latestBookings } = await supabase
        .from("bookings")
        .select("id, start_date, end_date, preferred_dates, status")
        .eq("tool_id", tool!.id)
        .in("status", BLOCKING_STATUSES);

      if (latestBookings) {
        const liveConflict = findConflict(
          startDate, startTime, endDate, endTime,
          latestBookings as BookedPeriod[],
        );
        if (liveConflict) {
          setSubmitError(
            `Sorry — this time slot was just booked (${fmtPeriod(liveConflict)}). Please choose a different window.`,
          );
          setBookedPeriods(latestBookings as BookedPeriod[]);
          setSubmitting(false);
          return;
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const fullAddress = [address, suburb, city].filter(Boolean).join(", ");
      const preferredDates =
        `${startDate} ${startTime} → ${endDate} ${endTime} (${fmtDuration(totalHours)})`;

      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          tool_id:         tool!.id,
          user_name:       fullName.trim(),
          user_email:      userEmail,
          owner_email:     tool!.owner_email,
          start_date:      startDate,
          end_date:        endDate,
          preferred_dates: preferredDates,
          phone:           phone.trim(),
          address:         fullAddress,
          message:         noteToOwner.trim() || null,
          status:          "pending",
          price_total:     rentalTotal,   // total renter pays (platform fee already inside)
          platform_fee:    platformFee,   // 15% of total, deducted from owner payout
        })
        .select("id")
        .single();

      if (error || !booking) {
        setSubmitError(error?.message ?? "Failed to submit booking. Please try again.");
        setSubmitting(false);
        return;
      }

      // Fire-and-forget admin alert email
      fetch("/api/send-booking-alert", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName:  tool!.name,
          userName:  fullName.trim(),
          userEmail,
          userPhone: phone.trim(),
          startDate: `${startDate} ${startTime}`,
          endDate:   `${endDate} ${endTime}`,
        }),
      }).catch(() => {});

      router.replace(`/my-booking/${booking.id}`);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  // ── loading / not-found ───────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5]">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!tool) {
    return (
      <main className="min-h-screen bg-[#f7f8f5] p-6">
        <div className="mx-auto max-w-xl rounded-[28px] bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-800">Tool not found.</p>
          <a href="/search" className="mt-4 inline-block text-sm text-[#2f641f] underline">
            ← Back to search
          </a>
        </div>
      </main>
    );
  }

  // shared input class builder
  const inputCls = (field: string) =>
    `w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#8bbb46] ${
      errors[field] ? "border-red-400 bg-red-50" : "border-black/15"
    }`;

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">

        {/* Back */}
        <div className="mb-6">
          <a href={`/tools/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2f641f] hover:underline">
            ← Back to tool
          </a>
        </div>

        {/* Heading */}
        <div className="mb-7">
          <div className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f641f] shadow-sm">
            Booking Request
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1f2a37] sm:text-4xl">
            {tool.name}
          </h1>
          {tool.hubs?.name && (
            <p className="mt-1 text-sm text-gray-500">📍 {tool.hubs.name}</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

          {/* ── LEFT: form ───────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Rental date + time */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8bbb46]">
                Rental Date &amp; Time
              </h2>
              <p className="mt-0.5 text-xs text-black/40">
                Minimum 4 hours · charged by the hour (daily price ÷ 8 hrs)
              </p>

              {/* Already-booked periods */}
              {bookedPeriods.length > 0 && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-[0.14em]">
                    🔒 Already booked — unavailable:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {bookedPeriods.map((b) => (
                      <li key={b.id} className="flex items-center gap-2 text-xs text-red-600">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                        {fmtPeriod(b)}
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-500 capitalize">
                          {b.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Start row */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">Start Date</label>
                  <input
                    type="date"
                    min={today}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) setEndDate("");
                    }}
                    className={inputCls("startDate")}
                  />
                  {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">Start Time</label>
                  <input
                    type="time"
                    step={1800}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                  />
                </div>
              </div>

              {/* End row */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">End Date</label>
                  <input
                    type="date"
                    min={startDate || today}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputCls("endDate")}
                  />
                  {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">End Time</label>
                  <input
                    type="time"
                    step={1800}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#8bbb46] ${
                      errors.endTime ? "border-red-400 bg-red-50" : "border-black/15"
                    }`}
                  />
                  {errors.endTime && <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>}
                </div>
              </div>

              {/* Live feedback */}
              {(() => {
                if (!startDate || !endDate) return null;
                const conflict = findConflict(startDate, startTime, endDate, endTime, bookedPeriods);
                if (conflict) {
                  return (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                      <span className="mt-0.5 text-red-500">⛔</span>
                      <p className="text-xs text-red-600">
                        <span className="font-semibold">Time conflict:</span> overlaps with an existing booking
                        ({fmtPeriod(conflict)}). Please choose a different window.
                      </p>
                    </div>
                  );
                }
                if (totalHours > 0 && totalHours < 4) {
                  return (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <span className="text-amber-500">⚠️</span>
                      <p className="text-xs text-amber-700">
                        <span className="font-semibold">Too short:</span> minimum rental is 4 hours.
                        Currently {fmtDuration(totalHours)}.
                      </p>
                    </div>
                  );
                }
                if (totalHours >= 4) {
                  return (
                    <p className="mt-3 text-sm font-medium text-[#2f641f]">
                      ✓ {fmtDuration(totalHours)} selected — looks good!
                    </p>
                  );
                }
                return null;
              })()}
            </section>

            {/* Your details */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8bbb46]">
                Your Details
              </h2>
              <p className="mt-0.5 text-xs text-black/40">
                Pre-filled from your profile — update if needed.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-black/60">Full Name</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className={inputCls("fullName")} />
                  {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="021 234 5678" className={inputCls("phone")} />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">Email</label>
                  <input value={userEmail} disabled className="w-full rounded-xl border border-black/10 bg-gray-50 px-4 py-3 text-sm text-gray-400" />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-black/60">Street Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Example Street" className={inputCls("address")} />
                  {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">Suburb</label>
                  <input value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Suburb" className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-black/60">City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]" />
                </div>
              </div>
            </section>

            {/* Note to owner */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8bbb46]">
                Note to Owner
              </h2>
              <p className="mt-0.5 text-xs text-black/40">
                Optional — share your project details or ask a question.
              </p>
              <textarea
                value={noteToOwner}
                onChange={(e) => setNoteToOwner(e.target.value)}
                rows={4}
                placeholder="E.g. I'm renovating my deck and need the drill for about 3 days…"
                className="mt-4 w-full resize-none rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
              />
            </section>

            {/* Submit error */}
            {submitError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-full bg-[#8bbb46] py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#7aaa39] disabled:opacity-60"
            >
              {submitting ? "Submitting request…" : "Submit Booking Request →"}
            </button>

            <p className="pb-4 text-center text-xs text-black/30">
              No payment is taken yet. The owner reviews and approves your request first.
            </p>
          </div>

          {/* ── RIGHT: sidebar ───────────────────────────────────────────────── */}
          <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">

            {/* Tool card + quick links */}
            <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
              {tool.image_url ? (
                <img src={tool.image_url} alt={tool.name ?? "Tool"} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                  No photo
                </div>
              )}
              <div className="p-5">
                <h3 className="text-base font-bold text-[#1f2a37]">{tool.name}</h3>
                {tool.hubs?.name && (
                  <p className="mt-0.5 text-sm text-gray-500">📍 {tool.hubs.name}</p>
                )}
                {tool.description && (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                    {tool.description}
                  </p>
                )}

                {/* Quick links */}
                <div className="mt-4 grid gap-2">
                  <a
                    href={`/tools/${id}`}
                    className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-[#1f2a37] hover:bg-gray-50 transition"
                  >
                    <span>🔧 View full tool details</span>
                    <span className="text-black/30">→</span>
                  </a>
                  <a
                    href={`/messages${tool.owner_email ? `?other_email=${encodeURIComponent(tool.owner_email)}` : ""}`}
                    className="flex items-center justify-between rounded-xl border border-[#8bbb46]/40 bg-[#f0f8e8] px-4 py-2.5 text-sm font-medium text-[#2f641f] hover:bg-[#e4f5d4] transition"
                  >
                    <span>💬 Message the owner</span>
                    <span className="text-[#2f641f]/40">→</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8bbb46]">
                Price Breakdown
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Hourly rate</span>
                  <span>{fmt(hourlyRate)}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration</span>
                  <span>{totalHours > 0 ? fmtDuration(totalHours) : "—"}</span>
                </div>

                <div className="flex justify-between border-t border-black/10 pt-3 font-bold">
                  <span>You pay</span>
                  <span className="text-[#2f641f]">{totalHours > 0 ? fmt(rentalTotal) : "—"}</span>
                </div>

                {totalHours > 0 && (
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Platform fee (15%, included)</span>
                      <span>{fmt(platformFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Owner receives (85%)</span>
                      <span>{fmt(ownerPayout)}</span>
                    </div>
                  </div>
                )}

                {tool.deposit != null && tool.deposit > 0 && (
                  <>
                    <div className="flex justify-between border-t border-dashed border-black/10 pt-3 text-gray-500">
                      <span>Bond (refundable)</span>
                      <span>{fmt(Number(tool.deposit))}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Bond is collected separately and refunded after return in good condition.
                    </p>
                  </>
                )}
              </div>

              {pricePerDay > 0 && (
                <p className="mt-4 rounded-xl bg-[#f0f8e8] px-3 py-2 text-xs text-[#2f641f]">
                  Based on {fmt(pricePerDay)}/day ÷ 8 hrs = {fmt(hourlyRate)}/hr
                </p>
              )}
            </div>

            {/* How it works */}
            <div className="rounded-[28px] border border-[#8bbb46]/25 bg-[#f0f8e8] p-5">
              <h3 className="text-sm font-semibold text-[#2f641f]">How it works</h3>
              <ol className="mt-3 space-y-2 text-sm text-[#2f641f]/75">
                {[
                  "Submit your request",
                  "Owner reviews and approves",
                  "Both parties confirm",
                  "Pay and collect the tool",
                  "Return and get your bond back",
                ].map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-bold">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
