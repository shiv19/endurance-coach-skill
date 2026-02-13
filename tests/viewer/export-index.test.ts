import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  sanitizeFilename,
  getAvailableFormats,
  downloadFile,
} from "../../src/viewer/lib/export/index.js";

describe("sanitizeFilename", () => {
  it("should remove invalid characters", () => {
    expect(sanitizeFilename("file<>name")).toBe("filename");
    expect(sanitizeFilename('file:"name')).toBe("filename");
    expect(sanitizeFilename("file/\\name")).toBe("filename");
    expect(sanitizeFilename("file|?*name")).toBe("filename");
  });

  it("should remove all invalid characters in combination", () => {
    expect(sanitizeFilename('<>:"/\\|?*')).toBe("");
    expect(sanitizeFilename("test<>file:name")).toBe("testfilename");
  });

  it("should replace spaces with underscores", () => {
    expect(sanitizeFilename("my workout file")).toBe("my_workout_file");
    expect(sanitizeFilename("  multiple   spaces  ")).toBe("_multiple_spaces_");
  });

  it("should handle multiple consecutive spaces", () => {
    expect(sanitizeFilename("a    b")).toBe("a_b");
    expect(sanitizeFilename("word1  word2   word3")).toBe("word1_word2_word3");
  });

  it("should limit length to 100 characters", () => {
    const longName = "a".repeat(150);
    expect(sanitizeFilename(longName)).toHaveLength(100);
    expect(sanitizeFilename(longName)).toBe("a".repeat(100));
  });

  it("should handle names at exactly 100 characters", () => {
    const exactName = "b".repeat(100);
    expect(sanitizeFilename(exactName)).toHaveLength(100);
    expect(sanitizeFilename(exactName)).toBe(exactName);
  });

  it("should handle short names without truncation", () => {
    expect(sanitizeFilename("short")).toBe("short");
    expect(sanitizeFilename("Workout_1")).toBe("Workout_1");
  });

  it("should handle empty string", () => {
    expect(sanitizeFilename("")).toBe("");
  });

  it("should handle combined transformations", () => {
    const result = sanitizeFilename("My <Cool> Workout: Day 1?");
    expect(result).toBe("My_Cool_Workout_Day_1");
  });
});

describe("getAvailableFormats", () => {
  it("should return zwo, fit, and mrc for bike workouts", () => {
    const formats = getAvailableFormats("bike");
    expect(formats).toContain("zwo");
    expect(formats).toContain("fit");
    expect(formats).toContain("mrc");
    expect(formats).toHaveLength(3);
  });

  it("should return zwo and fit for run workouts", () => {
    const formats = getAvailableFormats("run");
    expect(formats).toContain("zwo");
    expect(formats).toContain("fit");
    expect(formats).not.toContain("mrc");
    expect(formats).toHaveLength(2);
  });

  it("should return only fit for swim workouts", () => {
    const formats = getAvailableFormats("swim");
    expect(formats).toContain("fit");
    expect(formats).not.toContain("zwo");
    expect(formats).not.toContain("mrc");
    expect(formats).toHaveLength(1);
  });

  it("should return only fit for strength workouts", () => {
    const formats = getAvailableFormats("strength");
    expect(formats).toContain("fit");
    expect(formats).not.toContain("zwo");
    expect(formats).not.toContain("mrc");
    expect(formats).toHaveLength(1);
  });

  it("should return only fit for brick workouts", () => {
    const formats = getAvailableFormats("brick");
    expect(formats).toContain("fit");
    expect(formats).not.toContain("zwo");
    expect(formats).not.toContain("mrc");
    expect(formats).toHaveLength(1);
  });

  it("should return empty array for rest days", () => {
    const formats = getAvailableFormats("rest");
    expect(formats).toHaveLength(0);
  });

  it("should return empty array for race", () => {
    const formats = getAvailableFormats("race");
    expect(formats).toHaveLength(0);
  });
});

