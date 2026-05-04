import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initializeAnalytics, trackPageView } from "../lib/analytics";

export default function AnalyticsDispatcher() {
  const location = useLocation();

  useEffect(() => {
    // Check consent before initializing
    const consent = localStorage.getItem('cookieConsent');
    if (consent === 'true') {
      initializeAnalytics();
    }
  }, []);

  useEffect(() => {
    // Track every route change
    trackPageView(location.pathname);
  }, [location]);

  return null;
}
