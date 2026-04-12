"use client";

import { ReactNode } from "react";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function DashboardShell({
  title,
  subtitle,
  children,
}: DashboardShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden text-gray-900">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/sky.jpg')" }}
      />

      {/* Blue haze overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(190,220,255,0.38),rgba(244,247,251,0.12))]" />

      {/* White mist overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.58))]" />

      {/* Content layer */}
      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 rounded-3xl border border-white/40 bg-white/72 p-6 shadow-sm backdrop-blur-md">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 sm:text-base">
                {subtitle}
              </p>
            ) : null}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}