describe("downloadFile (browser environment required)", () => {
  let dom: JSDOM;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  const objectUrls: string[] = [];
  const blobs: Map<string, Blob> = new Map();
  const createdAnchors: { href: string; download: string }[] = [];

  beforeEach(() => {
    objectUrls.length = 0;
    blobs.clear();
    createdAnchors.length = 0;

    dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "http://localhost/",
      resources: "usable",
    });

    global.document = dom.window.document;

    clickSpy = vi
      .spyOn(dom.window.HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob): string => {
        const url = `blob:${dom.window.location.origin}/${objectUrls.length}`;
        objectUrls.push(url);
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL: (url: string): void => {
        const index = objectUrls.indexOf(url);
        if (index > -1) {
          objectUrls.splice(index, 1);
          blobs.delete(url);
        }
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should create a blob with correct content and MIME type", async () => {
    const content = "test content";
    const createObjectSpy = vi.spyOn(globalThis.URL, "createObjectURL");
    const revokeObjectSpy = vi.spyOn(globalThis.URL, "revokeObjectURL");

    downloadFile(content, "test.txt", "text/plain");

    expect(createObjectSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("text/plain");

    const blobContent = await blobArg.text();
    expect(blobContent).toBe(content);

    expect(revokeObjectSpy).toHaveBeenCalledTimes(1);
    const revokedUrl = revokeObjectSpy.mock.calls[0][0];
    const createdUrl = createObjectSpy.mock.results[0].value;
    expect(revokedUrl).toBe(createdUrl);

    createObjectSpy.mockRestore();
    revokeObjectSpy.mockRestore();
  });

  it("should create a blob from Uint8Array with correct MIME type", async () => {
    const content = new Uint8Array([1, 2, 3, 4, 5]);

    const createObjectSpy = vi.spyOn(globalThis.URL, "createObjectURL");

    const revokeObjectSpy = vi.spyOn(globalThis.URL, "revokeObjectURL");

    downloadFile(content, "test.bin", "application/octet-stream");

    expect(createObjectSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("application/octet-stream");

    const blobArrayBuffer = await blobArg.arrayBuffer();
    const blobUint8Array = new Uint8Array(blobArrayBuffer);
    expect(blobUint8Array).toEqual(content);

    expect(revokeObjectSpy).toHaveBeenCalledTimes(1);
    const revokedUrl = revokeObjectSpy.mock.calls[0][0];
    const createdUrl = createObjectSpy.mock.results[0].value;
    expect(revokedUrl).toBe(createdUrl);

    createObjectSpy.mockRestore();
    revokeObjectSpy.mockRestore();
  });

  it("should create an anchor element with correct href and download attributes", () => {
    const originalAppendChild = dom.window.document.body.appendChild;
    const originalRemoveChild = dom.window.document.body.removeChild;

    let capturedAnchor: HTMLAnchorElement | null = null;

    const appendChildSpy = vi
      .spyOn(dom.window.document.body, "appendChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          capturedAnchor = node;
        }
        return originalAppendChild.call(dom.window.document.body, node);
      });

    const removeChildSpy = vi
      .spyOn(dom.window.document.body, "removeChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          return originalRemoveChild.call(dom.window.document.body, node);
        }
        return node;
      });

    downloadFile("content", "file.txt", "text/plain");

    expect(capturedAnchor).not.toBeNull();
    const anchor = capturedAnchor as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("file.txt");
    expect(anchor.href).toMatch(/^blob:/);

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("should trigger click on anchor element", () => {
    downloadFile("content", "file.txt", "text/plain");

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("should remove anchor from body after click", () => {
    downloadFile("content", "file.txt", "text/plain");

    const anchor = dom.window.document.querySelector("a");
    expect(anchor).toBeNull();
  });

  it("should create object URL and revoke it", () => {
    downloadFile("content", "file.txt", "text/plain");

    expect(objectUrls).toHaveLength(0);
    expect(blobs.size).toBe(0);
  });

  it("should handle different MIME types", () => {
    downloadFile("<xml>content</xml>", "workout.zwo", "application/xml");

    expect(objectUrls).toHaveLength(0);
  });

  it("should perform operations in correct order", () => {
    const callOrder: string[] = [];

    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    globalThis.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      callOrder.push("createObjectURL");

      return originalCreateObjectURL(blob) as string;
    });

    const originalAppendChild = dom.window.document.body.appendChild;
    const appendChildSpy = vi
      .spyOn(dom.window.document.body, "appendChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          callOrder.push("appendChild");
        }
        return originalAppendChild.call(dom.window.document.body, node);
      });

    clickSpy.mockImplementation(() => {
      callOrder.push("click");
    });

    const originalRemoveChild = dom.window.document.body.removeChild;
    const removeChildSpy = vi
      .spyOn(dom.window.document.body, "removeChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          callOrder.push("removeChild");
        }
        return originalRemoveChild.call(dom.window.document.body, node);
      });

    const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
    globalThis.URL.revokeObjectURL = vi.fn().mockImplementation((url: string) => {
      callOrder.push("revokeObjectURL");

      return originalRevokeObjectURL(url) as void;
    });

    downloadFile("test", "file.txt", "text/plain");

    expect(callOrder).toEqual([
      "createObjectURL",
      "appendChild",
      "click",
      "removeChild",
      "revokeObjectURL",
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.URL.createObjectURL as any).mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.URL.revokeObjectURL as any).mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("should create correct blob content for binary data", () => {
    const binaryContent = new Uint8Array([72, 101, 108, 108, 111]);

    downloadFile(binaryContent, "hello.bin", "application/octet-stream");

    expect(objectUrls).toHaveLength(0);
  });

  it("should handle long filenames", () => {
    const longFilename = "a".repeat(200) + ".txt";

    const originalAppendChild = dom.window.document.body.appendChild;
    const originalRemoveChild = dom.window.document.body.removeChild;

    let capturedAnchor: HTMLAnchorElement | null = null;

    const appendChildSpy = vi
      .spyOn(dom.window.document.body, "appendChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          capturedAnchor = node;
        }
        return originalAppendChild.call(dom.window.document.body, node);
      });

    const removeChildSpy = vi
      .spyOn(dom.window.document.body, "removeChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          return originalRemoveChild.call(dom.window.document.body, node);
        }
        return node;
      });

    downloadFile("content", longFilename, "text/plain");

    expect(capturedAnchor).not.toBeNull();
    const anchor = capturedAnchor as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe(longFilename);

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("should handle special characters in filename", () => {
    const filename = "my file (1) [test].txt";

    const originalAppendChild = dom.window.document.body.appendChild;
    const originalRemoveChild = dom.window.document.body.removeChild;

    let capturedAnchor: HTMLAnchorElement | null = null;

    const appendChildSpy = vi
      .spyOn(dom.window.document.body, "appendChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          capturedAnchor = node as HTMLAnchorElement;
        }
        return originalAppendChild.call(dom.window.document.body, node);
      });

    const removeChildSpy = vi
      .spyOn(dom.window.document.body, "removeChild")
      .mockImplementation((node) => {
        if (node instanceof dom.window.HTMLAnchorElement) {
          return originalRemoveChild.call(dom.window.document.body, node);
        }
        return node;
      });

    downloadFile("content", filename, "text/plain");

    expect(capturedAnchor).not.toBeNull();
    const anchor = capturedAnchor as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe(filename);

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
