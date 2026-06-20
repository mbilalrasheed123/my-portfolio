import React, { useEffect, useState } from "react";
import { Eye } from "lucide-react";

interface VisitorCounterProps {
  userId?: string;
}

export default function VisitorCounter({ userId }: VisitorCounterProps) {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const targetUserId = userId || "global";
    const visitKey = `unique_visit_${targetUserId}`;
    const hasVisited = localStorage.getItem(visitKey) === "true";
    
    const fetchVisitorCount = async () => {
      try {
        const isNewVisit = !hasVisited;
        
        const response = await fetch("/api/visitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId, isNewVisit })
        });

        if (response.ok) {
          const data = await response.json();
          if (isMounted && data.count !== undefined) {
            setVisitorCount(data.count);
            if (isNewVisit) {
              localStorage.setItem(visitKey, "true");
            }
          }
        }
      } catch (err) {
        // Silently fail to keep the UI clean if network or DB fails
      }
    };
    
    fetchVisitorCount();

    // Poll every 15 seconds for real-time updates without WebSockets
    const interval = setInterval(() => {
      if (localStorage.getItem(visitKey) === "true") {
        fetchVisitorCount();
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userId]);

  if (visitorCount === null) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4 text-xs font-mono text-secondary">
      <Eye size={14} className="opacity-70" />
      <span>{visitorCount.toLocaleString()} UNIQUE {visitorCount === 1 ? 'VISITOR' : 'VISITORS'}</span>
    </div>
  );
}
