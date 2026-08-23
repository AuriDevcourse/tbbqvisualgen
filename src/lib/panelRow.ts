import { SELECTION_COLOR } from "./selectionStyle";

/**
 * One source of truth for the chrome of a layer row, shared by every list that
 * shows layers: the Layers panel, the Text panel and the Elements panel.
 *
 * WHY THIS FILE EXISTS. These three lists show the same layers. They drifted
 * apart because each one had its own copy of the row markup, and the drift was
 * measured rather than imagined (PROGRESS.md handoff 36): the left panel still
 * had bordered cards with 6px gutters, always-on 16px eye and trash buttons,
 * and a 32-char label cap, while the Layers panel had flat rows, hover-revealed
 * 24px controls and a 48-char cap. Same seven texts, two sets of rules, and one
 * list offered a destructive button the other had deliberately dropped.
 *
 * Anything that decides how a layer row LOOKS belongs here. What a row DOES is
 * each panel's own business — the Layers panel finds and orders layers, the
 * left panels edit them, and they are meant to differ in behaviour while
 * looking identical.
 */

/**
 * Row action hit box. 24px is the WCAG 2.2 AA 2.5.8 floor and CLAUDE.md r9
 * makes it a defect rather than a preference. All three lists were at 16px
 * before this; the canvas had already made the same call via `HANDLE_HIT_PX`.
 * The icon inside stays small — only the target grows.
 */
export const ACTION_BTN =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors";

/** The muted-until-hovered treatment for a row action. */
export const ACTION_BTN_IDLE = "text-white/65 hover:text-white hover:bg-white/10";

/** A row action whose state is currently ON (locked, hidden) — stays visible
 *  when the row is not hovered, so the layer is findable without sweeping the
 *  pointer down the list. */
export const ACTION_BTN_ACTIVE = "text-[#FF6B00] bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20";

/**
 * The row itself: flat, borderless, no radius of its own, 32px tall.
 *
 * Borders separate UNLIKE things, and a layer list is N alike things, so a
 * border per row competes with the one signal that matters — which row is
 * selected. Hover and selection are the only things painted, and `rounded-md`
 * makes that paint read as a highlight rather than as a card.
 */
export const ROW_BASE =
  "relative flex items-center gap-1.5 h-8 rounded-md transition-colors";

/** Painted only on hover, and only when the row is not selected. */
export const ROW_HOVER = "hover:bg-white/[0.06]";

/**
 * Selection fill, from the canvas's own selection colour so a list and the
 * canvas can never disagree about what "selected" looks like. Returned as a
 * style object rather than a Tailwind class on purpose: a static
 * `bg-[#2C7BE5]/20` would silently drift the day `SELECTION_COLOR` changes.
 */
export function rowSelectedStyle(): { backgroundColor: string } {
  return { backgroundColor: `${SELECTION_COLOR}33` };
}

/**
 * How much of a text layer's content stands in for its name when the layer has
 * no name of its own. One cap for every list — it was 24 in the Layers panel,
 * 32 in the Text panel and uncapped in the Elements panel.
 */
export const CONTENT_LABEL_CHARS = 48;
