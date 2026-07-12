import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Check, AlertCircle, HelpCircle } from "lucide-react";

export interface LeadRow {
  id: string;
  email: string;
  name: string;
  businessType: string;
  businessName: string;
  city: string;
}

interface ManualLeadEntryProps {
  initialLeads?: any[];
  onLeadsChange: (leads: any[]) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export default function ManualLeadEntry({
  initialLeads = [],
  onLeadsChange,
  onValidationChange
}: ManualLeadEntryProps) {
  const [rows, setRows] = useState<LeadRow[]>(() => {
    if (initialLeads.length > 0) {
      return initialLeads.map((lead, idx) => ({
        id: lead.id || `lead-${idx}-${Math.random().toString(36).substr(2, 9)}`,
        email: lead.email || "",
        name: lead.name || "",
        businessType: lead.businessType || "other",
        businessName: lead.businessName || "",
        city: lead.city || ""
      }));
    }
    // Default with one empty row
    return [
      {
        id: `lead-0-${Math.random().toString(36).substr(2, 9)}`,
        email: "",
        name: "",
        businessType: "other",
        businessName: "",
        city: ""
      }
    ];
  });

  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, Record<string, boolean>>>({});

  // Validation rules helpers
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const validateName = (name: string) => {
    const val = name.trim();
    if (val.length < 2 || val.length > 50) return false;
    // Allow spaces, letters, and numbers (no special characters except spaces)
    return /^[a-zA-Z0-9\s]+$/.test(val);
  };

  const validateBusinessType = (type: string) => {
    return ["clinic", "property", "food", "other"].includes(type);
  };

  const validateBusinessName = (bName: string) => {
    const val = bName.trim();
    if (val.length < 2 || val.length > 100) return false;
    // Allow spaces, letters, numbers, and hyphens
    return /^[a-zA-Z0-9\s-]+$/.test(val);
  };

  const validateCity = (city: string) => {
    const val = city.trim();
    if (val.length < 2 || val.length > 50) return false;
    // Allow spaces
    return /^[a-zA-Z0-9\s]+$/.test(val);
  };

  // Check duplicates in the table
  const getDuplicateEmails = () => {
    const emailCounts: Record<string, number> = {};
    rows.forEach(r => {
      const email = r.email.trim().toLowerCase();
      if (email) {
        emailCounts[email] = (emailCounts[email] || 0) + 1;
      }
    });
    return emailCounts;
  };

  const emailCounts = getDuplicateEmails();

  // Validate a single field of a row
  const getFieldValidation = (row: LeadRow, field: keyof LeadRow) => {
    const val = row[field] as string;
    
    // If field is untouched and empty, we don't show validation errors as visual noise
    // UNLESS another field in the same row is filled, making this row "active"
    const isRowActive = row.email || row.name || row.businessName || row.city;
    const isTouched = touchedFields[row.id]?.[field];
    const shouldValidate = isTouched || (isRowActive && val !== "");

    if (!shouldValidate && val === "") {
      return { valid: null, message: "" };
    }

    switch (field) {
      case "email":
        if (!val.trim()) {
          return { valid: false, message: "Email is required" };
        }
        if (!validateEmail(val)) {
          return { valid: false, message: "Invalid email format" };
        }
        if (emailCounts[val.trim().toLowerCase()] > 1) {
          return { valid: false, message: "Duplicate email address" };
        }
        return { valid: true, message: "" };

      case "name":
        if (!val.trim()) {
          return { valid: false, message: "Name is required" };
        }
        if (val.trim().length < 2 || val.trim().length > 50) {
          return { valid: false, message: "Must be 2-50 characters" };
        }
        if (!validateName(val)) {
          return { valid: false, message: "No special characters allowed" };
        }
        return { valid: true, message: "" };

      case "businessType":
        if (!validateBusinessType(val)) {
          return { valid: false, message: "Invalid business type" };
        }
        return { valid: true, message: "" };

      case "businessName":
        if (!val.trim()) {
          return { valid: false, message: "Business Name is required" };
        }
        if (val.trim().length < 2 || val.trim().length > 100) {
          return { valid: false, message: "Must be 2-100 characters" };
        }
        if (!validateBusinessName(val)) {
          return { valid: false, message: "Only letters, numbers, spaces, and hyphens" };
        }
        return { valid: true, message: "" };

      case "city":
        if (!val.trim()) {
          return { valid: false, message: "City is required" };
        }
        if (val.trim().length < 2 || val.trim().length > 50) {
          return { valid: false, message: "Must be 2-50 characters" };
        }
        if (!validateCity(val)) {
          return { valid: false, message: "Only letters, numbers, and spaces" };
        }
        return { valid: true, message: "" };

      default:
        return { valid: true, message: "" };
    }
  };

  // Determine if the entire row is valid
  const isRowValid = (row: LeadRow) => {
    return (
      validateEmail(row.email) &&
      emailCounts[row.email.trim().toLowerCase()] <= 1 &&
      validateName(row.name) &&
      validateBusinessType(row.businessType) &&
      validateBusinessName(row.businessName) &&
      validateCity(row.city)
    );
  };

  // Determine if all rows are valid
  const checkAllRowsValidity = () => {
    if (rows.length === 0) return false;
    return rows.every(row => isRowValid(row));
  };

  const allRowsValid = checkAllRowsValidity();

  // Trigger callbacks when rows change
  useEffect(() => {
    // Strip IDs for external callback as requested
    const cleanLeads = rows.map(({ id, ...rest }) => rest);
    onLeadsChange(cleanLeads);

    if (onValidationChange) {
      onValidationChange(allRowsValid);
    }
  }, [rows, allRowsValid]);

  const handleFieldChange = (rowId: string, field: keyof LeadRow, value: string) => {
    setRows(prev =>
      prev.map(row => (row.id === rowId ? { ...row, [field]: value } : row))
    );
    markFieldTouched(rowId, field);
  };

  const markFieldTouched = (rowId: string, field: string) => {
    setTouchedFields(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: true
      }
    }));
  };

  const handleAddRow = () => {
    const newId = `lead-${rows.length}-${Math.random().toString(36).substr(2, 9)}`;
    setRows(prev => [
      ...prev,
      {
        id: newId,
        email: "",
        name: "",
        businessType: "other",
        businessName: "",
        city: ""
      }
    ]);
    setLastAddedId(newId);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows(prev => {
      const filtered = prev.filter(row => row.id !== rowId);
      if (filtered.length === 0) {
        // Always keep at least 1 empty row
        return [
          {
            id: `lead-0-${Math.random().toString(36).substr(2, 9)}`,
            email: "",
            name: "",
            businessType: "other",
            businessName: "",
            city: ""
          }
        ];
      }
      return filtered;
    });

    // Clean up touched fields map
    setTouchedFields(prev => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  // Handle clipboard paste of multiline CSV/tab data
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText.includes("\n") || pastedText.includes("\r")) {
      e.preventDefault();
      const lines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const newLeadsFromPaste: Omit<LeadRow, "id">[] = [];

      lines.forEach(line => {
        // Support either CSV commas or TSV tabs
        const cols = line.split(/[,\t]/).map(c => c.replace(/^["']|["']$/g, "").trim());
        if (cols.length > 0 && cols[0]) {
          newLeadsFromPaste.push({
            email: cols[0] || "",
            name: cols[1] || "",
            businessType: ["clinic", "property", "food", "other"].includes(cols[2]?.toLowerCase())
              ? cols[2].toLowerCase()
              : "other",
            businessName: cols[3] || "",
            city: cols[4] || ""
          });
        }
      });

      if (newLeadsFromPaste.length > 0) {
        setRows(prev => {
          const updated = [...prev];
          
          // Overwrite target row with the first pasted line
          const first = newLeadsFromPaste[0];
          updated[rowIndex] = {
            ...updated[rowIndex],
            email: first.email,
            name: first.name,
            businessType: first.businessType,
            businessName: first.businessName,
            city: first.city
          };

          // Append other lines as new rows
          const additional = newLeadsFromPaste.slice(1).map((lead, index) => ({
            id: `lead-paste-${rowIndex}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            ...lead
          }));

          updated.splice(rowIndex + 1, 0, ...additional);
          return updated;
        });
      }
    }
  };

  // Handle enter key on City field (last field) to auto-add and focus next row
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    field: keyof LeadRow
  ) => {
    if (e.key === "Enter" && field === "city") {
      e.preventDefault();
      const nextRow = rows[rowIndex + 1];
      if (!nextRow) {
        handleAddRow();
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* ACTION TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleAddRow}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer font-bold shrink-0 self-start sm:self-auto"
          id="btn-add-manual-row"
        >
          <Plus size={12} /> Add New Row
        </button>

        <div className="flex items-center gap-3 font-mono text-[10px] uppercase text-secondary">
          <span>
            Total leads: <span className="text-white font-bold">{rows.length}</span>
          </span>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1.5">
            {allRowsValid ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check size={12} /> All fields valid ✓
              </span>
            ) : (
              <span className="text-amber-500 flex items-center gap-1">
                <AlertCircle size={12} /> Fix errors before proceeding
              </span>
            )}
          </div>
        </div>
      </div>

      {/* MANUAL ENTRY SCROLLABLE TABLE */}
      <div className="bg-[#0c0d10] border border-white/5 rounded-2xl overflow-hidden shadow-inner">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/[0.04] bg-white/[0.02] font-mono text-[9px] text-secondary uppercase tracking-wider">
                <th className="p-3 w-[25%]">Email</th>
                <th className="p-3 w-[18%]">Name</th>
                <th className="p-3 w-[18%]">Business Type</th>
                <th className="p-3 w-[20%]">Business Name</th>
                <th className="p-3 w-[14%]">City</th>
                <th className="p-3 w-[5%] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-secondary">
              {rows.map((row, index) => {
                const emailVal = getFieldValidation(row, "email");
                const nameVal = getFieldValidation(row, "name");
                const typeVal = getFieldValidation(row, "businessType");
                const bNameVal = getFieldValidation(row, "businessName");
                const cityVal = getFieldValidation(row, "city");

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-white/[0.01] transition-all group"
                  >
                    {/* EMAIL COLUMN */}
                    <td className="p-2 relative">
                      <div className="relative flex items-center">
                        <input
                          type="email"
                          value={row.email}
                          onChange={e => handleFieldChange(row.id, "email", e.target.value)}
                          onBlur={() => markFieldTouched(row.id, "email")}
                          onPaste={e => handlePaste(e, index)}
                          onKeyDown={e => handleKeyDown(e, index, "email")}
                          autoFocus={row.id === lastAddedId}
                          placeholder="email@domain.com"
                          className={`w-full bg-white/[0.02] border focus:bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono transition-all ${
                            emailVal.valid === false
                              ? "border-red-500/50 focus:border-red-500"
                              : emailVal.valid === true
                              ? "border-emerald-500/50 focus:border-emerald-500"
                              : "border-white/[0.06] focus:border-[#2563eb]/50"
                          }`}
                        />
                        {emailVal.valid === true && (
                          <Check size={12} className="absolute right-3 text-emerald-400" />
                        )}
                        {emailVal.valid === false && (
                          <div className="absolute right-3 group/tooltip relative flex items-center">
                            <AlertCircle size={12} className="text-red-400" />
                            <span className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-red-950 border border-red-500/40 text-red-200 text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                              {emailVal.message}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* NAME COLUMN */}
                    <td className="p-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={row.name}
                          onChange={e => handleFieldChange(row.id, "name", e.target.value)}
                          onBlur={() => markFieldTouched(row.id, "name")}
                          onKeyDown={e => handleKeyDown(e, index, "name")}
                          placeholder="John Doe"
                          className={`w-full bg-white/[0.02] border focus:bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all ${
                            nameVal.valid === false
                              ? "border-red-500/50 focus:border-red-500"
                              : "border-white/[0.06] focus:border-[#2563eb]/50"
                          }`}
                        />
                        {nameVal.valid === false && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 group/tooltip flex items-center">
                            <AlertCircle size={12} className="text-red-400" />
                            <span className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-red-950 border border-red-500/40 text-red-200 text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                              {nameVal.message}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* BUSINESS TYPE COLUMN */}
                    <td className="p-2">
                      <div className="relative">
                        <select
                          value={row.businessType}
                          onChange={e => handleFieldChange(row.id, "businessType", e.target.value)}
                          onBlur={() => markFieldTouched(row.id, "businessType")}
                          className={`w-full bg-[#111317] border focus:bg-[#16181e] rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer appearance-none transition-all ${
                            typeVal.valid === false
                              ? "border-red-500/50 focus:border-red-500"
                              : "border-white/[0.06] focus:border-[#2563eb]/50"
                          }`}
                        >
                          <option value="clinic">Clinic</option>
                          <option value="property">Property</option>
                          <option value="food">Food</option>
                          <option value="other">Other</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                          </svg>
                        </div>
                      </div>
                    </td>

                    {/* BUSINESS NAME COLUMN */}
                    <td className="p-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={row.businessName}
                          onChange={e => handleFieldChange(row.id, "businessName", e.target.value)}
                          onBlur={() => markFieldTouched(row.id, "businessName")}
                          onKeyDown={e => handleKeyDown(e, index, "businessName")}
                          placeholder="Baker Street Clinic"
                          className={`w-full bg-white/[0.02] border focus:bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all ${
                            bNameVal.valid === false
                              ? "border-red-500/50 focus:border-red-500"
                              : "border-white/[0.06] focus:border-[#2563eb]/50"
                          }`}
                        />
                        {bNameVal.valid === false && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 group/tooltip flex items-center">
                            <AlertCircle size={12} className="text-red-400" />
                            <span className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-red-950 border border-red-500/40 text-red-200 text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                              {bNameVal.message}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* CITY COLUMN */}
                    <td className="p-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={row.city}
                          onChange={e => handleFieldChange(row.id, "city", e.target.value)}
                          onBlur={() => markFieldTouched(row.id, "city")}
                          onKeyDown={e => handleKeyDown(e, index, "city")}
                          placeholder="Chicago"
                          className={`w-full bg-white/[0.02] border focus:bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white outline-none transition-all ${
                            cityVal.valid === false
                              ? "border-red-500/50 focus:border-red-500"
                              : "border-white/[0.06] focus:border-[#2563eb]/50"
                          }`}
                        />
                        {cityVal.valid === false && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 group/tooltip flex items-center">
                            <AlertCircle size={12} className="text-red-400" />
                            <span className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-red-950 border border-red-500/40 text-red-200 text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                              {cityVal.message}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* REMOVE BUTTON COLUMN */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-2 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* INFO FOOTER ON KEYBOARD NAV */}
      <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-2">
        <HelpCircle size={12} className="text-[#2563eb] shrink-0" />
        <span className="text-[9px] font-mono text-secondary uppercase tracking-wider leading-normal">
          Keyboard navigation: <span className="text-white">Tab</span> to go to next field, <span className="text-white">Shift+Tab</span> to previous, <span className="text-white">Enter</span> at City field to auto-add and focus a new row.
        </span>
      </div>
    </div>
  );
}
