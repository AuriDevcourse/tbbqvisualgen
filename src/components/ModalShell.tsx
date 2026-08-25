"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * The one overlay shell. Backdrop, dialog semantics, focus and Escape.
 *
 * Why this exists: the editor had five overlays (CropDialog, FeedbackButton,
 * LogoLibraryPicker, TeamLibrary, TemplatesModal) each with its own copy of
 * `fixed inset-0` and its own subset of the behaviour. Measured before this
 * file existed:
 *
 * | overlay            | role=dialog | Escape | focus on open | focus trap |
 * |--------------------|-------------|--------|---------------|------------|
 * | CropDialog         | on backdrop | yes    | no            | **no**     |
 * | FeedbackButton     | on backdrop | yes    | yes           | **no**     |
 * | TeamLibrary        | on backdrop | **no** | no            | **no**     |
 * | LogoLibraryPicker  | **none**    | **no** | no            | **no**     |
 * | TemplatesModal     | **none**    | **no** | no            | **no**     |
 *
 * Not one of the five trapped focus, yet three of them announced
 * `aria-modal="true"` — which tells assistive tech the rest of the page is
 * inert. It was not: every button behind the overlay stayed tabbable. That is
 * the same fault as the tab strip in left-panel item 9A, and it is worse than
 * declaring nothing, because the promise is announced either way.
 *
 * So there was no correct copy to port from. Hand-fixing one modal meant
 * writing the trap from scratch anyway while the other four kept making a
 * false claim — same diff, a fifth of the coverage.
 *
 * ## Three decisions worth knowing
 *
 * **The semantics sit on the PANEL, not the backdrop.** All three of the
 * overlays that had `role="dialog"` put it on the full-screen backdrop, so the
 * dialog's accessible bounds were the whole viewport and its `aria-label`
 * labelled a decoration. The backdrop is a scrim; the panel is the dialog.
 *
 * **Keys are handled on `window`, gated on `defaultPrevented`.** TemplatesModal
 * nests three inline-rename inputs that each cancel on Escape, so a naive
 * window listener would cancel the rename *and* close the modal on one
 * keypress. Panel-level listening was tried first and is WRONG: cancelling a
 * rename unmounts the focused input, the browser drops focus to <body>, and a
 * handler on the panel then never sees another key — the dialog could not be
 * closed from the keyboard at all. Verified in a real browser; neither tsc nor
 * the unit suite catches it, and `onBlur` cannot recover it because browsers do
 * not fire focusout for an element that was removed while focused.
 *
 * Window level is safe because React attaches its handlers at the root
 * container, BELOW window, so React's handler has already run by the time this
 * one fires. The contract: an inner handler that consumes a key calls
 * `preventDefault()`, and this shell ignores an already-consumed event. That
 * also lets Tab be corralled when focus has fallen outside the panel.
 *
 * **Not the native `<dialog>` element.** `showModal()` would give the trap and
 * real inertness for free, but it promotes the element to the top layer, which
 * ignores z-index. TemplatesModal deliberately stacks a folder popover at
 * `z-[310]`/`z-[311]` above its own `z-[300]`; in the top layer that ordering
 * stops being expressible. Keeping the explicit ladder is worth writing the
 * trap by hand.
 */

