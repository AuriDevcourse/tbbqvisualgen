import { describe, it, expect } from "vitest";
import { buildPartnerDesign, buildSimpleDesign, emptyForm, emptyPartnerForm, emptyPerson, formsFromDoc, isBlankPerson, panelShapeKey, retargetTunedDoc, stripFormsForSave, type PartnerForm, type SimpleForm } from "./simpleLayout";
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

// Replacing a photo/logo used to bin the tuned design outright ("it just
// restarted the template"). These pin the fix: a swapped image lands in the
// tuned slot; only a slot appearing/disappearing forces a rebuild.
describe("retargetTunedDoc — image swaps keep the tuned layout", () => {
  const partnerWith = (src: string): PartnerForm => ({
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
    const duo = buildPartnerDesign({ label: "X", layout: "duo", logos, backgroundId: "orb5" }, "square");
    const halfQuad = buildPartnerDesign({ label: "X", layout: "quad", logos, backgroundId: "orb5" }, "square");

    expect(duo.canvasImages.map((i) => i.simpleRole)).toEqual(["logo-duo-0", "logo-duo-1"]);
    expect(panelShapeKey(duo)).not.toBe(panelShapeKey(halfQuad));
    expect(retargetTunedDoc(duo, halfQuad)).toBeNull();
    // A replaced logo within duo still retargets.
    const swapped = buildPartnerDesign({ label: "X", layout: "duo", logos: [{ src: "data:c" }, { src: "data:b" }], backgroundId: "orb5" }, "square");
    expect(retargetTunedDoc(duo, swapped)?.canvasImages.find((i) => i.simpleRole === "logo-duo-0")?.src).toBe("data:c");
  });
});

// Loading a library doc must put the sidebar in the matching state — the
// template toggle AND the form fields ("loads a partner doc, still shows the
// Panel form" was the bug).
describe("formsFromDoc — restoring the sidebar for a loaded doc", () => {
  it("reconstructs a legacy partner form from role-tagged layers", () => {
    const pf: PartnerForm = { label: "Official Partner", layout: "single", logos: [{ src: "data:logo", naturalWidth: 640, naturalHeight: 320 }], backgroundId: "orb3" };
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
    const pf: PartnerForm = { label: "Partners", layout: "duo", logos: [{ src: "data:l" }, { src: "data:r" }], backgroundId: "orb5" };
    const restored = formsFromDoc("partner", buildPartnerDesign(pf, "square"));
    expect(restored.partner!.layout).toBe("duo");
    expect(restored.partner!.logos.map((l) => l?.src)).toEqual(["data:l", "data:r"]);
  });

  it("keeps ALL partner logo slots through a save/load round-trip — not just the active layout's", () => {
    // Single layout active, but slots 0–1 filled (the user also set up Two).
    const pf: PartnerForm = { label: "Official Partner", layout: "single", logos: [{ src: "data:one" }, { src: "data:two" }], backgroundId: "orb5" };
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
