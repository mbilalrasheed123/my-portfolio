import { auth, db } from '../firebase';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { AnalyticsEvent, AnalyticsMetadata, EventType } from '../types/analytics';

let currentSessionId: string | null = null;
let currentUserId: string = 'anonymous';
let eventQueue: AnalyticsEvent[] = [];
let maxScrollDepth = 0;
let isSamplingEnabled = true; // Optimization: can be toggled via config

function shouldTrack(): boolean {
  if (!isSamplingEnabled) return true;
  // Track 100% of authenticated users
  if (auth.currentUser) return true;
  // Track 80% of anonymous users to save writes
  return Math.random() < 0.8;
}

/**
 * Initialization and Session Management
 */
export function initializeAnalytics() {
  // Respect cookie consent (assuming 'true' as default for this demo context, 
  // but checking localStorage as requested)
  if (localStorage.getItem('cookieConsent') === 'false') {
    return;
  }
  
  // Get or create session ID
  currentSessionId = sessionStorage.getItem('sessionId') || generateSessionId();
  sessionStorage.setItem('sessionId', currentSessionId);
  
  // Listen for auth changes to update user context
  auth.onAuthStateChanged((user) => {
    currentUserId = user?.uid || `anonymous-${currentSessionId}`;
  });
  
  // Track initial page view
  trackPageView(window.location.pathname);
  
  // Initialize scroll tracking
  initScrollTracking();
  
  // Track session end/unload
  window.addEventListener('beforeunload', () => {
    trackEvent('session_end', { duration: Math.round((Date.now() - sessionStartTime) / 1000) });
    flushEvents();
  });
  
  // Flush events periodically
  setInterval(flushEvents, 30000); 
}

const sessionStartTime = Date.now();

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Core Tracking Functions
 */

export async function trackPageView(page: string) {
  trackEvent('page_view', { page });
}

export function trackSectionView(sectionId: string, element: HTMLElement) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          trackEvent('section_view', { section: sectionId });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  
  if (element) observer.observe(element);
}

export function trackClick(elementName: string, additionalData?: any) {
  trackEvent('button_click', { element: elementName, ...additionalData });
}

function initScrollTracking() {
  window.addEventListener('scroll', debounce(() => {
    const scrollTop = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    
    const scrollDepth = Math.min(100, Math.round((scrollTop / docHeight) * 100));
    
    if (scrollDepth > maxScrollDepth) {
      const milestones = [25, 50, 75, 100];
      const reachedMilestone = milestones.find(m => scrollDepth >= m && maxScrollDepth < m);
      
      if (reachedMilestone) {
        maxScrollDepth = scrollDepth;
        trackEvent('scroll_depth', { scrollDepth: reachedMilestone });
      }
    }
  }, 500));
}

/**
 * Event Processing
 */

function trackEvent(eventType: EventType, data: Partial<AnalyticsEvent>) {
  if (!currentSessionId || !shouldTrack()) return;

  const event: AnalyticsEvent = {
    userId: currentUserId,
    userEmail: auth.currentUser?.email || null,
    sessionId: currentSessionId,
    eventType,
    page: data.page || window.location.pathname,
    timestamp: Timestamp.now(),
    metadata: getDeviceMetadata(),
    ...data
  } as AnalyticsEvent;

  queueEvent(event);
}

function queueEvent(event: AnalyticsEvent) {
  eventQueue.push(event);
  if (eventQueue.length >= 10) {
    flushEvents();
  }
}

async function flushEvents() {
  if (eventQueue.length === 0) return;
  
  const eventsToFlush = [...eventQueue];
  eventQueue = []; // Clear queue immediately to avoid duplicates during async ops
  
  try {
    const batch = writeBatch(db);
    eventsToFlush.forEach(event => {
      const ref = doc(collection(db, 'analytics'));
      batch.set(ref, event);
    });
    await batch.commit();
  } catch (error) {
    console.error('Analytics batch upload failed:', error);
    // Put back in queue if failed? For now, we omit to prevent infinite loops of errors
  }
}

/**
 * Helpers
 */

function getDeviceMetadata(): AnalyticsMetadata {
  const ua = navigator.userAgent;
  return {
    device: getDeviceType(),
    browser: getBrowserName(ua),
    os: getOS(ua),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    referrer: document.referrer || 'direct',
    userAgent: ua,
  };
}

function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getBrowserName(ua: string): string {
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Other';
}

function getOS(ua: string): string {
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Other';
}

function debounce(func: Function, wait: number) {
  let timeout: any;
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}
