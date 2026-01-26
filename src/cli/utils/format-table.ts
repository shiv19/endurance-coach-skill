export function formatTable(
  rows: Array<Record<string, unknown>>,
  headers: string[],
  keys: string[]
): string {
  if (rows.length === 0) return "";

  const stringRows = rows.map((row) =>
    keys.map((key) => {
      const value = row[key];
      return value === null || value === undefined ? "" : String(value);
    })
  );

  const widths = keys.map((_, idx) =>
    Math.max(headers[idx].length, ...stringRows.map((row) => row[idx].length))
  );

  const headerLine = headers.map((header, idx) => header.padEnd(widths[idx])).join("  ");
  const separatorLine = widths.map((width) => "-".repeat(width)).join("  ");
  const bodyLines = stringRows.map((row) =>
    row.map((cell, idx) => cell.padEnd(widths[idx])).join("  ")
  );

  return [headerLine, separatorLine, ...bodyLines].join("\n");
}
