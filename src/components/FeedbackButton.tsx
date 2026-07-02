"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Escape closes modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (res.ok) {
        toast.success("Feedback sent — thank you!");
        setMessage("");
        setOpen(false);
      } else {
        toast.error("Failed to send feedback");
      }
    } catch {
      toast.error("Failed to send feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          onMouseDown={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/15 rounded-2xl p-5 w-[380px] shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/90">Send Feedback</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close feedback dialog"
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleSubmit();
              }}
              placeholder="What's working? What's not? Any ideas?"
              rows={4}
              autoFocus
              aria-label="Feedback message"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-white/30 transition-colors resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-white/60">⌘+Enter to send · Esc to close</span>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || sending}
                aria-label="Send feedback"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#FF0028] hover:bg-[#E00224] rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-30"
              >
                {sending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Send</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
