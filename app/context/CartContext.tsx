"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export type CartItem = {
  cart_id: number;
  booking_id: number;
  tool_name: string;
  image_url: string | null;
  price_per_day: number | null;
  start_date: string | null;
  end_date: string | null;
  preferred_dates: string | null;
  price_total: number | null;
  owner_email: string | null;
  address: string | null;
  city: string | null;
  suburb: string | null;
};

type CartContextType = {
  cartItems: CartItem[];
  cartCount: number;
  addToCart: (booking_id: number) => Promise<void>;
  removeFromCart: (cart_id: number) => Promise<void>;
  clearCart: () => Promise<void>;
  loadCart: () => Promise<void>;
};

const CartContext = createContext<CartContextType>({
  cartItems: [],
  cartCount: 0,
  addToCart: async () => {},
  removeFromCart: async () => {},
  clearCart: async () => {},
  loadCart: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const loadCart = useCallback(async () => {
    // ── Session check ──────────────────────────────────────────────────────────
    const { data: { session } } = await supabase.auth.getSession();
    console.log("[cartContext] session for cart load:", session?.user?.id ?? "no session");
    if (!session?.user?.id) { setCartItems([]); return; }

    // ── Raw test query (confirms RLS isn't blocking entirely) ─────────────────
    const { data: testData, error: testError } = await supabase
      .from("cart_items")
      .select("*");
    console.log("[cartContext] raw cart_items test:", testData, testError);

    // ── Targeted query with explicit user_id filter ───────────────────────────
    const { data: userRows, error: userErr } = await supabase
      .from("cart_items")
      .select("id, booking_id")
      .eq("user_id", session.user.id);
    console.log("[cartContext] cart_items with user filter:", userRows, userErr);

    // Step 1 — cart items + booking data
    const { data: cartData, error } = await supabase
      .from("cart_items")
      .select("id, booking_id, bookings(id, start_date, end_date, preferred_dates, price_total, status, owner_email, address, tool_id)")
      .eq("user_id", session.user.id)
      .order("id", { ascending: true });

    console.log("[cartContext] loading cart for user:", session.user.id);
    if (error) { console.error("loadCart error:", error.message); return; }

    // Step 2 — fetch tools separately
    const toolIds = (cartData ?? [])
      .map((row: any) => row.bookings?.tool_id)
      .filter(Boolean) as number[];

    let toolsMap: Record<number, { id: number; name: string; image_url: string | null; price_per_day: number | null; city: string | null; suburb: string | null }> = {};

    if (toolIds.length > 0) {
      const { data: toolsData, error: toolsErr } = await supabase
        .from("tools")
        .select("id, name, image_url, price_per_day, city, suburb")
        .in("id", toolIds);
      if (toolsErr) console.error("loadCart tools error:", toolsErr.message);
      if (toolsData) {
        toolsMap = Object.fromEntries((toolsData as any[]).map((t) => [t.id, t]));
      }
    }

    // Step 3 — merge
    const items: CartItem[] = (cartData ?? []).map((row: any) => {
      const booking = row.bookings ?? {};
      const tool    = toolsMap[booking.tool_id] ?? {};
      return {
      cart_id:         row.id,
      booking_id:      row.booking_id,
      tool_name:       tool.name ?? "Unknown tool",
      image_url:       tool.image_url ?? null,
      price_per_day:   tool.price_per_day ?? null,
      start_date:      booking.start_date ?? null,
      end_date:        booking.end_date ?? null,
      preferred_dates: booking.preferred_dates ?? null,
      price_total:     booking.price_total ?? null,
      owner_email:     booking.owner_email ?? null,
      address:         booking.address ?? null,
      city:            tool.city ?? null,
      suburb:          tool.suburb ?? null,
    };
    });

    setCartItems(items);
  }, []);

  const addToCart = useCallback(async (booking_id: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from("cart_items")
      .insert({ user_id: session.user.id, booking_id });

    if (error) { console.error("addToCart error:", error.message); return; }
    await loadCart();
  }, [loadCart]);

  const removeFromCart = useCallback(async (cart_id: number) => {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", cart_id);

    if (error) { console.error("removeFromCart error:", error.message); return; }
    setCartItems((prev) => prev.filter((i) => i.cart_id !== cart_id));
  }, []);

  const clearCart = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from("cart_items").delete().eq("user_id", session.user.id);
    setCartItems([]);
  }, []);

  // Load on mount and on auth change
  useEffect(() => {
    loadCart();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadCart();
      else setCartItems([]);
    });
    return () => subscription.unsubscribe();
  }, [loadCart]);

  return (
    <CartContext.Provider value={{
      cartItems,
      cartCount: cartItems.length,
      addToCart,
      removeFromCart,
      clearCart,
      loadCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
