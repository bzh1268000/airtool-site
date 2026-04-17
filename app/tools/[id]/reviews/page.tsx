import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ToolReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: tool }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("tools")
      .select("id, name, description, usage_notes, condition")
      .eq("id", Number(id))
      .single(),
    supabase
      .from("reviews")
      .select("rating, content, reviewer_role, created_at, reviewer_id, booking_id")
      .eq("target_id", Number(id))
      .eq("target_type", "tool")
      .order("created_at", { ascending: false }),
  ]);

  // Resolve reviewer names from bookings (user_name is set at booking time)
  const bookingIds = [...new Set((reviewRows || []).map((r) => r.booking_id).filter(Boolean))];
  let bookingNamesMap: Record<number, string> = {};
  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, user_name")
      .in("id", bookingIds);
    if (bookings) {
      (bookings as { id: number; user_name: string | null }[]).forEach((b) => {
        if (b.user_name) bookingNamesMap[b.id] = b.user_name;
      });
    }
  }

  const reviews = reviewRows || [];
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
    : 0;

  return (
    <main className="min-h-screen bg-[#f7f8f5] p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href={`/tools/${id}`} className="text-sm font-medium text-[#2f641f]">
            ← Back to tool
          </Link>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          {/* Tool header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#8bbb46] mb-1">Tool</p>
              <h1 className="text-2xl font-bold text-gray-900">{tool?.name || `Tool #${id}`}</h1>
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2 rounded-2xl bg-[#f6f8f1] px-4 py-3">
                <span className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</span>
                <div>
                  <div className="flex items-center gap-0.5 text-orange-400">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className="text-lg">{s <= Math.round(avgRating) ? "★" : "☆"}</span>
                    ))}
                  </div>
                  <p className="text-xs text-black/50">{reviews.length} renter{reviews.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
            )}
          </div>

          {/* Renter ratings — name + stars only, no text */}
          {reviews.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Renter Ratings</p>
              {reviews.map((r, i) => {
                const name = bookingNamesMap[r.booking_id] || "Renter";
                const initial = name[0].toUpperCase();
                return (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-[#f6f8f1] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8bbb46] text-xs font-bold text-white">
                          {initial}
                        </div>
                        <div>
                          <Link
                            href={`/profile/${r.reviewer_id}`}
                            className="text-sm font-semibold text-gray-900 hover:text-[#2f641f] hover:underline"
                          >
                            {name}
                          </Link>
                          {r.created_at && (
                            <p className="text-xs text-gray-400">
                              {new Date(r.created_at).toLocaleDateString("en-NZ", { dateStyle: "medium" })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 text-orange-400">
                        {[1,2,3,4,5].map(s => <span key={s}>{s <= r.rating ? "★" : "☆"}</span>)}
                      </div>
                    </div>
                    {r.content && (
                      <p className="mt-2 text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-2">
                        {r.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Default: owner's self-assessment when no renter reviews yet */}
          {reviews.length === 0 && tool && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Owner's Assessment
              </p>
              <div className="rounded-2xl border border-[#8bbb46]/20 bg-[#f8fdf3] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-full bg-[#8bbb46]/10 px-3 py-1 text-xs font-semibold text-[#2f641f]">
                    Owner listed
                  </span>
                  {tool.condition && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      Condition: {tool.condition}
                    </span>
                  )}
                </div>
                {tool.description && (
                  <p className="text-sm text-gray-700 leading-relaxed">{tool.description}</p>
                )}
                {tool.usage_notes && (
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                    <span className="font-medium text-gray-700">Usage notes: </span>
                    {tool.usage_notes}
                  </p>
                )}
                {!tool.description && !tool.usage_notes && (
                  <p className="text-sm text-black/50">No description added yet.</p>
                )}
              </div>
              <p className="mt-4 text-sm text-black/40 text-center">
                No renter reviews yet — be the first to rent and review this tool.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
