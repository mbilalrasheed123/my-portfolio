import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const ADMIN_EMAIL = 'muhammadbilalrasheed78@gmail.com';

export async function handleAnalyticsQuery(userEmail: string | undefined, userQuery: string): Promise<string> {
  // Admin check
  if (userEmail !== ADMIN_EMAIL) {
    return "Intelligence data is strictly reserved for the system administrator. How else can I assist you with Bilal's portfolio today?";
  }
  
  const queryLower = userQuery.toLowerCase();
  
  // Route to appropriate handler
  if (queryLower.includes('visitor') || queryLower.includes('traffic')) {
    return await getVisitorStats(queryLower);
  }
  
  if (queryLower.includes('page') || queryLower.includes('popular')) {
    return await getPageStats(queryLower);
  }
  
  if (queryLower.includes('device') || queryLower.includes('mobile') || queryLower.includes('desktop')) {
    return await getDeviceStats(queryLower);
  }
  
  if (queryLower.includes('click')) {
    return await getClickStats(queryLower);
  }
  
  if (queryLower.includes('report') || queryLower.includes('full')) {
    return await generateFullReport(queryLower);
  }
  
  // Default help
  return "I can provide real-time intelligence! Try asking me about:\n- Visitor count (today/week/month)\n- Most popular pages\n- Device breakdown\n- Click statistics\n- Full systems report";
}

// Visitor statistics
async function getVisitorStats(qText: string): Promise<string> {
  const timeRangeLabel = extractTimeRange(qText);
  const startDate = getStartDateByLabel(timeRangeLabel);
  
  const q = query(
    collection(db, 'analytics'),
    where('timestamp', '>=', startDate),
    where('eventType', '==', 'page_view')
  );
  
  const snapshot = await getDocs(q);
  const attendeeIds = new Set(snapshot.docs.map(doc => doc.data().userId));
  const uniqueUsers = attendeeIds.size;
  const totalPageViews = snapshot.size;
  
  return `📊 **${timeRangeLabel} Intelligence Summary:**\n\n` +
         `👥 Unique Entities: **${uniqueUsers}**\n` +
         `📄 Page Impressions: **${totalPageViews}**\n` +
         `📈 Engagement Velocity: **${uniqueUsers > 0 ? (totalPageViews / uniqueUsers).toFixed(1) : 0}** pages/entity`;
}

// Page statistics
async function getPageStats(qText: string): Promise<string> {
  const timeRangeLabel = extractTimeRange(qText);
  const startDate = getStartDateByLabel(timeRangeLabel);
  
  const q = query(
    collection(db, 'analytics'),
    where('timestamp', '>=', startDate),
    where('eventType', '==', 'page_view')
  );
  
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(doc => doc.data());
  
  const pageCount: Record<string, number> = {};
  events.forEach(e => {
    const p = e.page || '/';
    pageCount[p] = (pageCount[p] || 0) + 1;
  });
  
  const topPages = Object.entries(pageCount)
    .map(([page, views]) => ({ page, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);
  
  let response = `📄 **Top Strategic Locations (${timeRangeLabel}):**\n\n`;
  if (topPages.length === 0) return response + "No location data found in this timeframe.";
  
  topPages.forEach((p, i) => {
    response += `${i + 1}. **${p.page === '/' ? '/HOME' : p.page.toUpperCase()}** — ${p.views} views\n`;
  });
  
  return response;
}

// Device statistics
async function getDeviceStats(qText: string): Promise<string> {
  const timeRangeLabel = extractTimeRange(qText);
  const startDate = getStartDateByLabel(timeRangeLabel);
  
  const q = query(
    collection(db, 'analytics'),
    where('timestamp', '>=', startDate)
  );
  
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(doc => doc.data());
  
  const devices = events.reduce((acc, e) => {
    const device = e.metadata?.device || 'unknown';
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const total = Object.values(devices).reduce((a, b) => a + b, 0);
  
  let response = `📱 **Interface Breakdown (${timeRangeLabel}):**\n\n`;
  if (total === 0) return response + "Insufficient data for device analysis.";
  
  Object.entries(devices).forEach(([device, count]) => {
    const percent = ((count / total) * 100).toFixed(1);
    const emoji = device === 'desktop' ? '💻' : '📱';
    response += `${emoji} **${device.toUpperCase()}**: ${count} interactions (${percent}%)\n`;
  });
  
  return response;
}

// Click statistics
async function getClickStats(qText: string): Promise<string> {
  const timeRangeLabel = extractTimeRange(qText);
  const startDate = getStartDateByLabel(timeRangeLabel);
  
  const q = query(
    collection(db, 'analytics'),
    where('timestamp', '>=', startDate),
    where('eventType', '==', 'button_click')
  );
  
  const snapshot = await getDocs(q);
  const clicks = snapshot.docs.map(doc => doc.data());
  
  const elementCount: Record<string, number> = {};
  clicks.forEach(c => {
    const el = c.element || 'unknown_element';
    elementCount[el] = (elementCount[el] || 0) + 1;
  });
  
  const topClicks = Object.entries(elementCount)
    .map(([element, count]) => ({ element, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  let response = `🖱️ **Interaction Hotspots (${timeRangeLabel}):**\n\n`;
  response += `Total Tactile Events: **${clicks.length}**\n\n`;
  
  if (topClicks.length === 0) return response + "No interactions logged in this period.";
  
  topClicks.forEach((c, i) => {
    response += `${i + 1}. **${c.element.toUpperCase()}** — ${c.count} triggers\n`;
  });
  
  return response;
}

// Full report
async function generateFullReport(qText: string): Promise<string> {
  const timeRangeLabel = extractTimeRange(qText);
  
  const [visitors, pages, devices, clicks] = await Promise.all([
    getVisitorStats(`${timeRangeLabel}`),
    getPageStats(`${timeRangeLabel}`),
    getDeviceStats(`${timeRangeLabel}`),
    getClickStats(`${timeRangeLabel}`)
  ]);
  
  return `# 🧪 COMPREHENSIVE INTELLIGENCE REPORT (${timeRangeLabel.toUpperCase()})\n\n` +
         `${visitors}\n\n---\n\n` +
         `${pages}\n\n---\n\n` +
         `${devices}\n\n---\n\n` +
         `${clicks}`;
}

// Helper functions
function extractTimeRange(query: string): string {
  if (query.includes('today')) return 'Today';
  if (query.includes('week') || query.includes('7 day')) return 'Last 7 Days';
  if (query.includes('month') || query.includes('30 day')) return 'Last 30 Days';
  if (query.includes('all') || query.includes('total')) return 'All Time';
  return 'Today';
}

function getStartDateByLabel(label: string): Date {
  const now = new Date();
  if (label === 'Today') return new Date(now.setHours(0, 0, 0, 0));
  if (label === 'Last 7 Days') return new Date(now.setDate(now.getDate() - 7));
  if (label === 'Last 30 Days') return new Date(now.setDate(now.getDate() - 30));
  return new Date(0);
}
