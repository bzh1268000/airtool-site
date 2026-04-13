"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type MessageRow = {
  id: number;
  booking_id: number;
  sender_email: string;
  receiver_email: string;
  message: string;
  created_at: string;
};

type ConversationItem = {
  booking_id: number;
  other_email: string;
  tool_name: string;
  last_message: string;
  last_time: string;
};

function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // currentUserEmail: set ONCE from supabase.auth.getUser().
  // Also stored in a ref so isMe comparison is never stale across renders.
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const meRef = useRef("");                // synchronous, always current

  const [userRole, setUserRole] = useState("");

  const [conversations, setConversations]     = useState<ConversationItem[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedOtherEmail, setSelectedOtherEmail] = useState("");
  const [selectedToolName, setSelectedToolName]   = useState("");
  const [currentMessages, setCurrentMessages]     = useState<MessageRow[]>([]);
  const [text, setText]                           = useState("");
  const [pageLoading, setPageLoading]             = useState(true);
  const [msgLoading, setMsgLoading]               = useState(false);

  // ── Mount ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Step 1 — auth (must come from Supabase, not cache)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { router.replace("/login"); return; }

      // Store in BOTH ref (sync) and state (for re-renders)
      meRef.current = user.email;
      setCurrentUserEmail(user.email);

      // Fetch role for back-button destination
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setUserRole(profile?.role || "renter");

      // Step 2 — build conversation list
      await buildConversationList(user.email);

      setPageLoading(false);
    })();
  }, []);

  // ── Build conversation list ───────────────────────────────────────────────────
  // Fetches messages the current user sent OR received, groups by booking_id.
  const buildConversationList = async (myEmail: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, booking_id, sender_email, receiver_email, message, created_at")
      .or(`sender_email.eq.${myEmail},receiver_email.eq.${myEmail}`)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    // Group: one entry per booking_id, keyed by most-recent message
    const seen = new Map<number, ConversationItem>();
    for (const m of data as MessageRow[]) {
      if (!seen.has(m.booking_id)) {
        // other_email = the email that is NOT me
        const other = m.sender_email === myEmail ? m.receiver_email : m.sender_email;
        seen.set(m.booking_id, {
          booking_id: m.booking_id,
          other_email: other,
          tool_name: `Booking #${m.booking_id}`,
          last_message: m.message,
          last_time: m.created_at,
        });
      }
    }

    // Resolve tool names (best-effort — skip on error)
    const ids = [...seen.keys()];
    if (ids.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings").select("id, tool_id").in("id", ids);
      const toolIds = [...new Set(
        ((bookings || []) as { id: number; tool_id: number | null }[])
          .map(b => b.tool_id).filter((id): id is number => id !== null)
      )];
      if (toolIds.length > 0) {
        const { data: tools } = await supabase
          .from("tools").select("id, name").in("id", toolIds);
        const tMap = new Map(
          ((tools || []) as { id: number; name: string | null }[])
            .map(t => [t.id, t.name || `Tool #${t.id}`])
        );
        ((bookings || []) as { id: number; tool_id: number | null }[]).forEach(b => {
          const item = seen.get(b.id);
          if (item && b.tool_id) item.tool_name = tMap.get(b.tool_id) || item.tool_name;
        });
      }
    }

    const list = [...seen.values()].sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );
    setConversations(list);

    // Auto-select conversation
    const urlBid    = searchParams.get("booking_id");
    const urlOther  = searchParams.get("other_email");

    if (urlBid && urlOther) {
      const bookingId = Number(urlBid);
      const toolName  = seen.get(bookingId)?.tool_name || `Booking #${bookingId}`;
      openConversation(bookingId, urlOther, toolName, myEmail);
    } else if (list.length > 0) {
      openConversation(list[0].booking_id, list[0].other_email, list[0].tool_name, myEmail);
    }
  };

  // ── Open / switch conversation ─────────────────────────────────────────────
  // Fetches ALL messages for the booking — no sender/receiver filter.
  const openConversation = async (
    bookingId: number,
    otherEmail: string,
    toolName: string,
    myEmail: string,
  ) => {
    setSelectedBookingId(bookingId);
    setSelectedOtherEmail(otherEmail);
    setSelectedToolName(toolName);
    setMsgLoading(true);
    setCurrentMessages([]);

    // ── THE KEY QUERY ──
    // Select ALL messages for this booking_id.
    // No sender_email / receiver_email filter here.
    // Both sides of the conversation are always returned.
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("fetchMessages error:", error.message);
    } else {
      setCurrentMessages((data || []) as MessageRow[]);
    }

    // Mark all messages in this booking addressed to me as read.
    // await so the DB write completes before the user navigates back
    // to the owner dashboard (which re-queries the unread count on focus).
    //
    // Priority: myEmail param (passed directly from auth at call site) →
    //           meRef.current (sync ref) → currentUserEmail state.
    // We log the value so any "empty string" bug is immediately visible.
    const me = myEmail || meRef.current || currentUserEmail;
    console.log("[messages] marking read for:", me, "booking:", bookingId);
    if (me) {
      const { error: readError } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("booking_id", bookingId)
        .eq("receiver_email", me)
        .eq("is_read", false);
      if (readError) console.error("[messages] mark-read error:", readError.message);
    } else {
      console.warn("[messages] mark-read skipped — no current user email available");
    }

    setMsgLoading(false);
  };

  // ── Realtime subscription — new messages appear instantly ───────────────────
  // Subscribe to INSERT events on the messages table filtered to the current
  // booking_id. When a new row arrives, append it to currentMessages so both
  // parties see each other's replies without a manual refresh.
  useEffect(() => {
    if (!selectedBookingId) return;

    const channel = supabase
      .channel("messages-" + selectedBookingId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "booking_id=eq." + selectedBookingId,
        },
        (payload) => {
          setCurrentMessages((prev) => {
            // Avoid duplicates if sendMessage already pushed the row
            const exists = prev.some((m) => m.id === (payload.new as MessageRow).id);
            return exists ? prev : [...prev, payload.new as MessageRow];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedBookingId]);

  // ── Send message ──────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!text.trim() || !selectedBookingId) return;

    // Always re-fetch identity from auth — never trust cached state
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { router.replace("/login"); return; }

    // otherEmail: come from conversations list when available, fall back to state.
    // This guarantees receiver_email is NEVER accidentally the sender's own email.
    const conv = conversations.find(c => c.booking_id === selectedBookingId);
    const otherEmail = conv?.other_email || selectedOtherEmail;

    if (!otherEmail || otherEmail === user.email) {
      alert("Recipient unclear — please refresh and try again.");
      return;
    }

    const { error } = await supabase.from("messages").insert({
      booking_id:     selectedBookingId,
      sender_email:   user.email,    // me — from fresh auth
      receiver_email: otherEmail,    // other party
      message:        text.trim(),
    });

    if (error) { alert("Send failed: " + error.message); return; }

    setText("");

    // Realtime subscription handles the incoming message display —
    // no need to reload all messages. Only refresh the sidebar so
    // last_message and sort order stay current.
    await buildConversationList(user.email);
  };

  // ── Dashboard URL by role ────────────────────────────────────────────────────
  const dashboardUrl =
    userRole === "admin" ? "/admin" :
    userRole === "hub"   ? "/hub"   :
    userRole === "owner" ? "/owner" :
    "/renter";

  // ── Render ────────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f2]">
        <p className="text-gray-500">Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#1b1b1b]">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10">

        {/* Back button */}
        <div className="mb-5">
          <a
            href={dashboardUrl}
            className="inline-flex items-center gap-2 rounded-full border border-[#8bbb46] bg-white px-4 py-2 text-sm font-semibold text-[#2f641f] shadow-sm transition hover:bg-[#f0f8e8]"
          >
            ← Back to Dashboard
          </a>
        </div>

        <div className="mb-6">
          <div className="inline-flex rounded-full bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#2f641f] shadow-sm">
            Messaging
          </div>
          <h1 className="mt-4 text-3xl font-semibold uppercase tracking-[0.05em] text-[#1f2a37] md:text-5xl">
            Messages
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#334155]">
            Contact owners and renters through the platform.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

          {/* ── Left panel: conversation list ── */}
          <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-black/5">
            <div className="border-b border-black/5 px-5 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#8bbb46]">
              Conversations
            </div>
            <div className="max-h-[72vh] overflow-y-auto divide-y divide-black/5">
              {conversations.length === 0 ? (
                <div className="p-5 text-sm text-black/50">No conversations yet.</div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.booking_id}
                    onClick={() => openConversation(c.booking_id, c.other_email, c.tool_name, meRef.current)}
                    className={`w-full px-5 py-4 text-left transition ${
                      c.booking_id === selectedBookingId ? "bg-[#eef6df]" : "hover:bg-[#f8f8f5]"
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#1f2a37]">{c.tool_name}</div>
                    <div className="mt-0.5 text-xs text-black/50">{c.other_email}</div>
                    <div className="mt-1 truncate text-sm text-black/60">{c.last_message}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right panel: chat ── */}
          <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-black/5">

            {/* Header */}
            <div className="border-b border-black/5 bg-[#fbfbf8] px-6 py-5">
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8bbb46]">Chat</div>
              <div className="mt-1 text-xl font-semibold text-[#1f2a37]">
                {selectedToolName || "Select a conversation"}
              </div>
              {selectedOtherEmail && (
                <div className="mt-0.5 text-sm text-black/50">{selectedOtherEmail}</div>
              )}
            </div>

            {/* Bubbles */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#fcfcf9] p-5 md:p-6">
              {msgLoading ? (
                <p className="text-sm text-black/50">Loading…</p>
              ) : currentMessages.length === 0 ? (
                <p className="text-sm text-black/50">
                  {selectedBookingId ? "No messages yet — say hello!" : "Select a conversation to start."}
                </p>
              ) : (
                currentMessages.map((m) => {
                  // Use ref for isMe — always current, never stale
                  const isMe = m.sender_email === meRef.current;
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="mb-1 px-2 text-[11px] text-black/40">
                        {isMe ? "You" : m.sender_email}
                      </div>
                      <div className={`max-w-[80%] rounded-[20px] px-4 py-3 shadow-sm ${
                        isMe
                          ? "bg-[#8bbb46] text-white"                       // right — green (me)
                          : "bg-white text-[#1b1b1b] ring-1 ring-black/10"  // left  — grey  (them)
                      }`}>
                        <p className="text-sm leading-6">{m.message}</p>
                        <p className={`mt-1.5 text-[11px] ${isMe ? "text-white/70" : "text-black/40"}`}>
                          {new Date(m.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="border-t border-black/5 bg-white p-4 md:p-5">
              <div className="flex gap-3">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                  placeholder={selectedBookingId ? "Type a message…" : "Select a conversation first"}
                  disabled={!selectedBookingId}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#8bbb46] disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                  onClick={sendMessage}
                  disabled={!selectedBookingId || !text.trim()}
                  className="rounded-full bg-[#8bbb46] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#7aa63d] disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
