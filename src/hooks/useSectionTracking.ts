import { useEffect, useRef } from "react";
import { trackSectionView } from "../lib/analytics";

export function useSectionTracking(sectionId: string) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      trackSectionView(sectionId, elementRef.current);
    }
  }, [sectionId]);

  return elementRef;
}
