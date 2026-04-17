import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-orange-400">
      {[1,2,3,4,5].map(s => <span key={s}>{s <= Math.round(rating) ? "★" : "☆"}</span>)}
    </span>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: profile }, { data: xpRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, email, successful_transactions")
      .eq("id", id)
      .single(),
    supabase
      .from("experience_points")
      .select("points")
      .eq("user_id", id),
  ]);

  const displayName = profile?.full_name || "Member";
  const initial = displayName[0].toUpperCase();
  const trustScore = (xpRows || []).reduce((s, r) => s + (r.points || 0), 0);
  const trustLevel =
    trustScore >= 20 ? "Champion" :
    trustScore >= 10 ? "Trusted"  :
    trustScore >= 5  ? "Regular"  :
    "Newcomer";
  const trustColor =
    trustScore >= 20 ? "bg-amber-500"  :
    trustScore >= 10 ? "bg-indigo-600" :
    trustScore >= 5  ? "bg-blue-500"   :
    "bg-gray-400";

  // Fetch owner's tools if they're an owner
  let tools: { id: number; name: string; image_url: string | null; price_per_day: number | null; condition: string | null }[] = [];
  let receivedReviews: { rating: number; content: string | null; created_at: string; booking_id: number | null }[] = [];
  let reviewerNames: Record<number, string> = {};

  if (profile?.email) {
    const { data: toolRows } = await supabase
      .from("tools")
      .select("id, name, image_url, price_per_day, condition")
      .eq("owner_email", profile.email)
      .eq("status", "active")
      .order("id", { ascending: false });

    tools = toolRows || [];

    if (tools.length > 0) {
      const toolIds = tools.map(t => t.id);
      const { data: revRows } = await supabase
        .from("reviews")
        .select("rating, content, created_at, booking_id, target_id")
        .eq("target_type", "tool")
        .in("target_id", toolIds)
        .order("created_at", { ascending: false });

      receivedReviews = revRows || [];

      // Resolve reviewer names from bookings
      const bIds = [...new Set(receivedReviews.map(r => r.booking_id).filter(Boolean))] as number[];
      if (bIds.length > 0) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, user_name")
          .in("id", bIds);
        if (bookings) {
          (bookings as { id: number; user_name: string | null }[]).forEach(b => {
            if (b.user_name && b.id) reviewerNames[b.id] = b.user_name;
          });
        }
      }
    }
  }

  const avgReceived = receivedReviews.length
    ? (receivedReviews.reduce((s, r) => s + r.rating, 0) / receivedReviews.length).toFixed(1)
    : null;

  const toolNamesMap: Record<number, string> = {};
  tools.forEach(t => { toolNamesMap[t.id] = t.name; });

  return (
    <main className="min-h-screen bg-[#f7f8f5] p-6">
      <div className="mx-auto max-w-3xl space-y-6">

        <Link href="/search" className="text-sm font-medium text-[#2f641f]">
          ← Back to search
        </Link>

        {/* Profile header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8bbb46] text-2xl font-bold text-white shadow">
              {initial}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <p className="text-sm text-gray-500 capitalize">{profile?.role || "Member"}</p>
              {profile?.successful_transactions != null && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {profile.successful_transactions} successful rental{profile.successful_transactions !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center gap-1.5 rounded-2xl ${trustColor} px-3 py-2 text-white shadow`}>
                <span className="text-lg font-bold">{trustScore}</span>
                <div className="text-left">
                  <p className="text-[10px] font-semibold leading-none opacity-80">XP</p>
                  <p className="text-xs font-bold leading-none">{trustLevel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-[#f6f8f1] px-4 py-3 text-center">
              <p className="text-lg font-bold text-gray-900">{tools.length}</p>
              <p className="text-xs text-gray-500">Tools listed</p>
            </div>
            <div className="rounded-2xl bg-[#f6f8f1] px-4 py-3 text-center">
              <p className="text-lg font-bold text-gray-900">{receivedReviews.length}</p>
              <p className="text-xs text-gray-500">Reviews received</p>
            </div>
            <div className="rounded-2xl bg-[#f6f8f1] px-4 py-3 text-center">
              {avgReceived ? (
                <div className="flex items-center justify-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{avgReceived}</span>
                  <span className="text-orange-400">★</span>
                </div>
              ) : (
                <p className="text-lg font-bold text-gray-400">—</p>
              )}
              <p className="text-xs text-gray-500">Avg rating</p>
            </div>
          </div>
        </div>

        {/* Listed tools */}
        {tools.length > 0 && (
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tools for Rent</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tools.map(tool => (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.id}`}
                  className="flex gap-3 rounded-2xl border border-gray-100 bg-[#f6f8f1] p-3 hover:border-[#8bbb46] transition-colors"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-200">
                    {tool.image_url ? (
                      <Image src={tool.image_url} alt={tool.name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400 text-xl">🔧</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{tool.name}</p>
                    {tool.price_per_day && (
                      <p className="text-sm text-[#2f641f] font-medium">${tool.price_per_day}/day</p>
                    )}
                    {tool.condition && (
                      <p className="text-xs text-gray-400 capitalize">{tool.condition} condition</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews received */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Reviews Received</h2>
          {receivedReviews.length === 0 ? (
            <p className="text-sm text-black/40">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {receivedReviews.map((r, i) => {
                const reviewerName = r.booking_id ? (reviewerNames[r.booking_id] || "Renter") : "Renter";
                return (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-[#f6f8f1] p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-semibold text-gray-700">{reviewerName}</span>
                      <Stars rating={r.rating} />
                    </div>
                    {r.content && (
                      <p className="mt-2 text-sm text-gray-700 leading-relaxed">{r.content}</p>
                    )}
                    {r.created_at && (
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleDateString("en-NZ", { dateStyle: "long" })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
