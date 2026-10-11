import { useState } from "react";
import { textAction, textStats } from "./core";
import { Toolkit, Tabs, Output, inputStyle, buttonStyle } from "./ui";
export default function TextTools() {
  const [tab, setTab] = useState("Word Counter");
  const [text, setText] = useState("");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [error, setError] = useState("");
  const stats = textStats(text);
  return (
    <Toolkit
      title="Text Tools"
      description="Count words, change case, clean up text and replace phrases. Supports Unicode text, including Hindi."
    >
      <Tabs
        tabs={[
          "Word Counter",
          "Case Converter",
          "Text Cleanup",
          "Find & Replace",
        ]}
        value={tab}
        onChange={(value) => {
          setTab(value);
          setError("");
        }}
      />
      <label className="block text-sm font-semibold">
        Your text
        <textarea
          aria-label="Your text"
          className={`${inputStyle} min-h-56`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste your text here…"
        />
      </label>
      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries({
          Words: stats.words,
          Characters: stats.characters,
          "Without spaces": stats.noSpaces,
          Lines: stats.lines,
          "Reading minutes": stats.readingMinutes,
        }).map(([label, count]) => (
          <div key={label} className="rounded-xl bg-indigo-50 p-3">
            <strong className="block text-2xl text-indigo-700">{count}</strong>
            <span className="text-xs text-slate-600">{label}</span>
          </div>
        ))}
      </div>
      {tab === "Case Converter" && (
        <div className="flex flex-wrap gap-2">
          {[
            ["upper", "UPPERCASE"],
            ["lower", "lowercase"],
            ["title", "Title Case"],
            ["sentence", "Sentence case"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={buttonStyle}
              onClick={() => setText(textAction(text, key))}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === "Text Cleanup" && (
        <div className="flex flex-wrap gap-2">
          {[
            ["spaces", "Trim extra spaces"],
            ["dedupe", "Remove duplicate lines"],
            ["sort", "Sort lines"],
            ["empty", "Remove empty lines"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={buttonStyle}
              onClick={() => setText(textAction(text, key))}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === "Find & Replace" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Find (literal text)
            <input
              className={inputStyle}
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Replace with
            <input
              className={inputStyle}
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
            />
          </label>
          <button
            className={buttonStyle}
            onClick={() => {
              if (!find) {
                setError("Enter text to find.");
                return;
              }
              setText(text.split(find).join(replace));
              setError("");
            }}
          >
            Replace all
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-700">
          {error}
        </p>
      )}
      <Output value={text} name="Current text" filename="mindkosh-text.txt" />
      <button
        className="mt-4 text-sm text-slate-500 underline"
        onClick={() => setText("")}
      >
        Clear text
      </button>
    </Toolkit>
  );
}
