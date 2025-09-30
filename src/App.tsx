import React, { useState, useMemo } from "react";

const NAMASTE_CODES = [
  {
    code: "ASU-1001",
    display: "Āmavāta",
    designations: ["Amavata", "आमवात", "Rheumatic disorder"],
  },
  {
    code: "ASU-1022",
    display: "Prameha",
    designations: ["प्रमेह", "Prameha (urinary disorders)"],
  },
];

const ICD11_CODES = [
  { code: "TM2-SK6A", display: "Wind pattern affecting joints" },
  { code: "MG30.0", display: "Rheumatoid arthritis, seropositive" },
  { code: "5A11", display: "Type 2 diabetes mellitus" },
];

function searchNamaste(query: string) {
  const q = query.toLowerCase();
  return NAMASTE_CODES.filter(
    (c) =>
      c.display.toLowerCase().includes(q) ||
      c.designations.some((d) => d.toLowerCase().includes(q))
  );
}

export default function App() {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchNamaste(q), [q]);
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        NAMASTE ↔ ICD-11 Mapping Prototype
      </h1>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search NAMASTE (e.g. Amavata, Prameha)"
        className="w-full p-2 border rounded mb-4"
      />

      <div className="space-y-2">
        {results.map((r) => (
          <button
            key={r.code}
            onClick={() => setSelected(r)}
            className={`block w-full text-left p-3 rounded border ${
              selected?.code === r.code
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            }`}
          >
            <div className="font-medium">
              {r.display} <span className="text-sm text-gray-500">({r.code})</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {r.designations.join(", ")}
            </div>
          </button>
        ))}
        {q && results.length === 0 && (
          <div className="text-gray-500 text-sm">No matches found.</div>
        )}
      </div>

      {selected && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">ICD-11 Suggestions</h2>
          <ul className="space-y-2">
            {ICD11_CODES.map((icd) => (
              <li
                key={icd.code}
                className="border rounded p-3 flex justify-between items-center"
              >
                <span>
                  {icd.display}{" "}
                  <span className="text-sm text-gray-500">({icd.code})</span>
                </span>
                <button className="text-sm px-3 py-1 border rounded bg-blue-600 text-white">
                  Select
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
