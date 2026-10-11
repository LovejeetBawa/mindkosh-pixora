export function words(text: string) {
  return text.trim().match(/\S+/gu) || [];
}
export function textStats(text: string) {
  return {
    words: words(text).length,
    characters: [...text].length,
    noSpaces: [...text.replace(/\s/gu, "")].length,
    lines: text ? text.split(/\r?\n/).length : 0,
    readingMinutes: Math.ceil(words(text).length / 200),
  };
}
export function textAction(text: string, action: string) {
  switch (action) {
    case "upper":
      return text.toLocaleUpperCase();
    case "lower":
      return text.toLocaleLowerCase();
    case "title":
      return text
        .toLocaleLowerCase()
        .replace(
          /(^|\s)(\p{L})/gu,
          (_, start, letter) => start + letter.toLocaleUpperCase(),
        );
    case "sentence":
      return text
        .toLocaleLowerCase()
        .replace(
          /(^|[.!?]\s+)(\p{L})/gu,
          (_, start, letter) => start + letter.toLocaleUpperCase(),
        );
    case "spaces":
      return text
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/[^\S\r\n]+/g, " "))
        .join("\n")
        .trim();
    case "dedupe":
      return [...new Set(text.split(/\r?\n/))].join("\n");
    case "sort":
      return text
        .split(/\r?\n/)
        .sort((a, b) => a.localeCompare(b))
        .join("\n");
    case "empty":
      return text
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .join("\n");
    default:
      return text;
  }
}
export function emi(principal: number, annualRate: number, months: number) {
  if (
    !Number.isFinite(principal) ||
    principal <= 0 ||
    !Number.isFinite(annualRate) ||
    annualRate < 0 ||
    !Number.isInteger(months) ||
    months <= 0 ||
    months > 1200
  )
    throw new Error(
      "Enter a positive loan, non-negative rate and 1–1200 whole months.",
    );
  const rate = annualRate / 1200;
  const payment =
    rate === 0
      ? principal / months
      : (principal * rate) / (1 - Math.pow(1 + rate, -months));
  return {
    payment,
    total: payment * months,
    interest: payment * months - principal,
  };
}
export function gst(amount: number, rate: number, inclusive: boolean) {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100
  )
    throw new Error("Enter a non-negative amount and a tax rate from 0–100.");
  const base = inclusive ? amount / (1 + rate / 100) : amount;
  return { base, tax: (base * rate) / 100, total: base * (1 + rate / 100) };
}
export function bmi(weight: number, height: number) {
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    weight <= 0 ||
    height <= 0
  )
    throw new Error("Enter positive weight and height.");
  const value = weight / (height / 100) ** 2;
  return {
    value,
    category:
      value < 18.5
        ? "Underweight"
        : value < 25
          ? "Healthy range"
          : value < 30
            ? "Overweight"
            : "Obesity range",
  };
}
export const units: Record<string, Record<string, number>> = {
  Length: {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    km: 1000,
    inch: 0.0254,
    foot: 0.3048,
    mile: 1609.344,
  },
  Weight: {
    mg: 0.000001,
    g: 0.001,
    kg: 1,
    tonne: 1000,
    ounce: 0.028349523125,
    pound: 0.45359237,
  },
  Area: {
    "square metre": 1,
    "square foot": 0.09290304,
    hectare: 10000,
    acre: 4046.8564224,
  },
  Temperature: { Celsius: 1, Fahrenheit: 1, Kelvin: 1 },
};
export function convert(
  value: number,
  group: string,
  from: string,
  to: string,
) {
  if (!Number.isFinite(value) || !units[group]?.[from] || !units[group]?.[to])
    throw new Error("Enter a valid value and units.");
  if (group !== "Temperature")
    return (value * units[group][from]) / units[group][to];
  const celsius =
    from === "Fahrenheit"
      ? ((value - 32) * 5) / 9
      : from === "Kelvin"
        ? value - 273.15
        : value;
  if (celsius < -273.15 - 1e-8)
    throw new Error("Temperature cannot be below absolute zero.");
  return to === "Fahrenheit"
    ? (celsius * 9) / 5 + 32
    : to === "Kelvin"
      ? celsius + 273.15
      : celsius;
}
export function encodeBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function decodeBase64(text: string) {
  const compact = text.replace(/\s/g, "");
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      compact,
    )
  )
    throw new Error("Invalid Base64 input (include required padding).");
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(compact), (char) => char.charCodeAt(0)),
  );
}
export function hexToRgb(text: string) {
  let value = text.replace(/^#/, "").trim();
  if (/^[0-9a-f]{3}$/i.test(value))
    value = [...value].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(value))
    throw new Error("Enter a 3- or 6-digit HEX colour.");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}
export function rgbToHex(r: number, g: number, b: number) {
  if (![r, g, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255))
    throw new Error("RGB channels must be whole numbers from 0–255.");
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}
// Rejection sampling avoids modulo bias for any alphabet length.
export function securePassword(length: number, alphabet: string) {
  if (
    !Number.isInteger(length) ||
    length < 8 ||
    length > 128 ||
    !alphabet ||
    alphabet.length > 256
  )
    throw new Error("Choose 8–128 characters and at least one character set.");
  const limit = 256 - (256 % alphabet.length);
  let output = "";
  while (output.length < length)
    for (const byte of crypto.getRandomValues(new Uint8Array(128))) {
      if (byte < limit) output += alphabet[byte % alphabet.length];
      if (output.length === length) break;
    }
  return output;
}
