import React, { useState } from "react";
import { Sparkles, LayoutDashboard, List, Plus, Wand2 } from "lucide-react";
import AIDashboard from "./AIDashboard";
import AICampaignsList from "./AICampaignsList";
import CreateAICampaignWizard from "./CreateAICampaignWizard";
import AICampaignDetail from "./AICampaignDetail";

export default function AICampaignsTab() {
  // Navigation states: 'dashboard' | 'list' | 'create' | 'detail'
  const [subView, setSubView] = useState<"dashboard" | "list" | "create" | "detail">("dashboard");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const handleSelectCampaign = (id: string) => {
    setSelectedCampaignId(id);
    setSubView("detail");
  };

  const handleWizardSuccess = (id: string) => {
    setSelectedCampaignId(id);
    setSubView("detail");
  };

  return (
    <div className="space-y-6">
      {/* SECONDARY NAVIGATION CONTROLS */}
      {subView !== "create" && subView !== "detail" && (
        <div className="flex border-b border-white/[0.04] pb-4 gap-4">
          <button
            onClick={() => setSubView("dashboard")}
            className={`px-4 py-2 rounded-xl font-mono text-[9px] uppercase tracking-widest border transition-all flex items-center gap-2 cursor-pointer ${
              subView === "dashboard"
                ? "bg-[#2563eb] border-[#2563eb] text-white font-bold shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                : "bg-white/[0.01] border-white/[0.04] text-secondary hover:text-white"
            }`}
          >
            <LayoutDashboard size={12} /> Dashboard
          </button>

          <button
            onClick={() => setSubView("list")}
            className={`px-4 py-2 rounded-xl font-mono text-[9px] uppercase tracking-widest border transition-all flex items-center gap-2 cursor-pointer ${
              subView === "list"
                ? "bg-[#2563eb] border-[#2563eb] text-white font-bold shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                : "bg-white/[0.01] border-white/[0.04] text-secondary hover:text-white"
            }`}
          >
            <List size={12} /> Campaigns List
          </button>
        </div>
      )}

      {/* CORE VIEW PORTS */}
      <div className="transition-all duration-300">
        {subView === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            <AIDashboard />
            <div className="border-t border-white/[0.04] pt-8">
              <AICampaignsList 
                onSelectCampaign={handleSelectCampaign} 
                onCreateNew={() => setSubView("create")} 
              />
            </div>
          </div>
        )}

        {subView === "list" && (
          <div className="animate-fade-in">
            <AICampaignsList 
              onSelectCampaign={handleSelectCampaign} 
              onCreateNew={() => setSubView("create")} 
            />
          </div>
        )}

        {subView === "create" && (
          <div className="animate-fade-in">
            <CreateAICampaignWizard 
              onBack={() => setSubView("dashboard")} 
              onSuccess={handleWizardSuccess} 
            />
          </div>
        )}

        {subView === "detail" && selectedCampaignId && (
          <div className="animate-fade-in">
            <AICampaignDetail 
              campaignId={selectedCampaignId} 
              onBack={() => setSubView("dashboard")} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
