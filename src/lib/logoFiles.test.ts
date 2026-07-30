import { describe, it, expect } from "vitest";
import { libraryFileFromSrc } from "./logoFiles";

const KNOWN = [
  "/logos/Accel.svg",
  "/logos/Molten%20Ventures.png",
  "/logos/2026/Danske%20Bank.svg",
];

describe("libraryFileFromSrc — only known library files can be deleted", () => {
  it("resolves a known file, encoded or not, including a subfolder", () => {
    expect(libraryFileFromSrc("/logos/Accel.svg", KNOWN)).toBe("Accel.svg");
    expect(libraryFileFromSrc("/logos/Molten%20Ventures.png", KNOWN)).toBe("Molten Ventures.png");
    expect(libraryFileFromSrc("/logos/Molten Ventures.png", KNOWN)).toBe("Molten Ventures.png");
    expect(libraryFileFromSrc("/logos/2026/Danske Bank.svg", KNOWN)).toBe("2026/Danske Bank.svg");
  });

  it("refuses anything that is not in the manifest", () => {
    expect(libraryFileFromSrc("/logos/NotThere.svg", KNOWN)).toBeNull();
    expect(libraryFileFromSrc("/backgrounds/season1.jpg", KNOWN)).toBeNull();
    expect(libraryFileFromSrc("", KNOWN)).toBeNull();
    expect(libraryFileFromSrc(undefined, KNOWN)).toBeNull();
    expect(libraryFileFromSrc(42, KNOWN)).toBeNull();
    expect(libraryFileFromSrc({ src: "/logos/Accel.svg" }, KNOWN)).toBeNull();
  });

  it("refuses traversal and absolute paths even when dressed up", () => {
    expect(libraryFileFromSrc("/logos/../../.env", KNOWN)).toBeNull();
    expect(libraryFileFromSrc("/logos/..%2F..%2F.env", KNOWN)).toBeNull();
    expect(libraryFileFromSrc("/logos/%2e%2e/%2e%2e/.env", KNOWN)).toBeNull();
    expect(libraryFileFromSrc("C:/Windows/system32", KNOWN)).toBeNull();
    expect(libraryFileFromSrc("/etc/passwd", KNOWN)).toBeNull();
    // Even a manifest that somehow contained a traversal entry is rejected.
    expect(libraryFileFromSrc("/logos/../secret.svg", ["/logos/../secret.svg"])).toBeNull();
    expect(libraryFileFromSrc("/logos/C:/x.svg", ["/logos/C:/x.svg"])).toBeNull();
  });

  it("tolerates a malformed percent escape instead of throwing", () => {
    expect(() => libraryFileFromSrc("/logos/%E0%A4%A", KNOWN)).not.toThrow();
    expect(libraryFileFromSrc("/logos/%E0%A4%A", KNOWN)).toBeNull();
  });
});
