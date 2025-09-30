import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Copy, Download, Search, Shield, ShieldAlert, Sparkles, RefreshCcw, Link2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * SIH 2025 – Problem Statement ID 25026
 * Prototype: Dual-coding NAMASTE ↔ ICD-11 (TM2 + Biomed) inside a FHIR R4-friendly UI
 * - Zero-backend demo: all data is in-memory mocks to keep this a single-file prototype
 * - Shows: autocomplete (ValueSet/$expand feel), translate (ConceptMap/$translate feel),
 *          dual-coded Condition + Bundle generation, version/consent/audit placeholders
 * - Built to be easily swapped to real endpoints later
 */

// -----------------------------
// Mock vocabularies & mappings
// -----------------------------

// Minimal mock of a NAMASTE CodeSystem entry
// code format is illustrative only
const NAMASTE_CODES = [
  {
    code: "ASU-1001",
    display: "Āmavāta",
    designations: ["Amavata", "आमवात", "Rheumatic disorder (Ayurveda)", "Ama-vata"],
    system: "https://example.org/fhir/CodeSystem/namaste",
  },
  {
    code: "ASU-1022",
    display: "Prameha",
    designations: ["प्रमेह", "Prameha (urinary disorders)", "Madhumeha context"],
    system: "https://example.org/fhir/CodeSystem/namaste",
  },
  {
    code: "SID-0310",
    display: "Vatha Noi",
    designations: ["Vatha Noi (Siddha)", " वात दोष विकार "],
    system: "https://example.org/fhir/CodeSystem/namaste",
  },
];

// Minimal mock of ICD-11 (TM2 + Biomed) codes; codes are for illustration
const ICD11_TM2 = [
  { code: "TM2-SK6A", display: "Wind pattern affecting joints", system: "http://id.who.int/icd/release/11/mms" },
  { code: "TM2-JA5Z", display: "Accumulation pattern with dampness", system: "http://id.who.int/icd/release/11/mms" },
  { code: "TM2-QP1A", display: "Urination disorder pattern", system: "http://id.who.int/icd/release/11/mms" },
];

const ICD11_BIOMED = [
  { code: "MG30.0", display: "Rheumatoid arthritis, seropositive", system: "http://id.who.int/icd/release/11/mms" },
  { code: "5A11", display: "Type 2 diabetes mellitus", system: "http://id.who.int/icd/release/11/mms" },
  { code: "MB40.Z", display: "Inflammatory polyarthropathy, unspecified", system: "http://id.who.int/icd/release/11/mms" },
];

// ConceptMap-like structure connecting NAMASTE → TM2 and → Biomed with equivalence notes
const CONCEPT_MAP = [
  {
    source: "ASU-1001",
    targets: [
      { system: "ICD11-TM2", code: "TM2-SK6A", display: "Wind pattern affecting joints", equivalence: "narrower" },
      { system: "ICD11-BIOMED", code: "MG30.0", display: "Rheumatoid arthritis, seropositive", equivalence: "broader" },
      { system: "ICD11-BIOMED", code: "MB40.Z", display: "Inflammatory polyarthropathy, unspecified", equivalence: "unmatched" },
    ],
  },
  {
    source: "ASU-1022",
    targets: [
      { system: "ICD11-TM2", code: "TM2-QP1A", display: "Urination disorder pattern", equivalence: "equivalent" },
      { system: "ICD11-BIOMED", code: "5A11", display: "Type 2 diabetes mellitus", equivalence: "related" },
    ],
  },
  {
    source: "SID-0310",
    targets: [
      { system: "ICD11-TM2", code: "TM2-JA5Z", display: "Accumulation pattern with dampness", equivalence: "inexact" },
    ],
  },
];

// Version & governance placeholders
const VERSIONS = {
  namasteCsvDate: "2025-08-20",
  icd11Mms: "2025-01",
  serviceVersion: "0.1.0-proto",
};

// -----------------------------------
// Utility: simple search & fuzzy match
// -----------------------------------
function normalize(s: string) {
  return (s || "").toLowerCase().normalize("NFKD");
}

function searchNamaste(query: string) {
  const q = normalize(query);
  if (!q) return [] as typeof NAMASTE_CODES;
  return NAMASTE_CODES.filter((c) => {
    if (normalize(c.display).includes(q)) return true;
    return c.designations.some((d) => normalize(d).includes(q));
  }).slice(0, 20);
}

function translateNamasteToICD(sourceCode: string) {
  const row = CONCEPT_MAP.find((m) => m.source === sourceCode);
  return row ? row.targets : [];
}

