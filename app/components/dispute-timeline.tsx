"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type DisputeRecord = {
  id: number;
  booking_id: number;
  owner_email: string | null;
  renter_email: string | null;
  reason: string | null;
  amount_claimed: number | null;
  owner_evidence_urls: string[] | null;
  renter_response: string | null;
  renter_responded_at: string | null;
  renter_evidence_urls: string[] | null;
  resolution: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  status: string | null;
  created_at: string | null;
};

// ── Signed-URL helper ─────────────────────────────────────────────────────────
async function toSignedUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const results = await Promise.all(
    paths.map((p) =>
      supabase.storage.from("dispute-evidence").createSignedUrl(p, 3600),
    ),
  );
  return results.flatMap((r) => (r.data?.signedUrl ? [r.data.signedUrl] : []));
}

// ── Evidence image grid ───────────────────────────────────────────────────────
function EvidenceGrid({ paths, label }: { paths: string[] | null; label: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!paths?.length) return;
    toSignedUrls(paths).then(setUrls);
  }, [paths]);

  if (!paths?.length) return null;

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.length > 0 ? (
          urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={`Evidence ${i + 1}`}
                className="h-24 w-24 rounded-xl border border-gray-200 object-cover transition hover:opacity-90"
              />
            </a>
          ))
        ) : (
          <p className="text-xs text-gray-400">
            {paths.length} image{paths.length > 1 ? "s" : ""} — loading…
          </p>
        )}
      </div>
    </div>
  );
}

// ── Resolution label ──────────────────────────────────────────────────────────
function resolutionLabel(r: string | null): string {
  if (r === "release_to_owner") return "Payment released to owner";
  if (r === "partial_refund")   return "Partial refund issued to renter";
  if (r === "full_refund")      return "Full refund issued to renter";
  return r || "—";
}

// ── Individual timeline entry ─────────────────────────────────────────────────
type EntryColor = "red" | "blue" | "green" | "gray";

const entryStyles: Record<EntryColor, { dot: string; line: string; bg: string; border: string }> = {
  red:   { dot: "bg-red-500",   line: "border-red-200",   bg: "bg-red-50",   border: "border-red-200" },
  blue:  { dot: "bg-blue-500",  line: "border-blue-200",  bg: "bg-blue-50",  border: "border-blue-200" },
  green: { dot: "bg-green-600", line: "border-green-200", bg: "bg-green-50", border: "border-green-200" },
  gray:  { dot: "bg-gray-400",  line: "border-gray-200",  bg: "bg-gray-50",  border: "border-gray-200" },
};

function TimelineEntry({
  icon,
  color,
  title,
  party,
  timestamp,
  isLast = false,
  children,
}: {
  icon: string;
  color: EntryColor;
  title: string;
  party?: string | null;
  timestamp?: string | null;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  const c = entryStyles[color];
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm shadow ${c.dot} text-white`}
        >
          {icon}
        </div>
        {!isLast && <div className={`mt-1 min-h-[16px] flex-1 border-l-2 ${c.line}`} />}
      </div>
      <div className={`mb-4 flex-1 rounded-2xl border ${c.border} ${c.bg} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-900">{title}</p>
          {timestamp && (
            <p className="text-xs text-gray-400">
              {new Date(timestamp).toLocaleString("en-NZ")}
            </p>
          )}
        </div>
        {party && <p className="mt-0.5 text-xs text-gray-500">{party}</p>}
        {children}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DisputeTimeline({ dispute }: { dispute: DisputeRecord }) {
  const hasRenterResponse = !!dispute.renter_response;
  const isResolved        = dispute.status === "resolved";

  return (
    <div className="mt-4 space-y-0">
      {/* Owner claim */}
      <TimelineEntry
        icon="⚠️"
        color="red"
        title="Owner raised a dispute"
        party={dispute.owner_email ?? undefined}
        timestamp={dispute.created_at}
      >
        <p className="mt-2 text-sm text-red-800">{dispute.reason}</p>
        {dispute.amount_claimed != null && (
          <p className="mt-1 text-xs font-semibold text-red-600">
            Amount claimed: ${Number(dispute.amount_claimed).toFixed(2)} NZD
          </p>
        )}
        <EvidenceGrid paths={dispute.owner_evidence_urls} label="Owner evidence" />
      </TimelineEntry>

      {/* Renter response — or "awaiting" placeholder */}
      {hasRenterResponse ? (
        <TimelineEntry
          icon="💬"
          color="blue"
          title="Renter responded"
          party={dispute.renter_email ?? undefined}
          timestamp={dispute.renter_responded_at}
          isLast={!isResolved}
        >
          <p className="mt-2 text-sm text-blue-800">{dispute.renter_response}</p>
          <EvidenceGrid paths={dispute.renter_evidence_urls} label="Renter evidence" />
        </TimelineEntry>
      ) : (
        !isResolved && (
          <TimelineEntry
            icon="⏳"
            color="gray"
            title="Awaiting renter response"
            isLast={true}
          />
        )
      )}

      {/* Admin decision */}
      {isResolved && (
        <TimelineEntry
          icon="✅"
          color="green"
          title="AirTool resolved the dispute"
          timestamp={dispute.resolved_at}
          isLast={true}
        >
          <p className="mt-2 text-sm font-semibold text-green-800">
            Decision: {resolutionLabel(dispute.resolution)}
          </p>
          {dispute.admin_notes && (
            <p className="mt-1 text-xs text-green-700">{dispute.admin_notes}</p>
          )}
        </TimelineEntry>
      )}
    </div>
  );
}
