import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
} from 'firebase/firestore';
import { 
  Users, 
  Eye, 
  MousePointer2, 
  Smartphone, 
  Monitor, 
  Tablet, 
  ArrowUpRight,
  ChevronRight,
  Activity,
  Calendar,
  Filter
} from 'lucide-react';
import { db, auth } from '../firebase';
import LoadingSpinner from './LoadingSpinner';

const ADMIN_EMAIL = 'muhammadbilalrasheed78@gmail.com';

type TimeRange = 'today' | '7days' | '30days' | 'all';

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [historicalAggregates, setHistoricalAggregates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      if (auth.currentUser?.email === ADMIN_EMAIL) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    };
    
    checkAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user?.email === ADMIN_EMAIL) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authorized) {
      fetchAnalytics();
    }
  }, [timeRange, authorized]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = getStartDate(timeRange);

      // 1. Fetch live events for "Today" (always needed for real-time stream)
      const qToday = query(
        collection(db, 'analytics'),
        where('timestamp', '>=', Timestamp.fromDate(today)),
        orderBy('timestamp', 'desc')
      );
      const todaySnapshot = await getDocs(qToday);
      const todayEvents = todaySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (timeRange === 'today') {
        setEvents(todayEvents);
        setHistoricalAggregates([]);
      } else {
        // 2. Fetch aggregated DailyStats for historical data
        const qStats = query(
          collection(db, 'dailyStats'),
          where('date', '>=', startDate.toISOString().split('T')[0]),
          orderBy('date', 'desc')
        );
        const statsSnapshot = await getDocs(qStats);
        const historicalData = statsSnapshot.docs.map(doc => doc.data());
        
        setHistoricalAggregates(historicalData);
        setEvents(todayEvents);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStartDate(range: TimeRange) {
    const now = new Date();
    if (range === 'today') return new Date(now.setHours(0, 0, 0, 0));
    if (range === '7days') return new Date(now.setDate(now.getDate() - 7));
    if (range === '30days') return new Date(now.setDate(now.getDate() - 30));
    return new Date(0);
  }

  /**
   * Calculators
   */
  const stats = useMemo(() => {
    // Current day stats from live events
    const todayPageViews = events.filter(e => e.eventType === 'page_view');
    const todayUsers = new Set(events.map(e => e.userId)).size;
    const todayClicks = events.filter(e => e.eventType === 'button_click').length;
    const todayScrollEvents = events.filter(e => e.eventType === 'scroll_depth');

    // Combine with historical aggregates
    const histVisitors = historicalAggregates.reduce((acc, s) => acc + (s.totalVisitors || 0), 0);
    const histPageViews = historicalAggregates.reduce((acc, s) => acc + (s.totalPageViews || 0), 0);
    const histClicks = historicalAggregates.reduce((acc, s) => acc + (s.totalClicks || 0), 0);

    const totalVisitors = todayUsers + histVisitors;
    const totalPageViews = todayPageViews.length + histPageViews;
    const totalClicks = todayClicks + histClicks;

    // Pages (Combine records)
    const pageMap: Record<string, number> = {};
    todayPageViews.forEach(e => {
      const p = e.page || '/';
      pageMap[p] = (pageMap[p] || 0) + 1;
    });
    historicalAggregates.forEach(s => {
      s.topPages?.forEach((p: any) => {
        pageMap[p.page] = (pageMap[p.page] || 0) + (p.views || 0);
      });
    });

    const topPages = Object.entries(pageMap)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Devices
    const devices = { desktop: 0, mobile: 0, tablet: 0 };
    events.forEach(e => {
      const d = e.metadata?.device;
      if (d === 'desktop') devices.desktop++;
      else if (d === 'mobile') devices.mobile++;
      else if (d === 'tablet') devices.tablet++;
    });
    historicalAggregates.forEach(s => {
      if (s.deviceStats) {
        devices.desktop += s.deviceStats.desktop || 0;
        devices.mobile += s.deviceStats.mobile || 0;
        devices.tablet += s.deviceStats.tablet || 0;
      }
    });

    // Recent activity
    const recentEvents = events.slice(0, 10);

    return {
      totalVisitors,
      totalPageViews,
      totalClicks,
      avgScroll: todayScrollEvents.length ? Math.round(todayScrollEvents.reduce((acc, e) => acc + (e.scrollDepth || 0), 0) / todayScrollEvents.length) : 0,
      topPages,
      devices,
      recentEvents
    };
  }, [events, historicalAggregates]);

  if (!authorized) {
    return (
      <div className="min-h-screen py-32 flex items-center justify-center bg-black text-white p-6">
        <div className="text-center">
          <h1 className="text-4xl font-display uppercase mb-4">Access Denied</h1>
          <p className="text-secondary font-mono mb-8">This terminal is restricted to administrators.</p>
          <a href="/" className="px-8 py-3 bg-white text-black rounded-lg font-display uppercase tracking-widest text-xs hover:bg-accent hover:text-white transition-all">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-32 pb-20 px-6">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-5xl font-display uppercase mb-4 tracking-tight">Intelligence</h1>
            <p className="text-secondary font-mono uppercase tracking-[0.2em] text-xs">Analytics & Engagement Dashboard</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            {(['today', '7days', '30days', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${
                  timeRange === range ? 'bg-white text-black' : 'text-secondary hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Visitors" value={stats.totalVisitors} icon={<Users size={20} />} trend="+12%" />
              <StatCard title="Page Views" value={stats.totalPageViews} icon={<Eye size={20} />} trend="+8%" />
              <StatCard title="Interactions" value={stats.totalClicks} icon={<MousePointer2 size={20} />} trend="+15%" />
              <StatCard title="Avg Scroll" value={`${stats.avgScroll}%`} icon={<Activity size={20} />} trend="stable" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Traffic Chart Placeholder (UI only for now) */}
              <div className="lg:col-span-2 bg-white/5 rounded-3xl border border-white/10 p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-display uppercase tracking-widest">Traffic Trends</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent"></div>
                      <span className="text-[10px] font-mono text-secondary uppercase">Views</span>
                    </div>
                  </div>
                </div>
                
                {/* Mock Chart Visualization */}
                <div className="h-[300px] flex items-end gap-2">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="flex-1 group relative">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.random() * 80 + 20}%` }}
                        className="w-full bg-white/10 rounded-t-lg group-hover:bg-accent/50 transition-colors"
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-[8px] font-mono p-1 rounded border border-white/20">
                        {Math.floor(Math.random() * 100)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 px-2">
                  <span className="text-[8px] font-mono text-secondary uppercase">Mon</span>
                  <span className="text-[8px] font-mono text-secondary uppercase">Sun</span>
                </div>
              </div>

              {/* Top Pages */}
              <div className="bg-white/5 rounded-3xl border border-white/10 p-8">
                <h2 className="text-xl font-display uppercase tracking-widest mb-8">Top Locations</h2>
                <div className="space-y-6">
                  {stats.topPages.map((page, i) => (
                    <div key={page.page} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-secondary">0{i+1}</span>
                        <span className="text-sm font-mono truncate max-w-[150px]">{page.page === '/' ? '/HOME' : page.page.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-display">{page.views}</span>
                        <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(page.views / stats.totalPageViews) * 100}%` }}
                            className="h-full bg-accent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Devices */}
              <div className="bg-white/5 rounded-3xl border border-white/10 p-8">
                <h2 className="text-xl font-display uppercase tracking-widest mb-8">Device Distribution</h2>
                <div className="grid grid-cols-3 gap-4">
                  <DeviceBox icon={<Monitor size={24} />} label="Desktop" count={stats.devices.desktop} total={events.length} />
                  <DeviceBox icon={<Smartphone size={24} />} label="Mobile" count={stats.devices.mobile} total={events.length} />
                  <DeviceBox icon={<Tablet size={24} />} label="Tablet" count={stats.devices.tablet} total={events.length} />
                </div>
              </div>

              {/* Feed */}
              <div className="bg-zinc-900/50 rounded-3xl border border-white/10 p-8">
                <h2 className="text-xl font-display uppercase tracking-widest mb-8">Real-time Stream</h2>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {stats.recentEvents.map((e, i) => (
                    <div key={e.id || i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors px-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${e.eventType === 'page_view' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <div>
                          <p className="text-[10px] font-mono text-white uppercase">{e.eventType.replace('_', ' ')}</p>
                          <p className="text-[8px] font-mono text-secondary uppercase">{e.page}</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono text-secondary uppercase">
                        {e.timestamp?.toDate ? e.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: any) {
  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6 hover:bg-white/[0.07] transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="text-secondary group-hover:text-accent transition-colors">
          {icon}
        </div>
        <span className={`text-[8px] font-mono px-2 py-1 rounded bg-white/5 ${trend.includes('+') ? 'text-green-500' : 'text-blue-500'}`}>
          {trend}
        </span>
      </div>
      <p className="text-[10px] font-mono text-secondary uppercase tracking-[0.1em] mb-1">{title}</p>
      <h3 className="text-3xl font-display uppercase">{value}</h3>
    </div>
  );
}

function DeviceBox({ icon, label, count, total }: any) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="text-center p-6 bg-black/40 rounded-2xl border border-white/5">
      <div className="flex justify-center text-secondary mb-3">{icon}</div>
      <p className="text-[8px] font-mono text-secondary uppercase mb-2">{label}</p>
      <p className="text-xl font-display">{percentage}%</p>
    </div>
  );
}
