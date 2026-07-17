import { describe, it, expect } from "vitest";
import { buildSimpleDesign, emptyForm, emptyPerson, isBlankPerson, panelShapeKey, retargetTunedDoc, type SimpleForm } from "./simpleLayout";
import type { PlatformFormat } from "@/types/template";

/**
 * Golden-layout guard for the house-standard panel: 3 speakers + 1 moderator.
 *
 * `buildSimpleDesign` is a pure function of (form, format), so this pins the
 * approved arrangement. Layer ids come from a module-level `seq` counter and
 * churn between calls, so they are stripped before snapshotting — geometry,
 * text and z-order are what define the layout.
 *
 * If a snapshot here fails, the Panel Maker's output for this case changed.
 * Re-run with `-u` ONLY after confirming the new layout is intentional.
 */

/** The canonical case: moderator + exactly 3 speakers. */
function panelOf3PlusModerator(): SimpleForm {
  const form = emptyForm();
  expect(form.includeModerator).toBe(true);
  expect(form.speakers).toHaveLength(3);
  return form;
}

type Normalized = Record<string, unknown>;

/** Round floats so trivial FP noise doesn't fail a snapshot. Ids are stable
 *  (buildSimpleDesign resets the counter) so they are pinned too. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Normalized = {};
    for (const [k, v] of Object.entries(value as Normalized)) out[k] = normalize(v);
    return out;
  }
  if (typeof value === "number") return Math.round(value * 1e4) / 1e4;
  return value;
}

const FORMATS: PlatformFormat[] = ["square", "presentation", "story"];

describe("Panel Maker — 3 speakers + 1 moderator", () => {
  it.each(FORMATS)("layout is stable for %s", (format) => {
    const doc = buildSimpleDesign(panelOf3PlusModerator(), format);
    expect(normalize(doc)).toMatchSnapshot();
  });

  it("is deterministic — same input, same geometry", () => {
    const a = buildSimpleDesign(panelOf3PlusModerator(), "square");
    const b = buildSimpleDesign(panelOf3PlusModerator(), "square");
    expect(normalize(a)).toEqual(normalize(b));
  });

  // Regression: a module-level counter meant a warm server and a fresh client
  // produced different ids for the same panel, which broke React hydration.
  // Ids must depend only on the doc — not on how many builds came before.
  it("generates identical ids no matter how many builds preceded it", () => {
    const first = buildSimpleDesign(panelOf3PlusModerator(), "square");

    // Simulate a long-lived server that has already rendered other panels.
    for (let i = 0; i < 5; i++) buildSimpleDesign(panelOf3PlusModerator(), "story");

    const later = buildSimpleDesign(panelOf3PlusModerator(), "square");
    const ids = (d: typeof first) => [
      ...d.canvasImages.map((i) => i.id),
      ...(d.design.shapes ?? []).map((s) => s.id),
    ];
    expect(ids(later)).toEqual(ids(first));
  });

  // Regression: stepping 3 -> 2 -> 3 used to truncate the speakers array and
  // pad with blanks, so the third person came back as an empty placeholder
  // card. The stash in /simple restores them; layout must then match exactly.
  it("restores the identical layout after a 3 -> 2 -> 3 round-trip", () => {
    const original = panelOf3PlusModerator();
    const before = buildSimpleDesign(original, "square");

    // Mirrors setSpeakerCount: park the dropped person, then pop them back.
    const stash = original.speakers.slice(2).filter((p) => !isBlankPerson(p));
    const dropped: SimpleForm = { ...original, speakers: original.speakers.slice(0, 2) };
    const restored: SimpleForm = { ...dropped, speakers: [...dropped.speakers, ...stash] };

    expect(restored.speakers).toHaveLength(3);
    expect(normalize(buildSimpleDesign(restored, "square"))).toEqual(normalize(before));
  });

  it("a blank re-add does NOT reproduce the panel — the stash is what saves it", () => {
    const original = panelOf3PlusModerator();
    const before = buildSimpleDesign(original, "square");

    // The old destructive behaviour: drop the person, pad with a blank.
    const naive: SimpleForm = { ...original, speakers: [...original.speakers.slice(0, 2), emptyPerson()] };
    const after = buildSimpleDesign(naive, "square");

    // Photo becomes an outlined placeholder frame — 3 headshots, not 4.
    expect(before.canvasImages).toHaveLength(4);
    expect(after.canvasImages).toHaveLength(3);
    expect(normalize(after)).not.toEqual(normalize(before));
  });
});

// Editing a field used to bin the whole hand-tuned design. These pin the rule
// that lets Panel Maker keep it: swap the words, keep the tuning.
describe("retargetTunedDoc — keeping a hand-tuned panel through a text edit", () => {
  /** Stand in for the user dragging things around in the advanced editor. */
  function tuneByHand(doc: ReturnType<typeof buildSimpleDesign>) {
    return {
      ...doc,
      design: {
        ...doc.design,
        texts: doc.design.texts.map((t) => ({ ...t, position: { x: 0.123, y: 0.456 }, fontSize: 99 })),
      },
    };
  }

  it("keeps hand-placed positions while taking the new words", () => {
    const form = panelOf3PlusModerator();
    const tuned = tuneByHand(buildSimpleDesign(form, "square"));

    const edited: SimpleForm = { ...form, subtitle: "A Totally New Subtitle" };
    const result = retargetTunedDoc(tuned, buildSimpleDesign(edited, "square"));

    expect(result).not.toBeNull();
    const subtitle = result!.design.texts.find((t) => t.simpleRole === "subtitle");
    expect(subtitle?.content).toBe("A Totally New Subtitle");
    // The tuning survives — this is the whole point.
    expect(subtitle?.position).toEqual({ x: 0.123, y: 0.456 });
    expect(subtitle?.fontSize).toBe(99);
  });

  it("retargets a speaker's title without disturbing the others", () => {
    const form = panelOf3PlusModerator();
    const tuned = tuneByHand(buildSimpleDesign(form, "square"));

    const speakers = [...form.speakers];
    speakers[1] = { ...speakers[1], title: "Head of Something Else" };
    const result = retargetTunedDoc(tuned, buildSimpleDesign({ ...form, speakers }, "square"));

    expect(result!.design.texts.find((t) => t.simpleRole === "speaker-1.title")?.content).toBe("Head of Something Else");
    expect(result!.design.texts.find((t) => t.simpleRole === "speaker-0.title")?.content).toBe(form.speakers[0].title);
    expect(result!.design.texts.every((t) => t.fontSize === 99)).toBe(true);
  });

  it("refuses when a field is cleared — that layer no longer exists", () => {
    const form = panelOf3PlusModerator();
    const tuned = tuneByHand(buildSimpleDesign(form, "square"));

    const speakers = [...form.speakers];
    speakers[0] = { ...speakers[0], company: "" };
    expect(retargetTunedDoc(tuned, buildSimpleDesign({ ...form, speakers }, "square"))).toBeNull();
  });

  it("refuses when the speaker count changes — that shape gets parked instead", () => {
    const form = panelOf3PlusModerator();
    const tuned = tuneByHand(buildSimpleDesign(form, "square"));
    const fewer: SimpleForm = { ...form, speakers: form.speakers.slice(0, 2) };

    expect(retargetTunedDoc(tuned, buildSimpleDesign(fewer, "square"))).toBeNull();
  });

  it("refuses across formats — a tuned doc carries its own canvas size", () => {
    const form = panelOf3PlusModerator();
    const tuned = tuneByHand(buildSimpleDesign(form, "square"));

    // Same people, same roles — only the canvas differs. Reusing the square
    // doc here would silently ignore the format switch.
    expect(retargetTunedDoc(tuned, buildSimpleDesign(form, "story"))).toBeNull();
  });

  // The exact sequence Auri hit: fine-tune, step 3 -> 2 -> 3, tuning must
  // come home. This mirrors the park/revive the Panel Maker page does.
  it("parks a tuned design by shape and revives it on the way back", () => {
    const form3 = panelOf3PlusModerator();
    const tuned3 = tuneByHand(buildSimpleDesign(form3, "square"));
    const parked: Record<string, typeof tuned3> = {};

    // Step down to 2 — the tuning cannot apply, so it goes on the shelf.
    const form2: SimpleForm = { ...form3, speakers: form3.speakers.slice(0, 2) };
    const rebuilt2 = buildSimpleDesign(form2, "square");
    expect(retargetTunedDoc(tuned3, rebuilt2)).toBeNull();
    parked[panelShapeKey(tuned3)] = tuned3;
    expect(parked[panelShapeKey(rebuilt2)]).toBeUndefined(); // nothing tuned for 2

    // Back up to 3 (stash restores the person) — the shape matches again.
    const rebuilt3 = buildSimpleDesign(form3, "square");
    const revived = parked[panelShapeKey(rebuilt3)];
    expect(revived).toBeDefined();

    const result = retargetTunedDoc(revived!, rebuilt3);
    expect(result).not.toBeNull();
    // The hand-tuning is back, not a regenerated layout.
    expect(result!.design.texts.every((t) => t.fontSize === 99)).toBe(true);
    expect(result!.design.texts.find((t) => t.simpleRole === "subtitle")?.position).toEqual({ x: 0.123, y: 0.456 });
  });

  it("a rebuilt panel and a tuned one share a shape key — that's what makes revival work", () => {
    const form = panelOf3PlusModerator();
    const built = buildSimpleDesign(form, "square");
    const tuned = tuneByHand(built);
    expect(panelShapeKey(tuned)).toBe(panelShapeKey(built));

    // Different shapes must NOT collide on the shelf.
    const two: SimpleForm = { ...form, speakers: form.speakers.slice(0, 2) };
    expect(panelShapeKey(buildSimpleDesign(two, "square"))).not.toBe(panelShapeKey(built));
    expect(panelShapeKey(buildSimpleDesign(form, "story"))).not.toBe(panelShapeKey(built));
  });

  it("leaves layers the user added by hand alone", () => {
    const form = panelOf3PlusModerator();
    const base = buildSimpleDesign(form, "square");
    const tuned = {
      ...base,
      design: {
        ...base.design,
        // No simpleRole — this one was added in the editor, not by the form.
        texts: [...base.design.texts, { id: "hand-made", content: "Sponsored by Acme", fontSize: 40, position: { x: 0.5, y: 0.5 } }],
      },
    };

    const result = retargetTunedDoc(tuned, buildSimpleDesign({ ...form, subtitle: "New words" }, "square"));
    expect(result!.design.texts.find((t) => t.id === "hand-made")?.content).toBe("Sponsored by Acme");
  });
});

