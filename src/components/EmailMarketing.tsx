import React, { useState } from "react";
import { LayoutDashboard, Sliders, Mail, Layout, ListTodo, FileText } from "lucide-react";
import DashboardTab from "./email/DashboardTab";
import CampaignsTab from "./email/CampaignsTab";
import CreateCampaignWizard from "./email/CreateCampaignWizard";
import TemplatesTab from "./email/TemplatesTab";
import LogsTab from "./email/LogsTab";
import SettingsTab from "./email/SettingsTab";

export default function EmailMarketing() {
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "campaigns" | "templates" | "logs" | "settings">("dashboard");
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleEditCampaign = (campaign: any) => {
    setEditingCampaign(campaign);
    setIsWizardOpen(true);
  };

  const handleCreateNewCampaign = () => {
    setEditingCampaign(null);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setEditingCampaign(null);
  };

  const handleSaveSuccess = () => {
    setIsWizardOpen(false);
    setEditingCampaign(null);
    setActiveSubTab("campaigns");
  };

  return (
    <div className="space-y-6">
      {/* EMAIL MARKETING INNER NAVIGATION */}
      {!isWizardOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4 shrink-0">
          <button
            onClick={() => setActiveSubTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer border ${
              activeSubTab === "dashboard"
                ? "bg-accent text-white border-accent font-bold"
                : "border-line text-secondary hover:text-white hover:border-white/20"
            }`}
          >
            <LayoutDashboard size={11} /> Overview
          </button>

          <button
            onClick={() => setActiveSubTab("campaigns")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer border ${
              activeSubTab === "campaigns"
                ? "bg-accent text-white border-accent font-bold"
                : "border-line text-secondary hover:text-white hover:border-white/20"
            }`}
          >
            <Mail size={11} /> Campaigns
          </button>

          <button
            onClick={() => setActiveSubTab("templates")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer border ${
              activeSubTab === "templates"
                ? "bg-accent text-white border-accent font-bold"
                : "border-line text-secondary hover:text-white hover:border-white/20"
            }`}
          >
            <Layout size={11} /> Templates
          </button>

          <button
            onClick={() => setActiveSubTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer border ${
              activeSubTab === "logs"
                ? "bg-accent text-white border-accent font-bold"
                : "border-line text-secondary hover:text-white hover:border-white/20"
            }`}
          >
            <FileText size={11} /> Event Logs
          </button>

          <button
            onClick={() => setActiveSubTab("settings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer border ${
              activeSubTab === "settings"
                ? "bg-accent text-white border-accent font-bold"
                : "border-line text-secondary hover:text-white hover:border-white/20"
            }`}
          >
            <Sliders size={11} /> Settings
          </button>
        </div>
      )}

      {/* RENDER CURRENT VIEW */}
      <div className="min-h-[500px]">
        {isWizardOpen ? (
          <CreateCampaignWizard
            editingCampaign={editingCampaign}
            onClose={handleCloseWizard}
            onSaveSuccess={handleSaveSuccess}
          />
        ) : (
          <>
            {activeSubTab === "dashboard" && (
              <DashboardTab onNavigateToCampaigns={() => setActiveSubTab("campaigns")} />
            )}
            {activeSubTab === "campaigns" && (
              <CampaignsTab
                onEditCampaign={handleEditCampaign}
                onCreateNew={handleCreateNewCampaign}
              />
            )}
            {activeSubTab === "templates" && <TemplatesTab />}
            {activeSubTab === "logs" && <LogsTab />}
            {activeSubTab === "settings" && <SettingsTab />}
          </>
        )}
      </div>
    </div>
  );
}
