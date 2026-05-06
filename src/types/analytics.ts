import { Timestamp } from "firebase/firestore";

export type EventType = 'page_view' | 'section_view' | 'button_click' | 'scroll_depth' | 'session_end';

export interface AnalyticsMetadata {
  device: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  screenWidth: number;
  screenHeight: number;
  referrer: string;
  userAgent: string;
}

export interface AnalyticsEvent {
  id?: string;
  userId: string; // Firebase Auth UID or 'anonymous-{sessionId}'
  userEmail?: string;
  sessionId: string;
  eventType: EventType;
  page: string;
  section?: string;
  element?: string;
  timestamp: Timestamp | Date;
  duration?: number;
  metadata: AnalyticsMetadata;
  scrollDepth?: number;
  clickPosition?: { x: number; y: number };
}

export interface Session {
  sessionId: string;
  userId: string;
  userEmail?: string;
  startTime: Timestamp | Date;
  endTime?: Timestamp | Date;
  totalDuration: number;
  pagesVisited: string[];
  totalPageViews: number;
  totalClicks: number;
  totalScrollEvents: number;
  entryPage: string;
  exitPage?: string;
  device: string;
  browser: string;
  referrer: string;
}

export interface PageStats {
  page: string;
  views: number;
  avgDuration: number;
}

export interface SectionStats {
  section: string;
  views: number;
}

export interface DailyStats {
  id?: string; // date 'YYYY-MM-DD'
  date: string;
  totalVisitors: number;
  authenticatedUsers: number;
  anonymousUsers: number;
  totalPageViews: number;
  topPages: PageStats[];
  topSections: SectionStats[];
  avgSessionDuration: number;
  avgPagesPerSession: number;
  totalClicks: number;
  deviceStats: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  browserStats: { browser: string, count: number }[];
  topReferrers: { source: string, count: number }[];
}