describe("Panel Maker — 3 speakers + 1 moderator, square geometry", () => {
  // Photos are emitted as canvasImages (moderator first), not placeholder
  // shapes — the sample form carries real /samples paths.
  it("square anchors the moderator left of every speaker", () => {
    const { canvasImages } = buildSimpleDesign(panelOf3PlusModerator(), "square");
    expect(canvasImages).toHaveLength(4);

    const [moderator, ...speakers] = canvasImages;
    for (const speaker of speakers) {
      expect(moderator.x).toBeLessThan(speaker.x);
    }
  });

  it("square renders the moderator larger than the speakers", () => {
    const { canvasImages } = buildSimpleDesign(panelOf3PlusModerator(), "square");
    const [moderator, ...speakers] = canvasImages;
    const area = (s: { width: number; height: number }) => s.width * s.height;
    for (const speaker of speakers) {
      expect(area(moderator)).toBeGreaterThan(area(speaker));
    }
  });

  it("square steps the speakers rightward and upward", () => {
    const { canvasImages } = buildSimpleDesign(panelOf3PlusModerator(), "square");
    const speakers = canvasImages.slice(1);

    for (let i = 1; i < speakers.length; i++) {
      expect(speakers[i].x).toBeGreaterThan(speakers[i - 1].x);
      // Smaller y = higher on the canvas.
      expect(speakers[i].y).toBeLessThan(speakers[i - 1].y);
    }
  });

  // CanvasImage x/y are the image's CENTER, not its top-left corner.
  it.each(FORMATS)("keeps every photo inside the canvas bounds (%s)", (format) => {
    const { canvasImages } = buildSimpleDesign(panelOf3PlusModerator(), format);
    for (const img of canvasImages) {
      expect(img.x - img.width / 2).toBeGreaterThanOrEqual(0);
      expect(img.y - img.height / 2).toBeGreaterThanOrEqual(0);
      expect(img.x + img.width / 2).toBeLessThanOrEqual(1);
      expect(img.y + img.height / 2).toBeLessThanOrEqual(1);
    }
  });
});
