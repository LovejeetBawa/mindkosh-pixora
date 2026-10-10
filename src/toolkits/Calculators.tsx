import { useState } from "react";
import { bmi, convert, emi, gst, units } from "./core";
import { Toolkit, Tabs, Output, inputStyle, buttonStyle } from "./ui";
const number = (value: string) => {
  if (!value.trim() || !Number.isFinite(Number(value)))
    throw Error("Fill all fields with valid numbers.");
  return Number(value);
};
const format = (value: number) => {
  if (!Number.isFinite(value))
    throw Error("Result is too large. Use smaller inputs.");
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 }).format(
    value,
  );
};
export default function Calculators() {
  const [tab, setTab] = useState("Percentage");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [operation, setOperation] = useState("of");
  const [inclusive, setInclusive] = useState(false);
  const [group, setGroup] = useState("Length");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("cm");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  function calculate() {
    try {
      const x = number(a);
      let out = "";
      if (tab === "Percentage") {
        const y = number(b);
        if (operation === "of")
          out = `${format(x)}% of ${format(y)} = ${format((x * y) / 100)}`;
        else if (operation === "part") {
          if (y === 0) throw Error("The total cannot be zero.");
          out = `${format(x)} is ${format((x / y) * 100)}% of ${format(y)}`;
        } else {
          if (x === 0) throw Error("The original value cannot be zero.");
          out = `Percentage change: ${format(((y - x) / Math.abs(x)) * 100)}%`;
        }
      } else if (tab === "GST") {
        const r = gst(x, number(b), inclusive);
        out = `Base amount: ₹${format(r.base)}\nGST: ₹${format(r.tax)}\nTotal: ₹${format(r.total)}`;
      } else if (tab === "EMI") {
        const r = emi(x, number(b), number(c));
        out = `Monthly EMI: ₹${format(r.payment)}\nTotal interest: ₹${format(r.interest)}\nTotal payment: ₹${format(r.total)}`;
      } else if (tab === "BMI") {
        const r = bmi(x, number(b));
        out = `BMI: ${format(r.value)}\nAdult category: ${r.category}`;
      } else
        out = `${format(x)} ${from} = ${format(convert(x, group, from, to))} ${to}`;
      setResult(out);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setResult("");
    }
  }
  const field = (label: string, value: string, change: (v: string) => void) => (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => {
          change(e.target.value);
          setResult("");
        }}
        className={inputStyle}
      />
    </label>
  );
  return (
    <Toolkit
      title="Calculators"
      description="Percentage, GST, loan EMI, adult BMI and unit conversion with clearly explained results."
    >
      <Tabs
        tabs={["Percentage", "GST", "EMI", "BMI", "Unit Converter"]}
        value={tab}
        onChange={(value) => {
          setTab(value);
          setA("");
          setB("");
          setC("");
          setResult("");
          setError("");
        }}
      />
      {tab === "Percentage" && (
        <>
          <label className="mb-4 block text-sm">
            Calculation
            <select
              className={inputStyle}
              value={operation}
              onChange={(e) => {
                setOperation(e.target.value);
                setResult("");
              }}
            >
              <option value="of">X percent of a value</option>
              <option value="part">X is what percent of total?</option>
              <option value="change">Percentage increase / decrease</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              operation === "of"
                ? "Percentage (%)"
                : operation === "part"
                  ? "Part"
                  : "Original value",
              a,
              setA,
            )}
            {field(
              operation === "part"
                ? "Total"
                : operation === "change"
                  ? "New value"
                  : "Value",
              b,
              setB,
            )}
          </div>
        </>
      )}
      {tab === "GST" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Amount (₹)", a, setA)}
            {field("GST rate (%)", b, setB)}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inclusive}
              onChange={(e) => {
                setInclusive(e.target.checked);
                setResult("");
              }}
            />
            Amount already includes GST
          </label>
          <p className="mt-3 text-xs text-slate-500">
            Enter the tax rate applicable to your goods or services.
          </p>
        </>
      )}
      {tab === "EMI" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {field("Loan amount (₹)", a, setA)}
          {field("Annual interest (%)", b, setB)}
          {field("Tenure (months)", c, setC)}
        </div>
      )}
      {tab === "BMI" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Weight (kg)", a, setA)}
            {field("Height (cm)", b, setB)}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Adult BMI is a general screening measure, not a diagnosis. These
            categories do not apply to children or pregnancy.
          </p>
        </>
      )}
      {tab === "Unit Converter" && (
        <>
          <label className="mb-4 block text-sm">
            Unit category
            <select
              className={inputStyle}
              value={group}
              onChange={(e) => {
                const g = e.target.value;
                setGroup(g);
                const keys = Object.keys(units[g]);
                setFrom(keys[0]);
                setTo(keys[1]);
                setResult("");
              }}
            >
              {Object.keys(units).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("Value", a, setA)}
            <label className="text-sm">
              From
              <select
                className={inputStyle}
                aria-label="From"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setResult("");
                }}
              >
                {Object.keys(units[group]).map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              To
              <select
                className={inputStyle}
                aria-label="To"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setResult("");
                }}
              >
                {Object.keys(units[group]).map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      <button className={`${buttonStyle} mt-5`} onClick={calculate}>
        Calculate
      </button>
      {error && (
        <p role="alert" className="mt-3 text-red-700">
          {error}
        </p>
      )}
      <Output value={result} />
      {tab === "EMI" && (
        <p className="mt-3 text-xs text-slate-500">
          Estimate for a fixed rate and monthly payments, excluding lender fees
          and insurance.
        </p>
      )}
    </Toolkit>
  );
}
