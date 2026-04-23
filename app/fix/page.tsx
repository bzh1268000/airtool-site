"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Clarification = { question: string; answer: string };

type Quote = {
  ai_summary: string;
  diy: { cost_min: number; cost_max: number; time_estimate: string; tools_needed: string[]; steps_summary: string };
  assisted: { cost_min: number; cost_max: number; description: string };
  professional: { cost_min: number; cost_max: number; notes: string };
};

type MatchedTool = { id: number; name: string; price_per_day: number | null; city: string | null; suburb: string | null };

type Stage = "confirming" | "auth_gate" | "searching" | "results";

const SESSION_KEY = "airtool_job";

function FixContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "";
  const q = searchParams.get("q") || "";

  const [stage, setStage] = useState<Stage>("confirming");
  const [clarifyData, setClarifyData] = useState<{ summary: string; question1: { text: string; options: string[] }; question2: { text: string; options: string[] } } | null>(null);
  const [answer1, setAnswer1] = useState<string | null>(null);
  const [answer2, setAnswer2] = useState<string | null>(null);
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [matchedTools, setMatchedTools] = useState<MatchedTool[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [quoteSaved, setQuoteSaved] = useState(false);

  // On mount: check for returning OAuth user with saved session data
  useEffect(() => {
    const init = async () => {
      const savedRaw = sessionStorage.getItem(SESSION_KEY);
      const { data: { session } } = await supabase.auth.getSession();

      if (session && savedRaw) {
        setStage("searching");
        const saved = JSON.parse(savedRaw);
        runAnalyse(saved, session.user);
        return;
      }

      // Start clarify flow
      setClarifyLoading(true);
      try {
        const res = await fetch("/api/jobs/clarify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, raw_input: q }),
        });
        const data = await res.json();
        setClarifyData(data);
      } catch {
        setClarifyData({
          summary: q || "home job",
          question1: { text: "How urgent is this?", options: ["Can wait", "This week", "Urgent"] },
          question2: { text: "First time dealing with this?", options: ["Yes", "No"] },
        });
      }
      setClarifyLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer1 = async (ans: string) => {
    setAnswer1(ans);
  };

  const handleAnswer2 = async (ans: string) => {
    setAnswer2(ans);
    const clarifications: Clarification[] = [
      { question: clarifyData!.question1.text, answer: answer1! },
      { question: clarifyData!.question2.text, answer: ans },
    ];
    const jobData = { category, raw_input: q, clarifications };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(jobData));

    // Check if already logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setStage("searching");
      runAnalyse(jobData, session.user);
    } else {
      setStage("auth_gate");
    }
  };

  const runAnalyse = async (jobData: { category: string; raw_input: string; clarifications: Clarification[] }, user: { id: string; email?: string }) => {
    try {
      const res = await fetch("/api/jobs/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...jobData,
          user_id: user.id,
          user_email: user.email,
          location_city: null,
        }),
      });
      const data = await res.json();
      setQuote(data.quote);
      setMatchedTools(data.matched_tools || []);
      setJobId(data.job_id || null);
      sessionStorage.removeItem(SESSION_KEY);
      setStage("results");
    } catch {
      setStage("results");
    }
  };

  const handleSaveChoice = async (option: string) => {
    if (!jobId) return;
    await supabase.from("jobs").update({ option_chosen: option }).eq("id", jobId);
    setQuoteSaved(true);
  };

  // ── Stage: confirming ──────────────────────────────────────────────────────
  if (stage === "confirming") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-4 py-20">
        <div className="w-full max-w-lg">
          {clarifyLoading || !clarifyData ? (
            <div className="rounded-2xl bg-white p-8 shadow text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#8bbb46] border-t-transparent" />
              <p className="text-sm text-black/50">Understanding your job...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-6 shadow">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#2f641f]">Looks like a</p>
                <p className="mt-1 text-xl font-bold">{clarifyData.summary}</p>
                <p className="mt-1 text-sm text-black/50">Let me confirm a couple of things:</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow">
                <p className="mb-3 text-sm font-semibold">{clarifyData.question1.text}</p>
                <div className="flex flex-wrap gap-2">
                  {clarifyData.question1.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleAnswer1(opt)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        answer1 === opt
                          ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]"
                          : "border-black/15 text-black/60 hover:border-[#8bbb46]/50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {answer1 && (
                <div className="rounded-2xl bg-white p-6 shadow">
                  <p className="mb-3 text-sm font-semibold">{clarifyData.question2.text}</p>
                  <div className="flex flex-wrap gap-2">
                    {clarifyData.question2.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleAnswer2(opt)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          answer2 === opt
                            ? "border-[#8bbb46] bg-[#f0f8e8] text-[#2f641f]"
                            : "border-black/15 text-black/60 hover:border-[#8bbb46]/50"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Stage: auth_gate ───────────────────────────────────────────────────────
  if (stage === "auth_gate") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-4 py-20">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="text-3xl">🔓</div>
            <h2 className="mt-3 text-xl font-bold">Almost there — sign in to see your free quote</h2>
            <p className="mt-2 text-sm text-black/50">Your answers are saved. This takes 10 seconds.</p>
            <p className="mt-1 text-sm text-black/40">We use your location to find nearby helpers and tradespeople.</p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() =>
                supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: window.location.href },
                })
              }
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-black/15 bg-white py-3 text-sm font-semibold text-black/80 hover:bg-black/5 transition"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <button
              onClick={() =>
                router.push(
                  "/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search)
                )
              }
              className="w-full rounded-xl bg-[#8bbb46] py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] transition"
            >
              Continue with Email
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-black/40">
            Already have an account?{" "}
            <a href="/login" className="font-semibold text-[#2f641f] hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Stage: searching ───────────────────────────────────────────────────────
  if (stage === "searching") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-4 py-20">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-[#8bbb46] border-t-transparent" />
            <p className="text-lg font-semibold">Finding the best options for you...</p>
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white shadow" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Stage: results ─────────────────────────────────────────────────────────
  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-4">
        <div className="text-center">
          <p className="text-black/50">Something went wrong. <a href="/categories" className="text-[#2f641f] underline">Try again</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-4 py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <div className="text-sm font-semibold uppercase tracking-widest text-[#2f641f]">Your free quote</div>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">{quote.ai_summary}</h1>
        </div>

        {/* 3 option cards */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* DIY */}
          <div className="rounded-2xl border-2 border-[#8bbb46] bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#2f641f]">Do It Yourself</div>
            <div className="text-2xl font-bold">${quote.diy.cost_min} – ${quote.diy.cost_max}</div>
            <div className="mt-1 text-sm text-black/50">{quote.diy.time_estimate}</div>

            {quote.diy.tools_needed?.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold text-black/40">Tools needed:</div>
                <div className="flex flex-wrap gap-2">
                  {quote.diy.tools_needed.map((tool) => (
                    <a
                      key={tool}
                      href={`/search?tool=${encodeURIComponent(tool)}`}
                      className="rounded-full bg-[#f0f8e8] px-3 py-1 text-xs font-medium text-[#2f641f] hover:bg-[#e0f0d0] transition"
                    >
                      🔧 {tool}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {matchedTools.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold text-black/40">Available to rent nearby:</div>
                {matchedTools.map((t) => (
                  <a key={t.id} href={`/tools/${t.id}`} className="block text-xs text-[#2f641f] hover:underline">
                    {t.name} {t.price_per_day ? `· $${t.price_per_day}/day` : ""}
                  </a>
                ))}
              </div>
            )}

            {quote.diy.steps_summary && (
              <p className="mt-4 text-xs leading-5 text-black/50">{quote.diy.steps_summary}</p>
            )}

            <button
              onClick={() => { handleSaveChoice("diy"); router.push("/search"); }}
              className="mt-5 w-full rounded-xl bg-[#8bbb46] py-3 text-sm font-semibold text-white hover:bg-[#7aaa39] transition"
            >
              Show me how + rent tools
            </button>
          </div>

          {/* Assisted */}
          <div className="rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">Get Some Help</div>
            <div className="text-2xl font-bold">${quote.assisted.cost_min} – ${quote.assisted.cost_max}</div>
            <p className="mt-3 text-sm text-black/50">{quote.assisted.description || "A helper comes to you"}</p>
            <button
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-xl bg-gray-100 py-3 text-sm font-semibold text-black/40"
            >
              Coming soon — join waitlist
            </button>
          </div>

          {/* Professional */}
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-500">Call a Professional</div>
            <div className="text-2xl font-bold">${quote.professional.cost_min} – ${quote.professional.cost_max}</div>
            <p className="mt-3 text-sm text-black/50">{quote.professional.notes}</p>
            <button
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-xl bg-gray-100 py-3 text-sm font-semibold text-black/40"
            >
              Coming soon — recruiting tradespeople
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-black/40">
          Not sure? Start with DIY — you can always call a pro if needed.
        </p>

        <div className="mt-4 text-center">
          <button
            onClick={() => handleSaveChoice("saved")}
            disabled={quoteSaved}
            className="rounded-full border border-black/15 px-6 py-2 text-sm font-medium text-black/60 hover:bg-black/5 transition disabled:opacity-50"
          >
            {quoteSaved ? "✓ Quote saved" : "Save this quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FixPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <FixContent />
    </Suspense>
  );
}
