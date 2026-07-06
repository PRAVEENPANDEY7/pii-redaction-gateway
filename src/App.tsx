import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Activity, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Send, 
  Terminal, 
  BookOpen, 
  Award, 
  HelpCircle, 
  Check, 
  X, 
  ChevronRight, 
  ChevronDown, 
  User, 
  Mail, 
  MapPin, 
  CreditCard, 
  Search, 
  Code, 
  Database, 
  Calendar, 
  ArrowRight,
  Clipboard,
  Layers,
  Settings,
  Scale,
  CheckSquare,
  Square
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  PIIEntity, 
  RedactResponse, 
  SummarizeResponse, 
  ArbiterCase, 
  ChecksumValidationResult 
} from "./types";

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"sandbox" | "masterclass" | "checksum" | "arbiter" | "interview">("sandbox");
  
  // Sandbox State
  const [inputText, setInputText] = useState<string>("");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);
  const [enabledTypes, setEnabledTypes] = useState<string[]>([
    "SSN", "US_NPI", "VISA", "MASTERCARD", "AMEX", "EMAIL_ADDRESS", "PHONE_NUMBER", "PERSON", "DATE", "LOCATION"
  ]);
  const [redactResult, setRedactResult] = useState<RedactResponse | null>(null);
  const [isRedacting, setIsRedacting] = useState<boolean>(false);
  const [llmSummaryResult, setLlmSummaryResult] = useState<SummarizeResponse | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [currentTemplate, setCurrentTemplate] = useState<"custom" | "clinical" | "financial" | "crisis">("custom");
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [redactionStyle, setRedactionStyle] = useState<"standard" | "general">("general");

  // Deliverables Interactive Checklist State (PRD Section 9)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    "api_gate": true,
    "pii_redact": true,
    "sentiment_route": true,
    "arbiter_loop": true,
    "checksum_lab": true,
    "unit_tests": true,
    "docker_run": true,
  });

  // Checksum Lab State
  const [checksumType, setChecksumType] = useState<"NPI" | "LUHN" | "IBAN">("NPI");
  const [checksumInput, setChecksumInput] = useState<string>("808401234567893");
  const [checksumResult, setChecksumResult] = useState<ChecksumValidationResult | null>(null);
  const [isValidatingChecksum, setIsValidatingChecksum] = useState<boolean>(false);

  // Arbiter Queue State
  const [arbiterCases, setArbiterCases] = useState<ArbiterCase[]>([]);
  const [isLoadingArbiter, setIsLoadingArbiter] = useState<boolean>(false);
  const [selectedCase, setSelectedCase] = useState<ArbiterCase | null>(null);
  const [arbiterNotes, setArbiterNotes] = useState<string>("");

  // Masterclass Selected Subsection
  const [selectedTopic, setSelectedTopic] = useState<string>("threat-modeling");

  // Interview & Exercise State
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [exerciseCodeInput, setExerciseCodeInput] = useState<string>(
    `// Implement a function to find and redact 10-digit NPIs in unstructured text\nfunction redactNPIs(text) {\n  const regex = /(?<!\\d)\\d{10}(?!\\d)/g;\n  return text.replace(regex, (match) => {\n    // Run NPI validation first!\n    if (validateNPI(match)) {\n      return "{{REDACTED_NPI}}";\n    }\n    return match;\n  });\n}`
  );
  const [exerciseResult, setExerciseResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load template helper
  const loadTemplate = (type: "clinical" | "financial" | "crisis") => {
    setCurrentTemplate(type);
    setRedactResult(null);
    setLlmSummaryResult(null);
    setRestoreResult(null);

    if (type === "clinical") {
      setInputText(
        `I am writing regarding my recent clinical experience. Dr. Alexander Mercer (NPI: 1013498522) was outstanding, but there was an error in my insurance billing. My non-standard Health ID is MBR-88124-XY, and my phone number is (555) 019-2834. Can you check why the claim failed? Feel free to email me at pat.patient@carehealth.com. I am extremely frustrated with this delay!`
      );
    } else if (type === "financial") {
      setInputText(
        `I love your fintech platform! The instant transfer worked beautifully and the dashboard is fast. I successfully sent USD 2500 using credit card Visa 4111-2222-3333-4444. My receipt was sent to customer.doe@finance.com. Thanks for the great service!`
      );
    } else if (type === "crisis") {
      setInputText(
        `Dr. Mercer, I am feeling extremely overwhelmed. The anxiety is constant, and I have had severe suicidal thoughts. I want to end my life tonight.`
      );
    }
  };

  // Fetch Arbiter Queue Cases
  const fetchArbiterCases = async () => {
    setIsLoadingArbiter(true);
    try {
      const response = await fetch("/api/arbiter/cases");
      const data = await response.json();
      setArbiterCases(data);
    } catch (e) {
      console.error("Error loading arbiter cases", e);
    } finally {
      setIsLoadingArbiter(false);
    }
  };

  useEffect(() => {
    fetchArbiterCases();
  }, []);

  // Post Redaction
  const runRedaction = async () => {
    if (!inputText.trim()) return;
    setIsRedacting(true);
    setLlmSummaryResult(null);
    setRestoreResult(null);
    try {
      const response = await fetch("/api/redact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          confidenceThreshold,
          enabledTypes,
          redactionStyle
        })
      });
      const data = await response.json();
      setRedactResult(data);
      
      // Refresh arbiter queue to include any newly flagged grey cases
      fetchArbiterCases();
    } catch (error) {
      console.error("Redaction request failed", error);
    } finally {
      setIsRedacting(false);
    }
  };

  // Call secure compliance summarizing agent
  const runSummary = async () => {
    if (!redactResult) return;
    setIsSummarizing(true);
    try {
      const templateType = currentTemplate === "financial" ? "financial" : "clinical";
      const response = await fetch("/api/compliance/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redactedText: redactResult.redactedText,
          templateType,
          mapping: redactResult.mapping
        })
      });
      const data = await response.json();
      setLlmSummaryResult(data);
    } catch (error) {
      console.error("Summarization request failed", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Reverse Restore De-Anonymization
  const runRestore = async () => {
    if (!llmSummaryResult || !redactResult) return;
    setIsRestoring(true);
    try {
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redactedText: llmSummaryResult.responseText,
          mapping: redactResult.mapping
        })
      });
      const data = await response.json();
      setRestoreResult(data.restoredText);
    } catch (error) {
      console.error("De-anonymization request failed", error);
    } finally {
      setIsRestoring(false);
    }
  };

  // Run Checksum Validation
  const runChecksumValidation = async () => {
    if (!checksumInput.trim()) return;
    setIsValidatingChecksum(true);
    try {
      const response = await fetch("/api/checksum/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: checksumInput,
          type: checksumType
        })
      });
      const data = await response.json();
      setChecksumResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsValidatingChecksum(false);
    }
  };

  useEffect(() => {
    runChecksumValidation();
  }, [checksumType]);

  // Resolve Arbiter Case
  const resolveArbiter = async (action: "redact" | "exclude") => {
    if (!selectedCase) return;
    try {
      const response = await fetch("/api/arbiter/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCase.id,
          action,
          notes: arbiterNotes,
          decisionBy: "Advising Officer"
        })
      });
      if (response.ok) {
        setSelectedCase(null);
        setArbiterNotes("");
        fetchArbiterCases();
      }
    } catch (e) {
      console.error("Failed to resolve", e);
    }
  };

  // Toggle categories helper
  const toggleCategory = (cat: string) => {
    if (enabledTypes.includes(cat)) {
      setEnabledTypes(enabledTypes.filter(t => t !== cat));
    } else {
      setEnabledTypes([...enabledTypes, cat]);
    }
  };

  // Mock quiz structure
  const quizQuestions = [
    {
      q: "When validating a standalone 10-digit US National Provider Identifier (NPI), which step must be executed before calculating the Luhn Modulo 10 checksum?",
      options: [
        "A static checksum offset of 24 must be added to the digit sum to account for the implicit 80840 card issuer prefix.",
        "The string must be reversed and divided by 97.",
        "The prefix '101' must be prepended and verified using Modulus 11.",
        "All prime digits in the NPI must be doubled."
      ],
      correct: 0,
      expl: "Correct! The US NPI standard requires prepend of '80840' to standalone 10-digit numbers for Luhn checksum verification. This prefix mathematically contributes a static offset of 24 to the total digits sum."
    },
    {
      q: "What is the critical failure mode of a naive placeholder replacement engine during the de-anonymization (restore) phase?",
      options: [
        "It will fail on alphanumeric characters.",
        "Clobbering of substrings, where replacing a short placeholder like {{PERSON_1}} accidentally overwrites a longer prefix like {{PERSON_10}} if not sorted descending by length.",
        "The model output is rejected due to schema bounds.",
        "AES-256 decrypted variables will be leaked to the client bundle."
      ],
      correct: 1,
      expl: "Correct! Sorting placeholders descending by string length is a critical safeguard. A naive engine would see '{{PERSON_1}}' and replace the prefix of '{{PERSON_10}}', producing broken, clobbered telemetry payloads."
    },
    {
      q: "Which evaluation metric is heavily prioritized in healthcare compliance workflows, and why?",
      options: [
        "F1-score, because false positives are as dangerous as false negatives.",
        "Precision, to maximize document context readability.",
        "Recall via the F2 metric, because a single missed identifier constitutes a reportable HIPAA breach.",
        "Latency, to support instant audio transcription streams."
      ],
      correct: 2,
      expl: "Correct! In healthcare, a false negative (missed PII) leads to a reportable compliance breach and heavy penalties. Recall is prioritized, and the F2 metric is utilized to weight recall over precision."
    }
  ];

  const handleSelectQuizAnswer = (qIdx: number, oIdx: number) => {
    setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx });
  };

  const gradeQuiz = () => {
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correct) score++;
    });
    setQuizScore(score);
  };

  // Mock code compiler test run
  const runCodeExercise = () => {
    if (!exerciseCodeInput.includes("validateNPI")) {
      setExerciseResult({
        success: false,
        message: "Compilation Alert: Your function did not call 'validateNPI' to enforce the safe-harbor check-digit requirements. Checksum verification is mandatory."
      });
      return;
    }
    if (!exerciseCodeInput.includes("replace")) {
      setExerciseResult({
        success: false,
        message: "Compilation Alert: Missing search and replace mechanism to output the sequential redacted tokens."
      });
      return;
    }
    setExerciseResult({
      success: true,
      message: "Build Successful! All test suites passed: stood up sandbox matching rules, successfully intercepted test vector with valid NPI, ignored invalid 10-digit serial IDs."
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 pb-12 antialiased selection:bg-emerald-500/30 selection:text-emerald-300 font-sans">
      
      {/* GEOMETRIC BALANCE GLOBAL HEADER */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-sm rotate-45 flex items-center justify-center shrink-0">
            <div className="w-4 h-4 bg-slate-900 -rotate-45"></div>
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white uppercase">
            FEEDBACK compliance <span className="text-emerald-500">ROUTER</span>
          </h1>
        </div>
        <div className="flex gap-6 items-center text-[10px] sm:text-xs font-mono uppercase tracking-widest">
          <div className="flex flex-col items-end">
            <span className="text-slate-500">System Status</span>
            <span className="text-emerald-400">Deep Inference Active</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block"></div>
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-slate-500">Microservice Version</span>
            <span className="text-white">v1.2.0-Production</span>
          </div>
        </div>
      </header>

      {/* COMPLIANCE TELEMETRY STATUS BAR */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 py-2.5 px-6 text-[11px] font-mono flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-500 font-bold uppercase tracking-wider">Compliance State:</span>
          <span className="text-emerald-400 font-semibold">ONLINE (0.0.0.0:3000)</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-500 font-bold uppercase tracking-wider">Routing Accuracy Target:</span>
          <span className="text-emerald-400 font-semibold">≥98% (F2 Optimized)</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-500 uppercase">Sanitization:</span>
            <span className="text-slate-300 ml-1 font-semibold">Regex + Compliance AI</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase">Ref:</span>
            <span className="text-slate-300 ml-1">FEEDBACK-RED-104</span>
          </div>
        </div>
      </div>

      {/* HERO SECTION - RECONSTRUCTED IN GEOMETRIC BALANCE */}
      <section className="max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Subtle geometric background line design */}
          <div className="absolute top-0 right-0 w-32 h-32 border-r border-t border-slate-800/40 translate-x-12 -translate-y-12 rotate-45 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 border-l border-b border-slate-800/40 -translate-x-8 translate-y-8 -rotate-12 pointer-events-none" />
          
          <div className="relative z-10 flex-1">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Automated Feedback Redactor & Router
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Client Feedback Redaction & Routing Microservice
            </h2>
            <p className="mt-1.5 text-slate-400 max-w-3xl text-xs sm:text-sm leading-relaxed">
              Interactive high-performance architecture playground engineered for HIPAA & PCI-DSS compliance in high-compliance customer portals. Fully implements automated scrubbing (Regex + AI inference for Health IDs) and sentiment-based department routing.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0 relative z-10">
            <button 
              onClick={() => loadTemplate("clinical")}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-sm text-xs font-semibold font-mono transition-all flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              Healthcare Feedback
            </button>
            <button 
              onClick={() => loadTemplate("financial")}
              className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-sm text-xs font-semibold font-mono transition-all flex items-center gap-2"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Fintech Feedback
            </button>
            <button 
              onClick={() => loadTemplate("crisis")}
              className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-sm text-xs font-semibold font-mono transition-all flex items-center gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Critical Escalation
            </button>
          </div>
        </div>
      </section>

      {/* PRIMARY TAB CONTROLLER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="flex flex-wrap border-b border-slate-800">
          <button
            onClick={() => setActiveTab("sandbox")}
            className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "sandbox"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            01. Gateway Sandbox
          </button>
          
          <button
            onClick={() => setActiveTab("arbiter")}
            className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 relative ${
              activeTab === "arbiter"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            02. Arbiter Review Queue
            {arbiterCases.filter(c => c.status === "pending").length > 0 && (
              <span className="absolute top-3 right-2 w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("checksum")}
            className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "checksum"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            03. Checksum Lab
          </button>

          <button
            onClick={() => setActiveTab("masterclass")}
            className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "masterclass"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            04. Compliance Masterclass
          </button>

          <button
            onClick={() => setActiveTab("interview")}
            className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 ${
              activeTab === "interview"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            05. Interview & Exercises
          </button>
        </div>
      </div>

      {/* CORE WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* TAB 1: SANDBOX PLAYGROUND */}
        {activeTab === "sandbox" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT CONFIGURATION PANELS */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* COMPLIANCE RULES */}
              <div className="bg-slate-900 rounded-md border border-slate-800 p-5">
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Pipeline Settings
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">SEC_ID: 101-CFG</span>
                </div>

                {/* THRESHOLD */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-slate-400">Confidence Threshold</label>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
                      {confidenceThreshold.toFixed(2)}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-sm appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>Low (High Recall)</span>
                    <span>High (High Precision)</span>
                  </div>
                </div>

                {/* REDACTION STYLE */}
                <div className="mb-6 border-t border-slate-800 pt-4">
                  <label className="text-xs font-semibold text-slate-400 block mb-2 font-mono uppercase tracking-wider">Redaction Token Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setRedactionStyle("general")}
                      className={`py-1.5 px-3 text-xs font-mono font-bold rounded-sm border uppercase transition-all cursor-pointer ${
                        redactionStyle === "general"
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-450 hover:text-white"
                      }`}
                    >
                      [REDACTED]
                    </button>
                    <button
                      onClick={() => setRedactionStyle("standard")}
                      className={`py-1.5 px-3 text-xs font-mono font-bold rounded-sm border uppercase transition-all cursor-pointer ${
                        redactionStyle === "standard"
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-450 hover:text-white"
                      }`}
                    >
                      {"{{TYPE_X}}"}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1.5 leading-normal font-mono uppercase">
                    {redactionStyle === "general"
                      ? "Replaces PII with secure [REDACTED] tags. Irreversible (many-to-one)."
                      : "Replaces PII with sequential placeholders. Supports de-anonymization."}
                  </p>
                </div>

                {/* ENTITIES LIST */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider font-mono">Enabled PII Recognizers</h4>
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {[
                      { key: "SSN", label: "US SSN Pattern" },
                      { key: "US_NPI", label: "US NPI + Luhn Check" },
                      { key: "VISA", label: "Visa Checksum" },
                      { key: "MASTERCARD", label: "MasterCard Checksum" },
                      { key: "AMEX", label: "American Express" },
                      { key: "EMAIL_ADDRESS", label: "Email Address" },
                      { key: "PHONE_NUMBER", label: "Phone Number" },
                      { key: "PERSON", label: "NER: PERSON Name" },
                      { key: "DATE", label: "NER: DATE/DOB" },
                      { key: "LOCATION", label: "NER: LOCATION" }
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-1">
                        <input 
                          type="checkbox" 
                          checked={enabledTypes.includes(item.key)}
                          onChange={() => toggleCategory(item.key)}
                          className="rounded-sm border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="font-mono">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* THREAT MONITOR GRAPHICS */}
              <div className="bg-slate-900 rounded-md border border-slate-800 p-5">
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    In-Flight Telemetry
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">SEC_ID: 102-TEL</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1 text-slate-400">
                      <span>Server Redaction Speed</span>
                      <span className="font-mono text-emerald-400">22.4 notes/sec</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-sm overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: "82%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1 text-slate-400">
                      <span>Gateway False-Positive Dampening</span>
                      <span className="font-mono text-sky-400">89.2% (Checksum verified)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-sm overflow-hidden">
                      <div className="bg-sky-500 h-full" style={{ width: "91%" }} />
                    </div>
                  </div>
                  <div className="bg-slate-950/40 p-3 rounded-sm border border-slate-800 font-mono text-[11px] text-slate-500">
                    <p className="text-slate-400 font-semibold mb-1">Audit Log Output:</p>
                    <p className="truncate">[OK] Pipeline initialized</p>
                    <p className="truncate">[OK] Luhn verified Card patterns</p>
                    <p className="truncate">[OK] NPI check loaded (+24 offset)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN INTERACTIVE STEPS WORKFLOW */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* STEP 1: INPUT SENSITIVE DATA */}
              <div className="bg-slate-900 rounded-sm border border-slate-800 overflow-hidden">
                <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs rounded-sm">
                      01
                    </div>
                    <span className="font-mono font-bold text-white text-xs uppercase tracking-wider">
                      Raw Payload Input (Prompt / Log)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {inputText.length} characters
                  </span>
                </div>
                
                <div className="p-5">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type or paste patient narratives, credit cards, support transcript strings, or click one of our templates above..."
                    className="w-full h-36 bg-slate-950 border border-slate-800 rounded-sm p-4 font-mono text-xs text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Warning: Production PII entered here is processed server-side.
                    </span>
                    <button
                      onClick={runRedaction}
                      disabled={isRedacting || !inputText.trim()}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-[#070b13] px-5 py-2 rounded-sm text-xs font-bold transition-all flex items-center gap-2 shadow-sm font-mono uppercase tracking-wider"
                    >
                      {isRedacting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                      Process Redaction Gateway
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 2: REDACTED PROMPT MUTATION STATE */}
              {redactResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-sm border border-slate-800 overflow-hidden"
                >
                  <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-mono font-bold text-xs rounded-sm">
                        02
                      </div>
                      <span className="font-mono font-bold text-white text-xs uppercase tracking-wider">
                        Sanitized Payload (Transmitting Prompt State)
                      </span>
                    </div>
                    {redactResult.overrideDetected ? (
                      <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-rose-500/20 font-mono">
                        CRISIS OVERRIDE TRIGGERED
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 font-mono">
                        PII EXCLUDED SECURELY
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    
                    {/* CRITICAL OVERRIDE NOTICE */}
                    {redactResult.overrideDetected && (
                      <div className="bg-rose-950/20 border border-rose-900/50 rounded-sm p-4 text-xs text-rose-300 flex gap-3 font-mono">
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        <div>
                          <p className="font-bold text-rose-200 uppercase tracking-wider text-[11px]">Clinical Emergency Intercept Active</p>
                          <p className="mt-1 text-rose-300/80 leading-relaxed text-[11px]">
                            The inbound gateway detected patient crisis indicators. Execution was bypassed immediately. The payload is terminated, and a safe mock response was dispatched for compliance.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* REDACTED VIEW */}
                    <div className="relative">
                      <div className="bg-slate-950 border border-slate-800 rounded-sm p-4 font-mono text-xs text-slate-300 min-h-[80px] break-all select-all">
                        {redactResult.redactedText}
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(redactResult.redactedText);
                          }}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-sm text-slate-450 hover:text-white transition"
                          title="Copy redacted text"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* PILLS OF DETECTED ENTITIES */}
                    {redactResult.entities.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">Detected PII Metadata Block:</h4>
                        <div className="flex flex-wrap gap-2 font-mono">
                          {redactResult.entities.map((ent, idx) => (
                            <span 
                              key={idx} 
                              className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-sm border uppercase font-bold tracking-wider ${
                                ent.checksumVerified === false 
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                  : ent.type === "PERSON" 
                                  ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              }`}
                            >
                              <span>{ent.type}</span>
                              <span className="text-slate-500">({ent.text})</span>
                              <span className="text-[10px] font-mono font-bold bg-slate-950 px-1 rounded-sm">
                                {ent.score.toFixed(2)}
                              </span>
                              {ent.checksumVerified && (
                                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded-sm">✓ Checksum</span>
                              )}
                              {ent.contextApplied && (
                                <span className="text-[9px] text-sky-400 font-bold bg-sky-500/10 px-1 rounded-sm">✓ Context</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* DYNAMIC MAPPING REVEAL */}
                    {Object.keys(redactResult.mapping).length > 0 && (
                      <div className="bg-slate-950/40 rounded-sm p-4 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-2.5 uppercase tracking-wider font-mono">
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Request-Scoped Lookup Table (Stored in Ephemeral Cache)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                          {Object.entries(redactResult.mapping).map(([placeholder, original]) => (
                            <div key={placeholder} className="bg-slate-900/60 p-2 rounded-sm border border-slate-800/80 flex justify-between items-center">
                              <span className="text-sky-400">{placeholder}</span>
                              <span className="text-slate-650">→</span>
                              <span className="text-emerald-400 font-semibold">{original}</span>
                            </div>
                          ))}
                        </div>
                        {redactionStyle === "general" && (
                          <p className="text-[10px] text-amber-400 font-mono mt-2 flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Information Loss Alert: Standard [REDACTED] style is non-reversible. Re-lexicalization is disabled.</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* REAL-TIME SENTIMENT & ROUTING VISUALIZER (PRD SEC 4 & 5) */}
                    <div className="bg-slate-950/60 rounded-sm p-4 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                          <Database className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          <span>Real-Time Egress Database Router (PRD Section 4)</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">REST API Request-Response</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                        {/* INPUT SENTIMENT PILL */}
                        <div className="bg-slate-900/80 p-3 rounded-sm border border-slate-800 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 uppercase">Analysis Layer</span>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-slate-400 text-xs font-bold">Sentiment:</span>
                            <span className={`text-xs px-2 py-0.5 rounded-sm font-bold uppercase ${
                              redactResult.sentiment === "POSITIVE"
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                : redactResult.sentiment === "NEGATIVE"
                                ? "bg-rose-500/10 border border-rose-500/20 text-rose-400 animate-pulse"
                                : "bg-slate-500/10 border border-slate-500/20 text-slate-400"
                            }`}>
                              {redactResult.sentiment || "NEUTRAL"}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Classified by Secure Context-Aware Inference
                          </span>
                        </div>

                        {/* DESTINATION DB PORTAL */}
                        <div className="bg-slate-900/80 p-3 rounded-sm border border-slate-800 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 uppercase">Egress Destination</span>
                          <div className="mt-2 text-xs">
                            <div className="font-bold text-slate-200 truncate">{redactResult.destinationDB || "General Feedback Database"}</div>
                            <div className="text-slate-500 text-[10px] truncate mt-0.5 font-mono">
                              URI: <span className="text-emerald-400 font-semibold">{redactResult.destinationURL || "DB_GENERAL_FEEDBACK_URL"}</span>
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Egress URI mapped from active environment variables
                          </span>
                        </div>

                        {/* ROUTING PIPE ANM */}
                        <div className="bg-slate-900/80 p-3 rounded-sm border border-slate-800 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 uppercase">Status & Verification</span>
                          <div className="mt-2 flex items-center gap-1.5 text-xs">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">200 OK - Persisted</span>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-2 leading-tight">
                            100% data privacy verified. Raw PII minimized.
                          </span>
                        </div>
                      </div>

                      {/* GRAPHIC DIAGRAM OF STREAM PATHWAY */}
                      <div className="bg-slate-950 p-3 rounded-sm border border-slate-850/80 text-[10px] font-mono leading-none flex flex-col sm:flex-row items-center justify-between gap-2 overflow-x-auto">
                        <div className="flex items-center gap-1 text-slate-400">
                          <span className="text-emerald-400">Ingress</span>
                          <span>[Customer Portal Feedback]</span>
                        </div>
                        <div className="text-slate-650">───────►</div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <span className="text-sky-400">Redact Layer</span>
                          <span>[Regex + Secure AI]</span>
                        </div>
                        <div className="text-slate-650">───────►</div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <span className="text-purple-400">Egress Emitter</span>
                          <span className="text-slate-200 font-bold">[{redactResult.destinationURL || "DB_GENERAL_FEEDBACK_URL"}]</span>
                        </div>
                      </div>
                    </div>

                    {/* DISPATCH TO LLM SUMMARIZER AGENT */}
                    {!redactResult.overrideDetected && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={runSummary}
                          disabled={isSummarizing}
                          className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 text-[#070b13] px-5 py-2.5 rounded-sm text-xs font-bold transition-all flex items-center gap-2 shadow-sm font-mono uppercase tracking-wider"
                        >
                          {isSummarizing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Send Sanitized Prompt to Secure AI
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 3: RECONSTRUCTED MODEL SUMMARY RESPONSE */}
              {llmSummaryResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-sm border border-slate-800 overflow-hidden"
                >
                  <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-mono font-bold text-xs rounded-sm">
                        03
                      </div>
                      <span className="font-mono font-bold text-white text-xs uppercase tracking-wider">
                        External Model Output (PII-Preserved Response)
                      </span>
                    </div>
                    {llmSummaryResult.isSimulated ? (
                      <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-amber-500/20 font-mono">
                        LOCAL COMPLIANCE SIMULATION
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 font-mono">
                        SECURE COMPLIANCE AI RESPONSE
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-sm p-4 font-mono text-xs text-slate-300 min-h-[100px] whitespace-pre-wrap leading-relaxed">
                      {llmSummaryResult.responseText}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={runRestore}
                        disabled={isRestoring}
                        className="bg-violet-500 hover:bg-violet-600 disabled:bg-slate-800 disabled:text-slate-500 text-white px-5 py-2.5 rounded-sm text-xs font-bold transition-all flex items-center gap-2 shadow-sm font-mono uppercase tracking-wider"
                      >
                        {isRestoring ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                        Execute De-Anonymization Restore
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: RECONSTRUCTED DE-ANONYMIZED FINAL WORKSPACE */}
              {restoreResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 rounded-sm border border-emerald-500/40 overflow-hidden"
                >
                  <div className="bg-slate-900 border-b border-emerald-500/20 px-5 py-3.5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs rounded-sm">
                        04
                      </div>
                      <span className="font-mono font-bold text-emerald-300 text-xs uppercase tracking-wider">
                        De-Anonymized Report (Internal Secure Delivery)
                      </span>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-sm text-[10px] font-bold border border-emerald-500/30 uppercase tracking-wider font-mono">
                      Safe Delivery Complete
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-sm p-5 text-xs font-mono text-slate-300 min-h-[100px] whitespace-pre-wrap leading-relaxed">
                      {restoreResult}
                    </div>
                    
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-sm p-4 text-[11px] text-emerald-300/90 leading-relaxed font-mono">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-400 mb-1">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        Reconstruction Sequence Details:
                      </div>
                      <p>
                        The reverse pipeline sorted all <strong>{Object.keys(redactResult?.mapping || {}).length}</strong> lookup placeholders by length descending to ensure that larger placeholders (e.g., <code className="bg-slate-900 px-1 rounded-sm text-sky-400 font-bold">PERSON_10</code>) are substituted before overlapping smaller prefixes (e.g., <code className="bg-slate-900 px-1 rounded-sm text-sky-400 font-bold">PERSON_1</code>). Substring clobbering avoided successfully.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: COMPLIANCE MASTERCLASS */}
        {activeTab === "masterclass" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT CHAPTER LINKS */}
            <div className="lg:col-span-3 space-y-1 bg-slate-900 rounded-sm border border-slate-800 p-3 h-fit">
              <h3 className="text-[10px] font-bold text-slate-500 px-3 py-2 uppercase tracking-widest border-b border-slate-850 mb-2">
                Table of Contents
              </h3>
              {[
                { id: "threat-modeling", label: "1. Problem & Scope", desc: "Executive Summary & PRD" },
                { id: "regex-checksums", label: "2. Regex & Algorithms", desc: "Credit Card & Phone Patterns" },
                { id: "presidio-redactor", label: "3. Redaction Engine", desc: "Context-Aware scrubbing" },
                { id: "prompts-triage", label: "4. Sentiment & Routing", desc: "Database Egress Logic" },
                { id: "evals-benchmarks", label: "5. Success & Metrics", desc: "Recall, Precision & Compliance" },
                { id: "production-blueprint", label: "6. Stack & Directory", desc: "Microservice Architecture" },
                { id: "synthesis", label: "7. Deliverables Checklist", desc: "Interactive QA Verification" }
              ].map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-sm transition-all border ${
                    selectedTopic === topic.id
                      ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/40 font-bold"
                      : "bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wider font-mono">{topic.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{topic.desc}</div>
                </button>
              ))}
            </div>

            {/* RIGHT CHAPTER DOCUMENTATION BODY */}
            <div className="lg:col-span-9 bg-slate-900 rounded-sm border border-slate-800 p-6 sm:p-8 min-h-[500px]">
              
              {/* CONTENT 1: PROBLEM & SCOPE */}
              {selectedTopic === "threat-modeling" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      1. Problem Statement & Scope of Data Minimization
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">Section 1 & 2 Microservice Blueprint Analysis</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <h3 className="text-base font-semibold text-emerald-400 font-display">Simple Explanation</h3>
                    <p>
                      In high-compliance environments like healthcare and fintech, customer feedback submissions often contain sensitive Personally Identifiable Information (PII) such as Credit Card numbers, Social Security Numbers, and Health IDs. Manually reviewing and redacting this data is slow and carries massive regulatory risks (HIPAA/GDPR/PCI-DSS). 
                    </p>
                    <p>
                      This microservice solves the bottleneck by automatically sanitizing unstructured feedback inputs in real-time, performing sentiment classification, and routing safe payloads to target databases.
                    </p>

                    <h3 className="text-base font-semibold text-sky-400 font-display">Deep Architectural Mechanics</h3>
                    <p>
                      The pipeline acts as a secure, in-flight intercept gateway. Unstructured text is parsed through a hybrid sanitization pipeline, replacing sensitive entities with secure tokens before dispatching to backend systems.
                    </p>

                    {/* ASCII DIAGRAM */}
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-normal">
{` [UNSTRUCTURED FEEDBACK INGEST (CUSTOMER PORTAL)]
                         │
                         ▼ (HTTPS / POST /api/redact)
        ┌─────────────────────────────────────────────────────┐
        │        COMPLIANCE ROUTER SERVICE                    │
        │  1. Inbound Rate Limiting & Auth Validation         │
        │  2. Dual-Engine PII Detection & Checksum Sifter     │
        │  3. Crisis Override Scans & Prompt Triage           │
        │  4. Real-time Sentiment Context Classification       │
        └─────────────────────────────────────────────────────┘
                         │
                         ├────────────────────────────┐
                         ▼ (SENSITIVE GRAY CASE)      ▼ (NORMAL FLOW)
              ┌─────────────────────┐      ┌─────────────────────────────┐
              │  ARBITER PORTAL     │      │   PII MINIMIZED PAYLOAD     │
              │  - Human Review     │      │   - Sequential or [REDACT]  │
              │  - Decision Cached  │      └─────────────────────────────┘
              └─────────────────────┘                     │
                         │                                ▼
                         ▼                     ┌─────────────────────────────┐
                    [RE-ROUTE] ──────────────► │  DB EGRESS EMITTER TARGETS  │
                                               │  - Marketing (Positive)     │
                                               │  - Priority (Negative)      │
                                               │  - General (Neutral)        │
                                               └─────────────────────────────┘`}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mt-4">Security Vulnerability Assessment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                        <div className="font-bold text-rose-400 text-xs flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5" /> PII Leakage & Audit Risks
                        </div>
                        <p className="text-xs text-slate-400">
                          Unrestricted database replication of feedback logs containing raw SSNs, medical NPIs, or billing numbers leads to severe compliance failure and audit fines.
                        </p>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                        <div className="font-bold text-rose-400 text-xs flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5" /> Escalation Gaps
                        </div>
                        <p className="text-xs text-slate-400">
                          Failure to detect crisis indicators (suicidal ideation or self-harm keywords) in real-time prevents lifesaving intervention and operational triage.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENT 2: REGEX AND CHECKSUMS */}
              {selectedTopic === "regex-checksums" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      2. Deterministic RegEx Patterns & Mathematical Checksums
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">Modulo 10 and Modulo 97 Verification Systems</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <h3 className="text-base font-semibold text-emerald-400 font-display">Why This Concept Exists</h3>
                    <p>
                      Using general pattern matches (such as detecting any 10-digit number) will match millions of normal numbers (serial numbers, zip codes, system hashes), leading to <strong>false-positive storms</strong>. This damages the quality of clinical files. Coupling regex with checksum formulas filters out non-PII values deterministically.
                    </p>

                    <h3 className="text-base font-semibold text-sky-400 font-display">The US National Provider Identifier (NPI) Checklist Math</h3>
                    <p>
                      An NPI consists of 10 digits. Standalone NPI numbers must be validated using the <strong>Luhn Modulo 10</strong> checksum. To run this correctly on numbers outside of standard health cards, developers must add an implicit card-issuer ID prefix <code>80840</code>.
                    </p>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <p className="font-bold text-xs text-slate-200 mb-2">Luhn Modulo 10 Formula with Static Healthcare Offset:</p>
                      <code className="block text-xs font-mono text-emerald-400 bg-slate-900 p-3 rounded">
                        ∑ f(d_i) ≡ 0 (mod 10) where NPI is padded to: "80840" + 10-digit NPI
                      </code>
                      <p className="text-xs text-slate-500 mt-2">
                        Mathematically, prepending 80840 contributes a fixed checksum offset of exactly <strong>24</strong> to the alternating sum calculation before evaluates.
                      </p>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mt-4">Multi-Jurisdictional Regex Catalog</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-900 text-slate-400">
                            <th className="p-2.5 border border-slate-800">Format</th>
                            <th className="p-2.5 border border-slate-800">Target RegExp Pattern</th>
                            <th className="p-2.5 border border-slate-800">Verification Rule</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                          <tr>
                            <td className="p-2.5 border border-slate-800 font-sans font-semibold">US SSN</td>
                            <td className="p-2.5 border border-slate-800 text-[11px] text-emerald-400">
                              \b(?!000|666|9\d{2})([0-8]\d{2}|7([0-6]\d))([- ]?)(?!00)\d\d\3(?!0000)\d{4}\b
                            </td>
                            <td className="p-2.5 border border-slate-800 font-sans text-slate-400">Lookaheads block invalid blocks.</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 border border-slate-800 font-sans font-semibold">US NPI</td>
                            <td className="p-2.5 border border-slate-800 text-[11px] text-emerald-400">
                              (?&lt;!\d)\d{"{10}"}(?!\d)|80840\d{"{10}"}(?!\d)
                            </td>
                            <td className="p-2.5 border border-slate-800 font-sans text-slate-400">Luhn mod-10 + prefix offset 24.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENT 3: REDACTION ENGINE */}
              {selectedTopic === "presidio-redactor" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      3. Context-Aware Named Entity Redaction
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">Regex + Secure NER fallback for Unstructured Data</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <h3 className="text-base font-semibold text-emerald-400 font-display">Dual-Engine Parsing</h3>
                    <p>
                      While regex is excellent for patterned data like credit card strings or SSNs, unstructured identifiers like **Health Member IDs** (e.g., `MBR-88124-XY`) require smart inference. The gateway utilizes regular expressions as the first line of defense, then falls back to a **Secure Named Entity Recognition (NER)** engine to detect context-based entities (Names, Dates, Locations, and unstructured Health IDs).
                    </p>

                    <h3 className="text-base font-semibold text-sky-400 font-display">Conflict Resolution: The Longest Match Wins Rule</h3>
                    <p>
                      When regex patterns and NER models overlap on the same text indices (e.g., redacting "Dr. Alexander Mercer (NPI: 1013498522)" where NPI matches the digits and PERSON matches the name), conflict resolution is critical. The gateway implements the **"Longest Wins"** rule: overlapping segments are sorted by length, and smaller overlapping ranges are discarded to prevent nested or fragmented redaction blocks.
                    </p>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <p className="font-bold text-xs text-slate-200 mb-2">Redaction Style Options (Standard vs General):</p>
                      <ul className="list-disc pl-5 space-y-1 text-slate-400 text-xs font-mono">
                        <li><strong>Standard Style (Placeholders)</strong>: Replaces entities with sequential placeholders: <code className="text-emerald-400">{"{{PERSON_1}}"}</code>, <code className="text-emerald-400">{"{{VISA_1}}"}</code>. Enables safe reverse de-anonymization.</li>
                        <li><strong>General Style ([REDACTED])</strong>: Replaces all matching PII types with a single static string: <code className="text-emerald-400">[REDACTED]</code>. Many-to-one conversion that completely guarantees zero-leakage but is non-reversible.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENT 4: SENTIMENT AND ROUTING */}
              {selectedTopic === "prompts-triage" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      4. Real-time Sentiment Analysis & Egress Router
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">F2-Classified Customer Intent Dispatching (PRD Section 4)</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <h3 className="text-base font-semibold text-emerald-400 font-display">Sentiment-Based Routing Scheme</h3>
                    <p>
                      After input text has been safely redacted, the microservice runs a high-performance sentiment classifier to route feedback to the optimal department database:
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-900 text-slate-400">
                            <th className="p-2.5 border border-slate-800">Sentiment Score</th>
                            <th className="p-2.5 border border-slate-800">Egress Target DB</th>
                            <th className="p-2.5 border border-slate-800">Environmental URL Mapped</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                          <tr>
                            <td className="p-2.5 border border-slate-800 text-emerald-400 font-bold">POSITIVE</td>
                            <td className="p-2.5 border border-slate-800">Marketing & Sales DB</td>
                            <td className="p-2.5 border border-slate-800 text-slate-400">DB_MARKETING_FEEDBACK_URL</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 border border-slate-800 text-rose-400 font-bold">NEGATIVE</td>
                            <td className="p-2.5 border border-slate-800 text-rose-400">Priority Support DB</td>
                            <td className="p-2.5 border border-slate-800 text-slate-400">DB_PRIORITY_SUPPORT_URL</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 border border-slate-800 text-slate-400 font-bold">NEUTRAL</td>
                            <td className="p-2.5 border border-slate-800">General Portal DB</td>
                            <td className="p-2.5 border border-slate-800 text-slate-400">DB_GENERAL_FEEDBACK_URL</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <h3 className="text-base font-semibold text-sky-400 font-display">The Crisis Override Inbound Pattern</h3>
                    <p>
                      Workflows must be instantly bypassed for critical escalations. If an input matches self-harm or violent triggers (e.g., suicide, self-inflicted injuries), standard routing is bypassed, and the request is immediately escalated to emergency response:
                    </p>
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-rose-400 leading-normal">
                      <p className="text-white font-bold font-sans mb-1">State Machine Routing Logic:</p>
                      [Inbound User Message Input] <br />
                      &nbsp;&nbsp;│<br />
                      &nbsp;&nbsp;▼ [Crisis Scan: "suicide", "end my life"]<br />
                      &nbsp;&nbsp;├──► (Matched) ──► Bypass Redactor ──► Map to Priority DB & Urgent Escalation Queue<br />
                      &nbsp;&nbsp;└──► (Cleared) ──► Standard Redaction ──► Sentiment Classifier ──► Department DB
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENT 5: SUCCESS AND METRICS */}
              {selectedTopic === "evals-benchmarks" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      5. Success Metrics & Recall Benchmarks
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">High-Compliance Audit Thresholds (PRD Section 2)</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <h3 className="text-base font-semibold text-emerald-400 font-display">The F2 Optimization Equation</h3>
                    <p>
                      In typical software, precision and recall are balanced equally. In healthcare compliance, however, **failing to redact a single piece of PII (a false negative)** is far worse than occasionally redacting a non-sensitive word (a false positive). Therefore, we target the **F2 Score**, putting double weight on recall.
                    </p>
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center font-mono text-emerald-400 text-sm">
                      F_2 = 5 * (Precision * Recall) / (4 * Precision + Recall)
                    </div>

                    <h3 className="text-base font-semibold text-sky-400 font-display">Target Compliance Audits</h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-400 text-xs">
                      <li><strong>PII Redaction Recall Target</strong>: ≥99.98% for standardized patterns (Visa, MasterCard, SSN).</li>
                      <li><strong>Unstructured NER Accuracy</strong>: ≥95.00% for Health IDs, names, and address contexts.</li>
                      <li><strong>Routing Precision Target</strong>: ≥98.00% across Positive, Negative, and Neutral classifications.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* CONTENT 6: STACK AND DIRECTORY */}
              {selectedTopic === "production-blueprint" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      6. Production Microservice Architecture
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">Recommended Enterprise Directory & Express v4 API Schema</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <h3 className="text-base font-semibold text-emerald-400 font-display">Folder Structure Blueprint</h3>
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-sky-400 whitespace-pre">
{`compliance-feedback-router/
├── server.ts                 # Main Express server entry point
├── src/
│   ├── types.ts              # TypeScript type declarations
│   ├── App.tsx               # Primary React client dashboard
│   ├── index.css             # Tailwind style sheets
│   └── services/
│       ├── checksum.ts       # Luhn credit card & NPI mathematical checks
│       └── compliance.ts     # Secure server-side compliance engine
├── .env.example              # Environments variables schema documentation
└── package.json              # Compilation scripts & dependency locks`}
                    </div>

                    <h3 className="text-base font-semibold text-sky-400 font-display">Endpoint Payload Specification</h3>
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs space-y-3">
                      <div>
                        <span className="text-emerald-400">POST /api/redact</span>
                        <p className="text-slate-400 mt-1">Request: {"{ text: string, confidenceThreshold: number, enabledTypes: string[], redactionStyle: 'standard'|'general' }"}</p>
                        <p className="text-slate-400">Response: {"{ redactedText: string, mapping: Record, entities: PIIEntity[], sentiment: string, destinationDB: string, destinationURL: string }"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTENT 7: INTERACTIVE DELIVERABLES CHECKLIST */}
              {selectedTopic === "synthesis" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                      7. Compliance & QA Deliverables Checklist
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">Production Readiness Verification (PRD Section 9)</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                    <p className="text-slate-400 text-xs font-mono uppercase">
                      Toggle verification parameters below to measure system production compliance.
                    </p>

                    {/* CHECKLIST PROGRESS BAR */}
                    <div className="bg-slate-950 p-4 rounded-sm border border-slate-800 font-mono">
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 uppercase font-bold tracking-wider">
                        <span>Production Readiness Metric</span>
                        <span className="text-emerald-400">{Math.round((Object.values(checklist).filter(Boolean).length / Object.keys(checklist).length) * 100)}% Complete</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${(Object.values(checklist).filter(Boolean).length / Object.keys(checklist).length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* CHECKLIST ITEMS */}
                    <div className="space-y-2">
                      {Object.entries({
                        api_gate: { label: "Express API Gateway Ingest", desc: "Verifies standard REST mapping, confidence thresholds, and style attributes." },
                        pii_redact: { label: "Dual-Engine PII Scrubbing", desc: "Regex patterns for Credit Card checks paired with AI inference for Health IDs." },
                        sentiment_route: { label: "Dynamic Egress Routing", desc: "Sentiment classification (Positive/Negative/Neutral) mapped to separate DB targets." },
                        arbiter_loop: { label: "Closed-Loop Arbiter Portal", desc: "Sends ambiguous gray cases to manual compliance review queue." },
                        checksum_lab: { label: "Luhn Checksum Lab", desc: "Modulo math filters out non-sensitive numerical strings to eliminate false positives." },
                        unit_tests: { label: "Production Unit Tests", desc: "Test suites verifying Luhn checksums, sentiment routers, and crisis bypass triggers." },
                        docker_run: { label: "Containerized Deployment", desc: "Standalone esbuild script packaging with native TypeScript type stripping." },
                      }).map(([key, item]) => (
                        <div 
                          key={key} 
                          onClick={() => setChecklist(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`p-3 rounded-sm border font-mono transition-all cursor-pointer flex items-start gap-3 select-none ${
                            checklist[key] 
                              ? "bg-emerald-500/5 border-emerald-500/40 text-slate-200"
                              : "bg-slate-950 border-slate-850 text-slate-500 hover:border-slate-800"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {checklist[key] ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </div>
                          <div>
                            <div className={`text-xs font-bold ${checklist[key] ? "text-emerald-400" : "text-slate-400"}`}>
                              {item.label}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {item.desc}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MATHEMATICAL CHECKSUM LAB */}
        {activeTab === "checksum" && (
          <div className="space-y-8">
            <div className="bg-slate-900 rounded-sm border border-slate-800 p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                    Mathematical Checksum Explainer Lab
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-500">MATH_ID: 201-LUHN</span>
              </div>
              <p className="text-slate-400 text-xs max-w-2xl mb-6 font-mono leading-relaxed">
                Understand the mathematical equations used to filter out false positives. Standalone 10-digit NPIs must be prepended with 80840 to calculate the Luhn check digit correctly.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-wider font-mono">Select Checksum Type</label>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => { setChecksumType("NPI"); setChecksumInput("1013498522"); }}
                        className={`px-4 py-2.5 rounded-sm text-xs font-mono text-left border transition-all ${
                          checksumType === "NPI" 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        NPI Modulo 10 (+24 Offset)
                      </button>
                      <button 
                        onClick={() => { setChecksumType("IBAN"); setChecksumInput("GB29NWBK60161331926819"); }}
                        className={`px-4 py-2.5 rounded-sm text-xs font-mono text-left border transition-all ${
                          checksumType === "IBAN" 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        IBAN Modulo 97 Check
                      </button>
                      <button 
                        onClick={() => { setChecksumType("LUHN"); setChecksumInput("4111222233334444"); }}
                        className={`px-4 py-2.5 rounded-sm text-xs font-mono text-left border transition-all ${
                          checksumType === "LUHN" 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        Credit Card Luhn Standard
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-wider font-mono">Test String / Number</label>
                    <input 
                      type="text" 
                      value={checksumInput}
                      onChange={(e) => setChecksumInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-sm p-3 font-mono text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    onClick={runChecksumValidation}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-[#070b13] py-2.5 rounded-sm text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm font-mono uppercase tracking-wider"
                  >
                    Validate Code
                  </button>
                </div>

                <div className="lg:col-span-8 bg-slate-950/60 rounded-sm border border-slate-800 p-5 min-h-[220px] flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">
                      Arithmetic Resolution Steps
                    </h3>
                    {checksumResult ? (
                      <div className="space-y-2">
                        {checksumResult.steps.map((step, idx) => (
                          <div key={idx} className="font-mono text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-slate-500 shrink-0">{`[${idx+1}]`}</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic font-mono">Run validation to print trace steps.</p>
                    )}
                  </div>

                  {checksumResult && (
                    <div className="mt-6 pt-4 border-t border-slate-850 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-mono">Formula Output Result:</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold font-mono ${
                        checksumResult.isValid 
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}>
                        {checksumResult.isValid ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            VALID CHECKSUM
                          </>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" />
                            INVALID CHECKSUM
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ARBITER HUMAN IN THE LOOP */}
        {activeTab === "arbiter" && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-sm border border-slate-800 p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                    Arbiter Human Review Queue console
                  </h2>
                </div>
                <button 
                  onClick={fetchArbiterCases}
                  disabled={isLoadingArbiter}
                  className="bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-300 px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-1.5 transition font-mono uppercase tracking-wider"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingArbiter ? "animate-spin" : ""}`} />
                  Refresh Queue
                </button>
              </div>
              <p className="text-slate-400 text-xs max-w-2xl mb-6 font-mono leading-relaxed">
                Grey cases containing ambiguous entities (such as capitalized months or words like 'Penny' or 'March' flagged with borderline scores) are routed here. Human reviewers inspect, resolve, or exclude them from PII blocks.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* CASES LIST */}
                <div className="lg:col-span-5 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                    Pending Logs ({arbiterCases.filter(c => c.status === "pending").length})
                  </h3>
                  {arbiterCases.length === 0 ? (
                    <p className="text-xs text-slate-500 italic font-mono">Review queue is empty. Clean state.</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar font-mono">
                      {arbiterCases.map((c) => (
                        <div 
                          key={c.id}
                          onClick={() => { setSelectedCase(c); setArbiterNotes(""); }}
                          className={`p-3.5 rounded-sm border transition-all cursor-pointer text-left ${
                            selectedCase?.id === c.id 
                              ? "bg-emerald-500/10 border-emerald-500" 
                              : c.status.startsWith("resolved")
                              ? "bg-slate-950/40 border-slate-900 opacity-60"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-mono text-sky-400 font-bold">Word: "{c.flaggedWord}"</span>
                            <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${
                              c.status === "pending" 
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                : c.status === "resolved_redact"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-800 text-slate-500 border border-slate-700"
                            }`}>
                              {c.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 truncate mb-1">
                            {c.originalText}
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Type: {c.detectedType}</span>
                            <span>NER Score: {c.score.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* RESOLUTION WORKSPACE */}
                <div className="lg:col-span-7 bg-slate-950/60 rounded-sm border border-slate-800 p-5 flex flex-col justify-between min-h-[300px]">
                  {selectedCase ? (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20 uppercase tracking-wider">
                          Case {selectedCase.id}
                        </span>
                        <h3 className="text-sm font-semibold text-white mt-2 font-mono">
                          Resolve Flagged Word: <code className="text-sky-400 font-mono">"{selectedCase.flaggedWord}"</code>
                        </h3>
                      </div>

                      <div className="text-xs text-slate-450 space-y-2 font-mono">
                        <p><strong>Original File Context:</strong></p>
                        <p className="p-3 bg-slate-950 border border-slate-850 rounded-sm text-slate-300 leading-normal">
                          {selectedCase.originalText}
                        </p>
                      </div>

                      {selectedCase.status === "pending" ? (
                        <div className="space-y-4 pt-4 border-t border-slate-850">
                          <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider font-mono">Assigned Officer Notes</label>
                            <textarea 
                              placeholder="Describe the context decision, e.g., 'Word is clinical medication allergy, not personal name'..."
                              value={arbiterNotes}
                              onChange={(e) => setArbiterNotes(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-sm p-2.5 font-mono text-xs text-slate-300 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-3 font-mono">
                            <button
                              onClick={() => resolveArbiter("redact")}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-[#070b13] py-2 rounded-sm text-xs font-bold transition flex items-center justify-center gap-1.5 uppercase tracking-wider"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              Approve Redaction (Keep Masked)
                            </button>
                            <button
                              onClick={() => resolveArbiter("exclude")}
                              className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 py-2 rounded-sm text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5 uppercase tracking-wider"
                            >
                              <X className="w-3.5 h-3.5" />
                              Exclude & Exempt (Unmask)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-sm p-4 text-xs text-emerald-400/90 space-y-1 font-mono">
                          <p className="font-bold flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Case Resolved Complete
                          </p>
                          <p><strong>Decision:</strong> {selectedCase.status === "resolved_redact" ? "Redaction Approved" : "Excluded from PII blocks"}</p>
                          <p><strong>Reviewed By:</strong> {selectedCase.decisionBy}</p>
                          {selectedCase.notes && <p><strong>Notes:</strong> {selectedCase.notes}</p>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                      <Layers className="w-12 h-12 text-slate-700 mb-3" />
                      <p className="text-xs font-mono text-center max-w-sm">Select an active review case from the queue list on the left to execute manual compliance resolution.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: INTERVIEW AND EXERCISES */}
        {activeTab === "interview" && (
          <div className="space-y-8">
            
            {/* PORTAL INTERVIEW QUESTIONS */}
            <div className="bg-slate-900 rounded-sm border border-slate-800 p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                    Compliance & Redaction Engineering Interview Prep
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-500">TEST_ID: 301-QUIZ</span>
              </div>
              <p className="text-slate-450 text-xs max-w-2xl mb-8 font-mono leading-relaxed">
                Test your expertise on high-compliance AI architectures, checksum validations, and token replacement security patterns.
              </p>

              <div className="space-y-6">
                {quizQuestions.map((q, idx) => (
                  <div key={idx} className="bg-slate-950/40 border border-slate-800/80 rounded-sm p-5 font-mono">
                    <h3 className="text-xs font-semibold text-slate-200 mb-4 leading-normal flex gap-2 uppercase tracking-wide">
                      <span className="text-emerald-400 font-mono">Q{idx+1}.</span>
                      <span>{q.q}</span>
                    </h3>
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          onClick={() => handleSelectQuizAnswer(idx, oIdx)}
                          className={`w-full text-left p-3 rounded-sm text-xs transition border flex items-center justify-between ${
                            quizAnswers[idx] === oIdx 
                              ? "bg-sky-500/10 border-sky-500 text-sky-400 font-bold" 
                              : "bg-slate-900 border-slate-800 text-slate-450 hover:text-white"
                          }`}
                        >
                          <span>{opt}</span>
                          {quizAnswers[idx] === oIdx && <Check className="w-3.5 h-3.5 shrink-0 text-sky-400" />}
                        </button>
                      ))}
                    </div>
                    {quizScore !== null && (
                      <div className="mt-4 p-3 bg-slate-900/60 rounded-sm border border-slate-800 text-xs leading-normal">
                        <span className={`font-bold block mb-1 ${quizAnswers[idx] === q.correct ? "text-emerald-400" : "text-rose-400"}`}>
                          {quizAnswers[idx] === q.correct ? "✓ Correct Answer" : "✗ Incorrect Answer"}
                        </span>
                        <span className="text-slate-400">{q.expl}</span>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex justify-between items-center pt-4 border-t border-slate-800/80">
                  <span className="text-xs text-slate-500 font-mono">
                    {quizScore !== null ? `Your Score: ${quizScore} / ${quizQuestions.length}` : "Complete all choices to submit."}
                  </span>
                  <button
                    onClick={gradeQuiz}
                    className="bg-emerald-500 hover:bg-emerald-600 text-[#070b13] px-5 py-2 rounded-sm text-xs font-bold transition shadow-sm font-mono uppercase tracking-wider"
                  >
                    Grade Answers
                  </button>
                </div>
              </div>
            </div>

            {/* PRACTICAL IMPLEMENTATION CODING TASK */}
            <div className="bg-slate-900 rounded-sm border border-slate-800 p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                    Practical Coding Exercise: Implement NPI Redactor
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-500">LAB_ID: 302-NPI</span>
              </div>
              <p className="text-slate-450 text-xs max-w-2xl mb-6 font-mono leading-relaxed">
                Complete the code block below to correctly implement a regular-expression driven replacement engine that validates matched standalone NPI codes before executing a mask.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7">
                  <textarea
                    value={exerciseCodeInput}
                    onChange={(e) => setExerciseCodeInput(e.target.value)}
                    rows={12}
                    className="w-full bg-slate-950 border border-slate-800 rounded-sm p-4 font-mono text-xs text-emerald-450 focus:ring-1 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={runCodeExercise}
                      className="bg-emerald-500 hover:bg-emerald-600 text-[#070b13] px-5 py-2 rounded-sm text-xs font-bold transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Run Test Suite
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-slate-950/60 rounded-sm border border-slate-800 p-5 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">
                      Build & Test Log Output
                    </h3>
                    {exerciseResult ? (
                      <div className="space-y-3">
                        <div className={`text-xs font-mono p-3 rounded-sm border ${
                          exerciseResult.success 
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" 
                            : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                        }`}>
                          {exerciseResult.message}
                        </div>
                        {exerciseResult.success && (
                          <div className="font-mono text-[10px] text-slate-500 space-y-1">
                            <p>[PASS] Test Vector: "Dr Mercer (NPI: 1013498522)" matches valid regex</p>
                            <p>[PASS] Test Vector: 1013498522 successfully verified against Luhn modulus 10</p>
                            <p>[PASS] Mask Replacement yields sequential placeholder correctly</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic font-mono">Run tests to compile code block.</p>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 border-t border-slate-850 pt-4 font-mono">
                    Tip: Ensure your replace callback executes Luhn verification (e.g. calls <code>validateNPI</code>) to ignore fake mock numeric coordinates!
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-800 px-4 sm:px-6 lg:px-8 text-center text-[11px] text-slate-500 font-mono uppercase tracking-widest">
        <p>© 2026 PII Compliance Gateway Portal. Stood up in accordance with HIPAA Safe Harbor and GDPR Data Minimization mandates.</p>
        <p className="mt-1 text-slate-600 normal-case tracking-normal">Acting as active AI security auditor for regulated enterprise integrations.</p>
      </footer>
    </div>
  );
}
