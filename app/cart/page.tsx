"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCart } from "@/app/context/CartContext";

export default function CartPage() {
  const router = useRouter();
  const { cartItems, cartCount, removeFromCart, clearCart, loadCart } = useCart();
  const [authChecked, setAuthChecked] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    (async () => {
      console.log("[cart debug] page mounted");

      // Primary: getSession
      let { data: { session } } = await supabase.auth.getSession();
      console.log("[cart debug] session:", session?.user?.email ?? "none");

      // Fallback: getUser (works even if cookie-based session isn't hydrated yet)
      if (!session?.user) {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("[cart debug] getUser fallback:", user?.email ?? "none");
        if (!user) {
          router.replace("/login?redirect=/cart");
          return;
        }
        // Re-fetch session after getUser succeeds
        ({ data: { session } } = await supabase.auth.getSession());
        if (!session?.user) {
          // Still no full session — redirect
          router.replace("/login?redirect=/cart");
          return;
        }
      }

      console.log("[cart] session user id:", session.user.id);
      console.log("[cart] session user email:", session.user.email);

      // Auto-sync: add any confirmed/approved bookings not yet in cart
      // Requires UNIQUE constraint: ALTER TABLE cart_items ADD CONSTRAINT
      // cart_items_user_booking_unique UNIQUE (user_id, booking_id);
      try {
        const userId = session.user.id;

        const [
          { data: confirmedBookings, error: bookingsErr },
          { data: existingCartItems, error: cartItemsErr },
        ] = await Promise.all([
          supabase
            .from("bookings")
            .select("id")
            .eq("user_email", session.user.email)
            .in("status", ["confirmed", "approved"])
            .is("paid_at", null),
          supabase
            .from("cart_items")
            .select("booking_id")
            .eq("user_id", userId),
        ]);

        console.log("[cart] confirmed/approved bookings query:", { data: confirmedBookings, error: bookingsErr });
        console.log("[cart] existing cart_items query:", { data: existingCartItems, error: cartItemsErr });

        const alreadyInCart = new Set((existingCartItems ?? []).map((c: any) => c.booking_id));
        const toAdd = (confirmedBookings ?? []).filter((b: any) => !alreadyInCart.has(b.id));
        console.log("[cart] bookings to auto-add:", toAdd.map((b: any) => b.id));

        if (toAdd.length > 0) {
          const { error: upsertErr } = await supabase.from("cart_items").upsert(
            toAdd.map((b: any) => ({ user_id: userId, booking_id: b.id })),
            { onConflict: "user_id,booking_id" }
          );
          console.log("[cart] upsert result error:", upsertErr);
        }
      } catch (err) {
        console.error("[cart] sync error:", err);
      }

      await loadCart();
      console.log("[cart] cartItems after loadCart:", cartItems);
      setAuthChecked(true);
    })();
  }, [router, loadCart]);

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8bbb46] border-t-transparent" />
      </main>
    );
  }

  // ── Group items by pickup location ──────────────────────────────────────────
  const hubItems    = cartItems.filter((i) => !i.owner_email || i.suburb || i.city);
  const groupedByLocation: Record<string, typeof cartItems> = {};
  cartItems.forEach((item) => {
    const key = item.suburb || item.city || item.owner_email || "Other";
    if (!groupedByLocation[key]) groupedByLocation[key] = [];
    groupedByLocation[key].push(item);
  });

  const total = cartItems.reduce((sum, i) => sum + (i.price_total ?? 0), 0);

  const formatDates = (item: (typeof cartItems)[0]) => {
    if (item.preferred_dates) return item.preferred_dates;
    if (item.start_date && item.end_date) return `${item.start_date} → ${item.end_date}`;
    return "Dates TBC";
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setCheckingOut(true);
    try {
      const booking_ids = cartItems.map((i) => i.booking_id);
      console.log("[cart] sending booking_ids to checkout:", booking_ids);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/cart-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_ids, user_email: session?.user?.email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        alert(data.error || "Checkout failed. Please try again.");
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      alert("Checkout failed. Please try again.");
    }
    setCheckingOut(false);
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f2] px-4">
        <div className="text-6xl">🛒</div>
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-black/50">Add some tool bookings to get started.</p>
        <button
          onClick={() => router.push("/search")}
          className="mt-6 rounded-xl bg-[#8bbb46] px-8 py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] transition"
        >
          Browse tools
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-4 py-24 md:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold md:text-3xl">Your Cart</h1>
        <p className="mt-1 text-sm text-black/50">{cartCount} booking{cartCount !== 1 ? "s" : ""} ready to pay</p>

        {/* Grouped items */}
        <div className="mt-6 space-y-6">
          {Object.entries(groupedByLocation).map(([location, items]) => (
            <div key={location} className="rounded-2xl bg-white shadow-sm overflow-hidden">
              {/* Group header */}
              <div className="border-b border-black/5 bg-[#f0f8e8] px-5 py-3">
                <span className="text-sm font-semibold text-[#2f641f]">
                  {items[0]?.suburb || items[0]?.city
                    ? `📦 ${location} collection`
                    : `🤝 Direct pickup — ${location}`}
                </span>
              </div>

              {/* Items */}
              {items.map((item) => (
                <div key={item.cart_id} className="flex gap-4 border-b border-black/5 p-4 last:border-0">
                  {/* Image */}
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-[#eef2ea]">
                    <img
                      src={item.image_url || "/sky.jpg"}
                      alt={item.tool_name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="font-semibold text-sm leading-snug">{item.tool_name}</div>
                      <div className="mt-0.5 text-xs text-black/50">{formatDates(item)}</div>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[#2f641f]">
                      ${(item.price_total ?? 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(item.cart_id)}
                    className="self-start text-black/30 hover:text-red-500 transition text-lg leading-none px-1"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Group subtotal */}
              <div className="flex justify-between px-5 py-3 text-sm">
                <span className="text-black/50">Group subtotal</span>
                <span className="font-semibold">
                  ${items.reduce((s, i) => s + (i.price_total ?? 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Order total */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-[#2f641f]">NZ${total.toFixed(2)}</span>
          </div>
          <p className="mt-1 text-xs text-black/40">Includes GST · paid in NZD via Stripe</p>
        </div>

        {/* Actions */}
        <div className="mt-4 space-y-3">
          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            className="w-full rounded-xl bg-[#8bbb46] py-4 text-base font-bold text-white hover:bg-[#7aaa39] transition disabled:opacity-60"
          >
            {checkingOut ? "Redirecting to payment…" : `Proceed to Payment — NZ$${total.toFixed(2)}`}
          </button>
          <button
            onClick={() => router.push("/search")}
            className="w-full rounded-xl border border-black/15 py-3 text-sm font-medium text-black/60 hover:bg-black/5 transition"
          >
            🔍 Add another tool
          </button>
          <button
            onClick={clearCart}
            className="w-full text-xs text-black/30 hover:text-red-400 transition py-1"
          >
            Clear cart
          </button>
        </div>
      </div>
    </main>
  );
}
