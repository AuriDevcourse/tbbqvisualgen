import { describe, it, expect } from "vitest";
import { KINDS, validateItemBody } from "./libraryApi";
import {
  buildNextDesign, buildPartnerDesign, buildSalesDesign, buildSimpleDesign, docKindOf,
  emptyForm, emptyNextForm, emptyPartnerForm, emptySalesForm,
} from "./simpleLayout";

/**
 * The team library's accepted `kind` list.
 *
 * This exists because of a real, silent one: `next` was never added to `KINDS`,
 * so every attempt to save a Next Session board to the team library came back
 * 422 — with a message ("kind must be panel, partner or editor") that listed
 * three of the five and named the wrong suspect. The client had typed its union
 * as including `next` since the board shipped, so the two sides disagreed and
 * only the server knew.
 *
 * The guard that matters is the last test: every kind `docKindOf` can return
 * must be a kind the API accepts. Nothing else checks that the two lists agree.
 */
describe("team library kinds", () => {
  const post = (body: unknown) =>
    validateItemBody(new Request("https://x/api/library", {
      method: "POST",
      body: JSON.stringify(body),
    }));

  const doc = (d: object) => ({ name: "A saved design", kind: "", doc: d });

  it("accepts a Next Session board", async () => {
    const res = await post({ ...doc(buildNextDesign(emptyNextForm(), "presentation")), kind: "next" });
    expect(res).not.toBeInstanceOf(Response);
    expect((res as { kind: string }).kind).toBe("next");
  });

  it("rejects an unknown kind, and NAMES every kind it takes", async () => {
    const res = await post({ ...doc(buildNextDesign(emptyNextForm(), "presentation")), kind: "poster" });
    expect(res).toBeInstanceOf(Response);
    const { error } = await (res as Response).json();
    for (const k of KINDS) expect(error).toContain(k);
  });

  /**
   * The actual invariant. `docKindOf` is the app's source of truth for what a
   * doc IS; `KINDS` is the API's list of what it will store. A template added
   * to one and not the other is invisible until someone tries to save.
   */
  it("accepts every kind docKindOf can return", () => {
    const kinds = [
      docKindOf(buildSimpleDesign(emptyForm(), "presentation")),
      docKindOf(buildPartnerDesign(emptyPartnerForm(), "presentation")),
      docKindOf(buildSalesDesign(emptySalesForm(), "presentation")),
      docKindOf(buildNextDesign(emptyNextForm(), "presentation")),
    ];
    expect([...new Set(kinds)].sort()).toEqual(["next", "panel", "partner", "sales"]);
    for (const k of kinds) expect(KINDS.has(k)).toBe(true);
  });
});
