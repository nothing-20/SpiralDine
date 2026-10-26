import { useState, useEffect } from 'react';

export interface ViewportInfo {
  isMobile: boolean;       // < 768px
  isTablet: boolean;       // 768px - 1023px
  isDesktop: boolean;      // >= 1024px
  isUltrawide: boolean;    // >= 1920px
  width: number;
}

/**
 * Reactive viewport hook that detects device viewport size and responds
 * to window resize events in real-time without requiring URL switches or page reloads.
 */
export function useViewport(): ViewportInfo {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1024; // Default SSR/fallback
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    // Use matchMedia listeners for instant breakpoint transitions
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    const mediaListener = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', mediaListener);
      tabletQuery.addEventListener('change', mediaListener);
      desktopQuery.addEventListener('change', mediaListener);
    } else {
      mobileQuery.addListener(mediaListener);
      tabletQuery.addListener(mediaListener);
      desktopQuery.addListener(mediaListener);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener('change', mediaListener);
        tabletQuery.removeEventListener('change', mediaListener);
        desktopQuery.removeEventListener('change', mediaListener);
      } else {
        mobileQuery.removeListener(mediaListener);
        tabletQuery.removeListener(mediaListener);
        desktopQuery.removeListener(mediaListener);
      }
    };
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isUltrawide: width >= 1920,
    width,
  };
}

export function useIsMobile(breakpoint: number = 768): boolean {
  const { width } = useViewport();
  return width < breakpoint;
}

export default useViewport;
