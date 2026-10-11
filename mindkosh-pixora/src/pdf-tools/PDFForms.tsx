import { useState } from "react";
import {
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { Toolkit, inputStyle, buttonStyle, saveFile } from "../toolkits/ui";
import { pdfSheets, type Sheet } from "../document-tools/files";
import RegionPreview from "../document-tools/RegionPreview";
import { initialRegion, type Region } from "../document-tools/cleanup";
import { readEditablePDF } from "./operations";
type Field = {
  name: string;
  kind: "text" | "check" | "select";
  value: string | boolean;
  options?: string[];
};
type Addition = {
  name: string;
  kind: "text" | "check";
  page: number;
  region: Region;
  value: string | boolean;
};
export default function PDFForms() {
  const [file, setFile] = useState<File | null>(null),
    [fields, setFields] = useState<Field[]>([]),
    [additions, setAdditions] = useState<Addition[]>([]),
    [sheets, setSheets] = useState<Sheet[]>([]),
    [index, setIndex] = useState(0),
    [region, setRegion] = useState<Region>(initialRegion),
    [kind, setKind] = useState<"text" | "check">("text"),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load(next: File) {
    setBusy(true);
    setError("");
    setNotice("");
    setFile(null);
    setFields([]);
    setAdditions([]);
    setSheets([]);
    try {
      const pdf = await readEditablePDF(next);
      const parsed: Field[] = [];
      for (const field of pdf.getForm().getFields()) {
        if (field instanceof PDFTextField)
          parsed.push({
            name: field.getName(),
            kind: "text",
            value: field.getText() ?? "",
          });
        else if (field instanceof PDFCheckBox)
          parsed.push({
            name: field.getName(),
            kind: "check",
            value: field.isChecked(),
          });
        else if (
          field instanceof PDFDropdown ||
          field instanceof PDFRadioGroup ||
          field instanceof PDFOptionList
        )
          parsed.push({
            name: field.getName(),
            kind: "select",
            value: field.getSelected()?.toString() ?? "",
            options: field.getOptions(),
          });
      }
      setFields(parsed);
      setSheets(await pdfSheets(next));
      setIndex(0);
      setFile(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function add() {
    setError("");
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      setError("Enter a unique field name, up to 100 characters.");
      return;
    }
    if (
      fields.some((f) => f.name === trimmed) ||
      additions.some((f) => f.name === trimmed)
    ) {
      setError("This field name already exists.");
      return;
    }
    if (fields.length + additions.length >= 100) {
      setError("Use up to 100 editable fields.");
      return;
    }
    setAdditions([
      ...additions,
      {
        name: trimmed,
        kind,
        page: index,
        region: { ...region },
        value: kind === "check" ? false : "",
      },
    ]);
    setName("");
    setNotice(
      "Field added. Set its value below, or leave it empty for the recipient to fill.",
    );
  }
  async function download() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const pdf = await readEditablePDF(file);
      const form = pdf.getForm();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (const addition of additions) {
        const page = pdf.getPage(addition.page);
        if (page.getRotation().angle % 360 !== 0)
          throw Error(
            "New fields require unrotated pages. Rotate the page to 0° in a PDF reader, then upload it again.",
          );
        const box = page.getCropBox();
        const r = addition.region;
        const options = {
          x: box.x + r.x * box.width,
          y: box.y + (1 - r.y - r.height) * box.height,
          width: r.width * box.width,
          height: r.height * box.height,
          borderWidth: 1,
          borderColor: rgb(0.3, 0.3, 0.6),
        };
        if (addition.kind === "text") {
          const field = form.createTextField(addition.name);
          field.addToPage(page, { ...options, font });
          field.setFontSize(12);
        } else {
          const field = form.createCheckBox(addition.name);
          const side = Math.min(options.width, options.height, 24);
          field.addToPage(page, { ...options, width: side, height: side });
        }
      }
      for (const entry of [...fields, ...additions]) {
        const field = form.getField(entry.name);
        if (field instanceof PDFTextField) {
          const value = String(entry.value);
          try {
            font.encodeText(value);
          } catch {
            throw Error(
              `Field "${entry.name}" contains characters this form font cannot encode. Use Latin characters; Hindi text can be added with PDF Editor as flattened text.`,
            );
          }
          field.setText(value);
        } else if (field instanceof PDFCheckBox) {
          if (entry.value) field.check();
          else field.uncheck();
        } else if (
          field instanceof PDFDropdown ||
          field instanceof PDFRadioGroup ||
          field instanceof PDFOptionList
        ) {
          if (entry.value) field.select(String(entry.value));
          else field.clear();
        }
      }
      form.updateFieldAppearances(font);
      saveFile(
        new Blob([new Uint8Array(await pdf.save())], {
          type: "application/pdf",
        }),
        "mindkosh-form.pdf",
      );
      setNotice(
        "Interactive PDF exported. Open it in a PDF reader to check field values and placement.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function editor(
    entry: Field | Addition,
    value: (v: string | boolean) => void,
  ) {
    return (
      <label key={entry.name} className="block rounded-xl border p-3">
        <span className="font-semibold">{entry.name}</span>
        {entry.kind === "check" ? (
          <input
            className="ml-3"
            type="checkbox"
            aria-label={entry.name}
            checked={Boolean(entry.value)}
            disabled={busy}
            onChange={(e) => value(e.target.checked)}
          />
        ) : entry.kind === "select" && "options" in entry ? (
          <select
            aria-label={entry.name}
            className={inputStyle}
            disabled={busy}
            value={String(entry.value)}
            onChange={(e) => value(e.target.value)}
          >
            <option value="">Choose option</option>
            {entry.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            aria-label={entry.name}
            className={inputStyle}
            value={String(entry.value)}
            disabled={busy}
            maxLength={2000}
            onChange={(e) => value(e.target.value)}
          />
        )}
      </label>
    );
  }
  return (
    <Toolkit
      title="PDF Forms"
      description="Fill supported interactive fields, or add text fields and checkboxes to an unrotated page."
    >
      <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm">
        Supports standard PDF text fields, checkboxes and single-choice lists.
        Scanned fields are not automatically detected. XFA forms and signature
        fields are not supported. New field values use Latin characters; output
        remains interactive. Some browsers need a PDF reader to edit downloaded
        forms.
      </p>
      <label>
        PDF file
        <input
          className={inputStyle}
          type="file"
          accept=".pdf"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
      </label>
      {file && (
        <>
          <h2 className="mt-5 text-xl font-bold">
            Existing fields ({fields.length})
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {fields.map((f, i) =>
              editor(f, (value) =>
                setFields(
                  fields.map((f, n) => (n === i ? { ...f, value } : f)),
                ),
              ),
            )}
          </div>
          {!fields.length && (
            <p className="mt-2 text-sm">
              No supported interactive fields found. Add fields below.
            </p>
          )}
          <h2 className="mt-6 text-xl font-bold">Add a field</h2>
          <label>
            Page
            <select
              className={inputStyle}
              disabled={busy}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            >
              {sheets.map((_, i) => (
                <option key={i} value={i}>
                  Page {i + 1}
                </option>
              ))}
            </select>
          </label>
          {sheets[index] && (
            <RegionPreview
              source={sheets[index].canvas}
              region={region}
              onChange={setRegion}
            />
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              Field name
              <input
                className={inputStyle}
                disabled={busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Field type
              <select
                className={inputStyle}
                disabled={busy}
                value={kind}
                onChange={(e) => setKind(e.target.value as "text" | "check")}
              >
                <option value="text">Text field</option>
                <option value="check">Checkbox</option>
              </select>
            </label>
          </div>
          <button
            className={`${buttonStyle} mt-3`}
            disabled={busy}
            onClick={add}
          >
            Add selected field
          </button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {additions.map((f, i) => (
              <div key={f.name}>
                {editor(f, (value) =>
                  setAdditions(
                    additions.map((f, n) => (n === i ? { ...f, value } : f)),
                  ),
                )}
                <button
                  className="mt-1 text-sm text-red-700"
                  disabled={busy}
                  onClick={() =>
                    setAdditions(additions.filter((_, n) => n !== i))
                  }
                >
                  Remove {f.name}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-indigo-700">
          {notice}
        </p>
      )}
      <button
        className={`${buttonStyle} mt-5`}
        disabled={!file || busy || (!fields.length && !additions.length)}
        onClick={() => void download()}
      >
        {busy ? "Processing…" : "Download interactive PDF"}
      </button>
    </Toolkit>
  );
}
