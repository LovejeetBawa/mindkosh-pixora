import { useState } from "react";
import type { ReactNode } from "react";
export const inputStyle =
  "mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900";
export const buttonStyle =
  "rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function Toolkit({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mb-7 mt-3 text-slate-600">{description}</p>
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        {children}
      </div>
      <p className="mt-5 text-sm text-slate-500">
        Runs locally in your browser. Inputs are not uploaded or saved.
      </p>
    </main>
  );
}
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          aria-pressed={tab === value}
          onClick={() => onChange(tab)}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${tab === value ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 hover:bg-indigo-50"}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
export function Output({
  value,
  name = "Result",
  filename = "mindkosh-result.txt",
}: {
  value: string;
  name?: string;
  filename?: string;
}) {
  const [notice, setNotice] = useState("");
  return (
    <div className="mt-5">
      <label className="block text-sm font-semibold">
        {name}
        <textarea
          aria-label={name}
          readOnly
          value={value}
          className={`${inputStyle} min-h-36 font-mono`}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={!value}
          className={buttonStyle}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setNotice("Copied.");
            } catch {
              setNotice("Select the result and copy manually.");
            }
          }}
        >
          Copy result
        </button>
        <button
          disabled={!value}
          className="rounded-xl border px-4 py-2"
          onClick={() =>
            saveFile(
              new Blob([value], { type: "text/plain;charset=utf-8" }),
              filename,
            )
          }
        >
          Download result
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-2 text-sm text-indigo-700">
          {notice}
        </p>
      )}
    </div>
  );
}
