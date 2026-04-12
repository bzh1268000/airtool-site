"use client";

/**
 * BookingChat
 * -----------
 * Inline, collapsible chat box scoped to a single booking_id.
 * Drop it inside any booking card — each instance is completely isolated.
 *
 * Props:
 *   bookingId  — the booking this chat belongs to
 *   myEmail    — the current user's email (from auth)
 *   otherEmail — the other party's email (owner ↔ renter)
 *   label      — optional button label (default "💬 Messages")
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type MessageRow = {
  id: number;
  booking_id: number;
  sender_email: string;
  receiver_email: string;
  message: string;
  created_at: string;
};

type Props = {
  bookingId: number;
  myEmail: string;
  otherEmail: string;
  label?: string;
};

export default function BookingChat({ bookingId, myEmail, otherEmail, label = "💬 Messages" }: Props) {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<MessageRow[]>([]);
  const [text, setText]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);
  const [unread, setUnread]       = useState(0);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const channelRef                = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Count unread on mount (badge on the closed button) ───────────────────────
  useEffect(() => {
    if (!myEmail || !bookingId) return;
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("receiver_email", myEmail)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count || 0));
  }, [bookingId, myEmail]);

  // ── Open / close ──────────────────────────────────────────────────────────────
  const openChat = async () => {
    setOpen(true);
    setLoading(true);

    // Fetch all messages for this booking
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    setMessages((data || []) as MessageRow[]);
    setLoading(false);

    // Mark incoming messages as read
    if (myEmail) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("booking_id", bookingId)
        .eq("receiver_email", myEmail)
        .eq("is_read", false);
      setUnread(0);
    }

    // Subscribe to new messages for this booking
    const channel = supabase
      .channel(`booking-chat-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as MessageRow;
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Auto mark as read if this window is open and message is for me
            if (incoming.receiver_email === myEmail) {
              supabase
                .from("messages")
                .update({ is_read: true })
                .eq("id", incoming.id)
                .then(() => {});
            }
            return [...prev, incoming];
          });
        },
      )
      .subscribe();

    channelRef.current = channel;
  };

  const closeChat = () => {
    setOpen(false);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  // ── Scroll to bottom when messages change ────────────────────────────────────
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const body = text.trim();
    if (!body || !myEmail || !otherEmail || sending) return;

    setSending(true);

    // Optimistic update
    const optimistic: MessageRow = {
      id: Date.now(),           // temp id
      booking_id: bookingId,
      sender_email: myEmail,
      receiver_email: otherEmail,
      message: body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        booking_id:     bookingId,
        sender_email:   myEmail,
        receiver_email: otherEmail,
        message:        body,
      })
      .select("id")
      .single();

    if (error) {
      // Roll back optimistic row and restore text
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(body);
    } else if (data) {
      // Replace temp id with real id
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, id: data.id } : m)),
      );
    }

    setSending(false);
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Toggle button */}
      {!open && (
        <button
          onClick={openChat}
          className="relative inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          {label}
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#8bbb46]/30 bg-white shadow-sm">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 bg-[#f8fdf3] px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8bbb46]">
                Booking #{bookingId} — Chat
              </p>
              <p className="mt-0.5 text-xs text-black/40">{otherEmail}</p>
            </div>
            <button
              onClick={closeChat}
              className="rounded-lg px-2 py-1 text-xs text-black/40 transition hover:bg-black/5 hover:text-black"
            >
              ✕ Close
            </button>
          </div>

          {/* Messages */}
          <div className="flex max-h-64 flex-col gap-2.5 overflow-y-auto bg-[#fcfcf9] p-4">
            {loading ? (
              <p className="text-xs text-black/40">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-black/40">No messages yet — say hello!</p>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_email === myEmail;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="mb-0.5 px-1 text-[10px] text-black/35">
                      {isMe ? "You" : m.sender_email}
                    </div>
                    <div className={`max-w-[85%] rounded-[16px] px-3 py-2 shadow-sm text-sm leading-5 ${
                      isMe
                        ? "bg-[#8bbb46] text-white"
                        : "bg-white text-[#1b1b1b] ring-1 ring-black/10"
                    }`}>
                      {m.message}
                      <div className={`mt-1 text-[10px] ${isMe ? "text-white/60" : "text-black/35"}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-black/5 bg-white p-3">
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-[#8bbb46]"
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                className="rounded-full bg-[#8bbb46] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#7aa63d] disabled:opacity-50"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
