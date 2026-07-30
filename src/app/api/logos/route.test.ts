import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * The delete route removes files from the repo, so its guards matter more than
 * its happy path: it must not exist in production, and it must reject anything
 * that is not a well-formed request. The happy path is covered by
 * `libraryFileFromSrc`'s own tests plus the live walkthrough.
 */

const ORIGINAL_ENV = process.env.NODE_ENV;

function setEnv(value: string) {
  // NODE_ENV is typed read-only and process.env rejects a redefined property,
  // so assign through a widened view. The route reads it per request.
  (process.env as Record<string, string>).NODE_ENV = value;
}

afterEach(() => {
  setEnv(ORIGINAL_ENV ?? "test");
  vi.resetModules();
});

const req = (body: unknown) =>
  new Request("http://localhost/api/logos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("DELETE /api/logos — guards", () => {
  it("does not exist in production (the filesystem is read-only there)", async () => {
    setEnv("production");
    const { DELETE } = await import("./route");
    const res = await DELETE(req({ srcs: ["/logos/Accel.svg"] }));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("production") });
  });

  it("rejects a body that is not JSON", async () => {
    setEnv("development");
    const { DELETE } = await import("./route");
    const res = await DELETE(req("not json"));
    expect(res.status).toBe(400);
  });

  it("rejects a missing or empty srcs list", async () => {
    setEnv("development");
    const { DELETE } = await import("./route");
    expect((await DELETE(req({}))).status).toBe(400);
    expect((await DELETE(req({ srcs: [] }))).status).toBe(400);
    expect((await DELETE(req({ srcs: "/logos/Accel.svg" }))).status).toBe(400);
  });

  it("caps how many files one request may remove", async () => {
    setEnv("development");
    const { DELETE } = await import("./route");
    const res = await DELETE(req({ srcs: Array.from({ length: 201 }, (_, i) => `/logos/x${i}.svg`) }));
    expect(res.status).toBe(413);
  });

  it("reports unknown paths as failures and deletes nothing", async () => {
    setEnv("development");
    const { DELETE } = await import("./route");
    const res = await DELETE(req({ srcs: ["/logos/../../.env", "/etc/passwd", "/logos/DoesNotExist.svg"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toEqual([]);
    expect(data.failed).toHaveLength(3);
    expect(data.failed.every((f: { reason: string }) => f.reason === "not a library file")).toBe(true);
  });
});