// -----------------------------------
// FHIR builders (Condition, List/Problem, Bundle)
// -----------------------------------
function buildCondition({
  patientId,
  encounterId,
  namaste,
  chosenTm2,
  chosenBiomed,
}: {
  patientId: string;
  encounterId: string;
  namaste: { code: string; display: string; system: string };
  chosenTm2?: { code: string; display: string; system: string } | null;
  chosenBiomed?: { code: string; display: string; system: string } | null;
}) {
  const coding = [
    { system: namaste.system, code: namaste.code, display: namaste.display },
  ];
  if (chosenTm2) coding.push(chosenTm2);
  if (chosenBiomed) coding.push(chosenBiomed);

  return {
    resourceType: "Condition",
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-category",
            code: "problem-list-item",
          },
        ],
      },
    ],
    code: { coding, text: `${namaste.display} (dual-coded)` },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    recordedDate: new Date().toISOString(),
    meta: {
      tag: [
        { system: "https://example.org/fhir/tags", code: `icd11-mms-${VERSIONS.icd11Mms}` },
        { system: "https://example.org/fhir/tags", code: `namaste-csv-${VERSIONS.namasteCsvDate}` },
      ],
    },
  } as const;
}

function buildAuditEvent(action: string, outcome: "0" | "4" = "0") {
  return {
    resourceType: "AuditEvent",
    type: {
      system: "http://terminology.hl7.org/CodeSystem/audit-event-type",
      code: "rest",
    },
    action: "E",
    recorded: new Date().toISOString(),
    outcome, // 0 success, 4 minor failure (illustrative)
    source: { observer: { display: "Terminology Microservice (proto)" } },
    entity: [
      { what: { display: action }, detail: [{ type: "version", valueString: VERSIONS.icd11Mms }] },
    ],
  } as const;
}

function buildBundle(condition: any) {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      { resource: condition },
      { resource: buildAuditEvent("ConceptMap/$translate NAMASTE→ICD11") },
    ],
    meta: {
      profile: ["https://abdm.gov.in/fhir/r4/StructureDefinition/Bundle"],
      security: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
          code: "ETH",
          display: "with patient consent",
        },
      ],
    },
  } as const;
}

