/**
 * Print a titled console section with the given output.
 *
 * Trims `output`, prints a header line `# <title>`, then prints the trimmed content or
 * "(no results)" when the trimmed output is empty.
 *
 * @param title - Section title printed after the `#` prefix
 * @param output - Section content; whitespace-only content is treated as empty
 */
export function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}
