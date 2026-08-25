"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { MessageSquare, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FeedbackButtonProps {
  /**
   * Drive the dialog from outside and render no trigger of our own.
   *
   * The header's overflow menu needs Feedback as a menu row, but this component
   * rendered its trigger and its dialog as siblings in one fragment — put that
   * button inside a Popover and the dialog mounts inside the popover too, so
   * closing the menu unmounts the dialog you just opened. Splitting them keeps
   * the dialog in the header, where nothing can unmount it.
   *
   * Omit both and it behaves exactly as before: its own pill, its own state.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FeedbackButton({ open: openProp, onOpenChange }: FeedbackButtonProps = {}) {
  const controlled = openProp !== undefined;
  const [openSelf, setOpenSelf] = useState(false);
  const open = controlled ? openProp : openSelf;
  const setOpen = (next: boolean) => {
    if (!controlled) setOpenSelf(next);
    onOpenChange?.(next);
  };
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // `autoFocus` on the textarea is not enough when the dialog is opened FROM the
  // header's overflow menu: Radix returns focus to the popover trigger as it
  // closes, and that happens after the dialog has mounted, so it steals the
  // focus straight back. Re-assert it on the next frame, once the menu's own
  // focus restore has run.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Escape, click-outside and the focus trap are Radix Dialog's job now. The
  // hand-rolled window listener that used to live here only did Escape, and
  // the `aria-modal="true"` beside it was a promise nothing kept: every
  // control behind the overlay stayed tabbable.

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
      {!controlled && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Feedback
        </button>
      )}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            // Radix autofocuses the first tabbable child, which is the close
            // button. Point it at the textarea instead: this dialog exists to
            // be typed into, and the old code already did this by hand.
            onOpenAutoFocus={(e) => { e.preventDefault(); textareaRef.current?.focus(); }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-white/15 rounded-2xl p-5 w-[380px] shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <Dialog.Title className="text-sm font-semibold text-white/90">Send Feedback</Dialog.Title>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close feedback dialog"
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>
            <textarea
              ref={textareaRef}
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
