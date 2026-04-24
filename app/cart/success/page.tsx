"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/app/context/CartContext";

function CartSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const sessionId = searchParams.get("session_id");

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
        {sessionId && (
          <p className="mt-2 text-xs text-black/30 font-mono break-all">
            Ref: {sessionId}
          </p>
        )}
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

export default function CartSuccessPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8bbb46] border-t-transparent" />
      </main>
    }>
      <CartSuccessContent />
    </Suspense>
  );
}
