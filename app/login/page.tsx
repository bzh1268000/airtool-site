"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    checkAlreadyLoggedIn();
  }, []);

  const checkAlreadyLoggedIn = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setStatus("Already logged in, redirecting...");
      await goByRole(user.id);
    }
  };

  const goByRole = async (userId?: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const id = userId || user?.id;
    if (!id) return;

    setStatus("Loading your profile...");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single();

    const role = profile?.role;
    setStatus("Redirecting...");

    if (redirectTo) {
      router.push(redirectTo);
      return;
    }

    if (role === "admin") {
      router.push("/admin");
    } else if (role === "hub") {
      router.push("/hub");
    } else if (role === "owner") {
      router.push("/owner");
    } else if (role === "renter") {
      router.push("/renter");
    } else {
      router.push("/renter");
    }
  };

  const handleLogin = async () => {
    setError("");
    setStatus("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setStatus("Signing in...");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Wrong email or password. Please try again."
          : signInError.message
      );
      setStatus("");
      setLoading(false);
      return;
    }

    await goByRole();
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    setStatus("Redirecting to Google...");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setStatus("");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-[#2f641f]">AirTool.nz</div>
          <div className="mt-1 text-sm text-black/50 uppercase tracking-widest">Welcome back</div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-4 text-center text-sm text-gray-400">or</div>

        <div className="space-y-3">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}

          {status && !error && (
            <div className="rounded-xl bg-[#f0f8e8] border border-[#8bbb46]/30 px-4 py-3 text-sm text-[#2f641f] flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {status}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />

              <input
                type="password"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm outline-none focus:border-[#8bbb46]"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2f641f] py-3 text-sm font-semibold text-white hover:bg-[#245018] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {status || "Please wait..."}
                  </>
                ) : (
                  "Log In"
                )}
              </button>
            </div>
          </form>

          <div className="text-center text-sm text-black/50 pt-1">
            No account?{" "}
            <a href="/register" className="font-semibold text-[#2f641f] hover:underline">
              Sign up free
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}