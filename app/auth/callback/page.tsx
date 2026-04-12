"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AppRole = "admin" | "renter" | "owner" | "hub";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finishLogin = async () => {
      const code = new URL(window.location.href).searchParams.get("code");

if (code) {
  await supabase.auth.exchangeCodeForSession(code);
}

const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  router.replace("/login");
  return;
}

const email = (user.email || "").toLowerCase().trim();
console.log("LOGIN EMAIL =", email);

const fullName =
  user.user_metadata?.full_name ||
  user.user_metadata?.name ||
  "";

const { data: existingProfile } = await supabase
  .from("profiles")
  .select("id, role")
  .eq("id", user.id)
  .maybeSingle();

let role: AppRole = "renter";

if (email === "bzh1268@gmail.com") {
  role = "admin";
}

if (existingProfile?.role) {
  role = existingProfile.role as AppRole;
}

if (!existingProfile) {
  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email,
    full_name: fullName,
    role,
  });

  if (insertError) {
    console.error("Failed to create profile:", insertError.message);
    router.replace("/login");
    return;
  }
}

if (role === "admin") router.replace("/admin");
else if (role === "hub") router.replace("/hub");
else if (role === "owner") router.replace("/owner");
else router.replace("/search");
    };

    finishLogin();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-2xl border bg-white px-6 py-5 shadow">
        Signing you in...
      </div>
    </main>
  );
}