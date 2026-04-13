"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { validateFullName, validatePhone, validateAddress, validateCity, isAdminEmail } from "@/lib/validation";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [preferDelivery, setPreferDelivery] = useState<"pickup" | "delivery">("pickup");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    if (searchParams.get("acceptedTerms") === "1") {
      setAcceptTerms(true);
    }
  }, [searchParams]);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !phone || !address || !city || !idType || !idNumber) {
      alert("Please fill in all required fields.");
      return;
    }

    if (!isAdminEmail(email)) {
      const nameError = validateFullName(fullName);
      if (nameError) { alert(nameError); return; }

      const phoneError = validatePhone(phone);
      if (phoneError) { alert(phoneError); return; }

      const addressError = validateAddress(address);
      if (addressError) { alert(addressError); return; }

      const cityError = validateCity(city);
      if (cityError) { alert(cityError); return; }
    }

    if (!acceptTerms) {
      alert("Please agree to AirTool Terms & Conditions.");
      return;
    }

    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const acceptedAt = new Date().toISOString();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          address,
          suburb,
          city,
          id_type: idType,
          id_number: idNumber,
          prefer_delivery: preferDelivery,
          role: "renter",
          accepted_terms: true,
          accepted_terms_at: acceptedAt,
        },
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const profilePayload: Record<string, unknown> = {
        id: data.user.id,
        full_name: fullName,
        email,
        phone,
        address,
        suburb,
        city,
        id_type: idType,
        id_number: idNumber,
        prefer_delivery: preferDelivery,
        role: "renter",
        successful_transactions: 0,
      };

      try {
        await supabase.from("profiles").upsert({
          ...profilePayload,
          accepted_terms: true,
          accepted_terms_at: acceptedAt,
        });
      } catch {
        await supabase.from("profiles").upsert(profilePayload);
      }
    }

    alert("Account created! Please check your email to confirm, then log in.");
    router.push("/login");
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-[#2f641f]">AirTool.nz</div>
          <div className="mt-1 text-sm uppercase tracking-widest text-black/50">
            Create your account
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-[#8bbb46]/30 bg-[#f0f8e8] px-4 py-3 text-xs text-[#2f641f]">
          <div className="mb-1 font-semibold">How roles work:</div>
          <div>🔵 <b>Renter</b> — borrow tools from local hubs</div>
          <div>🟡 <b>Owner</b> — list your tools after 3 successful rentals</div>
          <div>🟢 <b>Hub</b> — host & manage tools for your community (by application)</div>
        </div>

        <div className="mb-4 text-center text-sm text-gray-500">
          Register with your email.
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-black/40">
            Personal Info
          </div>

          <input
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            placeholder="Full name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            placeholder="Phone number *"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="pt-2 text-xs font-semibold uppercase tracking-widest text-black/40">
            Pickup / Delivery Address
          </div>

          <input
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            placeholder="Street address *"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
              placeholder="Suburb"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
              placeholder="City *"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="pt-2 text-xs font-semibold uppercase tracking-widest text-black/40">
            Preferred Method
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPreferDelivery("pickup")}
              className={`rounded-xl border py-3 text-sm font-medium transition ${
                preferDelivery === "pickup"
                  ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]"
                  : "border-black/15 text-black/60"
              }`}
            >
              📦 Hub Pickup
            </button>

            <button
              type="button"
              onClick={() => setPreferDelivery("delivery")}
              className={`rounded-xl border py-3 text-sm font-medium transition ${
                preferDelivery === "delivery"
                  ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]"
                  : "border-black/15 text-black/60"
              }`}
            >
              🚚 Delivery
            </button>
          </div>

          <div className="pt-2 text-xs font-semibold uppercase tracking-widest text-black/40">
            ID Verification
          </div>

          <select
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
          >
            <option value="">Select ID type *</option>
            <option value="drivers_licence">Driver&apos;s Licence</option>
            <option value="passport">Passport</option>
            <option value="18plus">18+ Card</option>
            <option value="kiwiaccess">Kiwi Access Card</option>
          </select>

          <input
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            placeholder="ID number *"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />

          <div className="pt-2 text-xs font-semibold uppercase tracking-widest text-black/40">
            Password
          </div>

          <input
            type="password"
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            placeholder="Password (min 6 chars) *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            type="password"
            className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
            placeholder="Confirm password *"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <label className="mt-3 flex items-start gap-3 rounded-xl border border-black/10 bg-[#fafaf7] px-4 py-3 text-xs text-black/65">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5"
              disabled={loading}
            />
            <span>
              I agree to AirTool&apos;s{" "}
              <a href="/terms" className="font-semibold text-[#2f641f] underline">
                Terms &amp; Conditions
              </a>
              .
            </span>
          </label>

          <div className="pt-1 text-xs text-black/40">
            You start as a <b>Renter</b>. After 3 successful transactions you can apply to become an Owner.
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full rounded-xl bg-[#8bbb46] py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <div className="pt-1 text-center text-sm text-black/50">
            Already have an account?{" "}
            <a href="/login" className="font-semibold text-[#2f641f] hover:underline">
              Log in
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}