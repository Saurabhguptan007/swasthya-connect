import React, { useState, useMemo } from "react";

// Mock NAMASTE codes
const NAMASTE_CODES = [
  {
    code: "ASU-1001",
    display: "Āmavāta",
    designations: ["Amavata", "आमवात", "Rheumatic disorder"]
  },
  {
    code: "ASU-1022",
    display: "Prameha",
    designations: ["प्रमेह", "Urinary disorder", "Madhumeha context"]
  }
];

// Mock ICD-11 mappings
const CONCEPT_MAP = {
  "ASU-1001": [
    { code: "TM2-SK6A", display: "Wind pattern affecting joints", equivalence: "narrower" },
    { code: "MG30.0", display: "Rheumatoid arthritis, seropositive", equivalence: "broader" }
  ],
  "ASU-1022": [
    { code: "TM2-QP1A", display: "Urination disorder pattern", equivalence: "equivalent" },
    { code: "5A11", display: "Type 2 diabetes mellitus", equivalence: "related" }
  ]
};

// Utility: simple search
function searchNamaste(query) {
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
  const [selected, setSelected] = useState(null);
  const [chosen, setChosen] = useState([]);

  // Build FHIR Condition
  const buildCondition = () => {
    if (!selected) return null;
    const coding = [
      { system: "https://example.org/fhir/CodeSystem/namaste", code: selected.code, display: selected.display },
      ...chosen.map((c) => ({
        system: "http://id.who.int/icd/release/11/mms",
        code: c.code,
        display: c.display
      }))
    ];
    return {
      resourceType: "Condition",
      clinicalStatus: { coding: [{ system: "http://hl7.org/fhir/condition-clinical", code: "active" }] },
      category: [{ coding: [{ system: "http://hl7.org/fhir/condition-category", code: "problem-list-item" }] }],
      code: { coding, text: `${selected.display} (dual-coded)` },
      subject: { reference: "Patient/123" },
      encounter: { reference: "Encounter/enc-001" },
      recordedDate: new Date().toISOString(),
      meta: {
        tag: [
          { system: "https://example.org/fhir/tags", code: "icd11-mms-2025-01" },
          { system: "https://example.org/fhir/tags", code: "namaste-csv-2025-08-20" }
        ]
      }
    };
  };

  // Build FHIR Bundle
  const buildBundle = (condition) => {
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        { resource: condition },
        {
          resource: {
            resourceType: "AuditEvent",
            action: "C",
            recorded: new Date().toISOString(),
            outcome: "0",
            source: { observer: { display: "Terminology Microservice (demo)" } },
            entity: [{ what: { display: "ConceptMap/$translate NAMASTE→ICD11" } }]
          }
        }
      ]
    };
  };

  const condition = buildCondition();
  const bundle = condition ? buildBundle(condition) : null;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">NAMASTE ↔ ICD-11 Mapping Prototype</h1>
      <p className="text-sm text-gray-600 mb-4">
        Demo of FHIR dual-coding | NAMASTE CSV 2025-08-20 • ICD-11 MMS 2025-01
      </p>

      {/* Search */}
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search NAMASTE (e.g. Amavata, Prameha)"
        className="w-full p-2 border rounded mb-4"
      />

      {/* Search Results */}
      <div className="space-y-2">
        {results.map((r) => (
          <button
            key={r.code}
            onClick={() => {
              setSelected(r);
              setChosen([]);
            }}
            className={`block w-full text-left p-3 rounded border ${
              selected?.code === r.code ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
          >
            <div className="font-medium">
              {r.display} <span className="text-sm text-gray-500">({r.code})</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{r.designations.join(", ")}</div>
          </button>
        ))}
        {q && results.length === 0 && (
          <div className="text-gray-500 text-sm">No matches found.</div>
        )}
      </div>

      {/* Mapping Suggestions */}
      {selected && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">ICD-11 Suggestions for {selected.display}</h2>
          <ul className="space-y-2">
            {CONCEPT_MAP[selected.code]?.map((icd) => (
              <li
                key={icd.code}
                className="border rounded p-3 flex justify-between items-center"
              >
                <span>
                  {icd.display}{" "}
                  <span className="text-sm text-gray-500">({icd.code})</span>{" "}
                  <span className="text-xs text-blue-600">[{icd.equivalence}]</span>
                </span>
                <button
                  className={`text-sm px-3 py-1 border rounded ${
                    chosen.find((c) => c.code === icd.code)
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 text-white"
                  }`}
                  onClick={() =>
                    setChosen((prev) =>
                      prev.find((c) => c.code === icd.code)
                        ? prev.filter((c) => c.code !== icd.code)
                        : [...prev, icd]
                    )
                  }
                >
                  {chosen.find((c) => c.code === icd.code) ? "Selected" : "Select"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generated FHIR JSON */}
      {bundle && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Generated FHIR Bundle</h2>
          <pre className="bg-black text-white text-xs p-4 rounded overflow-auto max-h-80">
            {JSON.stringify(bundle, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
