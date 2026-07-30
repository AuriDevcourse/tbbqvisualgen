import { describe, it, expect } from "vitest";
import { decodeSvgDataUrl, encodeSvgDataUrl, isSvgDataUrl, tintSvgDataUrl, tintSvgSource } from "./svgTint";

const WHITE = "#FFFFFF";

describe("tintSvgSource — restaining a single-colour logo", () => {
  it("rewrites fill and stroke attributes", () => {
    const out = tintSvgSource(`<svg viewBox="0 0 10 10"><path fill="#ED4746" d="M0 0"/><rect stroke='rgb(1,2,3)'/></svg>`, WHITE);
    expect(out).toContain(`fill="#FFFFFF"`);
    expect(out).toContain(`stroke='#FFFFFF'`);
    expect(out).not.toContain("ED4746");
    expect(out).not.toContain("rgb(1,2,3)");
  });

  it("rewrites CSS declarations in a <style> block and in style attributes", () => {
    const out = tintSvgSource(
      `<svg><defs><style>.cls-1{fill:#231f20;stroke:#000}</style></defs><path style="fill:#123456" d="M0 0"/></svg>`,
      WHITE,
    );
    expect(out).toContain("fill:#FFFFFF");
    expect(out).toContain("stroke:#FFFFFF");
    expect(out).not.toContain("231f20");
    expect(out).not.toContain("123456");
  });

  it("leaves fill=\"none\" alone — that is what keeps an outline logo an outline", () => {
    const out = tintSvgSource(`<svg><path fill="none" stroke="#000"/><circle style="fill:none"/></svg>`, WHITE);
    expect(out).toContain(`fill="none"`);
    expect(out).toContain("fill:none");
    expect(out).toContain(`stroke="#FFFFFF"`);
  });

  it("leaves gradient/pattern references alone but restains their stops", () => {
    const out = tintSvgSource(
      `<svg><linearGradient><stop stop-color="#f00"/></linearGradient><path fill="url(#g)"/></svg>`,
      WHITE,
    );
    expect(out).toContain(`fill="url(#g)"`);
    expect(out).toContain(`stop-color="#FFFFFF"`);
  });

  it("sets fill on the root so shapes with no colour of their own (default black) follow", () => {
    const out = tintSvgSource(`<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>`, WHITE);
    expect(out).toMatch(/<svg[^>]*fill="#FFFFFF">/);
    // A root fill that was already there is replaced, not duplicated.
    const twice = tintSvgSource(`<svg fill="#000" viewBox="0 0 4 4"><path d="M0 0"/></svg>`, WHITE);
    expect(twice.match(/fill="/g)).toHaveLength(1);
    expect(twice).toContain(`viewBox="0 0 4 4"`);
  });

  it("is idempotent — tinting twice equals tinting once", () => {
    const once = tintSvgSource(`<svg><path fill="#abc"/></svg>`, WHITE);
    expect(tintSvgSource(once, WHITE)).toBe(once);
  });
});

describe("svg data URLs", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path fill="#000" d="M0 0h4v4H0z"/></svg>`;

  it("round-trips base64 and percent-encoded payloads, including non-ASCII", () => {
    const withUnicode = svg.replace("M0 0h4v4H0z", "Høje ø æ å");
    const encoded = encodeSvgDataUrl(withUnicode);
    expect(isSvgDataUrl(encoded)).toBe(true);
    expect(decodeSvgDataUrl(encoded)).toBe(withUnicode);
    expect(decodeSvgDataUrl(`data:image/svg+xml,${encodeURIComponent(svg)}`)).toBe(svg);
  });

  it("tints through a data URL and refuses anything that is not an SVG", () => {
    const tinted = tintSvgDataUrl(encodeSvgDataUrl(svg), WHITE);
    expect(tinted).not.toBeNull();
    expect(decodeSvgDataUrl(tinted!)).toContain(`fill="#FFFFFF"`);

    expect(isSvgDataUrl("data:image/png;base64,iVBOR")).toBe(false);
    expect(tintSvgDataUrl("data:image/png;base64,iVBOR", WHITE)).toBeNull();
    expect(tintSvgDataUrl("/logos/Accel.svg", WHITE)).toBeNull();
    expect(decodeSvgDataUrl("data:image/svg+xml;base64,!!not-base64!!")).toBeNull();
  });
});
