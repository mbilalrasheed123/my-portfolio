import { getAdminDb } from './firebase-admin';

export async function aggregateDailyStats(targetDate?: Date) {
  const adminDb = getAdminDb();
  if (!adminDb) {
    console.error("[Analytics] Cannot aggregate: Admin DB missing.");
    return;
  }
  
  const dateToProcess = targetDate || new Date();
  if (!targetDate) {
    // Default to yesterday if no date provided
    dateToProcess.setDate(dateToProcess.getDate() - 1);
  }
  
  dateToProcess.setHours(0, 0, 0, 0);
  const nextDay = new Date(dateToProcess);
  nextDay.setDate(nextDay.getDate() + 1);
  
  console.log(`[Analytics] Starting aggregation for ${dateToProcess.toISOString().split('T')[0]}`);
  
  try {
    // Fetch all events from the target day
    const eventsRef = adminDb.collection('analytics');
    const snapshot = await eventsRef
      .where('timestamp', '>=', dateToProcess)
      .where('timestamp', '<', nextDay)
      .get();
    
    if (snapshot.empty) {
      console.log(`[Analytics] No events found for ${dateToProcess.toISOString().split('T')[0]}`);
      return;
    }

    const events = snapshot.docs.map(doc => doc.data());
    const stats = calculateDailyStats(events, dateToProcess);
    
    const dateStr = dateToProcess.toISOString().split('T')[0];
    await adminDb.collection('dailyStats').doc(dateStr).set(stats);
    
    console.log(`[Analytics] Successfully aggregated stats for ${dateStr}`);
    return stats;
  } catch (error) {
    console.error(`[Analytics] Aggregation failed:`, error);
    throw error;
  }
}

function calculateDailyStats(events: any[], date: Date) {
  const pageViews = events.filter(e => e.eventType === 'page_view');
  const uniqueUsers = new Set(events.map(e => e.userId));
  const authenticatedUsers = new Set(
    events.filter(e => e.userEmail).map(e => e.userId)
  );
  
  // Page breakdown
  const pageCount: Record<string, { views: number, durations: number[] }> = {};
  pageViews.forEach(e => {
    const page = e.page || '/';
    if (!pageCount[page]) {
      pageCount[page] = { views: 0, durations: [] };
    }
    pageCount[page].views++;
    if (e.duration) pageCount[page].durations.push(e.duration);
  });
  
  const topPages = Object.entries(pageCount)
    .map(([page, data]) => ({
      page,
      views: data.views,
      avgDuration: data.durations.length 
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length 
        : 0
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  
  // Section breakdown
  const sectionViews = events.filter(e => e.eventType === 'section_view');
  const sectionCount: Record<string, number> = {};
  sectionViews.forEach(e => {
    if (e.section) {
      sectionCount[e.section] = (sectionCount[e.section] || 0) + 1;
    }
  });
  
  const topSections = Object.entries(sectionCount)
    .map(([section, views]) => ({ section, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  
  // Device breakdown
  const deviceStats = events.reduce((acc, e) => {
    const device = e.metadata?.device;
    if (device === 'desktop' || device === 'mobile' || device === 'tablet') {
      acc[device] = (acc[device] || 0) + 1;
    }
    return acc;
  }, { desktop: 0, mobile: 0, tablet: 0 });
  
  // Browser breakdown
  const browserMap: Record<string, number> = {};
  events.forEach(e => {
    const browser = e.metadata?.browser || 'Other';
    browserMap[browser] = (browserMap[browser] || 0) + 1;
  });
  
  const browserStats = Object.entries(browserMap)
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count);
  
  // Referrer breakdown
  const referrerMap: Record<string, number> = {};
  events.forEach(e => {
    const referrer = e.metadata?.referrer || 'direct';
    referrerMap[referrer] = (referrerMap[referrer] || 0) + 1;
  });
  
  const topReferrers = Object.entries(referrerMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Session stats
  const sessionIds = [...new Set(events.map(e => e.sessionId))];
  const avgPagesPerSession = sessionIds.length > 0 ? pageViews.length / sessionIds.length : 0;
  
  return {
    date: date.toISOString().split('T')[0],
    totalVisitors: uniqueUsers.size,
    authenticatedUsers: authenticatedUsers.size,
    anonymousUsers: uniqueUsers.size - authenticatedUsers.size,
    totalPageViews: pageViews.length,
    topPages,
    topSections,
    avgSessionDuration: 0, // Would need entry/exit timestamps to calculate accurately
    avgPagesPerSession,
    totalClicks: events.filter(e => e.eventType === 'button_click').length,
    deviceStats,
    browserStats,
    topReferrers,
  };
}