/** Tabbable descendants, in DOM order. `[tabindex="-1"]` is focusable but not tabbable, so it is excluded. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /**
   * Accessible name. Prefer `titleId` when the panel already draws a heading —
   * pointing at the real heading stops the two drifting apart, which is what
   * TeamLibrary did (an `<h2>Team library</h2>` plus a duplicate aria-label).
   */
  label?: string;
  /** id of a heading rendered inside `children`. Takes precedence over `label`. */
  titleId?: string;
  /**
   * Veto hook for a close the USER asked for (backdrop click or Escape).
   * Return false to keep the dialog open — CropDialog uses this to confirm
   * discarding an edited crop. Not consulted for a programmatic close.
   */
  onRequestClose?: () => boolean;
  /** Focus this on open instead of the first tabbable child. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Where to put focus on close, when the element that had it cannot be used.
   *
   * By default the shell remembers whatever was focused on open and hands focus
   * back. That fails when the trigger does not outlive the opening: the editor
   * opens this modal from an item inside the More-actions menu, and the menu
   * closes, so the remembered button is detached and focusing it does nothing —
   * leaving focus on <body> and the next Tab starting from the top of the page.
   * A caller whose trigger is transient should point this at the stable control
   * that owns it (for Templates, the More-actions button).
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Panel classes. The caller owns its own size, padding and chrome. */
  className?: string;
  /** Backdrop classes, for overlays that want a different scrim or z-index. */
  backdropClassName?: string;
  children: ReactNode;
}

export default function ModalShell({
  open,
  onClose,
  label,
  titleId,
  onRequestClose,
  initialFocusRef,
  returnFocusRef,
  className = "",
  backdropClassName = "fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm",
  children,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  /** Whatever had focus when we opened, so it can be handed back on close. */
  const openerRef = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (onRequestClose && !onRequestClose()) return;
    onClose();
  }, [onRequestClose, onClose]);

  // Move focus in on open, hand it back on close.
  //
  // Handing it back matters as much as taking it: without this, closing the
  // modal leaves focus on <body>, so the next Tab restarts at the top of the
  // page and the user loses the button they came from.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    openerRef.current = previous instanceof HTMLElement ? previous : null;
    // Captured now, not read in the cleanup: React may have nulled the ref by
    // the time cleanup runs, and a null panel would make the "is focus still
    // ours" test below silently answer no.
    const panel = panelRef.current;

    // A frame, so the panel is laid out before we look for something to focus.
    const id = requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
      // Falls back to the panel itself (tabIndex -1) when there is nothing
      // tabbable inside, so focus is still inside the dialog rather than
      // loose on the document.
      (first ?? panel)?.focus();
    });

    return () => {
      cancelAnimationFrame(id);
      // Only if focus is still somewhere we own; if something else has since
      // taken it deliberately, stealing it back would be the bug.
      const active = document.activeElement;
      const ours = active === document.body || (active instanceof Node && panel?.contains(active));
      if (!ours) return;
      // isConnected, because a detached node accepts .focus() and silently does
      // nothing — which reads as "restore worked" while focus sits on <body>.
      const remembered = openerRef.current;
      // Read at cleanup time on purpose, so the lint warning here is a false
      // positive. The rule guards refs to nodes THIS component rendered, which
      // React may have nulled by now; returnFocusRef belongs to the caller and
      // points at a control that outlives this dialog. Capturing it when the
      // effect ran would pin a stale node if the caller re-rendered meanwhile.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const target = remembered?.isConnected ? remembered : returnFocusRef?.current;
      target?.focus();
    };
  }, [open, initialFocusRef, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      // An inner handler that consumed the key called preventDefault. Respect it:
      // Escape cancels the innermost open thing, not the whole dialog.
      if (e.defaultPrevented) return;

      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }

      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      // offsetParent filters out anything display:none — a collapsed section's
      // buttons are in the DOM and match the selector but cannot be focused.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) {
        // Nothing to move to, so Tab must not escape to the page behind.
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Focus has fallen outside the panel — typically <body>, after the element
      // that had focus was unmounted. Bring Tab back in rather than letting it
      // walk the 70-odd controls behind the dialog.
      if (!(active instanceof Node) || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      // Wrap at the ends. This is what makes aria-modal="true" true.
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  if (!open) return null;

  return (
    <div
      className={backdropClassName}
      onMouseDown={(e) => {
        // Only a press that STARTS on the backdrop is a dismiss. Without this,
        // a drag that begins inside the panel and releases outside it closes
        // the dialog — which is how CropDialog's crop handles would behave.
        if (e.target !== e.currentTarget) return;
        requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...(titleId ? { "aria-labelledby": titleId } : { "aria-label": label })}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
