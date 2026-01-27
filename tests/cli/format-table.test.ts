import { describe, it, expect } from "vitest";
import { formatTable } from "../../src/cli/utils/format-table.js";
import { colors } from "../../src/cli/utils/colors.js";

describe("formatTable", () => {
  it("returns empty string for no rows", () => {
    expect(formatTable([], ["Name"], ["name"])).toBe("");
  });

  it("formats headers and rows with padding", () => {
    const output = formatTable(
      [
        { name: "A", value: 1 },
        { name: "BBB", value: 10 },
      ],
      ["Name", "Value"],
      ["name", "value"]
    );

    expect(output).toBe(["Name  Value", "----  -----", "A     1    ", "BBB   10   "].join("\n"));
  });

  it("handles nulls and undefined values", () => {
    const output = formatTable(
      [{ name: null, value: undefined }],
      ["Name", "Value"],
      ["name", "value"]
    );

    expect(output).toContain("Name  Value");
    expect(output.split("\n")[2]).toBe("           ");
  });
});

describe("colors", () => {
  it("wraps text with ANSI codes", () => {
    expect(colors.green("ok")).toBe("\x1b[32mok\x1b[0m");
    expect(colors.gray("muted")).toBe("\x1b[90mmuted\x1b[0m");
    expect(colors.dim("dim")).toBe("\x1b[2mdim\x1b[0m");
    expect(colors.bold("bold")).toBe("\x1b[1mbold\x1b[0m");
    expect(colors.red("err")).toBe("\x1b[31merr\x1b[0m");
    expect(colors.cyan("info")).toBe("\x1b[36minfo\x1b[0m");
  });
});
