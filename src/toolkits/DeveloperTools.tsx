import { useState } from "react";
import {
  encodeBase64,
  decodeBase64,
  hexToRgb,
  rgbToHex,
  securePassword,
} from "./core";
import { Toolkit, Tabs, Output, inputStyle, buttonStyle } from "./ui";
const sets = {
  Uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  Lowercase: "abcdefghijklmnopqrstuvwxyz",
  Digits: "0123456789",
  Symbols: "!@#$%^&*()-_=+[]{}:,.?",
};
export default function DeveloperTools() {
  const [tab, setTab] = useState("JSON");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [length, setLength] = useState(20);
  const [selected, setSelected] = useState<string[]>(Object.keys(sets));
  const [hex, setHex] = useState("#6366f1");
  const [r, setR] = useState("99");
  const [g, setG] = useState("102");
  const [b, setB] = useState("241");
  const [colour, setColour] = useState("#6366f1");
  async function run(action: string) {
    setError("");
    try {
      let value = "";
      if (action === "format" || action === "minify") {
        const parsed = JSON.parse(text);
        value = JSON.stringify(
          parsed,
          null,
          action === "format" ? 2 : undefined,
        );
      } else if (action === "base64encode") value = encodeBase64(text);
      else if (action === "base64decode") value = decodeBase64(text);
      else if (action === "urlencode") value = encodeURIComponent(text);
      else if (action === "urldecode") value = decodeURIComponent(text);
      else if (action === "htmlencode")
        value = text.replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c]!,
        );
      else if (action === "htmldecode") {
        const element = document.createElement("textarea");
        element.innerHTML = text;
        value = element.value;
      } else if (action === "hash") {
        const hash = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(text),
        );
        value = [...new Uint8Array(hash)]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      } else if (action === "password") {
        const alphabets = selected.map((key) => sets[key as keyof typeof sets]);
        do {
          value = securePassword(length, alphabets.join(""));
        } while (
          alphabets.some((chars) => ![...value].some((c) => chars.includes(c)))
        );
      } else if (action === "uuid") value = crypto.randomUUID();
      else if (action === "hex") {
        const rgb = hexToRgb(hex);
        value = `RGB: rgb(${rgb.join(", ")})\nHEX: ${rgbToHex(rgb[0], rgb[1], rgb[2])}`;
        setR(String(rgb[0]));
        setG(String(rgb[1]));
        setB(String(rgb[2]));
        setColour(rgbToHex(rgb[0], rgb[1], rgb[2]));
      } else if (action === "rgb") {
        if ([r, g, b].some((v) => !v.trim()))
          throw Error("Fill each RGB channel.");
        const valueHex = rgbToHex(Number(r), Number(g), Number(b));
        setHex(valueHex);
        setColour(valueHex);
        value = `HEX: ${valueHex}\nRGB: rgb(${r}, ${g}, ${b})`;
      }
      setResult(value);
    } catch (e) {
      setResult("");
      setError((e as Error).message);
    }
  }
  const actions: Record<string, [string, string][]> = {
    JSON: [
      ["format", "Format JSON"],
      ["minify", "Minify JSON"],
    ],
    Encoding: [
      ["base64encode", "Base64 encode"],
      ["base64decode", "Base64 decode"],
      ["urlencode", "URL encode"],
      ["urldecode", "URL decode"],
      ["htmlencode", "HTML escape"],
      ["htmldecode", "HTML unescape"],
    ],
    "SHA-256": [["hash", "Generate SHA-256"]],
    Random: [
      ["password", "Generate password"],
      ["uuid", "Generate UUID"],
    ],
    Colour: [
      ["hex", "HEX to RGB"],
      ["rgb", "RGB to HEX"],
    ],
  };
  return (
    <Toolkit
      title="Developer Tools"
      description="Format JSON, encode Unicode text, generate hashes and secure random values, and convert colours."
    >
      <Tabs
        tabs={Object.keys(actions)}
        value={tab}
        onChange={(value) => {
          setTab(value);
          setResult("");
          setError("");
        }}
      />
      {["JSON", "Encoding", "SHA-256"].includes(tab) && (
        <label className="block text-sm font-semibold">
          Input
          <textarea
            aria-label="Input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult("");
            }}
            className={`${inputStyle} min-h-52 font-mono`}
            spellCheck={false}
          />
        </label>
      )}
      {tab === "JSON" && (
        <p className="mt-3 text-xs text-slate-500">
          Validates strict JSON. Quote very large integer identifiers to
          preserve their exact digits.
        </p>
      )}
      {tab === "Random" && (
        <>
          <label className="block max-w-xs text-sm">
            Password length
            <input
              type="number"
              min={8}
              max={128}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className={inputStyle}
            />
          </label>
          <div className="my-4 flex flex-wrap gap-4">
            {Object.keys(sets).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, key]
                        : selected.filter((v) => v !== key),
                    )
                  }
                />
                {key}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Generated on your device using secure randomness. Passwords include
            each selected character set.
          </p>
        </>
      )}
      {tab === "Colour" && (
        <>
          <div
            className="mb-4 h-20 rounded-xl border"
            style={{ backgroundColor: colour }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              HEX colour
              <input
                className={inputStyle}
                value={hex}
                onChange={(e) => setHex(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Red", r, setR],
                ["Green", g, setG],
                ["Blue", b, setB],
              ].map(([label, value, change]) => (
                <label key={String(label)} className="text-sm">
                  {String(label)}
                  <input
                    type="number"
                    min={0}
                    max={255}
                    className={inputStyle}
                    value={String(value)}
                    onChange={(e) =>
                      (change as (v: string) => void)(e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {actions[tab].map(([key, label]) => (
          <button
            key={key}
            className={buttonStyle}
            onClick={() => void run(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 break-words text-sm text-red-700">
          {error}
        </p>
      )}
      <Output
        value={result}
        filename={tab === "JSON" ? "mindkosh.json" : "mindkosh-result.txt"}
      />
    </Toolkit>
  );
}
