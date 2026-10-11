export function pageSelection(input: string, count: number): number[] {
  if (!input.trim()) return Array.from({ length: count }, (_, i) => i);
  const result: number[] = [];
  for (const part of input.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw Error("Use page numbers such as 1,3-5.");
    const a = Number(m[1]),
      b = Number(m[2] ?? m[1]);
    if (a < 1 || b < 1 || a > count || b > count)
      throw Error(`Pages must be between 1 and ${count}.`);
    const direction = a <= b ? 1 : -1;
    for (let n = a; ; n += direction) {
      result.push(n - 1);
      if (result.length > 300) throw Error("Select up to 300 output pages.");
      if (n === b) break;
    }
  }
  return result;
}