// -----------------------------
// Helpers: copy & download JSON
// -----------------------------
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadJson(obj: any, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// -----------------------------
// UI
// -----------------------------
export default function App() {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchNamaste(q), [q]);

  const [selected, setSelected] = useState<typeof NAMASTE_CODES[number] | null>(null);
  const [tm2Choice, setTm2Choice] = useState<any | null>(null);
  const [biomedChoice, setBiomedChoice] = useState<any | null>(null);

  const [patientId, setPatientId] = useState("123");
  const [encounterId, setEncounterId] = useState("enc-001");

  const translations = useMemo(() => (selected ? translateNamasteToICD(selected.code) : []), [selected]);

  const condition = useMemo(() => {
    if (!selected) return null;
    return buildCondition({
      patientId,
      encounterId,
      namaste: selected,
      chosenTm2: tm2Choice,
      chosenBiomed: biomedChoice,
    });
  }, [selected, tm2Choice, biomedChoice, patientId, encounterId]);

  const bundle = useMemo(() => (condition ? buildBundle(condition) : null), [condition]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight flex items-center gap-3">
            <Sparkles className="h-7 w-7" /> NAMASTE ↔ ICD‑11 (TM2 + Biomed) — Prototype
          </h1>
          <p className="text-slate-600 mt-1">FHIR R4-friendly demo of autocomplete, translate, and dual-coding for Problem List entries.</p>
          <div className="text-xs text-slate-500 mt-2">Versions: NAMASTE CSV {VERSIONS.namasteCsvDate} • ICD‑11 MMS {VERSIONS.icd11Mms} • Service {VERSIONS.serviceVersion}</div>
        </motion.div>

        <div className="grid md:grid-cols-5 gap-4">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5"/> Search NAMASTE / WHO Ayurveda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Type e.g., Amavata / Prameha / Vatha..." value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="space-y-2 max-h-64 overflow-auto">
                {results.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => {
                      setSelected(r);
                      setTm2Choice(null);
                      setBiomedChoice(null);
                    }}
                    className={`w-full text-left rounded-xl p-3 border hover:shadow-sm ${
                      selected?.code === r.code ? "border-blue-500 bg-blue-50" : "border-slate-200"
                    }`}
                  >
                    <div className="font-medium">{r.display} <span className="text-xs text-slate-500">({r.code})</span></div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-1">
                      {r.designations.map((d, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
                      ))}
                    </div>
                  </button>
                ))}
                {q && results.length === 0 && (
                  <div className="text-sm text-slate-500">No matches. Try another spelling or synonym.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5"/> Map to ICD‑11</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected && <div className="text-sm text-slate-500">Select a NAMASTE term to see TM2/biomed suggestions.</div>}
              {selected && (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Selected NAMASTE</div>
                    <div className="text-base font-medium">{selected.display} <span className="text-xs text-slate-500">({selected.code})</span></div>
                  </div>

                  <Tabs defaultValue="tm2" className="w-full">
                    <TabsList>
                      <TabsTrigger value="tm2">ICD‑11 TM2</TabsTrigger>
                      <TabsTrigger value="biomed">ICD‑11 Biomed</TabsTrigger>
                    </TabsList>
                    <TabsContent value="tm2">
                      <div className="space-y-2">
                        {translations.filter(t=>t.system==="ICD11-TM2").map((t) => (
                          <div key={t.code} className={`flex items-center justify-between border rounded-xl p-3 ${tm2Choice?.code===t.code?"border-blue-500 bg-blue-50":"border-slate-200"}`}>
                            <div>
                              <div className="font-medium">{t.display}</div>
                              <div className="text-xs text-slate-500">{t.code} • equivalence: {t.equivalence}</div>
                            </div>
                            <Button variant={tm2Choice?.code===t.code?"default":"secondary"} onClick={()=>setTm2Choice({ system: "http://id.who.int/icd/release/11/mms", code: t.code, display: t.display })}>
                              {tm2Choice?.code===t.code? <><Check className="h-4 w-4 mr-1"/>Selected</>:"Select"}
                            </Button>
                          </div>
                        ))}
                        {translations.filter(t=>t.system==="ICD11-TM2").length===0 && (
                          <div className="text-sm text-slate-500">No TM2 mapping available in mock data.</div>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="biomed">
                      <div className="space-y-2">
                        {translations.filter(t=>t.system==="ICD11-BIOMED").map((t) => (
                          <div key={t.code} className={`flex items-center justify-between border rounded-xl p-3 ${biomedChoice?.code===t.code?"border-blue-500 bg-blue-50":"border-slate-200"}`}>
                            <div>
                              <div className="font-medium">{t.display}</div>
                              <div className="text-xs text-slate-500">{t.code} • equivalence: {t.equivalence}</div>
                            </div>
                            <Button variant={biomedChoice?.code===t.code?"default":"secondary"} onClick={()=>setBiomedChoice({ system: "http://id.who.int/icd/release/11/mms", code: t.code, display: t.display })}>
                              {biomedChoice?.code===t.code? <><Check className="h-4 w-4 mr-1"/>Selected</>:"Select"}
                            </Button>
                          </div>
                        ))}
                        {translations.filter(t=>t.system==="ICD11-BIOMED").length===0 && (
                          <div className="text-sm text-slate-500">No biomed mapping available in mock data.</div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-5 gap-4">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5"/> Encounter & Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-600 mb-1">Patient ID</div>
                  <Input value={patientId} onChange={(e)=>setPatientId(e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-slate-600 mb-1">Encounter ID</div>
                  <Input value={encounterId} onChange={(e)=>setEncounterId(e.target.value)} />
                </div>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2"><ShieldAlert className="h-4 w-4"/> Prototype uses implicit consent; real build must validate ABDM consent & OAuth2 tokens.</div>
              <Button variant="outline" onClick={()=>alert("In real build, this would open ABDM login/consent.")}>Simulate ABDM Consent Flow</Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RefreshCcw className="h-5 w-5"/> Generated FHIR Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!condition && <div className="text-sm text-slate-500">Pick mappings to generate Condition and Bundle.</div>}
              {condition && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Condition (dual-coded)</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={()=>copyToClipboard(JSON.stringify(condition, null, 2))}><Copy className="h-4 w-4 mr-1"/>Copy</Button>
                      <Button size="sm" onClick={()=>downloadJson(condition, "condition.json")}><Download className="h-4 w-4 mr-1"/>Download</Button>
                    </div>
                  </div>
                  <pre className="bg-slate-950 text-slate-50 text-xs p-4 rounded-xl overflow-auto max-h-64">{JSON.stringify(condition, null, 2)}</pre>

                  {bundle && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Bundle (Encounter + Condition + AuditEvent)</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={()=>copyToClipboard(JSON.stringify(bundle, null, 2))}><Copy className="h-4 w-4 mr-1"/>Copy</Button>
                          <Button size="sm" onClick={()=>downloadJson(bundle, "bundle.json")}><Download className="h-4 w-4 mr-1"/>Download</Button>
                        </div>
                      </div>
                      <pre className="bg-slate-950 text-slate-50 text-xs p-4 rounded-xl overflow-auto max-h-64">{JSON.stringify(bundle, null, 2)}</pre>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to swap mocks → real services (quick guide)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Replace in-memory NAMASTE list with CSV ingestion on a small Node/Go service that publishes a FHIR <code>CodeSystem</code> + <code>ValueSet</code>.</li>
              <li>Build <code>ConceptMap</code> from your curated mapping file (start with partial coverage), expose <code>ConceptMap/$translate</code>.</li>
              <li>Wire ICD‑11 via WHO ICD API (cache and version). Persist to Postgres using HAPI FHIR JPA or your own schema.</li>
              <li>Point this UI’s search to <code>GET /fhir/ValueSet/$expand?filter=...</code> and mapping to <code>POST /fhir/ConceptMap/$translate</code>.</li>
              <li>Before <code>POST /fhir/Bundle</code>, enforce ABDM OAuth2 + Consent artifacts; log <code>AuditEvent</code> and attach <code>Provenance</code>.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
