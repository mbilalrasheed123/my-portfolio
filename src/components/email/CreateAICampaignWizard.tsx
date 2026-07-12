import React, { useState, useRef } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Upload, FileText, AlertCircle, Trash2, HelpCircle, Sparkles, Wand2 } from "lucide-react";
import ModelSelector from "./ModelSelector";
import ImageStrategySelector from "./ImageStrategySelector";
import ManualLeadEntry from "./ManualLeadEntry";

interface CreateAICampaignWizardProps {
  onBack: () => void;
  onSuccess: (campaignId: string) => void;
}

export default function CreateAICampaignWizard({ onBack, onSuccess }: CreateAICampaignWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wizard State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [geminiModel, setGeminiModel] = useState("flash-lite");
  const [imageStrategy, setImageStrategy] = useState("option1-keyword");
  const [csvContent, setCsvContent] = useState("");
  const [leadsPreview, setLeadsPreview] = useState<any[]>([]);
  const [validationStats, setValidationStats] = useState<{ valid: number; total: number } | null>(null);
  const [instructions, setInstructions] = useState("");

  // Lead Entry Modes State
  const [leadInputMode, setLeadInputMode] = useState<"csv" | "paste" | "manual">("csv");
  const [uploadedCsvContent, setUploadedCsvContent] = useState("");
  const [pastedRawContent, setPastedRawContent] = useState("");
  const [manualLeads, setManualLeads] = useState<any[]>([]);
  const [isManualLeadsValid, setIsManualLeadsValid] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model RPM mapping
  const getRpmLimit = (model: string) => {
    switch (model) {
      case "flash-lite": return 15;
      case "flash": return 10;
      case "2.5-flash": return 10;
      case "2.5-pro": return 2;
      default: return 10;
    }
  };

  // Parsing CSV client-side for Preview and validation
  const handleCSVUpload = (text: string) => {
    if (!text.trim()) {
      if (leadInputMode === "csv") {
        setUploadedCsvContent("");
      } else if (leadInputMode === "paste") {
        setPastedRawContent("");
      }
      setCsvContent("");
      setLeadsPreview([]);
      setValidationStats(null);
      return;
    }

    if (leadInputMode === "csv") {
      setUploadedCsvContent(text);
    } else if (leadInputMode === "paste") {
      setPastedRawContent(text);
    }
    setCsvContent(text);

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      setError("The uploaded CSV file is empty or missing data rows.");
      return;
    }

    const firstLine = lines[0].toLowerCase();
    const headers = firstLine.split(",").map(h => h.replace(/^["']|["']$/g, "").trim());

    const emailIdx = headers.findIndex(h => h.includes("email") || h === "mail");
    const nameIdx = headers.findIndex(h => h.includes("name") && !h.includes("business"));
    const bTypeIdx = headers.findIndex(h => h.includes("businesstype") || h.includes("business_type") || h.includes("type"));
    const bNameIdx = headers.findIndex(h => h.includes("businessname") || h.includes("business_name"));
    const cityIdx = headers.findIndex(h => h === "city" || h.includes("location") || h.includes("town"));

    const previewRows: any[] = [];
    let validCount = 0;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(col => col.replace(/^["']|["']$/g, "").trim());
      if (cols.length === 0 || !cols[0]) continue;

      let email = "";
      let name = "";
      let businessType = "";
      let businessName = "";
      let city = "";

      if (emailIdx !== -1) {
        email = cols[emailIdx] || "";
        name = nameIdx !== -1 && nameIdx < cols.length ? cols[nameIdx] : "";
        businessType = bTypeIdx !== -1 && bTypeIdx < cols.length ? cols[bTypeIdx] : "";
        businessName = bNameIdx !== -1 && bNameIdx < cols.length ? cols[bNameIdx] : "";
        city = cityIdx !== -1 && cityIdx < cols.length ? cols[cityIdx] : "";
      } else {
        email = cols[0] || "";
        name = cols[1] || "";
        businessType = cols[2] || "";
        businessName = cols[3] || "";
        city = cols[4] || "";
      }

      const isValidEmail = emailRegex.test(email.trim());
      if (isValidEmail) validCount++;

      if (previewRows.length < 5) {
        previewRows.push({
          email: email || "N/A",
          name: name || "N/A",
          businessType: businessType || "N/A",
          businessName: businessName || "N/A",
          city: city || "N/A",
          isValid: isValidEmail
        });
      }
    }

    setLeadsPreview(previewRows);
    setValidationStats({ valid: validCount, total: lines.length - 1 });
    setError(null);
  };

  // Parse CSV helper for combining
  const parseCSVToLeads = (text: string): any[] => {
    if (!text.trim()) return [];
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const firstLine = lines[0].toLowerCase();
    const headers = firstLine.split(",").map(h => h.replace(/^["']|["']$/g, "").trim());

    const emailIdx = headers.findIndex(h => h.includes("email") || h === "mail");
    const nameIdx = headers.findIndex(h => h.includes("name") && !h.includes("business"));
    const bTypeIdx = headers.findIndex(h => h.includes("businesstype") || h.includes("business_type") || h.includes("type"));
    const bNameIdx = headers.findIndex(h => h.includes("businessname") || h.includes("business_name"));
    const cityIdx = headers.findIndex(h => h === "city" || h.includes("location") || h.includes("town"));

    const parsed: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(col => col.replace(/^["']|["']$/g, "").trim());
      if (cols.length === 0 || !cols[0]) continue;

      let email = "";
      let name = "";
      let businessType = "";
      let businessName = "";
      let city = "";

      if (emailIdx !== -1) {
        email = cols[emailIdx] || "";
        name = nameIdx !== -1 && nameIdx < cols.length ? cols[nameIdx] : "";
        businessType = bTypeIdx !== -1 && bTypeIdx < cols.length ? cols[bTypeIdx] : "";
        businessName = bNameIdx !== -1 && bNameIdx < cols.length ? cols[bNameIdx] : "";
        city = cityIdx !== -1 && cityIdx < cols.length ? cols[cityIdx] : "";
      } else {
        email = cols[0] || "";
        name = cols[1] || "";
        businessType = cols[2] || "";
        businessName = cols[3] || "";
        city = cols[4] || "";
      }

      if (email.trim()) {
        parsed.push({
          email: email.trim(),
          name: name.trim(),
          businessType: businessType.trim() || "other",
          businessName: businessName.trim(),
          city: city.trim()
        });
      }
    }
    return parsed;
  };

  const convertLeadsToCSV = (leads: any[]) => {
    const headers = ["email", "name", "businessType", "businessName", "city"];
    const rowsList = leads.map(l => [
      l.email || "",
      l.name || "",
      l.businessType || "other",
      l.businessName || "",
      l.city || ""
    ].map(val => `"${val.replace(/"/g, '""')}"`).join(","));
    
    return [headers.join(","), ...rowsList].join("\n");
  };

  const handleModeChange = (mode: "csv" | "paste" | "manual") => {
    setLeadInputMode(mode);
    setError(null);
    
    if (mode === "csv") {
      if (uploadedCsvContent) {
        handleCSVUpload(uploadedCsvContent);
      } else {
        setLeadsPreview([]);
        setValidationStats(null);
      }
    } else if (mode === "paste") {
      if (pastedRawContent) {
        handleCSVUpload(pastedRawContent);
      } else {
        setLeadsPreview([]);
        setValidationStats(null);
      }
    } else if (mode === "manual") {
      // Synchronize manualLeads with uploaded/pasted CSV rows if manualLeads is empty
      let updatedManualLeads = [...manualLeads];
      if (updatedManualLeads.length === 0) {
        const activeContent = uploadedCsvContent || pastedRawContent;
        if (activeContent) {
          const parsed = parseCSVToLeads(activeContent);
          if (parsed.length > 0) {
            updatedManualLeads = parsed;
            setManualLeads(parsed);
          }
        }
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validCount = updatedManualLeads.filter(l => l.email && emailRegex.test(l.email.trim())).length;
      setValidationStats({ valid: validCount, total: updatedManualLeads.length });
    }
  };

  const handleRawDataPaste = (text: string) => {
    setPastedRawContent(text);
    handleCSVUpload(text);
  };

  const handleCombineAndProceed = () => {
    let combinedLeads: any[] = [];

    // Parse uploaded CSV if any
    if (uploadedCsvContent) {
      combinedLeads.push(...parseCSVToLeads(uploadedCsvContent));
    }
    
    // Parse pasted raw content if any
    if (pastedRawContent) {
      combinedLeads.push(...parseCSVToLeads(pastedRawContent));
    }

    // Add manual leads if any
    if (manualLeads.length > 0) {
      const validManualLeads = manualLeads.filter(l => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return (
          l.email &&
          emailRegex.test(l.email.trim()) &&
          l.name &&
          l.name.trim().length >= 2 &&
          l.businessName &&
          l.businessName.trim().length >= 2 &&
          l.city &&
          l.city.trim().length >= 2
        );
      });
      combinedLeads.push(...validManualLeads);
    }

    // De-duplicate by email (case-insensitive)
    const seenEmails = new Set<string>();
    const uniqueLeads: any[] = [];
    
    combinedLeads.forEach(lead => {
      const emailKey = lead.email.trim().toLowerCase();
      if (!seenEmails.has(emailKey)) {
        seenEmails.add(emailKey);
        uniqueLeads.push(lead);
      }
    });

    if (uniqueLeads.length === 0) {
      setError("Please supply at least 1 valid lead.");
      return;
    }

    // Convert to CSV
    const finalCsvContent = convertLeadsToCSV(uniqueLeads);
    setCsvContent(finalCsvContent);

    // Set the previews and validation stats for Step 4 review
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validCount = uniqueLeads.filter(l => emailRegex.test(l.email.trim())).length;
    setValidationStats({ valid: validCount, total: uniqueLeads.length });

    // Update preview row state
    setLeadsPreview(uniqueLeads.slice(0, 5).map(l => ({
      ...l,
      isValid: emailRegex.test(l.email.trim())
    })));

    setStep(4);
  };

  const isNextStepDisabled = () => {
    if (step === 1) {
      return !title.trim();
    }
    if (step === 2) {
      return false;
    }
    if (step === 3) {
      if (leadInputMode === "csv") {
        return !uploadedCsvContent || !validationStats || validationStats.valid === 0;
      }
      if (leadInputMode === "paste") {
        return !pastedRawContent || !validationStats || validationStats.valid === 0;
      }
      if (leadInputMode === "manual") {
        return manualLeads.length === 0 || !isManualLeadsValid;
      }
    }
    return false;
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        setError("Only CSV file imports are supported.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleCSVUpload(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleCSVUpload(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleStepNext = () => {
    setError(null);
    if (step === 1) {
      if (!title.trim()) {
        setError("Please supply a descriptive Campaign name.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      handleCombineAndProceed();
    }
  };

  // Submit and create
  const handleFinalSubmit = async () => {
    setError(null);
    if (!instructions.trim()) {
      setError("Please add personalized sales copy guidelines for Gemini.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create AI Campaign
      const createResp = await fetch("/api/email/ai-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          instructions,
          imageStrategy,
          geminiModel
        })
      });

      const createData = await createResp.json();
      if (!createResp.ok) {
        throw new Error(createData.error || "Failed to create Campaign draft.");
      }

      const campaignId = createData.campaignId;

      // 2. Upload CSV content
      const uploadResp = await fetch(`/api/email/ai-campaigns/${campaignId}/upload-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent })
      });

      const uploadData = await uploadResp.json();
      if (!uploadResp.ok) {
        throw new Error(uploadData.error || "Failed to upload parsed leads.");
      }

      // Success! Back to list or detail view
      onSuccess(campaignId);
    } catch (err: any) {
      console.error("[Create Campaign Wizard Error]:", err);
      setError(err?.message || "An unexpected error occurred during creation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* HEADER W/ STEPS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[9px] font-mono text-secondary hover:text-white uppercase tracking-widest mb-2 transition-all cursor-pointer"
          >
            <ArrowLeft size={10} /> Back to Campaigns
          </button>
          <h2 className="text-2xl font-display font-medium uppercase text-white flex items-center gap-2">
            <Wand2 size={20} className="text-[#2563eb]" /> Create AI Campaign Wizard
          </h2>
        </div>

        {/* STEPPER METRIC */}
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-secondary">
          <span className="text-white font-bold">Step {step}</span> / 4
          <div className="flex gap-1 items-center ml-2">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-[#2563eb]" : i < step ? "w-2 bg-emerald-500" : "w-1.5 bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ERROR CARD */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-3">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* WIZARD VIEWS */}
      <div className="bg-[#111317] border border-white/[0.06] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* STEP 1: BASIC INFO */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold">
                Campaign Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Dental Outreach Campaign"
                className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-[#2563eb]/30 rounded-xl px-4 py-3 text-xs text-white outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of targeting strategy, objectives or segment description..."
                rows={3}
                className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-[#2563eb]/30 rounded-xl px-4 py-3 text-xs text-white outline-none resize-none"
              />
            </div>

            {/* MODEL SELECTOR WITH INLINE RPM */}
            <ModelSelector value={geminiModel} onChange={setGeminiModel} />

            <div className="p-4 bg-[#2563eb]/5 border border-[#2563eb]/10 rounded-2xl flex items-center gap-3">
              <HelpCircle size={14} className="text-[#2563eb]" />
              <span className="text-[10px] font-mono text-secondary uppercase tracking-wider leading-relaxed">
                Chosen model has a rate limit constraint of <span className="text-white font-bold">{getRpmLimit(geminiModel)} requests/minute</span>. Our intelligent queue self-heals by sleeping when limit boundaries are approached.
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: IMAGE STRATEGY */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <ImageStrategySelector value={imageStrategy} onChange={setImageStrategy} />

            {/* PREVIEW OF SELECTED IMAGE STYLE */}
            <div className="bg-white/[0.01] border border-white/[0.04] p-6 rounded-2xl space-y-4">
              <span className="text-[9px] font-mono text-secondary uppercase tracking-widest font-bold">Personalized Email Preview</span>
              <div className="bg-[#0c0d10] p-4 rounded-xl border border-white/5 space-y-3">
                <div className="h-2 w-1/3 bg-white/10 rounded-full" />
                <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                <div className="h-2 w-1/2 bg-white/5 rounded-full" />

                {/* Simulated Image */}
                <div className="w-full h-40 rounded-xl relative overflow-hidden bg-slate-900 border border-white/[0.06] flex items-center justify-center">
                  {imageStrategy === "option1-keyword" ? (
                    <div className="text-center p-4">
                      <p className="text-[10px] font-mono text-[#2563eb] uppercase tracking-wider font-bold">Dynamic Keyword Ingestion</p>
                      <p className="text-xs text-white mt-1">Source: <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono">https://source.unsplash.com/featured/600x400/?modern-bakery</code></p>
                      <p className="text-[9px] text-secondary mt-2">Serves a fresh image related to the lead's business type every single open!</p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-[10px] font-mono text-white uppercase tracking-wider font-bold">Direct Photo URL Embed</p>
                      <p className="text-xs text-secondary mt-1 max-w-sm truncate mx-auto">Embeds a fixed URL (e.g. <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono">https://images.unsplash.com/photo-1556742049...</code>)</p>
                      <p className="text-[9px] text-secondary mt-2">Returns the same image every time the email is opened.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: UPLOAD LEADS */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            {/* INPUT METHOD TOGGLE */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
              <span className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold">
                Select Lead Input Method
              </span>
              <div className="flex bg-[#0c0d10] border border-white/5 rounded-xl p-1 gap-1" id="lead-input-mode-selector">
                <button
                  type="button"
                  onClick={() => handleModeChange("csv")}
                  className={`px-4 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                    leadInputMode === "csv"
                      ? "bg-[#2563eb] text-white font-bold"
                      : "text-secondary hover:text-white"
                  }`}
                >
                  Upload CSV File
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("paste")}
                  className={`px-4 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                    leadInputMode === "paste"
                      ? "bg-[#2563eb] text-white font-bold"
                      : "text-secondary hover:text-white"
                  }`}
                >
                  Paste Raw Data
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("manual")}
                  className={`px-4 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                    leadInputMode === "manual"
                      ? "bg-[#2563eb] text-white font-bold"
                      : "text-secondary hover:text-white"
                  }`}
                >
                  Add Manually
                </button>
              </div>
            </div>

            {/* MODE 1: CSV FILE UPLOAD */}
            {leadInputMode === "csv" && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold">
                    Import CSV File
                  </label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 hover:border-[#2563eb]/40 bg-white/[0.01] hover:bg-white/[0.02] p-10 rounded-3xl text-center cursor-pointer transition-all space-y-3"
                  >
                    <div className="p-4 bg-white/5 rounded-full w-fit mx-auto border border-white/10 text-secondary">
                      <Upload size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-white font-sans font-bold">Drag & Drop CSV leads file here</p>
                      <p className="text-[10px] text-secondary font-mono uppercase tracking-widest mt-1">or click to browse filesystem</p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv"
                      className="hidden"
                    />
                  </div>

                  <div className="text-[9px] font-mono text-secondary uppercase tracking-wider leading-relaxed pt-2">
                    Required columns: <span className="text-white font-bold">email, name, businessType, businessName, city</span>. Extra headers are completely ignored.
                  </div>
                </div>
              </div>
            )}

            {/* MODE 2: PASTE RAW DATA */}
            {leadInputMode === "paste" && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold">
                    Paste Raw CSV/TSV Data
                  </label>
                  <textarea
                    value={pastedRawContent}
                    onChange={(e) => handleRawDataPaste(e.target.value)}
                    rows={8}
                    placeholder="john@example.com, John Doe, clinic, Dental Clinic, Chicago&#10;mary@example.com, Mary Smith, food, Pizza Place, Seattle"
                    className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-[#2563eb]/30 rounded-2xl p-4 text-xs text-white outline-none font-mono leading-relaxed"
                  />
                  <div className="text-[9px] font-mono text-secondary uppercase tracking-wider leading-relaxed pt-2">
                    Format: <span className="text-white">email, name, businessType, businessName, city</span>. Comma or Tab separated.
                  </div>
                </div>
              </div>
            )}

            {/* MODE 3: MANUAL ENTRY TABLE */}
            {leadInputMode === "manual" && (
              <div className="space-y-4 animate-fade-in">
                <ManualLeadEntry
                  initialLeads={manualLeads}
                  onLeadsChange={setManualLeads}
                  onValidationChange={setIsManualLeadsValid}
                />
              </div>
            )}

            {/* LEADS PREVIEW & STATISTICS FOR PARSED MODES */}
            {leadInputMode !== "manual" && csvContent && (
              <div className="space-y-4 pt-4 border-t border-white/[0.04] animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-secondary uppercase tracking-widest font-bold">
                    Import Validation Metrics
                  </span>
                  {validationStats && (
                    <span className="text-xs font-mono font-bold text-white">
                      Valid rows: <span className="text-emerald-400">{validationStats.valid}</span> / {validationStats.total}
                    </span>
                  )}
                </div>

                <div className="bg-[#0c0d10] border border-white/5 rounded-2xl overflow-hidden">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04] bg-white/[0.02] font-mono text-[9px] text-secondary uppercase tracking-wider">
                        <th className="p-3">Email</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Business Name</th>
                        <th className="p-3">Business Type</th>
                        <th className="p-3">City</th>
                        <th className="p-3 text-right">Valid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-secondary">
                      {leadsPreview.map((row, index) => (
                        <tr key={index}>
                          <td className="p-3 font-mono text-[10px] text-white">{row.email}</td>
                          <td className="p-3 text-white font-medium">{row.name}</td>
                          <td className="p-3">{row.businessName}</td>
                          <td className="p-3">{row.businessType}</td>
                          <td className="p-3">{row.city}</td>
                          <td className="p-3 text-right">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                              row.isValid ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                            }`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: INSTRUCTIONS */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold">
                  Personalized Instructions for Gemini
                </label>
                <span className="text-[10px] font-mono text-secondary uppercase tracking-wider">
                  {instructions.length} chars
                </span>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={6}
                placeholder="Write specific context prompts here. E.g.
'For dental clinics, focus on our specialized patient scheduling automation and mention that you live in their town. For clinics in Chicago, mention the upcoming local convention. Keep the style highly professional, casual, and strictly under 150 words.'"
                className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-[#2563eb]/30 rounded-2xl p-4 text-xs text-white outline-none font-sans leading-relaxed"
              />
            </div>

            {/* PREVIEW HOW AI WILL PERSONALIZE */}
            <div className="p-5 bg-white/[0.01] border border-white/[0.04] rounded-2xl space-y-3">
              <span className="text-[9px] font-mono text-[#2563eb] uppercase tracking-widest font-bold block">Instruction compliance preview</span>
              <p className="text-[10px] text-[#94a3b8] leading-relaxed">
                Gemini will combine your instructions with each lead's structured details (<span className="text-white">name, business type, location</span>) to generate a customized pitch. No two recipients will get the exact same copy.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-between items-center bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl">
        <button
          onClick={onBack}
          className="px-5 py-2 hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] text-secondary hover:text-white rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all cursor-pointer"
        >
          Cancel Wizard
        </button>

        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-5 py-2 hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] text-secondary hover:text-white rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all cursor-pointer"
            >
              Previous
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={handleStepNext}
              disabled={isNextStepDisabled()}
              className="px-5 py-2 bg-[#2563eb] hover:bg-blue-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 text-white rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)] font-bold"
            >
              Next Step <ArrowRight size={12} />
            </button>
          ) : (
            <button
              onClick={handleFinalSubmit}
              disabled={loading}
              className="px-6 py-2 bg-[#2563eb] hover:bg-blue-600 active:scale-95 disabled:opacity-50 text-white rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)] font-bold"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create & Import Campaign <CheckCircle size={12} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
