"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tool = {
  name: string;
  price: string;
  tag: string;
  extra: string;
  image: string;
  mode: "hub" | "owner";
};

type RequestItem = {
  tool?: string;
  date: string;
  hub: string;
  notes: string;
  time: string;
  status: "Pending" | "Approved" | "Rejected" | "Confirmed";
  adminPrice: string;
  mode: "hub" | "owner";
  userConfirmed: boolean;
};

export default function AirToolNZHomepage() {
  const router = useRouter();

  const heroImages = [
    "/grocery.jpg",
    "/sky.jpg",
    "/IMG_20181126_000229_702.jpg",
  ];
  
  const [searchTool, setSearchTool] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [searchHub, setSearchHub] = useState("Oxford Hub");
  const heroHubTitle =
  searchHub === "Oxford Hub"
    ? "Oxford Tool Hub"
    : searchHub === "Christchurch"
    ? "Christchurch Tool Hub"
    : searchHub === "Rangiora"
    ? "Rangiora Tool Hub"
    : searchHub === "Kaiapoi"
    ? "Kaiapoi Tool Hub"
    : searchHub === "Other Area"
    ? "Local Tool Hub"
    : "Oxford Tool Hub";
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [pickupHub, setPickupHub] = useState("Oxford Hub");

<select
  value={pickupHub}
  onChange={(e) => setPickupHub(e.target.value)}
  className="mt-2 w-full rounded-xl border border-black/10 bg-[#fbfcf8] px-3 py-2 text-sm font-medium text-[#2d4254] outline-none"
>
  <option value="Oxford Hub">Oxford Hub</option>
  <option value="Rangiora Hub">Rangiora Hub</option>
  <option value="Christchurch Hub">Christchurch Hub</option>
  <option value="Other Area">Other Area</option>
</select>
  const [currentHero, setCurrentHero] = useState(0);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingHub, setBookingHub] = useState("Oxford Hub");
  const [bookingNotes, setBookingNotes] = useState("");
  
  const categories = [
    { name: "Power Tools", desc: "Drills, saws, grinders, sanders" },
    { name: "Garden Tools", desc: "Trimmers, blowers, hedge cutters" },
    { name: "Cleaning Tools", desc: "Carpet cleaners, pressure washers" },
    { name: "Painting Tools", desc: "Sprayers, ladders, prep gear" },
    { name: "Trailer & Transport", desc: "Trailers, moving gear, tie-downs" },
    { name: "Specialty Tools", desc: "Tile cutters, detectors, concrete tools" },
  ];

  const steps = [
    {
      title: "Search & choose dates",
      text: "Browse local tools, check pricing, pickup hub, deposit, and availability before booking.",
    },
    {
      title: "Request booking",
      text: "Most listings can be requested quickly through the platform, while some tools remain owner or admin reviewed.",
    },
    {
      title: "Admin review & confirmation",
      text: "The platform or hub reviews the request, confirms the booking, and finalises the pickup and payment flow.",
    },
    {
      title: "Pickup, use, and return",
      text: "Collect from the local hub or approved point, return on time, and keep everything tracked on-platform.",
    },
  ];

  const trustBar = [
    {
      title: "SECURE PAYMENT",
      text: "Platform / Hub payment collected first",
      icon: "🔒",
    },
    {
      title: "LOCAL HUB PICKUP",
      text: "Collected and returned through trusted local points",
      icon: "📦",
    },
    {
      title: "ADMIN APPROVAL",
      text: "Requests reviewed before final confirmation",
      icon: "🛠️",
    },
  ];

  const tools: Tool[] = [
    {
      name: "Makita Hammer Drill",
      price: "$28/day",
      tag: "Instant Book",
      extra: "Hub pickup · Deposit required",
      image: "/drill.jpg",
      mode: "hub",
    },
    {
      name: "Pressure Washer Pro",
      price: "$42/day",
      tag: "Owner Approved",
      extra: "Oxford Hub · Local owner listing",
      image: "/washer.jpg",
      mode: "owner",
    },
    {
      name: "Garden Mower",
      price: "$35/day",
      tag: "Popular",
      extra: "Same-day hub pickup available",
      image: "/mower.jpg",
      mode: "owner",
    },
    {
      name: "Utility Trailer",
      price: "$55/day",
      tag: "Weekend Ready",
      extra: "Tow-ready · Deposit required",
      image: "/trailer.jpg",
      mode: "hub",
    },
  ];

  const timeline = [
    "COMMUNITY-ROOTED LOCAL SERVICE",
    "TRUSTED HUB-BASED HANDOVER",
    "PROFESSIONAL, RELIABLE PROCESS",
    "BUILT FOR OXFORD SHARING",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHero((prev) => (prev + 1) % heroImages.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  const goBrowse = () => {
  const params = new URLSearchParams();
  if (searchTool.trim()) params.set("tool", searchTool.trim());
  if (searchStartDate.trim()) params.set("start", searchStartDate.trim());
  if (searchEndDate.trim()) params.set("end", searchEndDate.trim());
  if (searchHub.trim()) params.set("hub", searchHub.trim());
  router.push(`/search?${params.toString()}`);
};

  const goListTool = () => router.push("/owner/tools");
  const goProfile = () => router.push("/profile");
  const goHome = () => router.push("/home");
  const goPickupHub = () => router.push("/hubs");
  const goBecomeHub = () => router.push("/hubs");
  const goAbout = () => router.push("/about");
  const goContact = () => router.push("/contact");

  const closeModal = () => {
    setSelectedTool(null);
    setRequestSent(false);
    setBookingDate("");
    setBookingHub("Oxford Hub");
    setBookingNotes("");
  };

  const submitRequest = () => {
    const newRequest: RequestItem = {
      tool: selectedTool?.name,
      date: bookingDate,
      hub: bookingHub,
      notes: bookingNotes,
      time: new Date().toLocaleString(),
      status: "Pending",
      adminPrice: "",
      mode: selectedTool?.mode || "hub",
      userConfirmed: false,
    };

    setRequests((prev) => [...prev, newRequest]);
    setRequestSent(true);

    setTimeout(() => {
      closeModal();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#1b1b1b]">
      <section id="home" className="relative overflow-hidden pt-24">
        <div className="absolute inset-0 z-0">
          {heroImages.map((image, index) => (
            <div
              key={image}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[1800ms] ${
                index === currentHero ? "opacity-100" : "opacity-0"
              }`}
              style={{ backgroundImage: `url('${image}')` }}
            />
          ))}
        </div>

        <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(214,234,252,0.42),rgba(244,247,251,0.20))]" />
        <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(240,246,255,0.35),rgba(255,255,255,0.55))]" />

        <div className="relative z-20 mx-auto max-w-7xl px-6 pb-16 pt-20 md:pb-24 md:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            <button
              onClick={goHome}
              className="inline-flex rounded-full bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#2f641f] shadow-sm"
            >
              NEIGHBOURS HELPING NEIGHBOURS
            </button>

            <h1 className="text-4xl font-bold">{pickupHub}</h1>

            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-black/70 md:text-lg">
              Simple, reliable local tool hire and sharing in Oxford.
            </p>

            <div className="mx-auto mt-8 max-w-7xl px-6">
              <div className="flex w-full flex-col gap-2 rounded-[28px] bg-white p-2 shadow-lg md:flex-row md:items-center">
                <input
                  type="text"
                  placeholder="What tool do you need?"
                  value={searchTool}
                  onChange={(e) => setSearchTool(e.target.value)}
                  className="flex-1 rounded-full px-4 py-3 text-sm outline-none"
                />

                <input
                 type="date"
                 value={searchStartDate}
                 onChange={(e) => setSearchStartDate(e.target.value)}
                 className="w-full rounded-full px-4 py-3 text-sm outline-none md:w-[170px]"
                />

                <input
                 type="date"
                 value={searchEndDate}
                 onChange={(e) => setSearchEndDate(e.target.value)}
                 className="w-full rounded-full px-4 py-3 text-sm outline-none md:w-[170px]"
                />

                <button
                  onClick={goPickupHub}
                  className="w-full rounded-full px-4 py-3 text-left text-sm text-black/60 md:w-[160px]"
                  >
                  {searchHub || "Pickup hub"}
                </button>

                <button
                  onClick={goBrowse}
                  className="rounded-full bg-[#8bbb46] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7aa63d]"
                  >
                  Search
                </button>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={goBrowse}
                className="min-w-[220px] bg-[#8bbb46] px-8 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-[#7aaa39]"
              >
                BROWSE TOOLS
              </button>
              <button
                onClick={goListTool}
                className="min-w-[220px] border border-[#8bbb46] bg-white/85 px-8 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#2f641f]"
              >
                LIST YOUR TOOL
              </button>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-6xl gap-6 md:grid-cols-4">
            {timeline.map((item) => (
              <div key={item} className="text-center">
                <div className="text-sm uppercase tracking-[0.08em] text-[#1f2a37]">
                  {item}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-3">
          {heroImages.map((_, index) => (
            <button
              key={index}
              aria-label={`Show hero image ${index + 1}`}
              onClick={() => setCurrentHero(index)}
              className={`h-2.5 w-10 rounded-full transition ${
                index === currentHero ? "bg-[#8bbb46]" : "bg-white/65"
              }`}
            />
          ))}
        </div>
      </section>

      <section className="border-b border-black/5 bg-[#f8f8f5]">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-3">
          {trustBar.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 border-black/10 md:border-r md:last:border-r-0 md:pr-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2f641f] text-lg text-white">
                {item.icon}
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em]">
                  {item.title}
                </div>
                <div className="mt-1 text-sm text-black/60">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8bbb46]">
                About AirTool
              </div>
              <h2 className="mt-4 text-4xl font-semibold uppercase tracking-[0.06em] md:text-5xl">
                About our business
              </h2>
              <div className="mt-8 space-y-5 text-lg leading-8 text-black/70">
                <p>
                  Welcome to AirTool.nz — your trusted local hub for practical
                  tool sharing. This is not a loose person-to-person classifieds
                  page. It is a managed platform that keeps the community spirit,
                  while making the booking, payment, pickup, and return process
                  much more structured.
                </p>
                <p>
                  We support two supply models: hub-hosted tools and
                  owner-managed listings. Orders are reviewed through the
                  platform. Payment is collected by the platform or hub first,
                  and damage, late return, loss, and cancellation rules are
                  clearly shown.
                </p>
              </div>
            </div>

            <div className="rounded-sm bg-[#f2f5ec] p-8 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2f641f]">
                Why this style matches your earlier website
              </div>
              <div className="mt-6 space-y-4 text-sm leading-7 text-black/70">
                <p>• Light sky-style hero section instead of dark industrial blocks</p>
                <p>• Green accent colour aligned with the old Queenette website</p>
                <p>• More centered headline layout and softer community tone</p>
                <p>• Cleaner marketplace structure added underneath the familiar visual feeling</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="browse" className="bg-[#f6f8f1] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8bbb46]">
              Marketplace
            </div>
            <h2 className="mt-4 text-4xl font-semibold uppercase tracking-[0.08em] md:text-5xl">
              Find the right tool locally
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-black/65">
              The page layout keeps the softer community visual style, but the
              content blocks now clearly show availability, booking type,
              approval logic, deposit logic, and hub-based pickup.
            </p>
          </div>

          <div className="mt-12 rounded-sm bg-white p-6 shadow-sm md:p-8">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="border border-black/10 bg-[#fbfcf8] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-black/45">
                  Category
                </div>
                <div className="mt-2 font-medium">{searchTool || "Pressure Washer"}</div>
              </div>
              <div className="border border-black/10 bg-[#fbfcf8] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-black/45">
                  Dates
                </div>
                <div className="mt-2 font-medium">
                  {searchStartDate || searchEndDate
                  ? `${searchStartDate || "Start"} → ${searchEndDate || "End"}`
                  : "Choose dates"}
               </div>
              </div>
              <div className="border border-black/10 bg-[#fbfcf8] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-black/45">
                Pick up hub
              </div>

              <div className="relative mt-2">
               <select
                value={pickupHub}
                onChange={(e) => setPickupHub(e.target.value)}
                className="w-full cursor-pointer appearance-none bg-transparent pr-10 text-base font-medium text-[#23313f] outline-none"
                >
                 <option value="Oxford Hub">Oxford Hub</option>
                 <option value="Rangiora Hub">Rangiora Hub</option>
                 <option value="Christchurch Hub">Christchurch Hub</option>
                 <option value="Other Area">Other Area</option>
               </select>

                <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#23313f]">
                  ▼
                </span>
              </div>
             </div>
            </div>
            <button
              onClick={goBrowse}
              className="mt-5 bg-[#8bbb46] px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white"
            >
              Search available tools
            </button>
          </div>
          <div className="mt-4 flex justify-center">
          <div className="w-full max-w-[260px]">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#2f641f]">
             Pickup Hub
          </label>
        <select
          value={searchHub}
          onChange={(e) => setSearchHub(e.target.value)}
          className="w-full rounded-full border border-white/70 bg-white/85 px-4 py-3 text-sm text-[#1f2a37] shadow-sm outline-none"
            >
          <option>Oxford Hub</option>
          <option>Rangiora Hub</option>
          <option>Christchurch Hub</option>
          <option>Kaiapoi Hub</option>
          <option>Other Area</option>
       </select>
     </div>
  </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="overflow-hidden border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#eef2ea]">
                  <img
                    src={tool.image}
                    alt={tool.name}
                    className="h-full w-full object-cover object-center"
                  />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-semibold">{tool.name}</div>
                      <div className="mt-2 text-sm leading-6 text-black/60">
                        {tool.extra}
                      </div>
                    </div>
                    <div className="bg-[#eef5df] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f641f]">
                      {tool.tag}
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em]">
                    {tool.mode === "hub" ? (
                      <span className="bg-green-100 px-2 py-1 text-green-700">
                        Hub pickup
                      </span>
                    ) : (
                      <span className="bg-blue-100 px-2 py-1 text-blue-700">
                        Owner approval
                      </span>
                    )}
                  </div>

                  <div className="mt-5">
                    <div className="text-lg font-semibold text-[#2f641f]">
                      From {tool.price}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-black/45">
                      Admin approval required
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedTool(tool)}
                      className="bg-[#8bbb46] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#7aaa39]"
                    >
                      Request Booking
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category.name}
                className="border border-black/5 bg-white p-5 shadow-sm"
              >
                <div className="aspect-[16/10] bg-[linear-gradient(180deg,#e3edf8,#faf8f0)]" />
                <div className="mt-5 text-xl font-semibold uppercase tracking-[0.04em]">
                  {category.name}
                </div>
                <div className="mt-2 text-sm leading-6 text-black/60">
                  {category.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="account" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="bg-[#f4f7ee] p-8 md:p-10">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8bbb46]">
                How it works
              </div>
              <h2 className="mt-4 text-4xl font-semibold uppercase tracking-[0.08em]">
                Simple local booking flow
              </h2>
              <div className="mt-8 space-y-6">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className="flex gap-4 border-b border-black/5 pb-6 last:border-b-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2f641f] text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{step.title}</div>
                      <div className="mt-2 text-sm leading-6 text-black/65">
                        {step.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6">
              <div className="bg-[#f9faf6] p-8 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8bbb46]">
                  For tool owners
                </div>
                <h3 className="mt-4 text-3xl font-semibold uppercase tracking-[0.06em]">
                  Earn from idle tools
                </h3>
                <div className="mt-4 text-sm leading-7 text-black/65">
                  Choose hub-hosted or owner-managed listing mode. Keep
                  communication on-platform and let the platform review requests
                  before final confirmation.
                </div>
                <button
                  onClick={goListTool}
                  className="mt-6 bg-[#8bbb46] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white"
                >
                  List your tool
                </button>
              </div>

              <div id="hubs" className="bg-[#eef4e3] p-8 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8bbb46]">
                  For hubs
                </div>
                <h3 className="mt-4 text-3xl font-semibold uppercase tracking-[0.06em]">
                  Become the local trust layer
                </h3>
                <div className="mt-4 text-sm leading-7 text-black/65">
                  Hubs help with pickup, return, basic inspection, and community
                  convenience. This keeps the platform practical and aligned
                  with the local-store roots of your old site.
                </div>
                <button
                  onClick={goBecomeHub}
                  className="mt-6 border border-[#8bbb46] bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#2f641f]"
                >
                  Become a hub
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8f3] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8bbb46]">
              Rules shown clearly
            </div>
            <h2 className="mt-4 text-4xl font-semibold uppercase tracking-[0.08em]">
              Trust questions answered early
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              "How does request booking differ from owner-approved listings?",
              "Why are private owner contact details not shown?",
              "When is payment collected by the platform or hub?",
              "What happens if a tool is damaged, lost, or returned late?",
              "How does free cancellation work before pickup?",
              "Where do pickup and return take place?",
            ].map((q) => (
              <div key={q} className="bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold">{q}</div>
                <div className="mt-3 text-sm leading-7 text-black/65">
                  Show a short homepage answer here and link to the full policy
                  page. This fits your older site style better than oversized
                  modern accordion cards.
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {selectedTool && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold">
              Request Booking – {selectedTool.name}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                  Preferred date
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                  Pickup hub
                </label>
                <select
                  value={bookingHub}
                  onChange={(e) => setBookingHub(e.target.value)}
                  className="w-full border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                >
                  <option>Oxford Hub</option>
                  <option>Christchurch Hub</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                  Notes
                </label>
                <textarea
                  placeholder="Add timing, delivery, or usage notes"
                  value={bookingNotes} 
                  onChange={(e) => setBookingNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-none border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                />
              </div>
            </div>

            {requestSent && (
              <div className="mt-4 text-sm font-medium text-[#2f641f]">
                Request sent to admin.
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-black/65"
              >
                Cancel
              </button>

              <button
                onClick={submitRequest}
                className="bg-[#8bbb46] px-5 py-3 text-sm font-semibold text-white hover:bg-[#7aaa39]"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-6 text-2xl font-semibold">Admin – Requests</div>

          <div className="space-y-4">
            {requests.map((r, i) => (
              <div key={i} className="border p-4">
                <div><b>Tool:</b> {r.tool}</div>
                <div><b>Date:</b> {r.date}</div>
                <div><b>Hub:</b> {r.hub}</div>
                <div><b>Notes:</b> {r.notes}</div>

                <div className="flex items-center gap-2">
                  <b>Status:</b>
                  <span
                    className={`px-2 py-1 text-xs font-semibold uppercase ${
                      r.status === "Pending"
                        ? "bg-yellow-100 text-yellow-700"
                        : r.status === "Approved"
                        ? "bg-green-100 text-green-700"
                        : r.status === "Rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                {r.status === "Pending" && (
                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={() =>
                        setRequests((prev) =>
                          prev.map((item, index) =>
                            index === i ? { ...item, status: "Approved" } : item
                          )
                        )
                      }
                      className="bg-[#8bbb46] px-3 py-2 text-xs font-semibold uppercase text-white"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() =>
                        setRequests((prev) =>
                          prev.map((item, index) =>
                            index === i ? { ...item, status: "Rejected" } : item
                          )
                        )
                      }
                      className="bg-black/70 px-3 py-2 text-xs font-semibold uppercase text-white"
                    >
                      Reject
                    </button>
                  </div>
                )}

                <div className="mt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                    Mode
                  </div>

                  {r.status === "Pending" ? (
                    <select
                      value={r.mode}
                      onChange={(e) =>
                        setRequests((prev) =>
                          prev.map((item, index) =>
                            index === i
                              ? {
                                  ...item,
                                  mode: e.target.value as "hub" | "owner",
                                }
                              : item
                          )
                        )
                      }
                      className="w-full max-w-[220px] border border-black/15 px-3 py-2 text-sm"
                    >
                      <option value="hub">Hub managed (45/45/10)</option>
                      <option value="owner">Owner direct (85/15)</option>
                    </select>
                  ) : (
                    <div className="text-sm font-semibold text-black/70">
                      {r.mode === "hub"
                        ? "Hub managed (45/45/10)"
                        : "Owner direct (85/15)"}
                    </div>
                  )}
                </div>

                {r.status === "Approved" && (
                  <div className="mt-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
                      Admin price
                    </div>
                    <input
                      type="text"
                      value={r.adminPrice}
                      onChange={(e) =>
                        setRequests((prev) =>
                          prev.map((item, index) =>
                            index === i
                              ? { ...item, adminPrice: e.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="Enter final charge"
                      className="w-full max-w-[220px] border border-black/15 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {r.status === "Approved" && r.adminPrice && (
                  <button
                    onClick={() =>
                      setRequests((prev) =>
                        prev.map((item, index) =>
                          index === i ? { ...item, status: "Confirmed" } : item
                        )
                      )
                    }
                    className="mt-3 bg-[#2f641f] px-4 py-2 text-xs font-semibold uppercase text-white"
                  >
                    Confirm Charge
                  </button>
                )}

                {r.status === "Confirmed" && r.adminPrice && (
                  <div className="mt-3 text-sm font-semibold text-[#2f641f]">
                    {`Final charge: $${r.adminPrice}`}
                  </div>
                )}

                {r.status === "Confirmed" && !r.userConfirmed && (
                  <button
                    onClick={() =>
                      setRequests((prev) =>
                        prev.map((item, index) =>
                          index === i
                            ? { ...item, userConfirmed: true }
                            : item
                        )
                      )
                    }
                    className="mt-3 bg-blue-600 px-4 py-2 text-xs font-semibold uppercase text-white"
                  >
                    User Confirm & Pay
                  </button>
                )}

                {r.status === "Confirmed" && r.userConfirmed && (
                  <>
                    <div className="mt-2 text-sm font-semibold text-blue-700">
                      Payment completed
                    </div>
                    <div className="mt-3 text-sm text-black/70">
                      {r.mode === "hub" ? (
                        <>
                          <div>Owner: ${(Number(r.adminPrice) * 0.45).toFixed(2)}</div>
                          <div>Hub: ${(Number(r.adminPrice) * 0.45).toFixed(2)}</div>
                          <div>Platform: ${(Number(r.adminPrice) * 0.10).toFixed(2)}</div>
                        </>
                      ) : (
                        <>
                          <div>Owner: ${(Number(r.adminPrice) * 0.85).toFixed(2)}</div>
                          <div>Platform: ${(Number(r.adminPrice) * 0.15).toFixed(2)}</div>
                        </>
                      )}
                    </div>
                  </>
                )}

                <button
                  onClick={() =>
                    setRequests((prev) => prev.filter((_, index) => index !== i))
                  }
                  className="mt-3 border border-black/15 px-3 py-2 text-xs font-semibold uppercase text-black/65 hover:bg-black/5"
                >
                  Delete
                </button>

                <div className="mt-3 text-xs text-black/50">{r.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact" className="relative text-black">
        <div className="absolute left-0 right-0 top-0 z-10 h-16 bg-gradient-to-b from-white to-transparent" />

        <div className="bg-[linear-gradient(180deg,#e7edfb_0%,#9aa4f2_55%,#5c68ea_100%)] pb-12 pt-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 md:grid-cols-3 md:items-center">
            <div className="text-sm uppercase tracking-[0.2em]">
              <button onClick={goHome} className="block text-[#8bbb46]">Home</button>
              <button onClick={goAbout} className="mt-3 block">About</button>
              <button onClick={goBrowse} className="mt-3 block">Marketplace</button>
              <button onClick={goContact} className="mt-3 block">Contact</button>
              <button onClick={goProfile} className="mt-3 block">My Account</button>
            </div>

            <div className="text-center">
              <button onClick={goHome} className="text-4xl font-semibold text-[#2f641f]">
                AirTool.nz
              </button>
              <div className="mt-3 text-sm uppercase tracking-[0.2em] text-black/70">
                Community people help each other
              </div>
            </div>

            <div className="text-right text-sm uppercase tracking-[0.2em] text-black/75">
              <div>Copyright ©2026</div>
              <div className="mt-3">airtool.nz</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}