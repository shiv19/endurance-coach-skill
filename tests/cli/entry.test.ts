import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
});

describe("cli entry", () => {
  it("re-exports and triggers cli index import", async () => {
    let loaded = false;

    vi.doMock("../../src/cli/index.js", () => {
      loaded = true;
      return {
        __esModule: true,
        dummyExport: 123,
      };
    });

    const cli = await import("../../src/cli.js");

    expect(loaded).toBe(true);
    expect(cli.dummyExport).toBe(123);
  });
});
