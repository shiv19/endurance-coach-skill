/**
 * Format an array of object rows into a plain-text table with aligned columns.
 *
 * @param rows - Array of records representing table rows; each object's properties are read using `keys`.
 * @param headers - Column header titles in the order to appear in the table.
 * @param keys - Object property keys that determine column order and which values to include from each row.
 * @returns A single string containing the table (header, separator, and body lines) or an empty string if `rows` is empty.
 */
export function formatTable(
  rows: Array<Record<string, unknown>>,
  headers: string[],
  keys: string[]
): string {
  if (headers.length !== keys.length) {
    throw new Error(
      `formatTable: headers length (${headers.length}) must match keys length (${keys.length})`
    );
  }
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
