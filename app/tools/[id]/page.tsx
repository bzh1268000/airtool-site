import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type ToolRow = {
  id: number;
  name: string | null;
  description?: string | null;
  price_per_day?: number | null;
  image_url?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  video_url?: string | null;
  deposit?: number | null;
  condition?: string | null;
  brand?: string | null;
  model?: string | null;
  included_accessories?: string | null;
  usage_notes?: string | null;
  pickup_notes?: string | null;
  late_return_rule?: string | null;
  damage_rule?: string | null;
  listing_type?: string | null;
  approval_type?: string | null;
  hub_id?: string | null;
  hubs?: {
    id: string;
    name: string;
  } | null;
  categories?: {
    id: string;
    name: string;
  } | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("tools")
    .select(`
      id,
      name,
      description,
      price_per_day,
      image_url,
      image_url_2,
      image_url_3,
      video_url,
      deposit,
      condition,
      brand,
      model,
      included_accessories,
      usage_notes,
      pickup_notes,
      late_return_rule,
      damage_rule,
      listing_type,
      approval_type,
      hub_id,
      hubs (
        id,
        name
      ),
      categories:category_id (
        id,
        name
      )
    `)
    .eq("id", Number(id))
    .single();

if (error || !data) {
  return (
    <main className="min-h-screen bg-[#f7f8f5] p-6">
      <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-8 shadow-sm">
        <div className="text-xl font-semibold">Tool query failed</div>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-red-600">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    </main>
  );
}

  const tool = data as ToolRow;

  const images = [
    tool.image_url,
    tool.image_url_2,
    tool.image_url_3,
  ].filter(Boolean) as string[];

  const mainImage = images[0] || "/sky.jpg";

  return (
    <main className="min-h-screen bg-[#f7f8f5] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link href="/search" className="text-sm font-medium text-[#2f641f]">
            ← Back to search
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
              <div className="aspect-[4/3] bg-[#eef2ea]">
                <img
                  src={mainImage}
                  alt={tool.name || "Tool"}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(images.length > 0 ? images : ["/sky.jpg", "/sky.jpg", "/sky.jpg"])
                .slice(0, 3)
                .map((img, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-[22px] bg-white shadow-sm"
                  >
                    <div className="aspect-[4/3] bg-[#eef2ea]">
                      <img
                        src={img}
                        alt={`${tool.name || "Tool"} ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-4 rounded-[28px] bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold">Product video</div>

              {tool.video_url ? (
                <div className="mt-3 overflow-hidden rounded-[20px] bg-black">
                  <video
                    controls
                    className="aspect-video w-full"
                    src={tool.video_url}
                  />
                </div>
              ) : (
                <div className="mt-3 flex aspect-video items-center justify-center rounded-[20px] bg-[#eef2ea] text-sm text-black/55">
                  No video yet
                </div>
              )}

              <p className="mt-3 text-sm text-black/60">
                Video helps renters understand size, condition, and how the tool works before booking.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="inline-flex rounded-full bg-[#eef5df] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f641f]">
                {tool.listing_type === "p2p" ? "Owner approval" : "Hub pickup"}
              </div>

              <h1 className="mt-4 text-4xl font-bold">
                {tool.name || "Unnamed Tool"}
              </h1>

              <div className="mt-3 text-lg text-black/65">
                {tool.hubs?.name || "Pickup hub"}
              </div>

              <div className="mt-6 text-4xl font-bold text-[#2f641f]">
                ${tool.price_per_day ?? 0}/day
              </div>

              <p className="mt-6 text-base leading-8 text-black/70">
                {tool.description || "No description yet."}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Link
                  href={`/booking/${tool.id}`}
                  className="rounded-full bg-[#8bbb46] px-6 py-3 text-center text-sm font-semibold text-white"
                >
                  Request Booking
                </Link>

                <Link
                  href={`/search?hub=${tool.hub_id || ""}`}
                  className="rounded-full border border-[#8bbb46] bg-white px-6 py-3 text-center text-sm font-semibold text-[#2f641f]"
                >
                  More nearby tools
                </Link>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold">Quick facts</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Condition</div>
                  <div className="mt-1 font-medium">{tool.condition || "-"}</div>
                </div>

                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Category</div>
                  <div className="mt-1 font-medium">
                    {tool.categories?.name || "-"}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Deposit</div>
                  <div className="mt-1 font-medium">
                    ${tool.deposit ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Approval</div>
                  <div className="mt-1 font-medium">
                    {tool.approval_type || "-"}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Brand</div>
                  <div className="mt-1 font-medium">{tool.brand || "-"}</div>
                </div>

                <div className="rounded-2xl bg-[#f6f8f1] p-4">
                  <div className="text-black/50">Model</div>
                  <div className="mt-1 font-medium">{tool.model || "-"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold">Included accessories</div>
              <p className="mt-4 text-sm leading-7 text-black/70">
                {tool.included_accessories || "Not added yet."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold">Usage notes</div>
            <p className="mt-4 text-sm leading-8 text-black/70">
              {tool.usage_notes || "No usage notes yet."}
            </p>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold">Rental information</div>

            <div className="mt-4 space-y-4 text-sm text-black/70">
              <div className="rounded-2xl bg-[#f6f8f1] p-4">
                <div className="font-semibold text-black">Pickup</div>
                <div className="mt-2">
                  {tool.pickup_notes || "Pickup details not added yet."}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f6f8f1] p-4">
                <div className="font-semibold text-black">Late return rule</div>
                <div className="mt-2">
                  {tool.late_return_rule || "Not added yet."}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f6f8f1] p-4">
                <div className="font-semibold text-black">Damage / loss rule</div>
                <div className="mt-2">
                  {tool.damage_rule || "Not added yet."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}