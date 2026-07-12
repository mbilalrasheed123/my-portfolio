export interface AICampaign {
  id?: string;
  title: string;
  description?: string;
  status: "draft" | "generating" | "ready-to-send" | "active" | "paused" | "completed";
  totalLeads: number;
  sentCount: number;
  failedCount: number;
  remainingCount: number;
  geminiModel: "flash-lite" | "flash" | "2.5-flash" | "2.5-pro";
  imageStrategy: "option1-keyword" | "option2-direct-url";
  imageKeywordTemplate?: string;
  instructions: string;
  createdAt: any;
  updatedAt: any;
  startedAt?: any;
  generationCompletedAt?: any;
  lastSentAt?: any;
  errorMessage?: string;
  summary?: {
    totalBatches: number;
    batchesProcessed: number;
    estimatedTimeRemaining: string;
  };
}

export interface AICampaignLead {
  id: string;
  email: string;
  name: string;
  businessType: string;
  businessName: string;
  city: string;
  status: "pending" | "generated" | "sent" | "failed";
  generatedEmail?: {
    subject: string;
    htmlBody: string;
    selectedImageUrl?: string;
    imageKeyword?: string;
  };
  batchNumber?: number;
  createdAt: any;
  updatedAt: any;
  sentAt?: any;
  errorMessage?: string;
  retryCount?: number;
}

export interface AICampaignLog {
  id: string;
  leadId: string;
  email: string;
  name: string;
  batchNumber: number;
  status: "generated" | "sent" | "failed";
  sentAt: any;
  emailContent?: {
    subject: string;
    body: string;
    imageUrl?: string;
  };
  errorMessage?: string;
}

export interface AICampaignSettings {
  emailsSentToday: number;
  lastEmailSentDate: string;
}
