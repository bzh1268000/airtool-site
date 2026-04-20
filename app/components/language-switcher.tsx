"use client";

import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en",    label: "English" },
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "ja",    label: "日本語" },
  { code: "ko",    label: "한국어" },
  { code: "ar",    label: "العربية" },
  { code: "hi",    label: "हिन्दी" },
  { code: "fr",    label: "Français" },
  { code: "de",    label: "Deutsch" },
  { code: "es",    label: "Español" },
  { code: "pt",    label: "Português" },
  { code: "ru",    label: "Русский" },
  { code: "vi",    label: "Tiếng Việt" },
  { code: "th",    label: "ภาษาไทย" },
  { code: "id",    label: "Bahasa Indonesia" },
  { code: "ms",    label: "Bahasa Melayu" },
  { code: "tl",    label: "Filipino" },
  { code: "it",    label: "Italiano" },
  { code: "nl",    label: "Nederlands" },
];

function getCookieLang(): string {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([^;]+)/);
  return match ? match[1] : "en";
}

function setCookieLang(lang: string) {
  const expires = lang === "en"
    ? "Thu, 01 Jan 1970 00:00:00 GMT"
    : "Fri, 31 Dec 2099 23:59:59 GMT";
  const val = lang === "en" ? "" : `/en/${lang}`;
  document.cookie = `googtrans=${val}; path=/; expires=${expires}`;
  document.cookie = `googtrans=${val}; path=/; domain=${window.location.hostname}; expires=${expires}`;
}

export default function LanguageSwitcher() {
  const [current, setCurrent] = useState("en");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cookieLang = getCookieLang();

    if (cookieLang !== "en") {
      // Already translated — just reflect it in UI
      setCurrent(cookieLang);
      return;
    }

    // First visit — auto-detect browser language
    const browserLang = navigator.language || "";
    const match = LANGUAGES.find(
      (l) => l.code !== "en" && (
        browserLang.toLowerCase().startsWith(l.code.toLowerCase()) ||
        l.code.toLowerCase().startsWith(browserLang.toLowerCase().split("-")[0])
      )
    );

    if (match) {
      setCookieLang(match.code);
      setCurrent(match.code);
      window.location.reload();
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (code: string) => {
    setCookieLang(code);
    setCurrent(code);
    setOpen(false);
    window.location.reload();
  };

  const currentLabel = LANGUAGES.find((l) => l.code === current)?.label ?? "English";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
        title="Change language"
      >
        <Globe className="h-3.5 w-3.5 text-gray-500" />
        <span className="hidden sm:inline max-w-[72px] truncate">{currentLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-[200] w-48 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => select(lang.code)}
                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-[#f0f8e8] ${
                  current === lang.code ? "bg-[#f0f8e8] font-semibold text-[#2f641f]" : "text-gray-700"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
