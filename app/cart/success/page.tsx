"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/context/CartContext";

export default function CartSuccessPage() {
  const router = useRouter();
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f2] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-xl">
        <div className="text-6xl">🎉</div>
        <h1 className="mt-4 text-2xl font-bold text-[#1b1b1b]">Payment successful!</h1>
        <p className="mt-2 text-sm text-black/60">
          Your bookings are confirmed. Owners will be in touch to arrange pickup.
        </p>
        <div className="mt-6 space-y-3">
          <button
            onClick={() => router.push("/renter")}
            className="w-full rounded-xl bg-[#8bbb46] py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] transition"
          >
            View my bookings
          </button>
          <button
            onClick={() => router.push("/search")}
            className="w-full rounded-xl border border-black/15 py-3 text-sm font-medium text-black/60 hover:bg-black/5 transition"
          >
            Browse more tools
          </button>
        </div>
      </div>
    </main>
  );
}
