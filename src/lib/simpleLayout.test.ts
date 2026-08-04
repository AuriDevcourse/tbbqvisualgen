import { describe, it, expect } from "vitest";
import { adoptLegacyPanelRoles, buildPartnerDesign, buildSalesDesign, buildSimpleDesign, bundleCoverage, dedupeSpeakerRoles, docKindOf, emptyForm, parkDoc, emptyPartnerForm, emptyPerson, emptySalesForm, formsFromDoc, isBlankPerson, mergePersonDescription, migrateLegacyPanelDoc, panelShapeKey, partnerLayoutOf, retargetPartnerLayout, retargetSalesLayout, retargetTunedDoc, salesLayoutOf, sampleFourthSpeaker, simpleExportName, stripFormsForSave, syncPanelChrome, syncPartnerChrome, thanksGridColumns, type PartnerForm, type SalesForm, type SimpleDoc, type SimpleForm } from "./simpleLayout";
import type { PlatformFormat } from "@/types/template";

/** The partner-form fields the thank-you wall introduced. Spread into the
 *  One/Two/Four literals below, which predate them and don't care. */
const PW = { logoCount: 12, headline: "Thank you to\nour partners" };

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

  it("keeps the tuned wrapping when the words are unchanged; an edit still takes the new text", () => {
    // 4→3→4 live repro: the generic 4-speaker layout wraps "Omolade Adebisi"
    // at ~14 chars, and the retarget stamped that re-wrap into the tuned
    // layer — her name broke onto two lines with no edit anywhere.
    const form = panelOf3PlusModerator();
    const built = buildSimpleDesign(form, "square");
    const tuned = {
      ...built,
      design: {
        ...built.design,
        texts: built.design.texts.map((t) =>
          t.simpleRole === "speaker-2.name" ? { ...t, content: "Omolade Adebisi" } : t),
      },
    };
    // A rebuild whose only difference is generic wrapping of the same words.
    const rewrapped = {
      ...built,
      design: {
        ...built.design,
        texts: built.design.texts.map((t) =>
          t.simpleRole === "speaker-2.name" ? { ...t, content: "Omolade\nAdebisi" } : t),
      },
    };
    const out = retargetTunedDoc(tuned, rewrapped)!;
    expect(out.design.texts.find((t) => t.simpleRole === "speaker-2.name")!.content).toBe("Omolade Adebisi");

    // A real word change still lands, generic wrapping and all.
    const edited = {
      ...rewrapped,
      design: {
        ...rewrapped.design,
        texts: rewrapped.design.texts.map((t) =>
          t.simpleRole === "speaker-2.name" ? { ...t, content: "Someone\nElse" } : t),
      },
    };
    const out2 = retargetTunedDoc(tuned, edited)!;
    expect(out2.design.texts.find((t) => t.simpleRole === "speaker-2.name")!.content).toBe("Someone\nElse");
  });

  it("a changed label refits the white chip to the new text (Auri's BBQ Stage chip)", () => {
    const form = panelOf3PlusModerator();
    const tuned = buildSimpleDesign({ ...form, label: "Meet your hosts" }, "square");
    const chipOf = (d: ReturnType<typeof buildSimpleDesign>) => (d.design.shapes ?? []).find((s) => s.simpleRole === "label.chip")!;
    const labelOf = (d: ReturnType<typeof buildSimpleDesign>) => d.design.texts.find((t) => t.simpleRole === "label")!;

    const out = retargetTunedDoc(tuned, buildSimpleDesign({ ...form, label: "BBQ Stage" }, "square"))!;
    expect(labelOf(out).content).toBe("BBQ STAGE");
    // Shorter text → narrower chip, but still longer than the text itself.
    expect(chipOf(out).width).toBeLessThan(chipOf(tuned).width);
    const textW = (labelOf(out).content.length * labelOf(out).fontSize * 0.62) / 1500;
    expect(chipOf(out).width).toBeGreaterThan(textW);
    // Left-aligned label keeps the chip's left edge.
    expect(chipOf(out).x - chipOf(out).width / 2).toBeCloseTo(chipOf(tuned).x - chipOf(tuned).width / 2, 5);

    // Unchanged label leaves the chip untouched.
    const same = retargetTunedDoc(tuned, buildSimpleDesign({ ...form, label: "Meet your hosts", subtitle: "New words" }, "square"))!;
    expect(chipOf(same).width).toBe(chipOf(tuned).width);
  });

  it("refuses when a field is cleared — that layer no longer exists", () => {
    const form = panelOf3PlusModerator();
    const tuned = tuneByHand(buildSimpleDesign(form, "square"));

    const speakers = [...form.speakers];
    speakers[0] = { ...speakers[0], title: "" };
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

  it("a BLANK extra speaker still changes the shape — the tuning must not swallow the new card", () => {
    // Auri's repro: tuned 3-speaker panel, press + (the 4th is blank). The
    // blank person has no text or photo layers, so role comparison alone saw
    // the same shape and the 3-speaker tuning rendered right over the new
    // placeholder — "the 4th speaker card doesn't appear".
    const form3 = panelOf3PlusModerator();
    const tuned3 = tuneByHand(buildSimpleDesign(form3, "square"));
    const form4: SimpleForm = { ...form3, speakers: [...form3.speakers, emptyPerson()] };
    const rebuilt4 = buildSimpleDesign(form4, "square");

    expect(panelShapeKey(rebuilt4)).not.toBe(panelShapeKey(tuned3));
    expect(retargetTunedDoc(tuned3, rebuilt4)).toBeNull();
    // And the way back still revives: dropping the blank restores the key.
    expect(panelShapeKey(buildSimpleDesign(form3, "square"))).toBe(panelShapeKey(tuned3));
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

// Replacing a photo/logo used to bin the tuned design outright ("it just
// restarted the template"). These pin the fix: a swapped image lands in the
// tuned slot; only a slot appearing/disappearing forces a rebuild.
describe("retargetTunedDoc — image swaps keep the tuned layout", () => {
  const partnerWith = (src: string): PartnerForm => ({
    ...PW,
    label: "Official Partner",
    layout: "single",
    logos: [{ src, naturalWidth: 800, naturalHeight: 400 }],
    backgroundId: "orb5",
  });

  it("carries a replaced partner logo into the tuned frame", () => {
    const built = buildPartnerDesign(partnerWith("data:logo-a"), "square");
    // Hand-tune: move the logo somewhere custom.
    const tuned = { ...built, canvasImages: built.canvasImages.map((i) => ({ ...i, x: 0.31, y: 0.27 })) };

    const result = retargetTunedDoc(tuned, buildPartnerDesign(partnerWith("data:logo-b"), "square"));
    expect(result).not.toBeNull();
    const logo = result!.canvasImages.find((i) => i.simpleRole === "logo-single")!;
    expect(logo.src).toBe("data:logo-b"); // new picture…
    expect(logo.x).toBe(0.31);            // …in the hand-placed frame
    expect(logo.naturalWidth).toBe(800);
  });

  it("carries a replaced speaker photo without touching the others", () => {
    const form = panelOf3PlusModerator();
    const tuned = buildSimpleDesign(form, "square");

    const speakers = [...form.speakers];
    speakers[1] = { ...speakers[1], photo: "/samples/replacement.jpg", naturalWidth: 10, naturalHeight: 20 };
    const result = retargetTunedDoc(tuned, buildSimpleDesign({ ...form, speakers }, "square"));

    expect(result).not.toBeNull();
    expect(result!.canvasImages.find((i) => i.simpleRole === "speaker-1.photo")?.src).toBe("/samples/replacement.jpg");
    expect(result!.canvasImages.find((i) => i.simpleRole === "speaker-0.photo")?.src).toBe(form.speakers[0].photo);
    expect(result!.canvasImages.find((i) => i.simpleRole === "moderator.photo")?.src).toBe(form.moderator.photo);
  });

  it("refuses when a photo is removed — that slot becomes a placeholder", () => {
    const form = panelOf3PlusModerator();
    const tuned = buildSimpleDesign(form, "square");
    const speakers = [...form.speakers];
    speakers[1] = { ...speakers[1], photo: "" };
    expect(retargetTunedDoc(tuned, buildSimpleDesign({ ...form, speakers }, "square"))).toBeNull();
  });

  it("refuses a single → quad logo-layout switch", () => {
    const single = buildPartnerDesign(partnerWith("data:logo-a"), "square");
    const quadForm: PartnerForm = { ...partnerWith("data:logo-a"), layout: "quad" };
    expect(retargetTunedDoc(single, buildPartnerDesign(quadForm, "square"))).toBeNull();
  });

  it("duo layout uses duo-specific roles — never shape-matches a half-filled quad", () => {
    const logos = [{ src: "data:a" }, { src: "data:b" }];
    const duo = buildPartnerDesign({ ...PW, label: "X", layout: "duo", logos, backgroundId: "orb5" }, "square");
    const halfQuad = buildPartnerDesign({ ...PW, label: "X", layout: "quad", logos, backgroundId: "orb5" }, "square");

    expect(duo.canvasImages.map((i) => i.simpleRole)).toEqual(["logo-duo-0", "logo-duo-1"]);
    expect(panelShapeKey(duo)).not.toBe(panelShapeKey(halfQuad));
    expect(retargetTunedDoc(duo, halfQuad)).toBeNull();
    // A replaced logo within duo still retargets.
    const swapped = buildPartnerDesign({ ...PW, label: "X", layout: "duo", logos: [{ src: "data:c" }, { src: "data:b" }], backgroundId: "orb5" }, "square");
    expect(retargetTunedDoc(duo, swapped)?.canvasImages.find((i) => i.simpleRole === "logo-duo-0")?.src).toBe("data:c");
  });
});

// The One/Two/Four picker must revive a tuned layout even when the number of
// uploaded logos differs from when it was tuned ("Two gives a completely
// different template" was the bug — a saved duo variant with one logo never
// exact-matched a rebuild with two).
describe("retargetPartnerLayout — same layout, different slot fill", () => {
  const duoWith = (logos: ({ src: string } | null)[]): PartnerForm =>
    ({ ...PW, label: "Official Partner", layout: "duo", logos, backgroundId: "orb5" });

  it("fills a tuned placeholder slot with the new logo at the frame's position", () => {
    const built = buildPartnerDesign(duoWith([{ src: "data:a" }, null]), "square");
    // Hand-tune: move both the filled logo and the empty frame.
    const tuned = {
      ...built,
      canvasImages: built.canvasImages.map((i) => ({ ...i, x: 0.21 })),
      design: { ...built.design, shapes: (built.design.shapes ?? []).map((s) => ({ ...s, x: 0.83 })) },
    };
    const rebuilt = buildPartnerDesign(duoWith([{ src: "data:a" }, { src: "data:b" }]), "square");
    expect(retargetTunedDoc(tuned, rebuilt)).toBeNull(); // exact path refuses…
    const result = retargetPartnerLayout(tuned, rebuilt, "duo");
    expect(result).not.toBeNull(); // …the layout path reconciles
    const slot1 = result!.canvasImages.find((i) => i.simpleRole === "logo-duo-1")!;
    expect(slot1.src).toBe("data:b");
    expect(slot1.x).toBe(0.83); // the hand-placed frame position
    expect(result!.canvasImages.find((i) => i.simpleRole === "logo-duo-0")?.x).toBe(0.21);
    // The consumed placeholder frame is gone.
    expect((result!.design.shapes ?? []).filter((s) => s.fillType === "outline")).toHaveLength(0);
  });

  it("turns a cleared slot's tuned image back into a placeholder frame", () => {
    const built = buildPartnerDesign(duoWith([{ src: "data:a" }, { src: "data:b" }]), "square");
    const tuned = { ...built, canvasImages: built.canvasImages.map((i) => ({ ...i, y: 0.66 })) };
    const rebuilt = buildPartnerDesign(duoWith([{ src: "data:a" }, null]), "square");
    const result = retargetPartnerLayout(tuned, rebuilt, "duo");
    expect(result).not.toBeNull();
    expect(result!.canvasImages.map((i) => i.simpleRole)).toEqual(["logo-duo-0"]);
    const frame = (result!.design.shapes ?? []).find((s) => s.fillType === "outline")!;
    expect(frame.y).toBe(0.66); // frame keeps the cleared image's tuned spot
  });

  it("refuses a different layout, format or a hand-deleted frame", () => {
    const duo = buildPartnerDesign(duoWith([{ src: "data:a" }, null]), "square");
    const quad = buildPartnerDesign({ ...PW, label: "Official Partner", layout: "quad", logos: [{ src: "data:a" }], backgroundId: "orb5" }, "square");
    expect(retargetPartnerLayout(duo, quad, "quad")).toBeNull();
    const wide = buildPartnerDesign(duoWith([{ src: "data:a" }, { src: "data:b" }]), "presentation");
    expect(retargetPartnerLayout(duo, wide, "duo")).toBeNull();
    // Placeholder frame hand-deleted in the editor → mapping would be a guess.
    const noFrame = { ...duo, design: { ...duo.design, shapes: (duo.design.shapes ?? []).filter((s) => s.fillType !== "outline") } };
    const rebuilt = buildPartnerDesign(duoWith([{ src: "data:a" }, { src: "data:b" }]), "square");
    expect(retargetPartnerLayout(noFrame, rebuilt, "duo")).toBeNull();
  });

  // Auditor repro: the replacement frame for a cleared slot is APPENDED to
  // shapes, so an array-order placeholder mapping scrambled after one
  // clear-then-fill cycle — slot 2's new logo landed in slot 3's cell. Role
  // tags on the frames pin each one to its slot.
  it("keeps quad logos in their own cells through clear-then-fill cycles", () => {
    const quadWith = (logos: ({ src: string } | null)[]): PartnerForm =>
      ({ ...PW, label: "Official Partner", layout: "quad", logos, backgroundId: "orb5" });
    const cellOf = (doc: ReturnType<typeof buildPartnerDesign>, role: string) => {
      const i = doc.canvasImages.find((x) => x.simpleRole === role)!;
      return [i.x, i.y];
    };
    const built = buildPartnerDesign(quadWith([{ src: "data:a" }, null, { src: "data:c" }, null]), "square");
    const slot2Cell = cellOf(built, "logo-2");
    // fill slot 1 → clear slot 2 → fill slot 2 again
    const a = retargetPartnerLayout(built, buildPartnerDesign(quadWith([{ src: "data:a" }, { src: "data:b" }, { src: "data:c" }, null]), "square"), "quad");
    expect(a).not.toBeNull();
    const b = retargetPartnerLayout(a!, buildPartnerDesign(quadWith([{ src: "data:a" }, { src: "data:b" }, null, null]), "square"), "quad");
    expect(b).not.toBeNull();
    const c = retargetPartnerLayout(b!, buildPartnerDesign(quadWith([{ src: "data:a" }, { src: "data:b" }, { src: "data:c2" }, null]), "square"), "quad");
    expect(c).not.toBeNull();
    // The refilled logo is back in slot 2's cell — not slot 3's.
    expect(cellOf(c!, "logo-2")).toEqual(slot2Cell);
    expect(c!.canvasImages.find((x) => x.simpleRole === "logo-2")?.src).toBe("data:c2");
    // And the one remaining frame is slot 3's, still tagged as such.
    const frames = (c!.design.shapes ?? []).filter((s) => s.fillType === "outline");
    expect(frames.map((s) => s.simpleRole)).toEqual(["logo-3"]);
  });

  it("pluralizes a label ending in 'partner' on multi-logo layouts", () => {
    const base = { ...PW, label: "Official Partner", logos: [{ src: "data:a" }], backgroundId: "orb5" };
    const labelOf = (doc: ReturnType<typeof buildPartnerDesign>) =>
      doc.design.texts.find((t) => t.simpleRole === "label")?.content;
    expect(labelOf(buildPartnerDesign({ ...base, layout: "single" }, "square"))).toBe("OFFICIAL PARTNER");
    expect(labelOf(buildPartnerDesign({ ...base, layout: "duo" }, "square"))).toBe("OFFICIAL PARTNERS");
    expect(labelOf(buildPartnerDesign({ ...base, layout: "quad" }, "square"))).toBe("OFFICIAL PARTNERS");
    // Labels not ending in "partner" are left alone.
    expect(labelOf(buildPartnerDesign({ ...base, label: "Partner Announcement", layout: "quad" }, "square"))).toBe("PARTNER ANNOUNCEMENT");
  });

  it("never touches panel docs", () => {
    const panel = buildSimpleDesign(panelOf3PlusModerator(), "square");
    expect(partnerLayoutOf(panel)).toBeNull();
    const rebuilt = buildPartnerDesign(duoWith([{ src: "data:a" }, { src: "data:b" }]), "square");
    expect(retargetPartnerLayout(panel, rebuilt, "duo")).toBeNull();
  });
});

// The parked shelf trims from the front (oldest first), so parkDoc must keep
// insertion order = touch recency: re-parking a doc the user returns to moves
// it to the end, out of eviction range. Without this, the chrome sync's
// auto-parked layout-tour docs silently evicted the hand-tuned design.
describe("parkDoc — touch recency protects the tuned design from eviction", () => {
  it("re-parking moves a doc to the end, so a size trim never drops it", () => {
    const CAP = 6;
    // Distinct shape keys need distinct (layout × format) combos — the key
    // reads roles, not content, so same-shape docs share one slot.
    const doc = (layout: PartnerForm["layout"], format: PlatformFormat) =>
      buildPartnerDesign({ ...PW, label: "X", layout, logos: [{ src: "data:l" }], backgroundId: "orb5" }, format);
    const tuned = doc("single", "square");
    let shelf: Record<string, ReturnType<typeof buildPartnerDesign>> = {};
    shelf = parkDoc(shelf, tuned); // first in — the eviction candidate
    // A layout/format tour auto-parks chrome-only docs under distinct keys.
    const tour: [PartnerForm["layout"], PlatformFormat][] = [
      ["duo", "square"], ["quad", "square"], ["single", "presentation"], ["duo", "presentation"], ["quad", "presentation"],
    ];
    for (const [l, f] of tour) shelf = parkDoc(shelf, doc(l, f));
    // The user comes back to their design — it must move out of range…
    shelf = parkDoc(shelf, tuned);
    shelf = parkDoc(shelf, doc("single", "story"));
    const trimmed = Object.fromEntries(Object.entries(shelf).slice(-CAP));
    expect(Object.keys(shelf)).toHaveLength(7);
    expect(trimmed[panelShapeKey(tuned)]).toBeDefined();
    // …and the stalest untouched entry is the one dropped instead.
    expect(trimmed[panelShapeKey(doc("duo", "square"))]).toBeUndefined();
  });
});

// One/Two/Four of the same format share their chrome — label position, hand-
// drawn decorations, TechBBQ logo settings — so tuning them once holds across
// layout switches (Auri's "should stay in the same place").
describe("syncPartnerChrome — shared chrome across layouts of one format", () => {
  const pf = (layout: PartnerForm["layout"], logos: ({ src: string } | null)[]): PartnerForm =>
    ({ ...PW, label: "Official Partner", layout, logos, backgroundId: "orb5" });
  const line = { id: "line-1", type: "line" as const, x: 0.5, y: 0.69, width: 0.4, height: 0.006, fillType: "fill" as const, strokeWidth: 0, colorType: "solid" as const, color1: "#FFF", color2: "#FFF", opacity: 1, blur: 0, rotation: 0 };

  it("carries label position/style, decorations and logo settings; keeps target slots and content", () => {
    const built = buildPartnerDesign(pf("single", [{ src: "data:a" }]), "square");
    // Hand-tune: move the label, delete the chip, add a line, drag the logo.
    const from = {
      ...built,
      design: {
        ...built.design,
        texts: built.design.texts.map((t) => (t.simpleRole === "label" ? { ...t, position: { x: 0.5, y: 0.067 }, fontSize: 44 } : t)),
        shapes: [line],
        logoCustomPosition: { x: 0.5, y: 0.93 },
        logoScale: 1.2,
      },
    };
    const to = buildPartnerDesign(pf("duo", [{ src: "data:a" }, null]), "square");
    const synced = syncPartnerChrome(from, to);
    const label = synced.design.texts.find((t) => t.simpleRole === "label")!;
    expect(label.position).toEqual({ x: 0.5, y: 0.067 });
    expect(label.fontSize).toBe(44);
    expect(label.content).toBe("OFFICIAL PARTNERS"); // target's plural, not from's
    // The line came across; the fresh chip did not survive (chrome is
    // last-touched-wins and `from` had deleted it).
    expect((synced.design.shapes ?? []).filter((s) => s.type === "line")).toHaveLength(1);
    expect((synced.design.shapes ?? []).some((s) => s.fillType === "fill" && s.color1 === "#FFFFFF")).toBe(false);
    // Target's slot layout intact: one image + one placeholder frame.
    expect(synced.canvasImages.map((i) => i.simpleRole)).toEqual(["logo-duo-0"]);
    expect((synced.design.shapes ?? []).filter((s) => s.fillType === "outline")).toHaveLength(1);
    expect(synced.design.logoCustomPosition).toEqual({ x: 0.5, y: 0.93 });
    expect(synced.design.logoScale).toBe(1.2);
  });

  it("a panel doc being left never leaks its role words into a partner doc", () => {
    // Live bug: switching Panel -> Partner at the same format ran the sync
    // with `from` still being the panel doc, floating MODERATOR/SPEAKER words
    // over the partner design.
    const panel = buildSimpleDesign(emptyForm(), "story");
    const partner = buildPartnerDesign({ ...PW, label: "Official Community Partner", layout: "single", logos: [], backgroundId: "orb7" }, "story");
    expect(syncPartnerChrome(panel, partner)).toBe(partner);
    expect(syncPartnerChrome(partner, panel)).toBe(panel); // reverse direction guarded too

    // Docs contaminated before this guard heal on load: the migration strips
    // the leaked words from partner docs, and only from partner docs.
    const contaminated = {
      ...partner,
      design: { ...partner.design, texts: [...partner.design.texts, { id: "leak", content: "MODERATOR", fontSize: 29, position: { x: 0.1, y: 0.5 } }] },
    };
    const healed = migrateLegacyPanelDoc(contaminated);
    expect(healed.design.texts.some((t) => t.content === "MODERATOR")).toBe(false);
    expect(migrateLegacyPanelDoc(panel).design.texts.some((t) => t.content === "MODERATOR")).toBe(true);
  });

  it("returns the target untouched across formats", () => {
    const from = buildPartnerDesign(pf("single", [{ src: "data:a" }]), "square");
    const to = buildPartnerDesign(pf("duo", [{ src: "data:a" }, null]), "presentation");
    expect(syncPartnerChrome(from, to)).toBe(to);
  });
});

describe("bundleCoverage — what a template consists of", () => {
  it("reads the layout from placeholder frames when no logo is uploaded", () => {
    const empty = buildPartnerDesign({ ...PW, label: "X", layout: "duo", logos: [], backgroundId: "orb5" }, "square");
    expect(empty.canvasImages).toHaveLength(0);
    expect(partnerLayoutOf(empty)).toBe("duo");
    expect(bundleCoverage([empty])).toEqual([{ format: "square", layout: "duo" }]);
  });

  it("lists distinct format × layout combos, panel docs as format-only", () => {
    const logos = [{ src: "data:a" }];
    const single = buildPartnerDesign({ ...PW, label: "X", layout: "single", logos, backgroundId: "orb5" }, "square");
    const duo = buildPartnerDesign({ ...PW, label: "X", layout: "duo", logos, backgroundId: "orb5" }, "square");
    const duoAgain = buildPartnerDesign({ ...PW, label: "X", layout: "duo", logos: [{ src: "data:b" }], backgroundId: "orb5" }, "square");
    const panel = buildSimpleDesign(panelOf3PlusModerator(), "presentation");
    expect(bundleCoverage([single, duo, duoAgain, panel])).toEqual([
      { format: "square", layout: "single" },
      { format: "square", layout: "duo" },
      { format: "presentation", layout: null },
    ]);
  });
});

// Loading a library doc must put the sidebar in the matching state — the
// template toggle AND the form fields ("loads a partner doc, still shows the
// Panel form" was the bug).
describe("formsFromDoc — restoring the sidebar for a loaded doc", () => {
  it("reconstructs a legacy partner form from role-tagged layers", () => {
    const pf: PartnerForm = { ...PW, label: "Official Partner", layout: "single", logos: [{ src: "data:logo", naturalWidth: 640, naturalHeight: 320 }], backgroundId: "orb3" };
    const doc = buildPartnerDesign(pf, "square");

    const restored = formsFromDoc("partner", doc);
    expect(restored.template).toBe("partner");
    expect(restored.form).toBeNull(); // panel side untouched
    expect(restored.partner!.layout).toBe("single");
    expect(restored.partner!.logos[0]?.src).toBe("data:logo");
    expect(restored.partner!.label).toBe("OFFICIAL PARTNER"); // docs store the rendered (uppercased) label
    expect(restored.partner!.backgroundId).toBe("orb3");
  });

  it("reconstructs a duo partner form from duo roles", () => {
    const pf: PartnerForm = { ...PW, label: "Partners", layout: "duo", logos: [{ src: "data:l" }, { src: "data:r" }], backgroundId: "orb5" };
    const restored = formsFromDoc("partner", buildPartnerDesign(pf, "square"));
    expect(restored.partner!.layout).toBe("duo");
    expect(restored.partner!.logos.map((l) => l?.src)).toEqual(["data:l", "data:r"]);
  });

  it("keeps ALL partner logo slots through a save/load round-trip — not just the active layout's", () => {
    // Single layout active, but slots 0–1 filled (the user also set up Two).
    const pf: PartnerForm = { ...PW, label: "Official Partner", layout: "single", logos: [{ src: "data:one" }, { src: "data:two" }], backgroundId: "orb5" };
    const doc = buildPartnerDesign(pf, "square"); // carries only logo-single
    const snap = stripFormsForSave("partner", emptyForm(), pf);
    expect(snap.partner!.logos.map((l) => l?.src)).toEqual(["data:one", "data:two"]); // logos survive saving

    const restored = formsFromDoc("partner", doc, snap);
    expect(restored.partner!.layout).toBe("single");
    // Flipping to Two after loading must find slot 1 still filled.
    expect(restored.partner!.logos.map((l) => l?.src)).toEqual(["data:one", "data:two"]);
  });

  it("prefers the saved snapshot and rehydrates the stripped photos from the doc", () => {
    const form = panelOf3PlusModerator();
    const doc = buildSimpleDesign(form, "square");
    const snap = stripFormsForSave("panel", form, emptyPartnerForm());
    expect(snap.form!.moderator.photo).toBe(""); // stripped for the payload

    const restored = formsFromDoc("panel", doc, snap);
    expect(restored.template).toBe("panel");
    expect(restored.partner).toBeNull();
    expect(restored.form!.moderator.photo).toBe(form.moderator.photo); // back from the doc
    expect(restored.form!.speakers[2].name).toBe(form.speakers[2].name);
    expect(restored.form!.speakers[1].photo).toBe(form.speakers[1].photo);
  });

  it("reconstructs a legacy panel form (no snapshot) from text + photo roles", () => {
    const form = panelOf3PlusModerator();
    const doc = buildSimpleDesign(form, "square");

    const restored = formsFromDoc("panel", doc);
    expect(restored.form!.headline).toBe(form.headline);
    expect(restored.form!.includeModerator).toBe(true);
    expect(restored.form!.speakers).toHaveLength(3);
    expect(restored.form!.speakers[1].photo).toBe(form.speakers[1].photo);
    expect(restored.form!.moderator.name).toBe(form.moderator.name);
  });
});

describe("adoptLegacyPanelRoles — pre-role library docs get their photo roles back", () => {
  /** A doc as saved before 2026-07-22: same layers, but no simpleRole on any
   *  photo. `panelShapeKey` can never match a rebuild for such a doc, which
   *  strands its tuning on the parked shelf (live bug: "Panel with 4 People",
   *  speaker count 3 -> 2 -> 3 came back as the generic layout). */
  const legacyOf = (form: SimpleForm, format: PlatformFormat = "square") => {
    const doc = buildSimpleDesign(form, format);
    return {
      doc,
      legacy: { ...doc, canvasImages: doc.canvasImages.map((img) => ({ ...img, simpleRole: undefined })) },
    };
  };

  it("re-tags role-less panel photos in person order (moderator first)", () => {
    const { doc, legacy } = legacyOf(panelOf3PlusModerator());
    expect(panelShapeKey(legacy)).not.toBe(panelShapeKey(doc)); // the stranding
    const migrated = adoptLegacyPanelRoles(legacy);
    expect(migrated.canvasImages.map((i) => i.simpleRole)).toEqual(doc.canvasImages.map((i) => i.simpleRole));
    expect(panelShapeKey(migrated)).toBe(panelShapeKey(doc));
  });

  it("makes the 3 -> 2 -> 3 revival work for a loaded legacy item (the live repro)", () => {
    const { legacy } = legacyOf(panelOf3PlusModerator());
    const migrated = adoptLegacyPanelRoles(legacy);
    // Load: the sidebar photos rehydrate (they didn't for role-less docs)…
    const { form } = formsFromDoc("panel", migrated);
    expect(form!.moderator.photo).not.toBe("");
    expect(form!.speakers.every((s) => s.photo !== "")).toBe(true);
    // …so a rebuild from that form reproduces the parked key, and the tuned
    // doc comes home instead of being replaced by the generic layout.
    const rebuilt = buildSimpleDesign(form!, "square");
    expect(panelShapeKey(rebuilt)).toBe(panelShapeKey(migrated));
    expect(retargetTunedDoc(migrated, rebuilt)).not.toBeNull();
  });

  it("leaves docs that already carry roles untouched", () => {
    const doc = buildSimpleDesign(panelOf3PlusModerator(), "square");
    expect(adoptLegacyPanelRoles(doc)).toBe(doc);
  });

  it("leaves partner docs untouched — even legacy ones with role-less logos", () => {
    const pf: PartnerForm = { ...PW, label: "Official Partner", layout: "single", logos: [{ src: "data:logo" }], backgroundId: "orb3" };
    const doc = buildPartnerDesign(pf, "square");
    const legacy = { ...doc, canvasImages: doc.canvasImages.map((img) => ({ ...img, simpleRole: undefined })) };
    // No person text roles -> nothing to map onto; must stay untouched.
    expect(adoptLegacyPanelRoles(legacy).canvasImages.every((i) => !i.simpleRole)).toBe(true);
  });

  it("refuses when the image count doesn't match the person count (hand-added or missing photos)", () => {
    const { legacy } = legacyOf(panelOf3PlusModerator());
    const short = { ...legacy, canvasImages: legacy.canvasImages.slice(1) };
    expect(adoptLegacyPanelRoles(short).canvasImages.every((i) => !i.simpleRole)).toBe(true);
  });
});

describe("description merge — one field replaces title + company", () => {
  it("mergePersonDescription folds company into the description; no-op without one", () => {
    expect(mergePersonDescription({ name: "A", title: "Principal", company: "Lightrock", photo: "" }))
      .toEqual({ name: "A", title: "Principal, Lightrock", company: "", photo: "" });
    expect(mergePersonDescription({ name: "B", title: "", company: "Molten", photo: "" }).title).toBe("Molten");
    const clean = { name: "C", title: "CEO, Acme", company: "", photo: "" };
    expect(mergePersonDescription(clean)).toBe(clean);
  });

  it("a pre-merge doc keeps matching its rebuild after migration (no re-strand)", () => {
    // Simulate a doc saved when the builder emitted separate title+company
    // layers: build from a two-field form (the OLD emptyForm shape).
    const twoField = panelOf3PlusModerator();
    const legacyForm: SimpleForm = {
      ...twoField,
      moderator: { ...twoField.moderator, title: "Managing Director", company: "Stifel" },
      speakers: twoField.speakers.map((s, i) => ({ ...s, title: `Role ${i}`, company: `Firm ${i}` })),
    };
    const legacyDoc = buildSimpleDesign(legacyForm, "square");
    expect(legacyDoc.design.texts.some((t) => t.simpleRole === "moderator.company")).toBe(true);

    const migrated = migrateLegacyPanelDoc(legacyDoc);
    // Company layers folded into the title layers, content kept as a new line.
    expect(migrated.design.texts.some((t) => t.simpleRole?.endsWith(".company"))).toBe(false);
    expect(migrated.design.texts.find((t) => t.simpleRole === "moderator.title")!.content).toBe("Managing Director,\nStifel");

    // The restored single-field form rebuilds to the SAME shape key, so the
    // tuned doc revives instead of stranding (round-8 bug class).
    const { form } = formsFromDoc("panel", migrated);
    // The doc merge keeps the company as its own visual line via ",\n" — so
    // the form's newline-to-space flatten keeps the comma. A plain "\n" join
    // would silently eat it ("Managing Director Stifel"), auditor catch.
    expect(form!.moderator.title).toBe("Managing Director, Stifel");
    expect(form!.moderator.company).toBe("");
    const rebuilt = buildSimpleDesign(form!, "square");
    expect(panelShapeKey(rebuilt)).toBe(panelShapeKey(migrated));
    expect(retargetTunedDoc(migrated, rebuilt)).not.toBeNull();
  });

  it("a company-only person's layer is re-roled to .title, and current docs pass through untouched", () => {
    const base = panelOf3PlusModerator();
    const companyOnly: SimpleForm = {
      ...base,
      speakers: [{ ...base.speakers[0], title: "", company: "Lightrock" }, ...base.speakers.slice(1)],
    };
    const migrated = migrateLegacyPanelDoc(buildSimpleDesign(companyOnly, "square"));
    const t = migrated.design.texts.find((x) => x.simpleRole === "speaker-0.title");
    expect(t?.content).toBe("Lightrock");

    const current = buildSimpleDesign(panelOf3PlusModerator(), "square");
    expect(migrateLegacyPanelDoc(current)).toBe(current);
  });
});

describe("host headline singular/plural", () => {
  it("HOSTS <-> HOST follows the count on moderator-less forms; real copy passes through", () => {
    const base: SimpleForm = { ...emptyForm(), includeModerator: false, headline: "HOSTS", label: "BBQ Stage" };
    const headlineOf = (form: SimpleForm) =>
      buildSimpleDesign(form, "presentation").design.texts.find((t) => t.simpleRole === "headline")!.content;
    expect(headlineOf({ ...base, speakers: base.speakers.slice(0, 1) })).toBe("HOST");
    expect(headlineOf({ ...base, speakers: base.speakers.slice(0, 2) })).toBe("HOSTS");
    // Typed lowercase/singular also normalizes by count.
    expect(headlineOf({ ...base, headline: "host", speakers: base.speakers.slice(0, 2) })).toBe("HOSTS");
    // Real headlines are untouched, and panels with a moderator are too.
    expect(headlineOf({ ...base, headline: "AI in 2026", speakers: base.speakers.slice(0, 1) })).toBe("AI in 2026");
    expect(headlineOf({ ...base, includeModerator: true, speakers: base.speakers.slice(0, 1) })).toBe("HOSTS");
  });
});

describe("dedupeSpeakerRoles — editor-cloned layers get fresh speaker indices", () => {
  it("renumbers a cloned name+title pair to ONE new speaker; the doc becomes matchable again", () => {
    // Auri's live corruption: Omolade's texts duplicated (⌘D keeps the role),
    // so speaker-2.name/title existed twice and no rebuild could ever match.
    const base = buildSimpleDesign(panelOf3PlusModerator(), "square");
    const s2name = base.design.texts.find((t) => t.simpleRole === "speaker-2.name")!;
    const s2title = base.design.texts.find((t) => t.simpleRole === "speaker-2.title")!;
    const corrupt = {
      ...base,
      design: { ...base.design, texts: [...base.design.texts,
        { ...s2name, id: "clone-n", position: { x: 0.82, y: 0.5 } },
        { ...s2title, id: "clone-t", position: { x: 0.82, y: 0.53 } }] },
    };

    const fixed = dedupeSpeakerRoles(corrupt);
    const roles = fixed.design.texts.map((t) => t.simpleRole).filter(Boolean);
    expect(new Set(roles).size).toBe(roles.length); // unique again
    expect(fixed.design.texts.find((t) => t.id === "clone-n")!.simpleRole).toBe("speaker-3.name");
    expect(fixed.design.texts.find((t) => t.id === "clone-t")!.simpleRole).toBe("speaker-3.title");
    // Originals untouched, clones keep their hand-placed positions.
    expect(fixed.design.texts.find((t) => t.id === s2name.id)!.simpleRole).toBe("speaker-2.name");
    expect(fixed.design.texts.find((t) => t.id === "clone-n")!.position.x).toBe(0.82);
  });

  it("a duplicated moderator layer loses its role instead of renumbering", () => {
    const base = buildSimpleDesign(panelOf3PlusModerator(), "square");
    const modName = base.design.texts.find((t) => t.simpleRole === "moderator.name")!;
    const fixed = dedupeSpeakerRoles({
      ...base,
      design: { ...base.design, texts: [...base.design.texts, { ...modName, id: "clone-m" }] },
    });
    expect(fixed.design.texts.find((t) => t.id === "clone-m")!.simpleRole).toBeUndefined();
    expect(fixed.design.texts.find((t) => t.id === modName.id)!.simpleRole).toBe("moderator.name");
  });

  it("clean docs and partner docs pass through by reference", () => {
    const clean = buildSimpleDesign(panelOf3PlusModerator(), "square");
    expect(dedupeSpeakerRoles(clean)).toBe(clean);
    const pf: PartnerForm = { ...PW, label: "X", layout: "duo", logos: [{ src: "data:l" }, { src: "data:r" }], backgroundId: "orb5" };
    const partner = buildPartnerDesign(pf, "square");
    expect(dedupeSpeakerRoles(partner)).toBe(partner);
  });

  it("sampleFourthSpeaker fills the shape a rebuild expects — no blank-frame mismatch", () => {
    const base = panelOf3PlusModerator();
    const form4: SimpleForm = { ...base, speakers: [...base.speakers, sampleFourthSpeaker()] };
    const doc = buildSimpleDesign(form4, "square");
    expect(doc.canvasImages.some((i) => i.simpleRole === "speaker-3.photo")).toBe(true);
    expect(doc.design.texts.find((t) => t.simpleRole === "speaker-3.name")?.content).toBe("Rajeev Kumal");
    expect(doc.design.texts.find((t) => t.simpleRole === "speaker-3.title")?.content).toContain("CTO at 88 Angle");
  });
});

describe("simpleExportName — saved-image naming convention", () => {
  it("format first, then template, then the panel headline", () => {
    expect(simpleExportName("panel", "square", "Continuation Capital\n& Venture Secondaries:")).toBe("1x1 - Panel - Continuation Capital & Venture Secondaries");
    expect(simpleExportName("panel", "presentation", "AI in 2026")).toBe("16x9 - Panel - AI in 2026");
    expect(simpleExportName("panel", "story", "")).toBe("9x16 - Panel");
    expect(simpleExportName("partner", "presentation", "ignored")).toBe("16x9 - Partner Announcement");
    expect(simpleExportName("partner", "presentation", "ignored", undefined, "thanks")).toBe("16x9 - Thank You Partners");
  });

  it("strips characters that break file names", () => {
    expect(simpleExportName("panel", "square", 'What: "AI/ML" <Now?>')).toBe("1x1 - Panel - What AIML Now");
  });
});

describe("builder — moderator card and header identical for 1..4 speakers", () => {
  const withSpeakers = (n: number, headline = ""): SimpleForm => {
    const base = panelOf3PlusModerator();
    const spk = base.speakers[0];
    return {
      ...base,
      ...(headline ? { headline } : {}),
      speakers: Array.from({ length: n }, (_, i) => base.speakers[i] ?? { ...spk, name: `Extra ${i}` }),
    };
  };
  const geom = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => ({ x, y, width, height });
  const header = (form: SimpleForm, format: PlatformFormat) => {
    const doc = buildSimpleDesign(form, format);
    return {
      texts: doc.design.texts
        .filter((t) => ["headline", "subtitle", "label"].includes(t.simpleRole ?? ""))
        .map((t) => ({ role: t.simpleRole, position: t.position, fontSize: t.fontSize })),
      chip: (doc.design.shapes ?? []).filter((s) => s.simpleRole === "label.chip").map(geom),
    };
  };
  const moderatorCard = (form: SimpleForm, format: PlatformFormat) =>
    geom(buildSimpleDesign(form, format).canvasImages.find((i) => i.simpleRole === "moderator.photo")!);

  it.each(FORMATS)("moderator photo geometry is count-independent on %s", (format) => {
    const ref = moderatorCard(withSpeakers(1), format);
    for (const n of [2, 3, 4]) expect(moderatorCard(withSpeakers(n), format)).toEqual(ref);
  });

  it("pins the short-header 16:9 case — the un-capped moderator used to shrink at 4 speakers", () => {
    // A one-line headline leaves the people band tall enough that the old
    // per-count unit math produced a DIFFERENT moderator width for 4 speakers.
    const ref = moderatorCard(withSpeakers(1, "Hi"), "presentation");
    for (const n of [2, 3, 4]) expect(moderatorCard(withSpeakers(n, "Hi"), "presentation")).toEqual(ref);
  });

  it.each(FORMATS)("header block (headline, subtitle, label + chip) is count-independent on %s", (format) => {
    const ref = header(withSpeakers(1), format);
    for (const n of [2, 3, 4]) expect(header(withSpeakers(n), format)).toEqual(ref);
  });
});

describe("syncPanelChrome — header + moderator follow the user across speaker counts", () => {
  const form3 = panelOf3PlusModerator();
  const form2: SimpleForm = { ...form3, speakers: form3.speakers.slice(0, 2) };

  /** Hand-tune: drag the label + chip up, the headline down, the moderator
   *  photo to the top-right, and drag the MODERATOR word onto it. */
  const tune = (doc: ReturnType<typeof buildSimpleDesign>) => ({
    ...doc,
    canvasImages: doc.canvasImages.map((i) =>
      i.simpleRole === "moderator.photo" ? { ...i, x: 0.77, y: 0.31, width: 0.25, height: 0.3 } : i),
    design: {
      ...doc.design,
      texts: doc.design.texts.map((t) =>
        t.simpleRole === "label" ? { ...t, position: { x: 0.5, y: 0.05 } }
        : t.simpleRole === "headline" ? { ...t, position: { ...t.position, y: 0.62 } }
        : !t.simpleRole && t.content === "MODERATOR" ? { ...t, position: { x: 0.68, y: 0.44 } }
        : t),
      shapes: (doc.design.shapes ?? []).map((s) =>
        s.simpleRole === "label.chip" ? { ...s, x: 0.55, y: 0.05 } : s),
    },
  });

  it("carries header, chip, MODERATOR word and moderator geometry; leaves speakers alone", () => {
    const from = tune(buildSimpleDesign(form3, "square"));
    const to = buildSimpleDesign(form2, "square");
    const out = syncPanelChrome(from, to);

    const byRole = (r: string) => out.design.texts.find((t) => t.simpleRole === r)!;
    expect(byRole("label").position).toEqual({ x: 0.5, y: 0.05 });
    expect(byRole("headline").position.y).toBe(0.62);
    expect((out.design.shapes ?? []).find((s) => s.simpleRole === "label.chip")!.x).toBe(0.55);

    const mod = out.canvasImages.find((i) => i.simpleRole === "moderator.photo")!;
    expect({ x: mod.x, y: mod.y, width: mod.width, height: mod.height }).toEqual({ x: 0.77, y: 0.31, width: 0.25, height: 0.3 });
    expect(mod.src).toBe(to.canvasImages.find((i) => i.simpleRole === "moderator.photo")!.src);

    const modWords = out.design.texts.filter((t) => !t.simpleRole && t.content === "MODERATOR");
    expect(modWords).toHaveLength(1);
    expect(modWords[0].position).toEqual({ x: 0.68, y: 0.44 });

    // Speakers stay the target's own — geometry and captions untouched.
    for (const img of to.canvasImages.filter((i) => i.simpleRole?.startsWith("speaker-"))) {
      expect(out.canvasImages.find((i) => i.id === img.id)).toEqual(img);
    }
    // No id collisions introduced.
    const ids = out.design.texts.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a deleted MODERATOR word or chip stays deleted", () => {
    const from = buildSimpleDesign(form3, "square");
    const stripped = {
      ...from,
      design: {
        ...from.design,
        texts: from.design.texts.filter((t) => t.simpleRole || t.content !== "MODERATOR"),
        shapes: (from.design.shapes ?? []).filter((s) => s.simpleRole !== "label.chip"),
      },
    };
    const out = syncPanelChrome(stripped, buildSimpleDesign(form2, "square"));
    expect(out.design.texts.some((t) => !t.simpleRole && t.content === "MODERATOR")).toBe(false);
    expect((out.design.shapes ?? []).some((s) => s.simpleRole === "label.chip")).toBe(false);
  });

  it("carries the TechBBQ logo settings — a dragged logo must not snap back", () => {
    const from = {
      ...buildSimpleDesign(form3, "square"),
    };
    from.design = {
      ...from.design,
      logoCustomPosition: { x: 0.91, y: 0.08 }, // set by dragging; overrides logoPosition
      logoScale: 1.4,
      logoStyle: "red" as const,
    };
    const out = syncPanelChrome(from, buildSimpleDesign(form2, "square"));
    expect(out.design.logoCustomPosition).toEqual({ x: 0.91, y: 0.08 });
    expect(out.design.logoScale).toBe(1.4);
    expect(out.design.logoStyle).toBe("red");
  });

  it("the moderator TOGGLE neither floats a stray MODERATOR word nor deletes the real one", () => {
    // Auditor repro: the toggle is a shape change, so it lands in the same
    // sync path as a count change — but only ONE side has a moderator.
    const noMod: SimpleForm = { ...form3, includeModerator: false };
    const modWords = (d: { design: { texts: { simpleRole?: string; content: string }[] } }) =>
      d.design.texts.filter((t) => !t.simpleRole && t.content === "MODERATOR").length;

    // Toggle OFF: tuned moderator doc -> speakers-only rebuild.
    const off = syncPanelChrome(tune(buildSimpleDesign(form3, "square")), buildSimpleDesign(noMod, "square"));
    expect(modWords(off)).toBe(0);
    expect(off.canvasImages.some((i) => i.simpleRole === "moderator.photo")).toBe(false);

    // Toggle ON: speakers-only tuned doc -> moderator rebuild.
    const on = syncPanelChrome(buildSimpleDesign(noMod, "square"), buildSimpleDesign(form3, "square"));
    expect(modWords(on)).toBe(1);
    expect(on.canvasImages.some((i) => i.simpleRole === "moderator.photo")).toBe(true);
  });

  it("returns the target unchanged across formats and for partner docs", () => {
    const from = tune(buildSimpleDesign(form3, "square"));
    const wide = buildSimpleDesign(form2, "presentation");
    expect(syncPanelChrome(from, wide)).toBe(wide);

    const pf: PartnerForm = { ...PW, label: "Official Partner", layout: "single", logos: [{ src: "data:logo" }], backgroundId: "orb3" };
    const partner = buildPartnerDesign(pf, "square");
    expect(syncPanelChrome(partner, buildSimpleDesign(form2, "square"))).not.toBe(partner);
    const toPartner = buildPartnerDesign(pf, "square");
    expect(syncPanelChrome(from, toPartner)).toBe(toPartner);
  });
});

describe("Panel Maker — 4 speakers, square: fixed card size (Auri's spec)", () => {
  it("speaker cards are 15% × 17% with the standard radius", () => {
    const base = panelOf3PlusModerator();
    const form4: SimpleForm = { ...base, speakers: [...base.speakers, { ...base.speakers[0], name: "Fourth Person" }] };
    const { canvasImages } = buildSimpleDesign(form4, "square");
    const speakers = canvasImages.filter((i) => i.simpleRole?.startsWith("speaker-"));
    expect(speakers).toHaveLength(4);
    for (const s of speakers) {
      expect(s.width).toBeCloseTo(0.15, 5);
      expect(s.height).toBeCloseTo(0.17, 5);
      expect(s.cornerRadius).toBe(8);
    }
    // 3 speakers keep their approved 0.185 size — the spec is 4-only.
    const three = buildSimpleDesign(base, "square").canvasImages.filter((i) => i.simpleRole?.startsWith("speaker-"));
    for (const s of three) expect(s.width).toBeCloseTo(0.185, 5);
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

// ─────────────────────────────────────────────────────────────────────────────
// Sales Announcement — the countdown and discount posts.
// ─────────────────────────────────────────────────────────────────────────────

const salesForm = (patch: Partial<SalesForm> = {}): SalesForm => ({ ...emptySalesForm(), ...patch });
const roleOf = (doc: SimpleDoc, role: string) => doc.design.texts.find((t) => t.simpleRole === role);

describe("Sales Maker — layout", () => {
  it.each(FORMATS)("countdown layout is stable for %s", (format) => {
    expect(normalize(buildSalesDesign(salesForm(), format))).toMatchSnapshot();
  });

  it.each(FORMATS)("discount layout is stable for %s", (format) => {
    expect(normalize(buildSalesDesign(salesForm({ layout: "discount", value: "10%", caption: "" }), format))).toMatchSnapshot();
  });

  it("is deterministic — same input, same ids and geometry", () => {
    expect(buildSalesDesign(salesForm(), "square")).toEqual(buildSalesDesign(salesForm(), "square"));
  });

  it("countdown stacks the figure above its caption, both on the left margin", () => {
    const doc = buildSalesDesign(salesForm({ value: "48", caption: "days left" }), "square");
    const value = roleOf(doc, "sales.value")!;
    const caption = roleOf(doc, "sales.caption")!;
    expect(value.content).toBe("48");
    expect(value.position.y).toBeLessThan(caption.position.y);
    expect(value.position.x).toBe(caption.position.x);
  });

  it.each(FORMATS)("countdown keeps the figure block clear of the photo band (%s)", (format) => {
    // A long figure ("100" at full size) used to run into the photo.
    const doc = buildSalesDesign(salesForm({ value: "100", caption: "days left to book" }), format);
    const frame = (doc.design.shapes ?? []).find((s) => s.simpleRole === "sales-countdown.photo")!;
    const photoTop = frame.y - frame.height / 2;
    const caption = roleOf(doc, "sales.caption")!;
    const captionBottom = caption.position.y + (caption.fontSize / 2) / doc.customSize.height;
    expect(captionBottom).toBeLessThanOrEqual(photoTop);
  });

  it("discount emits the headline, figure, CTA pill and footer; countdown emits none of the extras", () => {
    const discount = buildSalesDesign(salesForm({ layout: "discount", value: "10%" }), "square");
    expect(roleOf(discount, "sales.headline")).toBeDefined();
    expect(roleOf(discount, "sales.cta")?.content).toBe("BOOK NOW");
    expect(roleOf(discount, "sales.footer")).toBeDefined();
    expect((discount.design.shapes ?? []).some((s) => s.simpleRole === "cta.pill")).toBe(true);

    const countdown = buildSalesDesign(salesForm(), "square");
    expect(roleOf(countdown, "sales.cta")).toBeUndefined();
    expect(roleOf(countdown, "sales.footer")).toBeUndefined();
    expect((countdown.design.shapes ?? []).some((s) => s.simpleRole === "cta.pill")).toBe(false);
  });

  it("an empty CTA or footer drops the layer instead of rendering a stray pill", () => {
    const doc = buildSalesDesign(salesForm({ layout: "discount", cta: "", footer: "" }), "square");
    expect(roleOf(doc, "sales.cta")).toBeUndefined();
    expect((doc.design.shapes ?? []).some((s) => s.simpleRole === "cta.pill")).toBe(false);
    expect(roleOf(doc, "sales.footer")).toBeUndefined();
  });

  it("the CTA pill is always at least as wide as its text", () => {
    for (const cta of ["GO", "BOOK NOW", "BOOK YOUR TICKET BEFORE IT IS TOO LATE"]) {
      const doc = buildSalesDesign(salesForm({ layout: "discount", cta }), "square");
      const pill = (doc.design.shapes ?? []).find((s) => s.simpleRole === "cta.pill")!;
      const text = roleOf(doc, "sales.cta")!;
      const textW = (text.content.length * text.fontSize * 0.62) / doc.customSize.width;
      expect(pill.width).toBeGreaterThanOrEqual(textW);
    }
  });

  it("the ribbon band is rotated, crosses both corner edges, and grows with a long text", () => {
    const doc = buildSalesDesign(salesForm({ ribbon: "DISCOUNT ENDS 23 JULY" }), "square");
    const band = (doc.design.shapes ?? []).find((s) => s.simpleRole === "ribbon.band")!;
    const text = roleOf(doc, "sales.ribbon")!;
    expect(band.rotation).toBe(45);
    expect(text.rotation).toBe(45);
    expect(text.content).toBe("DISCOUNT ENDS 23 JULY");
    // Band and text share a centre, so the words sit on the white.
    expect(text.position.x).toBeCloseTo(band.x, 5);
    expect(text.position.y).toBeCloseTo(band.y, 5);
    // Long enough to overshoot the corner it cuts.
    const cut = 0.3; // fraction of the shorter side, per the builder
    const visible = cut * Math.SQRT2;
    expect(band.width).toBeGreaterThan(visible);

    // A long ribbon shrinks its font instead of running off the corner: the
    // text stays inside the stretch of band that is actually on canvas.
    const long = buildSalesDesign(salesForm({ ribbon: "EARLY BIRD PRICING ENDS THIS FRIDAY AT MIDNIGHT" }), "square");
    const longText = roleOf(long, "sales.ribbon")!;
    expect(longText.fontSize).toBeLessThan(text.fontSize);
    for (const t of [text, longText]) {
      const w = (t.content.length * t.fontSize * 0.62) / 1500;
      expect(w).toBeLessThanOrEqual(visible);
    }
  });

  it("an empty ribbon drops the band and shows the TechBBQ logo instead", () => {
    const withRibbon = buildSalesDesign(salesForm(), "square");
    expect(withRibbon.design.showLogo).toBe(false);

    const bare = buildSalesDesign(salesForm({ ribbon: "" }), "square");
    expect((bare.design.shapes ?? []).some((s) => s.simpleRole === "ribbon.band")).toBe(false);
    expect(roleOf(bare, "sales.ribbon")).toBeUndefined();
    expect(bare.design.showLogo).toBe(true);
  });

  it("an uploaded photo replaces the placeholder frame at the same slot role", () => {
    const empty = buildSalesDesign(salesForm(), "square");
    expect(empty.canvasImages).toHaveLength(0);
    const frame = (empty.design.shapes ?? []).find((s) => s.simpleRole === "sales-countdown.photo")!;
    expect(frame).toBeDefined();

    const filled = buildSalesDesign(salesForm({ photo: { src: "photo.jpg" } }), "square");
    expect((filled.design.shapes ?? []).some((s) => s.simpleRole === "sales-countdown.photo")).toBe(false);
    const img = filled.canvasImages.find((i) => i.simpleRole === "sales-countdown.photo")!;
    expect(img.src).toBe("photo.jpg");
    expect(img.x).toBeCloseTo(frame.x, 5);
    expect(img.width).toBeCloseTo(frame.width, 5);
  });

  it.each(FORMATS)("keeps the photo inside the canvas bounds (%s)", (format) => {
    for (const layout of ["countdown", "discount"] as const) {
      const doc = buildSalesDesign(salesForm({ layout, photo: { src: "p.jpg" } }), format);
      const img = doc.canvasImages[0];
      expect(img.x - img.width / 2).toBeGreaterThanOrEqual(0);
      expect(img.y - img.height / 2).toBeGreaterThanOrEqual(0);
      expect(img.x + img.width / 2).toBeLessThanOrEqual(1);
      expect(img.y + img.height / 2).toBeLessThanOrEqual(1);
    }
  });
});

describe("sales doc identity — kinds and layouts never cross", () => {
  it("reads the layout from the photo slot, and from the text roles when the frame is gone", () => {
    const countdown = buildSalesDesign(salesForm(), "square");
    const discount = buildSalesDesign(salesForm({ layout: "discount" }), "square");
    expect(salesLayoutOf(countdown)).toBe("countdown");
    expect(salesLayoutOf(discount)).toBe("discount");

    // Hand-deleted photo frame: the text roles still witness the layout, so the
    // doc keeps its kind instead of being healed away as a panel doc.
    const noFrame = { ...discount, design: { ...discount.design, shapes: (discount.design.shapes ?? []).filter((s) => s.simpleRole !== "sales-discount.photo") } };
    expect(salesLayoutOf(noFrame)).toBe("discount");
  });

  it("docKindOf separates sales, partner and panel docs", () => {
    expect(docKindOf(buildSalesDesign(salesForm(), "square"))).toBe("sales");
    expect(docKindOf(buildSalesDesign(salesForm({ layout: "discount" }), "square"))).toBe("sales");
    expect(docKindOf(buildPartnerDesign(emptyPartnerForm(), "square"))).toBe("partner");
    expect(docKindOf(buildSimpleDesign(emptyForm(), "square"))).toBe("panel");
  });

  it("countdown and discount docs never share a shape key", () => {
    const countdown = buildSalesDesign(salesForm(), "square");
    const discount = buildSalesDesign(salesForm({ layout: "discount" }), "square");
    expect(panelShapeKey(countdown)).not.toBe(panelShapeKey(discount));
  });

  it("a rebuild shape-matches a tuned sales doc, which is what revives a parked design", () => {
    const built = buildSalesDesign(salesForm(), "square");
    const tuned = { ...built, design: { ...built.design, texts: built.design.texts.map((t) => (t.simpleRole === "sales.value" ? { ...t, position: { x: 0.5, y: 0.2 } } : t)) } };
    const shelf = parkDoc({}, tuned);
    expect(shelf[panelShapeKey(buildSalesDesign(salesForm(), "square"))]).toBe(tuned);
  });

  it("the panel migrations leave sales docs untouched", () => {
    const doc = buildSalesDesign(salesForm({ photo: { src: "p.jpg" } }), "square");
    expect(migrateLegacyPanelDoc(doc)).toBe(doc);
    expect(adoptLegacyPanelRoles(doc)).toBe(doc);
  });
});

describe("retargetSalesLayout — a photo upload keeps the tuned sales design", () => {
  const tunedCountdown = () => {
    const doc = buildSalesDesign(salesForm(), "square");
    return {
      ...doc,
      design: {
        ...doc.design,
        // Hand-moved figure + hand-resized photo frame.
        texts: doc.design.texts.map((t) => (t.simpleRole === "sales.value" ? { ...t, position: { x: 0.4, y: 0.18 } } : t)),
        shapes: (doc.design.shapes ?? []).map((s) => (s.simpleRole === "sales-countdown.photo" ? { ...s, y: 0.7, height: 0.3 } : s)),
      },
    };
  };

  it("fills the tuned frame with the new photo at the frame's own geometry", () => {
    const tuned = tunedCountdown();
    const rebuilt = buildSalesDesign(salesForm({ photo: { src: "crowd.jpg" } }), "square");
    const out = retargetSalesLayout(tuned, rebuilt, "countdown")!;
    expect(out).not.toBeNull();
    const img = out.canvasImages.find((i) => i.simpleRole === "sales-countdown.photo")!;
    expect(img.src).toBe("crowd.jpg");
    expect(img.y).toBe(0.7);
    expect(img.height).toBe(0.3);
    // The hand-placed figure survives, and edited words still land.
    expect(roleOf(out, "sales.value")!.position).toEqual({ x: 0.4, y: 0.18 });
    expect((out.design.shapes ?? []).some((s) => s.simpleRole === "sales-countdown.photo")).toBe(false);
  });

  it("carries new words into a tuned doc and turns a cleared photo back into a frame", () => {
    const built = buildSalesDesign(salesForm({ photo: { src: "crowd.jpg" } }), "square");
    const tuned = { ...built, canvasImages: built.canvasImages.map((i) => ({ ...i, y: 0.72 })) };
    const rebuilt = buildSalesDesign(salesForm({ value: "12", caption: "days left" }), "square");
    const out = retargetSalesLayout(tuned, rebuilt, "countdown")!;
    expect(out.canvasImages).toHaveLength(0);
    const frame = (out.design.shapes ?? []).find((s) => s.simpleRole === "sales-countdown.photo")!;
    expect(frame.y).toBe(0.72);
    expect(roleOf(out, "sales.value")!.content).toBe("12");
  });

  it("refuses the other sale type, another format, and partner docs", () => {
    const tuned = tunedCountdown();
    const discount = buildSalesDesign(salesForm({ layout: "discount" }), "square");
    expect(retargetSalesLayout(tuned, discount, "discount")).toBeNull();
    expect(retargetSalesLayout(tuned, buildSalesDesign(salesForm(), "story"), "countdown")).toBeNull();
    expect(retargetSalesLayout(buildPartnerDesign(emptyPartnerForm(), "square"), tuned, "countdown")).toBeNull();
  });
});

describe("sales form round-trip through the library", () => {
  it("the saved snapshot restores every field, layout and photo", () => {
    const form = salesForm({ layout: "discount", value: "10%", cta: "BOOK NOW", photo: { src: "p.jpg" } });
    const doc = buildSalesDesign(form, "presentation");
    const snapshot = stripFormsForSave("sales", emptyForm(), emptyPartnerForm(), form);
    const restored = formsFromDoc("sales", doc, snapshot);
    expect(restored.template).toBe("sales");
    expect(restored.form).toBeNull();
    expect(restored.partner).toBeNull();
    expect(restored.sales).toEqual({ ...form, backgroundId: doc.design.backgroundId });
  });

  it("reconstructs the form from role-tagged layers for a snapshot-less item", () => {
    const form = salesForm({ layout: "discount", value: "25%", caption: "off", headline: "Last chance", cta: "GET YOURS", footer: "COPENHAGEN", ribbon: "ENDS FRIDAY", photo: { src: "p.jpg" } });
    const doc = buildSalesDesign(form, "square");
    const restored = formsFromDoc("sales", doc).sales!;
    expect(restored.layout).toBe("discount");
    expect(restored.value).toBe("25%");
    expect(restored.caption).toBe("off");
    expect(restored.headline).toBe("Last chance");
    // The builder uppercases the CTA, ribbon and footer on canvas.
    expect(restored.cta).toBe("GET YOURS");
    expect(restored.ribbon).toBe("ENDS FRIDAY");
    expect(restored.photo?.src).toBe("p.jpg");
  });

  it("bundleCoverage lists the sale types a template is set up for", () => {
    const docs = [
      buildSalesDesign(salesForm(), "square"),
      buildSalesDesign(salesForm({ layout: "discount" }), "square"),
      buildSalesDesign(salesForm(), "story"),
    ];
    expect(bundleCoverage(docs)).toEqual([
      { format: "square", layout: "countdown" },
      { format: "square", layout: "discount" },
      { format: "story", layout: "countdown" },
    ]);
  });

  it("names the exported file after the figure and its caption", () => {
    expect(simpleExportName("sales", "square", "", "48 days left")).toBe("1x1 - Sale - 48 days left");
    expect(simpleExportName("sales", "presentation", "", "10% off")).toBe("16x9 - Sale - 10% off");
    expect(simpleExportName("sales", "story", "", "")).toBe("9x16 - Sale");
    // The panel and partner names are unchanged.
    expect(simpleExportName("partner", "square", "ignored")).toBe("1x1 - Partner Announcement");
  });
});

// ── The thank-you wall ──────────────────────────────────────────────────────
// A fourth partner layout: one headline over an auto-flowed grid of N logos.
// Unlike One/Two/Four its slot COUNT is a form field, so both the grid geometry
// and the park/retarget machinery have to follow it.
describe("Thank you wall — grid geometry", () => {
  const wall = (patch: Partial<PartnerForm> = {}): PartnerForm =>
    ({ ...emptyPartnerForm(), layout: "thanks", ...patch });

  it("reads as a partner doc with thanks slot roles, a headline and no TechBBQ logo", () => {
    const doc = buildPartnerDesign(wall({ logoCount: 3 }), "presentation");
    expect(docKindOf(doc)).toBe("partner");
    expect(partnerLayoutOf(doc)).toBe("thanks");
    expect(doc.design.texts.map((t) => t.simpleRole)).toEqual(["thanks.headline"]);
    // Nothing uploaded yet, so three tagged placeholder frames in grid order.
    expect(doc.design.shapes?.map((s) => s.simpleRole)).toEqual(["logo-thanks-0", "logo-thanks-1", "logo-thanks-2"]);
    expect(doc.canvasImages).toHaveLength(0);
    expect(doc.design.showLogo).toBe(false);
  });

  it("renders exactly logoCount cells, filled ones as contain-fit images", () => {
    const logos = Array.from({ length: 4 }, (_, i) => ({ src: `data:l${i}` }));
    const doc = buildPartnerDesign(wall({ logoCount: 6, logos }), "square");
    expect(doc.canvasImages.map((i) => i.simpleRole)).toEqual(["logo-thanks-0", "logo-thanks-1", "logo-thanks-2", "logo-thanks-3"]);
    expect(doc.canvasImages.every((i) => i.fit === "contain")).toBe(true);
    expect(doc.design.shapes?.map((s) => s.simpleRole)).toEqual(["logo-thanks-4", "logo-thanks-5"]);
  });

  it("keeps logos beyond the count out of the doc — lowering the count parks them", () => {
    const logos = Array.from({ length: 8 }, (_, i) => ({ src: `data:l${i}` }));
    const doc = buildPartnerDesign(wall({ logoCount: 4, logos }), "square");
    expect(doc.canvasImages.map((i) => i.src)).toEqual(["data:l0", "data:l1", "data:l2", "data:l3"]);
  });

  it("clamps the count instead of emitting an empty or endless grid", () => {
    const none = buildPartnerDesign(wall({ logoCount: 0 }), "square");
    expect(none.design.shapes).toHaveLength(1);
    // A wall at the floor is still witnessable as one.
    expect(partnerLayoutOf(none)).toBe("thanks");
    expect(buildPartnerDesign(wall({ logoCount: 99 }), "presentation").design.shapes).toHaveLength(30);
  });

  it("never leaves one orphan on the last row, and caps columns per format", () => {
    // 11 at 16:9 would flow 5,5,1 — it steps down to 4,4,3 instead.
    expect(thanksGridColumns(11, 16 / 9)).toBe(4);
    expect(thanksGridColumns(12, 16 / 9)).toBe(5);
    expect(thanksGridColumns(12, 1)).toBe(4);
    // A 9:16 story cannot carry more than three across.
    expect(thanksGridColumns(25, 9 / 16)).toBe(3);
    expect(thanksGridColumns(30, 16 / 9)).toBe(6);
    // Fewer logos than a full row: one column each.
    expect(thanksGridColumns(2, 16 / 9)).toBe(2);
    expect(thanksGridColumns(1, 1)).toBe(1);
  });

  it("keeps every cell inside the margins and centres each row", () => {
    for (const format of ["square", "presentation", "story"] as PlatformFormat[]) {
      const doc = buildPartnerDesign(wall({ logoCount: 12 }), format);
      const cells = doc.design.shapes ?? [];
      expect(cells).toHaveLength(12);
      for (const c of cells) {
        expect(c.x - c.width / 2).toBeGreaterThanOrEqual(0.059);
        expect(c.x + c.width / 2).toBeLessThanOrEqual(0.941);
        expect(c.y - c.height / 2).toBeGreaterThan(0);
        expect(c.y + c.height / 2).toBeLessThanOrEqual(0.941);
      }
      // Every row sits below the headline…
      const headline = doc.design.texts[0];
      expect(Math.min(...cells.map((c) => c.y - c.height / 2))).toBeGreaterThan(headline.position.y);
      // …and is centred on the canvas (mirrored x's average to 0.5).
      const rows = new Map<number, typeof cells>();
      for (const c of cells) {
        const key = Math.round(c.y * 1000);
        rows.set(key, [...(rows.get(key) ?? []), c]);
      }
      for (const row of rows.values()) {
        expect(row.reduce((s, c) => s + c.x, 0) / row.length).toBeCloseTo(0.5, 5);
      }
    }
  });

  it("is a distinct composition per count, and never matches One/Two/Four", () => {
    expect(panelShapeKey(buildPartnerDesign(wall({ logoCount: 10 }), "square")))
      .not.toBe(panelShapeKey(buildPartnerDesign(wall({ logoCount: 11 }), "square")));
    const quad = buildPartnerDesign({ ...emptyPartnerForm(), layout: "quad" }, "square");
    expect(panelShapeKey(buildPartnerDesign(wall({ logoCount: 4 }), "square"))).not.toBe(panelShapeKey(quad));
  });
});

describe("retargetPartnerLayout — the thank-you wall", () => {
  const wall = (logoCount: number, logos: ({ src: string } | null)[] = []): PartnerForm =>
    ({ ...emptyPartnerForm(), layout: "thanks", logoCount, logos });

  it("fills a tuned cell in place when its slot gains a logo", () => {
    const built = buildPartnerDesign(wall(3, [{ src: "data:a" }, null, null]), "square");
    // Hand-tune: drag the second cell's frame somewhere of your own choosing.
    const tuned: SimpleDoc = {
      ...built,
      design: {
        ...built.design,
        shapes: (built.design.shapes ?? []).map((s) =>
          s.simpleRole === "logo-thanks-1" ? { ...s, x: 0.2, y: 0.8 } : s),
      },
    };
    const rebuilt = buildPartnerDesign(wall(3, [{ src: "data:a" }, { src: "data:b" }, null]), "square");
    const filled = retargetPartnerLayout(tuned, rebuilt, "thanks")?.canvasImages
      .find((i) => i.simpleRole === "logo-thanks-1");
    expect(filled?.src).toBe("data:b");
    expect(filled?.x).toBe(0.2);
    expect(filled?.y).toBe(0.8);
  });

  it("refuses a count change — a different grid is a different design", () => {
    expect(retargetPartnerLayout(
      buildPartnerDesign(wall(3), "square"),
      buildPartnerDesign(wall(4), "square"),
      "thanks",
    )).toBeNull();
  });

  it("refuses a doc of another layout", () => {
    const duo = buildPartnerDesign({ ...emptyPartnerForm(), layout: "duo" }, "square");
    expect(retargetPartnerLayout(duo, buildPartnerDesign(wall(2), "square"), "thanks")).toBeNull();
  });

  it("carries the headline's words into the tuned layer", () => {
    const built = buildPartnerDesign(wall(2), "square");
    const tuned: SimpleDoc = {
      ...built,
      design: { ...built.design, texts: built.design.texts.map((t) => ({ ...t, position: { x: 0.3, y: 0.2 } })) },
    };
    const rebuilt = buildPartnerDesign({ ...wall(2), headline: "Tak til vores partnere" }, "square");
    const h = retargetPartnerLayout(tuned, rebuilt, "thanks")?.design.texts
      .find((t) => t.simpleRole === "thanks.headline");
    expect(h?.content).toBe("Tak til vores partnere");
    expect(h?.position).toEqual({ x: 0.3, y: 0.2 });
  });
});

describe("syncPartnerChrome — the wall keeps its own chrome", () => {
  it("carries nothing between the wall and One/Two/Four, in either direction", () => {
    const announcement = buildPartnerDesign({ ...emptyPartnerForm(), layout: "single", logos: [{ src: "data:a" }] }, "square");
    const wall = buildPartnerDesign({ ...emptyPartnerForm(), layout: "thanks", logoCount: 6 }, "square");
    // So the announcement's bottom-centre TechBBQ logo never lands on the
    // grid's last row, and the wall never strips it off an announcement.
    expect(syncPartnerChrome(announcement, wall)).toBe(wall);
    expect(syncPartnerChrome(wall, announcement)).toBe(announcement);
  });
});

describe("thank-you wall round-trip through the library", () => {
  it("restores the layout, count, headline and logos from the snapshot", () => {
    const form: PartnerForm = {
      ...emptyPartnerForm(),
      layout: "thanks",
      logoCount: 5,
      logos: [{ src: "data:a" }, null, { src: "data:c" }],
      backgroundId: "ls16x9",
    };
    const doc = buildPartnerDesign(form, "presentation");
    const back = formsFromDoc("partner", doc, stripFormsForSave("partner", emptyForm(), form));
    expect(back.partner?.layout).toBe("thanks");
    expect(back.partner?.logoCount).toBe(5);
    expect(back.partner?.headline).toBe(emptyPartnerForm().headline);
    expect(back.partner?.logos.map((l) => l?.src ?? null)).toEqual(["data:a", null, "data:c"]);
    expect(back.partner?.backgroundId).toBe("ls16x9");
  });

  it("reconstructs a snapshot-less doc from its roles", () => {
    const doc = buildPartnerDesign({
      ...emptyPartnerForm(),
      layout: "thanks",
      logoCount: 4,
      headline: "Tak til vores partnere",
      logos: [{ src: "data:a" }, { src: "data:b" }],
    }, "square");
    const back = formsFromDoc("partner", doc);
    expect(back.partner?.layout).toBe("thanks");
    expect(back.partner?.logoCount).toBe(4);
    // Uppercasing is a render flag, so the layer's content is still the
    // sentence-case text the user typed.
    expect(back.partner?.headline).toBe("Tak til vores partnere");
    expect(back.partner?.logos.map((l) => l?.src ?? null)).toEqual(["data:a", "data:b", null, null]);
  });

  it("loads a pre-wall snapshot with the wall's defaults filled in", () => {
    const legacy = {
      template: "partner" as const,
      partner: { label: "Official Partner", layout: "single", logos: [{ src: "data:a" }], backgroundId: "orb5" } as PartnerForm,
    };
    const doc = buildPartnerDesign({ ...emptyPartnerForm(), logos: [{ src: "data:a" }] }, "square");
    const back = formsFromDoc("partner", doc, legacy);
    expect(back.partner?.layout).toBe("single");
    expect(back.partner?.logoCount).toBe(emptyPartnerForm().logoCount);
    expect(back.partner?.headline).toBe(emptyPartnerForm().headline);
  });
});
